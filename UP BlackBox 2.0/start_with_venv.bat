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

REM Inicia o servidor
echo Backend UP BlackBox 2.0 rodando em: http://localhost:8003
python -m uvicorn main:app --reload --port 8003 