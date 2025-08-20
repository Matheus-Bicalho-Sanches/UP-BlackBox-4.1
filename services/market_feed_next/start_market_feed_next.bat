@echo off
echo Iniciando Market Feed Next...
setlocal

if "%HF_INGEST_URL%"=="" set HF_INGEST_URL=http://127.0.0.1:8002/ingest/batch
if "%HF_BATCH_MS%"=="" set HF_BATCH_MS=50
if "%HF_BATCH_MAX%"=="" set HF_BATCH_MAX=1000

REM Inicia o launcher da DLL em background
echo Iniciando o processo da DLL em background...
start "DLL Launcher" /B python services/market_feed_next/dll_launcher.py

REM Aguarda um pouco para a DLL inicializar
timeout /t 5 /nobreak >nul

REM Inicia a API FastAPI que se comunica com a DLL
echo Iniciando a API do Market Feed...
python -m uvicorn services.market_feed_next.main:app --host 0.0.0.0 --port 8001

echo.
echo O processo foi finalizado. Pressione qualquer tecla para fechar...
pause >nul

endlocal
