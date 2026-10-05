@echo off
setlocal

echo ============================================================
echo   IS Risk Analyzer - project launcher
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python not found in PATH.
    echo Install Python 3.10+ from https://www.python.org/downloads/
    echo Check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found in PATH.
    echo Install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] Checking backend environment...
if not exist "%~dp0backend\venv\Scripts\python.exe" (
    echo    Creating virtual environment...
    pushd "%~dp0backend"
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        popd
        pause
        exit /b 1
    )
    echo    Installing Python dependencies ^(3-5 min^)...
    call venv\Scripts\activate.bat
    python -m pip install --upgrade pip >nul
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies.
        popd
        pause
        exit /b 1
    )
    call venv\Scripts\deactivate.bat
    popd
    echo    Done.
) else (
    echo    Environment found.
)

echo.
echo [2/3] Checking frontend environment...
if not exist "%~dp0frontend\node_modules" (
    echo    Installing Node dependencies ^(2-4 min^)...
    pushd "%~dp0frontend"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies.
        popd
        pause
        exit /b 1
    )
    popd
    echo    Done.
) else (
    echo    Environment found.
)

echo.
echo [3/3] Starting services...

start "IS Risk Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

start "IS Risk Frontend" cmd /k "cd /d %~dp0frontend && npm start"

timeout /t 2 /nobreak >nul

echo.
echo ============================================================
echo   Done. Browser will open in 5-10 seconds.
echo   URL: http://localhost:3000
echo.
echo   You can close this window.
echo   To stop the project - close Backend and Frontend windows.
echo ============================================================
pause