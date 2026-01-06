@echo off
REM Script para iniciar o Market Collector Service
REM Certifique-se de que o NATS está rodando antes de executar

echo ====================================
echo Market Collector Service
echo ====================================
echo.

REM Verifica se está no diretório correto
if not exist "MarketCollector.csproj" (
    echo ERRO: Execute este script no diretório services\market_collector
    pause
    exit /b 1
)

REM Verifica se .NET está instalado
dotnet --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: .NET SDK não encontrado. Instale o .NET 8 SDK.
    pause
    exit /b 1
)

echo Compilando projeto...
dotnet build
if errorlevel 1 (
    echo ERRO: Falha na compilação
    pause
    exit /b 1
)

echo.
echo Iniciando Market Collector Service...
echo Pressione Ctrl+C para parar
echo.

dotnet run

pause
