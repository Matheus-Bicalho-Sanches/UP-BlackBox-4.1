-- Adiciona tabela para armazenar cada tick individual
-- Permite análise de alta frequência e consolidação flexível

-- Tabela principal de ticks
CREATE TABLE IF NOT EXISTS ticks_raw (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    ts_tick_utc TIMESTAMPTZ NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    volume INTEGER NOT NULL,
    volume_financial DOUBLE PRECISION NOT NULL,
    trade_id BIGINT,
    buyer_maker BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ticks_raw_symbol_ts ON ticks_raw(symbol, ts_tick_utc);
CREATE INDEX IF NOT EXISTS idx_ticks_raw_ts ON ticks_raw(ts_tick_utc);
CREATE INDEX IF NOT EXISTS idx_ticks_raw_symbol ON ticks_raw(symbol);

-- Convertendo para hypertable do TimescaleDB
SELECT create_hypertable('ticks_raw', 'ts_tick_utc', if_not_exists => TRUE);

-- Política de retenção (mantém 6 meses de ticks)
SELECT add_retention_policy('ticks_raw', INTERVAL '6 months');

-- Função para inserir tick
CREATE OR REPLACE FUNCTION insert_tick(
    p_symbol TEXT,
    p_exchange TEXT,
    p_price DOUBLE PRECISION,
    p_volume INTEGER,
    p_trade_id BIGINT DEFAULT NULL,
    p_buyer_maker BOOLEAN DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
    v_volume_financial DOUBLE PRECISION;
BEGIN
    v_volume_financial := p_price * p_volume;
    
    INSERT INTO ticks_raw (symbol, exchange, ts_tick_utc, price, volume, volume_financial, trade_id, buyer_maker)
    VALUES (p_symbol, p_exchange, NOW() AT TIME ZONE 'UTC', p_price, p_volume, v_volume_financial, p_trade_id, p_buyer_maker)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Função para consolidar candles a partir de ticks
CREATE OR REPLACE FUNCTION consolidate_candles_from_ticks(
    p_symbol TEXT,
    p_timeframe TEXT DEFAULT '1m',
    p_from_ts TIMESTAMPTZ DEFAULT NULL,
    p_to_ts TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
    ts_bucket TIMESTAMPTZ,
    o DOUBLE PRECISION,
    h DOUBLE PRECISION,
    l DOUBLE PRECISION,
    c DOUBLE PRECISION,
    v BIGINT,
    vf DOUBLE PRECISION,
    tick_count INTEGER
) AS $$
DECLARE
    v_interval INTERVAL;
BEGIN
    -- Mapeia timeframe para intervalo
    CASE p_timeframe
        WHEN '1m' THEN v_interval := INTERVAL '1 minute';
        WHEN '5m' THEN v_interval := INTERVAL '5 minutes';
        WHEN '15m' THEN v_interval := INTERVAL '15 minutes';
        WHEN '1h' THEN v_interval := INTERVAL '1 hour';
        WHEN '1d' THEN v_interval := INTERVAL '1 day';
        ELSE v_interval := INTERVAL '1 minute';
    END CASE;
    
    -- Define range de tempo se não especificado
    IF p_from_ts IS NULL THEN
        p_from_ts := NOW() AT TIME ZONE 'UTC' - INTERVAL '1 hour';
    END IF;
    IF p_to_ts IS NULL THEN
        p_to_ts := NOW() AT TIME ZONE 'UTC';
    END IF;
    
    RETURN QUERY
    SELECT 
        time_bucket(v_interval, ts_tick_utc) AS ts_bucket,
        first(price, ts_tick_utc) AS o,
        max(price) AS h,
        min(price) AS l,
        last(price, ts_tick_utc) AS c,
        sum(volume) AS v,
        sum(volume_financial) AS vf,
        count(*) AS tick_count
    FROM ticks_raw
    WHERE symbol = p_symbol
        AND ts_tick_utc BETWEEN p_from_ts AND p_to_ts
    GROUP BY time_bucket(v_interval, ts_tick_utc)
    ORDER BY ts_bucket;
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE ticks_raw IS 'Armazena cada tick individual para análise de alta frequência';
COMMENT ON FUNCTION consolidate_candles_from_ticks IS 'Consolida ticks em candles de timeframe customizável';
COMMENT ON FUNCTION insert_tick IS 'Insere um novo tick com cálculo automático de volume financeiro';
