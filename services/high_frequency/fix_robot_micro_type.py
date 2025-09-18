#!/usr/bin/env python3
"""
Script para corrigir robôs com tipo "Robô Micro" para "Robô Tipo 0"
"""

import asyncio
import psycopg
import os
import logging
import sys

# Fix para Windows - corrige o event loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# URL do banco de dados
DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')

async def fix_robot_micro_types():
    """Corrige robôs com tipo 'Robô Micro' para 'Robô Tipo 0'"""
    try:
        logger.info("🔧 Corrigindo robôs com tipo 'Robô Micro'...")
        
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Verifica quantos robôs têm tipo "Robô Micro"
                await cur.execute("""
                    SELECT COUNT(*) FROM robot_patterns WHERE robot_type = 'Robô Micro'
                """)
                micro_count = await cur.fetchone()
                logger.info(f"📊 Encontrados {micro_count[0]} robôs com tipo 'Robô Micro'")
                
                if micro_count[0] == 0:
                    logger.info("✅ Nenhum robô com tipo 'Robô Micro' encontrado")
                    return True
                
                # Atualiza todos os "Robô Micro" para "Robô Tipo 0"
                await cur.execute("""
                    UPDATE robot_patterns 
                    SET robot_type = 'Robô Tipo 0'
                    WHERE robot_type = 'Robô Micro'
                """)
                
                # Commit das alterações
                await conn.commit()
                
                logger.info(f"✅ {micro_count[0]} robôs atualizados de 'Robô Micro' para 'Robô Tipo 0'")
                
                # Verifica distribuição final
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
                
                logger.info("✅ Correção de tipos concluída com sucesso!")
                return True
                
    except Exception as e:
        logger.error(f"❌ Erro durante a correção: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(fix_robot_micro_types())
    if success:
        print("\n" + "="*60)
        print("🎉 CORREÇÃO DE TIPOS CONCLUÍDA!")
        print("="*60)
        print("✅ Todos os 'Robô Micro' foram convertidos para 'Robô Tipo 0'")
        print("✅ Sistema agora usa apenas tipos padronizados")
        print()
        print("📋 PRÓXIMOS PASSOS:")
        print("1. Reinicie o serviço high_frequency")
        print("2. Teste a interface Motion Tracker")
        print("3. Verifique se cards aparecem na aba Start/Stop")
        print("="*60)
    else:
        print("\n❌ FALHA NA CORREÇÃO!")
        print("Verifique os logs acima para detalhes do erro.")
        sys.exit(1)
