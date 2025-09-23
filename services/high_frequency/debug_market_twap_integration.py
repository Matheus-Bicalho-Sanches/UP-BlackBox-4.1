"""
Debug da Integração TWAP à Mercado
=================================
Verifica por que o detector não está encontrando padrões na integração.
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
from market_twap_detector import MarketTWAPDetector, MarketTWAPConfig

# Configuração de logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

async def debug_market_twap_integration():
    """Debug da integração TWAP à Mercado"""
    
    try:
        logger.info("🔍 Debug da Integração TWAP à Mercado")
        logger.info("=" * 45)
        
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
        
        # Busca ticks diretamente
        ticks_data = await persistence.get_recent_ticks(symbol, 2)
        logger.info(f"✅ Ticks encontrados: {len(ticks_data)}")
        
        if not ticks_data:
            logger.error("❌ Nenhum tick encontrado!")
            return
        
        # Converte para TickData (igual ao que o detector faz)
        all_trades = []
        for tick in ticks_data:
            # Para compras
            if tick['buy_agent']:
                buy_tick = TickData(
                    symbol=tick['symbol'],
                    price=tick['price'],
                    volume=tick['volume'],
                    timestamp=tick['timestamp'],
                    trade_type=TradeType.BUY,
                    agent_id=tick['buy_agent'],
                    exchange=tick['exchange'],
                    raw_trade_type=tick.get('trade_type', 2)
                )
                all_trades.append(buy_tick)
            
            # Para vendas
            if tick['sell_agent']:
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
                all_trades.append(sell_tick)
        
        logger.info(f"✅ Trades convertidos: {len(all_trades)}")
        
        # Testa o detector TWAP à Mercado diretamente
        logger.info("🔍 Testando detector TWAP à Mercado diretamente...")
        market_patterns = await detector.market_twap_detector.detect_market_twap_patterns(all_trades)
        
        if market_patterns:
            logger.info(f"✅ Padrões TWAP à Mercado detectados: {len(market_patterns)}")
            for pattern in market_patterns:
                logger.info(f"  - {pattern.symbol} - Agente {pattern.agent_id} - {pattern.robot_type} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.warning("⚠️ Nenhum padrão TWAP à Mercado detectado")
            
            # Debug mais profundo
            logger.info("🔍 Debug mais profundo...")
            
            # Agrupa por agente e símbolo
            from collections import defaultdict
            grouped_trades = defaultdict(list)
            
            for trade in all_trades:
                key = (trade.agent_id, trade.symbol)
                grouped_trades[key].append(trade)
            
            logger.info(f"📊 Agentes únicos: {len(grouped_trades)}")
            
            # Analisa alguns agentes
            for (agent_id, symbol), agent_trades in list(grouped_trades.items())[:5]:
                logger.info(f"  Agente {agent_id} em {symbol}: {len(agent_trades)} trades")
                
                # Analisa direções
                buy_trades = [t for t in agent_trades if t.trade_type == TradeType.BUY]
                sell_trades = [t for t in agent_trades if t.trade_type == TradeType.SELL]
                
                logger.info(f"    - Compras: {len(buy_trades)}")
                logger.info(f"    - Vendas: {len(sell_trades)}")
                
                # Analisa raw_trade_type
                buy_aggressor = [t for t in buy_trades if t.raw_trade_type == 2]
                sell_aggressor = [t for t in sell_trades if t.raw_trade_type == 3]
                
                logger.info(f"    - Compras à mercado (raw_trade_type=2): {len(buy_aggressor)}")
                logger.info(f"    - Vendas à mercado (raw_trade_type=3): {len(sell_aggressor)}")
                
                # Testa detecção para este agente específico
                if buy_aggressor or sell_aggressor:
                    logger.info(f"    🔍 Testando detecção para agente {agent_id}...")
                    agent_patterns = await detector.market_twap_detector.detect_market_twap_patterns(agent_trades)
                    if agent_patterns:
                        logger.info(f"    ✅ {len(agent_patterns)} padrões detectados para agente {agent_id}")
                    else:
                        logger.info(f"    ⚠️ Nenhum padrão detectado para agente {agent_id}")
        
    except Exception as e:
        logger.error(f"❌ Erro no debug: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_market_twap_integration())
