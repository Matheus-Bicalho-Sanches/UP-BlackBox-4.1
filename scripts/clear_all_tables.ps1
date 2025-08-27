# ============================================================
# 🗑️  LIMPEZA COMPLETA DO BANCO DE DADOS
# ============================================================
# ⚠️  ATENÇÃO: Este script irá EXCLUIR TODOS os dados!
# 📋 Use apenas quando quiser recomeçar do zero
# ============================================================

param(
    [switch]$Force,
    [switch]$Verbose
)

# Configurações
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Função para exibir mensagens coloridas
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Função para exibir cabeçalho
function Show-Header {
    Write-ColorOutput "=" * 60 "Cyan"
    Write-ColorOutput "🗑️  LIMPEZA COMPLETA DO BANCO DE DADOS" "Yellow"
    Write-ColorOutput "=" * 60 "Cyan"
    Write-ColorOutput "⚠️  ATENÇÃO: Este script irá EXCLUIR TODOS os dados!" "Red"
    Write-ColorOutput "📋 Use apenas quando quiser recomeçar do zero" "Yellow"
    Write-ColorOutput "=" * 60 "Cyan"
    Write-Host ""
}

# Função para verificar dependências
function Test-Dependencies {
    Write-ColorOutput "🔍 Verificando dependências..." "Cyan"
    
    # Verifica Python
    try {
        $pythonVersion = python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Python encontrado: $pythonVersion" "Green"
        } else {
            throw "Python não encontrado"
        }
    } catch {
        Write-ColorOutput "❌ Python não encontrado! Instale o Python primeiro." "Red"
        Write-ColorOutput "📥 Download: https://www.python.org/downloads/" "Yellow"
        exit 1
    }
    
    # Verifica psycopg
    try {
        $psycopgTest = python -c "import psycopg" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Biblioteca psycopg encontrada" "Green"
        } else {
            throw "psycopg não encontrado"
        }
    } catch {
        Write-ColorOutput "⚠️  Biblioteca psycopg não encontrada!" "Yellow"
        Write-ColorOutput "📦 Instalando psycopg..." "Cyan"
        
        try {
            pip install psycopg[binary]
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "✅ psycopg instalado com sucesso" "Green"
            } else {
                throw "Erro na instalação"
            }
        } catch {
            Write-ColorOutput "❌ Erro ao instalar psycopg!" "Red"
            exit 1
        }
    }
    
    Write-ColorOutput "✅ Todas as dependências verificadas" "Green"
    Write-Host ""
}

# Função para confirmar execução
function Confirm-Execution {
    if ($Force) {
        Write-ColorOutput "🚨 Modo FORCE ativado - pulando confirmação!" "Red"
        return $true
    }
    
    Write-ColorOutput "❓ Tem certeza que deseja EXCLUIR TODOS os dados?" "Red"
    Write-ColorOutput "   Digite 'SIM' para confirmar ou qualquer outra coisa para cancelar:" "Yellow"
    
    $confirm = Read-Host
    
    if ($confirm -eq "SIM") {
        Write-ColorOutput "✅ Confirmação aceita" "Green"
        return $true
    } else {
        Write-ColorOutput "❌ Operação cancelada pelo usuário" "Red"
        return $false
    }
}

# Função para executar limpeza
function Start-Cleanup {
    Write-ColorOutput "🚀 Executando limpeza do banco de dados..." "Cyan"
    
    try {
        # Navega para o diretório do script
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $pythonScript = Join-Path $scriptDir "clear_all_tables.py"
        
        if (-not (Test-Path $pythonScript)) {
            throw "Script Python não encontrado: $pythonScript"
        }
        
        # Executa o script Python
        if ($Verbose) {
            Write-ColorOutput "🔍 Executando com modo verbose..." "Cyan"
            python $pythonScript --verbose
        } else {
            python $pythonScript
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Script Python executado com sucesso" "Green"
        } else {
            throw "Script Python retornou código de erro: $LASTEXITCODE"
        }
        
    } catch {
        Write-ColorOutput "❌ Erro ao executar limpeza: $_" "Red"
        exit 1
    }
}

# Função para exibir rodapé
function Show-Footer {
    Write-Host ""
    Write-ColorOutput "=" * 60 "Cyan"
    Write-ColorOutput "🏁 Script finalizado" "Yellow"
    Write-ColorOutput "=" * 60 "Cyan"
}

# Função principal
function Main {
    try {
        # Exibe cabeçalho
        Show-Header
        
        # Verifica dependências
        Test-Dependencies
        
        # Confirma execução
        if (-not (Confirm-Execution)) {
            exit 0
        }
        
        # Executa limpeza
        Start-Cleanup
        
        # Exibe rodapé
        Show-Footer
        
    } catch {
        Write-ColorOutput "💥 Erro fatal: $_" "Red"
        Write-ColorOutput "📋 Stack trace:" "Yellow"
        Write-Host $_.Exception.StackTrace
        exit 1
    }
}

# Executa função principal
Main
