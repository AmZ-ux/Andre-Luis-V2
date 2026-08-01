@echo off
echo ====================================
echo  Transporte Andre Luis - Deploy Script
echo ====================================
echo.

REM Load environment
if not exist .env (
    echo [ERROR] .env file not found. Copy .env.example to .env first.
    exit /b 1
)

echo [1/4] Building Docker image...
docker build -t transporte-andre-luis:latest .
if %errorlevel% neq 0 (
    echo [ERROR] Docker build failed.
    exit /b 1
)

echo [2/4] Stopping old container...
docker-compose down 2>nul

echo [3/4] Starting new container...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start container.
    exit /b 1
)

echo [4/4] Checking health...
timeout /t 5 /nobreak >nul
docker ps --filter "name=transporte-andre-luis" --format "{{.Status}}"

echo.
echo Deploy concluido!
echo Acesse: http://localhost:%VITE_PORT% 2>&1
