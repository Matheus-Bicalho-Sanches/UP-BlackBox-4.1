"""Wrapper simplificado da ProfitDLL para consumo pelo backend high_frequency.

Reusa a implementação comprovada em `services.market_feed_next.dll.ProfitDLL` e
expõe uma interface enxuta para trades e order book.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional, Dict, Any
import ctypes
import struct
import threading
from datetime import datetime, timezone

from services.high_frequency.config import (
    ORDER_BOOK_TOP_LEVELS,
    ORDER_BOOK_SNAPSHOT_INTERVAL_MS,
)
from services.high_frequency.models import OrderBookLevel, OrderBookSnapshot, OrderBookEvent
from services.high_frequency.buffer import enqueue_order_book_event, enqueue_order_book_snapshot

from services.market_feed_next.dll import ProfitDLL as BaseProfitDLL


OrderBookCallback = Callable[[str, Dict[str, Any]], None]
TradeCallback = Callable[[str, float, int, float, Dict[str, Any]], None]


@dataclass
class ProfitConnectionConfig:
    auto_reconnect: bool = True


class HFProfitClient:
    """Adapter que expõe apenas o necessário para o serviço de alta frequência."""

    def __init__(self, config: ProfitConnectionConfig | None = None):
        self._config = config or ProfitConnectionConfig()
        self._dll: Optional[BaseProfitDLL] = None
        self._trade_cb: Optional[TradeCallback] = None
        self._price_book_cb: Optional[OrderBookCallback] = None
        self._snapshot_cb: Optional[OrderBookCallback] = None
        self._connected = False
        self._last_snapshot: Dict[str, datetime] = {}
        self._book_state: Dict[str, Dict[str, list[OrderBookLevel]]] = {}
        self._lock = threading.Lock()
        self._free_pointer = None

    def initialize(self) -> None:
        if self._dll:
            return
        dll = BaseProfitDLL()
        dll.set_trade_callback(self._on_trade)
        dll.set_price_book_callback(self._on_price_book)
        self._dll = dll
        if hasattr(dll, "_dll") and dll._dll is not None and hasattr(dll._dll, "FreePointer"):
            free_pointer = dll._dll.FreePointer
            free_pointer.argtypes = [ctypes.c_void_p, ctypes.c_int]
            free_pointer.restype = ctypes.c_int
            self._free_pointer = free_pointer
        dll.initialize()
        self._connected = True

    def shutdown(self) -> None:
        if self._dll:
            self._dll.stop()
        self._connected = False

    def subscribe(self, symbol: str, exchange: str = "B") -> None:
        if not self._dll:
            raise RuntimeError("DLL not initialized")
        self._dll.subscribe(symbol, exchange)

    def unsubscribe(self, symbol: str, exchange: str = "B") -> None:
        if not self._dll:
            return
        self._dll.unsubscribe(symbol, exchange)

    def set_trade_callback(self, cb: TradeCallback) -> None:
        self._trade_cb = cb

    def set_price_book_callback(self, cb: OrderBookCallback) -> None:
        self._price_book_cb = cb

    def set_snapshot_callback(self, cb: OrderBookCallback) -> None:
        self._snapshot_cb = cb

    # Callbacks repassados pela DLL base ---------------------------------

    def _on_trade(self, symbol: str, price: float, quantity: int, timestamp: float, extra: Dict[str, Any]) -> None:
        if self._trade_cb:
            self._trade_cb(symbol, price, quantity, timestamp, extra)

    def _on_price_book(self, symbol: str, payload: Dict[str, Any]) -> None:
        if not self._price_book_cb:
            return

        event_time = datetime.now(timezone.utc)
        action = payload["action"]
        side = payload["side"]
        position = payload["position"]
        price = payload["price"]
        qty = payload["qty"]
        count = payload.get("count", 0)
        array_sell = payload.get("array_sell") or 0
        array_buy = payload.get("array_buy") or 0

        with self._lock:
            state = self._book_state.setdefault(symbol, {"bids": [], "asks": []})

            if action == 4:  # snapshot completo
                bids, asks = self._decode_arrays(array_buy, array_sell)
                state["bids"] = bids
                state["asks"] = asks
                self._emit_snapshot(symbol, event_time, bids, asks)
                self._emit_event(symbol, event_time, action, side, position, price, qty, count, array_buy, array_sell)
                return

            levels = state["bids"] if side == 0 else state["asks"]

            if action == 0:  # atAdd
                self._handle_add(levels, position, price, qty, count)
            elif action == 1:  # atEdit
                self._handle_edit(levels, position, qty, count, price)
            elif action == 2:  # atDelete
                self._handle_delete(levels, position)
            elif action == 3:  # atDeleteFrom
                self._handle_delete_from(levels, position)
            else:
                # desconhecido, ignora
                return

            # Emite evento incremental
            self._emit_event(symbol, event_time, action, side, position, price, qty, count, array_buy, array_sell)

            # Checa se precisamos emitir snapshot periódico
            last_snapshot = self._last_snapshot.get(symbol)
            if not last_snapshot or (event_time - last_snapshot).total_seconds() * 1000 >= ORDER_BOOK_SNAPSHOT_INTERVAL_MS:
                bids_sorted = sorted(state["bids"], key=lambda lvl: lvl.price, reverse=True)[:ORDER_BOOK_TOP_LEVELS]
                asks_sorted = sorted(state["asks"], key=lambda lvl: lvl.price)[:ORDER_BOOK_TOP_LEVELS]
                self._emit_snapshot(symbol, event_time, bids_sorted, asks_sorted)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _decode_arrays(self, ptr_buy: int, ptr_sell: int) -> tuple[list[OrderBookLevel], list[OrderBookLevel]]:
        bids = self._decode_array(ptr_buy)
        asks = self._decode_array(ptr_sell)
        return bids, asks

    def _decode_array(self, ptr_value: int) -> list[OrderBookLevel]:
        if not ptr_value:
            return []
        if not self._free_pointer:
            raise RuntimeError("FreePointer não disponível; impossível liberar memória do callback")

        result: list[OrderBookLevel] = []
        ptr = ctypes.c_void_p(ptr_value)

        # Cabeçalho: qtd (4 bytes) + size (4 bytes)
        header = (ctypes.c_ubyte * 8).from_address(ptr_value)
        count = int.from_bytes(bytes(header[:4]), "little", signed=False)
        total_size = int.from_bytes(bytes(header[4:8]), "little", signed=False)

        offset = 8
        for _ in range(count):
            # price (8 bytes)
            price_bytes = (ctypes.c_ubyte * 8).from_address(ptr_value + offset)
            price = struct.unpack("<d", bytes(price_bytes))[0]
            offset += 8

            # quantity (8 bytes para V2)
            qty_bytes = (ctypes.c_ubyte * 8).from_address(ptr_value + offset)
            quantity = struct.unpack("<q", bytes(qty_bytes))[0]
            offset += 8

            # count (4 bytes)
            count_bytes = (ctypes.c_ubyte * 4).from_address(ptr_value + offset)
            offer_count = struct.unpack("<i", bytes(count_bytes))[0]
            offset += 4

            result.append(
                OrderBookLevel(
                    price=float(price),
                    quantity=int(quantity),
                    offer_count=int(offer_count),
                )
            )

        # Libera memória alocada pela DLL
        self._free_pointer(ptr, total_size)
        return result

    def _handle_add(self, levels: list[OrderBookLevel], position: int, price: float, qty: int, count: int) -> None:
        idx = len(levels) - position
        if idx < 0:
            idx = 0
        if idx > len(levels):
            idx = len(levels)
        levels.insert(idx, OrderBookLevel(price=price, quantity=qty, offer_count=count))

    def _handle_edit(self, levels: list[OrderBookLevel], position: int, qty: int, count: int, price: float) -> None:
        idx = len(levels) - position - 1
        if 0 <= idx < len(levels):
            level = levels[idx]
            level.quantity = qty
            level.offer_count = count
            level.price = price or level.price

    def _handle_delete(self, levels: list[OrderBookLevel], position: int) -> None:
        idx = len(levels) - position - 1
        if 0 <= idx < len(levels):
            levels.pop(idx)

    def _handle_delete_from(self, levels: list[OrderBookLevel], position: int) -> None:
        idx = len(levels) - position - 1
        if 0 <= idx < len(levels):
            del levels[idx:]

    def _emit_event(
        self,
        symbol: str,
        event_time: datetime,
        action: int,
        side: int,
        position: int,
        price: float,
        qty: int,
        count: int,
        raw_buy_ptr: int,
        raw_sell_ptr: int,
    ) -> None:
        event = OrderBookEvent(
            symbol=symbol,
            timestamp=event_time,
            action=action,
            side=side,
            position=position,
            price=price,
            quantity=qty,
            offer_count=count,
            raw_payload={
                "raw_buy_ptr": raw_buy_ptr,
                "raw_sell_ptr": raw_sell_ptr,
            },
        )
        enqueue_order_book_event(event)
        if self._price_book_cb:
            self._price_book_cb(symbol, {"event": event})

    def _emit_snapshot(
        self,
        symbol: str,
        event_time: datetime,
        bids: list[OrderBookLevel],
        asks: list[OrderBookLevel],
    ) -> None:
        snapshot = OrderBookSnapshot(
            symbol=symbol,
            timestamp=event_time,
            bids=bids,
            asks=asks,
            sequence=None,
        )
        enqueue_order_book_snapshot(snapshot)
        if self._snapshot_cb:
            self._snapshot_cb(symbol, {"snapshot": snapshot})
        self._last_snapshot[symbol] = event_time


