@echo off
title CredCore - Iniciando sistema...
color 0A
echo.
echo  ============================================
echo    CredCore - Iniciando sistema completo
echo  ============================================
echo.
cd /d "%~dp0backend"
set DJANGO_SETTINGS_MODULE=config.settings.development
set USE_SQLITE=True
set USE_REDIS=False

echo  [1/4] Ejecutando migraciones...
.\venv\Scripts\python manage.py migrate --run-syncdb 2>&1
echo.

echo  [2/4] Creando administrador...
.\venv\Scripts\python manage.py crear_admin 2>&1
echo.

echo  [3/4] Arrancando servidor Django en puerto 8000...
start "CredCore Backend" /min cmd /c "cd /d "%~dp0backend" && set DJANGO_SETTINGS_MODULE=config.settings.development && set USE_SQLITE=True && set USE_REDIS=False && .\venv\Scripts\python manage.py runserver 0.0.0.0:8000"

echo  Esperando que el servidor arranque...
timeout /t 5 /nobreak >nul

echo  [4/4] Abriendo el sistema en el navegador...
start "" "http://localhost:3002"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo  ============================================
echo    Sistema iniciado!
echo    URL:        http://localhost:3000 o :3002
echo    Email:      admin@credcore.com
echo    Contrasena: Admin123!
echo  ============================================
echo.
pause
