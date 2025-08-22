@echo off
echo ========================================
echo UP Data Feed - Sistema de Market Data
echo ========================================
echo.
echo Iniciando servicos de market data...
echo.

REM ---------------------------------------------------------------------------
REM Configuracoes dos servicos
REM ---------------------------------------------------------------------------

REM Porta do frontend (Next.js)
set "FRONTEND_PORT=3000"
REM Porta do Market Feed Next
set "MARKET_FEED_PORT=8001"
REM Porta do High Frequency Backend
set "HF_PORT=8002"

echo Servicos que serao iniciados:
echo - Frontend (Next.js): http://localhost:%FRONTEND_PORT%
echo - Market Feed Next: http://localhost:%MARKET_FEED_PORT%
echo - High Frequency Backend: http://localhost:%HF_PORT%
echo.

REM ---------------------------------------------------------------------------
REM Configura PYTHONPATH para o Market Feed Next
REM ---------------------------------------------------------------------------

REM Configura o PYTHONPATH para incluir a raiz do projeto
set "PROJECT_ROOT=%~dp0"
set "PYTHONPATH=%PROJECT_ROOT%;%PYTHONPATH%"

echo PYTHONPATH configurado para: %PYTHONPATH%
echo.

REM ---------------------------------------------------------------------------
REM Inicia o Market Feed Next
REM ---------------------------------------------------------------------------

REM Caminho para o Market Feed Next
set MARKET_FEED_DIR=%~dp0services\market_feed_next

REM Verifica se a pasta existe
if not exist "%MARKET_FEED_DIR%" (
    echo ERRO: Pasta Market Feed Next nao encontrada!
    echo Certifique-se de que a pasta existe em: %MARKET_FEED_DIR%
    pause
    exit /b 1
)

echo Iniciando Market Feed Next na pasta: "%MARKET_FEED_DIR%"
start "Market Feed Next" cmd /k cd /d "%MARKET_FEED_DIR%" ^& start_market_feed_next.bat

REM ---------------------------------------------------------------------------
REM Aguarda um momento para o Market Feed iniciar
REM ---------------------------------------------------------------------------

echo.
echo Aguardando o Market Feed Next iniciar...
echo (Aguarde ate ver a mensagem "API do Market Feed iniciada")
timeout /t 8 /nobreak >nul

REM ---------------------------------------------------------------------------
REM Inicia o High Frequency Backend
REM ---------------------------------------------------------------------------

REM Caminho para o High Frequency Backend
set HF_DIR=%~dp0services\high_frequency

REM Verifica se a pasta existe
if not exist "%HF_DIR%" (
    echo ERRO: Pasta High Frequency nao encontrada!
    echo Certifique-se de que a pasta existe em: %HF_DIR%
    pause
    exit /b 1
)

echo Iniciando High Frequency Backend na pasta: "%HF_DIR%"
start "High Frequency Backend" cmd /k cd /d "%HF_DIR%" ^& set PROFIT_FEED_URL=http://localhost:%MARKET_FEED_PORT% ^& start_backend.bat "%~dp0"

REM ---------------------------------------------------------------------------
REM Aguarda um momento para o High Frequency iniciar
REM ---------------------------------------------------------------------------

echo.
echo Aguardando o High Frequency Backend iniciar...
echo (Aguarde ate ver a mensagem "Backend iniciado com sucesso")
timeout /t 10 /nobreak >nul

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
