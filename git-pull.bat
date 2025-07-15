@echo off
echo ===============================================
echo       ATUALIZANDO REPOSITORIO LOCAL
echo ===============================================
echo.

echo [1/3] Verificando status do repositorio...
git status --porcelain

echo.
echo [2/3] Fazendo backup das alteracoes locais...
git stash push -m "Backup automatico antes do pull - %date% %time%"

echo.
echo [3/3] Puxando mudancas do repositorio remoto...
git pull origin main

echo.
echo ===============================================
echo       ATUALIZACAO CONCLUIDA!
echo ===============================================
echo.
echo Pressione qualquer tecla para continuar...
pause > nul 