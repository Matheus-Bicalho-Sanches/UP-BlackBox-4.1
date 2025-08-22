import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import statistics

from .robot_models import (
    TWAPPattern, RobotTrade, TradeType, RobotStatus, 
    TWAPDetectionConfig, TickData
)
from .robot_persistence import RobotPersistence

logger = logging.getLogger(__name__)

class TWAPDetector:
    """Detector de padrões TWAP (Time-Weighted Average Price)"""
    
    def __init__(self, config: Optional[TWAPDetectionConfig] = None):
        self.config = config or TWAPDetectionConfig()
        self.persistence = RobotPersistence()
        self.active_patterns: Dict[str, Dict[int, TWAPPattern]] = defaultdict(dict)
        
    async def analyze_symbol(self, symbol: str) -> List[TWAPPattern]:
        """Analisa um símbolo específico para detectar padrões TWAP"""
        try:
            logger.info(f"Analisando {symbol} para padrões TWAP...")
            
            # Busca ticks das últimas 24h
            ticks_data = await self.persistence.get_recent_ticks(symbol, 24)
            
            if not ticks_data:
                logger.info(f"Nenhum tick encontrado para {symbol}")
                return []
            
            # Agrupa por agente (buy_agent ou sell_agent)
            agent_trades = self._group_trades_by_agent(ticks_data)
            
            detected_patterns = []
            
            # Analisa cada agente
            for agent_id, trades in agent_trades.items():
                if len(trades) < self.config.min_trades:
                    continue
                
                pattern = await self._analyze_agent_trades(symbol, agent_id, trades)
                if pattern and pattern.confidence_score >= self.config.min_confidence:
                    detected_patterns.append(pattern)
                    
                    # Salva ou atualiza o padrão
                    await self._persist_pattern(pattern)
            
            logger.info(f"Detectados {len(detected_patterns)} padrões TWAP para {symbol}")
            return detected_patterns
            
        except Exception as e:
            logger.error(f"Erro ao analisar {symbol}: {e}")
            return []
    
    def _group_trades_by_agent(self, ticks_data: List[dict]) -> Dict[int, List[TickData]]:
        """Agrupa trades por agente (buy ou sell)"""
        agent_trades = defaultdict(list)
        
        for tick in ticks_data:
            # Cria TickData para compras (buy_agent)
            if tick['buy_agent']:
                buy_tick = TickData(
                    symbol=tick['symbol'],
                    price=tick['price'],
                    volume=tick['volume'],
                    timestamp=tick['timestamp'],
                    trade_type=TradeType.BUY,
                    agent_id=tick['buy_agent'],
                    exchange=tick['exchange']
                )
                agent_trades[tick['buy_agent']].append(buy_tick)
            
            # Cria TickData para vendas (sell_agent)
            if tick['sell_agent']:
                sell_tick = TickData(
                    symbol=tick['symbol'],
                    price=tick['price'],
                    volume=tick['volume'],
                    timestamp=tick['timestamp'],
                    trade_type=TradeType.SELL,
                    agent_id=tick['sell_agent'],
                    exchange=tick['exchange']
                )
                agent_trades[tick['sell_agent']].append(sell_tick)
        
        return agent_trades
    
    async def _analyze_agent_trades(self, symbol: str, agent_id: int, trades: List[TickData]) -> Optional[TWAPPattern]:
        """Analisa trades de um agente específico para detectar TWAP"""
        if len(trades) < self.config.min_trades:
            return None
        
        # Ordena trades por timestamp
        trades.sort(key=lambda x: x.timestamp)
        
        # Calcula métricas básicas
        total_volume = sum(trade.volume for trade in trades)
        total_trades = len(trades)
        avg_trade_size = total_volume / total_trades
        
        # Verifica volume mínimo
        if total_volume < self.config.min_total_volume:
            return None
        
        # Calcula frequência entre trades
        frequencies = []
        for i in range(1, len(trades)):
            time_diff = trades[i].timestamp - trades[i-1].timestamp
            freq_minutes = time_diff.total_seconds() / 60
            frequencies.append(freq_minutes)
        
        if not frequencies:
            return None
        
        avg_frequency = statistics.mean(frequencies)
        
        # Verifica se a frequência está no range esperado
        if not (self.config.min_frequency_minutes <= avg_frequency <= self.config.max_frequency_minutes):
            return None
        
        # Calcula variação de preço
        prices = [trade.price for trade in trades]
        price_variation = ((max(prices) - min(prices)) / min(prices)) * 100
        
        if price_variation > self.config.max_price_variation:
            return None
        
        # Calcula agressividade de preço (quanto o agente "empurra" o preço)
        price_aggression = self._calculate_price_aggression(trades)
        
        # Calcula score de confiança
        confidence_score = self._calculate_confidence_score(
            total_trades, avg_frequency, price_variation, price_aggression
        )
        
        # Determina status
        status = self._determine_status(confidence_score, avg_frequency, price_variation)
        
        # Cria o padrão
        pattern = TWAPPattern(
            symbol=symbol,
            exchange=trades[0].exchange,
            agent_id=agent_id,
            first_seen=trades[0].timestamp,
            last_seen=trades[-1].timestamp,
            total_volume=total_volume,
            total_trades=total_trades,
            avg_trade_size=avg_trade_size,
            frequency_minutes=avg_frequency,
            price_aggression=price_aggression,
            confidence_score=confidence_score,
            status=status
        )
        
        return pattern
    
    def _calculate_price_aggression(self, trades: List[TickData]) -> float:
        """Calcula a agressividade de preço do agente"""
        if len(trades) < 2:
            return 0.0
        
        # Calcula quanto o agente "empurra" o preço em cada trade
        aggressions = []
        
        for i in range(1, len(trades)):
            prev_price = trades[i-1].price
            curr_price = trades[i].price
            
            # Se é compra e preço subiu, ou venda e preço caiu = agressivo
            if trades[i].trade_type == TradeType.BUY and curr_price > prev_price:
                aggression = (curr_price - prev_price) / prev_price
                aggressions.append(aggression)
            elif trades[i].trade_type == TradeType.SELL and curr_price < prev_price:
                aggression = (prev_price - curr_price) / prev_price
                aggressions.append(aggression)
        
        if not aggressions:
            return 0.0
        
        return statistics.mean(aggressions) * 100  # Converte para porcentagem
    
    def _calculate_confidence_score(self, total_trades: int, avg_frequency: float, 
                                  price_variation: float, price_aggression: float) -> float:
        """Calcula score de confiança (0.0 a 1.0)"""
        score = 0.0
        
        # Score baseado no número de trades
        if total_trades >= 50:
            score += 0.3
        elif total_trades >= 20:
            score += 0.2
        elif total_trades >= 10:
            score += 0.1
        
        # Score baseado na frequência (mais regular = melhor)
        if 2 <= avg_frequency <= 10:  # Frequência ideal para TWAP
            score += 0.3
        elif 1 <= avg_frequency <= 20:
            score += 0.2
        elif 0.5 <= avg_frequency <= 30:
            score += 0.1
        
        # Score baseado na variação de preço (menor = melhor)
        if price_variation <= 1.0:
            score += 0.2
        elif price_variation <= 2.0:
            score += 0.15
        elif price_variation <= 3.0:
            score += 0.1
        
        # Score baseado na agressividade (menor = mais TWAP-like)
        if price_aggression <= 0.1:
            score += 0.2
        elif price_aggression <= 0.5:
            score += 0.1
        
        return min(score, 1.0)
    
    def _determine_status(self, confidence_score: float, avg_frequency: float, 
                         price_variation: float) -> RobotStatus:
        """Determina o status do robô baseado nas métricas"""
        if confidence_score >= 0.8 and avg_frequency <= 15 and price_variation <= 2.0:
            return RobotStatus.ACTIVE
        elif confidence_score >= 0.6:
            return RobotStatus.ACTIVE
        elif confidence_score >= 0.4:
            return RobotStatus.SUSPICIOUS
        else:
            return RobotStatus.INACTIVE
    
    async def _persist_pattern(self, pattern: TWAPPattern) -> bool:
        """Persiste um padrão detectado"""
        try:
            # Verifica se já existe um padrão para este símbolo/agente
            existing = await self.persistence.get_existing_pattern(pattern.symbol, pattern.agent_id)
            
            if existing:
                # Atualiza padrão existente
                pattern_id = existing[0]
                success = await self.persistence.update_twap_pattern(pattern_id, pattern)
                if success:
                    # Atualiza no cache local
                    self.active_patterns[pattern.symbol][pattern.agent_id] = pattern
                return success
            else:
                # Cria novo padrão
                pattern_id = await self.persistence.save_twap_pattern(pattern)
                if pattern_id:
                    # Adiciona ao cache local
                    self.active_patterns[pattern.symbol][pattern.agent_id] = pattern
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Erro ao persistir padrão: {e}")
            return False
    
    async def analyze_all_symbols(self) -> Dict[str, List[TWAPPattern]]:
        """Analisa todos os símbolos disponíveis"""
        try:
            # Busca símbolos únicos das últimas 24h
            symbols = await self._get_active_symbols()
            
            all_patterns = {}
            
            for symbol in symbols:
                patterns = await self.analyze_symbol(symbol)
                if patterns:
                    all_patterns[symbol] = patterns
            
            return all_patterns
            
        except Exception as e:
            logger.error(f"Erro ao analisar todos os símbolos: {e}")
            return {}
    
    async def _get_active_symbols(self) -> List[str]:
        """Busca símbolos que tiveram atividade nas últimas 24h"""
        try:
            return await self.persistence.get_active_symbols()
        except Exception as e:
            logger.error(f"Erro ao buscar símbolos ativos: {e}")
            return []
    
    async def cleanup_old_data(self):
        """Limpa dados antigos periodicamente"""
        try:
            await self.persistence.cleanup_old_patterns(7)  # 7 dias
            logger.info("Limpeza de dados antigos concluída")
        except Exception as e:
            logger.error(f"Erro na limpeza: {e}")
    
    def get_active_patterns(self) -> Dict[str, Dict[int, TWAPPattern]]:
        """Retorna padrões ativos em cache"""
        return self.active_patterns.copy()
