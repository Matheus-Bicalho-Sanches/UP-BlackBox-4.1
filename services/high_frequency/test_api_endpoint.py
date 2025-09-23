"""
Teste do Endpoint da API
========================
Verifica se o endpoint /robots/patterns está retornando todos os tickers.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List
import sys
import json

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

async def test_api_endpoint():
    """Testa o endpoint da API"""
    
    try:
        logger.info("🧪 Teste do Endpoint da API")
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
        
        # Simula o que o endpoint /robots/patterns faz
        logger.info("🔍 Testando get_active_patterns...")
        active_patterns = detector.get_active_patterns()
        
        if active_patterns:
            logger.info(f"✅ Padrões ativos em memória: {len(active_patterns)} símbolos")
            
            total_patterns = 0
            tickers_with_patterns = []
            
            for symbol, agents in active_patterns.items():
                total_patterns += len(agents)
                tickers_with_patterns.append(symbol)
                logger.info(f"  - {symbol}: {len(agents)} agentes")
                
                # Mostra alguns exemplos de tipos de robôs
                robot_types = {}
                for agent_id, pattern in agents.items():
                    robot_type = pattern.robot_type
                    if robot_type not in robot_types:
                        robot_types[robot_type] = 0
                    robot_types[robot_type] += 1
                
                logger.info(f"    Tipos: {robot_types}")
            
            logger.info(f"📊 Total de padrões ativos: {total_patterns}")
            logger.info(f"📊 Tickers com padrões: {len(tickers_with_patterns)}")
            logger.info(f"📋 Lista de tickers: {sorted(tickers_with_patterns)}")
            
            # Verifica se os tickers mencionados pelo usuário estão presentes
            mentioned_tickers = ['ABEV3', 'AFHI11', 'B3SA3', 'PETR4', 'VALE3', 'ITUB4']
            logger.info("🔍 Verificando tickers específicos:")
            for ticker in mentioned_tickers:
                if ticker in tickers_with_patterns:
                    count = len(active_patterns[ticker])
                    logger.info(f"  ✅ {ticker}: {count} padrões")
                else:
                    logger.info(f"  ❌ {ticker}: Não encontrado")
            
            # Simula o formato que seria retornado pela API
            logger.info("🔍 Simulando formato da API...")
            api_response = []
            
            for symbol, agents in active_patterns.items():
                for agent_id, pattern in agents.items():
                    api_response.append({
                        'symbol': pattern.symbol,
                        'agent_id': pattern.agent_id,
                        'robot_type': pattern.robot_type,
                        'confidence_score': pattern.confidence_score,
                        'total_volume': pattern.total_volume,
                        'total_trades': pattern.total_trades,
                        'status': pattern.status,
                        'first_seen': pattern.first_seen.isoformat(),
                        'last_seen': pattern.last_seen.isoformat()
                    })
            
            logger.info(f"📊 Total de itens na resposta da API: {len(api_response)}")
            
            # Agrupa por tipo de robô
            robot_types = {}
            for item in api_response:
                robot_type = item['robot_type']
                if robot_type not in robot_types:
                    robot_types[robot_type] = 0
                robot_types[robot_type] += 1
            
            logger.info("📊 Tipos de robôs na resposta:")
            for robot_type, count in robot_types.items():
                logger.info(f"  - {robot_type}: {count}")
            
        else:
            logger.warning("⚠️ Nenhum padrão ativo em memória")
        
    except Exception as e:
        logger.error(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_api_endpoint())
