#!/usr/bin/env python3
"""
Script simples para criar índices um por vez
"""
import psycopg
import time

def create_indexes_simple():
    """Cria os índices de forma simples, um por vez"""
    
    print('🚀 CRIANDO ÍNDICES DE PERFORMANCE (VERSÃO SIMPLES)')
    print('=' * 60)
    
    # Lista de índices para criar
    indexes = [
        {
            'name': 'idx_ticks_raw_symbol_timestamp',
            'sql': 'CREATE INDEX IF NOT EXISTS idx_ticks_raw_symbol_timestamp ON ticks_raw(symbol, timestamp DESC)',
            'description': 'Índice composto para ticks_raw (símbolo + timestamp)'
        },
        {
            'name': 'idx_robot_patterns_symbol_status_timestamp',
            'sql': 'CREATE INDEX IF NOT EXISTS idx_robot_patterns_symbol_status_timestamp ON robot_patterns(symbol, status, last_seen DESC)',
            'description': 'Índice composto para robot_patterns (símbolo + status + timestamp)'
        },
        {
            'name': 'idx_robot_trades_symbol_agent_timestamp',
            'sql': 'CREATE INDEX IF NOT EXISTS idx_robot_trades_symbol_agent_timestamp ON robot_trades(symbol, agent_id, timestamp DESC)',
            'description': 'Índice composto para robot_trades (símbolo + agente + timestamp)'
        },
        {
            'name': 'idx_robot_patterns_agent_symbol',
            'sql': 'CREATE INDEX IF NOT EXISTS idx_robot_patterns_agent_symbol ON robot_patterns(agent_id, symbol, last_seen DESC)',
            'description': 'Índice para robot_patterns (agente + símbolo + timestamp)'
        },
        {
            'name': 'idx_robot_trades_agent_timestamp',
            'sql': 'CREATE INDEX IF NOT EXISTS idx_robot_trades_agent_timestamp ON robot_trades(agent_id, timestamp DESC)',
            'description': 'Índice para robot_trades (agente + timestamp)'
        }
    ]
    
    created_count = 0
    
    for idx_info in indexes:
        print(f'\n🔨 Criando {idx_info["name"]}:')
        print(f'   📝 {idx_info["description"]}')
        
        try:
            # Cria nova conexão para cada índice
            conn = psycopg.connect('postgres://postgres:postgres@localhost:5432/market_data')
            cur = conn.cursor()
            
            start_time = time.time()
            cur.execute(idx_info['sql'])
            conn.commit()
            end_time = time.time()
            
            creation_time = end_time - start_time
            print(f'   ✅ Criado com sucesso em {creation_time:.1f}s')
            created_count += 1
            
            cur.close()
            conn.close()
            
        except Exception as e:
            print(f'   ❌ Erro ao criar: {e}')
            try:
                cur.close()
                conn.close()
            except:
                pass
    
    print('\n' + '=' * 60)
    print(f'🎉 CRIAÇÃO DE ÍNDICES CONCLUÍDA!')
    print(f'   📊 Total de índices criados: {created_count}')
    
    if created_count > 0:
        print('\n📋 PRÓXIMOS PASSOS:')
        print('   1. ✅ Índices criados com sucesso')
        print('   2. 🔄 Reinicie o backend para aplicar os novos índices')
        print('   3. 🧪 Teste a performance no Motion Tracker')
        
        print('\n🚀 IMPACTO ESPERADO NA PERFORMANCE:')
        print('   - Carregamento inicial: 2-5 min → 5-15 segundos')
        print('   - Mudança de aba: 10-30s → 1-3 segundos')
        print('   - Mudança de símbolo: 15-45s → 2-5 segundos')
    
    print('\n✅ Processo concluído!')

if __name__ == "__main__":
    create_indexes_simple()
