@echo off
chcp 65001 >nul 2>&1
echo ==========================================
echo     UP GESTORA - QUANT ENGINE
echo ==========================================
echo.
echo Iniciando sistema de estrategias quantitativas...
echo.

REM Ativar ambiente virtual se existir
if exist "venv\Scripts\activate.bat" (
    echo Ativando ambiente virtual...
    call venv\Scripts\activate.bat
) else (
    echo AVISO: Ambiente virtual nao encontrado. 
    echo Recomendamos criar com: python -m venv venv
    echo.
)

REM Verificar dependências
echo Verificando dependencias...
pip install -r requirements.txt --quiet

echo.
echo ==========================================
echo  QUANT ENGINE INICIADO
echo ==========================================
echo.
echo Para parar: Ctrl + C
echo Logs salvos em: quant_engine.log
echo.
echo Status: Paper Trading DESATIVO (ordens reais)
echo BlackBox API: http://localhost:8000
echo Profit Feed: http://localhost:8001
echo.

REM Iniciar o engine
python quant_engine.py

echo.
echo ==========================================
echo  QUANT ENGINE FINALIZADO
echo ==========================================
pause 