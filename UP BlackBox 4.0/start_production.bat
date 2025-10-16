@echo off
REM =========================================
REM UP BlackBox 4.0 - Modo Producao
REM =========================================
REM Este script inicia o backend em modo producao
REM Usar na VM Azure ou para testes de producao local

echo ========================================
echo UP BlackBox 4.0 - Modo Producao
echo ========================================
echo.

REM ---------------------------------------------------------------------------
REM Verificar se estamos na pasta correta
REM ---------------------------------------------------------------------------
if not exist "main.py" (
    echo ERRO: Arquivo main.py nao encontrado!
    echo Execute este script da pasta UP BlackBox 4.0
    pause
    exit /b 1
)

if not exist ".env.production" (
    echo AVISO: Arquivo .env.production nao encontrado!
    echo O sistema usara .env (desenvolvimento)
    echo.
    timeout /t 3 /nobreak >nul
)

REM ---------------------------------------------------------------------------
REM Ativar ambiente virtual
REM ---------------------------------------------------------------------------
echo [1/3] Ativando ambiente virtual...
if not exist "venv_bb4\Scripts\activate.bat" (
    echo ERRO: Ambiente virtual nao encontrado!
    echo Crie o ambiente virtual primeiro: python -m venv venv_bb4
    pause
    exit /b 1
)

call venv_bb4\Scripts\activate.bat
if errorlevel 1 (
    echo ERRO: Falha ao ativar ambiente virtual
    pause
    exit /b 1
)
echo Ambiente virtual ativado!
echo.

REM ---------------------------------------------------------------------------
REM Verificar dependencias
REM ---------------------------------------------------------------------------
echo [2/3] Verificando dependencias...
python -c "import fastapi, uvicorn, firebase_admin, dotenv" 2>nul
if errorlevel 1 (
    echo AVISO: Algumas dependencias podem estar faltando
    echo Instalando dependencias...
    pip install -r requirements_completo.txt
)
echo Dependencias OK!
echo.

REM ---------------------------------------------------------------------------
REM Criar pasta de logs se nao existir
REM ---------------------------------------------------------------------------
if not exist "logs" (
    echo Criando pasta de logs...
    mkdir logs
)

REM ---------------------------------------------------------------------------
REM Iniciar servidor
REM ---------------------------------------------------------------------------
echo [3/3] Iniciando servidor em modo producao...
echo.
echo ========================================
echo Servidor iniciando...
echo API: http://0.0.0.0:8000
echo Docs: http://0.0.0.0:8000/docs
echo ========================================
echo.
echo Pressione Ctrl+C para parar o servidor
echo.

REM Iniciar uvicorn em modo producao (sem reload)
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --no-reload

REM Se o servidor parar, pausar antes de fechar
echo.
echo Servidor parado.
pause
