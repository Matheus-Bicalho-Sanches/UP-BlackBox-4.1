#!/usr/bin/env python3
"""Script para criar a tabela robot_trades"""

import asyncio
import sys
import os

# Corrige o event loop para Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Adiciona o diretório atual ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import DATABASE_URL

async def create_robot_trades_table():
    """Cria a tabela robot_trades se ela não existir"""
    try:
        import psycopg
        
        print(f"🔗 Conectando ao banco: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'localhost'}")
        
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Verifica se a tabela já existe
                await cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'robot_trades'
                    )
                """)
                
                exists = await cur.fetchone()
                if exists[0]:
                    print("✅ Tabela robot_trades já existe!")
                    return
                
                print("🔨 Criando tabela robot_trades...")
                
                # Cria a tabela robot_trades
                await cur.execute("""
                    CREATE TABLE robot_trades (
                        id BIGSERIAL PRIMARY KEY,
                        robot_pattern_id BIGINT REFERENCES robot_patterns(id) ON DELETE CASCADE,
                        symbol TEXT NOT NULL,
                        agent_id INTEGER NOT NULL,
                        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                        price DOUBLE PRECISION NOT NULL,
                        volume INTEGER NOT NULL,
                        side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
                        pattern_id BIGINT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                """)
                
                print("✅ Tabela robot_trades criada com sucesso!")
                
                # Cria índices para performance
                print("🔨 Criando índices...")
                
                await cur.execute("""
                    CREATE INDEX idx_robot_trades_symbol_agent_timestamp 
                    ON robot_trades(symbol, agent_id, timestamp DESC)
                """)
                
                await cur.execute("""
                    CREATE INDEX idx_robot_trades_agent_timestamp 
                    ON robot_trades(agent_id, timestamp DESC)
                """)
                
                await cur.execute("""
                    CREATE INDEX idx_robot_trades_timestamp 
                    ON robot_trades(timestamp DESC)
                """)
                
                print("✅ Índices criados com sucesso!")
                
                # Verifica a estrutura criada
                await cur.execute("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns 
                    WHERE table_name = 'robot_trades'
                    ORDER BY ordinal_position
                """)
                
                columns = await cur.fetchall()
                print(f"\n📋 Estrutura da tabela robot_trades ({len(columns)} colunas):")
                for col in columns:
                    nullable = "NULL" if col[2] == "YES" else "NOT NULL"
                    print(f"   - {col[0]}: {col[1]} ({nullable})")
                
                await conn.commit()
                print("\n🎉 Tabela robot_trades criada e configurada com sucesso!")
                
    except Exception as e:
        print(f"❌ Erro ao criar tabela: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(create_robot_trades_table())
