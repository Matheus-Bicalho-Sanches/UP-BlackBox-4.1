@echo off
title UP 5.0 Tick Collector
color 0A

echo ========================================
echo   UP 5.0 Tick Collector
echo ========================================
echo.

REM Verifica se está no diretório correto
if not exist "Up5TickCollector.csproj" (
    echo ERRO: Execute este script no diretorio services\up5-tick-collector
    pause
    exit /b 1
)

REM Verifica se .NET está instalado
dotnet --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: .NET SDK nao encontrado. Instale o .NET 8 SDK.
    pause
    exit /b 1
)

REM Navega para o diretório do script
cd /d "%~dp0"

echo Compilando projeto...
dotnet build
if errorlevel 1 (
    echo ERRO: Falha na compilacao
    pause
    exit /b 1
)

echo.
echo ========================================
echo Iniciando UP 5.0 Tick Collector...
echo ========================================
echo.
echo Pressione Ctrl+C para parar
echo.

dotnet run

echo.
echo Servico finalizado.
pause

