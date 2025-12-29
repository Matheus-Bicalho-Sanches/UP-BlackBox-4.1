@echo off
REM Script para iniciar NATS Server via Docker
echo ====================================
echo Iniciando NATS Server via Docker
echo ====================================
echo.

REM Verifica se Docker está instalado e rodando
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Docker nao encontrado!
    echo Por favor, instale o Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [OK] Docker encontrado
echo.

REM Verifica se Docker está rodando
docker ps >nul 2>&1
if errorlevel 1 (
    echo ERRO: Docker nao esta rodando!
    echo Por favor, inicie o Docker Desktop e tente novamente.
    pause
    exit /b 1
)

echo [OK] Docker esta rodando
echo.

REM Verifica se o container NATS já está rodando
docker ps --filter "name=nats-server" --format "{{.Names}}" | findstr /C:"nats-server" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Container NATS ja esta rodando
    echo.
    docker ps --filter "name=nats-server"
    echo.
    echo Para ver os logs: docker logs -f nats-server
    pause
    exit /b 0
)

REM Para e remove container antigo se existir (mas não está rodando)
docker stop nats-server >nul 2>&1
docker rm nats-server >nul 2>&1

echo Iniciando container NATS na porta 4222...
echo.

REM Inicia o container NATS
docker run -d ^
    --name nats-server ^
    -p 4222:4222 ^
    -p 8222:8222 ^
    -p 6222:6222 ^
    nats:latest

if errorlevel 1 (
    echo ERRO: Falha ao iniciar container NATS
    echo.
    echo Tentando baixar imagem NATS...
    docker pull nats:latest
    if errorlevel 1 (
        echo ERRO: Falha ao baixar imagem NATS
        pause
        exit /b 1
    )
    docker run -d --name nats-server -p 4222:4222 -p 8222:8222 -p 6222:6222 nats:latest
    if errorlevel 1 (
        echo ERRO: Falha ao iniciar container NATS apos baixar imagem
        pause
        exit /b 1
    )
)

echo.
echo [OK] NATS Server iniciado com sucesso!
echo.
echo Container: nats-server
echo Porta cliente: 4222
echo Porta monitoramento: 8222 (http://localhost:8222)
echo.
echo Para ver os logs: docker logs -f nats-server
echo Para parar: docker stop nats-server
echo Ou use: stop_nats.bat
echo.
pause


