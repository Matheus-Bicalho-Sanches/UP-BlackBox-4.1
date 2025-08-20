import threading
import time
from collections import deque
from typing import Deque, Dict, List, Optional

class TickItem:
	__slots__ = ("symbol", "exchange", "price", "volume", "timestamp", "trade_id", "buyer_maker")
	def __init__(self, symbol: str, exchange: str, price: float, volume: int, timestamp: float, trade_id: int | None, buyer_maker: bool | None):
		self.symbol = symbol
		self.exchange = exchange
		self.price = float(price)
		self.volume = int(volume)
		self.timestamp = float(timestamp)
		self.trade_id = trade_id
		self.buyer_maker = buyer_maker

class TickBuffer:
	def __init__(self, maxlen: int = 200_000):
		self._q: Deque[TickItem] = deque(maxlen=maxlen)
		self._lock = threading.Lock()

	def push(self, item: TickItem) -> None:
		with self._lock:
			self._q.append(item)

	def drain_batch(self, max_items: int) -> List[TickItem]:
		batch: List[TickItem] = []
		with self._lock:
			while self._q and len(batch) < max_items:
				batch.append(self._q.popleft())
		return batch

	def size(self) -> int:
		with self._lock:
			return len(self._q)
