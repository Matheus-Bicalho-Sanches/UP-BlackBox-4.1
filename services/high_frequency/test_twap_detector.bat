@echo off
echo ========================================
echo    TESTE DO DETECTOR TWAP
echo ========================================
echo.

cd /d "%~dp0"
cd ..

echo Executando teste do detector TWAP...
python services\high_frequency\test_twap_detector.py

echo.
echo Pressione qualquer tecla para sair...
pause >nul
