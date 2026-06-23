@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM Build Script para CredCore Setup Profesional
REM Compila el instalador usando Inno Setup 6
REM ═══════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

echo.
echo ╔═══════════════════════════════════════════════════════════════════════════╗
echo ║                 COMPILAR INSTALADOR CredCore v1.0.0                       ║
echo ║                   Inno Setup 6 - Instalador Profesional                  ║
echo ╚═══════════════════════════════════════════════════════════════════════════╝
echo.

REM Verificar que ISCC existe (buscar en las rutas habituales de Inno Setup 6)
set ISCC="C:\Program Files (x86)\Inno Setup 6\iscc.exe"
if not exist %ISCC% set ISCC="C:\Program Files\Inno Setup 6\iscc.exe"
if not exist %ISCC% set ISCC="%LOCALAPPDATA%\Programs\Inno Setup 6\iscc.exe"

if not exist %ISCC% (
    echo ❌ ERROR: No se encontró Inno Setup en:
    echo    %ISCC%
    echo.
    echo Por favor:
    echo   1. Descarga Inno Setup 6 desde: https://jrsoftware.org/isinfo.php
    echo   2. Instálalo en la ruta por defecto
    echo.
    pause
    exit /b 1
)

echo ✓ Inno Setup detectado
echo.

REM Configurar directorios
set SCRIPT_DIR=%CD%
set INSTALLER_DIR=%SCRIPT_DIR%\installer
set OUTPUT_DIR=%SCRIPT_DIR%\installer-output

echo Preparando directorios...
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Compilar instalador profesional
echo.
echo 🔨 Compilando instalador profesional...
echo   Script: %INSTALLER_DIR%\credcore-setup-professional.iss
echo   Output: %OUTPUT_DIR%\

%ISCC% /O"%OUTPUT_DIR%" "%INSTALLER_DIR%\credcore-setup-professional.iss"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ COMPILACIÓN EXITOSA
    echo.
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo Instalador generado:
    echo   📦 %OUTPUT_DIR%\CredCore-v1.0.0-Setup.exe
    echo.
    echo Características:
    echo   ✓ Página de activación de licencia
    echo   ✓ Validación de clave durante instalación
    echo   ✓ Logo oficial de CredCore visible
    echo   ✓ Progreso visual detallado (0-100%%)
    echo   ✓ Notificación Windows al finalizar
    echo   ✓ Soporte para instalación sin conexión
    echo   ✓ Acceso directo en escritorio y menú Inicio
    echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    echo.
    echo Próximos pasos para comercializar:
    echo   1. Distribuir: CredCore-v1.0.0-Setup.exe
    echo   2. Generar licencias con: python license_generator.py
    echo   3. Suministrar clave de activación al cliente
    echo.
    pause
) else (
    echo.
    echo ❌ ERROR EN LA COMPILACIÓN
    echo   Código de error: %ERRORLEVEL%
    echo.
    pause
    exit /b 1
)

endlocal
