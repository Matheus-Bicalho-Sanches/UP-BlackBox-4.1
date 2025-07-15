-- SQL script to set up TimescaleDB tables for tick data and 5-minute candles

-- 1. Tick-level data (1 sample per second)
CREATE TABLE IF NOT EXISTS ticks (
    ts          TIMESTAMPTZ       NOT NULL,
    asset       TEXT              NOT NULL,
    price       DOUBLE PRECISION  NOT NULL,
    quantity    BIGINT,
    PRIMARY KEY (asset, ts)
);

-- Transform into hypertable (if Timescale extension is enabled)
SELECT create_hypertable('ticks', 'ts', if_not_exists => TRUE);


-- 2. Candle data – 5-minute timeframe
CREATE TABLE IF NOT EXISTS candles_5m (
    open_time   TIMESTAMPTZ       NOT NULL,
    asset       TEXT              NOT NULL,
    open        DOUBLE PRECISION  NOT NULL,
    high        DOUBLE PRECISION  NOT NULL,
    low         DOUBLE PRECISION  NOT NULL,
    close       DOUBLE PRECISION  NOT NULL,
    volume      BIGINT            NOT NULL,
    PRIMARY KEY (asset, open_time)
);

SELECT create_hypertable('candles_5m', 'open_time', if_not_exists => TRUE); 