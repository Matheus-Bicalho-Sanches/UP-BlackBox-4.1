#!/usr/bin/env python3
"""
Script para executar a migração de adição da coluna robot_type
"""

import asyncio
import psycopg
import os
import logging
from pathlib import Path
import sys

# Fix para Windows - corrige o event loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# URL do banco de dados
DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')

async def execute_migration():
    """Executa a migração para adicionar coluna robot_type"""
    try:
        logger.info("🚀 Iniciando migração para adicionar coluna robot_type...")
        
        # Lê o script SQL
        script_path = Path(__file__).parent / 'add_robot_type_column.sql'
        with open(script_path, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # Conecta ao banco e executa a migração
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Verifica se a coluna já existe
                await cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'robot_patterns' 
                        AND column_name = 'robot_type'
                    )
                """)
                column_exists = await cur.fetchone()
                
                if column_exists[0]:
                    logger.info("✅ Coluna robot_type já existe")
                else:
                    logger.info("🔨 Adicionando coluna robot_type...")
                
                # Executa o script SQL completo
                await cur.execute(sql_script)
                await conn.commit()
                
                logger.info("✅ Migração executada com sucesso!")
                
                # Verifica o resultado
                await cur.execute("""
                    SELECT COUNT(*) FROM robot_patterns WHERE robot_type = 'Robô Tipo 1'
                """)
                count_result = await cur.fetchone()
                logger.info(f"📊 {count_result[0]} registros marcados como 'Robô Tipo 1'")
                
                return True
                
    except Exception as e:
        logger.error(f"❌ Erro durante a migração: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(execute_migration())
    if success:
        logger.info("🎉 Migração concluída com sucesso!")
    else:
        logger.error("💥 Migração falhou!")
        exit(1)
