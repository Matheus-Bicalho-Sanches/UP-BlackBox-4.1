"""
Teste do Detector TWAP à Mercado
===============================
Script para testar a detecção de padrões TWAP à Mercado
com dados simulados e reais.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List

# Imports dos modelos
from robot_models import TickData, TradeType, RobotType
from market_twap_detector import MarketTWAPDetector, MarketTWAPConfig

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_market_twap_detector():
    """Testa o detector TWAP à Mercado com dados simulados"""
    
    try:
        # Importa o detector
        from market_twap_detector import MarketTWAPDetector, MarketTWAPConfig
        from robot_models import TickData, TradeType
        
        logger.info("🧪 Iniciando teste do detector TWAP à Mercado...")
        
        # Configuração de teste (mais permissiva)
        config = MarketTWAPConfig()
        config.min_volume_repetitions = 5
        config.min_confidence = 0.6
        config.min_volume_frequency = 0.5
        
        detector = MarketTWAPDetector(config)
        
        # Teste 1: Padrão perfeito de TWAP à Mercado
        logger.info("📊 Teste 1: Padrão perfeito (300 unidades a cada 2s)")
        test_trades_1 = create_perfect_market_twap_pattern()
        patterns_1 = await detector.detect_market_twap_patterns(test_trades_1)
        
        if patterns_1:
            logger.info(f"✅ Teste 1 passou: {len(patterns_1)} padrões detectados")
            for pattern in patterns_1:
                logger.info(f"   - {pattern.symbol} - Agente {pattern.agent_id} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.error("❌ Teste 1 falhou: Nenhum padrão detectado")
        
        # Teste 2: Padrão com ruído (trades aleatórios misturados)
        logger.info("📊 Teste 2: Padrão com ruído (trades aleatórios misturados)")
        test_trades_2 = create_noisy_market_twap_pattern()
        patterns_2 = await detector.detect_market_twap_patterns(test_trades_2)
        
        if patterns_2:
            logger.info(f"✅ Teste 2 passou: {len(patterns_2)} padrões detectados")
            for pattern in patterns_2:
                logger.info(f"   - {pattern.symbol} - Agente {pattern.agent_id} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.error("❌ Teste 2 falhou: Nenhum padrão detectado")
        
        # Teste 3: Padrão de alta frequência (1 segundo)
        logger.info("📊 Teste 3: Padrão de alta frequência (1s)")
        test_trades_3 = create_high_frequency_pattern()
        patterns_3 = await detector.detect_market_twap_patterns(test_trades_3)
        
        if patterns_3:
            logger.info(f"✅ Teste 3 passou: {len(patterns_3)} padrões detectados")
            for pattern in patterns_3:
                logger.info(f"   - {pattern.symbol} - Agente {pattern.agent_id} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.error("❌ Teste 3 falhou: Nenhum padrão detectado")
        
        # Teste 4: Padrão de baixa frequência (2 minutos)
        logger.info("📊 Teste 4: Padrão de baixa frequência (2min)")
        test_trades_4 = create_low_frequency_pattern()
        patterns_4 = await detector.detect_market_twap_patterns(test_trades_4)
        
        if patterns_4:
            logger.info(f"✅ Teste 4 passou: {len(patterns_4)} padrões detectados")
            for pattern in patterns_4:
                logger.info(f"   - {pattern.symbol} - Agente {pattern.agent_id} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.error("❌ Teste 4 falhou: Nenhum padrão detectado")
        
        # Resumo dos testes
        total_tests = 4
        passed_tests = sum([
            len(patterns_1) > 0,
            len(patterns_2) > 0,
            len(patterns_3) > 0,
            len(patterns_4) > 0
        ])
        
        logger.info(f"📈 Resumo: {passed_tests}/{total_tests} testes passaram")
        
        return passed_tests == total_tests
        
    except Exception as e:
        logger.error(f"❌ Erro durante teste: {e}")
        return False

def create_perfect_market_twap_pattern() -> List[TickData]:
    """Cria um padrão perfeito de TWAP à Mercado"""
    trades = []
    base_time = datetime.now(timezone.utc)
    
    # 10 trades de 300 unidades a cada 2 segundos
    for i in range(10):
        trade = TickData(
            symbol="PETR4",
            price=32.50 + (i * 0.01),
            volume=300,  # Volume fixo
            timestamp=base_time + timedelta(seconds=i * 2),  # Intervalo fixo
            trade_type=TradeType.BUY,  # Direção única
            agent_id=85,  # BTG
            exchange="B3",
            raw_trade_type=2  # ✅ NOVO: Comprador foi agressor (à mercado)
        )
        trades.append(trade)
    
    return trades

def create_noisy_market_twap_pattern() -> List[TickData]:
    """Cria um padrão TWAP à Mercado com ruído (outros trades misturados)"""
    trades = []
    base_time = datetime.now(timezone.utc)
    
    # Trades do padrão TWAP à Mercado (500 unidades a cada 30 segundos)
    for i in range(8):
        trade = TickData(
            symbol="VALE3",
            price=45.20 + (i * 0.02),
            volume=500,  # Volume fixo
            timestamp=base_time + timedelta(seconds=i * 30),  # Intervalo fixo
            trade_type=TradeType.SELL,  # Direção única
            agent_id=120,  # Genial
            exchange="B3",
            raw_trade_type=3  # ✅ NOVO: Vendedor foi agressor (à mercado)
        )
        trades.append(trade)
    
    # Adiciona trades aleatórios (ruído)
    import random
    for i in range(15):
        trade = TickData(
            symbol="VALE3",
            price=45.20 + random.uniform(-0.5, 0.5),
            volume=random.choice([100, 200, 800, 1000]),  # Volumes aleatórios
            timestamp=base_time + timedelta(seconds=random.randint(0, 300)),
            trade_type=random.choice([TradeType.BUY, TradeType.SELL]),
            agent_id=120,  # Mesmo agente
            exchange="B3"
        )
        trades.append(trade)
    
    # Ordena por timestamp
    trades.sort(key=lambda t: t.timestamp)
    return trades

def create_high_frequency_pattern() -> List[TickData]:
    """Cria um padrão de alta frequência (1 segundo)"""
    trades = []
    base_time = datetime.now(timezone.utc)
    
    # 15 trades de 1000 unidades a cada 1 segundo
    for i in range(15):
        trade = TickData(
            symbol="ITUB4",
            price=28.50 + (i * 0.005),
            volume=1000,  # Volume fixo
            timestamp=base_time + timedelta(seconds=i * 1),  # Intervalo de 1 segundo
            trade_type=TradeType.BUY,  # Direção única
            agent_id=3,  # XP
            exchange="B3",
            raw_trade_type=2  # ✅ NOVO: Comprador foi agressor (à mercado)
        )
        trades.append(trade)
    
    return trades

def create_low_frequency_pattern() -> List[TickData]:
    """Cria um padrão de baixa frequência (2 minutos)"""
    trades = []
    base_time = datetime.now(timezone.utc)
    
    # 6 trades de 2000 unidades a cada 2 minutos
    for i in range(6):
        trade = TickData(
            symbol="BBDC4",
            price=25.80 + (i * 0.03),
            volume=2000,  # Volume fixo
            timestamp=base_time + timedelta(minutes=i * 2),  # Intervalo de 2 minutos
            trade_type=TradeType.SELL,  # Direção única
            agent_id=72,  # Bradesco
            exchange="B3",
            raw_trade_type=3  # ✅ NOVO: Vendedor foi agressor (à mercado)
        )
        trades.append(trade)
    
    return trades

async def main():
    """Função principal de teste"""
    
    logger.info("🧪 Teste do Detector TWAP à Mercado")
    logger.info("=" * 40)
    
    success = await test_market_twap_detector()
    
    if success:
        logger.info("🎉 Todos os testes passaram! O detector está funcionando corretamente.")
    else:
        logger.error("❌ Alguns testes falharam. Verifique a implementação.")
    
    return success

if __name__ == "__main__":
    asyncio.run(main())
