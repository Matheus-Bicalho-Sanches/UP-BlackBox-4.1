#!/usr/bin/env python3
"""
Script para testar o controle de notificação de inatividade
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

def test_notification_control():
    """Testa o controle de notificação de inatividade"""
    
    # URL do banco de dados
    database_url = os.getenv('DATABASE_URL') or "postgresql://postgres:postgres@localhost:5432/high_frequency"
    
    print(f"🔗 Conectando ao banco: {database_url.split('@')[1] if '@' in database_url else 'URL oculta'}")
    
    try:
        # Conecta ao banco
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                
                print("📊 Verificando estrutura da tabela robot_patterns...")
                
                # Verifica se a coluna existe
                cur.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns 
                    WHERE table_name = 'robot_patterns' 
                    AND column_name = 'inactivity_notified'
                """)
                
                column_info = cur.fetchone()
                if column_info:
                    print(f"✅ Coluna 'inactivity_notified' encontrada: {column_info}")
                else:
                    print("❌ Coluna 'inactivity_notified' não encontrada!")
                    return False
                
                # Verifica alguns registros
                print("\n📋 Registros de exemplo:")
                cur.execute("""
                    SELECT 
                        id, 
                        symbol, 
                        agent_id, 
                        status, 
                        inactivity_notified,
                        last_seen
                    FROM robot_patterns 
                    ORDER BY last_seen DESC
                    LIMIT 5
                """)
                
                rows = cur.fetchall()
                if rows:
                    for row in rows:
                        print(f"   ID: {row[0]}, Symbol: {row[1]}, Agent: {row[2]}, Status: {row[3]}, Notified: {row[4]}, Last Seen: {row[5]}")
                else:
                    print("   Nenhum registro encontrado na tabela robot_patterns")
                
                # Testa a funcionalidade de marcar como notificado
                print("\n🧪 Testando funcionalidade de notificação...")
                
                if rows:
                    test_pattern_id = rows[0][0]  # Primeiro ID encontrado
                    print(f"   Testando com padrão ID: {test_pattern_id}")
                    
                    # Marca como notificado
                    cur.execute("""
                        UPDATE robot_patterns 
                        SET inactivity_notified = TRUE 
                        WHERE id = %s
                    """, (test_pattern_id,))
                    
                    # Verifica se foi atualizado
                    cur.execute("""
                        SELECT inactivity_notified 
                        FROM robot_patterns 
                        WHERE id = %s
                    """, (test_pattern_id,))
                    
                    result = cur.fetchone()
                    if result and result[0]:
                        print(f"   ✅ Padrão {test_pattern_id} marcado como notificado com sucesso!")
                    else:
                        print(f"   ❌ Falha ao marcar padrão {test_pattern_id} como notificado")
                    
                    # Reseta o flag para o teste
                    cur.execute("""
                        UPDATE robot_patterns 
                        SET inactivity_notified = FALSE 
                        WHERE id = %s
                    """, (test_pattern_id,))
                    
                    print(f"   🔄 Flag resetado para teste")
                    
                    # Commit das alterações
                    conn.commit()
                    print("💾 Testes salvos no banco!")
                else:
                    print("   ⚠️ Não há registros para testar")
                
                return True
                
    except Exception as e:
        print(f"❌ Erro durante o teste: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🧪 Iniciando teste do controle de notificação...")
    
    if test_notification_control():
        print("🎉 Teste concluído com sucesso!")
    else:
        print("💥 Falha no teste!")
        sys.exit(1)
