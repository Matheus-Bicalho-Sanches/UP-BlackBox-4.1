@echo off
echo ========================================
echo   SETUP E INICIO DOS SERVIDORES
echo ========================================
echo.

REM Verifica se node_modules existe
if not exist "node_modules" (
    echo [1/3] Instalando dependencias do frontend...
    call npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias do frontend
        pause
        exit /b 1
    )
    echo Frontend configurado!
) else (
    echo [1/3] Dependencias do frontend ja instaladas.
)

echo.

REM Verifica se venv_bb4 existe
if not exist "UP BlackBox 4.0\venv_bb4" (
    echo [2/3] Criando ambiente virtual do backend...
    cd "UP BlackBox 4.0"
    python -m venv venv_bb4
    if errorlevel 1 (
        echo ERRO: Falha ao criar ambiente virtual
        pause
        exit /b 1
    )
    
    echo Instalando dependencias do backend...
    call venv_bb4\Scripts\activate.bat
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias do backend
        pause
        exit /b 1
    )
    cd ..
    echo Backend configurado!
) else (
    echo [2/3] Ambiente virtual do backend ja existe.
    echo Atualizando dependencias do backend...
    cd "UP BlackBox 4.0"
    call venv_bb4\Scripts\activate.bat
    pip install -r requirements.txt --quiet
    cd ..
)

echo.
echo [3/3] Iniciando servidores...
echo.

REM Inicia o backend em uma nova janela
start "UP BlackBox 4.0 - Backend" cmd /k "cd /d %~dp0UP BlackBox 4.0 && call venv_bb4\Scripts\activate.bat && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM Aguarda 3 segundos para o backend iniciar
timeout /t 3 /nobreak >nul

REM Inicia o frontend em uma nova janela
start "UP BlackBox 4.0 - Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo   SERVIDORES INICIADOS!
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause
