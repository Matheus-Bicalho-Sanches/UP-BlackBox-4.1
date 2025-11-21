"""
Profit Feed Service – Prototype
==============================
Fala com a ProfitDLL, agrega ticks em velas de 1-minuto e grava/atualiza no Firestore.

Requisitos:  • Python 3.10 64-bits no Windows  • `pip install -r requirements.txt`
Rodar:       • `python profit_feed.py` (ou via uvicorn se usar dispatcher.py)
Nota: este é um ESBOÇO para acelerar implantação; ajuste paths e trate erros.
"""

import asyncio
import ctypes
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path
import logging
import time
import threading
from collections import deque, defaultdict
from typing import Dict
from urllib import request as _urlreq, error as _urlerr
# ----------------------------------------------------------------------------
# Logging básico (ajustável via LOG_LEVEL=DEBUG|INFO|WARNING)
# ----------------------------------------------------------------------------
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s:%(name)s:%(message)s",
)


import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
from services.profit.db_pg import upsert_candle_1m

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

# callback prototypes (DLL usa __stdcall → WINFUNCTYPE)
StateCallbackType = ctypes.WINFUNCTYPE(None, ctypes.c_int, ctypes.c_int)
TradeCallbackType = ctypes.WINFUNCTYPE(
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

# Histórico de trades (backfill)
HistoryTradeCallbackType = ctypes.WINFUNCTYPE(
    None,
    TAssetID,
    ctypes.c_wchar_p,  # date "dd/MM/yyyy HH:mm:ss.mmm"
    ctypes.c_uint,     # tradeNumber
    ctypes.c_double,   # price
    ctypes.c_double,   # vol
    ctypes.c_int,      # qtd
    ctypes.c_int,      # buyAgent
    ctypes.c_int,      # sellAgent
    ctypes.c_int,      # tradeType
)

# Progresso de requisição histórica
ProgressCallbackType = ctypes.WINFUNCTYPE(
    None,
    TAssetID,          # rAssetID
    ctypes.c_int,      # nProgress (0-100)
)

@dataclass
class ActiveHistoryRequest:
    request_id: str
    start_ts: float  # epoch seconds (UTC)
    end_ts: float    # epoch seconds (UTC)
    ticks: list
    created_at: float
    progress: int = 0  # Progresso do download (0-100)


# --- NOVO: Buffer para requisições sob demanda ---
# Dict: ticker -> dict[request_id, ActiveHistoryRequest]
active_history_requests: Dict[str, Dict[str, ActiveHistoryRequest]] = {}
history_req_lock = threading.Lock()

@HistoryTradeCallbackType
def _history_trade_cb(asset: TAssetID, date: str, trade_number: int, price: float, vol: float, qtd: int, *_):
    try:
        ticker_orig = asset.ticker if asset and asset.ticker else "UNKNOWN"
        ticker_upper = ticker_orig.strip().upper()  # Normalização reforçada
        
        # Log TODOS os callbacks históricos para debug (primeiros 10 e depois a cada 100)
        if not hasattr(_history_trade_cb, "call_count"):
            _history_trade_cb.call_count = {}
        count = _history_trade_cb.call_count.get(ticker_upper, 0) + 1
        _history_trade_cb.call_count[ticker_upper] = count
        
        if count <= 10 or count % 100 == 0:
            logging.info("🔔 History callback #%d for '%s': date=%s, price=%.2f, qty=%d", count, ticker_upper, date, price, qtd)
        
        dt_utc = _parse_profit_datetime(date)
        
        # 1. Processamento normal de backfill (candles de 1 min)
        try:
            minute = dt_utc.replace(second=0, microsecond=0)
            minute_ms = int(minute.timestamp() * 1000)
            dt_ms = int(dt_utc.timestamp() * 1000)
            # store: (dt_ms, trade_number, price, vol, qtd)
            history_backfill[ticker_upper][minute_ms].append((dt_ms, int(trade_number or 0), float(price), float(vol or 0.0), int(qtd or 0)))
        except Exception as e:
            logging.warning("history_cb backfill error: %s", e)

        # 2. Processamento de requisições sob demanda (considera múltiplos request_ids por ticker)
        matched_request = False
        with history_req_lock:
            ticker_requests = active_history_requests.get(ticker_upper)
            if ticker_requests:
                tick_data = {
                    "t": dt_utc.isoformat(),
                    "ts": dt_utc.timestamp(),
                    "p": float(price),
                    "q": int(qtd or 0),
                    "v": float(vol or 0),
                    "id": int(trade_number or 0),
                }
                for req_id, req in ticker_requests.items():
                    if req.start_ts <= tick_data["ts"] <= req.end_ts:
                        req.ticks.append(tick_data)
                        matched_request = True
                        if len(req.ticks) % 100 == 0:
                            logging.info(
                                "History request %s collected %d ticks for %s",
                                req_id,
                                len(req.ticks),
                                ticker_upper,
                            )
            else:
                # Se o ticker não estiver na lista, verifica se há requisições ativas para outros tickers
                # Loga apenas uma vez a cada 1000 ticks ignorados para não floodar
                if active_history_requests and (count % 1000 == 0):
                    keys = list(active_history_requests.keys())
                    logging.warning("Ignored history tick for '%s' (not requested). Active requests: %s", ticker_upper, keys)

        if not matched_request and ticker_requests:
            # Registramos quando o tick ficou fora da janela solicitada
            if count % 200 == 0:
                logging.info(
                    "Tick for %s ignored (out of requested ranges). ts=%s windows=%s",
                    ticker_upper,
                    tick_data["t"],
                    [(req.start_ts, req.end_ts) for req in ticker_requests.values()],
                )

    except Exception as e:
        logging.warning("history_cb parse error for ticker %s: %s", ticker_orig if asset and asset.ticker else "UNKNOWN", e)


@ProgressCallbackType
def _progress_cb(asset: TAssetID, progress: int):
    """Callback de progresso para requisições históricas (0-100)."""
    try:
        ticker_orig = asset.ticker if asset and asset.ticker else "UNKNOWN"
        ticker_upper = ticker_orig.strip().upper()
        
        # Atualiza progresso para todas as requisições ativas deste ticker
        with history_req_lock:
            ticker_requests = active_history_requests.get(ticker_upper)
            if ticker_requests:
                for req_id, req in ticker_requests.items():
                    req.progress = progress
                    # Loga apenas a cada 25% de progresso para não floodar
                    if progress % 25 == 0 or progress == 100:
                        logging.info("Progress for %s (req %s): %d%%", ticker_upper, req_id, progress)
            else:
                # Loga se não houver requisição ativa (pode ser de backfill automático)
                if progress % 50 == 0 or progress == 100:
                    logging.debug("Progress callback for %s: %d%% (no active request)", ticker_upper, progress)
    except Exception as e:
        logging.warning("progress_cb error for ticker %s: %s", ticker_orig if asset and asset.ticker else "UNKNOWN", e)


SUBSCRIBED_TICKERS: set[str] = {"PETR4"}

@StateCallbackType
def _state_cb(state_type: int, result: int):
    logging.info("DLL State change: %s %s", state_type, result)
    # state_type 2: market connection; result 4: conectado
    if state_type == 2 and result == 4:
        try:
            for tkr in list(SUBSCRIBED_TICKERS):
                SubscribeTicker(tkr, "B")
            # Solicita histórico recente (3m) para corrigir gaps
            _call_get_history_recent("PETR4", "B", minutes=3)
        except Exception as e:
            logging.warning("state_cb resubscribe/history error: %s", e)


@TradeCallbackType
def _trade_cb(asset: TAssetID, date: str, trade_number: int, price: float, vol: float, qtd: int, *_):
    ticker = asset.ticker if asset and asset.ticker else "UNKNOWN"
    new_tick(ticker, price, qtd)


def initialize_market_session():
    """Inicializa sessão de market na DLL (chamado no startup do dispatcher)."""
    if not hasattr(dll, "DLLInitializeMarketLogin"):
        logging.warning("DLLInitializeMarketLogin not found in DLL, feed will not work")
        return
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
        ctypes.c_void_p,  # historyTradeCallback (pointer cast)
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
        None,  # NewDailyCallback
        None,  # PriceBookCallback
        None,  # OfferBookCallback
        ctypes.cast(_history_trade_cb, ctypes.c_void_p),  # HistoryTradeCallback
        ctypes.cast(_progress_cb, ctypes.c_void_p),  # ProgressCallback
        None,  # TinyBookCallback
    )
    logging.info("DLLInitializeMarketLogin -> %s", ret)

# ----------------------------------------------------------------------------
# Simplíssimo agregador
# ----------------------------------------------------------------------------

ticks_queue: dict[str, deque[tuple[float, float, int]]] = {}

# Estado em memória do candle em formação (1-minuto)
current_candles: dict[str, dict] = {}

# Telemetria de latência de ticks (por ticker)
telemetry: dict[str, dict] = {}
telemetry_lock = threading.Lock()

def _telemetry_on_tick(ticker: str):
    now_ns = time.perf_counter_ns()
    with telemetry_lock:
        state = telemetry.setdefault(ticker, {
            "last_ns": None,
            "max_gap_ns": 0,
            "count": 0,
            "last_report": time.time(),
        })
        last_ns = state["last_ns"]
        if last_ns is not None:
            gap = now_ns - last_ns
            if gap > state["max_gap_ns"]:
                state["max_gap_ns"] = gap
            # alerta de gap anormal > 5s (aumentado de 2s)
            if gap > 5_000_000_000:
                logging.warning("tick_gap_warn ticker=%s gap_s=%.3f", ticker, gap/1e9)
        state["last_ns"] = now_ns
        state["count"] += 1
        state["last_wall_utc"] = datetime.now(timezone.utc)

async def telemetry_reporter():
    while True:
        await asyncio.sleep(5)
        with telemetry_lock:
            for tkr, st in telemetry.items():
                max_gap_s = (st["max_gap_ns"] or 0)/1e9
                cnt = st["count"]
                logging.info("telemetry t=%s ticks=%s max_gap_s=%.3f", tkr, cnt, max_gap_s)
                st["max_gap_ns"] = 0
                st["count"] = 0

# Keepalive através de GetServerClock (se disponível) e re-subscribe preventivo
KEEPALIVE_INTERVAL_SEC = 15  # Aumentado de 5 para 15 segundos
KEEPALIVE_GAP_THRESHOLD = 30  # Só reconecta após 30s sem dados
KEEPALIVE_COOLDOWN_SEC = 60   # Cooldown de 60s entre reconexões
GetServerClock = getattr(dll, "GetServerClock", None)

async def keepalive_watchdog():
    while True:
        await asyncio.sleep(KEEPALIVE_INTERVAL_SEC)
        now = datetime.now(timezone.utc)
        with telemetry_lock:
            items = list(telemetry.items())
        # simple cooldown to avoid resubscribe thrashing
        if not hasattr(keepalive_watchdog, "last_resubscribe_at"):
            keepalive_watchdog.last_resubscribe_at = {}
        for tkr, st in items:
            last = st.get("last_wall_utc")
            if last is None:
                continue
            gap = (now - last).total_seconds()
            if gap > KEEPALIVE_GAP_THRESHOLD:  # Aumentado threshold
                try:
                    if callable(GetServerClock):
                        try:
                            _ = GetServerClock()
                        except Exception:
                            pass
                    last_ts = keepalive_watchdog.last_resubscribe_at.get(tkr, 0)
                    if (now.timestamp() - last_ts) > KEEPALIVE_COOLDOWN_SEC:  # Cooldown maior
                        SubscribeTicker(tkr, "B")
                        keepalive_watchdog.last_resubscribe_at[tkr] = now.timestamp()
                        logging.info("keepalive: reSubscribe %s after gap_s=%.1f", tkr, gap)
                except Exception as e:
                    logging.warning("keepalive reSubscribe failed %s: %s", tkr, e)

def new_tick(ticker: str, price: float, volume: int):
    """Recebido de callback – acumula no buffer e salva tick individual."""
    _telemetry_on_tick(ticker)
    
    # Enfileira tick para ingestão no backend de alta frequência
    try:
        ts = datetime.now(timezone.utc).timestamp()
        with hf_batch_lock:
            hf_batch.append({
                "symbol": ticker,
                "exchange": "B",
                "price": float(price),
                "volume": int(volume or 0),
                "timestamp": ts,
            })
    except Exception as e:
        logging.warning("Failed to enqueue tick for HF ingest: %s", e)
    
    bucket = ticks_queue.setdefault(ticker, deque(maxlen=50_000))
    bucket.append((price, datetime.now(timezone.utc).timestamp(), volume))

    # Atualiza candle corrente em memória para consumo em tempo-real
    now = datetime.now(timezone.utc)
    minute_ts = now.replace(second=0, microsecond=0)
    ts_ms = int(minute_ts.timestamp() * 1000)

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

    # Evitar prints síncronos no hot-path; telemetria já contabiliza

SKIP_DB_WRITE = os.getenv("SKIP_DB_WRITE", "false").lower() in ("1","true","yes")

async def aggregator():
    """Concatena ticks em candles de 1 minuto e grava no TimescaleDB com retificação T+2s."""
    while True:
        now = datetime.now(timezone.utc)
        utc_minute = now.replace(second=0, microsecond=0)
        next_boundary = utc_minute + timedelta(minutes=1)
        # Espera até o fim do minuto e mais 2s para capturar late ticks
        await asyncio.sleep((next_boundary - now).total_seconds() + 2.0)

        for ticker, ticks in list(ticks_queue.items()):
            if not ticks:
                continue
            # Seleciona somente os ticks do minuto encerrado (utc_minute)
            start_ts = utc_minute.timestamp()
            end_ts = next_boundary.timestamp()
            window = [t for t in ticks if start_ts <= t[1] < end_ts]
            if not window:
                continue
            opens = window[0][0]
            highs = max(t[0] for t in window)
            lows = min(t[0] for t in window)
            closes = window[-1][0]
            volume = sum(t[2] for t in window)
            fin_vol = sum(t[0] * t[2] for t in window)
            ts_iso = utc_minute.replace(tzinfo=timezone.utc).isoformat()
            start_ns = time.perf_counter_ns()
            if not SKIP_DB_WRITE:
                await upsert_candle_1m(
                    symbol=ticker,
                    exchange="B",  # TODO: tornar dinâmico conforme a subscrição
                    ts_minute_utc_iso=ts_iso,
                    o=opens,
                    h=highs,
                    l=lows,
                    c=closes,
                    v=volume,
                    vf=fin_vol,
                )
            dur_ms = (time.perf_counter_ns() - start_ns) / 1e6
            logging.info(
                "agg_flush minute=%s ticker=%s ticks_total=%s ticks_window=%s upsert_ms=%.2f",
                utc_minute.isoformat(),
                ticker,
                len(ticks),
                len(window),
                dur_ms,
            )

            # Mantém os ticks posteriores na fila e remove os já consumidos
            # Copia os que são >= end_ts
            remaining = deque([t for t in ticks if t[1] >= end_ts], maxlen=ticks.maxlen)
            ticks_queue[ticker] = remaining

# -------- Backfill de histórico ---------
history_backfill: dict[str, dict[int, list[tuple[int, int, float, float, int]]]] = defaultdict(lambda: defaultdict(list))

# -----------------------------------------------------------------------------
# Ingestão no backend de alta frequência (HTTP batch)
# -----------------------------------------------------------------------------
HF_INGEST_URL = os.getenv("HF_INGEST_URL", "http://127.0.0.1:8002/ingest/batch")
HF_BATCH_MS = int(os.getenv("HF_BATCH_MS", "50"))
HF_BATCH_MAX = int(os.getenv("HF_BATCH_MAX", "2000"))
HF_MAX_RETRIES = int(os.getenv("HF_MAX_RETRIES", "3"))

hf_batch: deque[dict] = deque()
hf_batch_lock = threading.Lock()

def _send_batch_sync(payload: list[dict]) -> bool:
    try:
        data = json.dumps({"ticks": payload}).encode("utf-8")
        req = _urlreq.Request(HF_INGEST_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
        with _urlreq.urlopen(req, timeout=5) as resp:
            return 200 <= resp.status < 300
    except _urlerr.URLError as e:
        logging.warning("HF ingest URLError: %s", e)
        return False
    except Exception as e:
        logging.warning("HF ingest error: %s", e)
        return False

async def hf_ingest_loop():
    """Loop assíncrono que envia ticks em lote para o backend HF."""
    loop = asyncio.get_running_loop()
    while True:
        try:
            await asyncio.sleep(HF_BATCH_MS / 1000)
            batch: list[dict] = []
            with hf_batch_lock:
                while hf_batch and len(batch) < HF_BATCH_MAX:
                    batch.append(hf_batch.popleft())
            if not batch:
                continue
            ok = await loop.run_in_executor(None, _send_batch_sync, batch)
            if not ok:
                # Reenfileira em caso de falha
                with hf_batch_lock:
                    for item in reversed(batch):
                        hf_batch.appendleft(item)
        except Exception as e:
            logging.error("hf_ingest_loop error: %s", e)
            await asyncio.sleep(0.5)


def _parse_profit_datetime(date_str: str) -> datetime:
    try:
        dt_naive = datetime.strptime(date_str, "%d/%m/%Y %H:%M:%S.%f")
    except ValueError:
        dt_naive = datetime.strptime(date_str, "%d/%m/%Y %H:%M:%S")
    local = dt_naive.astimezone() if dt_naive.tzinfo else dt_naive.replace(tzinfo=datetime.now().astimezone().tzinfo)
    return local.astimezone(timezone.utc)


def _day_string(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y")

def _day_datetime_string(dt: datetime, start_of_day: bool = True) -> str:
    """
    Retorna string no formato DD/MM/YYYY HH:mm:SS conforme documentação da DLL.
    Se start_of_day=True, retorna 00:00:00, senão retorna 23:59:59.
    """
    if start_of_day:
        return dt.strftime("%d/%m/%Y 00:00:00")
    else:
        return dt.strftime("%d/%m/%Y 23:59:59")

def _call_get_history_recent(ticker: str, exch: str = "B", minutes: int = 3) -> None:
    """Solicita histórico do dia e o flusher filtra; pedimos only recent (3 min) para reduzir carga."""
    if not hasattr(dll, "GetHistoryTrades"):
        return
    try:
        get_hist = dll.GetHistoryTrades
        get_hist.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_wchar_p]
        get_hist.restype = ctypes.c_int
        today_local = datetime.now().astimezone()
        day = _day_string(today_local)
        code = get_hist(ticker, exch, day, day)
        if code != 0:
            logging.warning("GetHistoryTrades failed %s(%s): code=%s", ticker, exch, code)
        else:
            logging.info("GetHistoryTrades requested (recent ~%sm) for %s %s", minutes, ticker, day)
        # Registrar janela alvo no objeto para o flusher considerar
        if not hasattr(_call_get_history_recent, "cutoff_ms_by_ticker"):
            _call_get_history_recent.cutoff_ms_by_ticker = {}
        cutoff = int((datetime.now(timezone.utc) - timedelta(minutes=minutes)).timestamp() * 1000)
        _call_get_history_recent.cutoff_ms_by_ticker[ticker] = cutoff
    except Exception as e:
        logging.warning("GetHistoryTrades call error: %s", e)

# -----------------------------------------------------------------------------
# NOVO: Função para requisição síncrona de histórico (para API sob demanda)
# -----------------------------------------------------------------------------
def request_history_ticks_sync(ticker: str, start_date: str, end_date: str, timeout_sec: float = 60.0, save_to_firestore: bool = True) -> list[dict]:
    """
    Executa GetHistoryTrades para um período específico e aguarda coleta dos dados.
    Datas formato 'dd/MM/yyyy'.
    Itera dia a dia porque a DLL precisa de uma chamada por dia.
    Bloqueia a thread atual, então execute em executor se chamado via async.
    Se save_to_firestore=True, salva os dados no Firestore antes de retornar.
    """
    if not hasattr(dll, "GetHistoryTrades"):
        logging.error("DLL GetHistoryTrades not available")
        return []

    ticker = ticker.upper()
    exchange = "B"  # Padrão B3

    # Inscreve para garantir histórico liberado (segundo doc Nelogica)
    SubscribeTicker(ticker, exchange)

    try:
        get_hist = dll.GetHistoryTrades
        get_hist.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_wchar_p]
        get_hist.restype = ctypes.c_int
        
        # Parse das datas para iterar dia a dia
        try:
            start_dt = datetime.strptime(start_date, "%d/%m/%Y")
            end_dt = datetime.strptime(end_date, "%d/%m/%Y")
        except ValueError as e:
            logging.error("Invalid date format. Expected dd/MM/yyyy, got: %s, %s", start_date, end_date)
            return []
        
        local_tz = datetime.now().astimezone().tzinfo or timezone.utc
        start_local = start_dt.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=local_tz)
        end_local = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=local_tz)
        start_ts = start_local.astimezone(timezone.utc).timestamp()
        end_ts = end_local.astimezone(timezone.utc).timestamp()

        request_id = f"{int(time.time() * 1000)}-{threading.get_ident()}"
        with history_req_lock:
            ticker_requests = active_history_requests.setdefault(ticker, {})
            ticker_requests[request_id] = ActiveHistoryRequest(
                request_id=request_id,
                start_ts=start_ts,
                end_ts=end_ts,
                ticks=[],
                created_at=time.time(),
            )

        num_days = (end_dt - start_dt).days + 1
        logging.info("Requesting history for %s from %s to %s (%d days)", ticker, start_date, end_date, num_days)
        
        # Itera dia a dia (a DLL precisa de uma chamada por dia)
        # Pula fins de semana (sábado=5, domingo=6)
        cur = start_dt
        days_requested = 0
        days_skipped = 0
        
        while cur <= end_dt:
            # Verifica se é fim de semana
            weekday = cur.weekday()  # 0=segunda, 6=domingo
            if weekday >= 5:  # Sábado ou domingo
                logging.info("Skipping weekend day %s", _day_string(cur))
                cur += timedelta(days=1)
                days_skipped += 1
                continue
                
            # Formato completo conforme documentação: DD/MM/YYYY HH:mm:SS
            day_start_str = _day_datetime_string(cur, start_of_day=True)  # 00:00:00
            day_end_str = _day_datetime_string(cur, start_of_day=False)   # 23:59:59
            logging.info("Requesting day %s for %s (from %s to %s)", _day_string(cur), ticker, day_start_str, day_end_str)
            
            # Chama DLL para este dia específico com horário completo
            code = get_hist(ticker, exchange, day_start_str, day_end_str)
            if code != 0:
                logging.warning("GetHistoryTrades failed for %s on %s: code=%s", ticker, _day_string(cur), code)
            else:
                days_requested += 1
                # Espera um pouco para callbacks deste dia chegarem
                time.sleep(1.5)  # Aumentado de 1.0 para 1.5 segundos
            
            cur += timedelta(days=1)
        
        if days_skipped > 0:
            logging.info("Skipped %d weekend days", days_skipped)
        
        if days_requested == 0:
            logging.error("No days successfully requested")
            with history_req_lock:
                ticker_map = active_history_requests.get(ticker, {})
                ticker_map.pop(request_id, None)
                if not ticker_map:
                    active_history_requests.pop(ticker, None)
            return []
        
        logging.info("All days requested for %s (req %s). Waiting for data collection...", ticker, request_id)
        
        # Aguarda chegada dos dados de todos os dias
        # Critério de parada: progresso 100% + delay, tempo sem novos ticks (silence timeout), ou timeout total
        start_wait = time.time()
        last_count = 0
        last_progress = 0
        silence_start = time.time()
        progress_100_time = None
        silence_threshold = 10.0  # 10 segundos sem novos ticks = fim da transmissão
        progress_100_wait = 5.0   # Aguarda 5s após progresso 100% para garantir ticks finais
        
        logging.info("Starting collection wait (timeout=%ds, silence=%ds, progress_100_wait=%ds)...", timeout_sec, silence_threshold, progress_100_wait)
        
        while (time.time() - start_wait) < timeout_sec:
            time.sleep(0.5)
            
            with history_req_lock:
                ticker_map = active_history_requests.get(ticker)
                active_req = ticker_map.get(request_id) if ticker_map else None
                current_len = len(active_req.ticks) if active_req else 0
                current_progress = active_req.progress if active_req else 0
            
            if active_req is None:
                logging.warning("Active request %s for %s not found (maybe cancelled).", request_id, ticker)
                break

            # Detectar quando progresso chega a 100%
            if current_progress == 100 and last_progress != 100:
                progress_100_time = time.time()
                logging.info("Progress reached 100%% for %s (req %s). Waiting %ds for final ticks...", ticker, request_id, progress_100_wait)
                last_progress = 100

            # Se progresso chegou a 100% e passou o tempo de espera sem novos ticks, retornar
            if progress_100_time is not None and current_progress == 100:
                if current_len > last_count:
                    progress_100_time = time.time()  # Reset se chegarem mais ticks
                    last_count = current_len
                elif (time.time() - progress_100_time) > progress_100_wait:
                    logging.info("History collection finished by progress 100%% for %s (req %s). Total: %d ticks", ticker, request_id, current_len)
                    break

            if current_len > last_count:
                last_count = current_len
                silence_start = time.time()  # Reset silence timer
                if progress_100_time is None:  # Só loga progresso se ainda não chegou a 100%
                    if current_len % 50 == 0 or current_len == 1:  # Log mais frequente para debug
                        logging.info("Collected %d ticks so far for %s (req %s) (progress: %d%%)...", current_len, ticker, request_id, current_progress)
            elif (time.time() - silence_start) > silence_threshold and current_len > 0:
                logging.info("History collection finished by silence for %s (req %s). Total: %d ticks", ticker, request_id, current_len)
                break
            
            # Atualizar last_progress
            if current_progress != last_progress and last_progress != 100:
                last_progress = current_progress
        
        if (time.time() - start_wait) >= timeout_sec:
            logging.warning("History collection timeout reached for %s (req %s) after %ds. Total collected: %d ticks", ticker, request_id, timeout_sec, last_count)
        
        # Aguarda um pouco mais para callbacks finais (semelhante ao history_probe.py)
        logging.info("Waiting for final callbacks...")
        final_wait_start = time.time()
        while (time.time() - final_wait_start) < 3.0:  # Mais 3 segundos para callbacks finais
            time.sleep(0.2)
            with history_req_lock:
                ticker_map = active_history_requests.get(ticker)
                active_req = ticker_map.get(request_id) if ticker_map else None
                if not active_req:
                    break
                final_len = len(active_req.ticks)
                if final_len > current_len:
                    current_len = final_len
                    silence_start = time.time()  # Reset se chegou mais dados
                    logging.info("Received additional %d ticks in final wait for %s (req %s)", final_len - last_count, ticker, request_id)
                    last_count = final_len
                
        # Recupera dados finais
        with history_req_lock:
            ticker_map = active_history_requests.get(ticker, {})
            active_req = ticker_map.pop(request_id, None)
            if not ticker_map:
                active_history_requests.pop(ticker, None)
            
        if not active_req:
            logging.warning("No data captured for %s (req %s).", ticker, request_id)
            return []

        logging.info("History extraction completed. Total ticks: %d (req %s)", len(active_req.ticks), request_id)
        result = list(active_req.ticks)
        logging.info("🟡 request_history_ticks_sync: About to return %d ticks", len(result))
        
        # Salvar no Firestore antes de retornar (dentro da função para garantir salvamento)
        doc_id = None
        if save_to_firestore and result:
            try:
                logging.info("💾 [START] Saving %d ticks to Firestore...", len(result))
                import time as time_module
                from datetime import datetime as dt_module
                
                # Criar documento com ID único baseado em ticker, datas e timestamp
                request_timestamp = dt_module.now()
                doc_id = f"{ticker.upper()}_{start_date.replace('/', '')}_{end_date.replace('/', '')}_{int(time_module.time())}"
                logging.info("💾 [STEP 1] Created doc_id: %s", doc_id)
                
                # Importar firestore aqui para garantir que está disponível
                from firebase_admin import firestore as firestore_module
                
                # Estrutura do documento
                doc_data = {
                    "ticker": ticker.upper(),
                    "start_date": start_date,
                    "end_date": end_date,
                    "request_timestamp": request_timestamp.isoformat(),
                    "total_ticks": len(result),
                    "ticks": result,
                    "created_at": firestore_module.SERVER_TIMESTAMP,
                    "saved_at": firestore_module.SERVER_TIMESTAMP,
                }
                logging.info("💾 [STEP 2] Created doc_data with %d ticks", len(result))
                
                # Salvar no Firestore Database (collection: history_ticks)
                # Nota: Firestore Database é diferente de Storage (arquivos)
                logging.info("💾 [STEP 3] Calling Firestore Database set() for collection 'history_ticks'...")
                doc_ref = db.collection("history_ticks").document(doc_id)
                doc_ref.set(doc_data)
                logging.info("💾 [STEP 4] Firestore Database set() completed successfully")
                
                logging.info("✅ Saved to Firestore with ID: %s", doc_id)
            except Exception as save_err:
                logging.error("❌ Error saving to Firestore: %s", save_err, exc_info=True)
                import traceback
                logging.error("Full traceback: %s", traceback.format_exc())
                # Continuar mesmo se falhar o salvamento
        
        # Adicionar doc_id ao resultado para retornar (se salvo com sucesso)
        if doc_id:
            logging.info("🟢 request_history_ticks_sync: Returning %d ticks with doc_id=%s", len(result), doc_id)
        else:
            logging.info("🟢 request_history_ticks_sync: Returning %d ticks (not saved)", len(result))
        
        logging.info("🟢 request_history_ticks_sync: FINAL RETURN with %d ticks", len(result))
        return result

    except Exception as e:
        logging.error("request_history_ticks_sync failed: %s", e, exc_info=True)
        with history_req_lock:
            ticker_map = active_history_requests.get(ticker, {})
            req_removed = ticker_map.pop(request_id, None)
            if req_removed and not ticker_map:
                active_history_requests.pop(ticker, None)
        return []


async def backfill_flusher():
    while True:
        await asyncio.sleep(5)
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        cutoff_ms = now_ms - 60_000
        for tkr, minute_map in list(history_backfill.items()):
            for minute_ms, pts in list(minute_map.items()):
                # consider only minutes older than cutoff and also after recent-call cutoff (if set)
                if minute_ms > cutoff_ms:
                    continue
                req_cutoff = getattr(_call_get_history_recent, "cutoff_ms_by_ticker", {}).get(tkr)
                if req_cutoff and minute_ms < req_cutoff:
                    # descartamos minutos muito antigos
                    del minute_map[minute_ms]
                    continue
                if not pts:
                    del minute_map[minute_ms]
                    continue
                # Deduplicação por tradeNumber; se tradeNumber <= 0, usar (dt_ms, price) como chave
                seen = set()
                dedup: list[tuple[int, float, float, int]] = []  # (dt_ms, price, vol, qty)
                for dt_ms, tn, p, vol, q in pts:
                    key = (tn if tn > 0 else None, dt_ms)
                    if key in seen:
                        continue
                    seen.add(key)
                    dedup.append((dt_ms, p, vol, q))
                if not dedup:
                    del minute_map[minute_ms]
                    continue
                # Ordena cronologicamente para OHLC
                dedup.sort(key=lambda x: x[0])
                prices = [p for _, p, _, _ in dedup]
                o = prices[0]
                h = max(prices)
                l = min(prices)
                c = prices[-1]
                # Quantidade: sempre abs(q) e limitações razoáveis para evitar overflow acidental
                def sane_qty(q: int) -> int:
                    aq = abs(int(q))
                    return aq if aq <= 1_000_000 else 1_000_000
                v = sum(sane_qty(q) for _, _, _, q in dedup)
                # Volume financeiro: preferir 'vol' se vier positivo; senão preço*abs(q)
                vf = 0.0
                for _, p, vol, q in dedup:
                    if vol and vol > 0:
                        vf += float(vol)
                    else:
                        vf += p * sane_qty(q)
                ts_iso = datetime.fromtimestamp(minute_ms/1000, tz=timezone.utc).isoformat()
                try:
                    if not SKIP_DB_WRITE:
                        await upsert_candle_1m(tkr, "B", ts_iso, o, h, l, c, v, vf)
                    logging.info("backfill_upsert minute=%s ticker=%s trades=%s vf=%.0f", ts_iso, tkr, len(pts), vf)
                except Exception as e:
                    logging.warning("backfill_upsert error %s %s: %s", tkr, minute_ms, e)
                finally:
                    del minute_map[minute_ms]

async def main():
    # Exemplo hard-coded PETR4; na prática chame SubscribeTicker via API
    SubscribeTicker("PETR4", "B")

    # Inicia agregador + telemetria em paralelo
    await asyncio.gather(
        aggregator(),
        telemetry_reporter(),
        keepalive_watchdog(),
        backfill_flusher(),
        hf_ingest_loop(),
    )

# -----------------------------------------------------------------------------
# Helpers p/ integrar com FastAPI
# -----------------------------------------------------------------------------

_bg_task: asyncio.Task | None = None


def start_background_feed(loop: asyncio.AbstractEventLoop):
    """Cria task de agregação dentro do event-loop do FastAPI."""
    global _bg_task
    if _bg_task is None or _bg_task.done():
        _bg_task = loop.create_task(aggregator())
        loop.create_task(telemetry_reporter())
        loop.create_task(keepalive_watchdog())
        loop.create_task(backfill_flusher())
        loop.create_task(hf_ingest_loop())

# para execução standalone (python profit_feed.py)
if __name__ == "__main__":
    asyncio.run(main())