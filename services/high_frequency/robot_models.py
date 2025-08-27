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
    pattern_type: str = "TWAP"  # Tipo do padrão (TWAP, VWAP, etc.)
    agent_id: int = 0
    first_seen: datetime = None
    last_seen: datetime = None
    total_volume: int = 0
    total_trades: int = 0
    avg_trade_size: float = 0.0
    frequency_minutes: float = 0.0
    price_aggression: float = 0.0
    confidence_score: float = 0.0
    status: RobotStatus = RobotStatus.INACTIVE
    market_volume_percentage: float = 0.0  # ✅ NOVO: Volume em % do mercado
    
    def __post_init__(self):
        """Validação pós-inicialização"""
        if self.first_seen is None:
            self.first_seen = datetime.now()
        if self.last_seen is None:
            self.last_seen = datetime.now()

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
    """Configuração para detecção TWAP - AJUSTADA PARA MERCADO BRASILEIRO"""
    # Janela de análise (24h em minutos)
    analysis_window_minutes: int = 1440
    
    # Mínimo de trades para considerar um padrão
    min_trades: int = 5  # Reduzido de 10 para 5
    
    # Mínimo de volume total (ajustado para mercado brasileiro)
    min_total_volume: int = 1000  # Reduzido de 5000 para 1000
    
    # Máximo de variação de preço permitida (em %)
    max_price_variation: float = 15.0  # Aumentado de 5.0 para 15.0
    
    # Frequência mínima entre trades (em minutos) - AJUSTADO!
    min_frequency_minutes: float = 0.001  # Reduzido de 0.01 para 0.001 (0.06 segundos)
    
    # Frequência máxima entre trades (em minutos) - AJUSTADO!
    max_frequency_minutes: float = 120.0  # Aumentado de 30.0 para 120.0 (2 horas)
    
    # Confiança mínima para considerar um padrão válido
    min_confidence: float = 0.4  # Reduzido de 0.6 para 0.4

    # ✅ NOVO: Janela de recência para considerar um robô realmente ativo
    # Se o último trade do agente for mais antigo que este valor, marca como INACTIVE
    active_recency_minutes: float = 15.0
