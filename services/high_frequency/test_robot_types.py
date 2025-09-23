"""
Teste de Tipos de Robôs
======================
Verifica se os padrões estão sendo classificados corretamente como TWAP à Mercado.
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

async def test_robot_types():
    """Testa se os padrões estão sendo classificados corretamente"""
    
    try:
        logger.info("🧪 Teste de Tipos de Robôs")
        logger.info("=" * 30)
        
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
        
        # Testa com PETR4
        symbol = "PETR4"
        logger.info(f"📊 Analisando {symbol}...")
        
        patterns = await detector.analyze_symbol(symbol)
        
        if patterns:
            logger.info(f"✅ Padrões detectados: {len(patterns)}")
            
            # Agrupa por tipo de robô
            robot_types = {}
            for pattern in patterns:
                robot_type = pattern.robot_type
                if robot_type not in robot_types:
                    robot_types[robot_type] = []
                robot_types[robot_type].append(pattern)
            
            logger.info("📊 Tipos de robôs detectados:")
            for robot_type, type_patterns in robot_types.items():
                logger.info(f"  - {robot_type}: {len(type_patterns)} padrões")
                
                # Mostra alguns exemplos
                for i, pattern in enumerate(type_patterns[:3]):
                    logger.info(f"    {i+1}. Agente {pattern.agent_id} - Confiança: {pattern.confidence_score:.2f} - Volume: {pattern.total_volume}")
        else:
            logger.warning("⚠️ Nenhum padrão detectado")
        
    except Exception as e:
        logger.error(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_robot_types())
