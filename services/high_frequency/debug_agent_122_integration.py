"""
Debug do Agente 122 na Integração
================================
Verifica por que o agente 122 não está sendo detectado na integração.
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
from robot_models import TickData, TradeType, RobotType, TWAPDetectionConfig
from robot_detector import TWAPDetector
from robot_persistence import RobotPersistence

# Configuração de logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def debug_agent_122_integration():
    """Debug do agente 122 na integração"""
    
    try:
        logger.info("🔍 Debug do Agente 122 na Integração")
        logger.info("=" * 40)
        
        # Inicializa persistência
        database_url = "postgres://postgres:postgres@localhost:5432/market_data"
        persistence = RobotPersistence(database_url=database_url)
        
        # Configuração (igual ao main.py)
        config = TWAPDetectionConfig(
            min_trades=5,
            min_total_volume=1000,
            max_price_variation=0.05,
            min_frequency_minutes=0.001,
            max_frequency_minutes=10.0,
            min_confidence=0.3,
            active_recency_minutes=60.0
        )
        
        detector = TWAPDetector(config, persistence)
        
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
        
        # Mostra configuração do detector
        logger.info(f"📊 Configuração do detector TWAP à Mercado:")
        logger.info(f"  - min_volume_repetitions: {detector.market_twap_detector.config.min_volume_repetitions}")
        logger.info(f"  - min_volume_frequency: {detector.market_twap_detector.config.min_volume_frequency}")
        logger.info(f"  - min_confidence: {detector.market_twap_detector.config.min_confidence}")
        logger.info(f"  - min_time_intervals: {detector.market_twap_detector.config.min_time_intervals}")
        
        # Testa detecção diretamente
        logger.info("🔍 Testando detecção diretamente...")
        patterns = await detector.market_twap_detector.detect_market_twap_patterns(agent_122_trades)
        
        if patterns:
            logger.info(f"✅ Padrões detectados: {len(patterns)}")
            for pattern in patterns:
                logger.info(f"  - {pattern.symbol} - Agente {pattern.agent_id} - {pattern.robot_type} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.warning("⚠️ Nenhum padrão detectado")
            
            # Debug mais profundo
            logger.info("🔍 Debug mais profundo...")
            
            # Filtra apenas trades à mercado
            market_trades = [t for t in agent_122_trades if t.raw_trade_type == 3]
            logger.info(f"📊 Trades à mercado: {len(market_trades)}")
            
            if market_trades:
                # Analisa volumes
                volumes = [t.volume for t in market_trades]
                from collections import Counter
                volume_counts = Counter(volumes)
                
                logger.info("📊 Análise de volumes:")
                for volume, count in volume_counts.most_common():
                    frequency = count / len(market_trades)
                    logger.info(f"  - {volume}: {count} vezes ({frequency:.2%})")
                    
                    # Verifica se atende aos critérios
                    if count >= detector.market_twap_detector.config.min_volume_repetitions and frequency >= detector.market_twap_detector.config.min_volume_frequency:
                        logger.info(f"    ✅ Atende aos critérios!")
                        
                        # Testa análise de intervalos
                        volume_trades = [t for t in market_trades if t.volume == volume]
                        if len(volume_trades) > 1:
                            intervals = []
                            for i in range(1, len(volume_trades)):
                                interval = (volume_trades[i].timestamp - volume_trades[i-1].timestamp).total_seconds()
                                intervals.append(interval)
                            
                            avg_interval = sum(intervals) / len(intervals)
                            logger.info(f"    - Intervalo médio: {avg_interval:.2f}s")
                            logger.info(f"    - Intervalos: {intervals[:5]}...")
                            
                            # Verifica se está dentro do limite
                            if avg_interval <= (detector.market_twap_detector.config.max_interval_minutes * 60):
                                logger.info(f"    ✅ Intervalo dentro do limite ({detector.market_twap_detector.config.max_interval_minutes} min)")
                            else:
                                logger.info(f"    ❌ Intervalo muito alto ({avg_interval/60:.2f} min > {detector.market_twap_detector.config.max_interval_minutes} min)")
                    else:
                        logger.info(f"    ❌ Não atende aos critérios (min_repetitions: {detector.market_twap_detector.config.min_volume_repetitions}, min_frequency: {detector.market_twap_detector.config.min_volume_frequency})")
        
    except Exception as e:
        logger.error(f"❌ Erro no debug: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_agent_122_integration())
