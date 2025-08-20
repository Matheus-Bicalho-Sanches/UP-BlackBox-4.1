-- Script de teste para a nova estrutura de ticks
-- Insere alguns ticks de exemplo e testa as consultas

-- 1. Inserir alguns ticks de exemplo para PETR4
INSERT INTO ticks_raw (symbol, exchange, ts_tick_utc, price, volume, volume_financial, trade_id, buyer_maker) VALUES
('PETR4', 'B', NOW() - INTERVAL '5 minutes', 30.25, 1000, 30250.00, 1001, true),
('PETR4', 'B', NOW() - INTERVAL '4 minutes', 30.26, 500, 15130.00, 1002, false),
('PETR4', 'B', NOW() - INTERVAL '3 minutes', 30.24, 750, 22680.00, 1003, true),
('PETR4', 'B', NOW() - INTERVAL '2 minutes', 30.27, 1200, 36324.00, 1004, false),
('PETR4', 'B', NOW() - INTERVAL '1 minute', 30.28, 800, 24224.00, 1005, true);

-- 2. Inserir alguns ticks para VALE3
INSERT INTO ticks_raw (symbol, exchange, ts_tick_utc, price, volume, volume_financial, trade_id, buyer_maker) VALUES
('VALE3', 'B', NOW() - INTERVAL '5 minutes', 53.70, 2000, 107400.00, 2001, false),
('VALE3', 'B', NOW() - INTERVAL '4 minutes', 53.71, 1500, 80565.00, 2002, true),
('VALE3', 'B', NOW() - INTERVAL '3 minutes', 53.69, 1800, 96642.00, 2003, false),
('VALE3', 'B', NOW() - INTERVAL '2 minutes', 53.72, 2200, 118184.00, 2004, true),
('VALE3', 'B', NOW() - INTERVAL '1 minute', 53.73, 1600, 85968.00, 2005, false);

-- 3. Testar consulta de ticks individuais
SELECT '=== TICKS INDIVIDUAIS PETR4 ===' as info;
SELECT 
    symbol,
    ts_tick_utc,
    price,
    volume,
    volume_financial,
    trade_id,
    buyer_maker
FROM ticks_raw 
WHERE symbol = 'PETR4' 
ORDER BY ts_tick_utc DESC 
LIMIT 5;

-- 4. Testar consolidação em candles de 1 minuto
SELECT '=== CANDLES 1MIN PETR4 ===' as info;
SELECT 
    time_bucket(INTERVAL '1 minute', ts_tick_utc) AS minute_bucket,
    first(price, ts_tick_utc) AS open,
    max(price) AS high,
    min(price) AS low,
    last(price, ts_tick_utc) AS close,
    sum(volume) AS total_volume,
    sum(volume_financial) AS total_volume_financial,
    count(*) AS tick_count
FROM ticks_raw 
WHERE symbol = 'PETR4' 
    AND ts_tick_utc >= NOW() - INTERVAL '10 minutes'
GROUP BY time_bucket(INTERVAL '1 minute', ts_tick_utc)
ORDER BY minute_bucket DESC;

-- 5. Testar consolidação em candles de 5 minutos
SELECT '=== CANDLES 5MIN PETR4 ===' as info;
SELECT 
    time_bucket(INTERVAL '5 minutes', ts_tick_utc) AS five_min_bucket,
    first(price, ts_tick_utc) AS open,
    max(price) AS high,
    min(price) AS low,
    last(price, ts_tick_utc) AS close,
    sum(volume) AS total_volume,
    sum(volume_financial) AS total_volume_financial,
    count(*) AS tick_count
FROM ticks_raw 
WHERE symbol = 'PETR4' 
    AND ts_tick_utc >= NOW() - INTERVAL '10 minutes'
GROUP BY time_bucket(INTERVAL '5 minutes', ts_tick_utc)
ORDER BY five_min_bucket DESC;

-- 6. Estatísticas gerais
SELECT '=== ESTATÍSTICAS GERAIS ===' as info;
SELECT 
    symbol,
    count(*) as total_ticks,
    min(ts_tick_utc) as first_tick,
    max(ts_tick_utc) as last_tick,
    avg(price) as avg_price,
    sum(volume) as total_volume
FROM ticks_raw 
GROUP BY symbol
ORDER BY symbol;
