import os
import time
import threading
from pathlib import Path
from typing import Callable, Optional, Dict
import ctypes
import logging
import asyncio
import struct
import httpx
import requests
from services.high_frequency.config import ORDER_BOOK_SNAPSHOT_INTERVAL_MS, ORDER_BOOK_TOP_LEVELS

logger = logging.getLogger("market_feed_next")

# Estruturas e callbacks reais usando ctypes (compatível com ProfitDLL)


class TConnectorAssetIdentifier(ctypes.Structure):
    _fields_ = [
        ("Version", ctypes.c_ubyte),
        ("Ticker", ctypes.c_wchar_p),
        ("Exchange", ctypes.c_wchar_p),
        ("FeedType", ctypes.c_ubyte),
    ]


class TPriceBookAsset(ctypes.Structure):
    _fields_ = [
        ("ticker", ctypes.c_wchar_p),
        ("bolsa", ctypes.c_wchar_p),
        ("feed", ctypes.c_int),
    ]


# Alias específicos para cada callback
TTradeAsset = TConnectorAssetIdentifier
TBookAsset = TPriceBookAsset

StateCallbackType = ctypes.WINFUNCTYPE(None, ctypes.c_int, ctypes.c_int)
TradeCallbackType = ctypes.WINFUNCTYPE(
    None,
    ctypes.POINTER(TTradeAsset),
    ctypes.c_wchar_p,
    ctypes.c_uint,
    ctypes.c_double,
    ctypes.c_double,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
)
HistoryTradeCallbackType = ctypes.WINFUNCTYPE(
    None,
    ctypes.POINTER(TTradeAsset),
    ctypes.c_wchar_p,
    ctypes.c_uint,
    ctypes.c_double,
    ctypes.c_double,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
)


class SystemTime(ctypes.Structure):
    _fields_ = [
        ("wYear", ctypes.c_ushort),
        ("wMonth", ctypes.c_ushort),
        ("wDayOfWeek", ctypes.c_ushort),
        ("wDay", ctypes.c_ushort),
        ("wHour", ctypes.c_ushort),
        ("wMinute", ctypes.c_ushort),
        ("wSecond", ctypes.c_ushort),
        ("wMilliseconds", ctypes.c_ushort),
    ]


class TConnectorTrade(ctypes.Structure):
    _fields_ = [
        ("Version", ctypes.c_ubyte),
        ("TradeDate", SystemTime),
        ("TradeNumber", ctypes.c_uint),
        ("Price", ctypes.c_double),
        ("Quantity", ctypes.c_longlong),
        ("Volume", ctypes.c_double),
        ("BuyAgent", ctypes.c_int),
        ("SellAgent", ctypes.c_int),
        ("TradeType", ctypes.c_ubyte),
    ]


TradeCallbackV2Type = ctypes.WINFUNCTYPE(None, TConnectorAssetIdentifier, ctypes.c_size_t, ctypes.c_uint)
PriceBookCallbackV2Type = ctypes.WINFUNCTYPE(None, TBookAsset, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_longlong, ctypes.c_longlong, ctypes.c_double, ctypes.c_void_p, ctypes.c_void_p)
OfferBookCallbackV2Type = ctypes.WINFUNCTYPE(
    None,
    TBookAsset,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_longlong,
    ctypes.c_int,
    ctypes.c_longlong,
    ctypes.c_double,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_wchar_p,
    ctypes.c_void_p,
    ctypes.c_void_p,
)


def _try_load_envfile(env_path: Path) -> None:
    if not env_path.exists():
        return
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ[key.strip()] = value.strip()
    except Exception:
        pass


class ProfitDLL:
    def __init__(self) -> None:
        self._on_trade: Optional[Callable[[str, float, int, float], None]] = None
        self._on_price_book: Optional[Callable[[str, dict], None]] = None
        self._dll: Optional[ctypes.WinDLL] = None
        self._initialized = False
        self._connected = False
        self._desired_subs: set[str] = set()
        self._lock = threading.Lock()
        self._subscribe_ticker = None
        self._unsubscribe_ticker = None
        self._subscribe_book = None
        self._unsubscribe_book = None
        self._subscribe_offer = None
        self._unsubscribe_offer = None
        self._last_snapshot_ts: Dict[str, float] = {}
        self._book_cache: Dict[str, Dict[str, list[dict]]] = {}
        self._free_pointer = None

        @StateCallbackType
        def _state_cb(state_type: int, result: int) -> None:
            logger.info("DLL State change: %s %s", state_type, result)
            if state_type == 2 and result == 4:
                with self._lock:
                    self._connected = True
                    logger.info("DLL market connected and authenticated")
                    for sym in list(self._desired_subs):
                        try:
                            if self._subscribe_ticker:
                                ret = self._subscribe_ticker(sym, "B")
                                logger.info("SubscribeTicker(%s,B) -> %s", sym, ret)
                            if self._subscribe_book:
                                ret_book = self._subscribe_book(sym, "B")
                                logger.info("SubscribePriceBook(%s,B) -> %s", sym, ret_book)
                            if self._subscribe_offer:
                                ret_offer = self._subscribe_offer(sym, "B")
                                logger.info("SubscribeOfferBook(%s,B) -> %s", sym, ret_offer)
                            if self._subscribe_offer:
                                ret_offer = self._subscribe_offer(sym, "B")
                                logger.info("SubscribeOfferBook(%s,B) -> %s", sym, ret_offer)
                        except Exception as exc:
                            logger.warning("SubscribeTicker error %s: %s", sym, exc)
                    try:
                        if hasattr(self, "_get_history_trades") and self._get_history_trades:
                            day = time.strftime("%d/%m/%Y", time.localtime())
                            ret = self._get_history_trades("ALL", "B", day, day)
                            logger.info("GetHistoryTrades recent -> %s", ret)
                    except Exception as exc:
                        logger.warning("GetHistory recent error: %s", exc)
            else:
                if state_type == 2 and result in (0, 1, 2):
                    with self._lock:
                        self._connected = False
                    if result == 1:
                        logger.info("DLL market connected but not authenticated")
                    elif result == 0:
                        logger.info("DLL market disconnected")
            return

        self._state_cb_fn = _state_cb

        @TradeCallbackType
        def _trade_cb(asset_ptr: ctypes.POINTER(TTradeAsset), date: str, trade_number: int, price: float, vol: float, qtd: int, *_args) -> None:
            try:
                asset = asset_ptr.contents
                symbol = _safe_wstring(getattr(asset, "ticker", None)).upper() or "UNKNOWN"
                quantity = int(qtd or 0)
                if self._on_trade:
                    self._on_trade(symbol, float(price), quantity, time.time())
                    logger.debug("DLL trade: %s %.4f %s", symbol, price, quantity)
            except Exception:
                pass

        self._trade_cb_fn = _trade_cb

        @HistoryTradeCallbackType
        def _history_cb(_asset_ptr: ctypes.POINTER(TTradeAsset), _date: str, *_args) -> None:
            return

        self._history_cb_fn = _history_cb

        @PriceBookCallbackV2Type
        def _price_book_cb_v2(asset: TBookAsset, n_action: int, n_position: int, side: int, n_qtd: int, n_count: int, price: float, p_array_sell: ctypes.c_void_p, p_array_buy: ctypes.c_void_p) -> None:
            try:
                symbol_raw = getattr(asset, "ticker", None)
                symbol = _safe_wstring(symbol_raw).upper() or "UNKNOWN"
                payload = {
                    "symbol": symbol,
                    "action": int(n_action),
                    "position": int(n_position) if n_position >= 0 else None,
                    "side": int(side),
                    "qty": int(n_qtd),
                    "count": int(n_count),
                    "price": float(price) if price else None,
                    "array_sell": int(p_array_sell or 0),
                    "array_buy": int(p_array_buy or 0),
                }
                if self._on_price_book:
                    self._on_price_book(symbol, payload)

                now = time.time()

                if symbol not in self._book_cache:
                    self._book_cache[symbol] = {"bids": [], "asks": []}

                if n_action == 4:
                    snapshot_payload = self._build_snapshot_payload(symbol, p_array_buy, p_array_sell)
                    if snapshot_payload:
                        self._book_cache[symbol]["bids"] = snapshot_payload["bids"].copy()
                        self._book_cache[symbol]["asks"] = snapshot_payload["asks"].copy()
                        self._last_snapshot_ts[symbol] = now
                        self._forward_snapshot(snapshot_payload)
                    return

                # Atualiza cache incremental
                cache = self._book_cache[symbol]
                if side == 1:
                    self._update_side_cache(cache, "asks", n_action, n_position, price, n_qtd, n_count)
                else:
                    self._update_side_cache(cache, "bids", n_action, n_position, price, n_qtd, n_count)

                last_ts = self._last_snapshot_ts.get(symbol, 0)
                if now - last_ts >= ORDER_BOOK_SNAPSHOT_INTERVAL_MS / 1000.0:
                    snapshot_payload = {
                        "symbol": symbol,
                        "bids": [dict(level) for level in cache["bids"]],
                        "asks": [dict(level) for level in cache["asks"]],
                    }
                    self._last_snapshot_ts[symbol] = now
                    self._forward_snapshot(snapshot_payload)

                # Envia evento incremental
                self._forward_event(symbol, n_action, side, n_position, price, n_qtd, n_count)

            except Exception as exc:
                logger.warning("PriceBook callback error: %s", exc)

        self._price_book_cb_v2_fn = _price_book_cb_v2

        @OfferBookCallbackV2Type
        def _offer_book_cb(asset: TBookAsset, n_action: int, n_position: int, side: int, n_qtd: int, n_agent: int, offer_id: int, price: float, has_price: int, has_qtd: int, has_date: int, has_offer_id: int, has_agent: int, date_str: ctypes.c_wchar_p, p_array_sell: ctypes.c_void_p, p_array_buy: ctypes.c_void_p) -> None:
            try:
                symbol = _safe_wstring(getattr(asset, "ticker", None) or getattr(asset, "Ticker", None)).upper() or "UNKNOWN"
                offers = self._decode_offer_arrays(side, p_array_sell, p_array_buy)
                if offers:
                    for idx, offer in enumerate(offers):
                        payload = {
                            "symbol": symbol,
                            "action": int(n_action),
                            "position": len(offers) - idx - 1,
                            "side": int(side),
                            "quantity": offer.get("quantity"),
                            "agent_id": offer.get("agent_id"),
                            "offer_id": offer.get("offer_id"),
                            "price": offer.get("price"),
                        }
                        self._forward_offer(payload)
                else:
                    payload = {
                        "symbol": symbol,
                        "action": int(n_action),
                        "position": int(n_position) if n_position >= 0 else None,
                        "side": int(side),
                        "quantity": int(n_qtd) if has_qtd else None,
                        "agent_id": int(n_agent) if has_agent else None,
                        "offer_id": int(offer_id) if has_offer_id else None,
                        "price": float(price) if has_price else None,
                    }
                    self._forward_offer(payload)
            except Exception as exc:
                logger.warning("OfferBook callback error: %s", exc)

        self._offer_book_cb_fn = _offer_book_cb

        @TradeCallbackV2Type
        def _trade_cb_v2(asset_id: TConnectorAssetIdentifier, p_trade: ctypes.c_size_t, flags: ctypes.c_uint) -> None:
            try:
                if not self._dll:
                    return
                symbol = asset_id.Ticker if asset_id.Ticker else "UNKNOWN"
                trade_struct = TConnectorTrade(Version=0)
                translate_fn = self._dll.TranslateTrade
                translate_fn.argtypes = [ctypes.c_size_t, ctypes.POINTER(TConnectorTrade)]
                translate_fn.restype = ctypes.c_int
                result = translate_fn(p_trade, ctypes.byref(trade_struct))
                if result == 0:
                    price_val = float(trade_struct.Price)
                    quantity = int(trade_struct.Quantity)
                    volume_financial = float(trade_struct.Volume)
                    buy_agent = int(trade_struct.BuyAgent) if trade_struct.BuyAgent else None
                    sell_agent = int(trade_struct.SellAgent) if trade_struct.SellAgent else None
                    trade_type = int(trade_struct.TradeType)
                    trade_number = int(trade_struct.TradeNumber)
                    is_edit = bool(flags & 1)
                    logger.info(
                        "TRADE RECEBIDO: %s, Preço: %s, Quant: %s, TradeNumber: %s, BuyAgent: %s, SellAgent: %s, TradeType: %s, VolumeFinancial: %.2f, IsEdit: %s",
                        symbol,
                        price_val,
                        quantity,
                        trade_number,
                        buy_agent,
                        sell_agent,
                        trade_type,
                        volume_financial,
                        is_edit,
                    )
                    if self._on_trade:
                        self._on_trade(
                            symbol,
                            price_val,
                            quantity,
                            time.time(),
                            {
                                "buy_agent": buy_agent,
                                "sell_agent": sell_agent,
                                "trade_type": trade_type,
                                "volume_financial": volume_financial,
                                "is_edit": is_edit,
                                "trade_id": trade_number,
                            },
                        )
                else:
                    logger.warning("TranslateTrade falhou com código: %s", result)
            except Exception as exc:
                logger.error("Error in _trade_cb_v2: %s", exc)

        self._trade_cb_v2_fn = _trade_cb_v2

    def _forward_event(self, symbol: str, action: int, side: int, position: int | None, price: float | None, qty: int | None, count: int | None) -> None:
        payload = {
            "symbol": symbol,
            "timestamp": time.time(),
            "action": action,
            "side": side,
            "position": position,
            "price": price,
            "quantity": qty,
            "offer_count": count,
        }
        try:
            requests.post(
                "http://127.0.0.1:8002/ingest/order-book-event",
                json=payload,
                timeout=2.0,
            )
        except Exception as exc:
            logger.warning("Falha ao enviar evento de book para HF: %s", exc)

    def _forward_snapshot(self, payload: dict) -> None:
        payload = dict(payload)
        payload["timestamp"] = time.time()
        try:
            requests.post(
                "http://127.0.0.1:8002/ingest/order-book-snapshot",
                json=payload,
                timeout=4.0,
            )
        except Exception as exc:
            logger.warning("Falha ao enviar snapshot de book para HF: %s", exc)

    def _forward_offer(self, payload: dict) -> None:
        data = dict(payload)
        data["timestamp"] = time.time()
        try:
            requests.post(
                "http://127.0.0.1:8002/ingest/order-book-offer",
                json=data,
                timeout=2.0,
            )
        except Exception as exc:
            logger.warning("Falha ao enviar oferta de book para HF: %s", exc)

    def _build_snapshot_payload(self, symbol: str, p_array_buy: ctypes.c_void_p, p_array_sell: ctypes.c_void_p) -> Optional[dict]:
        bids = self._decode_price_array(p_array_buy)
        asks = self._decode_price_array(p_array_sell)
        if bids is None and asks is None:
            return None
        return {
            "symbol": symbol,
            "bids": bids or [],
            "asks": asks or [],
        }

    def _decode_price_array(self, ptr_value: ctypes.c_void_p) -> Optional[list]:
        if not ptr_value:
            return []
        try:
            header = (ctypes.c_ubyte * 8).from_address(ptr_value)
            count = int.from_bytes(bytes(header[:4]), "little", signed=False)
            total_size = int.from_bytes(bytes(header[4:8]), "little", signed=False)
            levels = []
            offset = 8
            for _ in range(count):
                price_bytes = (ctypes.c_ubyte * 8).from_address(ptr_value + offset)
                price = struct.unpack("<d", bytes(price_bytes))[0]
                offset += 8
                qty_bytes = (ctypes.c_ubyte * 8).from_address(ptr_value + offset)
                quantity = struct.unpack("<q", bytes(qty_bytes))[0]
                offset += 8
                count_bytes = (ctypes.c_ubyte * 4).from_address(ptr_value + offset)
                offer_count = struct.unpack("<i", bytes(count_bytes))[0]
                offset += 4
                levels.append(
                    {
                        "price": price,
                        "quantity": quantity,
                        "offer_count": offer_count,
                    }
                )
            return levels
        except Exception as exc:
            logger.warning("Falha ao decodificar array de book: %s", exc)
            return []

    def _decode_offer_arrays(self, side: int, ptr_sell: ctypes.c_void_p, ptr_buy: ctypes.c_void_p) -> list[dict]:
        bids = self._decode_offer_array(ptr_buy)
        asks = self._decode_offer_array(ptr_sell)
        if side == 0:
            return bids
        if side == 1:
            return asks
        # se lado desconhecido, retorna combinação para garantir que não perca dados
        return bids or asks

    def _decode_offer_array(self, ptr_value: ctypes.c_void_p) -> list[dict]:
        if not ptr_value:
            return []
        if not self._free_pointer:
            logger.debug("FreePointer não disponível para liberar array de ofertas")
            return []

        result: list[dict] = []
        ptr_int = int(ptr_value)

        try:
            header = (ctypes.c_ubyte * 8).from_address(ptr_int)
            count = int.from_bytes(bytes(header[:4]), "little", signed=False)
            total_size = int.from_bytes(bytes(header[4:8]), "little", signed=False)

            offset = 8
            for _ in range(count):
                price_bytes = (ctypes.c_ubyte * 8).from_address(ptr_int + offset)
                price = struct.unpack("<d", bytes(price_bytes))[0]
                offset += 8

                qty_bytes = (ctypes.c_ubyte * 8).from_address(ptr_int + offset)
                quantity = struct.unpack("<q", bytes(qty_bytes))[0]
                offset += 8

                agent_bytes = (ctypes.c_ubyte * 4).from_address(ptr_int + offset)
                agent_id = struct.unpack("<i", bytes(agent_bytes))[0]
                offset += 4

                offer_id_bytes = (ctypes.c_ubyte * 8).from_address(ptr_int + offset)
                offer_id = struct.unpack("<q", bytes(offer_id_bytes))[0]
                offset += 8

                length_bytes = (ctypes.c_ubyte * 2).from_address(ptr_int + offset)
                length = struct.unpack("<H", bytes(length_bytes))[0]
                offset += 2

                if length > 0:
                    offset += length

                result.append(
                    {
                        "price": float(price),
                        "quantity": int(quantity),
                        "agent_id": int(agent_id),
                        "offer_id": int(offer_id),
                    }
                )

            # flags finais (ex: OB_LAST_PACKET)
            offset += 4
            self._free_pointer(ctypes.c_void_p(ptr_int), total_size)
        except Exception as exc:
            logger.warning("Falha ao decodificar array de ofertas: %s", exc)
        return result

    def _update_side_cache(self, cache: Dict[str, list], side_key: str, action: int, position: int, price: float, qty: int, count: int) -> None:
        side = cache.get(side_key)
        if side is None:
            side = []
            cache[side_key] = side

        def clamp_index(idx: int) -> int:
            if idx < 0:
                return 0
            if idx > len(side):
                return len(side)
            return idx

        if action == 1:  # add
            idx = clamp_index(len(side) - position)
            entry = {"price": price, "quantity": qty, "offer_count": count}
            side.insert(idx, entry)
        elif action == 2:  # edit
            idx = len(side) - position - 1
            if 0 <= idx < len(side):
                level = side[idx]
                level["quantity"] = qty
                level["offer_count"] = count
                level["price"] = price or level["price"]
        elif action == 3:  # delete
            idx = len(side) - position - 1
            if 0 <= idx < len(side):
                side.pop(idx)
        elif action == 5:  # delete_from
            idx = len(side) - position - 1
            if 0 <= idx < len(side):
                del side[idx:]

    def set_trade_callback(self, callback: Callable[[str, float, int, float], None]) -> None:
        self._on_trade = callback

    def set_price_book_callback(self, callback: Callable[[str, dict], None]) -> None:
        self._on_price_book = callback

    def _resolve_dll_path(self) -> Path:
        candidates = [
            Path(__file__).resolve().parents[2] / "Dll_Profit" / "bin" / "Win64" / "Example" / "ProfitDLL64.dll",
            Path(__file__).resolve().parents[2] / "Dll_Profit" / "DLLs" / "Win64" / "ProfitDLL.dll",
            Path(__file__).resolve().parent / "ProfitDLL64.dll",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        raise RuntimeError("Profit DLL não encontrada. Coloque ProfitDLL64.dll em Dll_Profit/bin/Win64/Example ou Dll_Profit/DLLs/Win64.")

    def initialize(self) -> None:
        with self._lock:
            if self._initialized:
                return
            _try_load_envfile(Path(__file__).resolve().parents[2] / "Dll_Profit" / ".env")
            activation = os.getenv("ACTIVATION_CODE", "")
            login = os.getenv("login", "")
            password = os.getenv("password", "")
            init_mode = os.getenv("PROFIT_INIT_MODE", "market").lower()
            logger.info("Profit credentials: activation=%s login=%s mode=%s", activation[:4] + "***", (login or "")[:3] + "***", init_mode)
            if not activation or not login or not password:
                raise RuntimeError("Variáveis de ambiente ACTIVATION_CODE/login/password não definidas (Dll_Profit/.env)")
            dll_path = self._resolve_dll_path()
            dll = ctypes.WinDLL(str(dll_path))
            self._dll = dll
            if hasattr(dll, "FreePointer"):
                free_ptr = dll.FreePointer
                free_ptr.argtypes = [ctypes.c_void_p, ctypes.c_int]
                free_ptr.restype = ctypes.c_int
                self._free_pointer = free_ptr
            if hasattr(dll, "SubscribeTicker"):
                self._subscribe_ticker = dll.SubscribeTicker
                self._subscribe_ticker.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
                self._subscribe_ticker.restype = ctypes.c_int
            if hasattr(dll, "UnsubscribeTicker"):
                self._unsubscribe_ticker = dll.UnsubscribeTicker
                self._unsubscribe_ticker.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
                self._unsubscribe_ticker.restype = ctypes.c_int
            if hasattr(dll, "SubscribePriceBook"):
                self._subscribe_book = dll.SubscribePriceBook
                self._subscribe_book.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
                self._subscribe_book.restype = ctypes.c_int
            if hasattr(dll, "UnsubscribePriceBook"):
                self._unsubscribe_book = dll.UnsubscribePriceBook
                self._unsubscribe_book.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
                self._unsubscribe_book.restype = ctypes.c_int
            if hasattr(dll, "SubscribeOfferBook"):
                self._subscribe_offer = dll.SubscribeOfferBook
                self._subscribe_offer.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
                self._subscribe_offer.restype = ctypes.c_int
            if hasattr(dll, "UnsubscribeOfferBook"):
                self._unsubscribe_offer = dll.UnsubscribeOfferBook
                self._unsubscribe_offer.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
                self._unsubscribe_offer.restype = ctypes.c_int
            if init_mode == "login" and hasattr(dll, "DLLInitializeLogin"):
                login_fn = dll.DLLInitializeLogin
                login_fn.argtypes = [
                    ctypes.c_wchar_p,
                    ctypes.c_wchar_p,
                    ctypes.c_wchar_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                ]
                login_fn.restype = ctypes.c_int
                ret = login_fn(
                    activation,
                    login,
                    password,
                    ctypes.cast(self._state_cb_fn, ctypes.c_void_p),
                    None,
                    None,
                    ctypes.cast(self._price_book_cb_v2_fn, ctypes.c_void_p),
                    ctypes.cast(self._offer_book_cb_fn, ctypes.c_void_p),
                    None,
                    None,
                    None,
                    None,
                    None,
                )
            else:
                if not hasattr(dll, "DLLInitializeMarketLogin"):
                    raise RuntimeError("DLLInitializeMarketLogin não encontrado na DLL")
                login_fn = dll.DLLInitializeMarketLogin
                login_fn.argtypes = [
                    ctypes.c_wchar_p,
                    ctypes.c_wchar_p,
                    ctypes.c_wchar_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                ]
                login_fn.restype = ctypes.c_int
                ret = login_fn(
                    activation,
                    login,
                    password,
                    ctypes.cast(self._state_cb_fn, ctypes.c_void_p),
                    ctypes.cast(self._trade_cb_fn, ctypes.c_void_p),
                    None,
                    ctypes.cast(self._price_book_cb_v2_fn, ctypes.c_void_p),
                    ctypes.cast(self._offer_book_cb_fn, ctypes.c_void_p),
                    None,
                    None,
                    None,
                )
            logger.info("DLLInitialize -> %s", ret)
            if ret != 0:
                raise RuntimeError(f"DLLInitialize falhou: code={ret}")
            def _name_of(code: int) -> str:
                if code == 0:
                    return "NL_OK"
                if code == -2147483646:
                    return "NL_NOT_INITIALIZED"
                if code == -2147483647:
                    return "NL_INTERNAL_ERROR"
                return str(code)
            try:
                if hasattr(dll, "SetStateCallback"):
                    set_state = dll.SetStateCallback
                    set_state.argtypes = [StateCallbackType]
                    set_state.restype = ctypes.c_int
                    rc = set_state(self._state_cb_fn)
                    logger.info("SetStateCallback -> %s (%s)", rc, _name_of(rc))
            except Exception as exc:
                logger.warning("SetStateCallback registration error: %s", exc)
            try:
                if hasattr(dll, "SetTradeCallbackV2"):
                    set_trade_v2 = dll.SetTradeCallbackV2
                    set_trade_v2.argtypes = [TradeCallbackV2Type]
                    set_trade_v2.restype = ctypes.c_int
                    rc = set_trade_v2(self._trade_cb_v2_fn)
                    logger.info("SetTradeCallbackV2 -> %s (%s)", rc, _name_of(rc))
                elif hasattr(dll, "SetTradeCallback"):
                    set_trade = dll.SetTradeCallback
                    set_trade.argtypes = [TradeCallbackType]
                    set_trade.restype = ctypes.c_int
                    rc = set_trade(self._trade_cb_fn)
                    logger.info("SetTradeCallback -> %s (%s)", rc, _name_of(rc))
            except Exception as exc:
                logger.warning("SetTradeCallback registration error: %s", exc)
            try:
                if hasattr(dll, "SetPriceBookCallbackV2"):
                    set_book = dll.SetPriceBookCallbackV2
                    set_book.argtypes = [PriceBookCallbackV2Type]
                    set_book.restype = ctypes.c_int
                    rc = set_book(self._price_book_cb_v2_fn)
                    logger.info("SetPriceBookCallbackV2 -> %s (%s)", rc, _name_of(rc))
            except Exception as exc:
                logger.warning("SetPriceBookCallback registration error: %s", exc)
            try:
                if hasattr(dll, "SetOfferBookCallbackV2"):
                    set_offer = dll.SetOfferBookCallbackV2
                    set_offer.argtypes = [OfferBookCallbackV2Type]
                    set_offer.restype = ctypes.c_int
                    rc = set_offer(self._offer_book_cb_fn)
                    logger.info("SetOfferBookCallbackV2 -> %s (%s)", rc, _name_of(rc))
            except Exception as exc:
                logger.warning("SetOfferBookCallback registration error: %s", exc)
            try:
                if hasattr(dll, "SetHistoryTradeCallback"):
                    set_hist = dll.SetHistoryTradeCallback
                    set_hist.argtypes = [HistoryTradeCallbackType]
                    set_hist.restype = ctypes.c_int
                    rc = set_hist(self._history_cb_fn)
                    logger.info("SetHistoryTradeCallback -> %s (%s)", rc, _name_of(rc))
            except Exception as exc:
                logger.warning("SetHistoryTradeCallback registration error: %s", exc)
            self._initialized = True

    def subscribe(self, symbol: str, exchange: str = "B") -> None:
        with self._lock:
            self._desired_subs.add(symbol.upper())
        if not self._initialized:
            self.initialize()
        with self._lock:
            connected = self._connected
        if connected and self._subscribe_ticker:
            ret = self._subscribe_ticker(symbol, exchange)
            logger.info("SubscribeTicker(%s,%s) -> %s", symbol, exchange, ret)
        if connected and self._subscribe_book:
            ret_book = self._subscribe_book(symbol, exchange)
            logger.info("SubscribePriceBook(%s,%s) -> %s", symbol, exchange, ret_book)
        if connected and self._subscribe_offer:
            ret_offer = self._subscribe_offer(symbol, exchange)
            logger.info("SubscribeOfferBook(%s,%s) -> %s", symbol, exchange, ret_offer)

    def unsubscribe(self, symbol: str) -> None:
        with self._lock:
            self._desired_subs.discard(symbol.upper())
        if self._unsubscribe_ticker:
            try:
                ret = self._unsubscribe_ticker(symbol, "B")
                logger.info("UnsubscribeTicker(%s,B) -> %s", symbol, ret)
            except Exception as exc:
                logger.warning("UnsubscribeTicker error %s: %s", symbol, exc)
        if self._unsubscribe_book:
            try:
                ret_book = self._unsubscribe_book(symbol, "B")
                logger.info("UnsubscribePriceBook(%s,B) -> %s", symbol, ret_book)
            except Exception as exc:
                logger.warning("UnsubscribePriceBook error %s: %s", symbol, exc)
        if self._unsubscribe_offer:
            try:
                ret_offer = self._unsubscribe_offer(symbol, "B")
                logger.info("UnsubscribeOfferBook(%s,B) -> %s", symbol, ret_offer)
            except Exception as exc:
                logger.warning("UnsubscribeOfferBook error %s: %s", symbol, exc)


def _safe_wstring(value) -> str:
    """Converte ponteiros/strings WideChar para str segura."""
    try:
        if not value:
            return ""
        if isinstance(value, str):
            return value
        return ctypes.wstring_at(value)
    except Exception:
        return ""
