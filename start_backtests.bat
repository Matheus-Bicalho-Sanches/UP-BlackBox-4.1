@echo off
echo ========================================
echo UP BlackBox 2.0 - Sistema de Backtests
echo ========================================
echo.
echo Iniciando servicos para backtests...
echo.

REM ---------------------------------------------------------------------------
REM Configuracoes dos servicos
REM ---------------------------------------------------------------------------

REM Porta do frontend (Next.js)
set "FRONTEND_PORT=3000"
REM Porta do UP BlackBox 2.0 (Sistema de backtests)
set "BB2_PORT=8003"

echo Servicos que serao iniciados:
echo - Frontend (Next.js): http://localhost:%FRONTEND_PORT%
echo - UP BlackBox 2.0 (Backtests): http://localhost:%BB2_PORT%
echo.

REM ---------------------------------------------------------------------------
REM Inicia o UP BlackBox 2.0 (Backtests)
REM ---------------------------------------------------------------------------

REM Caminho para a pasta UP BlackBox 2.0
set BB2_DIR=%~dp0UP BlackBox 2.0

REM Verifica se a pasta existe
if not exist "%BB2_DIR%" (
    echo ERRO: Pasta UP BlackBox 2.0 nao encontrada!
    echo Certifique-se de que a pasta existe em: %BB2_DIR%
    pause
    exit /b 1
)

echo Iniciando UP BlackBox 2.0 na pasta: "%BB2_DIR%"
start "UP BlackBox 2.0 - Backtests" cmd /k cd /d "%BB2_DIR%" ^& start_with_venv.bat

REM ---------------------------------------------------------------------------
REM Aguarda um momento para o backend iniciar
REM ---------------------------------------------------------------------------

echo.
echo Aguardando o backend iniciar...
timeout /t 3 /nobreak >nul

REM ---------------------------------------------------------------------------
REM Inicia o frontend (Next.js)
REM ---------------------------------------------------------------------------

echo.
echo Iniciando o frontend (Next.js)...
echo Para acessar o site, abra seu navegador e acesse:
echo http://localhost:%FRONTEND_PORT%
echo.
echo Para parar o servidor, pressione Ctrl + C
echo.

REM Inicia o servidor de desenvolvimento do Next.js
npm run dev
