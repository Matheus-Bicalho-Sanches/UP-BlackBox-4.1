import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import statistics

# Corrige imports para funcionar como módulo standalone
try:
    from .robot_models import (
        TWAPPattern, RobotTrade, TradeType, RobotStatus, 
        TWAPDetectionConfig, TickData, RobotType
    )
    from .robot_persistence import RobotPersistence
    from .agent_mapping import get_agent_name
except ImportError:
    from robot_models import (
        TWAPPattern, RobotTrade, TradeType, RobotStatus, 
        TWAPDetectionConfig, TickData, RobotType
    )
    from robot_persistence import RobotPersistence
    from agent_mapping import get_agent_name

logger = logging.getLogger(__name__)

class RobotStatusTracker:
    """Rastreador de mudanças de status dos robôs"""
    
    def __init__(self, websocket_callback=None):
        self.status_history: List[Dict] = []
        self.type_change_history: List[Dict] = []  # ✅ NOVO: Histórico de mudanças de tipo
        self.max_history_size = 1000  # Mantém histórico das últimas 1000 mudanças
        self.websocket_callback = websocket_callback  # ✅ NOVO: Callback para WebSocket
    
    def add_status_change(self, symbol: str, agent_id: int, old_status: str, 
                         new_status: str, pattern: TWAPPattern):
        """Adiciona uma mudança de status ao histórico"""
        change = {
            'id': f"{symbol}_{agent_id}_{datetime.now(timezone.utc).timestamp()}",  # ✅ CORRIGIDO: Usa timezone UTC
            'symbol': symbol,
            'agent_id': agent_id,
            'agent_name': get_agent_name(agent_id),  # ✅ NOVO: Nome da corretora
            'robot_type': pattern.robot_type,  # ✅ NOVO: Tipo do robô
            'old_status': old_status,
            'new_status': new_status,
            'timestamp': datetime.now(timezone.utc).isoformat(),  # ✅ CORRIGIDO: Usa timezone UTC
            'pattern_type': pattern.pattern_type,
            'confidence_score': pattern.confidence_score,
            'total_volume': pattern.total_volume,
            'total_trades': pattern.total_trades,
            'market_volume_percentage': pattern.market_volume_percentage  # ✅ NOVO: Volume em % do mercado
        }
        
        # Adiciona no início da lista (mais recente primeiro)
        self.status_history.insert(0, change)
        
        # Mantém apenas as últimas mudanças
        if len(self.status_history) > self.max_history_size:
            self.status_history = self.status_history[:self.max_history_size]
        
        logger.info(f"Status change tracked: {symbol} {get_agent_name(agent_id)} ({agent_id}) {old_status} -> {new_status}")
        
        # ✅ NOVO: Notifica via WebSocket se callback estiver disponível
        if self.websocket_callback:
            try:
                asyncio.create_task(self.websocket_callback(change))
            except Exception as e:
                logger.error(f"Erro ao notificar via WebSocket: {e}")
    
    def add_type_change(self, type_change: Dict):
        """Adiciona uma mudança de tipo ao histórico"""
        # Adiciona no início da lista (mais recente primeiro)
        self.type_change_history.insert(0, type_change)
        
        # Mantém apenas as últimas mudanças
        if len(self.type_change_history) > self.max_history_size:
            self.type_change_history = self.type_change_history[:self.max_history_size]
        
        logger.info(f"Type change tracked: {type_change['symbol']} {type_change['agent_name']} ({type_change['agent_id']}) {type_change['old_type']} -> {type_change['new_type']}")
        
        # ✅ NOVO: Notifica via WebSocket se callback estiver disponível
        if self.websocket_callback:
            try:
                asyncio.create_task(self.websocket_callback({
                    'type': 'type_change',
                    'data': type_change
                }))
            except Exception as e:
                logger.error(f"Erro ao notificar mudança de tipo via WebSocket: {e}")

    def get_status_changes(self, symbol: Optional[str] = None, hours: int = 24) -> List[Dict]:
        """Retorna mudanças de status filtradas por símbolo e tempo"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)  # ✅ CORRIGIDO: Usa timezone UTC
        
        filtered_changes = []
        for change in self.status_history:
            change_time = datetime.fromisoformat(change['timestamp'])
            if change_time >= cutoff_time:
                if symbol is None or change['symbol'] == symbol:
                    filtered_changes.append(change)
        
        return filtered_changes

    def get_all_changes(self, symbol: Optional[str] = None, hours: int = 24) -> List[Dict]:
        """Retorna todas as mudanças (status + tipo) mescladas por timestamp"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        # Filtra mudanças de status
        status_changes = [
            {**change, 'change_category': 'status'} 
            for change in self.status_history
            if datetime.fromisoformat(change['timestamp']) >= cutoff_time
            and (symbol is None or change['symbol'] == symbol)
        ]
        
        # Filtra mudanças de tipo
        type_changes = [
            {**change, 'change_category': 'type'} 
            for change in self.type_change_history
            if datetime.fromisoformat(change['timestamp']) >= cutoff_time
            and (symbol is None or change['symbol'] == symbol)
        ]
        
        # Mescla e ordena por timestamp (mais recente primeiro)
        all_changes = status_changes + type_changes
        all_changes.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return all_changes[:50]  # Limita aos 50 mais recentes

class TWAPDetector:
    """Detector de padrões TWAP (Time-Weighted Average Price)"""
    
    def __init__(self, config: TWAPDetectionConfig, persistence: RobotPersistence):
        self.config = config
        self.persistence = persistence
        self.active_patterns: Dict[str, Dict[int, TWAPPattern]] = defaultdict(dict)
        self.status_tracker = RobotStatusTracker()  # Adiciona tracker de status
        
        # ✅ NOVO: Histerese de ativação para evitar flip-flop imediato
        self.activation_times: Dict[Tuple[str, int], datetime] = {}
        self.activation_cooldown_seconds: int = 90
    
    def _to_utc(self, dt: datetime) -> datetime:
        """Garante que o datetime seja timezone-aware em UTC"""
        if dt is None:
            return datetime.now(timezone.utc)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

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
                    timestamp=self._to_utc(tick['timestamp']),
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
                    timestamp=self._to_utc(tick['timestamp']),
                    trade_type=TradeType.SELL,
                    agent_id=tick['sell_agent'],
                    exchange=tick['exchange']
                )
                agent_trades[tick['sell_agent']].append(sell_tick)
        
        return agent_trades
    
    async def _analyze_agent_trades(self, symbol: str, agent_id: int, trades: List[TickData]) -> Optional[TWAPPattern]:
        try:
            # Ordena por tempo crescente
            trades = sorted(trades, key=lambda t: t.timestamp)
            total_trades = len(trades)
            total_volume = sum(t.volume for t in trades)
            avg_trade_size = total_volume / total_trades if total_trades > 0 else 0
            
            # Calcula frequência média entre trades (minutos)
            if total_trades > 1:
                time_deltas = [
                    (trades[i].timestamp - trades[i-1].timestamp).total_seconds() / 60.0
                    for i in range(1, total_trades)
                ]
                avg_frequency = statistics.mean(time_deltas)
            else:
                avg_frequency = self.config.max_frequency_minutes
            
            # Calcula variação de preço e agressão
            prices = [t.price for t in trades]
            price_variation = ((max(prices) - min(prices)) / prices[0]) * 100 if prices else 0.0
            price_aggression = self._calculate_price_aggression(trades)
            
            # Score de confiança
            confidence_score = self._calculate_confidence_score(
                total_trades, avg_frequency, price_variation, price_aggression
            )
            
            # Determina status preliminar
            status = self._determine_status(confidence_score, avg_frequency, price_variation)
            
            # ✅ NOVO: Gate de recência - se último trade for antigo, força INACTIVE
            last_seen = trades[-1].timestamp
            now_utc = datetime.now(timezone.utc)
            recency_minutes = (now_utc - last_seen).total_seconds() / 60.0
            if recency_minutes > self.config.active_recency_minutes:
                status = RobotStatus.INACTIVE
            
            # ✅ NOVO: Cria o padrão TWAP
            pattern = TWAPPattern(
                symbol=symbol,
                exchange=trades[0].exchange if trades else 'B3',
                pattern_type='TWAP',
                robot_type=RobotType.TYPE_0.value,  # ✅ Inicialmente Tipo 0, será atualizado após calcular volume %
                confidence_score=confidence_score,
                agent_id=agent_id,
                first_seen=trades[0].timestamp if trades else datetime.now(timezone.utc),
                last_seen=trades[-1].timestamp if trades else datetime.now(timezone.utc),
                total_volume=total_volume,
                total_trades=total_trades,
                avg_trade_size=avg_trade_size,
                frequency_minutes=avg_frequency,
                price_aggression=price_aggression,
                status=status,
                market_volume_percentage=0.0  # Será calculado após salvar o padrão
            )
            
            # ✅ NOVO: Salva padrão e trades de forma atômica para evitar FK inválida
            if pattern.confidence_score >= self.config.min_confidence:
                # Converte TickData -> RobotTrade para persistir em lote
                robot_trades_batch = [
                    RobotTrade(
                        symbol=t.symbol,
                        price=t.price,
                        volume=t.volume,
                        timestamp=t.timestamp,
                        trade_type=t.trade_type,
                        agent_id=t.agent_id,
                        exchange=t.exchange
                    )
                    for t in trades
                ]
                saved_pattern_id = await self.persistence.save_pattern_and_trades(pattern, robot_trades_batch)
                if not saved_pattern_id:
                    logger.warning(f"⚠️ Não foi possível salvar padrão+trades de {symbol}-{agent_id} (transação)")
            
            return pattern
            
        except Exception as e:
            logger.error(f"Erro ao analisar trades do agente {agent_id} em {symbol}: {e}")
            return None

    async def _save_robot_trades(self, trades: List[TickData], pattern: TWAPPattern) -> None:
        """Salva os trades individuais na tabela robot_trades"""
        try:
            logger.info(f"💾 Salvando {len(trades)} trades para robô {pattern.agent_id} em {pattern.symbol}")
            
            # Primeiro, salva o padrão para obter o ID
            pattern_id = await self.persistence.save_twap_pattern(pattern)
            if not pattern_id:
                logger.warning(f"⚠️ Não foi possível salvar o padrão TWAP para {pattern.symbol} - {pattern.agent_id}")
                return
            
            # ✅ NOVO: Calcula volume % inicial do mercado
            try:
                market_volume = await self.persistence.get_market_volume_for_period(
                    pattern.symbol, pattern.first_seen, pattern.last_seen
                )
                
                if market_volume > 0:
                    volume_percentage = (pattern.total_volume / market_volume) * 100
                    pattern.market_volume_percentage = round(volume_percentage, 2)
                    
                    # Atualiza o padrão com o volume % calculado
                    await self.persistence.update_market_volume_percentage(pattern_id, pattern.market_volume_percentage)
                    
                    logger.info(f"📊 Volume % calculado para robô {pattern.agent_id}: {pattern.market_volume_percentage:.2f}% (R$ {pattern.total_volume:,.2f} / R$ {market_volume:,.2f})")
                else:
                    logger.warning(f"⚠️ Volume do mercado zero para {pattern.symbol} - não foi possível calcular %")
                    
            except Exception as e:
                logger.error(f"❌ Erro ao calcular volume % inicial: {e}")
            
            # Agora salva cada trade individual
            saved_count = 0
            for trade in trades:
                try:
                    # Cria um objeto RobotTrade para salvar
                    robot_trade = RobotTrade(
                        symbol=trade.symbol,
                        price=trade.price,
                        volume=trade.volume,
                        timestamp=trade.timestamp,
                        trade_type=trade.trade_type,
                        agent_id=trade.agent_id,
                        exchange=trade.exchange
                    )
                    
                    # Salva o trade
                    success = await self.persistence.save_robot_trade(robot_trade, pattern_id)
                    if success:
                        saved_count += 1
                    else:
                        logger.warning(f"⚠️ Falha ao salvar trade {trade.timestamp} para robô {pattern.agent_id}")
                        
                except Exception as e:
                    logger.error(f"❌ Erro ao salvar trade individual: {e}")
                    continue
            
            logger.info(f"✅ {saved_count}/{len(trades)} trades salvos para robô {pattern.agent_id} em {pattern.symbol}")
            
        except Exception as e:
            logger.error(f"💥 Erro ao salvar trades do robô {pattern.agent_id} em {pattern.symbol}: {e}")
            logger.error(f"📋 Traceback completo:", exc_info=True)
    
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
        """Calcula score de confiança (0.0 a 1.0) - AJUSTADO PARA MERCADO BRASILEIRO"""
        score = 0.0
        
        # Score baseado no número de trades (ajustado para mercado brasileiro)
        if total_trades >= 100:
            score += 0.3
        elif total_trades >= 50:
            score += 0.25
        elif total_trades >= 20:
            score += 0.2
        elif total_trades >= 10:
            score += 0.15
        elif total_trades >= 5:
            score += 0.1
        
        # Score baseado na frequência (AJUSTADO para mercado brasileiro)
        # Mercado brasileiro é mais rápido, frequências de 0.001-2 min são normais
        if 0.001 <= avg_frequency <= 2.0:  # Frequência ideal para TWAP brasileiro
            score += 0.3
        elif 0.001 <= avg_frequency <= 5.0:
            score += 0.25
        elif 0.001 <= avg_frequency <= 10.0:
            score += 0.2
        elif 0.001 <= avg_frequency <= 30.0:
            score += 0.15
        elif 0.001 <= avg_frequency <= 60.0:
            score += 0.1
        
        # Score baseado na variação de preço (ajustado para mercado brasileiro)
        if price_variation <= 2.0:
            score += 0.2
        elif price_variation <= 5.0:
            score += 0.15
        elif price_variation <= 10.0:
            score += 0.1
        elif price_variation <= 15.0:
            score += 0.05
        
        # Score baseado na agressividade (ajustado para mercado brasileiro)
        if price_aggression <= 0.5:
            score += 0.2
        elif price_aggression <= 1.0:
            score += 0.15
        elif price_aggression <= 2.0:
            score += 0.1
        elif price_aggression <= 5.0:
            score += 0.05
        
        return min(score, 1.0)
    
    def _determine_status(self, confidence_score: float, avg_frequency: float, 
                         price_variation: float) -> RobotStatus:
        """Determina o status do robô baseado nas métricas - AJUSTADO PARA MERCADO BRASILEIRO"""
        if confidence_score >= 0.7 and avg_frequency <= 5.0 and price_variation <= 5.0:
            return RobotStatus.ACTIVE
        elif confidence_score >= 0.5:
            return RobotStatus.ACTIVE
        elif confidence_score >= 0.3:
            return RobotStatus.SUSPICIOUS
        else:
            return RobotStatus.INACTIVE
    
    def _determine_robot_type(self, market_volume_percentage: float) -> str:
        """Determina o tipo do robô baseado no volume em % do mercado
        
        Args:
            market_volume_percentage: Volume em % do mercado (0.0 a 100.0)
            
        Returns:
            str: Tipo do robô
        """
        if market_volume_percentage > 10.0:
            return RobotType.TYPE_3.value  # "Robô Tipo 3" - > 10%
        elif market_volume_percentage >= 5.0:
            return RobotType.TYPE_2.value  # "Robô Tipo 2" - 5% a 10%
        elif market_volume_percentage >= 1.0:
            return RobotType.TYPE_1.value  # "Robô Tipo 1" - 1% a 5%
        else:
            return RobotType.TYPE_0.value  # "Robô Tipo 0" - 0% a 1%
    
    async def _persist_pattern(self, pattern: TWAPPattern) -> bool:
        """Persiste um padrão detectado"""
        try:
            # Verifica se já existe um padrão para este símbolo/agente
            existing = await self.persistence.get_existing_pattern(pattern.symbol, pattern.agent_id)
            
            if existing:
                # Atualiza padrão existente
                pattern_id = existing[0]
                old_status_str = existing[1]  # Status anterior (string do banco)
                
                # ✅ CORRIGIDO: Converte string para enum para comparação correta
                old_status_enum = self._string_to_status_enum(old_status_str)
                
                success = await self.persistence.update_twap_pattern(pattern_id, pattern)
                if success:
                    # Atualiza no cache local
                    self.active_patterns[pattern.symbol][pattern.agent_id] = pattern
                    
                    # ✅ CORRIGIDO: Compara enums, não string vs enum
                    if old_status_enum != pattern.status:
                        logger.info(f"🔄 Mudança real de status: {pattern.symbol} - {pattern.agent_id} ({old_status_enum.value} -> {pattern.status.value})")
                        self.status_tracker.add_status_change(
                            pattern.symbol, pattern.agent_id, old_status_enum.value, pattern.status.value, pattern
                        )
                        
                        # ✅ NOVO: registra hora de ativação
                        if pattern.status == RobotStatus.ACTIVE:
                            self.activation_times[(pattern.symbol, pattern.agent_id)] = datetime.now(timezone.utc)
                    else:
                        logger.debug(f"📊 Status inalterado: {pattern.symbol} - {pattern.agent_id} ({pattern.status.value})")
                    
                    return success
            else:
                # Cria novo padrão
                pattern_id = await self.persistence.save_twap_pattern(pattern)
                if pattern_id:
                    # Adiciona ao cache local
                    self.active_patterns[pattern.symbol][pattern.agent_id] = pattern
                    
                    # ✅ Só emitir início se realmente estiver ativo agora
                    if pattern.status == RobotStatus.ACTIVE:
                        logger.info(f"🆕 Novo robô detectado: {pattern.symbol} - {pattern.agent_id} ({pattern.status.value})")
                        self.status_tracker.add_status_change(
                            pattern.symbol, pattern.agent_id, 'inactive', pattern.status.value, pattern
                        )
                        # registra hora de ativação
                        self.activation_times[(pattern.symbol, pattern.agent_id)] = datetime.now(timezone.utc)
                    else:
                        logger.debug(f"Novo padrão criado mas não ativo (recency gate): {pattern.symbol}-{pattern.agent_id}")
                    
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Erro ao persistir padrão: {e}")
            return False
    
    def _string_to_status_enum(self, status_str: str) -> RobotStatus:
        """Converte string de status para enum RobotStatus"""
        try:
            # Mapeia strings do banco para enums
            status_mapping = {
                'inactive': RobotStatus.INACTIVE,
                'active': RobotStatus.ACTIVE,
                'suspicious': RobotStatus.SUSPICIOUS
            }
            return status_mapping.get(status_str.lower(), RobotStatus.INACTIVE)
        except Exception:
            return RobotStatus.INACTIVE
    
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
    
    def get_status_changes(self, symbol: Optional[str] = None, hours: int = 24) -> List[Dict]:
        """Retorna mudanças de status dos robôs"""
        return self.status_tracker.get_status_changes(symbol, hours)

    def get_all_changes(self, symbol: Optional[str] = None, hours: int = 24) -> List[Dict]:
        """Retorna todas as mudanças (status + tipo) dos robôs"""
        return self.status_tracker.get_all_changes(symbol, hours)

    async def recalculate_market_volume_percentage(self, symbol: str, agent_id: int, pattern: TWAPPattern) -> Tuple[float, str]:
        """
        Recalcula o volume % do mercado para um robô ativo
        Usa período desde quando o robô começou OU últimas 2h (o que for menor)
        Retorna: (novo_volume_%, novo_tipo)
        """
        try:
            current_time = datetime.now(timezone.utc)
            
            # ✅ CORRIGIDO: Calcula período inteligente baseado na atividade do robô
            max_window_hours = 2  # Janela máxima de 2 horas
            max_start_time = current_time - timedelta(hours=max_window_hours)
            
            # Se o robô começou há menos de 2h, usa desde o início
            # Se começou há mais de 2h, usa janela móvel de 2h
            robot_start_time = pattern.first_seen
            start_time = max(robot_start_time, max_start_time)
            
            # Calcula duração do período para log
            period_duration = (current_time - start_time).total_seconds() / 3600  # em horas
            
            logger.debug(f"📊 Recalculando {symbol}-{agent_id}: período de {period_duration:.1f}h (desde {start_time.strftime('%H:%M:%S')})")
            
            # Busca volume total do robô no período calculado
            robot_volume = await self.persistence.get_robot_volume_for_period(
                symbol, agent_id, start_time, current_time
            )
            
            # Busca volume total do mercado no mesmo período
            market_volume = await self.persistence.get_market_volume_for_period(
                symbol, start_time, current_time
            )
            
            if market_volume > 0:
                new_volume_pct = round((robot_volume / market_volume) * 100.0, 2)
                new_robot_type = self._determine_robot_type(new_volume_pct)
                
                logger.debug(f"📈 {symbol}-{agent_id}: Volume robô: R$ {robot_volume:,.2f} | Mercado: R$ {market_volume:,.2f} | Período: {period_duration:.1f}h | % = {new_volume_pct:.2f}%")
                
                return new_volume_pct, new_robot_type
            else:
                logger.warning(f"⚠️ Volume do mercado zero para {symbol} no período de {period_duration:.1f}h")
                return pattern.market_volume_percentage, pattern.robot_type
                
        except Exception as e:
            logger.error(f"Erro ao recalcular volume %: {e}")
            return pattern.market_volume_percentage, pattern.robot_type

    async def update_active_robots_volume_percentage(self) -> List[Dict]:
        """
        Atualiza volume % de todos os robôs ativos e detecta mudanças de tipo
        Retorna lista de mudanças de tipo detectadas
        """
        type_changes = []
        
        try:
            for symbol, agents in list(self.active_patterns.items()):
                for agent_id, pattern in list(agents.items()):
                    if pattern.status == RobotStatus.ACTIVE:
                        # Recalcula volume % atual
                        new_volume_pct, new_robot_type = await self.recalculate_market_volume_percentage(
                            symbol, agent_id, pattern
                        )
                        
                        # Verifica se houve mudança de tipo
                        if new_robot_type != pattern.robot_type:
                            # Registra mudança de tipo
                            type_change = {
                                'id': f"{symbol}_{agent_id}_type_change_{datetime.now(timezone.utc).timestamp()}",
                                'symbol': symbol,
                                'agent_id': agent_id,
                                'agent_name': get_agent_name(agent_id),
                                'old_type': pattern.robot_type,
                                'new_type': new_robot_type,
                                'old_volume_percentage': pattern.market_volume_percentage,
                                'new_volume_percentage': new_volume_pct,
                                'timestamp': datetime.now(timezone.utc).isoformat(),
                                'confidence_score': pattern.confidence_score,
                                'total_volume': pattern.total_volume,
                                'total_trades': pattern.total_trades,
                                'change_type': 'type_update',  # Novo tipo de mudança
                                'pattern_type': pattern.pattern_type
                            }
                            
                            type_changes.append(type_change)
                            
                            # Atualiza o padrão em memória
                            pattern.robot_type = new_robot_type
                            pattern.market_volume_percentage = new_volume_pct
                            
                            # Busca pattern_id e salva no banco
                            existing = await self.persistence.get_existing_pattern(symbol, agent_id)
                            if existing:
                                pattern_id = existing[0]
                                await self.persistence.update_twap_pattern(pattern_id, pattern)
                            
                            # Adiciona ao histórico de mudanças
                            self.status_tracker.add_type_change(type_change)
                            
                            logger.info(f"🔄 Mudança de tipo: {symbol} - {get_agent_name(agent_id)} ({agent_id}) ({type_change['old_type']} -> {new_robot_type}) - Volume: {pattern.market_volume_percentage:.2f}% -> {new_volume_pct:.2f}%")
                        
                        elif abs(new_volume_pct - pattern.market_volume_percentage) > 0.5:
                            # Atualiza volume % mesmo sem mudança de tipo (se diferença > 0.5%)
                            pattern.market_volume_percentage = new_volume_pct
                            
                            # Busca pattern_id e atualiza no banco
                            existing = await self.persistence.get_existing_pattern(symbol, agent_id)
                            if existing:
                                pattern_id = existing[0]
                                await self.persistence.update_market_volume_percentage(pattern_id, new_volume_pct)
                            
                            logger.debug(f"📊 Volume % atualizado: {symbol} - {get_agent_name(agent_id)} ({agent_id}): {new_volume_pct:.2f}%")
            
            return type_changes
            
        except Exception as e:
            logger.error(f"Erro ao atualizar volume % dos robôs ativos: {e}")
            return []

    async def detect_stopped_robots(self, inactivity_threshold_minutes: int = 5) -> List[Dict]:
        """Detecta robôs que pararam de operar nas últimas X minutos"""
        try:
            stopped_robots = []
            current_time = datetime.now(timezone.utc)  # ✅ CORRIGIDO: Usa timezone UTC
            cutoff_time = current_time - timedelta(minutes=inactivity_threshold_minutes)
            
            # Verifica cada padrão ativo
            for symbol, agents in self.active_patterns.items():
                for agent_id, pattern in agents.items():
                    # Se o robô não operou nas últimas X minutos
                    if pattern.last_seen < cutoff_time:
                        # Marca como inativo
                        old_status = pattern.status
                        pattern.status = RobotStatus.INACTIVE
                        
                        # Atualiza no banco
                        existing_pattern = await self.persistence.get_existing_pattern(symbol, agent_id)
                        if existing_pattern:
                            pattern_id = existing_pattern[0]
                            await self.persistence.update_twap_pattern(pattern_id, pattern)
                        
                        # Rastreia a mudança de status
                        self.status_tracker.add_status_change(
                            symbol, agent_id, old_status.value, 'inactive', pattern
                        )
                        
                        # Calcula inatividade em minutos
                        inactivity_minutes = (current_time - pattern.last_seen).total_seconds() / 60
                        
                        stopped_robots.append({
                            'symbol': symbol,
                            'agent_id': agent_id,
                            'agent_name': get_agent_name(agent_id),  # ✅ NOVO: Nome da corretora
                            'stopped_at': pattern.last_seen.isoformat(),
                            'inactivity_minutes': inactivity_minutes
                        })
                        
                        logger.info(f"Robô {get_agent_name(agent_id)} ({agent_id}) em {symbol} marcado como inativo (parou há {inactivity_minutes:.1f} minutos)")
            
            return stopped_robots
            
        except Exception as e:
            logger.error(f"Erro ao detectar robôs parados: {e}")
            return []
    
    async def cleanup_inactive_patterns(self, max_inactive_hours: int = 3):
        """Remove padrões que estão inativos há muito tempo (padrão: 3 horas) - LIMPEZA COMPLETA"""
        try:
            # ✅ NOVO: Primeiro faz limpeza direta no banco (pega TODOS os robôs antigos)
            database_cleaned = await self.persistence.cleanup_inactive_patterns_from_database(max_inactive_hours)
            
            # ✅ DEPOIS: Remove da memória (só os que estão ativos na memória)
            current_time = datetime.now(timezone.utc)
            cutoff_time = current_time - timedelta(hours=max_inactive_hours)
            
            patterns_to_remove = []
            
            for symbol, agents in list(self.active_patterns.items()):
                for agent_id, pattern in list(agents.items()):
                    if pattern.status == RobotStatus.INACTIVE and pattern.last_seen < cutoff_time:
                        patterns_to_remove.append((symbol, agent_id))
            
            # Remove da memória
            memory_cleaned = 0
            for symbol, agent_id in patterns_to_remove:
                try:
                    # Remove da memória
                    del self.active_patterns[symbol][agent_id]
                    if not self.active_patterns[symbol]:
                        del self.active_patterns[symbol]
                    
                    memory_cleaned += 1
                    logger.info(f"🧹 Padrão inativo removido da memória: {symbol} - {get_agent_name(agent_id)} ({agent_id}) (inativo há {max_inactive_hours}h)")
                    
                except Exception as e:
                    logger.error(f"❌ Erro ao remover padrão {symbol}-{agent_id} da memória: {e}")
            
            total_cleaned = database_cleaned + memory_cleaned
            logger.info(f"✅ Limpeza completa: {database_cleaned} padrões removidos do banco, {memory_cleaned} da memória = Total: {total_cleaned}")
            return total_cleaned
            
        except Exception as e:
            logger.error(f"Erro ao limpar padrões inativos: {e}")
            return 0

    async def check_robot_inactivity_by_trades(self, inactivity_threshold_minutes: int = 2, use_notification_control: bool = False) -> List[Dict]:
        """Verifica inatividade dos robôs baseado em trades reais das últimas X minutos"""
        try:
            inactive_robots = []
            current_time = datetime.now(timezone.utc)  # ✅ CORRIGIDO: Usa timezone UTC
            cutoff_time = current_time - timedelta(minutes=inactivity_threshold_minutes)
            
            # Verifica cada padrão ativo
            for symbol, agents in list(self.active_patterns.items()):
                for agent_id, pattern in list(agents.items()):
                    # Busca trades reais deste agente nas últimas X minutos
                    recent_trades = await self.persistence.get_recent_ticks_for_agent(
                        symbol, agent_id, inactivity_threshold_minutes
                    )
                    
                    # Se não há trades recentes, marca como inativo
                    if not recent_trades:
                        # Histerese: não marcar inativo se ativado muito recentemente
                        key = (symbol, agent_id)
                        last_activation = self.activation_times.get(key)
                        if last_activation:
                            seconds_since_activation = (current_time - last_activation).total_seconds()
                            if seconds_since_activation < self.activation_cooldown_seconds:
                                logger.debug(f"⏳ Histerese: ignorando inatividade de {symbol}-{agent_id} ({seconds_since_activation:.1f}s desde ativação)")
                                continue
                        
                        # Marca como inativo
                        old_status = pattern.status
                        pattern.status = RobotStatus.INACTIVE
                        
                        # Atualiza no banco
                        existing = await self.persistence.get_existing_pattern(symbol, agent_id)
                        if existing:
                            pattern_id = existing[0]
                            
                            # ✅ NOVO: Controle de notificação para evitar spam
                            newly_notified = False
                            if use_notification_control:
                                # Verifica se já foi notificado como inativo
                                # existing[6] = inactivity_notified (7º campo da tupla)
                                if not existing[6]:  # inactivity_notified = FALSE
                                    # Marca como notificado e rastreia mudança de status
                                    newly_notified = True
                                    await self.persistence.mark_inactivity_notified(pattern_id)
                                    
                                    # Rastreia a mudança de status apenas na primeira notificação
                                    self.status_tracker.add_status_change(
                                        symbol, agent_id, old_status.value, 'inactive', pattern
                                    )
                                    
                                    logger.info(f"🔴 PRIMEIRA NOTIFICAÇÃO: Robô {get_agent_name(agent_id)} ({agent_id}) em {symbol} PAROU de operar")
                                else:
                                    logger.debug(f"📊 Robô {get_agent_name(agent_id)} ({agent_id}) em {symbol} já foi notificado como inativo")
                            else:
                                # Comportamento antigo (sem controle de notificação)
                                newly_notified = True
                                self.status_tracker.add_status_change(
                                    symbol, agent_id, old_status.value, 'inactive', pattern
                                )
                            
                            # Atualiza o padrão no banco
                            await self.persistence.update_twap_pattern(pattern_id, pattern)
                            
                            # Calcula inatividade em minutos
                            inactivity_minutes = (current_time - pattern.last_seen).total_seconds() / 60
                            
                            inactive_robots.append({
                                'symbol': symbol,
                                'agent_id': agent_id,
                                'agent_name': get_agent_name(agent_id),  # ✅ NOVO: Nome da corretora
                                'stopped_at': pattern.last_seen.isoformat(),
                                'inactivity_minutes': inactivity_minutes,
                                'reason': 'no_recent_trades',
                                'newly_notified': newly_notified  # ✅ NOVO: Indica se é primeira notificação
                            })
                            
                            if newly_notified:
                                logger.info(f"🚫 Robô {get_agent_name(agent_id)} ({agent_id}) em {symbol} marcado como inativo - sem trades há {inactivity_minutes:.1f} minutos")
            
            return inactive_robots
            
        except Exception as e:
            logger.error(f"Erro ao verificar inatividade por trades: {e}")
            return []
