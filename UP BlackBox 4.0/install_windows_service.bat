@echo off
REM =========================================
REM UP BlackBox 4.0 - Instalador de Servico Windows
REM =========================================
REM Este script instala o backend como servico Windows
REM usando NSSM (Non-Sucking Service Manager)
REM
REM IMPORTANTE: Execute como Administrador!

echo ========================================
echo UP BlackBox 4.0 - Instalador de Servico
echo ========================================
echo.

REM Verificar se esta rodando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Este script precisa ser executado como Administrador!
    echo Clique com botao direito e selecione "Executar como administrador"
    pause
    exit /b 1
)

echo [OK] Executando como Administrador
echo.

REM ---------------------------------------------------------------------------
REM Verificar se NSSM esta disponivel
REM ---------------------------------------------------------------------------
echo Verificando NSSM (Non-Sucking Service Manager)...
echo.

if exist "nssm.exe" (
    echo [OK] NSSM encontrado nesta pasta
    set NSSM_PATH=%cd%\nssm.exe
) else (
    where nssm >nul 2>&1
    if errorlevel 1 (
        echo ERRO: NSSM nao encontrado!
        echo.
        echo Por favor, baixe NSSM de: https://nssm.cc/download
        echo.
        echo Opcoes:
        echo 1. Baixe nssm.exe e coloque nesta pasta
        echo 2. Ou instale NSSM e adicione ao PATH do sistema
        echo.
        pause
        exit /b 1
    ) else (
        echo [OK] NSSM encontrado no PATH do sistema
        set NSSM_PATH=nssm
    )
)

REM ---------------------------------------------------------------------------
REM Configurar caminhos
REM ---------------------------------------------------------------------------
set "SERVICE_NAME=UPBlackBox4"
set "CURRENT_DIR=%cd%"
set "PYTHON_EXE=%CURRENT_DIR%\venv_bb4\Scripts\python.exe"
set "UVICORN_PATH=%CURRENT_DIR%\venv_bb4\Scripts\uvicorn.exe"

echo.
echo Configuracao do servico:
echo - Nome: %SERVICE_NAME%
echo - Pasta: %CURRENT_DIR%
echo - Python: %PYTHON_EXE%
echo.

REM ---------------------------------------------------------------------------
REM Verificar se ambiente virtual existe
REM ---------------------------------------------------------------------------
if not exist "%PYTHON_EXE%" (
    echo ERRO: Ambiente virtual nao encontrado!
    echo Por favor, crie o ambiente virtual primeiro:
    echo    python -m venv venv_bb4
    echo    venv_bb4\Scripts\activate
    echo    pip install -r requirements_completo.txt
    pause
    exit /b 1
)

REM ---------------------------------------------------------------------------
REM Verificar se servico ja existe
REM ---------------------------------------------------------------------------
%NSSM_PATH% status %SERVICE_NAME% >nul 2>&1
if not errorlevel 1 (
    echo.
    echo AVISO: Servico %SERVICE_NAME% ja existe!
    echo.
    choice /C SN /M "Deseja remover e reinstalar"
    if errorlevel 2 (
        echo Instalacao cancelada.
        pause
        exit /b 0
    )
    echo Removendo servico existente...
    %NSSM_PATH% stop %SERVICE_NAME%
    timeout /t 2 /nobreak >nul
    %NSSM_PATH% remove %SERVICE_NAME% confirm
    echo Servico removido.
    echo.
)

REM ---------------------------------------------------------------------------
REM Instalar servico
REM ---------------------------------------------------------------------------
echo Instalando servico %SERVICE_NAME%...
echo.

REM Instalar servico basico
%NSSM_PATH% install %SERVICE_NAME% "%PYTHON_EXE%" "-m" "uvicorn" "main:app" "--host" "0.0.0.0" "--port" "8000"

REM Configurar diretorio de trabalho
%NSSM_PATH% set %SERVICE_NAME% AppDirectory "%CURRENT_DIR%"

REM Configurar display name e descricao
%NSSM_PATH% set %SERVICE_NAME% DisplayName "UP BlackBox 4.0 API"
%NSSM_PATH% set %SERVICE_NAME% Description "Backend API do sistema UP BlackBox 4.0 - Gestao de Carteiras"

REM Configurar para iniciar automaticamente
%NSSM_PATH% set %SERVICE_NAME% Start SERVICE_AUTO_START

REM Configurar logs
if not exist "%CURRENT_DIR%\logs" mkdir "%CURRENT_DIR%\logs"
%NSSM_PATH% set %SERVICE_NAME% AppStdout "%CURRENT_DIR%\logs\service_stdout.log"
%NSSM_PATH% set %SERVICE_NAME% AppStderr "%CURRENT_DIR%\logs\service_stderr.log"

REM Rotacao de logs (10 MB)
%NSSM_PATH% set %SERVICE_NAME% AppStdoutCreationDisposition 4
%NSSM_PATH% set %SERVICE_NAME% AppStderrCreationDisposition 4
%NSSM_PATH% set %SERVICE_NAME% AppRotateFiles 1
%NSSM_PATH% set %SERVICE_NAME% AppRotateBytes 10485760

REM Configurar reinicio automatico em caso de falha
%NSSM_PATH% set %SERVICE_NAME% AppExit Default Restart
%NSSM_PATH% set %SERVICE_NAME% AppRestartDelay 5000

echo.
echo ========================================
echo Servico instalado com sucesso!
echo ========================================
echo.

REM ---------------------------------------------------------------------------
REM Perguntar se deseja iniciar o servico agora
REM ---------------------------------------------------------------------------
choice /C SN /M "Deseja iniciar o servico agora"
if errorlevel 2 (
    echo.
    echo Servico instalado mas nao iniciado.
    goto :show_commands
)

echo.
echo Iniciando servico...
%NSSM_PATH% start %SERVICE_NAME%

REM Aguardar um pouco e verificar status
timeout /t 3 /nobreak >nul
%NSSM_PATH% status %SERVICE_NAME%

echo.
echo Servico iniciado!
echo.
echo Aguarde alguns segundos e acesse:
echo - API: http://localhost:8000
echo - Docs: http://localhost:8000/docs
echo.

:show_commands
REM ---------------------------------------------------------------------------
REM Mostrar comandos uteis
REM ---------------------------------------------------------------------------
echo ========================================
echo Comandos Uteis
echo ========================================
echo.
echo Para gerenciar o servico:
echo   %NSSM_PATH% start %SERVICE_NAME%       - Iniciar servico
echo   %NSSM_PATH% stop %SERVICE_NAME%        - Parar servico
echo   %NSSM_PATH% restart %SERVICE_NAME%     - Reiniciar servico
echo   %NSSM_PATH% status %SERVICE_NAME%      - Ver status
echo   %NSSM_PATH% remove %SERVICE_NAME% confirm - Remover servico
echo.
echo Ou use o Gerenciador de Servicos do Windows:
echo   services.msc
echo.
echo Logs do servico em:
echo   %CURRENT_DIR%\logs\
echo.

pause
