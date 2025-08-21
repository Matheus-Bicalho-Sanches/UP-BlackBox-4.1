@echo off
echo ========================================
echo   VERIFICADOR DE TAMANHO DO BANCO
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

REM Executa o script de verificacao
echo.
echo 🚀 Executando verificacao de tamanho do banco...
echo.
python check_database_size.py

echo.
echo ✅ Verificacao concluida!
echo.
pause
