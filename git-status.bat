@echo off
echo ===============================================
echo       STATUS DO REPOSITORIO GIT
echo ===============================================
echo.

echo [INFO] Repositorio remoto conectado:
git remote -v
echo.

echo [INFO] Branch atual:
git branch --show-current
echo.

echo [INFO] Status das mudancas:
git status

echo.
echo [INFO] Ultimos 5 commits:
git log --oneline -5

echo.
echo ===============================================
echo       VERIFICACAO CONCLUIDA!
echo ===============================================
echo.
echo Pressione qualquer tecla para continuar...
pause > nul 