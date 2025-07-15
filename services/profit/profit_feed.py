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
# Simplíssimo agregador
# ----------------------------------------------------------------------------

ticks_queue: dict[str, list[tuple[float, float, int]]] = {}

# Estado em memória do candle em formação (1-minuto)
current_candles: dict[str, dict] = {}

def new_tick(ticker: str, price: float, volume: int):
    """Recebido de callback – acumula no buffer."""
    bucket = ticks_queue.setdefault(ticker, [])
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

    # opcional: se quiser ver em tempo-real no console
    print(f"tick {ticker} {price} x{volume}")

async def aggregator():
    """Concatena ticks em candles de 1 minuto e grava no Firestore"""
    while True:
        now = datetime.now(timezone.utc)
        utc_minute = now.replace(second=0, microsecond=0)
        next_boundary = utc_minute.replace(second=0, microsecond=0) + timedelta(minutes=1)
        await asyncio.sleep((next_boundary - now).total_seconds())

        for ticker, ticks in list(ticks_queue.items()):
            if not ticks:
                continue
            opens = ticks[0][0]
            highs = max(t[0] for t in ticks)
            lows = min(t[0] for t in ticks)
            closes = ticks[-1][0]
            volume = sum(t[2] for t in ticks)
            fin_vol = sum(t[0] * t[2] for t in ticks)
            ts = int(utc_minute.timestamp() * 1000)
            candle = {
                "t": ts,
                "o": opens,
                "h": highs,
                "l": lows,
                "c": closes,
                "v": volume,
                "vf": fin_vol,
            }

            # grava histórico
            db.collection("marketDataDLL").document(ticker).collection("candles_1m").document(str(ts)).set(candle)
            # atualiza corrente
            db.collection("marketDataDLL").document(ticker).collection("current").document("1m").set(candle)

            # também reseta candle em memória para o novo minuto
            current_candles[ticker] = candle.copy()

            ticks_queue[ticker].clear()

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