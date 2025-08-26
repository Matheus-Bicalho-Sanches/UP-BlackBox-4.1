#!/usr/bin/env python3
"""
Script para analisar a estrutura das tabelas e índices existentes
"""
import psycopg
import os

def analyze_table_structure():
    """Analisa a estrutura das tabelas principais"""
    
    # Conecta ao banco
    conn = psycopg.connect('postgres://postgres:postgres@localhost:5432/market_data')
    cur = conn.cursor()
    
    try:
        # Verifica estrutura da tabela ticks_raw
        print('🔍 ESTRUTURA DA TABELA TICKS_RAW:')
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'ticks_raw' 
            ORDER BY ordinal_position
        """)
        for row in cur.fetchall():
            print(f'  {row[0]}: {row[1]} ({row[2]})')

        # Verifica estrutura da tabela robot_patterns
        print('\n🔍 ESTRUTURA DA TABELA ROBOT_PATTERNS:')
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'robot_patterns' 
            ORDER BY ordinal_position
        """)
        for row in cur.fetchall():
            print(f'  {row[0]}: {row[1]} ({row[2]})')

        # Verifica estrutura da tabela robot_trades
        print('\n🔍 ESTRUTURA DA TABELA ROBOT_TRADES:')
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'robot_trades' 
            ORDER BY ordinal_position
        """)
        for row in cur.fetchall():
            print(f'  {row[0]}: {row[1]} ({row[2]})')

        # Verifica índices existentes
        print('\n🔍 ÍNDICES EXISTENTES:')
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
        
        indices = cur.fetchall()
        if indices:
            for row in indices:
                print(f'  {row[1]}.{row[2]}: {row[3][:100]}...')
        else:
            print('  Nenhum índice encontrado nas tabelas principais')

        # Verifica estatísticas de uso das tabelas
        print('\n📊 ESTATÍSTICAS DE USO:')
        cur.execute("""
            SELECT 
                schemaname,
                tablename,
                n_tup_ins as inserts,
                n_tup_upd as updates,
                n_tup_del as deletes,
                n_live_tup as live_rows,
                n_dead_tup as dead_rows
            FROM pg_stat_user_tables 
            WHERE tablename IN ('ticks_raw', 'robot_patterns', 'robot_trades')
            ORDER BY n_live_tup DESC
        """)
        
        for row in cur.fetchall():
            print(f'  {row[1]}: {row[5]} linhas ativas, {row[2]} inserts, {row[3]} updates')

    except Exception as e:
        print(f'❌ Erro na análise: {e}')
        import traceback
        traceback.print_exc()
    
    finally:
        cur.close()
        conn.close()
        print('\n✅ Análise concluída!')

if __name__ == "__main__":
    analyze_table_structure()
