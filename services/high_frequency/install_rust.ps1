# Script para instalar Rust no Windows
# =====================================

Write-Host "🦀 Instalando Rust para Windows..." -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Verifica se o Rust já está instalado
try {
    $rustVersion = rustc --version 2>$null
    if ($rustVersion) {
        Write-Host "✅ Rust já está instalado: $rustVersion" -ForegroundColor Green
        Write-Host "🚀 Prosseguindo com a instalação das dependências..." -ForegroundColor Yellow
        exit 0
    }
} catch {
    Write-Host "ℹ️ Rust não encontrado, prosseguindo com instalação..." -ForegroundColor Yellow
}

# Cria diretório temporário para download
$tempDir = "$env:TEMP\rust_install"
if (!(Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
}

# URL do instalador Rust para Windows
$rustupUrl = "https://win.rustup.rs/x86_64"
$rustupPath = "$tempDir\rustup-init.exe"

Write-Host "📥 Baixando instalador Rust..." -ForegroundColor Cyan

try {
    # Baixa o instalador
    Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupPath -UseBasicParsing
    
    if (Test-Path $rustupPath) {
        Write-Host "✅ Download concluído: $rustupPath" -ForegroundColor Green
        
        Write-Host "🔧 Executando instalador Rust..." -ForegroundColor Cyan
        Write-Host "⚠️  IMPORTANTE: Na janela que abrir, escolha opção 1 (instalação padrão)" -ForegroundColor Yellow
        Write-Host "⏳ Aguardando instalação..." -ForegroundColor Yellow
        
        # Executa o instalador
        Start-Process -FilePath $rustupPath -Wait -ArgumentList "-y"
        
        # Aguarda um pouco para a instalação terminar
        Start-Sleep -Seconds 5
        
        # Recarrega as variáveis de ambiente
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # Verifica se a instalação foi bem-sucedida
        try {
            $rustVersion = rustc --version 2>$null
            if ($rustVersion) {
                Write-Host "🎉 Rust instalado com sucesso!" -ForegroundColor Green
                Write-Host "📋 Versão: $rustVersion" -ForegroundColor Cyan
                
                # Verifica Cargo
                $cargoVersion = cargo --version 2>$null
                if ($cargoVersion) {
                    Write-Host "📦 Cargo: $cargoVersion" -ForegroundColor Cyan
                }
                
                Write-Host "✅ Instalação concluída! Agora você pode executar start_backend.bat" -ForegroundColor Green
            } else {
                Write-Host "❌ Falha na verificação do Rust" -ForegroundColor Red
                Write-Host "💡 Tente reiniciar o terminal e executar novamente" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Erro ao verificar instalação do Rust" -ForegroundColor Red
        }
        
    } else {
        Write-Host "❌ Falha no download do instalador" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erro durante a instalação: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Tente executar como administrador ou instalar manualmente" -ForegroundColor Yellow
}

# Limpa arquivos temporários
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}

Write-Host "`n🔄 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Reinicie o terminal/PowerShell" -ForegroundColor White
Write-Host "2. Execute: cd services\high_frequency" -ForegroundColor White
Write-Host "3. Execute: start_backend.bat" -ForegroundColor White

Write-Host "`nPressione qualquer tecla para continuar..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
