# -*- mode: python ; coding: utf-8 -*-
"""
CredCore Desktop — Especificación de PyInstaller.

IMPORTANTE: construir SIEMPRE con este archivo (vía build.bat):

    python -m PyInstaller CredCore.spec --noconfirm

El backend Django viaja como datos (carpeta 'backend'), por lo que PyInstaller
NO puede descubrir sus dependencias analizando imports. Todo paquete que el
backend importe (a nivel de módulo o dentro de funciones) debe declararse aquí
en BACKEND_PACKAGES, o el .exe fallará en tiempo de ejecución con
ModuleNotFoundError.
"""
from PyInstaller.utils.hooks import collect_all

# Paquetes usados por el backend Django en tiempo de ejecución.
BACKEND_PACKAGES = [
    'django',
    'rest_framework',             # Django REST Framework (INSTALLED_APPS + vistas)
    'rest_framework_simplejwt',   # autenticación JWT (incluye token_blacklist)
    'corsheaders',                # middleware CORS
    'django_filters',             # filtros DRF
    'drf_spectacular',            # esquema OpenAPI
    'dateutil',                   # apps.core.utils — se importa al cargar las URLs
    'reportlab',                  # generación de PDFs (contratos, recibos, reportes)
    'openpyxl',                   # exportación/importación Excel
    'cryptography',               # cifrado de backups + verificación de licencia
    'tzdata',                     # zonas horarias (zoneinfo en Windows)
    'pyotp',                      # 2FA — apps.users.models lo importa al cargar
    'whitenoise',                 # defensivo: producción lo usa, evita crash si se mezcla settings
    # Usadas por el backend del repo principal (PDFs con QR, montos en letras,
    # SVG y HTML→PDF). Se incluyen para que sincronizar la copia del backend
    # desde el repo no rompa el build del escritorio.
    'qrcode',
    'num2words',
    'svglib',
    'xhtml2pdf',
    # Subida automática de respaldos a Google Drive (cuenta de servicio del dueño).
    # Si el cliente no configura service_account.json + drive_folder_id.txt,
    # drive_uploader.py simplemente no envía nada (no falla).
    'google.oauth2',
    'googleapiclient',
    'httplib2',
]
# NO incluir: celery/channels (solo se usan con broker/ASGI y están protegidos
# con try/except), debug_toolbar (opcional, try/except), pandas (no se usa).

datas = [
    ('backend', 'backend'),
    ('electron\\frontend-dist', 'electron\\frontend-dist'),
    ('credi.png', '.'),      # logo mostrado en splash y pantalla de activación
    ('credcore.ico', '.'),   # ícono de ventana (barra de título / barra de tareas)
    ('updater.py', '.'),     # módulo de auto-actualización (opcional, consultado por backend)
    ('drive_uploader.py', '.'),  # uploader opcional a Google Drive
]
binaries = []
hiddenimports = ['webview']

for _pkg in BACKEND_PACKAGES:
    _d, _b, _h = collect_all(_pkg)
    datas += _d
    binaries += _b
    hiddenimports += _h

a = Analysis(
    ['credcore_app.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Pesados y no usados por la app de escritorio
        'pandas', 'numpy', 'matplotlib', 'scipy',
        'tkinter', 'debug_toolbar', 'pytest',
        # pydantic: no lo usa el backend y su instalación en el Python de
        # build tiene metadata rota que hace fallar el hook de PyInstaller
        'pydantic', 'pydantic_core',
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='CredCore',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['electron\\resources\\icons\\icon.ico'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='CredCore',
)
