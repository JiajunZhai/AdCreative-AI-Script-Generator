@echo off
setlocal
title Avocado Workspace Matrix Server
color 0B

echo ========================================================
echo               AVOCADO WORKSPACE HUB
echo ========================================================
echo.

:: Check for Backend Virtual Environment (.venv or venv)
set "PYTHON_EXEC=python"
set "UVICORN_EXEC=uvicorn"
if exist "backend\.venv\Scripts\python.exe" (
    echo [INFO] Detected .venv virtual environment.
    set "PYTHON_EXEC=backend\.venv\Scripts\python.exe"
    set "UVICORN_EXEC=backend\.venv\Scripts\uvicorn.exe"
) else if exist "backend\venv\Scripts\python.exe" (
    echo [INFO] Detected venv virtual environment.
    set "PYTHON_EXEC=backend\venv\Scripts\python.exe"
    set "UVICORN_EXEC=backend\venv\Scripts\uvicorn.exe"
)

:: Start Backend
echo [1/3] Initiating Avocado Backend Engine (Uvicorn - Port 8000)...
:: Using cmd /k to keep window open if it crashes, making debugging easier.
start "Avocado Backend" cmd /k "cd backend && title Avocado Backend && %PYTHON_EXEC% -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Give backend a slight head start
timeout /t 2 /nobreak > NUL

:: Start Frontend
echo [2/3] Initiating Avocado Frontend Matrix (Vite - Port 5173)...
:: Using strictPort ensures Vite doesn't quietly jump to 5174/5175 if 5173 is hanging, which breaks the hardcoded browser URL.
start "Avocado Frontend" cmd /k "cd frontend && title Avocado Frontend && npm run dev -- --port 5173 --strictPort"

:: Wait for services to mount
echo [3/3] Waiting for matrix to mount...
timeout /t 4 /nobreak > NUL

:: Launch Browser
echo Launching Avocado Workspace Hub...
start http://localhost:5173

echo.
echo ========================================================
echo Avocado Matrix is now online.
echo Backend running on :8000
echo Frontend running on:5173
echo.
echo Launching complete. This window will now self-close.
echo ========================================================
timeout /t 2 /nobreak > NUL
exit
