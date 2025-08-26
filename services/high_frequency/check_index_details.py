#!/usr/bin/env python3
"""
Script para verificar os detalhes dos índices existentes
"""
import psycopg

def check_index_details():
    """Verifica os detalhes dos índices existentes"""
    
    conn = psycopg.connect('postgres://postgres:postgres@localhost:5432/market_data')
    cur = conn.cursor()
    
    try:
        print('🔍 DETALHES DOS ÍNDICES EXISTENTES:')
        cur.execute("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE tablename IN ('ticks_raw', 'robot_patterns', 'robot_trades')
            ORDER BY tablename, indexname
        """)

        for row in cur.fetchall():
            print(f'\n📋 {row[1]}.{row[2]}:')
            print(f'   {row[3]}')

    except Exception as e:
        print(f'❌ Erro na verificação: {e}')
        import traceback
        traceback.print_exc()
    
    finally:
        cur.close()
        conn.close()
        print('\n✅ Verificação concluída!')

if __name__ == "__main__":
    check_index_details()
