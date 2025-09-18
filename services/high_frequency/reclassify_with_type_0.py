#!/usr/bin/env python3
"""
Script para reclassificar robôs existentes com a nova lógica incluindo Robô Tipo 0
"""

import asyncio
import psycopg
import os
import logging
import sys
from pathlib import Path

# Fix para Windows - corrige o event loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# URL do banco de dados
DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')

async def reclassify_with_type_0():
    """Reclassifica todos os robôs existentes incluindo o novo Robô Tipo 0"""
    try:
        logger.info("🤖 Iniciando reclassificação com Robô Tipo 0...")
        
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Busca todos os robôs com volume % definido
                await cur.execute("""
                    SELECT id, symbol, agent_id, market_volume_percentage, robot_type
                    FROM robot_patterns 
                    WHERE market_volume_percentage IS NOT NULL 
                    ORDER BY market_volume_percentage DESC
                """)
                
                robots = await cur.fetchall()
                logger.info(f"📊 Encontrados {len(robots)} robôs para reclassificar")
                
                if len(robots) == 0:
                    logger.info("ℹ️ Nenhum robô encontrado com volume % calculado")
                    return True
                
                # Contadores para estatísticas
                type_0_count = 0
                type_1_count = 0
                type_2_count = 0
                type_3_count = 0
                updated_count = 0
                
                # Reclassifica cada robô com nova lógica
                for robot in robots:
                    robot_id, symbol, agent_id, volume_pct, current_type = robot
                    
                    # ✅ NOVA LÓGICA: Determina o tipo baseado no volume %
                    if volume_pct > 10.0:
                        new_type = "Robô Tipo 3"
                        type_3_count += 1
                    elif volume_pct >= 5.0:
                        new_type = "Robô Tipo 2"
                        type_2_count += 1
                    elif volume_pct >= 1.0:
                        new_type = "Robô Tipo 1"  # ✅ AJUSTADO: 1% a 5%
                        type_1_count += 1
                    else:
                        new_type = "Robô Tipo 0"  # ✅ NOVO: 0% a 1%
                        type_0_count += 1
                    
                    # Atualiza apenas se o tipo mudou
                    if current_type != new_type:
                        await cur.execute("""
                            UPDATE robot_patterns 
                            SET robot_type = %s 
                            WHERE id = %s
                        """, (new_type, robot_id))
                        
                        updated_count += 1
                        logger.info(f"🔄 {symbol} (Agente {agent_id}): {volume_pct:.2f}% -> {new_type}")
                    else:
                        logger.debug(f"✅ {symbol} (Agente {agent_id}): {volume_pct:.2f}% -> {new_type} (sem mudança)")
                
                # Commit das alterações
                await conn.commit()
                
                # Exibe estatísticas finais
                logger.info("📈 Estatísticas da reclassificação:")
                logger.info(f"   ⚫ Robô Tipo 0 (0-1%): {type_0_count} robôs")
                logger.info(f"   🟢 Robô Tipo 1 (1-5%): {type_1_count} robôs")
                logger.info(f"   🟡 Robô Tipo 2 (5-10%): {type_2_count} robôs")
                logger.info(f"   🔴 Robô Tipo 3 (> 10%): {type_3_count} robôs")
                logger.info(f"   🔄 Robôs atualizados: {updated_count}")
                
                # Verifica a distribuição final
                await cur.execute("""
                    SELECT robot_type, COUNT(*) as count
                    FROM robot_patterns 
                    GROUP BY robot_type 
                    ORDER BY robot_type
                """)
                
                final_distribution = await cur.fetchall()
                logger.info("🎯 Distribuição final no banco:")
                for robot_type, count in final_distribution:
                    logger.info(f"   {robot_type}: {count} robôs")
                
                logger.info("✅ Reclassificação com Tipo 0 concluída com sucesso!")
                return True
                
    except Exception as e:
        logger.error(f"❌ Erro durante a reclassificação: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(reclassify_with_type_0())
    if success:
        print("\n" + "="*70)
        print("🎉 RECLASSIFICAÇÃO COM ROBÔ TIPO 0 CONCLUÍDA!")
        print("="*70)
        print("🤖 NOVA CLASSIFICAÇÃO:")
        print("   ⚫ Robô Tipo 0: Volume 0% a 1% do mercado")
        print("   🟢 Robô Tipo 1: Volume 1% a 5% do mercado")
        print("   🟡 Robô Tipo 2: Volume 5% a 10% do mercado") 
        print("   🔴 Robô Tipo 3: Volume > 10% do mercado")
        print()
        print("📋 PRÓXIMOS PASSOS:")
        print("1. Reinicie o serviço high_frequency")
        print("2. Acesse o Motion Tracker para ver os novos tipos")
        print("3. Verifique se robôs de baixo volume aparecem como Tipo 0")
        print("="*70)
    else:
        print("\n❌ FALHA NA RECLASSIFICAÇÃO!")
        print("Verifique os logs acima para detalhes do erro.")
        sys.exit(1)
