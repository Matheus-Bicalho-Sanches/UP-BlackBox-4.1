-- Script de configuração do banco para MarketData
-- Execute este script conectado como usuário postgres

-- 1. Criar o banco de dados
CREATE DATABASE market_data;

-- 2. Conectar ao banco criado
\c market_data;

-- 3. Criar extensão TimescaleDB (se disponível)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 4. Criar tabela de candles de 1 minuto
CREATE TABLE IF NOT EXISTS candles_1m (
    symbol text NOT NULL,
    exchange text NOT NULL,
    ts_minute_utc timestamptz NOT NULL,
    o double precision NOT NULL,
    h double precision NOT NULL,
    l double precision NOT NULL,
    c double precision NOT NULL,
    v bigint NOT NULL,
    vf double precision,
    trades integer,
    vwap double precision,
    PRIMARY KEY (symbol, ts_minute_utc)
);

-- 5. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_candles_1m_symbol_ts ON candles_1m(symbol, ts_minute_utc);
CREATE INDEX IF NOT EXISTS idx_candles_1m_ts ON candles_1m(ts_minute_utc);

-- 6. Transformar em hypertable do TimescaleDB
SELECT create_hypertable('candles_1m', 'ts_minute_utc', if_not_exists => TRUE);

-- 7. Configurar política de retenção (opcional - mantém dados por 1 ano)
SELECT add_retention_policy('candles_1m', INTERVAL '1 year');

-- 8. Criar continuous aggregates para timeframes maiores (opcional)
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_5m WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('5 minutes', ts_minute_utc) AS bucket,
    symbol,
    exchange,
    first(o, ts_minute_utc) AS o,
    max(h) AS h,
    min(l) AS l,
    last(c, ts_minute_utc) AS c,
    sum(v) AS v,
    sum(vf) AS vf,
    sum(trades) AS trades
FROM candles_1m
GROUP BY bucket, symbol, exchange;

-- 9. Verificar se tudo foi criado
\dt
\dx
