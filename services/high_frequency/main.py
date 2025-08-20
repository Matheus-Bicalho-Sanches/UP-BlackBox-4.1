"""
High Frequency Market Data Backend
==================================
Backend otimizado para 70-150 ativos com 50K+ ticks/segundo.
Sistema independente com zero perdas e agregação em tempo real.
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
import httpx

# Importa nossos sistemas de alta frequência
from high_frequency_buffer import HighFrequencyBuffer, Tick
from high_frequency_persistence import HighFrequencyPersistence, PersistenceConfig

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Inicialização do FastAPI
app = FastAPI(
    title="High Frequency Market Data API",
    description="API para dados de mercado de alta frequência - 50K+ ticks/segundo",
    version="1.0.0"
)

# CORS para frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especificar domínios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos Pydantic
class SubscribeRequest(BaseModel):
    symbol: str
    exchange: str = "B"  # B3 por padrão

class UnsubscribeRequest(BaseModel):
    symbol: str

class TickData(BaseModel):
    symbol: str
    exchange: str
    price: float
    volume: int
    timestamp: float
    trade_id: Optional[int] = None
    buyer_maker: Optional[bool] = None

class CandleData(BaseModel):
    symbol: str
    exchange: str
    timeframe: str
    open_time: float
    close_time: float
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    total_volume: int
    total_volume_financial: float
    tick_count: int

class IngestTick(BaseModel):
    symbol: str
    exchange: str = "B"
    price: float
    volume: int
    timestamp: Optional[float] = None
    trade_id: Optional[int] = None
    buyer_maker: Optional[bool] = None

class IngestBatch(BaseModel):
    ticks: List[IngestTick]

# Configuração global
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
PROFIT_FEED_URL = os.getenv("PROFIT_FEED_URL", "http://localhost:8001")
HF_DISABLE_SIM = os.getenv("HF_DISABLE_SIM", "0").lower() in ("1", "true", "yes")

# Sistemas principais
high_freq_buffer: Optional[HighFrequencyBuffer] = None
high_freq_persistence: Optional[HighFrequencyPersistence] = None

# Estado global
active_subscriptions: Dict[str, Dict[str, Any]] = {}
subscription_stats: Dict[str, Dict[str, Any]] = {}
simulation_task: Optional[asyncio.Task] = None
simulation_enabled: bool = not HF_DISABLE_SIM

# Inicialização do Firebase
def init_firebase():
    """Inicializa Firebase Admin SDK."""
    try:
        if os.path.exists(FIREBASE_CREDENTIALS_PATH):
            cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized successfully")
        else:
            logger.warning("Firebase credentials not found, using default app")
            firebase_admin.initialize_app()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")

# Inicialização dos sistemas de alta frequência
def init_high_frequency_systems():
    """Inicializa os sistemas de alta frequência."""
    global high_freq_buffer, high_freq_persistence
    
    try:
        # Configuração otimizada para 70-150 ativos
        buffer_config = {
            'max_ticks_per_symbol': 5_000_000,  # 5M ticks por símbolo
            'processing_interval_ms': 50,  # 50ms para latência ultra-baixa
            'batch_size': 2000  # Lotes maiores para eficiência
        }
        
        # Configuração de persistência otimizada
        persistence_config = PersistenceConfig(
            batch_size=2000,  # 2K ticks por lote
            batch_timeout_ms=50,  # 50ms timeout
            max_retries=5,  # Mais retries para zero perdas
            retry_delay_ms=50,  # Delay menor
            connection_pool_size=20,  # Mais conexões para alta frequência
            enable_compression=True,
            enable_backup=True
        )
        
        # Inicializa buffer
        high_freq_buffer = HighFrequencyBuffer(**buffer_config)
        
        # Inicializa persistência
        high_freq_persistence = HighFrequencyPersistence(DATABASE_URL, persistence_config)
        
        # Configura callbacks
        high_freq_buffer.on_tick_processed = on_tick_processed_callback
        high_freq_buffer.on_candle_updated = on_candle_updated_callback
        high_freq_buffer.on_gap_detected = on_gap_detected_callback
        
        # Inicia processamento
        high_freq_buffer.start_processing()
        high_freq_persistence.start_processing()
        
        logger.info("High frequency systems initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize high frequency systems: {e}")
        raise

# Callbacks do sistema
def on_tick_processed_callback(tick: Tick):
    """Callback executado quando um tick é processado."""
    try:
        # Adiciona para persistência em lote
        if high_freq_persistence:
            high_freq_persistence.add_tick(tick.to_dict())
        
        # Atualiza estatísticas
        symbol = tick.symbol
        if symbol in subscription_stats:
            stats = subscription_stats[symbol]
            stats['last_tick_time'] = time.time()
            stats['total_ticks'] = stats.get('total_ticks', 0) + 1
            stats['last_price'] = tick.price
            stats['last_volume'] = tick.volume
            
    except Exception as e:
        logger.error(f"Error in tick callback: {e}")

def on_candle_updated_callback(candle: CandleData):
    """Callback executado quando um candle é atualizado."""
    try:
        # Adiciona para persistência em lote
        if high_freq_persistence:
            high_freq_persistence.add_candle(candle.dict())
            
    except Exception as e:
        logger.error(f"Error in candle callback: {e}")

def on_gap_detected_callback(symbol: str, start_time: float, end_time: float):
    """Callback executado quando um gap é detectado."""
    try:
        gap_duration = end_time - start_time
        logger.warning(f"Gap detected for {symbol}: {gap_duration:.2f}s from {start_time} to {end_time}")
        
        # Atualiza estatísticas
        if symbol in subscription_stats:
            subscription_stats[symbol]['gaps_detected'] = subscription_stats[symbol].get('gaps_detected', 0) + 1
            
    except Exception as e:
        logger.error(f"Error in gap callback: {e}")

# Simulação de ticks para teste
async def simulate_ticks():
    """Simula ticks para teste do sistema."""
    if not high_freq_buffer:
        return
    
    logger.info("Starting tick simulation...")
    
    # Símbolos de teste
    test_symbols = ["PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3"]
    
    while True:
        try:
            produced_any = False
            for symbol in test_symbols:
                if symbol in active_subscriptions:
                    # Simula tick com dados realistas
                    import random
                    
                    tick = Tick(
                        symbol=symbol,
                        exchange="B",
                        price=random.uniform(10.0, 100.0),
                        volume=random.randint(100, 10000),
                        timestamp=time.time(),
                        trade_id=random.randint(1, 1000000),
                        buyer_maker=random.choice([True, False])
                    )
                    
                    # Adiciona ao buffer
                    high_freq_buffer.add_tick(tick)
                    produced_any = True
                    
                    # Aguarda um pouco para não sobrecarregar
                    await asyncio.sleep(0.001)  # 1ms entre ticks
            # Se não produziu nenhum tick (sem assinaturas), cede o loop
            if not produced_any:
                await asyncio.sleep(0.05)  # 50ms de espera quando ocioso
            
        except Exception as e:
            logger.error(f"Error in tick simulation: {e}")
            await asyncio.sleep(1)

# Eventos de startup/shutdown
@app.on_event("startup")
async def startup_event():
    """Evento executado na inicialização."""
    logger.info("Starting High Frequency Market Data Backend...")
    
    try:
        # Inicializa Firebase
        init_firebase()
        
        # Inicializa sistemas de alta frequência
        init_high_frequency_systems()
        
        # Inicia simulação de ticks em background (se habilitado)
        if simulation_enabled:
            global simulation_task
            simulation_task = asyncio.create_task(simulate_ticks())
        
        logger.info("Backend started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start backend: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Evento executado no desligamento."""
    logger.info("Shutting down High Frequency Market Data Backend...")
    
    try:
        if high_freq_buffer:
            high_freq_buffer.stop_processing()
        
        if high_freq_persistence:
            high_freq_persistence.stop_processing()
            
        logger.info("Backend shutdown completed")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Endpoints da API
@app.post("/subscribe")
async def subscribe_symbol(request: SubscribeRequest):
    """Inscreve em um símbolo para receber ticks."""
    try:
        symbol = request.symbol.upper()
        exchange = request.exchange.upper()
        
        # Encaminha subscribe para o serviço da DLL (Profit Feed), se configurado
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                await client.post(f"{PROFIT_FEED_URL}/subscribe", json={"ticker": symbol, "exch": exchange})
        except Exception as e:
            logger.warning(f"Failed to forward subscribe to PROFIT_FEED_URL: {e}")
        
        # Adiciona à lista de assinaturas ativas
        active_subscriptions[symbol] = {
            'symbol': symbol,
            'exchange': exchange,
            'subscribed_at': time.time(),
            'status': 'active'
        }
        
        # Inicializa estatísticas
        subscription_stats[symbol] = {
            'total_ticks': 0,
            'last_tick_time': 0,
            'last_price': 0,
            'last_volume': 0,
            'gaps_detected': 0,
            'start_time': time.time()
        }
        
        # Salva no Firestore
        try:
            db = firestore.client()
            db.collection('activeSubscriptions').document(symbol).set({
                'symbol': symbol,
                'exchange': exchange,
                'subscribed_at': firestore.SERVER_TIMESTAMP,
                'status': 'active',
                'backend': 'high_frequency'
            })
        except Exception as e:
            logger.warning(f"Failed to save to Firestore: {e}")
        
        logger.info(f"Subscribed to {symbol} on {exchange}")
        
        return {
            "success": True,
            "message": f"Subscribed to {symbol}",
            "symbol": symbol,
            "exchange": exchange
        }
        
    except Exception as e:
        logger.error(f"Error subscribing to {request.symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/unsubscribe")
async def unsubscribe_symbol(request: UnsubscribeRequest):
    """Cancela inscrição em um símbolo."""
    try:
        symbol = request.symbol.upper()
        
        if symbol in active_subscriptions:
            # Remove da lista ativa
            del active_subscriptions[symbol]
            
            # Remove estatísticas
            if symbol in subscription_stats:
                del subscription_stats[symbol]
            
            # Encaminha unsubscribe para o serviço da DLL
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    await client.post(f"{PROFIT_FEED_URL}/unsubscribe", json={"ticker": symbol})
            except Exception as e:
                logger.warning(f"Failed to forward unsubscribe to PROFIT_FEED_URL: {e}")
            
            # Atualiza Firestore
            try:
                db = firestore.client()
                db.collection('activeSubscriptions').document(symbol).update({
                    'status': 'inactive',
                    'unsubscribed_at': firestore.SERVER_TIMESTAMP
                })
            except Exception as e:
                logger.warning(f"Failed to update Firestore: {e}")
            
            logger.info(f"Unsubscribed from {symbol}")
            
            return {
                "success": True,
                "message": f"Unsubscribed from {symbol}",
                "symbol": symbol
            }
        else:
            raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found in active subscriptions")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unsubscribing from {request.symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/tick")
async def ingest_tick(tick: IngestTick):
    """Ingestão de 1 tick (via ProfitDLL)."""
    try:
        if not high_freq_buffer:
            raise HTTPException(status_code=503, detail="buffer_unavailable")
        ts = tick.timestamp or time.time()
        high_freq_buffer.add_tick(Tick(
            symbol=tick.symbol.upper(),
            exchange=tick.exchange.upper(),
            price=tick.price,
            volume=tick.volume,
            timestamp=ts,
            trade_id=tick.trade_id,
            buyer_maker=tick.buyer_maker
        ))
        return {"success": True}
    except Exception as e:
        logger.error(f"Error ingest_tick: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/batch")
async def ingest_batch(batch: IngestBatch):
    """Ingestão em lote de ticks (melhor para performance)."""
    try:
        if not high_freq_buffer:
            raise HTTPException(status_code=503, detail="buffer_unavailable")
        for t in batch.ticks:
            ts = t.timestamp or time.time()
            high_freq_buffer.add_tick(Tick(
                symbol=t.symbol.upper(),
                exchange=t.exchange.upper(),
                price=t.price,
                volume=t.volume,
                timestamp=ts,
                trade_id=t.trade_id,
                buyer_maker=t.buyer_maker
            ))
        return {"success": True, "ingested": len(batch.ticks)}
    except Exception as e:
        logger.error(f"Error ingest_batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/subscriptions")
async def get_active_subscriptions():
    """Retorna lista de assinaturas ativas."""
    try:
        subscriptions = []
        for symbol, data in active_subscriptions.items():
            stats = subscription_stats.get(symbol, {})
            subscriptions.append({
                'symbol': symbol,
                'exchange': data['exchange'],
                'subscribed_at': data['subscribed_at'],
                'status': data['status'],
                'total_ticks': stats.get('total_ticks', 0),
                'last_tick_time': stats.get('last_tick_time', 0),
                'last_price': stats.get('last_price', 0),
                'gaps_detected': stats.get('gaps_detected', 0)
            })
        
        return {
            "success": True,
            "subscriptions": subscriptions,
            "total_count": len(subscriptions)
        }
        
    except Exception as e:
        logger.error(f"Error getting subscriptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ticks/{symbol}")
async def get_ticks(symbol: str, limit: int = 1000, timeframe: str = "raw"):
    """Retorna ticks para um símbolo específico."""
    try:
        if not high_freq_buffer:
            raise HTTPException(status_code=503, detail="High frequency buffer not available")
        
        symbol = symbol.upper()
        
        if timeframe == "raw":
            # Retorna ticks individuais
            end_time = time.time()
            start_time = end_time - (limit * 0.1)  # Últimos ticks
            
            ticks = high_freq_buffer.get_ticks_window(symbol, start_time, end_time, limit)
            
            return {
                "success": True,
                "symbol": symbol,
                "timeframe": timeframe,
                "ticks": [tick.to_dict() for tick in ticks],
                "count": len(ticks)
            }
        else:
            # Retorna candle consolidado
            candle = high_freq_buffer.get_realtime_candle(symbol, timeframe)
            
            if candle:
                return {
                    "success": True,
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "candle": {
                        'open_time': candle.open_time,
                        'close_time': candle.close_time,
                        'open_price': candle.open_price,
                        'high_price': candle.high_price,
                        'low_price': candle.low_price,
                        'close_price': candle.close_price,
                        'total_volume': candle.total_volume,
                        'total_volume_financial': candle.total_volume_financial,
                        'tick_count': candle.tick_count
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"No candle data available for {symbol} at {timeframe} timeframe"
                }
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ticks for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status")
async def get_system_status():
    """Retorna status completo do sistema."""
    try:
        buffer_status = high_freq_buffer.get_status() if high_freq_buffer else {}
        persistence_status = high_freq_persistence.get_status() if high_freq_persistence else {}
        
        return {
            "success": True,
            "timestamp": time.time(),
            "active_subscriptions_count": len(active_subscriptions),
            "buffer_status": buffer_status,
            "persistence_status": persistence_status,
            "system_uptime": time.time() - (buffer_status.get('start_time', time.time()))
        }
        
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_performance_metrics():
    """Retorna métricas de performance."""
    try:
        buffer_metrics = high_freq_buffer.get_metrics() if high_freq_buffer else {}
        persistence_metrics = high_freq_persistence.get_metrics() if high_freq_persistence else {}
        
        return {
            "success": True,
            "timestamp": time.time(),
            "buffer_metrics": buffer_metrics,
            "persistence_metrics": persistence_metrics,
            "subscription_stats": subscription_stats
        }
        
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint de teste
@app.get("/test")
async def test_endpoint():
    """Endpoint de teste para verificar se a API está funcionando."""
    return {
        "success": True,
        "message": "High Frequency Market Data API is running!",
        "timestamp": time.time(),
        "version": "1.0.0"
    }

if __name__ == "__main__":
    # Configuração do servidor
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8002"))
    
    logger.info(f"Starting server on {host}:{port}")
    
    # Inicia o servidor
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,  # Desabilita reload para produção
        log_level="info"
    )
