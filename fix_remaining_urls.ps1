# Script para corrigir todas as ocorrências restantes de variáveis de ambiente incorretas
Write-Host "🔧 Corrigindo variáveis de ambiente restantes..." -ForegroundColor Cyan

# Lista de arquivos que precisam ser corrigidos
$files = @(
    "src\app\dashboard\up-blackbox4\sync\page.tsx",
    "src\app\dashboard\up-blackbox4\ordens\page.tsx",
    "src\app\dashboard\up-blackbox4\boletas\page.tsx"
)

$totalFixed = 0

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "📝 Processando: $file" -ForegroundColor Yellow
        
        $content = Get-Content $file -Raw
        $originalContent = $content
        
        # Corrigir aspas duplas
        $content = $content -replace '"`\$\{process\.env\.NEXT_PUBLIC_BACKEND_URL\}', '`${process.env.NEXT_PUBLIC_BACKEND_URL}'
        $content = $content -replace '\$\{process\.env\.NEXT_PUBLIC_BACKEND_URL\}"', '${process.env.NEXT_PUBLIC_BACKEND_URL}`'
        
        # Corrigir aspas simples
        $content = $content -replace "'`\$\{process\.env\.NEXT_PUBLIC_BACKEND_URL\}", '`${process.env.NEXT_PUBLIC_BACKEND_URL}'
        $content = $content -replace "\$\{process\.env\.NEXT_PUBLIC_BACKEND_URL\}'", '${process.env.NEXT_PUBLIC_BACKEND_URL}`'
        
        # Contar mudanças
        $changes = ($originalContent.Length - $content.Length) / 2
        if ($content -ne $originalContent) {
            Set-Content $file -Value $content -NoNewline
            Write-Host "   ✅ $changes correção(ões) aplicada(s)" -ForegroundColor Green
            $totalFixed += $changes
        } else {
            Write-Host "   ⚪ Nenhuma correção necessária" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Arquivo não encontrado: $file" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Correção concluída!" -ForegroundColor Green
Write-Host "📊 Total de correções: $totalFixed" -ForegroundColor Cyan

if ($totalFixed -gt 0) {
    Write-Host "`n🚀 Próximos passos:" -ForegroundColor Yellow
    Write-Host "   1. Faça commit: git add . && git commit -m 'Fix remaining backend URL variables'" -ForegroundColor White
    Write-Host "   2. Faça push: git push" -ForegroundColor White
    Write-Host "   3. Aguarde o deploy automático na Vercel" -ForegroundColor White
}
