"""
Modelos de dados para o High Frequency Backend
"""
from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass
class Tick:
    """Representa um tick de mercado."""
    symbol: str
    exchange: str
    price: float
    volume: int
    timestamp: float
    trade_id: Optional[int] = None
    buyer_maker: Optional[bool] = None
    sequence: int = 0
    
    def to_dict(self):
        """Converte o tick para dicionário."""
        return {
            'symbol': self.symbol,
            'exchange': self.exchange,
            'price': self.price,
            'volume': self.volume,
            'timestamp': self.timestamp,
            'trade_id': self.trade_id,
            'buyer_maker': self.buyer_maker,
            'sequence': self.sequence
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
