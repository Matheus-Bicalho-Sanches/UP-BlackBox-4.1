@echo off
echo === UP 5.0 WebSocket Gateway ===
echo.

cd /d "%~dp0"

REM Verifica se o Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js
    pause
    exit /b 1
)

REM Instala dependências se necessário
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo ERRO: Falha ao instalar dependencias!
        pause
        exit /b 1
    )
)

echo.
echo Iniciando gateway WebSocket na porta 3001...
echo Pressione Ctrl+C para encerrar
echo.

node index.js

pause

