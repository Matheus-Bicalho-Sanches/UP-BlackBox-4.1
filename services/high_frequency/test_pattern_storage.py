"""
Teste de Armazenamento de Padrões
=================================
Verifica se os padrões estão sendo armazenados corretamente na memória.
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
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_pattern_storage():
    """Testa o armazenamento de padrões"""
    
    try:
        logger.info("🧪 Teste de Armazenamento de Padrões")
        logger.info("=" * 40)
        
        # Inicializa persistência
        database_url = "postgres://postgres:postgres@localhost:5432/market_data"
        persistence = RobotPersistence(database_url=database_url)
        
        # Configuração
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
        
        # Verifica estado inicial
        logger.info("🔍 Estado inicial:")
        logger.info(f"  - active_patterns: {len(detector.active_patterns)} símbolos")
        logger.info(f"  - active_patterns keys: {list(detector.active_patterns.keys())}")
        
        # Testa com ABEV3
        symbol = "ABEV3"
        logger.info(f"📊 Analisando {symbol}...")
        
        patterns = await detector.analyze_symbol(symbol)
        
        logger.info(f"✅ Padrões detectados: {len(patterns)}")
        
        # Verifica estado após análise
        logger.info("🔍 Estado após análise:")
        logger.info(f"  - active_patterns: {len(detector.active_patterns)} símbolos")
        logger.info(f"  - active_patterns keys: {list(detector.active_patterns.keys())}")
        
        if symbol in detector.active_patterns:
            logger.info(f"  - {symbol}: {len(detector.active_patterns[symbol])} agentes")
            
            # Mostra alguns padrões
            for agent_id, pattern in list(detector.active_patterns[symbol].items())[:3]:
                logger.info(f"    - Agente {agent_id}: {pattern.robot_type} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.warning(f"  - {symbol}: Não encontrado em active_patterns")
        
        # Testa get_active_patterns
        logger.info("🔍 Testando get_active_patterns...")
        active_patterns = detector.get_active_patterns()
        
        if active_patterns:
            logger.info(f"✅ get_active_patterns retornou: {len(active_patterns)} símbolos")
            for symbol, agents in active_patterns.items():
                logger.info(f"  - {symbol}: {len(agents)} agentes")
        else:
            logger.warning("⚠️ get_active_patterns retornou vazio")
        
        # Testa com outro símbolo
        symbol2 = "PETR4"
        logger.info(f"📊 Analisando {symbol2}...")
        
        patterns2 = await detector.analyze_symbol(symbol2)
        
        logger.info(f"✅ Padrões detectados: {len(patterns2)}")
        
        # Verifica estado final
        logger.info("🔍 Estado final:")
        logger.info(f"  - active_patterns: {len(detector.active_patterns)} símbolos")
        logger.info(f"  - active_patterns keys: {list(detector.active_patterns.keys())}")
        
        # Testa get_active_patterns final
        active_patterns_final = detector.get_active_patterns()
        
        if active_patterns_final:
            logger.info(f"✅ get_active_patterns final: {len(active_patterns_final)} símbolos")
            total_patterns = sum(len(agents) for agents in active_patterns_final.values())
            logger.info(f"📊 Total de padrões: {total_patterns}")
        else:
            logger.warning("⚠️ get_active_patterns final retornou vazio")
        
    except Exception as e:
        logger.error(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_pattern_storage())
