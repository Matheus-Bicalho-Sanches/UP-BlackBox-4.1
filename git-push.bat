@echo off
echo Starting Git Push Process...
echo.

echo Checking Git status...
git status
echo.

echo Adding files to Git...
git add .
git status
echo.

echo Creating commit...
set /p commit_msg="Digite a mensagem do commit: "
git commit -m "%commit_msg%"
if errorlevel 1 (
    echo Error: Commit failed
    pause
    exit /b 1
)
echo.

echo Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo Error: Push failed. Please check your GitHub credentials.
    echo You might need to configure your GitHub credentials using:
    echo git config --global user.name "Your Name"
    echo git config --global user.email "your.email@example.com"
    pause
    exit /b 1
)

echo.
echo Process completed successfully!
echo.
echo Current status:
git status
echo.
pause 