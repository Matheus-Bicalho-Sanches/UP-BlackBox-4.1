#!/usr/bin/env python3
"""
Script para verificar o tamanho dos dados na tabela TimescaleDB
Mostra informações sobre espaço em disco, número de registros e compressão
"""

import os
import psycopg
from datetime import datetime, timedelta
import sys

# Configuração do banco de dados
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")

def format_bytes(size_bytes):
    """Converte bytes para formato legível"""
    if size_bytes == 0:
        return "0 B"
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.2f} {size_names[i]}"

def check_database_size():
    """Verifica o tamanho total do banco de dados"""
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # Tamanho total do banco
                cur.execute("""
                    SELECT 
                        pg_size_pretty(pg_database_size(current_database())) as db_size,
                        pg_database_size(current_database()) as db_size_bytes
                """)
                db_info = cur.fetchone()
                
                print("=" * 60)
                print("📊 INFORMAÇÕES DO BANCO DE DADOS")
                print("=" * 60)
                print(f"Banco: {os.getenv('PGDATABASE', 'market_data')}")
                print(f"Tamanho total: {db_info[0]}")
                print(f"Tamanho em bytes: {db_info[1]:,}")
                print()
                
                return db_info[1]
    except Exception as e:
        print(f"❌ Erro ao verificar tamanho do banco: {e}")
        return 0

def check_table_sizes():
    """Verifica o tamanho das tabelas"""
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # Tamanho das tabelas
                cur.execute("""
                    SELECT 
                        schemaname,
                        tablename,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
                        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
                        pg_relation_size(schemaname||'.'||tablename) as table_size_bytes
                    FROM pg_tables 
                    WHERE schemaname = 'public'
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                """)
                
                tables = cur.fetchall()
                
                print("📋 TAMANHO DAS TABELAS")
                print("=" * 60)
                print(f"{'Tabela':<25} {'Tamanho Total':<15} {'Tabela':<15} {'Índices':<15}")
                print("-" * 60)
                
                total_size = 0
                for table in tables:
                    schema, name, total_size_pretty, total_size_bytes, table_size_pretty, table_size_bytes = table
                    index_size = total_size_bytes - table_size_bytes
                    index_size_pretty = format_bytes(index_size)
                    
                    print(f"{name:<25} {total_size_pretty:<15} {table_size_pretty:<15} {index_size_pretty:<15}")
                    total_size += total_size_bytes
                
                print("-" * 60)
                print(f"Total: {format_bytes(total_size)}")
                print()
                
                return total_size
    except Exception as e:
        print(f"❌ Erro ao verificar tamanho das tabelas: {e}")
        return 0

def check_ticks_table_details():
    """Verifica detalhes específicos da tabela de ticks"""
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # Verifica se a tabela ticks_raw existe
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'ticks_raw'
                    )
                """)
                
                if not cur.fetchone()[0]:
                    print("⚠️  Tabela 'ticks_raw' não encontrada!")
                    return
                
                # Conta registros
                cur.execute("SELECT COUNT(*) FROM ticks_raw")
                total_records = cur.fetchone()[0]
                
                # Primeiro e último registro
                cur.execute("""
                    SELECT 
                        MIN(timestamp) as first_record,
                        MAX(timestamp) as last_record
                    FROM ticks_raw
                """)
                time_range = cur.fetchone()
                
                # Registros por dia (últimos 7 dias)
                cur.execute("""
                    SELECT 
                        DATE(timestamp) as date,
                        COUNT(*) as count
                    FROM ticks_raw 
                    WHERE timestamp >= NOW() - INTERVAL '7 days'
                    GROUP BY DATE(timestamp)
                    ORDER BY date DESC
                """)
                daily_counts = cur.fetchall()
                
                # Símbolos únicos
                cur.execute("SELECT COUNT(DISTINCT symbol) FROM ticks_raw")
                unique_symbols = cur.fetchone()[0]
                
                # Tamanho da tabela usando funções SQL nativas
                cur.execute("""
                    SELECT 
                        pg_size_pretty(pg_total_relation_size('ticks_raw')) as total_size,
                        pg_size_pretty(pg_relation_size('ticks_raw')) as table_size,
                        pg_size_pretty(pg_total_relation_size('ticks_raw') - pg_relation_size('ticks_raw')) as index_size
                """)
                size_info = cur.fetchone()
                
                # Calcula tamanho estimado por registro
                cur.execute("""
                    SELECT 
                        pg_column_size(symbol) + 
                        pg_column_size(exchange) + 
                        pg_column_size(price) + 
                        pg_column_size(volume) + 
                        pg_column_size(timestamp) + 
                        COALESCE(pg_column_size(trade_id), 0) + 
                        COALESCE(pg_column_size(buy_agent), 0) + 
                        COALESCE(pg_column_size(sell_agent), 0) + 
                        COALESCE(pg_column_size(trade_type), 0) + 
                        COALESCE(pg_column_size(volume_financial), 0) + 
                        COALESCE(pg_column_size(is_edit), 0) as record_size
                    FROM ticks_raw 
                    LIMIT 1000
                """)
                record_sizes = cur.fetchall()
                
                avg_record_size = 0
                if record_sizes:
                    total_record_size = sum(size[0] for size in record_sizes if size[0] is not None)
                    avg_record_size = total_record_size / len(record_sizes)
                
                print("🎯 DETALHES DA TABELA TICKS_RAW")
                print("=" * 60)
                print(f"Total de registros: {total_records:,}")
                print(f"Símbolos únicos: {unique_symbols}")
                
                if time_range[0] and time_range[1]:
                    print(f"Primeiro registro: {time_range[0]}")
                    print(f"Último registro: {time_range[1]}")
                    
                    if time_range[0] and time_range[1]:
                        duration = time_range[1] - time_range[0]
                        print(f"Duração dos dados: {duration}")
                
                print(f"Tamanho total: {size_info[0]}")
                print(f"Tamanho da tabela: {size_info[1]}")
                print(f"Tamanho dos índices: {size_info[2]}")
                
                if avg_record_size > 0:
                    print(f"Tamanho médio por registro: {format_bytes(avg_record_size)}")
                    estimated_total_size = avg_record_size * total_records
                    print(f"Tamanho estimado total: {format_bytes(estimated_total_size)}")
                
                print()
                print("📅 REGISTROS POR DIA (ÚLTIMOS 7 DIAS)")
                print("-" * 40)
                for date, count in daily_counts:
                    print(f"{date}: {count:,} registros")
                
                print()
                
    except Exception as e:
        print(f"❌ Erro ao verificar detalhes da tabela ticks: {e}")
        import traceback
        traceback.print_exc()

def check_timescale_info():
    """Verifica informações específicas do TimescaleDB"""
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # Verifica se TimescaleDB está disponível
                cur.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
                    )
                """)
                
                if not cur.fetchone()[0]:
                    print("⚠️  TimescaleDB não está disponível neste banco!")
                    return
                
                # Informações das hypertables (versão compatível)
                cur.execute("""
                    SELECT 
                        hypertable_name,
                        num_chunks,
                        compression_enabled
                    FROM timescaledb_information.hypertables
                    WHERE hypertable_schema = 'public'
                """)
                
                hypertables = cur.fetchall()
                
                if hypertables:
                    print("⏰ INFORMAÇÕES DO TIMESCALEDB")
                    print("=" * 60)
                    for table in hypertables:
                        name, chunks, comp_enabled = table
                        print(f"Hypertable: {name}")
                        print(f"  - Chunks: {chunks}")
                        print(f"  - Compressão habilitada: {comp_enabled}")
                        print()
                
                # Informações dos chunks
                cur.execute("""
                    SELECT 
                        chunk_name,
                        pg_size_pretty(pg_total_relation_size(chunk_name::regclass)) as size,
                        range_start,
                        range_end
                    FROM timescaledb_information.chunks
                    WHERE hypertable_schema = 'public'
                    ORDER BY range_start DESC
                    LIMIT 10
                """)
                
                chunks = cur.fetchall()
                
                if chunks:
                    print("🔍 ÚLTIMOS 10 CHUNKS")
                    print("=" * 60)
                    for chunk in chunks:
                        name, size, start, end = chunk
                        print(f"Chunk: {name}")
                        print(f"  - Tamanho: {size}")
                        print(f"  - Período: {start} até {end}")
                        print()
                
                # Verifica se há compressão ativa
                try:
                    cur.execute("""
                        SELECT 
                            hypertable_name,
                            chunk_name,
                            compression_status
                        FROM timescaledb_information.compression_settings
                        WHERE hypertable_schema = 'public'
                        LIMIT 5
                    """)
                    
                    compression_info = cur.fetchall()
                    if compression_info:
                        print("🗜️  INFORMAÇÕES DE COMPRESSÃO")
                        print("=" * 60)
                        for comp in compression_info:
                            name, chunk, status = comp
                            print(f"Chunk: {chunk}")
                            print(f"  - Status: {status}")
                            print()
                except Exception as comp_error:
                    print(f"ℹ️  Informações de compressão não disponíveis: {comp_error}")
                
    except Exception as e:
        print(f"❌ Erro ao verificar informações do TimescaleDB: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Função principal"""
    print("🔍 VERIFICADOR DE TAMANHO DO BANCO DE DADOS")
    print("=" * 60)
    print(f"Conectando em: {DATABASE_URL}")
    print()
    
    try:
        # Verifica tamanho total do banco
        db_size = check_database_size()
        
        # Verifica tamanho das tabelas
        tables_size = check_table_sizes()
        
        # Verifica detalhes da tabela de ticks
        check_ticks_table_details()
        
        # Verifica informações do TimescaleDB
        check_timescale_info()
        
        print("✅ Verificação concluída!")
        
    except Exception as e:
        print(f"❌ Erro geral: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
