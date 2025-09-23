"""
Teste com Dados Reais - TWAP à Mercado
=====================================
Script para testar o detector com dados reais do banco.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List
import sys
import os

# Corrige event loop para Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Imports dos modelos
from robot_models import TickData, TradeType, RobotType
from market_twap_detector import MarketTWAPDetector, MarketTWAPConfig
from robot_persistence import RobotPersistence

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_with_real_data():
    """Testa o detector com dados reais do banco"""
    
    try:
        logger.info("🧪 Teste com Dados Reais - TWAP à Mercado")
        logger.info("=" * 50)
        
        # Inicializa persistência
        database_url = "postgres://postgres:postgres@localhost:5432/market_data"
        persistence = RobotPersistence(database_url=database_url)
        
        # Configuração mais permissiva para teste
        config = MarketTWAPConfig()
        config.min_volume_repetitions = 3  # Reduzido de 8 para 3
        config.min_volume_frequency = 0.3  # Reduzido de 0.6 para 0.3
        config.min_confidence = 0.5  # Reduzido de 0.75 para 0.5
        config.min_time_intervals = 2  # Reduzido de 5 para 2
        
        detector = MarketTWAPDetector(config)
        
        # Testa com PETR4
        symbol = "PETR4"
        logger.info(f"📊 Buscando dados reais para {symbol}...")
        
        # Busca ticks das últimas 2 horas
        ticks_data = await persistence.get_recent_ticks(symbol, 2)
        logger.info(f"✅ Ticks encontrados: {len(ticks_data)}")
        
        if not ticks_data:
            logger.error("❌ Nenhum tick encontrado!")
            return
        
        # Converte para TickData
        trades = []
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
                trades.append(buy_tick)
            
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
                trades.append(sell_tick)
        
        logger.info(f"✅ Trades convertidos: {len(trades)}")
        
        # Mostra alguns exemplos
        logger.info("📈 Primeiros 5 trades:")
        for i, trade in enumerate(trades[:5]):
            logger.info(f"  {i+1}. {trade.symbol} - {trade.trade_type.value} - {trade.volume} - Agente {trade.agent_id} - raw_trade_type: {trade.raw_trade_type}")
        
        # Testa detecção
        logger.info("🔍 Testando detecção...")
        patterns = await detector.detect_market_twap_patterns(trades)
        
        if patterns:
            logger.info(f"✅ Padrões detectados: {len(patterns)}")
            for pattern in patterns:
                logger.info(f"  - {pattern.symbol} - Agente {pattern.agent_id} - {pattern.robot_type} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.warning("⚠️ Nenhum padrão detectado")
            
            # Debug: analisa por que não detectou
            logger.info("🔍 Debug: Analisando por que não detectou...")
            
            # Agrupa por agente
            from collections import defaultdict
            agent_trades = defaultdict(list)
            for trade in trades:
                agent_trades[trade.agent_id].append(trade)
            
            logger.info(f"📊 Agentes únicos: {len(agent_trades)}")
            
            for agent_id, agent_trades_list in list(agent_trades.items())[:5]:  # Primeiros 5 agentes
                logger.info(f"  Agente {agent_id}: {len(agent_trades_list)} trades")
                
                # Analisa direções
                buy_trades = [t for t in agent_trades_list if t.trade_type == TradeType.BUY]
                sell_trades = [t for t in agent_trades_list if t.trade_type == TradeType.SELL]
                
                logger.info(f"    - Compras: {len(buy_trades)}")
                logger.info(f"    - Vendas: {len(sell_trades)}")
                
                # Analisa raw_trade_type
                buy_aggressor = [t for t in buy_trades if t.raw_trade_type == 2]
                sell_aggressor = [t for t in sell_trades if t.raw_trade_type == 3]
                
                logger.info(f"    - Compras à mercado (raw_trade_type=2): {len(buy_aggressor)}")
                logger.info(f"    - Vendas à mercado (raw_trade_type=3): {len(sell_aggressor)}")
                
                if buy_aggressor:
                    volumes = [t.volume for t in buy_aggressor]
                    logger.info(f"    - Volumes de compra: {volumes[:10]}...")
                
                if sell_aggressor:
                    volumes = [t.volume for t in sell_aggressor]
                    logger.info(f"    - Volumes de venda: {volumes[:10]}...")
        
    except Exception as e:
        logger.error(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_with_real_data())
