-- Script para verificar e ajustar a tabela candles_1m
-- Execute este script no PostgreSQL

-- 1. Verificar se há conflitos (mesmo symbol+ts_minute_utc com exchanges diferentes)
SELECT 
    symbol, 
    ts_minute_utc, 
    COUNT(DISTINCT exchange) as exchanges,
    array_agg(DISTINCT exchange) as exchange_list
FROM candles_1m
GROUP BY symbol, ts_minute_utc
HAVING COUNT(DISTINCT exchange) > 1;

-- 2. Se não houver conflitos (query acima retorna 0 linhas), 
--    alterar PRIMARY KEY para incluir exchange:
-- 
-- ALTER TABLE candles_1m DROP CONSTRAINT candles_1m_pkey;
-- ALTER TABLE candles_1m ADD PRIMARY KEY (symbol, exchange, ts_minute_utc);
--
-- Nota: Se houver dados conflitantes, será necessário limpar ou migrar os dados primeiro.

-- 3. Verificar estrutura atual da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'candles_1m'
ORDER BY ordinal_position;

-- 4. Verificar se é hypertable do TimescaleDB
SELECT * FROM timescaledb_information.hypertables 
WHERE hypertable_name = 'candles_1m';

