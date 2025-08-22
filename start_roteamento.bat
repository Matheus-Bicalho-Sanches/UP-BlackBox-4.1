@echo off
echo ========================================
echo UP BlackBox 4.0 - Sistema de Roteamento
echo ========================================
echo.
echo Iniciando servicos de roteamento...
echo.

REM ---------------------------------------------------------------------------
REM Configuracoes dos servicos
REM ---------------------------------------------------------------------------

REM Porta do frontend (Next.js)
set "FRONTEND_PORT=3000"
REM Porta do UP BlackBox 4.0 (FastAPI)
set "BB4_PORT=8000"

echo Servicos que serao iniciados:
echo - Frontend (Next.js): http://localhost:%FRONTEND_PORT%
echo - UP BlackBox 4.0 (API): http://localhost:%BB4_PORT%
echo.

REM ---------------------------------------------------------------------------
REM Inicia o UP BlackBox 4.0
REM ---------------------------------------------------------------------------

REM Caminho para o UP BlackBox 4.0
set BB4_DIR=%~dp0UP BlackBox 4.0

REM Verifica se a pasta existe
if not exist "%BB4_DIR%" (
    echo ERRO: Pasta UP BlackBox 4.0 nao encontrada!
    echo Certifique-se de que a pasta existe em: %BB4_DIR%
    pause
    exit /b 1
)

echo Iniciando UP BlackBox 4.0 na pasta: "%BB4_DIR%"
start "UP BlackBox 4.0 - Roteamento" cmd /k cd /d "%BB4_DIR%" ^& uvicorn main:app --reload --port %BB4_PORT%

REM ---------------------------------------------------------------------------
REM Aguarda um momento para o backend iniciar
REM ---------------------------------------------------------------------------

echo.
echo Aguardando o UP BlackBox 4.0 iniciar...
echo (Aguarde ate ver a mensagem "Uvicorn running on http://0.0.0.0:8000")
timeout /t 8 /nobreak >nul

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
