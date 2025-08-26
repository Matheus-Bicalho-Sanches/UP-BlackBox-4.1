#!/usr/bin/env python3
"""
Script simples para verificar as tabelas existentes
"""
import psycopg

def check_tables():
    """Verifica as tabelas existentes"""
    
    conn = psycopg.connect('postgres://postgres:postgres@localhost:5432/market_data')
    cur = conn.cursor()
    
    try:
        # Lista todas as tabelas
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        tables = cur.fetchall()
        print('📋 TABELAS DISPONÍVEIS:')
        for table in tables:
            print(f'  - {table[0]}')

        # Verifica se as tabelas principais existem
        main_tables = ['ticks_raw', 'robot_patterns', 'robot_trades']
        print('\n🔍 VERIFICAÇÃO DAS TABELAS PRINCIPAIS:')
        for table in main_tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = cur.fetchone()[0]
                print(f'  ✅ {table}: {count} registros')
            except Exception as e:
                print(f'  ❌ {table}: Erro - {e}')

        # Verifica índices existentes
        print('\n🔍 ÍNDICES EXISTENTES:')
        cur.execute("""
            SELECT 
                schemaname,
                tablename,
                indexname
            FROM pg_indexes 
            WHERE tablename IN ('ticks_raw', 'robot_patterns', 'robot_trades')
            ORDER BY tablename, indexname
        """)
        
        indices = cur.fetchall()
        if indices:
            for row in indices:
                print(f'  {row[1]}.{row[2]}')
        else:
            print('  Nenhum índice encontrado nas tabelas principais')

    except Exception as e:
        print(f'❌ Erro na verificação: {e}')
        import traceback
        traceback.print_exc()
    
    finally:
        cur.close()
        conn.close()
        print('\n✅ Verificação concluída!')

if __name__ == "__main__":
    check_tables()
