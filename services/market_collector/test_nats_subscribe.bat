@echo off
REM Script para testar subscrição NATS e verificar mensagens
echo ====================================
echo Teste de Subscricao NATS
echo ====================================
echo.
echo Este script requer NATS CLI instalado.
echo Download: https://github.com/nats-io/natscli/releases
echo.
echo Verificando NATS CLI...

where nats >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: NATS CLI nao encontrado!
    echo.
    echo Opcoes:
    echo 1. Baixe nats.exe de: https://github.com/nats-io/natscli/releases
    echo 2. Coloque nats.exe no PATH ou nesta pasta
    echo.
    echo Alternativa: Use Docker para subscrever:
    echo   docker run --rm -it --network host natsio/nats-box nats sub "trades.^>"
    echo.
    pause
    exit /b 1
)

echo [OK] NATS CLI encontrado
echo.
echo Escolha o topico para subscrever:
echo 1. trades.* (todos os trades)
echo 2. order_book.* (todo o order book)
echo 3. * (todos os topicos)
echo 4. Custom (digite o topico)
echo.
set /p choice="Opcao (1-4): "

if "%choice%"=="1" set TOPIC=trades.>
if "%choice%"=="2" set TOPIC=order_book.>
if "%choice%"=="3" set TOPIC=>
if "%choice%"=="4" (
    set /p TOPIC="Digite o topico (ex: trades.WINZ25): "
)

if "%TOPIC%"=="" set TOPIC=trades.>

echo.
echo Subscrevendo no topico: %TOPIC%
echo Pressione Ctrl+C para parar
echo.

nats sub "%TOPIC%"




