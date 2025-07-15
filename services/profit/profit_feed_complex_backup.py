"""
Profit Feed Service – Fixed Version
===================================
Solução que separa completamente o recebimento de ticks do salvamento no Firebase.
Evita bloqueios do event loop e garante fluxo contínuo de dados.
"""

import asyncio
import ctypes
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
import logging
import threading
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor

import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# ----------------------------------------------------------------------------
# Firebase Init
# ----------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[2]  # raiz do repo

if not firebase_admin._apps:
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        default_cred = BASE_DIR / "UP BlackBox 4.0" / "secrets" / "up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json"
        if default_cred.exists():
            cred_path = str(default_cred)
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path
    if not cred_path:
        raise RuntimeError("Defina GOOGLE_APPLICATION_CREDENTIALS com o caminho para o json de serviço ou coloque-o em UP BlackBox 4.0/secrets")
    firebase_admin.initialize_app(credentials.Certificate(cred_path))

db = firestore.client()

# ----------------------------------------------------------------------------
# Carrega .env (credenciais Profit) antes de inicializar a DLL
# ----------------------------------------------------------------------------

ENV_PATH = BASE_DIR / "Dll_Profit" / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=str(ENV_PATH))

ACTIVATION_KEY = os.getenv("ACTIVATION_CODE", "")
LOGIN_USER = os.getenv("login", "")
LOGIN_PASS = os.getenv("password", "")

# ----------------------------------------------------------------------------
# DLL loading – ajuste o path se necessário
# ----------------------------------------------------------------------------

dll_path = Path(__file__).with_name("ProfitDLL64.dll")
if not dll_path.exists():
    # tentar caminhos padrão do repositório
    candidate1 = BASE_DIR / "Dll_Profit" / "bin" / "Win64" / "Example" / "ProfitDLL64.dll"
    candidate2 = BASE_DIR / "Dll_Profit" / "DLLs" / "Win64" / "ProfitDLL.dll"
    for cand in (candidate1, candidate2):
        if cand.exists():
            dll_path = cand
            break
if not dll_path.exists():
    raise RuntimeError(f"DLL não encontrada. Copie ProfitDLL64.dll para {dll_path.parent} ou coloque em Dll_Profit/bin/Win64/Example/.")

dll = ctypes.WinDLL(str(dll_path))

# Só para compilar – defina protótipos reais conforme documentação
SubscribeTicker = dll.SubscribeTicker
SubscribeTicker.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
SubscribeTicker.restype = ctypes.c_int

# ----------------------------------------------------------------------------
# Login + callbacks
# ----------------------------------------------------------------------------

# Estrutura simplificada do AssetID (ticker/bolsa)
class TAssetID(ctypes.Structure):
    _fields_ = [
        ("ticker", ctypes.c_wchar_p),
        ("exchange", ctypes.c_wchar_p),
        ("feed", ctypes.c_int),
    ]

# callback prototypes
StateCallbackType = ctypes.CFUNCTYPE(None, ctypes.c_int, ctypes.c_int)
TradeCallbackType = ctypes.CFUNCTYPE(
    None,
    TAssetID,
    ctypes.c_wchar_p,  # date
    ctypes.c_uint,  # tradeNumber
    ctypes.c_double,  # price
    ctypes.c_double,  # vol
    ctypes.c_int,  # qtd
    ctypes.c_int,  # buyAgent
    ctypes.c_int,  # sellAgent
    ctypes.c_int,  # tradeType
    ctypes.c_int,  # bIsEdit
)


@StateCallbackType
def _state_cb(state_type: int, result: int):
    logging.info("DLL State change: %s %s", state_type, result)


@TradeCallbackType
def _trade_cb(asset: TAssetID, date: str, trade_number: int, price: float, vol: float, qtd: int, *_):
    ticker = asset.ticker if asset and asset.ticker else "UNKNOWN"
    # CRÍTICO: Esta função deve ser SUPER rápida para não bloquear a DLL
    new_tick(ticker, price, qtd)


# Define DLLInitializeMarketLogin
if hasattr(dll, "DLLInitializeMarketLogin"):
    DLLInitializeMarketLogin = dll.DLLInitializeMarketLogin
    DLLInitializeMarketLogin.argtypes = [
        ctypes.c_wchar_p,
        ctypes.c_wchar_p,
        ctypes.c_wchar_p,
        StateCallbackType,
        TradeCallbackType,
        ctypes.c_void_p,  # newDailyCallback
        ctypes.c_void_p,  # priceBookCallback
        ctypes.c_void_p,  # offerBookCallback
        ctypes.c_void_p,  # historyTradeCallback
        ctypes.c_void_p,  # progress
        ctypes.c_void_p,  # tinyBook
    ]
    DLLInitializeMarketLogin.restype = ctypes.c_int

    ret = DLLInitializeMarketLogin(
        ACTIVATION_KEY,
        LOGIN_USER,
        LOGIN_PASS,
        _state_cb,
        _trade_cb,
        None,
        None,
        None,
        None,
        None,
        None,
    )
    logging.info("DLLInitializeMarketLogin -> %s", ret)
else:
    logging.warning("DLLInitializeMarketLogin not found in DLL, feed will not work")

# ----------------------------------------------------------------------------
# NOVA ARQUITETURA: Separação completa de recebimento e processamento
# ----------------------------------------------------------------------------

# Buffer thread-safe para ticks recebidos
tick_buffer = defaultdict(deque)
tick_buffer_lock = threading.Lock()

# Estado em memória do candle em formação (thread-safe)
current_candles = {}
current_candles_lock = threading.Lock()

# Queue assíncrona para processamento de candles
candle_save_queue = asyncio.Queue(maxsize=1000)

# Thread executor para operações Firebase
firebase_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="firebase_")

def new_tick(ticker: str, price: float, volume: int):
    """
    CRÍTICO: Esta função deve ser EXTREMAMENTE rápida!
    Apenas adiciona o tick ao buffer sem nenhuma operação bloqueante.
    """
    timestamp = datetime.now(timezone.utc).timestamp()
    
    # Operação atômica super rápida - apenas adiciona ao buffer
    with tick_buffer_lock:
        tick_buffer[ticker].append((price, timestamp, volume))
        # Limita o buffer para evitar uso excessivo de memória
        if len(tick_buffer[ticker]) > 10000:
            tick_buffer[ticker].popleft()
    
    # Atualiza candle em memória de forma thread-safe
    update_current_candle(ticker, price, volume, timestamp)

def update_current_candle(ticker: str, price: float, volume: int, timestamp: float):
    """Atualiza o candle atual em memória de forma thread-safe"""
    now = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    minute_ts = now.replace(second=0, microsecond=0)
    ts_ms = int(minute_ts.timestamp() * 1000)
    
    with current_candles_lock:
        candle = current_candles.get(ticker)
        if candle is None or candle["t"] != ts_ms:
            candle = {
                "t": ts_ms,
                "o": price,
                "h": price,
                "l": price,
                "c": price,
                "v": volume,
                "vf": price * volume,
            }
            current_candles[ticker] = candle
        else:
            candle["h"] = max(candle["h"], price)
            candle["l"] = min(candle["l"], price)
            candle["c"] = price
            candle["v"] += volume
            candle["vf"] += price * volume

async def tick_processor():
    """
    Processa ticks do buffer e gera candles fechados.
    Roda em background sem bloquear o recebimento de ticks.
    """
    while True:
        try:
            await asyncio.sleep(1)  # Processa a cada segundo
            
            # Copia e limpa buffers de forma thread-safe
            tickers_to_process = []
            with tick_buffer_lock:
                for ticker in list(tick_buffer.keys()):
                    if tick_buffer[ticker]:
                        # Copia todos os ticks e limpa o buffer
                        ticks = list(tick_buffer[ticker])
                        tick_buffer[ticker].clear()
                        tickers_to_process.append((ticker, ticks))
            
            # Processa cada ticker
            for ticker, ticks in tickers_to_process:
                await process_ticker_ticks(ticker, ticks)
                
        except Exception as e:
            logging.error(f"Erro no tick_processor: {e}")

async def process_ticker_ticks(ticker: str, ticks: list):
    """Processa ticks de um ticker específico e gera candles se necessário"""
    if not ticks:
        return
    
    now = datetime.now(timezone.utc)
    current_minute = now.replace(second=0, microsecond=0)
    
    # Agrupa ticks por minuto
    minute_groups = defaultdict(list)
    for price, timestamp, volume in ticks:
        tick_time = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        tick_minute = tick_time.replace(second=0, microsecond=0)
        minute_groups[tick_minute].append((price, volume))
    
    # Processa minutos completos (não o minuto atual)
    for minute, minute_ticks in minute_groups.items():
        if minute < current_minute:  # Só processa minutos já fechados
            await create_completed_candle(ticker, minute, minute_ticks)

async def create_completed_candle(ticker: str, minute: datetime, ticks: list):
    """Cria candle completo e envia para fila de salvamento"""
    if not ticks:
        return
    
    prices = [t[0] for t in ticks]
    volumes = [t[1] for t in ticks]
    
    candle = {
        "t": int(minute.timestamp() * 1000),
        "o": prices[0],
        "h": max(prices),
        "l": min(prices),
        "c": prices[-1],
        "v": sum(volumes),
        "vf": sum(p * v for p, v in ticks),
    }
    
    # Envia para fila de salvamento (não bloqueia) - CORRIGIDO
    try:
        await asyncio.wait_for(candle_save_queue.put((ticker, candle)), timeout=0.1)
        logging.info(f"Candle criado para {ticker}: {minute.strftime('%H:%M')} | V={candle['v']}")
    except asyncio.TimeoutError:
        logging.warning(f"Fila de salvamento cheia - candle {ticker} descartado")

def save_candle_to_firebase_sync(ticker: str, candle: dict):
    """Função síncrona para salvar no Firebase (roda em thread separada)"""
    try:
        ts_str = str(candle["t"])
        
        # Salva histórico
        db.collection("marketDataDLL").document(ticker).collection("candles_1m").document(ts_str).set(candle)
        
        # Atualiza corrente
        db.collection("marketDataDLL").document(ticker).collection("current").document("1m").set(candle)
        
        logging.info(f"Candle salvo no Firebase: {ticker} | {ts_str}")
        
    except Exception as e:
        logging.error(f"Erro ao salvar candle {ticker} no Firebase: {e}")

async def firebase_saver():
    """
    Consome fila de candles e salva no Firebase usando thread pool.
    Evita bloquear o event loop principal.
    """
    loop = asyncio.get_event_loop()
    
    while True:
        try:
            # Pega candle da fila (bloqueia até ter um disponível)
            ticker, candle = await candle_save_queue.get()
            
            # Executa salvamento em thread separada (não bloqueia event loop)
            await loop.run_in_executor(
                firebase_executor, 
                save_candle_to_firebase_sync, 
                ticker, 
                candle
            )
            
            # Marca tarefa como concluída
            candle_save_queue.task_done()
            
        except Exception as e:
            logging.error(f"Erro no firebase_saver: {e}")

async def aggregator():
    """
    Agregador principal que coordena todos os processos.
    Agora não bloqueia - apenas inicia tasks em background.
    """
    logging.info("Iniciando sistema de agregação não-bloqueante...")
    
    # Inicia processadores em background
    tasks = [
        asyncio.create_task(tick_processor(), name="tick_processor"),
        asyncio.create_task(firebase_saver(), name="firebase_saver"),
    ]
    
    # Monitora tasks
    while True:
        try:
            await asyncio.sleep(30)  # Heartbeat a cada 30 segundos
            
            # Verifica se alguma task morreu
            for task in tasks:
                if task.done():
                    logging.error(f"Task {task.get_name()} morreu!")
                    if task.exception():
                        logging.error(f"Exceção: {task.exception()}")
            
            # Estatísticas
            with tick_buffer_lock:
                total_buffer = sum(len(buf) for buf in tick_buffer.values())
            
            logging.info(f"Sistema OK - Buffer: {total_buffer} ticks | Fila Firebase: {candle_save_queue.qsize()}")
            
        except Exception as e:
            logging.error(f"Erro no agregador principal: {e}")

async def main():
    # Exemplo hard-coded PETR4; na prática chame SubscribeTicker via API
    SubscribeTicker("PETR4", "B")

    # Inicia aggregador
    await aggregator()

# -----------------------------------------------------------------------------
# Helpers p/ integrar com FastAPI
# -----------------------------------------------------------------------------

_bg_task: asyncio.Task | None = None

def start_background_feed(loop: asyncio.AbstractEventLoop):
    """Cria task de agregação dentro do event-loop do FastAPI."""
    global _bg_task
    if _bg_task is None or _bg_task.done():
        _bg_task = loop.create_task(aggregator())

# para execução standalone (python profit_feed.py)
if __name__ == "__main__":
    asyncio.run(main()) 