-- Script SQL para verificar o tamanho dos dados no TimescaleDB
-- Execute este script no seu cliente PostgreSQL (psql, pgAdmin, etc.)

-- 1. Tamanho total do banco de dados
SELECT 
    current_database() as database_name,
    pg_size_pretty(pg_database_size(current_database())) as total_size,
    pg_database_size(current_database()) as size_bytes;

-- 2. Tamanho de todas as tabelas (incluindo índices)
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. Informações específicas da tabela ticks_raw
SELECT 
    'ticks_raw' as table_name,
    pg_size_pretty(pg_total_relation_size('ticks_raw')) as total_size,
    pg_size_pretty(pg_relation_size('ticks_raw')) as table_size,
    pg_size_pretty(pg_total_relation_size('ticks_raw') - pg_relation_size('ticks_raw')) as index_size,
    (SELECT COUNT(*) FROM ticks_raw) as total_records,
    (SELECT COUNT(DISTINCT symbol) FROM ticks_raw) as unique_symbols;

-- 4. Primeiro e último registro na tabela ticks_raw
SELECT 
    MIN(timestamp) as first_record,
    MAX(timestamp) as last_record,
    MAX(timestamp) - MIN(timestamp) as data_duration
FROM ticks_raw;

-- 5. Registros por dia (últimos 30 dias)
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as records_count,
    pg_size_pretty(SUM(pg_column_size(price) + pg_column_size(volume) + pg_column_size(timestamp))) as estimated_data_size
FROM ticks_raw 
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- 6. Verificar se TimescaleDB está disponível
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') 
        THEN 'TimescaleDB disponível' 
        ELSE 'TimescaleDB não disponível' 
    END as timescale_status;

-- 7. Informações das hypertables (se TimescaleDB estiver disponível)
SELECT 
    hypertable_name,
    num_chunks,
    compression_enabled,
    compression_status
FROM timescaledb_information.hypertables
WHERE hypertable_schema = 'public';

-- 8. Tamanho dos chunks (últimos 20)
SELECT 
    chunk_name,
    pg_size_pretty(pg_total_relation_size(chunk_name::regclass)) as chunk_size,
    range_start,
    range_end
FROM timescaledb_information.chunks
WHERE hypertable_schema = 'public'
ORDER BY range_start DESC
LIMIT 20;

-- 9. Estatísticas de compressão (se habilitada)
SELECT 
    hypertable_name,
    chunk_name,
    compression_status,
    pg_size_pretty(before_compression_total_bytes) as before_compression,
    pg_size_pretty(after_compression_total_bytes) as after_compression,
    ROUND(
        (1 - (after_compression_total_bytes::float / before_compression_total_bytes::float)) * 100, 2
    ) as compression_ratio_percent
FROM timescaledb_information.compression_settings cs
JOIN timescaledb_information.chunks c ON cs.hypertable_name = c.hypertable_name
WHERE cs.hypertable_schema = 'public'
ORDER BY c.range_start DESC
LIMIT 20;
