@echo off
REM Inicia os serviços backend da UP BlackBox 4.0

REM Caminho para esta pasta
set "BASE_DIR=%~dp0"

REM Ativa a venv (crie antes com python -m venv venv_bb4)
call "%BASE_DIR%venv_bb4\Scripts\activate.bat"

REM ---------------------------------------------------------------------------
REM Opções gerais
REM ---------------------------------------------------------------------------

REM Porta do backend principal (FastAPI)
set "MAIN_PORT=8000"
REM Porta do serviço de market data (dispatcher ProfitDLL)
set "FEED_PORT=8001"
REM Define para quem precisar consumir (ex.: rotas Next.js)
set "PROFIT_FEED_URL=http://127.0.0.1:%FEED_PORT%"

REM ---------------------------------------------------------------------------
REM Sobe o backend principal em uma nova janela
REM ---------------------------------------------------------------------------
start "UPBB4 API" cmd /k "cd /d %BASE_DIR% & uvicorn main:app --reload --port %MAIN_PORT%"

REM ---------------------------------------------------------------------------
REM Sobe o serviço de market data em outra janela
REM ---------------------------------------------------------------------------
start "Market Feed" cmd /k "cd /d %BASE_DIR%.. & uvicorn services.profit.dispatcher:app --reload --port %FEED_PORT%"

REM Mantém esta janela aberta para não encerrar o script
pause 