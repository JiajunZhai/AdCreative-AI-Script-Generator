@echo off
echo ===================================================
echo   Avocado SOP Engine - Full Offline Packager
echo ===================================================
echo.

set DIST_DIR=Avocado_Offline_Release
if exist %DIST_DIR% rmdir /s /q %DIST_DIR%
mkdir %DIST_DIR%
mkdir %DIST_DIR%\backend
mkdir %DIST_DIR%\@OUT

echo [1/5] Building Frontend Image (avocado-frontend:latest)...
docker build -t avocado-frontend:latest ./frontend
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b %errorlevel%
)

echo [2/5] Building Backend Image (avocado-backend:latest)...
docker build -t avocado-backend:latest ./backend
if %errorlevel% neq 0 (
    echo [ERROR] Backend build failed!
    pause
    exit /b %errorlevel%
)

echo [3/5] Exporting images to a single archive (avocado-offline-images.tar)...
docker save -o %DIST_DIR%\avocado-offline-images.tar avocado-frontend:latest avocado-backend:latest
if %errorlevel% neq 0 (
    echo [ERROR] Images export failed!
    pause
    exit /b %errorlevel%
)

echo [4/5] Copying architecture configurations and data states...
copy docker-compose.yml %DIST_DIR%\ >nul
if exist backend\.env (
    copy backend\.env %DIST_DIR%\backend\.env >nul
) else (
    copy backend\.env.example %DIST_DIR%\backend\.env >nul
)
if exist backend\data xcopy backend\data %DIST_DIR%\backend\data /E /I /H /Y >nul
if exist @OUT xcopy @OUT %DIST_DIR%\@OUT /E /I /H /Y >nul

echo [5/5] Generating ZIP archive...
if exist Avocado_Offline_Release.zip del Avocado_Offline_Release.zip
powershell Compress-Archive -Path %DIST_DIR%\* -DestinationPath Avocado_Offline_Release.zip

echo.
echo ===================================================
echo   SUCCESS! Avocado_Offline_Release.zip generated.
echo ===================================================
echo Please send Avocado_Offline_Release.zip to your LAN server.
echo On the server:
echo  1. Unzip the file
echo  2. Run: docker load -i avocado-offline-images.tar
echo  3. Run: docker-compose up -d
echo.
pause
