@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Navega para a raiz do projeto a partir da pasta deste .bat
cd /d "%~dp0..\.."

REM Configura variaveis de ambiente (ajuste se necessario)
set HOST=127.0.0.1
set PORT=8010
set PYTHONUTF8=1
set PYTHONIOENCODING=UTF-8

REM Inicia o AI Lab Backend (FastAPI + Uvicorn)
echo Iniciando AI Lab Backend na porta %PORT% ...
python services\ml_lab\start_uvicorn.py

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Ocorreu um erro ao iniciar o AI Lab Backend (codigo %ERRORLEVEL%).
  echo Verifique se as dependencias estao instaladas (uvicorn, fastapi, psycopg).
)

echo.
echo Encerrado. Pressione qualquer tecla para sair.
pause > nul
endlocal

