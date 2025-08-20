# Script para testar a conexão com o banco Docker
# Execute após configurar o PostgreSQL + TimescaleDB via Docker

Write-Host "=== Teste de Conexão com Banco Docker ===" -ForegroundColor Green
Write-Host ""

# Verifica se o container está rodando
Write-Host "1. Verificando se o container está rodando..." -ForegroundColor Cyan
try {
    $containerStatus = docker ps --filter "name=postgres-timescale" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    if ($containerStatus -match "postgres-timescale") {
        Write-Host "✓ Container postgres-timescale está rodando!" -ForegroundColor Green
        Write-Host $containerStatus -ForegroundColor Gray
    } else {
        Write-Host "✗ Container postgres-timescale não está rodando" -ForegroundColor Red
        Write-Host "Execute: docker start postgres-timescale" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Erro ao verificar container: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Testa conexão básica
Write-Host "2. Testando conexão com PostgreSQL..." -ForegroundColor Cyan
try {
    $result = docker exec postgres-timescale psql -U postgres -c "SELECT version();" 2>&1
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
Write-Host "3. Verificando se o banco market_data existe..." -ForegroundColor Cyan
try {
    $dbExists = docker exec postgres-timescale psql -U postgres -lqt | Select-String "market_data"
    if ($dbExists) {
        Write-Host "✓ Banco market_data encontrado!" -ForegroundColor Green
    } else {
        Write-Host "✗ Banco market_data não encontrado" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Erro ao verificar bancos: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Testa conexão com o banco específico
Write-Host "4. Testando conexão com o banco market_data..." -ForegroundColor Cyan
try {
    $result = docker exec postgres-timescale psql -U postgres -d market_data -c "SELECT current_database();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Conectado ao banco market_data!" -ForegroundColor Green
    } else {
        Write-Host "✗ Erro ao conectar no banco market_data" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Erro: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verifica se a tabela candles_1m existe
Write-Host "5. Verificando se a tabela candles_1m existe..." -ForegroundColor Cyan
try {
    $result = docker exec postgres-timescale psql -U postgres -d market_data -c "\dt candles_1m" 2>&1
    if ($LASTEXITCODE -eq 0 -and $result -match "candles_1m") {
        Write-Host "✓ Tabela candles_1m encontrada!" -ForegroundColor Green
    } else {
        Write-Host "✗ Tabela candles_1m não encontrada" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Erro ao verificar tabela: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verifica se o TimescaleDB está ativo
Write-Host "6. Verificando extensão TimescaleDB..." -ForegroundColor Cyan
try {
    $result = docker exec postgres-timescale psql -U postgres -d market_data -c "\dx timescaledb" 2>&1
    if ($LASTEXITCODE -eq 0 -and $result -match "timescaledb") {
        Write-Host "✓ TimescaleDB ativo!" -ForegroundColor Green
    } else {
        Write-Host "⚠ TimescaleDB não encontrado" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Erro ao verificar TimescaleDB: $_" -ForegroundColor Yellow
}

Write-Host ""

# Testa inserção de dados
Write-Host "7. Testando inserção de dados..." -ForegroundColor Cyan
try {
    $testData = @"
INSERT INTO candles_1m (symbol, exchange, ts_minute_utc, o, h, l, c, v, vf) 
VALUES ('DOCKER_TEST', 'B', NOW(), 50.0, 51.0, 49.0, 50.5, 500, 25250.0)
ON CONFLICT (symbol, ts_minute_utc) DO NOTHING;
"@
    
    $result = docker exec postgres-timescale psql -U postgres -d market_data -c $testData 2>&1
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
Write-Host "8. Testando consulta..." -ForegroundColor Cyan
try {
    $result = docker exec postgres-timescale psql -U postgres -d market_data -c "SELECT COUNT(*) as total_candles FROM candles_1m;" 2>&1
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
Write-Host "Se todos os testes passaram, o banco Docker está configurado corretamente!" -ForegroundColor Green
Write-Host ""
Write-Host "Agora você pode:" -ForegroundColor Yellow
Write-Host "1. Rodar o start-dev.bat" -ForegroundColor White
Write-Host "2. Testar a aba MarketData em http://localhost:3000/dashboard/blackbox-multi/marketdata" -ForegroundColor White
Write-Host ""
Write-Host "Comandos úteis do Docker:" -ForegroundColor Cyan
Write-Host "docker start postgres-timescale    # Iniciar o container" -ForegroundColor White
Write-Host "docker stop postgres-timescale     # Parar o container" -ForegroundColor White
Write-Host "docker logs postgres-timescale     # Ver logs" -ForegroundColor White
Write-Host "docker exec -it postgres-timescale psql -U postgres -d market_data  # Conectar via psql" -ForegroundColor White
Write-Host ""
Write-Host "URL de conexão já configurada no .env.local:" -ForegroundColor Cyan
Write-Host "DATABASE_URL=postgres://postgres:postgres@localhost:5432/market_data" -ForegroundColor White
