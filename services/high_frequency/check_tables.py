#!/usr/bin/env python3
"""Script para verificar tabelas existentes no banco"""

import asyncio
import sys
import os

# Corrige o event loop para Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Adiciona o diretório atual ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import DATABASE_URL

async def check_tables():
    """Verifica quais tabelas existem no banco"""
    try:
        import psycopg
        
        print(f"🔗 Conectando ao banco: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'localhost'}")
        
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                # Lista todas as tabelas
                await cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """)
                
                tables = await cur.fetchall()
                print(f"\n📋 Tabelas encontradas ({len(tables)}):")
                for table in tables:
                    print(f"   - {table[0]}")
                
                # Verifica se as tabelas principais existem
                main_tables = ['ticks_raw', 'robot_patterns', 'robot_trades', 'candles_1m']
                print(f"\n🔍 Verificando tabelas principais:")
                for table in main_tables:
                    await cur.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = %s
                        )
                    """, (table,))
                    
                    exists = await cur.fetchone()
                    status = "✅ EXISTE" if exists[0] else "❌ NÃO EXISTE"
                    print(f"   {table}: {status}")
                
                # Verifica estrutura da tabela robot_patterns se existir
                print(f"\n🔍 Verificando estrutura de robot_patterns:")
                await cur.execute("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns 
                    WHERE table_name = 'robot_patterns'
                    ORDER BY ordinal_position
                """)
                
                columns = await cur.fetchall()
                if columns:
                    print(f"   Colunas encontradas ({len(columns)}):")
                    for col in columns:
                        nullable = "NULL" if col[2] == "YES" else "NOT NULL"
                        print(f"     - {col[0]}: {col[1]} ({nullable})")
                else:
                    print("   ❌ Tabela robot_patterns não encontrada")
                
    except Exception as e:
        print(f"❌ Erro durante a verificação: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_tables())
