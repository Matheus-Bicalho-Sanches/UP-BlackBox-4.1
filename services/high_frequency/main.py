"""
High Frequency Market Data Backend
==================================
Backend otimizado para 70-150 ativos com 50K+ ticks/segundo.
Sistema independente com zero perdas e agregação em tempo real.
"""

import os
import sys
from pathlib import Path

# Ensure project root is on sys.path so that 'services.*' absolute imports work
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_PROJECT_ROOT_STR = str(_PROJECT_ROOT)
if _PROJECT_ROOT_STR not in sys.path:
	sys.path.insert(0, _PROJECT_ROOT_STR)

# Carrega variáveis do .env (procura em vários locais)
from dotenv import load_dotenv
# Tenta carregar .env da raiz do projeto
load_dotenv()
# Carrega .env.local onde estão as variáveis do Firebase Admin
env_local = _PROJECT_ROOT / ".env.local"
if env_local.exists():
    load_dotenv(env_local)
# Também tenta carregar da pasta Dll_Profit onde estão as configurações da DLL
dll_profit_env = _PROJECT_ROOT / "Dll_Profit" / ".env"
if dll_profit_env.exists():
    load_dotenv(dll_profit_env)

# Now we can safely do the other imports
import asyncio
import logging
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

# Event Loop policy já deve ter sido configurada pelo start_uvicorn.py

# Alterado para imports absolutos para evitar problemas de PYTHONPATH
from services.high_frequency.models import Tick, Subscription, SystemStatus, TickerMetrics
from services.high_frequency.config import (
    HF_DISABLE_SIM, PROFIT_FEED_URL, LOG_LEVEL, DATABASE_URL,
    FIREBASE_SERVICE_ACCOUNT_PATH
)
from services.high_frequency.persistence import initialize_db, get_db_pool, persist_ticks, get_ticks_from_db
from services.high_frequency.buffer import buffer_queue, subscriptions, tick_counters, start_buffer_processor, add_tick_to_buffer
from services.high_frequency.candle_aggregator import candle_aggregator
from services.high_frequency.firestore_utils import init_firebase, load_subscriptions_from_firestore
from services.high_frequency.simulation import simulate_ticks
from services.high_frequency.robot_detector import TWAPDetector

# Configuração de logging
logging.basicConfig(
    level=LOG_LEVEL,
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
    # Campos para dados detalhados de trade
    buy_agent: Optional[int] = None
    sell_agent: Optional[int] = None
    trade_type: Optional[int] = None  # 2=Comprador, 3=Vendedor
    volume_financial: Optional[float] = None
    is_edit: bool = False

class IngestBatch(BaseModel):
    ticks: List[IngestTick]

# Configuração global
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
PROFIT_FEED_URL = os.getenv("PROFIT_FEED_URL", "http://localhost:8001")
HF_DISABLE_SIM = os.getenv("HF_DISABLE_SIM", "0").lower() in ("1", "true", "yes")

# Estado do sistema
system_initialized = False

# Estado global
active_subscriptions: Dict[str, Dict[str, Any]] = {}
subscription_stats: Dict[str, Dict[str, Any]] = {}
simulation_task: Optional[asyncio.Task] = None
simulation_enabled: bool = False
twap_detector: Optional[TWAPDetector] = None

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

# Função simplificada de inicialização
def init_high_frequency_systems():
    """Inicializa os sistemas de alta frequência."""
    global system_initialized
    
    try:
        system_initialized = True
        logger.info("High frequency systems initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize high frequency systems: {e}")
        raise

# Callbacks simplificados do sistema
def update_tick_stats(tick: Tick):
    """Atualiza estatísticas de tick."""
    try:
        symbol = tick.symbol
        if symbol in subscription_stats:
            stats = subscription_stats[symbol]
            stats['last_tick_time'] = time.time()
            stats['total_ticks'] = stats.get('total_ticks', 0) + 1
            stats['last_price'] = tick.price
            stats['last_volume'] = tick.volume
            
    except Exception as e:
        logger.error(f"Error updating tick stats: {e}")

# Eventos de startup/shutdown
@app.on_event("startup")
async def startup_event():
    """Inicializa todos os sistemas do backend na ordem correta."""
    logger.info("Iniciando o High Frequency Market Data Backend...")
    
    # PASSO 1: Inicializa o pool de conexões com o DB
    db_pool = await get_db_pool(retries=5, delay=2)
    if not db_pool:
        logger.error("Falha crítica: não foi possível conectar ao banco de dados após várias tentativas. Encerrando.")
        return

    # PASSO 2: Garante que o esquema do DB (tabelas) esteja criado ANTES de tudo
    try:
        await initialize_db(db_pool)
    except Exception as e:
        logger.error(f"Falha crítica ao inicializar o esquema do banco de dados: {e}. Encerrando.")
        return

    # PASSO 3: Agora sim, inicia os processos de buffer e persistência
    logger.info("Iniciando o processamento de buffer e a persistência de dados...")
    asyncio.create_task(start_buffer_processor(db_pool))
    
    # PASSO 3.1: Inicia o agrupador de candles
    logger.info("Iniciando o agrupador automático de candles...")
    candle_aggregator.start()
    
    # PASSO 3.2: Inicia o detector de robôs TWAP
    logger.info("Iniciando o detector de robôs TWAP...")
    global twap_detector
    twap_detector = TWAPDetector()
    asyncio.create_task(start_twap_detection())
    
    # PASSO 4: Inicializa sistemas de alta frequência
    try:
        init_high_frequency_systems()
    except Exception as e:
        logger.error(f"Falha crítica ao inicializar sistemas de alta frequência: {e}")
        return

    # PASSO 5: Auto-subscribe de tickers do Firestore
    try:
        init_firebase()
        asyncio.create_task(load_subscriptions_from_firestore())
    except Exception as e:
        logger.warning(f"Erro ao inicializar Firestore (não crítico): {e}")

    logger.info("Sistemas de alta frequência inicializados com sucesso.")
    logger.info("Backend iniciado com sucesso - pronto para receber conexões!")

@app.on_event("shutdown")
async def shutdown_event():
    """Evento executado no desligamento."""
    logger.info("Shutting down High Frequency Market Data Backend...")
    
    try:
        global system_initialized
        system_initialized = False
        
        # Para o agrupador de candles
        candle_aggregator.stop()
        
        logger.info("Backend shutdown completed")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

async def start_twap_detection():
    """Inicia a detecção contínua de robôs TWAP"""
    global twap_detector
    
    if not twap_detector:
        logger.error("TWAP Detector não inicializado")
        return
    
    logger.info("Iniciando detecção contínua de robôs TWAP...")
    
    while system_initialized:
        try:
            # Analisa todos os símbolos ativos
            patterns = await twap_detector.analyze_all_symbols()
            
            total_patterns = sum(len(patterns_list) for patterns_list in patterns.values())
            if total_patterns > 0:
                logger.info(f"Detectados {total_patterns} padrões TWAP em {len(patterns)} símbolos")
            
            # Limpa dados antigos a cada 24h
            await twap_detector.cleanup_old_data()
            
            # Aguarda 5 minutos antes da próxima análise
            await asyncio.sleep(300)
            
        except Exception as e:
            logger.error(f"Erro na detecção TWAP: {e}")
            await asyncio.sleep(60)  # Aguarda 1 minuto em caso de erro

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

@app.get("/robots/patterns")
async def get_robot_patterns(symbol: Optional[str] = None):
    """Retorna padrões de robôs detectados"""
    try:
        if not system_initialized or not twap_detector:
            raise HTTPException(status_code=503, detail="system_not_initialized")
        
        if symbol:
            # Busca padrões para um símbolo específico
            patterns = await twap_detector.analyze_symbol(symbol.upper())
        else:
            # Busca todos os padrões ativos
            all_patterns = await twap_detector.analyze_all_symbols()
            patterns = []
            for symbol_patterns in all_patterns.values():
                patterns.extend(symbol_patterns)
        
        # Converte para formato JSON
        patterns_data = []
        for pattern in patterns:
            patterns_data.append({
                "id": getattr(pattern, 'id', None),
                "symbol": pattern.symbol,
                "exchange": pattern.exchange,
                "pattern_type": "TWAP",
                "confidence_score": pattern.confidence_score,
                "agent_id": pattern.agent_id,
                "first_seen": pattern.first_seen.isoformat(),
                "last_seen": pattern.last_seen.isoformat(),
                "total_volume": pattern.total_volume,
                "total_trades": pattern.total_trades,
                "avg_trade_size": pattern.avg_trade_size,
                "frequency_minutes": pattern.frequency_minutes,
                "price_aggression": pattern.price_aggression,
                "status": pattern.status.value
            })
        
        return {
            "success": True,
            "patterns": patterns_data,
            "count": len(patterns_data)
        }
        
    except Exception as e:
        logger.error(f"Error getting robot patterns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/robots/activity")
async def get_robot_activity(symbol: Optional[str] = None, hours: int = 24):
    """Retorna atividade recente de robôs"""
    try:
        if not system_initialized or not twap_detector:
            raise HTTPException(status_code=503, detail="system_not_initialized")
        
        # Busca trades recentes das tabelas
        from services.high_frequency.robot_persistence import RobotPersistence
        persistence = RobotPersistence()
        
        if symbol:
            symbols = [symbol.upper()]
        else:
            # Busca símbolos ativos
            symbols = await twap_detector.persistence.get_active_symbols()
        
        all_trades = []
        for sym in symbols:
            trades_data = await persistence.get_recent_ticks(sym, hours)
            for trade in trades_data:
                all_trades.append({
                    "symbol": trade['symbol'],
                    "price": trade['price'],
                    "volume": trade['volume'],
                    "timestamp": trade['timestamp'].isoformat(),
                    "buy_agent": trade['buy_agent'],
                    "sell_agent": trade['sell_agent'],
                    "exchange": trade['exchange']
                })
        
        # Ordena por timestamp (mais recente primeiro)
        all_trades.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return {
            "success": True,
            "trades": all_trades,
            "count": len(all_trades)
        }
        
    except Exception as e:
        logger.error(f"Error getting robot activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unsubscribing from {request.symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/tick")
async def ingest_tick(tick: IngestTick):
    """Ingestão de 1 tick (via ProfitDLL)."""
    try:
        if not system_initialized:
            raise HTTPException(status_code=503, detail="system_not_initialized")
        
        ts = tick.timestamp or time.time()
        tick_obj = Tick(
            symbol=tick.symbol.upper(),
            exchange=tick.exchange.upper(),
            price=tick.price,
            volume=tick.volume,
            timestamp=ts,
            trade_id=tick.trade_id,
            buy_agent=tick.buy_agent,
            sell_agent=tick.sell_agent,
            trade_type=tick.trade_type,
            volume_financial=tick.volume_financial,
            is_edit=tick.is_edit
        )
        
        # Adiciona ao buffer
        add_tick_to_buffer(tick_obj)
        update_tick_stats(tick_obj)
        
        # Processa tick para agregação em candles
        await candle_aggregator.process_tick(tick_obj)
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error ingest_tick: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/batch")
async def ingest_batch(batch: IngestBatch):
    """Ingestão em lote de ticks (melhor para performance)."""
    try:
        if not system_initialized:
            raise HTTPException(status_code=503, detail="system_not_initialized")
        
        for t in batch.ticks:
            ts = t.timestamp or time.time()
            tick_obj = Tick(
                symbol=t.symbol.upper(),
                exchange=t.exchange.upper(),
                price=t.price,
                volume=t.volume,
                timestamp=ts,
                trade_id=t.trade_id,
                buy_agent=t.buy_agent,
                sell_agent=t.sell_agent,
                trade_type=t.trade_type,
                volume_financial=t.volume_financial,
                is_edit=t.is_edit
            )
            
            # Adiciona ao buffer
            add_tick_to_buffer(tick_obj)
            update_tick_stats(tick_obj)
            
            # Processa tick para agregação em candles
            await candle_aggregator.process_tick(tick_obj)
        
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
        if not system_initialized:
            raise HTTPException(status_code=503, detail="system_not_initialized")
        
        symbol = symbol.upper()
        
        # Obtém pool de DB e busca ticks diretamente
        db_pool = await get_db_pool()
        if not db_pool:
            raise HTTPException(status_code=503, detail="database_unavailable")
        
        ticks_data = await get_ticks_from_db(symbol, timeframe, limit, db_pool)
        
        return {
            "success": True,
            "symbol": symbol,
            "timeframe": timeframe,
            "ticks": ticks_data,
            "count": len(ticks_data)
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
        from services.high_frequency.buffer import get_buffer_status
        
        buffer_status = get_buffer_status()
        
        return {
            "success": True,
            "timestamp": time.time(),
            "system_initialized": system_initialized,
            "active_subscriptions_count": len(active_subscriptions),
            "buffer_status": buffer_status,
            "subscription_stats": subscription_stats
        }
        
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_performance_metrics():
    """Retorna métricas de performance."""
    try:
        from services.high_frequency.buffer import get_buffer_status
        
        buffer_status = get_buffer_status()
        
        candle_aggregator_status = candle_aggregator.get_status()
        
        # Status do detector TWAP
        twap_detector_status = {
            "active": twap_detector is not None,
            "active_patterns_count": len(twap_detector.get_active_patterns()) if twap_detector else 0
        }
        
        return {
            "success": True,
            "timestamp": time.time(),
            "buffer_status": buffer_status,
            "candle_aggregator_status": candle_aggregator_status,
            "twap_detector_status": twap_detector_status,
            "subscription_stats": subscription_stats,
            "system_initialized": system_initialized
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
