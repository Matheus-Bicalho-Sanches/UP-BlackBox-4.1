#!/usr/bin/env python3
"""
Script para adicionar coluna inactivity_notified na tabela robot_patterns
"""

import os
import sys
from pathlib import Path
import psycopg
from dotenv import load_dotenv

# Adiciona o diretório raiz ao path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_PROJECT_ROOT_STR = str(_PROJECT_ROOT)
if _PROJECT_ROOT_STR not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT_STR)

# Carrega variáveis de ambiente
load_dotenv()
load_dotenv(_PROJECT_ROOT / ".env.local")

def add_inactivity_notified_column():
    """Adiciona a coluna inactivity_notified na tabela robot_patterns"""
    
    # URL do banco de dados
    database_url = os.getenv('DATABASE_URL') or "postgresql://postgres:postgres@localhost:5432/high_frequency"
    
    print(f"🔗 Conectando ao banco: {database_url.split('@')[1] if '@' in database_url else 'URL oculta'}")
    
    try:
        # Conecta ao banco
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                
                print("📊 Verificando estrutura atual da tabela...")
                
                # Verifica se a coluna já existe
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'robot_patterns' 
                    AND column_name = 'inactivity_notified'
                """)
                
                if cur.fetchone():
                    print("✅ Coluna 'inactivity_notified' já existe!")
                    return
                
                print("🔧 Adicionando coluna 'inactivity_notified'...")
                
                # Adiciona a coluna
                cur.execute("""
                    ALTER TABLE robot_patterns 
                    ADD COLUMN inactivity_notified BOOLEAN DEFAULT FALSE
                """)
                
                print("✅ Coluna adicionada com sucesso!")
                
                # Atualiza registros existentes
                print("🔄 Atualizando registros existentes...")
                cur.execute("""
                    UPDATE robot_patterns 
                    SET inactivity_notified = FALSE 
                    WHERE inactivity_notified IS NULL
                """)
                
                updated_rows = cur.rowcount
                print(f"✅ {updated_rows} registros atualizados!")
                
                # Verifica a estrutura final
                print("📋 Verificando estrutura final...")
                cur.execute("""
                    SELECT 
                        column_name, 
                        data_type, 
                        is_nullable, 
                        column_default
                    FROM information_schema.columns 
                    WHERE table_name = 'robot_patterns' 
                    AND column_name = 'inactivity_notified'
                """)
                
                column_info = cur.fetchone()
                if column_info:
                    print(f"✅ Coluna criada: {column_info}")
                
                # Mostra alguns registros de exemplo
                print("📊 Registros de exemplo:")
                cur.execute("""
                    SELECT 
                        id, 
                        symbol, 
                        agent_id, 
                        status, 
                        inactivity_notified,
                        last_seen
                    FROM robot_patterns 
                    LIMIT 5
                """)
                
                rows = cur.fetchall()
                for row in rows:
                    print(f"   ID: {row[0]}, Symbol: {row[1]}, Agent: {row[2]}, Status: {row[3]}, Notified: {row[4]}, Last Seen: {row[5]}")
                
                # Commit das alterações
                conn.commit()
                print("💾 Alterações salvas no banco!")
                
    except Exception as e:
        print(f"❌ Erro ao adicionar coluna: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    print("🚀 Iniciando adição da coluna inactivity_notified...")
    
    if add_inactivity_notified_column():
        print("🎉 Coluna adicionada com sucesso!")
    else:
        print("💥 Falha ao adicionar coluna!")
        sys.exit(1)
