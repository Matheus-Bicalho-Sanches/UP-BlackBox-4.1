@echo off
echo =========================================
echo   CONFIGURANDO TODOS OS AMBIENTES
echo =========================================
echo.

REM ===== FRONTEND (Next.js) =====
echo [1/4] Configurando Frontend (Next.js)...
echo Instalando dependencias do Node.js...
call npm install
echo Frontend configurado!
echo.

REM ===== UP BLACKBOX 4.0 =====
echo [2/4] Configurando UP BlackBox 4.0...
cd "UP BlackBox 4.0"
if not exist "venv_bb4" python -m venv venv_bb4
call venv_bb4\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install fastapi uvicorn pydantic firebase-admin python-dotenv --quiet
call deactivate
cd ..
echo UP BlackBox 4.0 configurado!
echo.

REM ===== UP BLACKBOX 2.0 =====
echo [3/4] Configurando UP BlackBox 2.0...
cd "UP BlackBox 2.0"
if not exist "venv" python -m venv venv
call venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install fastapi uvicorn firebase-admin python-dotenv pandas requests python-multipart --quiet
call deactivate
cd ..
echo UP BlackBox 2.0 configurado!
echo.

REM ===== SERVICES PROFIT =====
echo [4/5] Configurando Services Profit...
cd "services\profit"
if exist "venv" rmdir /s /q venv
python -m venv venv
call venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install python-dotenv fastapi uvicorn firebase-admin --quiet
call deactivate
cd ..\..
echo Services Profit configurado!
echo.

REM ===== QUANT ENGINE =====
echo [5/5] Configurando Quant Engine...
cd "services\quant"
if exist "venv" rmdir /s /q venv
python -m venv venv
call venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install numpy==1.26.4 --quiet
pip install pandas==2.1.4 --quiet  
pip install firebase-admin==6.4.0 --quiet
pip install aiohttp matplotlib --quiet
call deactivate
cd ..\..
echo Quant Engine configurado!
echo.

echo =========================================
echo   TODOS OS AMBIENTES CONFIGURADOS!
echo =========================================
echo.
echo Agora voce pode executar: start-dev.bat
echo.
pause 