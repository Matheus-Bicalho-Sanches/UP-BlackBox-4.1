#!/usr/bin/env python3
"""
Script para criar os índices de performance de forma segura
"""
import psycopg
import time
import os

def create_performance_indexes():
    """Cria os índices de performance mais importantes"""
    
    # Conecta ao banco
    conn = psycopg.connect('postgres://postgres:postgres@localhost:5432/market_data')
    cur = conn.cursor()
    
    try:
        print('🚀 INICIANDO CRIAÇÃO DE ÍNDICES DE PERFORMANCE')
        print('=' * 60)
        
        # Lista de índices para criar
        indexes_to_create = [
            {
                'name': 'idx_ticks_raw_symbol_timestamp',
                'sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticks_raw_symbol_timestamp ON ticks_raw(symbol, timestamp DESC)',
                'description': 'Índice composto para ticks_raw (símbolo + timestamp)',
                'estimated_time': '30-60 segundos'
            },
            {
                'name': 'idx_robot_patterns_symbol_status_timestamp',
                'sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robot_patterns_symbol_status_timestamp ON robot_patterns(symbol, status, last_seen DESC)',
                'description': 'Índice composto para robot_patterns (símbolo + status + timestamp)',
                'estimated_time': '5-10 segundos'
            },
            {
                'name': 'idx_robot_trades_symbol_agent_timestamp',
                'sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robot_trades_symbol_agent_timestamp ON robot_trades(symbol, agent_id, timestamp DESC)',
                'description': 'Índice composto para robot_trades (símbolo + agente + timestamp)',
                'estimated_time': '2-5 segundos'
            },
            {
                'name': 'idx_robot_patterns_agent_symbol',
                'sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robot_patterns_agent_symbol ON robot_patterns(agent_id, symbol, last_seen DESC)',
                'description': 'Índice para robot_patterns (agente + símbolo + timestamp)',
                'estimated_time': '5-10 segundos'
            },
            {
                'name': 'idx_robot_trades_agent_timestamp',
                'sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_robot_trades_agent_timestamp ON robot_trades(agent_id, timestamp DESC)',
                'description': 'Índice para robot_trades (agente + timestamp)',
                'estimated_time': '2-5 segundos'
            }
        ]
        
        # Verifica índices existentes
        print('🔍 VERIFICANDO ÍNDICES EXISTENTES...')
        cur.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename IN ('ticks_raw', 'robot_patterns', 'robot_trades')
            AND indexname LIKE 'idx_%'
        """)
        
        existing_indexes = [row[0] for row in cur.fetchall()]
        print(f'   ✅ Índices existentes: {len(existing_indexes)}')
        for idx in existing_indexes:
            print(f'      - {idx}')
        
        # Cria os índices
        print('\n🚀 CRIANDO ÍNDICES DE PERFORMANCE...')
        created_count = 0
        
        for idx_info in indexes_to_create:
            index_name = idx_info['name']
            
            # Verifica se já existe
            if index_name in existing_indexes:
                print(f'   ⏭️  {index_name}: Já existe, pulando...')
                continue
            
            print(f'\n   🔨 Criando {index_name}:')
            print(f'      📝 {idx_info["description"]}')
            print(f'      ⏱️  Tempo estimado: {idx_info["estimated_time"]}')
            
            try:
                start_time = time.time()
                cur.execute(idx_info['sql'])
                conn.commit()
                end_time = time.time()
                
                creation_time = end_time - start_time
                print(f'      ✅ Criado com sucesso em {creation_time:.1f}s')
                created_count += 1
                
            except Exception as e:
                print(f'      ❌ Erro ao criar: {e}')
                conn.rollback()
        
        # Resultado final
        print('\n' + '=' * 60)
        print(f'🎉 CRIAÇÃO DE ÍNDICES CONCLUÍDA!')
        print(f'   📊 Total de índices criados: {created_count}')
        print(f'   📊 Total de índices existentes: {len(existing_indexes) + created_count}')
        
        if created_count > 0:
            print('\n📋 PRÓXIMOS PASSOS:')
            print('   1. ✅ Índices criados com sucesso')
            print('   2. 🔄 Reinicie o backend para aplicar os novos índices')
            print('   3. 🧪 Teste a performance no Motion Tracker')
            print('   4. 📊 Monitore os logs para ver a melhoria')
            
            print('\n🚀 IMPACTO ESPERADO NA PERFORMANCE:')
            print('   - Carregamento inicial: 2-5 min → 5-15 segundos')
            print('   - Mudança de aba: 10-30s → 1-3 segundos')
            print('   - Mudança de símbolo: 15-45s → 2-5 segundos')
        else:
            print('\nℹ️  Todos os índices já existem!')
        
    except Exception as e:
        print(f'❌ Erro na criação dos índices: {e}')
        import traceback
        traceback.print_exc()
        conn.rollback()
    
    finally:
        cur.close()
        conn.close()
        print('\n✅ Processo concluído!')

if __name__ == "__main__":
    create_performance_indexes()
