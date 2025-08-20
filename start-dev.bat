@echo off
echo Iniciando o servidor de desenvolvimento...
echo.
echo Para acessar o site, abra seu navegador e acesse:
echo http://localhost:3000
echo.
echo Para parar o servidor, pressione Ctrl + C
echo.

REM ---------------------------------------------------------------------------
REM Inicia os serviços backend da UP BlackBox 4.0
REM ---------------------------------------------------------------------------

REM Caminho para a pasta UP BlackBox 4.0 (usando aspas para lidar com espaços)
set BB4_DIR=%~dp0UP BlackBox 4.0

REM Verifica se a pasta existe
if not exist "%BB4_DIR%" (
    echo ERRO: Pasta UP BlackBox 4.0 nao encontrada!
    pause
    exit /b 1
)

REM Ativa a venv do BlackBox 4.0 (crie antes com python -m venv venv_bb4)
if exist "%BB4_DIR%\venv_bb4\Scripts\activate.bat" (
    echo Ativando ambiente virtual do UP BlackBox 4.0...
    call "%BB4_DIR%\venv_bb4\Scripts\activate.bat"
) else (
    echo AVISO: Ambiente virtual do UP BlackBox 4.0 nao encontrado em "%BB4_DIR%\venv_bb4\"
    echo Continuando sem ativar o ambiente virtual...
)

REM Porta do backend principal (FastAPI)
set "MAIN_PORT=8000"
REM Porta do serviço de market data (dispatcher ProfitDLL)
set "FEED_PORT=8001"
REM Porta do UP BlackBox 2.0 (Sistema de backtests)
set "BB2_PORT=8003"

echo.
echo Iniciando serviços backend...
echo - Backend principal (FastAPI): http://localhost:%MAIN_PORT%
echo - Market Data Feed: http://localhost:%FEED_PORT%
echo - UP BlackBox 2.0 (Backtests): http://localhost:%BB2_PORT%
echo - Quant Engine: Sistema de estrategias quantitativas
echo.

REM Variaveis para integracao com High Frequency Backend (ingestao em lote)
set HF_INGEST_URL=http://127.0.0.1:8002/ingest/batch
set HF_BATCH_MS=50
set HF_BATCH_MAX=1000

REM Sobe o backend principal em uma nova janela
echo Iniciando backend principal na pasta: "%BB4_DIR%"
start "UPBB4 API" cmd /k cd /d "%BB4_DIR%" ^& uvicorn main:app --reload --port %MAIN_PORT%

REM Sobe o High Frequency Backend em outra janela (sem simulacao)
echo Iniciando High Frequency Backend na pasta: "%~dp0services\high_frequency"
start "HF Backend" cmd /k cd /d "%~dp0services\high_frequency" ^& set HF_DISABLE_SIM=1 ^& set PROFIT_FEED_URL=http://localhost:%FEED_PORT% ^& start_backend.bat

REM Sobe o serviço de market data em outra janela  
echo Iniciando market feed na pasta: "%~dp0"
start "Market Feed" cmd /k cd /d "%~dp0" ^& python services\profit\run_server.py %FEED_PORT%

REM Sobe o UP BlackBox 2.0 em outra janela
echo Iniciando UP BlackBox 2.0 na pasta: "%~dp0UP BlackBox 2.0"
start "UP BlackBox 2.0" cmd /k cd /d "%~dp0UP BlackBox 2.0" ^& start_with_venv.bat

REM Sobe o quant engine em outra janela
echo Iniciando quant engine na pasta: "%~dp0services\quant\"
start "Quant Engine" cmd /k cd /d "%~dp0services\quant\" ^& start_quant_engine.bat

REM Aguarda um momento para os serviços iniciarem
timeout /t 5 /nobreak >nul

echo.
echo Iniciando o frontend (Next.js)...
echo.

REM Inicia o servidor de desenvolvimento do Next.js
npm run dev 