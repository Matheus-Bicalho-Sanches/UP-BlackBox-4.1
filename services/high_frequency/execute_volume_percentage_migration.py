#!/usr/bin/env python3
"""
Script para executar migração da tabela robot_patterns
Adiciona coluna market_volume_percentage para calcular volume em % do mercado
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

# Adiciona o diretório atual ao path para imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import psycopg
except ImportError:
    print("❌ psycopg não encontrado. Instale com: pip install psycopg")
    sys.exit(1)

# Configuração do banco
DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')

async def execute_migration():
    """Executa a migração para adicionar coluna market_volume_percentage"""
    
    print("🚀 Iniciando migração da tabela robot_patterns...")
    print(f"📊 Banco: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else DATABASE_URL}")
    
    try:
        # Conecta ao banco
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Verifica se a coluna já existe
                await cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'robot_patterns' 
                    AND column_name = 'market_volume_percentage'
                """)
                
                if await cur.fetchone():
                    print("✅ Coluna market_volume_percentage já existe!")
                    return
                
                print("📝 Adicionando coluna market_volume_percentage...")
                
                # Adiciona a coluna
                await cur.execute("""
                    ALTER TABLE robot_patterns 
                    ADD COLUMN market_volume_percentage DECIMAL(5,2) DEFAULT 0.00
                """)
                
                # Cria índice para otimizar queries por volume %
                print("🔍 Criando índice para otimização...")
                await cur.execute("""
                    CREATE INDEX idx_robot_patterns_volume_percentage 
                    ON robot_patterns(market_volume_percentage DESC)
                """)
                
                # Adiciona comentário explicativo
                await cur.execute("""
                    COMMENT ON COLUMN robot_patterns.market_volume_percentage 
                    IS 'Porcentagem do volume total do mercado movimentado por este robô (0.00 a 100.00)'
                """)
                
                # Commit das alterações
                await conn.commit()
                
                print("✅ Migração concluída com sucesso!")
                print("📊 Coluna market_volume_percentage adicionada")
                print("🔍 Índice de otimização criado")
                print("💬 Comentário explicativo adicionado")
                
                # Verifica a estrutura atualizada
                await cur.execute("""
                    SELECT column_name, data_type, column_default, is_nullable
                    FROM information_schema.columns 
                    WHERE table_name = 'robot_patterns' 
                    AND column_name = 'market_volume_percentage'
                """)
                
                column_info = await cur.fetchone()
                if column_info:
                    print(f"\n📋 Detalhes da nova coluna:")
                    print(f"   Nome: {column_info[0]}")
                    print(f"   Tipo: {column_info[1]}")
                    print(f"   Padrão: {column_info[2]}")
                    print(f"   Nullable: {column_info[3]}")
                
    except Exception as e:
        print(f"💥 Erro durante a migração: {e}")
        print("📋 Verifique se:")
        print("   - O banco está rodando")
        print("   - As credenciais estão corretas")
        print("   - Você tem permissões para alterar a tabela")
        sys.exit(1)

async def verify_migration():
    """Verifica se a migração foi aplicada corretamente"""
    
    print("\n🔍 Verificando migração...")
    
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Verifica se a coluna existe
                await cur.execute("""
                    SELECT COUNT(*) 
                    FROM robot_patterns 
                    WHERE market_volume_percentage IS NOT NULL
                """)
                
                result = await cur.fetchone()
                count = result[0] if result else 0
                print(f"📊 Registros com volume %: {count}")
                
                # Verifica se há dados para calcular
                await cur.execute("""
                    SELECT COUNT(*) 
                    FROM robot_patterns 
                    WHERE total_volume > 0
                """)
                
                result = await cur.fetchone()
                total_count = result[0] if result else 0
                print(f"📊 Total de robôs com volume: {total_count}")
                
                if total_count > 0:
                    print("💡 Para calcular volume % dos robôs existentes, reinicie o backend")
                    print("   O sistema calculará automaticamente ao processar novos trades")
                
    except Exception as e:
        print(f"⚠️ Erro ao verificar migração: {e}")

async def main():
    """Função principal"""
    
    print("=" * 60)
    print("🔧 MIGRAÇÃO: Volume em % do Mercado")
    print("=" * 60)
    
    # Executa migração
    await execute_migration()
    
    # Verifica resultado
    await verify_migration()
    
    print("\n" + "=" * 60)
    print("✅ Migração concluída!")
    print("🚀 Reinicie o backend para aplicar as mudanças")
    print("=" * 60)

if __name__ == "__main__":
    # Configura event loop para Windows
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    # Executa migração
    asyncio.run(main())
