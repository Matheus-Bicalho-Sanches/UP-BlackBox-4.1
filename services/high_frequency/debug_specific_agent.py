"""
Debug Específico - Agente 122
============================
Analisa especificamente o agente 122 que tem padrão de 500 unidades.
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

async def debug_agent_122():
    """Debug específico do agente 122"""
    
    try:
        logger.info("🔍 Debug Específico - Agente 122")
        logger.info("=" * 40)
        
        # Inicializa persistência
        database_url = "postgres://postgres:postgres@localhost:5432/market_data"
        persistence = RobotPersistence(database_url=database_url)
        
        # Configuração MUITO permissiva para debug
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
        
        # Mostra detalhes dos trades
        logger.info("📈 Primeiros 10 trades do agente 122:")
        for i, trade in enumerate(agent_122_trades[:10]):
            logger.info(f"  {i+1}. {trade.timestamp} - {trade.volume} - raw_trade_type: {trade.raw_trade_type}")
        
        # Analisa volumes únicos
        volumes = [t.volume for t in agent_122_trades]
        unique_volumes = list(set(volumes))
        logger.info(f"📊 Volumes únicos: {sorted(unique_volumes)}")
        
        # Conta frequência de cada volume
        from collections import Counter
        volume_counts = Counter(volumes)
        logger.info("📊 Frequência de volumes:")
        for volume, count in volume_counts.most_common():
            frequency = count / len(volumes)
            logger.info(f"  - {volume}: {count} vezes ({frequency:.2%})")
        
        # Filtra apenas trades à mercado (raw_trade_type=3)
        market_trades = [t for t in agent_122_trades if t.raw_trade_type == 3]
        logger.info(f"📊 Trades à mercado (raw_trade_type=3): {len(market_trades)}")
        
        if market_trades:
            # Analisa volumes dos trades à mercado
            market_volumes = [t.volume for t in market_trades]
            market_volume_counts = Counter(market_volumes)
            logger.info("📊 Frequência de volumes (à mercado):")
            for volume, count in market_volume_counts.most_common():
                frequency = count / len(market_trades)
                logger.info(f"  - {volume}: {count} vezes ({frequency:.2%})")
        
        # Testa detecção
        logger.info("🔍 Testando detecção...")
        patterns = await detector.detect_market_twap_patterns(agent_122_trades)
        
        if patterns:
            logger.info(f"✅ Padrões detectados: {len(patterns)}")
            for pattern in patterns:
                logger.info(f"  - {pattern.symbol} - Agente {pattern.agent_id} - {pattern.robot_type} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.warning("⚠️ Nenhum padrão detectado")
            
            # Debug mais profundo
            logger.info("🔍 Debug mais profundo...")
            
            # Testa com apenas trades à mercado
            if market_trades:
                logger.info(f"🔍 Testando apenas com {len(market_trades)} trades à mercado...")
                market_patterns = await detector.detect_market_twap_patterns(market_trades)
                
                if market_patterns:
                    logger.info(f"✅ Padrões detectados (apenas à mercado): {len(market_patterns)}")
                else:
                    logger.warning("⚠️ Nenhum padrão detectado mesmo com trades à mercado")
                    
                    # Analisa intervalos de tempo
                    if len(market_trades) > 1:
                        intervals = []
                        for i in range(1, len(market_trades)):
                            interval = (market_trades[i].timestamp - market_trades[i-1].timestamp).total_seconds()
                            intervals.append(interval)
                        
                        logger.info(f"📊 Intervalos de tempo: {intervals[:10]}...")
                        logger.info(f"📊 Intervalo médio: {sum(intervals)/len(intervals):.2f}s")
                        logger.info(f"📊 Intervalo mínimo: {min(intervals):.2f}s")
                        logger.info(f"📊 Intervalo máximo: {max(intervals):.2f}s")
        
    except Exception as e:
        logger.error(f"❌ Erro no debug: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_agent_122())
