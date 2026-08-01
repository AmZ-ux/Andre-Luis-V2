@echo off
echo ====================================
echo  Transporte Andre Luis - Build Script
echo ====================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js nao encontrado. Instale Node.js 22+.
    exit /b 1
)

REM Install dependencies
echo [1/4] Instalando dependencias...
call npm ci
if %errorlevel% neq 0 (
    echo [ERROR] Falha ao instalar dependencias.
    exit /b 1
)

REM Lint
echo [2/4] Verificando codigo...
call npm run lint
if %errorlevel% neq 0 (
    echo [WARN] Lint encontrou problemas.
)

REM Build
echo [3/4] Compilando...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Falha no build.
    exit /b 1
)

echo [4/4] Build concluido com sucesso!
echo.
echo Os arquivos estao em: dist/
echo.
echo Para testar localmente:
echo   npm run preview
echo.
echo Para construir imagem Docker:
echo   docker build -t transporte-andre-luis .
