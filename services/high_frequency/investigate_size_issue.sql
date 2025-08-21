-- Script para investigar o problema de tamanho da tabela ticks_raw
-- Execute este script para entender por que a tabela mostra 0 bytes

-- 1. Verificar se a tabela realmente existe e sua estrutura
SELECT 
    table_name,
    table_type,
    pg_size_pretty(pg_total_relation_size('public.ticks_raw')) as total_size,
    pg_size_pretty(pg_relation_size('public.ticks_raw')) as table_size,
    pg_size_pretty(pg_total_relation_size('public.ticks_raw') - pg_relation_size('public.ticks_raw')) as index_size
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'ticks_raw';

-- 2. Verificar se é uma hypertable do TimescaleDB
SELECT 
    hypertable_name,
    num_chunks,
    compression_enabled
FROM timescaledb_information.hypertables 
WHERE hypertable_schema = 'public' AND hypertable_name = 'ticks_raw';

-- 3. Verificar os chunks individuais (onde os dados realmente ficam)
SELECT 
    chunk_name,
    pg_size_pretty(pg_total_relation_size(chunk_name::regclass)) as chunk_size,
    pg_size_pretty(pg_relation_size(chunk_name::regclass)) as chunk_data_size,
    range_start,
    range_end
FROM timescaledb_information.chunks 
WHERE hypertable_schema = 'public' AND hypertable_name = 'ticks_raw'
ORDER BY range_start DESC;

-- 4. Soma total dos chunks para comparar com o tamanho da hypertable
SELECT 
    'Total dos chunks' as description,
    pg_size_pretty(SUM(pg_total_relation_size(chunk_name::regclass))) as total_chunks_size,
    pg_size_pretty(SUM(pg_relation_size(chunk_name::regclass))) as total_chunks_data_size,
    COUNT(*) as num_chunks
FROM timescaledb_information.chunks 
WHERE hypertable_schema = 'public' AND hypertable_name = 'ticks_raw';

-- 5. Verificar se há compressão ativa
SELECT 
    chunk_name,
    compression_status,
    pg_size_pretty(before_compression_total_bytes) as before_compression,
    pg_size_pretty(after_compression_total_bytes) as after_compression
FROM timescaledb_information.compression_settings 
WHERE hypertable_schema = 'public' AND hypertable_name = 'ticks_raw'
LIMIT 10;

-- 6. Verificar estatísticas da tabela
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename = 'ticks_raw';

-- 7. Verificar se há TOAST (dados grandes armazenados separadamente)
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as data_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as other_size
FROM pg_tables 
WHERE tablename = 'ticks_raw';

-- 8. Verificar se há tabelas relacionadas (TOAST, índices)
SELECT 
    schemaname,
    tablename,
    tabletype,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename LIKE '%ticks_raw%' OR tablename LIKE '%_ticks_raw_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 9. Verificar o tamanho real dos dados por coluna
SELECT 
    'Tamanho médio por registro' as info,
    pg_size_pretty(AVG(
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
        COALESCE(pg_column_size(is_edit), 0)
    )) as avg_record_size
FROM ticks_raw 
LIMIT 1000;

-- 10. Verificar se há problemas de permissões ou visibilidade
SELECT 
    has_table_privilege(current_user, 'ticks_raw', 'SELECT') as can_select,
    has_table_privilege(current_user, 'ticks_raw', 'INSERT') as can_insert,
    has_table_privilege(current_user, 'ticks_raw', 'UPDATE') as can_update,
    has_table_privilege(current_user, 'ticks_raw', 'DELETE') as can_delete;
