@echo off
echo ================================================
echo   CredCore - Configuracion Inicial (Windows)
echo ================================================

:: Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no encontrado. Instala Python 3.10+ desde python.org
    pause
    exit /b 1
)

:: Verificar Node
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no encontrado. Instala Node 18+ desde nodejs.org
    pause
    exit /b 1
)

echo [1/5] Copiando archivo de configuracion...
if not exist .env (
    copy .env.example .env
    echo     .env creado. Edita las variables antes de continuar en produccion.
) else (
    echo     .env ya existe, omitiendo.
)

echo [2/5] Creando entorno virtual Python...
cd backend
if not exist venv (
    python -m venv venv
)

echo [3/5] Instalando dependencias Python...
call venv\Scripts\pip install -r requirements\development.txt --quiet

echo [4/5] Creando base de datos (migraciones Django)...
set DJANGO_SETTINGS_MODULE=config.settings.development
set USE_SQLITE=True
set USE_REDIS=False
call venv\Scripts\python manage.py makemigrations
call venv\Scripts\python manage.py migrate

echo [5/5] Instalando dependencias frontend...
cd ..\frontend
call npm install

echo.
echo ================================================
echo   Configuracion completada exitosamente!
echo   Ejecuta: dev.bat  para iniciar el proyecto
echo ================================================
pause

echo.
set /p CREATE_SUPER="Crear superusuario administrador? (s/n): "
if /i "%CREATE_SUPER%"=="s" (
    cd backend
    call venv\Scripts\python manage.py createsuperuser
    cd ..
)
