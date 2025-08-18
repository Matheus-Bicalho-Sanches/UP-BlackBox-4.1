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
from datetime import datetime, timezone, timedelta
from pathlib import Path
import logging
import time
import threading
from collections import deque, defaultdict
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

@HistoryTradeCallbackType
def _history_trade_cb(asset: TAssetID, date: str, trade_number: int, price: float, vol: float, qtd: int, *_):
    try:
        # Definição adiantada; o buffer de backfill é preenchido depois que estruturas são criadas
        # Vamos apenas armazenar provisoriamente num buffer global que será definido mais abaixo.
        from datetime import datetime as _dt, timezone as _tz
        try:
            dt_naive = _dt.strptime(date, "%d/%m/%Y %H:%M:%S.%f")
        except ValueError:
            dt_naive = _dt.strptime(date, "%d/%m/%Y %H:%M:%S")
        local = dt_naive.astimezone() if dt_naive.tzinfo else dt_naive.replace(tzinfo=_dt.now().astimezone().tzinfo)
        dt_utc = local.astimezone(_tz.utc)
        minute_ms = int(dt_utc.replace(second=0, microsecond=0).timestamp() * 1000)
        # uso tardio de history_backfill: se ainda não existir, será inicializado adiante
        try:
            history_backfill[asset.ticker][minute_ms].append((price, int(qtd or 0)))  # type: ignore[name-defined]
        except NameError:
            pass
    except Exception:
        pass


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
        ctypes.cast(_history_trade_cb, ctypes.c_void_p),
        None,
        None,
        None,
        None,
        None,
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
            # alerta de gap anormal > 2s
            if gap > 2_000_000_000:
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
KEEPALIVE_INTERVAL_SEC = 5
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
            if gap > KEEPALIVE_INTERVAL_SEC + 1:
                try:
                    if callable(GetServerClock):
                        try:
                            _ = GetServerClock()
                        except Exception:
                            pass
                    last_ts = keepalive_watchdog.last_resubscribe_at.get(tkr, 0)
                    if (now.timestamp() - last_ts) > 10:  # cooldown 10s
                        SubscribeTicker(tkr, "B")
                        keepalive_watchdog.last_resubscribe_at[tkr] = now.timestamp()
                        logging.info("keepalive: reSubscribe %s after gap_s=%.1f", tkr, gap)
                except Exception as e:
                    logging.warning("keepalive reSubscribe failed %s: %s", tkr, e)

def new_tick(ticker: str, price: float, volume: int):
    """Recebido de callback – acumula no buffer."""
    _telemetry_on_tick(ticker)
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

def _parse_profit_datetime(date_str: str) -> datetime:
    try:
        dt_naive = datetime.strptime(date_str, "%d/%m/%Y %H:%M:%S.%f")
    except ValueError:
        dt_naive = datetime.strptime(date_str, "%d/%m/%Y %H:%M:%S")
    local = dt_naive.astimezone() if dt_naive.tzinfo else dt_naive.replace(tzinfo=datetime.now().astimezone().tzinfo)
    return local.astimezone(timezone.utc)

@HistoryTradeCallbackType
def _history_trade_cb(asset: TAssetID, date: str, trade_number: int, price: float, vol: float, qtd: int, *_):
    try:
        dt_utc = _parse_profit_datetime(date)
        minute = dt_utc.replace(second=0, microsecond=0)
        minute_ms = int(minute.timestamp() * 1000)
        dt_ms = int(dt_utc.timestamp() * 1000)
        # store: (dt_ms, trade_number, price, vol, qtd)
        history_backfill[asset.ticker][minute_ms].append((dt_ms, int(trade_number or 0), float(price), float(vol or 0.0), int(qtd or 0)))
    except Exception as e:
        logging.warning("history_cb parse error: %s", e)

def _day_string(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y")

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

# para execução standalone (python profit_feed.py)
if __name__ == "__main__":
    asyncio.run(main()) 