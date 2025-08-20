# Script para testar a conexão com o banco de dados
# Execute após configurar o PostgreSQL

param(
    [string]$DbHost = "localhost",
    [string]$Port = "5432",
    [string]$User = "postgres",
    [string]$Password = "postgres",
    [string]$Database = "market_data"
)

Write-Host "=== Teste de Conexão com o Banco ===" -ForegroundColor Green
Write-Host ""

# Testa conexão básica
Write-Host "1. Testando conexão básica..." -ForegroundColor Cyan
try {
    $env:PGPASSWORD = $Password
    $result = psql -U $User -h $DbHost -p $Port -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PostgreSQL conectado!" -ForegroundColor Green
        Write-Host $result -ForegroundColor Gray
    } else {
        Write-Host "✗ Erro ao conectar no PostgreSQL" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Erro: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Testa se o banco existe
Write-Host "2. Verificando se o banco $Database existe..." -ForegroundColor Cyan
try {
    $dbExists = psql -U $User -h $DbHost -p $Port -lqt | Select-String $Database
    if ($dbExists) {
        Write-Host "✓ Banco $Database encontrado!" -ForegroundColor Green
    } else {
        Write-Host "✗ Banco $Database não encontrado" -ForegroundColor Red
        Write-Host "Execute o script setup_database.sql primeiro" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Erro ao verificar bancos: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Testa conexão com o banco específico
Write-Host "3. Testando conexão com o banco $Database..." -ForegroundColor Cyan
try {
    $result = psql -U $User -h $DbHost -p $Port -d $Database -c "SELECT current_database();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Conectado ao banco $Database!" -ForegroundColor Green
    } else {
        Write-Host "✗ Erro ao conectar no banco $Database" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Erro: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verifica se a tabela candles_1m existe
Write-Host "4. Verificando se a tabela candles_1m existe..." -ForegroundColor Cyan
try {
    $result = psql -U $User -h $DbHost -p $Port -d $Database -c "\dt candles_1m" 2>&1
    if ($LASTEXITCODE -eq 0 -and $result -match "candles_1m") {
        Write-Host "✓ Tabela candles_1m encontrada!" -ForegroundColor Green
    } else {
        Write-Host "✗ Tabela candles_1m não encontrada" -ForegroundColor Red
        Write-Host "Execute o script setup_database.sql primeiro" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Erro ao verificar tabela: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verifica se o TimescaleDB está ativo
Write-Host "5. Verificando extensão TimescaleDB..." -ForegroundColor Cyan
try {
    $result = psql -U $User -h $DbHost -p $Port -d $Database -c "\dx timescaledb" 2>&1
    if ($LASTEXITCODE -eq 0 -and $result -match "timescaledb") {
        Write-Host "✓ TimescaleDB ativo!" -ForegroundColor Green
    } else {
        Write-Host "⚠ TimescaleDB não encontrado (apenas timeframe 1m funcionará)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Erro ao verificar TimescaleDB: $_" -ForegroundColor Yellow
}

Write-Host ""

# Testa inserção de dados de exemplo
Write-Host "6. Testando inserção de dados..." -ForegroundColor Cyan
try {
    $testData = @"
INSERT INTO candles_1m (symbol, exchange, ts_minute_utc, o, h, l, c, v, vf) 
VALUES ('TEST', 'B', NOW(), 100.0, 101.0, 99.0, 100.5, 1000, 100500.0)
ON CONFLICT (symbol, ts_minute_utc) DO NOTHING;
"@
    
    $result = psql -U $User -h $Host -p $Port -d $Database -c $testData 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Dados de teste inseridos com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "✗ Erro ao inserir dados de teste" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erro ao testar inserção: $_" -ForegroundColor Red
}

Write-Host ""

# Testa consulta
Write-Host "7. Testando consulta..." -ForegroundColor Cyan
try {
    $result = psql -U $User -h $Host -p $Port -d $Database -c "SELECT COUNT(*) as total_candles FROM candles_1m;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Consulta executada com sucesso!" -ForegroundColor Green
        Write-Host "Resultado: $result" -ForegroundColor Gray
    } else {
        Write-Host "✗ Erro ao executar consulta" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Erro ao testar consulta: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TESTE COMPLETO ===" -ForegroundColor Green
Write-Host "Se todos os testes passaram, o banco está configurado corretamente!" -ForegroundColor Green
Write-Host ""
Write-Host "Agora você pode:" -ForegroundColor Yellow
Write-Host "1. Rodar o start-dev.bat" -ForegroundColor White
Write-Host "2. Testar a aba MarketData em http://localhost:3000/dashboard/blackbox-multi/marketdata" -ForegroundColor White
Write-Host ""
Write-Host "URL de conexão para o .env.local:" -ForegroundColor Cyan
Write-Host "DATABASE_URL=postgresql://$User`:$Password@$Host`:$Port/$Database" -ForegroundColor White
