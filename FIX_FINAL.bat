@echo off
title CredCore - Instalacion y arranque completo
color 0A
cd /d C:\Users\sando\Desktop\SpCrediTs\credcore\backend

echo.
echo  =============================================
echo    CredCore - Instalacion y arranque
echo  =============================================
echo.

echo  [1/6] Recreando entorno virtual con Python 3.13...
if exist venv rd /s /q venv
py -3.13 -m venv venv
echo  OK
echo.

echo  [2/6] Actualizando pip...
.\venv\Scripts\python -m pip install --upgrade pip --quiet
echo  OK
echo.

echo  [3/6] Instalando Django y API...
.\venv\Scripts\python -m pip install Django==5.0.6 djangorestframework==3.15.2 djangorestframework-simplejwt==5.3.1 django-cors-headers==4.3.1 django-filter==24.2 drf-spectacular==0.27.2 --quiet
echo  OK
echo.

echo  [4/6] Instalando paquetes de soporte...
.\venv\Scripts\python -m pip install channels==4.1.0 celery==5.4.0 django-celery-beat==2.6.0 django-celery-results==2.5.1 redis==5.0.7 django-redis==5.4.0 --quiet
.\venv\Scripts\python -m pip install pyotp==2.9.0 django-auditlog==3.0.0 Pillow==10.3.0 Jinja2==3.1.4 openpyxl==3.1.4 whitenoise==6.7.0 --quiet
.\venv\Scripts\python -m pip install boto3==1.34.131 django-storages==1.14.3 httpx==0.27.0 requests==2.32.3 psycopg2-binary==2.9.9 --quiet
echo  OK
echo.

echo  [5/6] Creando base de datos y usuario admin...
set DJANGO_SETTINGS_MODULE=config.settings.development
set USE_SQLITE=True
set USE_REDIS=False
.\venv\Scripts\python manage.py migrate --run-syncdb
.\venv\Scripts\python manage.py crear_admin
echo.

echo  [6/6] Abriendo navegador...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3001"
start "" "http://localhost:3000"
echo.

echo  =============================================
echo    Arrancando servidor en puerto 8000...
echo    Email:      admin@credcore.com
echo    Contrasena: Admin123!
echo  =============================================
echo.
.\venv\Scripts\python manage.py runserver 0.0.0.0:8000
pause
