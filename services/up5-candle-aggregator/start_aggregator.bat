@echo off
echo === UP 5.0 Candle Aggregator ===
echo.

cd /d "%~dp0"

REM Verifica se o .NET SDK está instalado
dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: .NET SDK nao encontrado!
    echo Por favor, instale o .NET 8.0 SDK
    pause
    exit /b 1
)

echo Compilando projeto...
dotnet build
if %errorlevel% neq 0 (
    echo ERRO: Falha na compilacao!
    pause
    exit /b 1
)

echo.
echo Iniciando servico...
echo Pressione Ctrl+C para encerrar
echo.

dotnet run

pause

