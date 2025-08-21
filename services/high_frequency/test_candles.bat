@echo off
echo ========================================
echo   TESTE DE AGREGAÇÃO DE CANDLES
echo ========================================
echo.

REM Verifica se o ambiente virtual existe
if not exist "venv\Scripts\activate.bat" (
    echo ❌ Ambiente virtual nao encontrado!
    echo Execute primeiro: install_rust.ps1
    pause
    exit /b 1
)

REM Ativa o ambiente virtual
echo 🔧 Ativando ambiente virtual...
call venv\Scripts\activate.bat

REM Verifica se as dependencias estao instaladas
echo 📦 Verificando dependencias...
python -c "import psycopg" 2>nul
if errorlevel 1 (
    echo ❌ Dependencia psycopg nao encontrada!
    echo Instalando dependencias...
    pip install -r requirements.txt
)

REM Executa o teste de agregação
echo.
echo 🚀 Executando teste de agregação de candles...
echo.
python test_candle_aggregation.py

echo.
echo ✅ Teste concluido!
echo.
pause
