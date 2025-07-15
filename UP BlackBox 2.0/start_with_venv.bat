@echo off
echo Iniciando UP BlackBox 2.0 com ambiente virtual...
echo.

REM Verifica se o ambiente virtual existe
if not exist "venv_bb2\Scripts\activate.bat" (
    echo ERRO: Ambiente virtual nao encontrado!
    echo Execute primeiro: python -m venv venv_bb2
    echo E depois: venv_bb2\Scripts\activate e pip install -r requirements.txt
    pause
    exit /b 1
)

REM Ativa o ambiente virtual
call venv_bb2\Scripts\activate

REM Verifica se as dependências estão instaladas
python -c "import fastapi, uvicorn, firebase_admin, pandas, requests" 2>nul
if errorlevel 1 (
    echo Instalando dependencias...
    pip install -r requirements.txt --quiet
    echo Dependencias instaladas!
)

REM Inicia o servidor
echo.
echo =========================================
echo   UP BLACKBOX 2.0 - BACKEND
echo =========================================
echo.
echo Backend UP BlackBox 2.0 rodando em: http://localhost:8003
echo Para parar o servidor, pressione Ctrl + C
echo.
python -m uvicorn main:app --reload --port 8003 --host 0.0.0.0 