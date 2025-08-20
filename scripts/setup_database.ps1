# Script PowerShell para configurar PostgreSQL + TimescaleDB
# Execute como Administrador se necessário

param(
    [string]$DbHost = "localhost",
    [string]$Port = "5432",
    [string]$User = "postgres",
    [string]$Password = "postgres",
    [string]$Database = "market_data"
)

Write-Host "=== Configuração do Banco de Dados ===" -ForegroundColor Green
Write-Host "Host: $DbHost" -ForegroundColor Yellow
Write-Host "Porta: $Port" -ForegroundColor Yellow
Write-Host "Usuário: $User" -ForegroundColor Yellow
Write-Host "Banco: $Database" -ForegroundColor Yellow
Write-Host ""

# Verifica se o PostgreSQL está rodando
Write-Host "Verificando se o PostgreSQL está rodando..." -ForegroundColor Cyan
try {
    $pgTest = Test-NetConnection -ComputerName $DbHost -Port $Port -InformationLevel Quiet
    if ($pgTest) {
        Write-Host "✓ PostgreSQL está rodando na porta $Port" -ForegroundColor Green
    } else {
        Write-Host "✗ PostgreSQL não está rodando na porta $Port" -ForegroundColor Red
        Write-Host "Verifique se o serviço está iniciado" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Erro ao conectar no PostgreSQL: $_" -ForegroundColor Red
    exit 1
}

# Cria o script SQL
$sqlScript = @"
-- Script de configuração do banco para MarketData
-- Execute este script conectado como usuário postgres

-- 1. Criar o banco de dados
CREATE DATABASE $Database;

-- 2. Conectar ao banco criado
\c $Database;

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
"@

# Salva o script SQL
$sqlPath = "scripts\setup_database.sql"
$sqlScript | Out-File -FilePath $sqlPath -Encoding UTF8
Write-Host "✓ Script SQL criado em: $sqlPath" -ForegroundColor Green

# Instruções para execução
Write-Host ""
Write-Host "=== PRÓXIMOS PASSOS ===" -ForegroundColor Green
Write-Host "1. Abra o pgAdmin ou use psql" -ForegroundColor Yellow
Write-Host "2. Conecte como usuário postgres" -ForegroundColor Yellow
Write-Host "3. Execute o script: $sqlPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Ou via linha de comando:" -ForegroundColor Cyan
Write-Host "psql -U postgres -h $DbHost -p $Port -f $sqlPath" -ForegroundColor White
Write-Host ""
Write-Host "Após executar o script, teste a conexão:" -ForegroundColor Cyan
Write-Host "psql -U postgres -h $DbHost -p $Port -d $Database -c 'SELECT version();'" -ForegroundColor White
Write-Host ""

# Testa a conexão com o banco (se existir)
Write-Host "Testando conexão com o banco $Database..." -ForegroundColor Cyan
try {
    $env:PGPASSWORD = $Password
    $testResult = psql -U $User -h $DbHost -p $Port -d $Database -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Conexão com o banco $Database OK!" -ForegroundColor Green
    } else {
        Write-Host "✗ Banco $Database ainda não existe ou há erro de conexão" -ForegroundColor Yellow
        Write-Host "Execute o script SQL primeiro" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Erro ao testar conexão: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== CONFIGURAÇÃO COMPLETA ===" -ForegroundColor Green
Write-Host "Lembre-se de atualizar o .env.local com:" -ForegroundColor Yellow
Write-Host "DATABASE_URL=postgresql://$User`:$Password@$Host`:$Port/$Database" -ForegroundColor White
