@echo off
echo ================================================
echo   CredCore - Iniciando servidores de desarrollo
echo ================================================

echo Iniciando backend Django en http://localhost:8000
echo Iniciando frontend React en http://localhost:3000
echo.
echo Presiona Ctrl+C en cada ventana para detener.
echo.

:: Backend en nueva ventana
start "CredCore Backend" cmd /k "cd backend && set DJANGO_SETTINGS_MODULE=config.settings.development && set USE_SQLITE=True && set USE_REDIS=False && venv\Scripts\python manage.py runserver 0.0.0.0:8000"

:: Esperar 2 segundos
timeout /t 2 /nobreak >nul

:: Frontend en nueva ventana
start "CredCore Frontend" cmd /k "cd frontend && npm run dev"

echo Servidores iniciados en ventanas separadas.
echo.
echo   Backend API:  http://localhost:8000/api/v1/
echo   API Docs:     http://localhost:8000/api/v1/docs/
echo   Frontend:     http://localhost:3000
echo.
pause
