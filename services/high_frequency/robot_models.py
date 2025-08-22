from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List
from enum import Enum

class PatternType(str, Enum):
    TWAP = "TWAP"
    VWAP = "VWAP"
    UNKNOWN = "UNKNOWN"

class TradeType(int, Enum):
    BUY = 2
    SELL = 3

class RobotStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPICIOUS = "suspicious"

@dataclass
class TickData:
    """Dados de um tick para análise"""
    symbol: str
    price: float
    volume: int
    timestamp: datetime
    trade_type: TradeType
    agent_id: int
    exchange: str

@dataclass
class TWAPPattern:
    """Padrão TWAP detectado"""
    symbol: str
    exchange: str
    agent_id: int
    first_seen: datetime
    last_seen: datetime
    total_volume: int
    total_trades: int
    avg_trade_size: float
    frequency_minutes: float
    price_aggression: float
    confidence_score: float
    status: RobotStatus

@dataclass
class RobotTrade:
    """Trade individual de um robô"""
    symbol: str
    price: float
    volume: int
    timestamp: datetime
    trade_type: TradeType
    agent_id: int
    exchange: str
    robot_pattern_id: Optional[int] = None

@dataclass
class TWAPDetectionConfig:
    """Configuração para detecção TWAP"""
    # Janela de análise (24h em minutos)
    analysis_window_minutes: int = 1440
    
    # Mínimo de trades para considerar um padrão
    min_trades: int = 10
    
    # Mínimo de volume total
    min_total_volume: int = 100000
    
    # Máximo de variação de preço permitida (em %)
    max_price_variation: float = 5.0
    
    # Frequência mínima entre trades (em minutos)
    min_frequency_minutes: float = 1.0
    
    # Frequência máxima entre trades (em minutos)
    max_frequency_minutes: float = 30.0
    
    # Confiança mínima para considerar um padrão válido
    min_confidence: float = 0.6
