@echo off
chcp 65001 >nul
echo ============================================================
echo 🗑️  LIMPEZA COMPLETA DO BANCO DE DADOS
echo ============================================================
echo ⚠️  ATENÇÃO: Este script irá EXCLUIR TODOS os dados!
echo 📋 Use apenas quando quiser recomeçar do zero
echo ============================================================
echo.

REM Verifica se o Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python não encontrado! Instale o Python primeiro.
    echo 📥 Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Verifica se o psycopg está instalado
python -c "import psycopg" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Biblioteca psycopg não encontrada!
    echo 📦 Instalando psycopg...
    pip install psycopg[binary]
    if errorlevel 1 (
        echo ❌ Erro ao instalar psycopg!
        pause
        exit /b 1
    )
)

echo ✅ Dependências verificadas
echo.

REM Executa o script Python
echo 🚀 Executando limpeza do banco de dados...
python "%~dp0clear_all_tables.py"

echo.
echo ============================================================
echo 🏁 Script finalizado
echo ============================================================
pause
