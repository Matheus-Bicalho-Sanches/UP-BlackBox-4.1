"""
Debug da Análise de Intervalos
=============================
Verifica por que a análise de intervalos não está detectando padrões regulares.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List
import sys

# Corrige event loop para Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Imports dos modelos
from robot_models import TickData, TradeType, RobotType
from market_twap_detector import MarketTWAPDetector, MarketTWAPConfig
from robot_persistence import RobotPersistence

# Configuração de logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def debug_interval_analysis():
    """Debug da análise de intervalos"""
    
    try:
        logger.info("🔍 Debug da Análise de Intervalos")
        logger.info("=" * 35)
        
        # Inicializa persistência
        database_url = "postgres://postgres:postgres@localhost:5432/market_data"
        persistence = RobotPersistence(database_url=database_url)
        
        # Configuração MUITO permissiva
        config = MarketTWAPConfig()
        config.min_volume_repetitions = 2  # Mínimo possível
        config.min_volume_frequency = 0.1  # 10% apenas
        config.min_confidence = 0.1  # 10% apenas
        config.min_time_intervals = 1  # Mínimo possível
        config.time_consistency_threshold = 0.1  # Muito baixo
        
        detector = MarketTWAPDetector(config)
        
        # Busca dados do PETR4
        symbol = "PETR4"
        ticks_data = await persistence.get_recent_ticks(symbol, 2)
        
        # Filtra apenas trades do agente 122
        agent_122_trades = []
        for tick in ticks_data:
            if tick['sell_agent'] == 122:  # Agente 122 como vendedor
                sell_tick = TickData(
                    symbol=tick['symbol'],
                    price=tick['price'],
                    volume=tick['volume'],
                    timestamp=tick['timestamp'],
                    trade_type=TradeType.SELL,
                    agent_id=tick['sell_agent'],
                    exchange=tick['exchange'],
                    raw_trade_type=tick.get('trade_type', 3)
                )
                agent_122_trades.append(sell_tick)
        
        logger.info(f"📊 Trades do agente 122: {len(agent_122_trades)}")
        
        if not agent_122_trades:
            logger.error("❌ Nenhum trade do agente 122 encontrado!")
            return
        
        # Filtra apenas trades à mercado
        market_trades = [t for t in agent_122_trades if t.raw_trade_type == 3]
        logger.info(f"📊 Trades à mercado: {len(market_trades)}")
        
        if not market_trades:
            logger.error("❌ Nenhum trade à mercado encontrado!")
            return
        
        # Filtra apenas trades de volume 100
        volume_100_trades = [t for t in market_trades if t.volume == 100]
        logger.info(f"📊 Trades de volume 100: {len(volume_100_trades)}")
        
        if len(volume_100_trades) < 2:
            logger.error("❌ Poucos trades de volume 100 para analisar!")
            return
        
        # Testa análise de intervalos manualmente
        logger.info("🔍 Testando análise de intervalos manualmente...")
        
        intervals = []
        for i in range(1, len(volume_100_trades)):
            interval = (volume_100_trades[i].timestamp - volume_100_trades[i-1].timestamp).total_seconds()
            intervals.append(interval)
        
        logger.info(f"📊 Intervalos calculados: {len(intervals)}")
        logger.info(f"📊 Intervalos: {intervals[:10]}...")
        
        if intervals:
            import statistics
            avg_interval = statistics.mean(intervals)
            std_interval = statistics.stdev(intervals) if len(intervals) > 1 else 0
            
            logger.info(f"📊 Estatísticas dos intervalos:")
            logger.info(f"  - Média: {avg_interval:.2f}s")
            logger.info(f"  - Desvio padrão: {std_interval:.2f}s")
            logger.info(f"  - Mínimo: {min(intervals):.2f}s")
            logger.info(f"  - Máximo: {max(intervals):.2f}s")
            
            # Calcula consistência temporal
            if avg_interval > 0:
                consistency = 1.0 - (std_interval / avg_interval)
            else:
                consistency = 0.0
            
            logger.info(f"  - Consistência: {consistency:.2f}")
            
            # Verifica critérios
            is_regular = consistency >= config.time_consistency_threshold
            logger.info(f"  - É regular? {is_regular} (threshold: {config.time_consistency_threshold})")
            
            # Verifica se está dentro do limite máximo
            max_interval_seconds = config.max_interval_minutes * 60
            within_limit = avg_interval <= max_interval_seconds
            logger.info(f"  - Dentro do limite? {within_limit} (máximo: {max_interval_seconds}s)")
            
            # Verifica número mínimo de intervalos
            min_intervals = len(intervals) >= config.min_time_intervals
            logger.info(f"  - Intervalos suficientes? {min_intervals} (mínimo: {config.min_time_intervals})")
        
        # Testa detecção
        logger.info("🔍 Testando detecção...")
        patterns = await detector.detect_market_twap_patterns(agent_122_trades)
        
        if patterns:
            logger.info(f"✅ Padrões detectados: {len(patterns)}")
            for pattern in patterns:
                logger.info(f"  - {pattern.symbol} - Agente {pattern.agent_id} - {pattern.robot_type} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.warning("⚠️ Nenhum padrão detectado")
            
            # Debug mais profundo - testa cada passo da detecção
            logger.info("🔍 Debug passo a passo...")
            
            # Testa _analyze_volume_patterns
            volume_patterns = detector._analyze_volume_patterns(market_trades)
            logger.info(f"📊 Padrões de volume encontrados: {len(volume_patterns)}")
            for volume, volume_trades in volume_patterns.items():
                logger.info(f"  - Volume {volume}: {len(volume_trades)} trades")
            
            # Testa _analyze_time_intervals para volume 100
            if 100 in volume_patterns:
                volume_100_trades = volume_patterns[100]
                logger.info(f"🔍 Testando análise de intervalos para volume 100...")
                time_analysis = detector._analyze_time_intervals(volume_100_trades)
                logger.info(f"📊 Análise temporal: {time_analysis}")
        
    except Exception as e:
        logger.error(f"❌ Erro no debug: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_interval_analysis())
