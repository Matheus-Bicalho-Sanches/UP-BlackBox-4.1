@echo off
echo ==========================================
echo  INSTALADOR - UP GESTORA QUANT ENGINE
echo ==========================================
echo.

REM Verificar se Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERRO: Python nao encontrado!
    echo.
    echo Instale Python 3.8+ de: https://python.org
    pause
    exit /b 1
)

echo ✅ Python encontrado:
python --version

echo.
echo 🔍 Verificando compatibilidade...
for /f "tokens=2" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo Versão do Python: %PYTHON_VERSION%

echo.
echo 📦 Criando ambiente virtual...
if exist "venv" (
    echo ⚠️ Ambiente virtual já existe. Removendo...
    rmdir /s /q venv
)

python -m venv venv
if %errorlevel% neq 0 (
    echo ❌ ERRO: Falha ao criar ambiente virtual!
    pause
    exit /b 1
)

echo ✅ Ambiente virtual criado!

echo.
echo 🔧 Ativando ambiente virtual...
call venv\Scripts\activate.bat

echo.
echo 📚 Instalando dependências...
echo Atualizando pip...
python -m pip install --upgrade pip

echo.
echo Instalando pacotes (isso pode demorar alguns minutos)...
pip install --no-cache-dir -r requirements.txt

if %errorlevel% neq 0 (
    echo ❌ ERRO: Falha ao instalar dependências!
    echo.
    echo 💡 Possíveis soluções:
    echo - Verifique sua conexão com a internet
    echo - Execute como administrador
    echo - Tente instalar manualmente: pip install numpy pandas
    pause
    exit /b 1
)

echo ✅ Dependências instaladas!

echo.
echo 🧪 Testando instalação...
python test_installation.py

echo.
echo ==========================================
echo  INSTALAÇÃO CONCLUÍDA! 
echo ==========================================
echo.
echo 📋 Próximos passos:
echo.
echo 1. Configure as APIs (localhost:8000 e 8001)
echo 2. Crie a estratégia no frontend
echo 3. Execute: start_quant_engine.bat
echo.
echo 📖 Consulte QUICK_START.md para instruções detalhadas
echo.
pause 