"""
Script para Deploy do Novo Tipo "TWAP à Mercado"
===============================================
Este script implementa o novo tipo de robô que detecta padrões de
volume fixo com intervalos regulares em meio a outros trades.
"""

import asyncio
import psycopg
import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def deploy_market_twap():
    """Deploy completo do novo tipo TWAP à Mercado"""
    
    database_url = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')
    
    try:
        logger.info("🚀 Iniciando deploy do tipo 'TWAP à Mercado'...")
        
        async with await psycopg.AsyncConnection.connect(database_url) as conn:
            async with conn.cursor() as cur:
                
                # 1. Verifica se o tipo já existe
                await cur.execute("""
                    SELECT COUNT(*) FROM robot_patterns 
                    WHERE robot_type = 'TWAP à Mercado'
                """)
                
                existing_count = await cur.fetchone()[0]
                
                if existing_count > 0:
                    logger.info(f"✅ Tipo 'TWAP à Mercado' já existe com {existing_count} padrões")
                    return True
                
                # 2. Verifica padrões existentes que podem ser reclassificados
                logger.info("🔍 Analisando padrões existentes para possível reclassificação...")
                
                await cur.execute("""
                    SELECT id, symbol, agent_id, pattern_type, confidence_score, 
                           total_volume, total_trades, frequency_minutes
                    FROM robot_patterns 
                    WHERE pattern_type = 'TWAP' 
                    AND confidence_score >= 0.7
                    ORDER BY confidence_score DESC
                    LIMIT 100
                """)
                
                existing_patterns = await cur.fetchall()
                logger.info(f"📊 Encontrados {len(existing_patterns)} padrões TWAP para análise")
                
                # 3. Analisa padrões para reclassificação
                reclassified_count = 0
                
                for pattern_id, symbol, agent_id, pattern_type, confidence, volume, trades, frequency in existing_patterns:
                    
                    # Critérios para reclassificar como TWAP à Mercado:
                    # - Alta confiança (>= 0.8)
                    # - Frequência regular (entre 0.1 e 5 minutos)
                    # - Volume consistente (muitos trades)
                    
                    should_reclassify = (
                        confidence >= 0.8 and
                        0.1 <= frequency <= 5.0 and
                        trades >= 10
                    )
                    
                    if should_reclassify:
                        await cur.execute("""
                            UPDATE robot_patterns 
                            SET robot_type = 'TWAP à Mercado',
                                pattern_type = 'MARKET_TWAP'
                            WHERE id = %s
                        """, (pattern_id,))
                        
                        reclassified_count += 1
                        logger.info(f"🔄 Reclassificado: {symbol} - Agente {agent_id} -> TWAP à Mercado")
                
                await conn.commit()
                
                # 4. Estatísticas finais
                await cur.execute("""
                    SELECT robot_type, COUNT(*) 
                    FROM robot_patterns 
                    GROUP BY robot_type 
                    ORDER BY robot_type
                """)
                
                stats = await cur.fetchall()
                
                logger.info("📈 Distribuição final por tipo:")
                for robot_type, count in stats:
                    logger.info(f"  {robot_type}: {count} robôs")
                
                logger.info(f"✅ Deploy concluído! {reclassified_count} padrões reclassificados para 'TWAP à Mercado'")
                
                return True
                
    except Exception as e:
        logger.error(f"❌ Erro durante deploy: {e}")
        return False

async def test_market_twap_detection():
    """Testa a detecção de padrões TWAP à Mercado"""
    
    try:
        logger.info("🧪 Testando detecção de padrões TWAP à Mercado...")
        
        # Importa o detector
        from market_twap_detector import MarketTWAPDetector, MarketTWAPConfig
        from robot_models import TickData, TradeType
        
        # Cria detector com configuração de teste
        config = MarketTWAPConfig()
        config.min_volume_repetitions = 5  # Reduzido para teste
        config.min_confidence = 0.6        # Reduzido para teste
        
        detector = MarketTWAPDetector(config)
        
        # Cria dados de teste
        test_trades = []
        base_time = datetime.now(timezone.utc)
        
        # Simula padrão TWAP à Mercado: 300 unidades a cada 2 segundos
        for i in range(10):
            trade = TickData(
                symbol="PETR4",
                price=32.50 + (i * 0.01),
                volume=300,  # Volume fixo
                timestamp=base_time + timedelta(seconds=i * 2),  # Intervalo fixo
                trade_type=TradeType.BUY,  # Direção única
                agent_id=85,  # BTG
                exchange="B3"
            )
            test_trades.append(trade)
        
        # Testa detecção
        patterns = await detector.detect_market_twap_patterns(test_trades)
        
        if patterns:
            logger.info(f"✅ Teste bem-sucedido! Detectados {len(patterns)} padrões:")
            for pattern in patterns:
                logger.info(f"  - {pattern.symbol} - Agente {pattern.agent_id} - Confiança: {pattern.confidence_score:.2f}")
        else:
            logger.warning("⚠️ Nenhum padrão detectado no teste")
        
        return len(patterns) > 0
        
    except Exception as e:
        logger.error(f"❌ Erro no teste: {e}")
        return False

async def main():
    """Função principal"""
    
    logger.info("🤖 Deploy do Tipo 'TWAP à Mercado' - Sistema Motion Tracker")
    logger.info("=" * 60)
    
    # 1. Testa detecção
    logger.info("1️⃣ Testando detecção de padrões...")
    test_success = await test_market_twap_detection()
    
    if not test_success:
        logger.error("❌ Teste falhou. Abortando deploy.")
        return False
    
    # 2. Executa deploy
    logger.info("2️⃣ Executando deploy...")
    deploy_success = await deploy_market_twap()
    
    if not deploy_success:
        logger.error("❌ Deploy falhou.")
        return False
    
    # 3. Instruções finais
    logger.info("3️⃣ Deploy concluído com sucesso!")
    logger.info("")
    logger.info("📋 Próximos passos:")
    logger.info("1. Reinicie o backend: python main.py")
    logger.info("2. Acesse a interface: http://localhost:3000/dashboard/blackbox-multi/motion-tracker")
    logger.info("3. Verifique o novo tipo 'TWAP à Mercado' nos filtros")
    logger.info("4. Monitore a detecção de novos padrões")
    
    return True

if __name__ == "__main__":
    asyncio.run(main())
