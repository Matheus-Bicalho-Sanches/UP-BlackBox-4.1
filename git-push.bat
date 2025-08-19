@echo off
echo Starting Git Push Process...
echo.

echo Ensuring correct Git author (local repo)...
for /f "delims=" %%e in ('git config --get user.email 2^>nul') do set current_email=%%e
if not defined current_email (
    echo No email configured. Setting to "matheussancheslondrina@gmail.com".
    git config user.email "matheussancheslondrina@gmail.com"
    git config user.name "Matheus Sanches"
) else (
    if /I not "%current_email%"=="matheussancheslondrina@gmail.com" (
        echo Current email is "%current_email%". Updating to "matheussancheslondrina@gmail.com".
        git config user.email "matheussancheslondrina@gmail.com"
        git config user.name "Matheus Sanches"
    ) else (
        echo Email already correct: %current_email%
    )
)
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