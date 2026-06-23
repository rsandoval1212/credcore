@echo off
echo ================================================================
echo   CredCore Desktop - Build Script
echo ================================================================
echo.

cd /d "%~dp0"

echo [1/3] Limpiando builds anteriores...
if exist dist\CredCore rmdir /s /q dist\CredCore
if exist build rmdir /s /q build

echo [2/3] Construyendo ejecutable con PyInstaller (CredCore.spec)...
REM Toda la configuracion (dependencias del backend, datos, icono) vive en
REM CredCore.spec — NO agregar flags aqui, editar el .spec.
C:\Python313\python.exe -m PyInstaller CredCore.spec --noconfirm --clean

if errorlevel 1 (
    echo.
    echo [ERROR] La construccion fallo!
    pause
    exit /b 1
)

echo [3/3] Verificando...
if exist "dist\CredCore\CredCore.exe" (
    echo.
    echo ================================================================
    echo   BUILD EXITOSO!
    echo   Ejecutable: dist\CredCore\CredCore.exe
    echo ================================================================
) else (
    echo [ERROR] No se encontro el ejecutable
)

pause
