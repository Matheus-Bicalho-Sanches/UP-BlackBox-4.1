@echo off
echo ========================================
echo Configurando ambientes virtuais Python
echo ========================================
echo.

REM Verifica se o Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python nao encontrado!
    echo Por favor, instale o Python 3.8+ e adicione ao PATH
    pause
    exit /b 1
)

echo Python encontrado! Configurando ambientes...
echo.

REM ========================================
REM UP BlackBox 4.0
REM ========================================
echo [1/4] Configurando UP BlackBox 4.0...
cd "UP BlackBox 4.0"

REM Verifica se a venv existe, se não, cria
if not exist "venv_bb4\Scripts\activate.bat" (
    echo Criando ambiente virtual...
    python -m venv venv_bb4
)

REM Ativa a venv e instala dependências
echo Ativando ambiente virtual...
call venv_bb4\Scripts\activate.bat
echo Instalando dependencias...
pip install -r requirements.txt

REM Volta para a pasta raiz
cd ..

REM ========================================
REM UP BlackBox 2.0
REM ========================================
echo.
echo [2/4] Configurando UP BlackBox 2.0...
cd "UP BlackBox 2.0"

REM Verifica se a venv existe, se não, cria
if not exist "venv_bb2\Scripts\activate.bat" (
    echo Criando ambiente virtual...
    python -m venv venv_bb2
)

REM Ativa a venv e instala dependências
echo Ativando ambiente virtual...
call venv_bb2\Scripts\activate.bat
echo Instalando dependencias...
pip install -r requirements.txt

REM Volta para a pasta raiz
cd ..

REM ========================================
REM Services/Profit
REM ========================================
echo.
echo [3/4] Configurando Services/Profit...
cd services\profit

REM Verifica se a venv existe, se não, cria
if not exist "venv\Scripts\activate.bat" (
    echo Criando ambiente virtual...
    python -m venv venv
)

REM Ativa a venv e instala dependências
echo Ativando ambiente virtual...
call venv\Scripts\activate.bat
echo Instalando dependencias...
pip install -r requirements.txt

REM Volta para a pasta raiz
cd ..\..

REM ========================================
REM Services/Quant
REM ========================================
echo.
echo [4/4] Configurando Services/Quant...
cd services\quant

REM Verifica se a venv existe, se não, cria
if not exist "venv\Scripts\activate.bat" (
    echo Criando ambiente virtual...
    python -m venv venv
)

REM Ativa a venv e instala dependências
echo Ativando ambiente virtual...
call venv\Scripts\activate.bat
echo Instalando dependencias...
pip install -r requirements.txt

REM Volta para a pasta raiz
cd ..\..

echo.
echo ========================================
echo Configuracao concluida com sucesso!
echo ========================================
echo.
echo Agora voce pode executar o start-dev.bat
echo.
pause
