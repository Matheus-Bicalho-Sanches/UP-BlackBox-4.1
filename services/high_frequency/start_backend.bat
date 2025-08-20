@echo off
echo ========================================
echo High Frequency Market Data Backend
echo ========================================
echo Sistema otimizado para 50K+ ticks/segundo
echo.

REM Verifica se o ambiente virtual existe
if not exist "venv" (
    echo Criando ambiente virtual...
    python -m venv venv
    if errorlevel 1 (
        echo ERRO: Falha ao criar ambiente virtual
        pause
        exit /b 1
    )
)

REM Ativa o ambiente virtual
echo Ativando ambiente virtual...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERRO: Falha ao ativar ambiente virtual
    pause
    exit /b 1
)

REM Instala/atualiza dependências
echo Instalando dependencias...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias
    pause
    exit /b 1
)

REM Verifica se o banco está rodando
echo Verificando conexao com banco de dados...
python -c "import psycopg; psycopg.connect('postgres://postgres:postgres@localhost:5432/market_data')" 2>nul
if errorlevel 1 (
    echo AVISO: Nao foi possivel conectar ao banco de dados
    echo Certifique-se de que o PostgreSQL + TimescaleDB esta rodando
    echo.
)

echo.
echo Iniciando High Frequency Backend...
echo Porta: 8002
echo URL: http://localhost:8002
echo.
echo Endpoints disponiveis:
echo - POST /subscribe     - Inscrever em simbolo
echo - POST /unsubscribe   - Cancelar inscricao
echo - GET  /subscriptions - Listar assinaturas ativas
echo - GET  /ticks/{symbol} - Obter ticks
echo - GET  /status        - Status do sistema
echo - GET  /metrics       - Metricas de performance
echo - GET  /test          - Teste de conectividade
echo.
echo Pressione Ctrl+C para parar
echo.

REM Usa o argumento 1 como raiz do projeto; se não vier, infere duas pastas acima
set "PROJECT_ROOT=%~1"
if "%PROJECT_ROOT%"=="" set "PROJECT_ROOT=%~dp0..\.."

REM Garante que rodamos a partir da raiz do projeto
cd /d "%PROJECT_ROOT%"

REM Inicia o app usando script customizado que força o SelectorEventLoop
python services\high_frequency\start_uvicorn.py

pause
