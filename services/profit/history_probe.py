import os
import sys
import time
import ctypes
from pathlib import Path
from datetime import datetime, timedelta, timezone


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def load_env() -> None:
    # Load Dll_Profit/.env if exists
    try:
        from dotenv import load_dotenv  # type: ignore
    except Exception:
        return
    repo_root = Path(__file__).resolve().parents[2]
    env_path = repo_root / "Dll_Profit" / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=str(env_path))


def find_dll() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    # Prefer 64-bit
    candidates = [
        Path(__file__).with_name("ProfitDLL64.dll"),
        repo_root / "Dll_Profit" / "bin" / "Win64" / "Example" / "ProfitDLL64.dll",
        repo_root / "Dll_Profit" / "DLLs" / "Win64" / "ProfitDLL.dll",
        repo_root / "Dll_Profit" / "DLLs" / "Win32" / "ProfitDLL.dll",
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError("Profit DLL não encontrada. Copie para Dll_Profit/DLLs/Win64/ProfitDLL.dll")


# ctypes types
class TAssetID(ctypes.Structure):
    _fields_ = [
        ("ticker", ctypes.c_wchar_p),
        ("exchange", ctypes.c_wchar_p),
        ("feed", ctypes.c_int),
    ]


StateCallbackType = ctypes.WINFUNCTYPE(None, ctypes.c_int, ctypes.c_int)
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
    ctypes.c_int,      # tradeType,
)


def parse_dt_utc(s: str) -> datetime:
    try:
        dt = datetime.strptime(s, "%d/%m/%Y %H:%M:%S.%f")
    except ValueError:
        dt = datetime.strptime(s, "%d/%m/%Y %H:%M:%S")
    # Assume horário local do Windows e converte para UTC
    local = dt.astimezone() if dt.tzinfo else dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
    return local.astimezone(timezone.utc)


def day_str(d: datetime) -> str:
    return d.strftime("%d/%m/%Y")


def probe_history(symbol: str, exchange: str, start: datetime, end: datetime) -> dict:
    """Retorna mapa dia->lista de trades (dt_utc, price, qtd)."""
    repo_root = Path(__file__).resolve().parents[2]
    dll_path = find_dll()
    dll = ctypes.WinDLL(str(dll_path))

    # DLL init
    DLLInitializeMarketLogin = getattr(dll, "DLLInitializeMarketLogin")
    DLLInitializeMarketLogin.argtypes = [
        ctypes.c_wchar_p,
        ctypes.c_wchar_p,
        ctypes.c_wchar_p,
        StateCallbackType,
        ctypes.c_void_p,  # trade callback (não precisamos no probe)
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        HistoryTradeCallbackType,  # history
        ctypes.c_void_p,
        ctypes.c_void_p,
    ]
    DLLInitializeMarketLogin.restype = ctypes.c_int

    ACTIVATION_KEY = os.getenv("ACTIVATION_CODE", "")
    LOGIN_USER = os.getenv("login", "")
    LOGIN_PASS = os.getenv("password", "")

    trades_by_day: dict[str, list[tuple[datetime, float, int]]] = {}
    market_connected = {"ok": False}

    @StateCallbackType
    def _state_cb(state_type: int, result: int):
        # Apenas log enxuto
        if state_type == 2:
            log(f"state market={result}")
            if result == 4:  # conectado
                market_connected["ok"] = True

    @HistoryTradeCallbackType
    def _hist_cb(asset: TAssetID, date: str, trade_number: int, price: float, vol: float, qtd: int, *_):
        dtu = parse_dt_utc(date)
        key = dtu.strftime("%Y-%m-%d")
        trades_by_day.setdefault(key, []).append((dtu, float(price), int(qtd or 0)))

    ret = DLLInitializeMarketLogin(
        ACTIVATION_KEY, LOGIN_USER, LOGIN_PASS, _state_cb, None, None, None, None, _hist_cb, None, None
    )
    if ret != 0:
        raise RuntimeError(f"DLL login falhou ({ret})")

    # Aguarda conexão de mercado
    t0 = time.time()
    while not market_connected["ok"] and (time.time() - t0) < 10:
        time.sleep(0.2)
    if not market_connected["ok"]:
        log("market not connected within timeout; results may be empty")

    # Inscreve no ativo (alguns ambientes exigem para liberar histórico)
    try:
        SubscribeTicker = getattr(dll, "SubscribeTicker")
        SubscribeTicker.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
        SubscribeTicker.restype = ctypes.c_int
        code_sub = SubscribeTicker(symbol, exchange)
        log(f"subscribe {symbol}({exchange}) -> {code_sub}")
    except Exception:
        pass

    # GetHistoryTrades
    GetHistoryTrades = getattr(dll, "GetHistoryTrades")
    GetHistoryTrades.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_wchar_p]
    GetHistoryTrades.restype = ctypes.c_int

    cur = start
    last_recv = time.time()
    while cur <= end:
        ds = day_str(cur)
        code = GetHistoryTrades(symbol, exchange, ds, ds)
        log(f"get_history {symbol} {ds} -> code {code}")
        # espera por callbacks deste dia (até 1.0s)
        t_day = time.time()
        while time.time() - t_day < 1.0:
            time.sleep(0.1)
        cur += timedelta(days=1)

    # aguarda callbacks finais (até 5s)
    t0 = time.time()
    while time.time() - t0 < 5:
        time.sleep(0.2)

    return trades_by_day


def summarize_daily(trades: list[tuple[datetime, float, int]]) -> dict:
    if not trades:
        return {"count": 0}
    trades_sorted = sorted(trades, key=lambda x: x[0])
    prices = [p for _, p, _ in trades_sorted]
    o = prices[0]
    h = max(prices)
    l = min(prices)
    c = prices[-1]
    v = sum(q for _, _, q in trades_sorted)
    return {"count": len(trades_sorted), "o": o, "h": h, "l": l, "c": c, "v": v}


def run_quick_checks(symbol: str = "PETR4", exchange: str = "B") -> None:
    utc_today = datetime.now(timezone.utc).astimezone()
    day_start = (utc_today - timedelta(days=0)).date()
    week_start = (utc_today - timedelta(days=7)).date()
    month_start = (utc_today - timedelta(days=30)).date()
    year_start = (utc_today - timedelta(days=365)).date()

    cases = [
        ("1d", datetime.combine(day_start, datetime.min.time()).astimezone(), utc_today),
        ("7d", datetime.combine(week_start, datetime.min.time()).astimezone(), utc_today),
        ("30d", datetime.combine(month_start, datetime.min.time()).astimezone(), utc_today),
        ("365d", datetime.combine(year_start, datetime.min.time()).astimezone(), utc_today),
    ]

    for label, start, end in cases:
        log(f"=== Probing {label} from {start.date()} to {end.date()} ===")
        trades_map = probe_history(symbol, exchange, start, end)
        total_days = 0
        days_with_data = 0
        for day_key in sorted(trades_map.keys()):
            total_days += 1
            summary = summarize_daily(trades_map[day_key])
            if summary.get("count", 0) > 0:
                days_with_data += 1
            log(f"{day_key} -> {summary}")
        log(f"Result {label}: days={total_days} with_data={days_with_data}")


def run_today_windows(symbol: str = "PETR4", exchange: str = "B") -> None:
    now_local = datetime.now().astimezone()
    start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = datetime.now(timezone.utc)

    log(f"=== Today probe {symbol} ({exchange}) {start_local.date()} ===")
    data = probe_history(symbol, exchange, start_utc, end_utc)
    key = start_utc.strftime("%Y-%m-%d")
    trades = data.get(key, [])
    log(f"trades today count={len(trades)}")

    def summarize_range(minutes: int | None) -> dict:
        t_end = datetime.now(timezone.utc)
        t_start = (t_end - timedelta(minutes=minutes)) if minutes is not None else start_utc
        window = [t for t in trades if t_start <= t[0] <= t_end]
        return summarize_daily(window)

    last_5m = summarize_range(5)
    last_60m = summarize_range(60)
    since_open = summarize_range(None)
    log(f"last_5m: {last_5m}")
    log(f"last_60m: {last_60m}")
    log(f"since_day_start: {since_open}")


if __name__ == "__main__":
    # Garanta que o .env foi carregado
    load_env()
    # Força event loop policy no Windows se necessário
    if sys.platform == "win32":
        try:
            import asyncio
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except Exception:
            pass
    # Executa teste do dia com janelas (5m, 60m, desde abertura)
    run_today_windows()


