"""
Detector TWAP à Mercado
======================
Detecta padrões de robôs que enviam ordens de volume fixo à mercado
com intervalos regulares, em meio a outros trades da mesma corretora.
"""

import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import statistics
import math

# Corrige imports para funcionar como módulo standalone
try:
    from .robot_models import (
        TWAPPattern, RobotTrade, TradeType, RobotStatus, 
        TickData, RobotType
    )
    from .robot_persistence import RobotPersistence
    from .agent_mapping import get_agent_name
except ImportError:
    from robot_models import (
        TWAPPattern, RobotTrade, TradeType, RobotStatus, 
        TickData, RobotType
    )
    from robot_persistence import RobotPersistence
    from agent_mapping import get_agent_name

logger = logging.getLogger(__name__)

class MarketTWAPConfig:
    """Configuração para detecção de TWAP à Mercado"""
    
    def __init__(self):
        # Volume
        self.volume_tolerance_percent = 2.0      # 2% de tolerância no volume
        self.min_volume_repetitions = 8          # Mínimo de repetições do mesmo volume
        self.min_volume_frequency = 0.6          # 60% dos trades devem ter o mesmo volume
        
        # Tempo
        self.max_interval_minutes = 5.0          # Máximo 5 minutos entre trades
        self.time_consistency_threshold = 0.75   # 75% consistência temporal
        self.min_time_intervals = 5              # Mínimo de 5 intervalos para analisar
        
        # Direção
        self.min_direction_consistency = 0.9     # 90% consistência direcional
        
        # Confiança
        self.min_confidence = 0.75               # 75% confiança mínima
        
        # Análise de mercado
        self.market_price_tolerance = 0.01       # 1% de tolerância para preço de mercado

class MarketTWAPDetector:
    """Detector de padrões TWAP à Mercado"""
    
    def __init__(self, config: MarketTWAPConfig = None):
        self.config = config or MarketTWAPConfig()
        self.persistence = RobotPersistence()
        self.detected_patterns: List[TWAPPattern] = []
        
    async def detect_market_twap_patterns(self, trades: List[TickData]) -> List[TWAPPattern]:
        """
        Detecta padrões TWAP à Mercado em uma lista de trades
        
        Args:
            trades: Lista de trades para analisar
            
        Returns:
            Lista de padrões detectados
        """
        if not trades:
            return []
            
        logger.info(f"🔍 Analisando {len(trades)} trades para padrões TWAP à Mercado")
        
        # Agrupa trades por agente e símbolo
        grouped_trades = self._group_trades_by_agent_symbol(trades)
        
        patterns = []
        
        for (agent_id, symbol), agent_trades in grouped_trades.items():
            logger.debug(f"Analisando {len(agent_trades)} trades para agente {agent_id} em {symbol}")
            
            # Detecta padrões separadamente para compra e venda
            buy_patterns = await self._detect_direction_patterns(
                agent_trades, agent_id, symbol, TradeType.BUY
            )
            sell_patterns = await self._detect_direction_patterns(
                agent_trades, agent_id, symbol, TradeType.SELL
            )
            
            patterns.extend(buy_patterns)
            patterns.extend(sell_patterns)
        
        logger.info(f"✅ Detectados {len(patterns)} padrões TWAP à Mercado")
        return patterns
    
    def _group_trades_by_agent_symbol(self, trades: List[TickData]) -> Dict[Tuple[int, str], List[TickData]]:
        """Agrupa trades por agente e símbolo"""
        grouped = defaultdict(list)
        
        for trade in trades:
            key = (trade.agent_id, trade.symbol)
            grouped[key].append(trade)
        
        # Ordena trades por timestamp
        for key in grouped:
            grouped[key].sort(key=lambda t: t.timestamp)
        
        return dict(grouped)
    
    async def _detect_direction_patterns(self, trades: List[TickData], 
                                       agent_id: int, symbol: str, 
                                       direction: TradeType) -> List[TWAPPattern]:
        """Detecta padrões para uma direção específica (compra ou venda)"""
        
        # Filtra trades da direção específica
        direction_trades = [t for t in trades if t.trade_type == direction]
        
        if len(direction_trades) < self.config.min_volume_repetitions:
            return []
        
        # Filtra apenas trades "à mercado" (preço próximo ao melhor preço)
        market_trades = self._filter_market_trades(direction_trades, trades)
        
        if len(market_trades) < self.config.min_volume_repetitions:
            return []
        
        # Analisa padrões de volume
        volume_patterns = self._analyze_volume_patterns(market_trades)
        
        patterns = []
        
        for volume, volume_trades in volume_patterns.items():
            if len(volume_trades) < self.config.min_volume_repetitions:
                continue
                
            # Analisa regularidade temporal
            time_analysis = self._analyze_time_intervals(volume_trades)
            
            if not time_analysis['is_regular']:
                continue
            
            # Valida direção única
            direction_consistency = self._validate_single_direction(volume_trades, direction)
            
            if direction_consistency < self.config.min_direction_consistency:
                continue
            
            # Calcula confiança do padrão
            confidence = self._calculate_market_twap_confidence(
                volume_trades, time_analysis, direction_consistency
            )
            
            if confidence < self.config.min_confidence:
                continue
            
            # Cria padrão detectado
            pattern = self._create_market_twap_pattern(
                agent_id, symbol, volume_trades, time_analysis, confidence
            )
            
            if pattern:
                patterns.append(pattern)
                logger.info(f"✅ Padrão TWAP à Mercado detectado: {symbol} - {get_agent_name(agent_id)} ({agent_id}) - {direction.value} - Volume: {volume} - Intervalo: {time_analysis['avg_interval']:.1f}s - Confiança: {confidence:.2f}")
        
        return patterns
    
    def _filter_market_trades(self, direction_trades: List[TickData], 
                            all_trades: List[TickData]) -> List[TickData]:
        """
        Filtra apenas trades 'à mercado' baseado no raw_trade_type
        
        Regras:
        - raw_trade_type = 2: Comprador foi o agressor (comprou à mercado)
        - raw_trade_type = 3: Vendedor foi o agressor (vendeu à mercado)
        
        Para TWAP à Mercado, queremos apenas trades onde o agente foi o agressor
        """
        
        market_trades = []
        
        for trade in direction_trades:
            # Verifica se o agente foi o agressor baseado no raw_trade_type
            is_aggressor = False
            
            if trade.trade_type == TradeType.BUY and trade.raw_trade_type == 2:
                # Comprador foi agressor (raw_trade_type = 2) e é uma compra
                is_aggressor = True
            elif trade.trade_type == TradeType.SELL and trade.raw_trade_type == 3:
                # Vendedor foi agressor (raw_trade_type = 3) e é uma venda
                is_aggressor = True
            
            if is_aggressor:
                market_trades.append(trade)
        
        logger.debug(f"Filtrados {len(market_trades)} trades à mercado de {len(direction_trades)} trades da direção")
        return market_trades
    
    def _analyze_volume_patterns(self, trades: List[TickData]) -> Dict[int, List[TickData]]:
        """Analisa padrões de volume nos trades"""
        
        volume_groups = defaultdict(list)
        
        for trade in trades:
            volume_groups[trade.volume].append(trade)
        
        # Filtra apenas volumes que aparecem com frequência suficiente
        filtered_groups = {}
        
        for volume, volume_trades in volume_groups.items():
            frequency = len(volume_trades) / len(trades)
            
            if (frequency >= self.config.min_volume_frequency and 
                len(volume_trades) >= self.config.min_volume_repetitions):
                filtered_groups[volume] = volume_trades
        
        return filtered_groups
    
    def _analyze_time_intervals(self, trades: List[TickData]) -> Dict:
        """Analisa regularidade dos intervalos temporais"""
        
        if len(trades) < 2:
            return {'is_regular': False}
        
        # Calcula intervalos entre trades consecutivos
        intervals = []
        for i in range(1, len(trades)):
            interval = (trades[i].timestamp - trades[i-1].timestamp).total_seconds()
            intervals.append(interval)
        
        if len(intervals) < self.config.min_time_intervals:
            return {'is_regular': False}
        
        # Estatísticas dos intervalos
        avg_interval = statistics.mean(intervals)
        std_interval = statistics.stdev(intervals) if len(intervals) > 1 else 0
        
        # Verifica se o intervalo está dentro do limite máximo
        if avg_interval > (self.config.max_interval_minutes * 60):
            return {'is_regular': False}
        
        # Calcula consistência temporal
        if avg_interval > 0:
            consistency = 1.0 - (std_interval / avg_interval)
        else:
            consistency = 0.0
        
        is_regular = consistency >= self.config.time_consistency_threshold
        
        return {
            'is_regular': is_regular,
            'avg_interval': avg_interval,
            'std_interval': std_interval,
            'consistency': consistency,
            'intervals': intervals
        }
    
    def _validate_single_direction(self, trades: List[TickData], 
                                 expected_direction: TradeType) -> float:
        """Valida se os trades são consistentes na direção"""
        
        if not trades:
            return 0.0
        
        correct_direction = sum(1 for t in trades if t.trade_type == expected_direction)
        total_trades = len(trades)
        
        return correct_direction / total_trades
    
    def _calculate_market_twap_confidence(self, trades: List[TickData], 
                                        time_analysis: Dict, 
                                        direction_consistency: float) -> float:
        """Calcula a confiança do padrão TWAP à Mercado"""
        
        # Consistência de volume (todos os trades têm o mesmo volume)
        volume_consistency = 1.0  # Já filtrado por volume
        
        # Regularidade temporal
        time_consistency = time_analysis.get('consistency', 0.0)
        
        # Consistência de direção
        direction_score = direction_consistency
        
        # Frequência de repetição (quantos trades seguem o padrão)
        frequency_score = min(len(trades) / 20.0, 1.0)  # Normaliza para máximo 20 trades
        
        # Score final ponderado
        confidence = (
            volume_consistency * 0.3 +
            time_consistency * 0.3 +
            direction_score * 0.2 +
            frequency_score * 0.2
        )
        
        return min(confidence, 1.0)
    
    def _create_market_twap_pattern(self, agent_id: int, symbol: str, 
                                  trades: List[TickData], 
                                  time_analysis: Dict, 
                                  confidence: float) -> Optional[TWAPPattern]:
        """Cria um padrão TWAP à Mercado detectado"""
        
        if not trades:
            return None
        
        # Calcula métricas do padrão
        total_volume = sum(t.volume for t in trades)
        total_trades = len(trades)
        avg_trade_size = total_volume / total_trades
        frequency_minutes = time_analysis['avg_interval'] / 60.0
        
        # Calcula agressividade de preço (simplificado)
        price_aggression = 0.0  # Para trades à mercado, consideramos 0
        
        # Determina status baseado na confiança
        if confidence >= 0.8:
            status = RobotStatus.ACTIVE
        elif confidence >= 0.6:
            status = RobotStatus.SUSPICIOUS
        else:
            status = RobotStatus.INACTIVE
        
        # Cria o padrão
        pattern = TWAPPattern(
            symbol=symbol,
            exchange=trades[0].exchange,
            pattern_type="MARKET_TWAP",
            robot_type=RobotType.MARKET_TWAP.value,
            agent_id=agent_id,
            first_seen=trades[0].timestamp,
            last_seen=trades[-1].timestamp,
            total_volume=total_volume,
            total_trades=total_trades,
            avg_trade_size=avg_trade_size,
            frequency_minutes=frequency_minutes,
            price_aggression=price_aggression,
            confidence_score=confidence,
            status=status,
            market_volume_percentage=0.0  # Será calculado posteriormente
        )
        
        return pattern
    
    def _get_matching_trades_for_pattern(self, pattern: TWAPPattern, 
                                         candidate_trades: List[TickData]) -> List[TickData]:
        """Reconstrói e retorna apenas os trades que compõem o padrão TWAP à Mercado.
        
        Regras aplicadas:
        - Apenas trades no intervalo [first_seen, last_seen]
        - Apenas trades onde o agente foi o agressor (BUY & raw=2, SELL & raw=3)
        - Volume dentro da tolerância de volume do padrão
        - Direção única (compra OU venda), escolhida pela maior contagem após filtros
        """
        if not candidate_trades:
            return []

        # Intervalo de tempo do padrão
        start_ts = pattern.first_seen
        end_ts = pattern.last_seen

        # Volume esperado com tolerância
        expected_volume = int(round(pattern.avg_trade_size))
        tol = self.config.volume_tolerance_percent / 100.0
        vol_min = int(math.floor(expected_volume * (1.0 - tol)))
        vol_max = int(math.ceil(expected_volume * (1.0 + tol)))

        def is_aggressor(t: TickData) -> bool:
            return ((t.trade_type == TradeType.BUY and t.raw_trade_type == 2) or
                    (t.trade_type == TradeType.SELL and t.raw_trade_type == 3))

        # Primeiro, aplica janela + agressor + volume
        windowed = [
            t for t in candidate_trades
            if (t.timestamp >= start_ts and t.timestamp <= end_ts)
            and is_aggressor(t)
            and (vol_min <= int(t.volume) <= vol_max)
        ]

        if not windowed:
            return []

        # Separa por direção
        buys = [t for t in windowed if t.trade_type == TradeType.BUY]
        sells = [t for t in windowed if t.trade_type == TradeType.SELL]

        # Escolhe a direção com mais ocorrências após os filtros
        chosen = buys if len(buys) >= len(sells) else sells

        # Garante quantidade mínima de repetições para considerar válido
        if len(chosen) < self.config.min_volume_repetitions:
            return []

        # Ordena por tempo (por segurança)
        chosen.sort(key=lambda t: t.timestamp)
        return chosen

    async def save_pattern_and_trades(self, pattern: TWAPPattern, 
                                    trades: List[TickData]) -> bool:
        """Salva o padrão detectado e seus trades"""
        
        try:
            # Salva o padrão
            pattern_id = await self.persistence.save_twap_pattern(pattern)
            
            if not pattern_id:
                logger.error(f"Falha ao salvar padrão TWAP à Mercado: {pattern.symbol}")
                return False
            
            # Filtra e salva SOMENTE os trades que compõem o padrão
            matching_trades = self._get_matching_trades_for_pattern(pattern, trades)

            if not matching_trades:
                logger.warning(f"Nenhum trade matching encontrado para padrão {pattern.symbol}-{pattern.agent_id} no intervalo informado")
                return True  # Padrão salvo, sem trades vinculados

            for trade in matching_trades:
                robot_trade = RobotTrade(
                    symbol=trade.symbol,
                    price=trade.price,
                    volume=trade.volume,
                    timestamp=trade.timestamp,
                    trade_type=trade.trade_type,
                    agent_id=trade.agent_id,
                    exchange=trade.exchange,
                    robot_pattern_id=pattern_id
                )
                
                await self.persistence.save_robot_trade(robot_trade, pattern_id)
            
            logger.info(f"✅ Padrão TWAP à Mercado salvo: {pattern.symbol} - {get_agent_name(pattern.agent_id)} ({pattern.agent_id}) | Trades salvos: {len(matching_trades)}")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao salvar padrão TWAP à Mercado: {e}")
            return False

    def cluster_trades(self, trades: List[TickData]) -> Dict[str, List[TickData]]:
        """Agrupa trades por assinatura (volume + direção + intervalo médio)."""
        clusters: Dict[str, List[TickData]] = {}
        if not trades:
            return clusters

        # Ordena por timestamp para calculo de intervalos
        sorted_trades = sorted(trades, key=lambda t: t.timestamp)

        for trade in sorted_trades:
            key = f"{trade.volume}:{trade.trade_type.value}"
            clusters.setdefault(key, []).append(trade)

        return clusters
