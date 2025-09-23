"""
Teste de Todos os Tickers
=========================
Verifica quantos tickers estão disponíveis e testa detecção em vários deles.
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

async def test_all_tickers():
    """Testa detecção em todos os tickers disponíveis"""
    
    try:
        logger.info("🧪 Teste de Todos os Tickers")
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
        
        # Busca todos os tickers disponíveis
        logger.info("📊 Buscando tickers disponíveis...")
        
        # Consulta para buscar tickers únicos
        import psycopg
        async with await psycopg.AsyncConnection.connect(database_url) as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                    SELECT DISTINCT symbol 
                    FROM ticks_raw 
                    WHERE timestamp >= NOW() - make_interval(hours => 2)
                    ORDER BY symbol
                """)
                
                rows = await cur.fetchall()
                tickers = [row[0] for row in rows]
        
        logger.info(f"✅ Tickers encontrados: {len(tickers)}")
        logger.info(f"📋 Primeiros 10 tickers: {tickers[:10]}")
        
        # Testa detecção nos primeiros 10 tickers
        logger.info("🔍 Testando detecção nos primeiros 10 tickers...")
        
        results = {}
        for i, ticker in enumerate(tickers[:10]):
            logger.info(f"📊 Testando {i+1}/10: {ticker}")
            
            try:
                # Busca ticks para este ticker
                ticks_data = await persistence.get_recent_ticks(ticker, 2)
                
                if not ticks_data:
                    logger.info(f"  ⚠️ Nenhum tick encontrado para {ticker}")
                    results[ticker] = 0
                    continue
                
                logger.info(f"  📈 Ticks encontrados: {len(ticks_data)}")
                
                # Testa detecção
                patterns = await detector.analyze_symbol(ticker)
                
                if patterns:
                    # Conta tipos de robôs
                    robot_types = {}
                    for pattern in patterns:
                        robot_type = pattern.robot_type
                        if robot_type not in robot_types:
                            robot_types[robot_type] = 0
                        robot_types[robot_type] += 1
                    
                    logger.info(f"  ✅ Padrões detectados: {len(patterns)}")
                    for robot_type, count in robot_types.items():
                        logger.info(f"    - {robot_type}: {count}")
                    
                    results[ticker] = len(patterns)
                else:
                    logger.info(f"  ⚠️ Nenhum padrão detectado para {ticker}")
                    results[ticker] = 0
                    
            except Exception as e:
                logger.error(f"  ❌ Erro ao processar {ticker}: {e}")
                results[ticker] = -1
        
        # Resumo dos resultados
        logger.info("📊 Resumo dos resultados:")
        total_patterns = 0
        tickers_with_patterns = 0
        
        for ticker, count in results.items():
            if count > 0:
                tickers_with_patterns += 1
                total_patterns += count
                logger.info(f"  ✅ {ticker}: {count} padrões")
            elif count == 0:
                logger.info(f"  ⚠️ {ticker}: 0 padrões")
            else:
                logger.info(f"  ❌ {ticker}: ERRO")
        
        logger.info(f"📈 Total de tickers com padrões: {tickers_with_patterns}/10")
        logger.info(f"📈 Total de padrões detectados: {total_patterns}")
        
        # Testa especificamente os tickers mencionados pelo usuário
        logger.info("🔍 Testando tickers específicos mencionados...")
        specific_tickers = ['ABEV3', 'AFHI11', 'B3SA3', 'PETR4', 'VALE3', 'ITUB4']
        
        for ticker in specific_tickers:
            if ticker in results:
                logger.info(f"  {ticker}: {results[ticker]} padrões")
            else:
                logger.info(f"  {ticker}: Não testado")
        
    except Exception as e:
        logger.error(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_all_tickers())
