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
from fastapi.responses import JSONResponse
from fastapi.websockets import WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
import httpx
import json
import random

# Event Loop policy já deve ter sido configurada pelo start_uvicorn.py

# Alterado para imports absolutos para evitar problemas de PYTHONPATH
from services.high_frequency.models import (
    Tick,
    Subscription,
    SystemStatus,
    TickerMetrics,
    OrderBookEvent,
    OrderBookSnapshot,
    OrderBookLevel,
    OrderBookOffer,
)
from services.high_frequency.config import (
    HF_DISABLE_SIM, LOG_LEVEL, DATABASE_URL,
    FIREBASE_SERVICE_ACCOUNT_PATH,
)
from services.high_frequency.persistence import initialize_db, get_db_pool, persist_ticks, get_ticks_from_db
# Buffer e processamento
from services.high_frequency.buffer import (
    buffer_queue,
    subscriptions,
    tick_counters,
    start_buffer_processor,
    add_tick_to_buffer,
    start_order_book_event_processor,
    start_order_book_snapshot_processor,
    enqueue_order_book_event,
    enqueue_order_book_snapshot,
    start_order_book_offer_processor,
    enqueue_order_book_offer,
)
# Persistência
from services.high_frequency.persistence import (
    persist_order_book_event,
    persist_order_book_snapshot,
    persist_order_book_offer,
)
from services.high_frequency.candle_aggregator import candle_aggregator
from services.high_frequency.firestore_utils import init_firebase, load_subscriptions_from_firestore
from services.high_frequency.simulation import simulate_ticks
from services.high_frequency.robot_detector import TWAPDetector
from services.high_frequency.robot_persistence import RobotPersistence
from services.high_frequency.agent_mapping import get_agent_name
from services.high_frequency.logging_config import LOGGING_CONFIG
from services.shared import DEFAULT_MARKET_FEED_SYMBOLS

ENABLE_ORDER_BOOK_CAPTURE = os.getenv("HF_ENABLE_ORDER_BOOK_CAPTURE", "1").lower() in ("1", "true", "yes")

# Configuração de logging
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ✅ NOVO: Configuração robusta para desabilitar logs HTTP
def configure_logging():
    """Configura logging para desabilitar logs HTTP verbosos"""
    
    # Desabilita logs de acesso uvicorn em múltiplas camadas
    logging.getLogger("uvicorn.access").disabled = True
    logging.getLogger("uvicorn.access").propagate = False
    logging.getLogger("uvicorn.access").handlers = []
    
    # Desabilita logs de servidor uvicorn
    logging.getLogger("uvicorn.server").setLevel(logging.WARNING)
    
    # Desabilita logs de protocolo HTTP
    logging.getLogger("uvicorn.protocols.http").setLevel(logging.WARNING)
    
    # Desabilita logs de middleware
    logging.getLogger("uvicorn.middleware").setLevel(logging.WARNING)
    
    # Desabilita logs de aplicação FastAPI verbosos
    logging.getLogger("fastapi").setLevel(logging.WARNING)
    
    # ✅ TEMPORÁRIO: Configura logger principal para DEBUG para diagnosticar
    logging.getLogger().setLevel(logging.DEBUG)
    
    logger.info("🔇 Logging configurado: logs HTTP desabilitados, DEBUG habilitado para diagnóstico")

# Aplica configuração de logging
configure_logging()

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


class OrderBookEventIn(BaseModel):
    symbol: str
    timestamp: float
    action: int
    side: int
    position: Optional[int] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    offer_count: Optional[int] = None
    agent_id: Optional[int] = None
    sequence: Optional[int] = None
    raw_payload: Optional[Dict[str, Any]] = None


class OrderBookLevelIn(BaseModel):
    price: float
    quantity: int
    offer_count: Optional[int] = None
    agent_id: Optional[int] = None


class OrderBookSnapshotIn(BaseModel):
    symbol: str
    timestamp: float
    bids: List[OrderBookLevelIn]
    asks: List[OrderBookLevelIn]
    sequence: Optional[int] = None
    raw_event: Optional[Dict[str, Any]] = None


class OrderBookOfferIn(BaseModel):
    symbol: str
    timestamp: float
    action: int
    side: int
    position: Optional[int] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    agent_id: Optional[int] = None
    offer_id: Optional[int] = None
    flags: Optional[int] = None


class IngestBatch(BaseModel):
    ticks: List[IngestTick]

# Configuração global
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
HF_DISABLE_SIM = os.getenv("HF_DISABLE_SIM", "0").lower() in ("1", "true", "yes")

# Estado do sistema
system_initialized = False

# Estado global
active_subscriptions: Dict[str, Dict[str, Any]] = {}
subscription_stats: Dict[str, Dict[str, Any]] = {}
simulation_task: Optional[asyncio.Task] = None
simulation_enabled: bool = False
twap_detector: Optional[TWAPDetector] = None

# Variáveis globais
twap_config = None
twap_persistence = None

# Gerenciador de conexões WebSocket para notificações em tempo real
class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket conectado. Total de conexões: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket desconectado. Total de conexões: {len(self.active_connections)}")
    
    async def broadcast_status_change(self, status_change: dict):
        """Compatibilidade: envia mudança de status usando o formato antigo"""
        await self.broadcast_json({
            "type": "status_change",
            "data": status_change,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    async def broadcast_json(self, payload: dict):
        """Envia um payload JSON para todos os clientes conectados"""
        if not self.active_connections:
            return
        
        message = json.dumps(payload)
        
        # Envia para todas as conexões ativas
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Erro ao enviar para WebSocket: {e}")
                disconnected.append(connection)
        
        # Remove conexões com erro
        for connection in disconnected:
            self.disconnect(connection)

    async def send_replay(self, websocket: WebSocket, changes: List[Dict]):
        """Envia um replay inicial com mudanças recentes para um cliente"""
        if not changes:
            return
        try:
            await websocket.send_text(json.dumps({
                "type": "replay",
                "data": changes,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }))
        except Exception as e:
            logger.error(f"Erro ao enviar replay para WebSocket: {e}")

# Instância global do gerenciador WebSocket
websocket_manager = WebSocketManager()

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
    global twap_detector, twap_persistence, twap_config
    
    # ✅ NOVO: Inicializa a configuração TWAP
    from services.high_frequency.robot_models import TWAPDetectionConfig
    twap_config = TWAPDetectionConfig(
        min_trades=5,
        min_total_volume=1000,
        max_price_variation=0.05,
        min_frequency_minutes=0.001,
        max_frequency_minutes=10.0,
        min_confidence=0.3,
        active_recency_minutes=60.0
    )
    logger.info("✅ TWAPDetectionConfig inicializado com sucesso")
    
    # ✅ NOVO: Inicializa o persistence ANTES de criar o detector
    database_url = os.getenv('DATABASE_URL') or "postgres://postgres:postgres@localhost:5432/market_data"
    logger.info(f"🔗 Conectando ao banco: {database_url.split('@')[1] if '@' in database_url else 'URL oculta'}")
    
    twap_persistence = RobotPersistence(database_url=database_url)
    logger.info("✅ RobotPersistence inicializado com sucesso")
    
    twap_detector = TWAPDetector(
        config=twap_config, 
        persistence=twap_persistence
    )
    logger.info("✅ TWAPDetector inicializado com sucesso")
    
    # ✅ NOVO: Verifica se tudo foi inicializado corretamente
    logger.info(f"🔍 Verificação de inicialização:")
    logger.info(f"   - twap_config: {twap_config is not None}")
    logger.info(f"   - twap_persistence: {twap_persistence is not None}")
    logger.info(f"   - twap_detector: {twap_detector is not None}")
    logger.info(f"   - twap_detector.persistence: {twap_detector.persistence is not None}")
    
    # ✅ NOVO: Configura o callback WebSocket para notificações em tempo real
    async def notify_websocket_clients(change_type: str, payload: dict):
        """Callback para notificar clientes WebSocket sobre mudanças de status/tipo"""
        if change_type == 'status_change':
            logger.info(
                f"🔔 WebSocket: Mudança de status {payload['symbol']} - {payload['agent_id']} "
                f"({payload['old_status']} -> {payload['new_status']})"
            )
            message = {
                "type": "status_change",
                "data": payload,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            logger.info(
                f"🔄 WebSocket: Mudança de tipo {payload['symbol']} - {payload['agent_id']} "
                f"({payload['old_type']} -> {payload['new_type']})"
            )
            message = {
                "type": "type_change",
                "data": payload,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        await websocket_manager.broadcast_json(message)
    
    # Atualiza o status tracker com o callback WebSocket
    twap_detector.status_tracker.websocket_callback = notify_websocket_clients
    
    # PASSO 4: Inicializa sistemas de alta frequência antes de agendar as tasks
    try:
        init_high_frequency_systems()
    except Exception as e:
        logger.error(f"Falha crítica ao inicializar sistemas de alta frequência: {e}")
        return

    if ENABLE_ORDER_BOOK_CAPTURE:
        async def process_order_book_event_task(event):
            await persist_order_book_event(event, db_pool)

        async def process_order_book_snapshot_task(snapshot):
            await persist_order_book_snapshot(snapshot, db_pool)

        async def process_order_book_offer_task(offer):
            await persist_order_book_offer(offer, db_pool)

        asyncio.create_task(start_order_book_event_processor(process_order_book_event_task))
        asyncio.create_task(start_order_book_snapshot_processor(process_order_book_snapshot_task))
        asyncio.create_task(start_order_book_offer_processor(process_order_book_offer_task))

    asyncio.create_task(start_twap_detection())
    asyncio.create_task(start_inactivity_monitoring())
    asyncio.create_task(start_volume_percentage_monitoring())  # ✅ NOVA TASK

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
    global system_initialized

    # Aguarda até que o sistema esteja inicializado (startup garante que isso ocorrerá)
    while not system_initialized:
        logger.warning("Sistema ainda não inicializado para detecção TWAP. Aguardando...")
        await asyncio.sleep(1)

    logger.info("🚀 Iniciando detecção contínua de robôs TWAP...")
    
    while system_initialized:
        try:
            # ✅ DEBUG: Log para verificar se está rodando
            logger.info("🔍 Executando análise TWAP...")
            
            # Analisa todos os símbolos ativos
            patterns = await twap_detector.analyze_all_symbols()
            
            total_patterns = sum(len(patterns_list) for patterns_list in patterns.values())
            if total_patterns > 0:
                logger.info(f"✅ Detectados {total_patterns} padrões TWAP em {len(patterns)} símbolos")
            else:
                logger.info("📊 Nenhum padrão TWAP detectado nesta execução")
            
            # Limpa dados antigos a cada 24h
            await twap_detector.cleanup_old_data()
            
            # ✅ DEBUG: Log para verificar se está aguardando
            logger.info("⏳ Aguardando 1 minuto para próxima análise...")
            
            # Aguarda 1 minuto antes da próxima análise
            await asyncio.sleep(60)
            
        except Exception as e:
            logger.error(f"❌ Erro na detecção TWAP: {e}")
            await asyncio.sleep(60)  # Aguarda 1 minuto em caso de erro

async def start_inactivity_monitoring():
    """Inicia o monitoramento de inatividade dos robôs (a cada 5 segundos)"""
    global system_initialized
    
    while not system_initialized:
        logger.warning("Sistema ainda não inicializado para monitorar inatividade. Aguardando...")
        await asyncio.sleep(1)

    logger.info("🚀 Iniciando monitoramento de inatividade dos robôs...")
    
    while system_initialized:
        try:
            # ✅ DEBUG: Log para verificar se está rodando
            logger.info("🔍 Verificando inatividade dos robôs...")
            
            # Verifica inatividade baseado em trades reais (a cada 5 segundos)
            # Agora usa a nova coluna inactivity_notified para evitar notificações repetitivas
            inactive_robots = await twap_detector.check_robot_inactivity_by_trades(
                inactivity_threshold_minutes=15,  # ✅ REDUZIDO: De 60 para 15 minutos
                use_notification_control=True  # Novo parâmetro para usar controle de notificação
            )
            
            if inactive_robots:
                newly_notified = [r for r in inactive_robots if r.get('newly_notified', False)]
                if newly_notified:
                    logger.info(f"🔴 {len(newly_notified)} robôs PARARAM de operar (primeira notificação)")
                    for robot in newly_notified:
                        logger.info(f"   🚫 Robô {robot['agent_id']} ({get_agent_name(robot['agent_id'])}) em {robot['symbol']} - sem trades há {robot['inactivity_minutes']:.1f} minutos")
                else:
                    logger.debug(f"📊 {len(inactive_robots)} robôs inativos (já notificados anteriormente)")
            else:
                logger.info("✅ Todos os robôs estão ativos")
            
            # Limpa padrões inativos antigos (a cada 3 horas) - LIMPEZA COMPLETA NO BANCO E MEMÓRIA
            cleaned_patterns = await twap_detector.cleanup_inactive_patterns(max_inactive_hours=3)
            if cleaned_patterns > 0:
                logger.info(f"🗑️ LIMPEZA COMPLETA: {cleaned_patterns} padrões inativos antigos removidos (banco + memória)")
            else:
                logger.debug("✅ Nenhum padrão inativo antigo para remover")
            
            # ✅ DEBUG: Log para verificar se está aguardando
            logger.info("⏳ Aguardando 5 segundos para próxima verificação...")
            
            # Aguarda 5 segundos antes da próxima verificação
            await asyncio.sleep(5)
            
        except Exception as e:
            logger.error(f"❌ Erro no monitoramento de inatividade: {e}")
            await asyncio.sleep(60)  # Aguarda 1 minuto em caso de erro

async def start_volume_percentage_monitoring():
    """Monitora e atualiza volume % dos robôs ativos a cada 1 minuto"""
    global system_initialized
    
    while not system_initialized:
        logger.warning("Sistema ainda não inicializado para monitorar volume %. Aguardando...")
        await asyncio.sleep(1)

    logger.info("📊 Iniciando monitoramento de volume % dos robôs...")
    
    while system_initialized:
        try:
            logger.info("🔍 Recalculando volume % dos robôs ativos...")
            
            # Atualiza volume % de todos os robôs ativos
            type_changes = await twap_detector.update_active_robots_volume_percentage()
            
            if type_changes:
                logger.info(f"🔄 {len(type_changes)} mudanças de tipo detectadas")
                for change in type_changes:
                    logger.info(f"   📈 {change['symbol']} - {change['agent_name']} ({change['agent_id']}): {change['old_type']} -> {change['new_type']} ({change['old_volume_percentage']:.2f}% -> {change['new_volume_percentage']:.2f}%)")
            else:
                logger.debug("✅ Nenhuma mudança de tipo detectada")
            
            # Aguarda 1 minuto antes da próxima verificação
            await asyncio.sleep(60)
            
        except Exception as e:
            logger.error(f"❌ Erro no monitoramento de volume %: {e}")
            await asyncio.sleep(60)

# Endpoints da API
@app.post("/subscribe")
async def subscribe_symbol(request: SubscribeRequest):
    """Inscreve em um símbolo para receber ticks."""
    try:
        symbol = request.symbol.upper()
        exchange = request.exchange.upper()

        if ENABLE_ORDER_BOOK_CAPTURE:
            try:
                pass # No DLL integration
            except Exception as exc:
                logger.warning(f"Profit subscribe erro {symbol}: {exc}")

        active_subscriptions[symbol] = {
            'symbol': symbol,
            'exchange': exchange,
            'subscribed_at': time.time(),
            'status': 'active'
        }

        subscription_stats[symbol] = {
            'total_ticks': 0,
            'last_tick_time': 0,
            'last_price': 0,
            'last_volume': 0,
            'gaps_detected': 0,
            'start_time': time.time()
        }

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
            exchange = active_subscriptions[symbol]['exchange']
            del active_subscriptions[symbol]
            if symbol in subscription_stats:
                del subscription_stats[symbol]

            if ENABLE_ORDER_BOOK_CAPTURE:
                try:
                    pass # No DLL integration
                except Exception as exc:
                    logger.warning(f"Profit unsubscribe erro {symbol}: {exc}")

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


@app.post("/ingest/order-book-event")
async def ingest_order_book_event(event_in: OrderBookEventIn):
    if not ENABLE_ORDER_BOOK_CAPTURE:
        raise HTTPException(status_code=503, detail="order_book_capture_disabled")

    db_pool = await get_db_pool()
    if not db_pool:
        raise HTTPException(status_code=503, detail="database_unavailable")

    event = OrderBookEvent(
        symbol=event_in.symbol.upper(),
        timestamp=datetime.fromtimestamp(event_in.timestamp, tz=timezone.utc),
        action=event_in.action,
        side=event_in.side,
        position=event_in.position,
        price=event_in.price,
        quantity=event_in.quantity,
        offer_count=event_in.offer_count,
        agent_id=event_in.agent_id,
        sequence=event_in.sequence,
        raw_payload=event_in.raw_payload,
    )

    await persist_order_book_event(event, db_pool)
    return {"success": True}


@app.post("/ingest/order-book-snapshot")
async def ingest_order_book_snapshot(snapshot_in: OrderBookSnapshotIn):
    if not ENABLE_ORDER_BOOK_CAPTURE:
        raise HTTPException(status_code=503, detail="order_book_capture_disabled")

    db_pool = await get_db_pool()
    if not db_pool:
        raise HTTPException(status_code=503, detail="database_unavailable")

    bids = [
        OrderBookLevel(
            price=level.price,
            quantity=level.quantity,
            offer_count=level.offer_count or 0,
            agent_id=level.agent_id,
        )
        for level in snapshot_in.bids
    ]
    asks = [
        OrderBookLevel(
            price=level.price,
            quantity=level.quantity,
            offer_count=level.offer_count or 0,
            agent_id=level.agent_id,
        )
        for level in snapshot_in.asks
    ]

    snapshot = OrderBookSnapshot(
        symbol=snapshot_in.symbol.upper(),
        timestamp=datetime.fromtimestamp(snapshot_in.timestamp, tz=timezone.utc),
        bids=bids,
        asks=asks,
        sequence=snapshot_in.sequence,
        source_event=snapshot_in.raw_event,
    )

    await persist_order_book_snapshot(snapshot, db_pool)
    return {"success": True}


@app.post("/ingest/order-book-offer")
async def ingest_order_book_offer(offer_in: OrderBookOfferIn):
    if not ENABLE_ORDER_BOOK_CAPTURE:
        raise HTTPException(status_code=503, detail="order_book_capture_disabled")

    db_pool = await get_db_pool()
    if not db_pool:
        raise HTTPException(status_code=503, detail="database_unavailable")

    offer = OrderBookOffer(
        symbol=offer_in.symbol.upper(),
        timestamp=datetime.fromtimestamp(offer_in.timestamp, tz=timezone.utc),
        action=offer_in.action,
        side=offer_in.side,
        position=offer_in.position,
        price=offer_in.price,
        quantity=offer_in.quantity,
        agent_id=offer_in.agent_id,
        offer_id=offer_in.offer_id,
        flags=offer_in.flags,
    )

    await persist_order_book_offer(offer, db_pool)
    return {"success": True}

@app.get("/robots/patterns")
async def get_robot_patterns(symbol: Optional[str] = None, agent_id: Optional[int] = None, signature: Optional[str] = None):
    """Retorna padrões de robôs detectados"""
    try:
        logger.info("🔍 Endpoint /robots/patterns chamado")
        
        if not twap_detector:
            logger.error("❌ TWAP Detector não inicializado")
            raise HTTPException(status_code=503, detail="TWAP Detector não inicializado")
        
        logger.info("✅ TWAP Detector está inicializado")
        
        patterns = twap_detector.get_active_patterns()
        logger.info(f"📊 Padrões ativos em memória: {len(patterns)} símbolos")
        
        # ✅ NOVO: Debug para verificar o formato dos dados
        logger.info(f"🔍 Estrutura dos padrões: {list(patterns.keys())}")
        
        # Converte para lista plana
        all_patterns = []
        for sym, agents in patterns.items():
            if symbol and sym.upper() != symbol.upper():
                continue
            logger.info(f"🎯 Processando símbolo {sym} com {len(agents)} agentes")
            for agent, patterns_by_signature in agents.items():
                if agent_id is not None and agent != agent_id:
                    continue
                for signature_key, pattern in patterns_by_signature.items():
                    if signature and signature_key != signature:
                        continue
                    logger.info(f"🤖 Agente {agent} ({get_agent_name(agent)}) em {sym} assinatura {signature_key}")
                    all_patterns.append({
                        'id': f"{sym}_{agent}_{signature_key}",
                        'symbol': pattern.symbol,
                        'exchange': pattern.exchange,
                        'pattern_type': pattern.pattern_type,
                        'robot_type': pattern.robot_type,
                        'confidence_score': pattern.confidence_score,
                        'agent_id': pattern.agent_id,
                        'signature_key': signature_key,
                        'signature_volume': pattern.signature_volume,
                        'signature_direction': pattern.signature_direction,
                        'signature_interval_seconds': pattern.signature_interval_seconds,
                        'pattern_id': pattern.pattern_id,
                        'first_seen': pattern.first_seen.isoformat(),
                        'last_seen': pattern.last_seen.isoformat(),
                        'total_volume': pattern.total_volume,
                        'total_trades': pattern.total_trades,
                        'avg_trade_size': pattern.avg_trade_size,
                        'frequency_minutes': pattern.frequency_minutes,
                        'price_aggression': pattern.price_aggression,
                        'status': pattern.status.value,
                        'market_volume_percentage': pattern.market_volume_percentage
                    })
        
        logger.info(f"🎉 Convertidos {len(all_patterns)} padrões para formato JSON")
        return all_patterns
        
    except Exception as e:
        logger.error(f"💥 Erro ao buscar padrões de robôs: {e}")
        logger.error(f"📋 Traceback completo:", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/robots/activity")
async def get_robot_activity(symbol: Optional[str] = None, hours: int = 24):
    """Retorna atividade recente de robôs"""
    try:
        logger.info(f"🔍 Endpoint /robots/activity chamado - symbol: {symbol}, hours: {hours}")
        
        if not twap_detector:
            logger.error("❌ TWAP Detector não inicializado")
            raise HTTPException(status_code=503, detail="TWAP Detector não inicializado")
        
        logger.info("✅ TWAP Detector está inicializado")
        
        # Busca trades recentes das tabelas
        if symbol:
            symbols = [symbol.upper()]
            logger.info(f"🎯 Buscando atividade para símbolo específico: {symbols}")
        else:
            # Busca símbolos ativos
            logger.info("🌐 Buscando símbolos ativos...")
            symbols = await twap_detector.persistence.get_active_symbols()
            logger.info(f"📊 Símbolos ativos encontrados: {len(symbols)} - {symbols[:5]}...")
        
        all_trades = []
        for sym in symbols:
            try:
                logger.info(f"🔍 Buscando trades para {sym} nas últimas {hours}h...")
                trades_data = await twap_detector.persistence.get_recent_ticks(sym, hours)
                logger.info(f"📈 Trades encontrados para {sym}: {len(trades_data)}")
                
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
            except Exception as e:
                logger.warning(f"⚠️ Erro ao buscar trades para {sym}: {e}")
                continue
        
        # Ordena por timestamp (mais recente primeiro)
        all_trades.sort(key=lambda x: x['timestamp'], reverse=True)
        
        logger.info(f"🎉 Retornando {len(all_trades)} trades de atividade de robôs")
        return all_trades
        
    except Exception as e:
        logger.error(f"💥 Erro ao buscar atividade de robôs: {e}")
        logger.error(f"📋 Traceback completo:", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/robots/status-changes")
async def get_robot_status_changes(symbol: Optional[str] = None, hours: int = 24, signature: Optional[str] = None, agent_id: Optional[int] = None):
    """Retorna mudanças de status dos robôs (start/stop) - limitado aos 50 mais recentes"""
    try:
        if not twap_detector:
            raise HTTPException(status_code=503, detail="TWAP Detector não inicializado")
        
        # Busca mudanças de status do detector
        status_changes = twap_detector.get_status_changes(symbol, hours, signature)

        if agent_id is not None:
            status_changes = [change for change in status_changes if change.get('agent_id') == agent_id]
        
        # ✅ Limita aos 50 mais recentes
        limited = status_changes[:50]
        
        logger.info(f"Retornando {len(limited)} mudanças de status de robôs (de {len(status_changes)} no total)")
        return limited
        
    except Exception as e:
        logger.error(f"Erro ao buscar mudanças de status de robôs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/robots/all-changes")
async def get_all_robot_changes(symbol: Optional[str] = None, hours: int = 24, signature: Optional[str] = None, agent_id: Optional[int] = None):
    """Retorna todas as mudanças (status + tipo) dos robôs"""
    try:
        if not twap_detector:
            raise HTTPException(status_code=503, detail="TWAP Detector não inicializado")
        
        # Busca todas as mudanças (status + tipo)
        all_changes = twap_detector.get_all_changes(symbol, hours, signature)

        if agent_id is not None:
            all_changes = [change for change in all_changes if change.get('agent_id') == agent_id]
        
        logger.info(f"Retornando {len(all_changes)} mudanças totais (status + tipo)")
        return all_changes
        
    except Exception as e:
        logger.error(f"Erro ao buscar mudanças dos robôs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/robots/{symbol}/{agent_id}/trades")
async def get_robot_trades(symbol: str, agent_id: int, hours: int = 24, limit: int = 200, pattern_type: Optional[str] = None):
    """Retorna operações de um robô específico.
    Se pattern_type for informado (ex.: 'MARKET_TWAP'), retorna apenas operações
    associadas a padrões desse tipo.
    """
    try:
        if not twap_detector:
            raise HTTPException(status_code=503, detail="TWAP Detector não inicializado")

        # Busca trades do robô específico (com filtro opcional por tipo do padrão)
        # Permite filtrar por MARKET_TWAP e também por TWAP para compatibilidade
        pt = pattern_type
        trades = await twap_detector.persistence.get_robot_trades(
            symbol, agent_id, hours, limit, pattern_type=pt
        )

        logger.info(f"Retornando {len(trades)} trades para robô {agent_id} em {symbol}")
        return trades

    except Exception as e:
        logger.error(f"Erro ao buscar trades do robô {agent_id} em {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/robot-status")
async def websocket_endpoint(websocket: WebSocket):
    """Endpoint WebSocket para notificações em tempo real de mudanças de status dos robôs"""
    await websocket_manager.connect(websocket)
    try:
        # Envia replay inicial das últimas mudanças (status + tipo)
        try:
            recent_changes = twap_detector.status_tracker.get_all_changes(hours=1)[:50] if twap_detector else []
            await websocket_manager.send_replay(websocket, recent_changes)
        except Exception as e:
            logger.error(f"Erro ao enviar replay inicial via WebSocket: {e}")

        # Mantém a conexão ativa e aguarda mensagens
        while True:
            # Aguarda mensagem do cliente (ping/pong para manter conexão)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Erro no WebSocket: {e}")
        websocket_manager.disconnect(websocket)

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
        
        # Processa tick para agregação em candles (sem log)
        try:
            await candle_aggregator.process_tick(tick_obj)
        except Exception as e:
            # Log apenas erros críticos
            if random.random() < 0.01:  # Log apenas 1% dos erros
                logger.warning(f"Erro ao processar tick para candles: {e}")
        
        return {"success": True}
    except Exception as e:
        # ✅ NOVO: Log reduzido para não poluir
        if random.random() < 0.001:  # Log apenas 0.1% dos erros
            logger.error(f"Erro ingest_tick: {e}")
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

@app.post("/ingest/order-book-event")
async def ingest_order_book_event(event_in: OrderBookEventIn):
    if not ENABLE_ORDER_BOOK_CAPTURE:
        raise HTTPException(status_code=503, detail="order_book_capture_disabled")

    db_pool = await get_db_pool()
    if not db_pool:
        raise HTTPException(status_code=503, detail="database_unavailable")

    event = OrderBookEvent(
        symbol=event_in.symbol.upper(),
        timestamp=datetime.fromtimestamp(event_in.timestamp, tz=timezone.utc),
        action=event_in.action,
        side=event_in.side,
        position=event_in.position,
        price=event_in.price,
        quantity=event_in.quantity,
        offer_count=event_in.offer_count,
        agent_id=event_in.agent_id,
        sequence=event_in.sequence,
        raw_payload=event_in.raw_payload,
    )

    await persist_order_book_event(event, db_pool)
    return {"success": True}


@app.post("/ingest/order-book-snapshot")
async def ingest_order_book_snapshot(snapshot_in: OrderBookSnapshotIn):
    if not ENABLE_ORDER_BOOK_CAPTURE:
        raise HTTPException(status_code=503, detail="order_book_capture_disabled")

    db_pool = await get_db_pool()
    if not db_pool:
        raise HTTPException(status_code=503, detail="database_unavailable")

    bids = [
        OrderBookLevel(
            price=level.price,
            quantity=level.quantity,
            offer_count=level.offer_count or 0,
            agent_id=level.agent_id,
        )
        for level in snapshot_in.bids
    ]
    asks = [
        OrderBookLevel(
            price=level.price,
            quantity=level.quantity,
            offer_count=level.offer_count or 0,
            agent_id=level.agent_id,
        )
        for level in snapshot_in.asks
    ]

    snapshot = OrderBookSnapshot(
        symbol=snapshot_in.symbol.upper(),
        timestamp=datetime.fromtimestamp(snapshot_in.timestamp, tz=timezone.utc),
        bids=bids,
        asks=asks,
        sequence=snapshot_in.sequence,
        source_event=snapshot_in.raw_event,
    )

    await persist_order_book_snapshot(snapshot, db_pool)
    return {"success": True}

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
        logger.error(f"Erro ao buscar ticks para {symbol}: {e}")
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

## AI Lab (removido) – endpoints migrados para services/ml_lab

@app.get("/shared/default-symbols")
async def api_shared_default_symbols():
    return {"symbols": DEFAULT_MARKET_FEED_SYMBOLS}

if __name__ == "__main__":
    # Configuração do servidor
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8002"))
    
    logger.info(f"Starting server on {host}:{port}")
    
    # ✅ NOVO: Configuração de logging já aplicada acima
    # A função configure_logging() já foi chamada para desabilitar logs HTTP
    
    logger.info("🚀 Iniciando servidor com logs HTTP desabilitados...")
    
    # Inicia o servidor
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,  # Desabilita reload para produção
        log_level="info",  # Mantém info mas sem access logs
        access_log=False,  # Desabilita logs de acesso HTTP
        log_config=LOGGING_CONFIG  # ✅ NOVO: Usa configuração personalizada
    )
