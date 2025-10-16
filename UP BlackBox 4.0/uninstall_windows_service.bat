@echo off
REM =========================================
REM UP BlackBox 4.0 - Desinstalador de Servico Windows
REM =========================================
REM Este script remove o servico Windows do UP BlackBox 4.0
REM
REM IMPORTANTE: Execute como Administrador!

echo ========================================
echo UP BlackBox 4.0 - Desinstalador
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

set "SERVICE_NAME=UPBlackBox4"

REM Verificar se NSSM esta disponivel
if exist "nssm.exe" (
    set NSSM_PATH=%cd%\nssm.exe
) else (
    where nssm >nul 2>&1
    if errorlevel 1 (
        echo ERRO: NSSM nao encontrado!
        echo Baixe de: https://nssm.cc/download
        pause
        exit /b 1
    ) else (
        set NSSM_PATH=nssm
    )
)

REM Verificar se servico existe
%NSSM_PATH% status %SERVICE_NAME% >nul 2>&1
if errorlevel 1 (
    echo Servico %SERVICE_NAME% nao esta instalado.
    pause
    exit /b 0
)

echo Servico encontrado: %SERVICE_NAME%
echo.
choice /C SN /M "Deseja realmente remover o servico"
if errorlevel 2 (
    echo Operacao cancelada.
    pause
    exit /b 0
)

echo.
echo Parando servico...
%NSSM_PATH% stop %SERVICE_NAME%
timeout /t 3 /nobreak >nul

echo Removendo servico...
%NSSM_PATH% remove %SERVICE_NAME% confirm

echo.
echo Servico removido com sucesso!
echo.
pause
