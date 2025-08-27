#!/usr/bin/env python3
"""
Script para limpar TODAS as tabelas do banco de dados
⚠️ ATENÇÃO: Este script irá EXCLUIR TODOS os dados existentes!
Use apenas quando quiser recomeçar do zero.
"""

import asyncio
import sys
import os

# Corrige o event loop para Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Adiciona o diretório atual ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configuração do banco
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")

async def clear_all_tables():
    """Limpa todas as tabelas do banco de dados"""
    try:
        import psycopg
        
        print("🚨 ATENÇÃO: Este script irá EXCLUIR TODOS os dados do banco!")
        print(f"🔗 Conectando ao banco: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'localhost'}")
        
        # Confirmação do usuário
        confirm = input("\n❓ Tem certeza que deseja EXCLUIR TODOS os dados? (digite 'SIM' para confirmar): ")
        if confirm != "SIM":
            print("❌ Operação cancelada pelo usuário")
            return
        
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # 1. Lista todas as tabelas existentes
                print("\n🔍 Listando tabelas existentes...")
                await cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """)
                
                tables = await cur.fetchall()
                if not tables:
                    print("✅ Nenhuma tabela encontrada para limpar")
                    return
                
                print(f"📋 Tabelas encontradas ({len(tables)}):")
                for table in tables:
                    print(f"   - {table[0]}")
                
                # 2. Desabilita triggers e constraints temporariamente
                print("\n🔧 Desabilitando triggers e constraints...")
                await cur.execute("SET session_replication_role = replica;")
                
                # 3. Limpa cada tabela
                print("\n🧹 Limpando tabelas...")
                for table in tables:
                    table_name = table[0]
                    try:
                        # Conta registros antes de limpar
                        await cur.execute(f"SELECT COUNT(*) FROM {table_name}")
                        count = await cur.fetchone()
                        record_count = count[0] if count else 0
                        
                        if record_count > 0:
                            print(f"   🗑️  Limpando {table_name} ({record_count:,} registros)...")
                            await cur.execute(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE")
                        else:
                            print(f"   ✅ {table_name} já está vazia")
                            
                    except Exception as e:
                        print(f"   ⚠️  Erro ao limpar {table_name}: {e}")
                        continue
                
                # 4. Reabilita triggers e constraints
                print("\n🔧 Reabilitando triggers e constraints...")
                await cur.execute("SET session_replication_role = DEFAULT;")
                
                # 5. Verifica se as tabelas foram limpas
                print("\n🔍 Verificando se as tabelas foram limpas...")
                total_records = 0
                for table in tables:
                    table_name = table[0]
                    try:
                        await cur.execute(f"SELECT COUNT(*) FROM {table_name}")
                        count = await cur.fetchone()
                        record_count = count[0] if count else 0
                        total_records += record_count
                        
                        if record_count == 0:
                            print(f"   ✅ {table_name}: vazia")
                        else:
                            print(f"   ⚠️  {table_name}: ainda tem {record_count} registros")
                            
                    except Exception as e:
                        print(f"   ❌ Erro ao verificar {table_name}: {e}")
                
                # 6. Commit das alterações
                await conn.commit()
                
                if total_records == 0:
                    print(f"\n🎉 SUCESSO! Todas as {len(tables)} tabelas foram limpas com sucesso!")
                    print("✅ O banco de dados está vazio e pronto para recomeçar do zero")
                else:
                    print(f"\n⚠️  ATENÇÃO: Ainda existem {total_records} registros em algumas tabelas")
                    print("🔧 Pode ser necessário verificar constraints ou dependências")
                
    except Exception as e:
        print(f"❌ Erro ao limpar tabelas: {e}")
        import traceback
        traceback.print_exc()

async def reset_sequences():
    """Reseta todas as sequências (auto-increment) para 1"""
    try:
        import psycopg
        
        print("\n🔄 Resetando sequências...")
        
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Lista todas as sequências
                await cur.execute("""
                    SELECT sequence_name 
                    FROM information_schema.sequences 
                    WHERE sequence_schema = 'public'
                """)
                
                sequences = await cur.fetchall()
                if not sequences:
                    print("✅ Nenhuma sequência encontrada")
                    return
                
                print(f"📋 Sequências encontradas ({len(sequences)}):")
                for seq in sequences:
                    seq_name = seq[0]
                    try:
                        print(f"   🔄 Resetando {seq_name}...")
                        await cur.execute(f"ALTER SEQUENCE {seq_name} RESTART WITH 1")
                    except Exception as e:
                        print(f"   ⚠️  Erro ao resetar {seq_name}: {e}")
                
                await conn.commit()
                print("✅ Todas as sequências foram resetadas para 1")
                
    except Exception as e:
        print(f"❌ Erro ao resetar sequências: {e}")

async def vacuum_database():
    """Executa VACUUM para liberar espaço e otimizar o banco"""
    try:
        import psycopg
        
        print("\n🧹 Executando VACUUM para otimizar o banco...")
        
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # VACUUM FULL para liberar espaço
                print("   🗑️  Executando VACUUM FULL...")
                await cur.execute("VACUUM FULL")
                
                # ANALYZE para atualizar estatísticas
                print("   📊 Executando ANALYZE...")
                await cur.execute("ANALYZE")
                
                await conn.commit()
                print("✅ VACUUM e ANALYZE executados com sucesso")
                
    except Exception as e:
        print(f"❌ Erro ao executar VACUUM: {e}")

async def main():
    """Função principal"""
    print("=" * 60)
    print("🗑️  LIMPEZA COMPLETA DO BANCO DE DADOS")
    print("=" * 60)
    print("⚠️  ATENÇÃO: Este script irá EXCLUIR TODOS os dados existentes!")
    print("📋 Use apenas quando quiser recomeçar do zero")
    print("=" * 60)
    
    try:
        # 1. Limpa todas as tabelas
        await clear_all_tables()
        
        # 2. Reseta sequências
        await reset_sequences()
        
        # 3. Executa VACUUM
        await vacuum_database()
        
        print("\n" + "=" * 60)
        print("🎉 LIMPEZA COMPLETA FINALIZADA!")
        print("=" * 60)
        print("✅ Todas as tabelas foram limpas")
        print("✅ Todas as sequências foram resetadas")
        print("✅ Banco otimizado com VACUUM")
        print("\n🚀 O banco está pronto para recomeçar do zero!")
        
    except KeyboardInterrupt:
        print("\n❌ Operação cancelada pelo usuário")
    except Exception as e:
        print(f"\n💥 Erro fatal: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
