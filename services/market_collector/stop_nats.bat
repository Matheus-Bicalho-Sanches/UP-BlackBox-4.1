@echo off
REM Script para parar NATS Server
echo ====================================
echo Parando NATS Server
echo ====================================
echo.

docker stop nats-server >nul 2>&1
if errorlevel 1 (
    echo [INFO] Container NATS nao esta rodando
) else (
    echo [OK] Container NATS parado
)

docker rm nats-server >nul 2>&1
if errorlevel 1 (
    echo [INFO] Container NATS nao existe para remover
) else (
    echo [OK] Container NATS removido
)

echo.
echo NATS Server parado com sucesso!
pause




