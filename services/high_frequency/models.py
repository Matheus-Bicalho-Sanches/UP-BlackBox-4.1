"""
Modelos de dados para o High Frequency Backend
"""
from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime


@dataclass
class Tick:
    """Representa um tick de mercado com dados detalhados de trade."""
    symbol: str
    exchange: str
    price: float
    volume: int
    timestamp: float
    trade_id: Optional[int] = None
    # Campos para dados detalhados de trade
    buy_agent: Optional[int] = None
    sell_agent: Optional[int] = None
    trade_type: Optional[int] = None  # 2=Comprador, 3=Vendedor
    volume_financial: Optional[float] = None
    is_edit: bool = False
    
    def to_dict(self):
        """Converte o tick para dicionário."""
        return {
            'symbol': self.symbol,
            'exchange': self.exchange,
            'price': self.price,
            'volume': self.volume,
            'timestamp': self.timestamp,
            'trade_id': self.trade_id,
            'buy_agent': self.buy_agent,
            'sell_agent': self.sell_agent,
            'trade_type': self.trade_type,
            'volume_financial': self.volume_financial,
            'is_edit': self.is_edit
        }


@dataclass
class Subscription:
    """Representa uma assinatura ativa."""
    symbol: str
    exchange: str
    subscribed_at: float
    status: str


@dataclass
class SystemStatus:
    """Status do sistema."""
    active_subscriptions: int
    buffer_size: int
    total_ticks_processed: int
    uptime_seconds: float


@dataclass
class TickerMetrics:
    """Métricas por ticker."""
    symbol: str
    total_ticks: int
    last_tick_time: float
    last_price: float
    gaps_detected: int


@dataclass
class OrderBookLevel:
    price: float
    quantity: int
    offer_count: int
    agent_id: Optional[int] = None


@dataclass
class OrderBookSnapshot:
    symbol: str
    timestamp: datetime
    bids: List[OrderBookLevel]
    asks: List[OrderBookLevel]
    sequence: Optional[int] = None
    source_event: Optional[dict] = None


@dataclass
class OrderBookEvent:
    symbol: str
    timestamp: datetime
    action: int
    side: int
    position: Optional[int]
    price: Optional[float]
    quantity: Optional[int]
    offer_count: Optional[int] = None
    agent_id: Optional[int] = None
    sequence: Optional[int] = None
    raw_payload: Optional[dict] = None


@dataclass
class OrderBookOffer:
    symbol: str
    timestamp: datetime
    action: int
    side: int
    position: Optional[int]
    price: Optional[float]
    quantity: Optional[int]
    agent_id: Optional[int]
    offer_id: Optional[int]
    flags: Optional[int] = None
