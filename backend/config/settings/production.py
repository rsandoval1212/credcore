from .base import *
import sys

DEBUG = False
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# ── RIESGO 1: Bloquear SQLite en producción ─────────────────────────────────
_db_engine = DATABASES.get('default', {}).get('ENGINE', '')
if 'sqlite' in _db_engine:
    print('\n' + '=' * 70)
    print('  FATAL: SQLite NO es soportado en producción.')
    print('  Configure PostgreSQL con las variables:')
    print('    DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT')
    print('=' * 70 + '\n')
    sys.exit(1)

# ── RIESGO 3: Variables de entorno obligatorias en producción ────────────────
_required_env = {
    'SECRET_KEY': 'Clave secreta de Django',
    'DB_PASSWORD': 'Contraseña de la base de datos',
}
_missing = [k for k in _required_env if not os.environ.get(k)]
if _missing:
    print('\n' + '=' * 70)
    print('  FATAL: Variables de entorno obligatorias no configuradas:')
    for k in _missing:
        print(f'    - {k}: {_required_env[k]}')
    print('=' * 70 + '\n')
    sys.exit(1)

# Advertir si se usa contraseña admin por defecto
_admin_pw = os.environ.get('CREDCORE_ADMIN_PASSWORD', '')
if not _admin_pw or _admin_pw in ('Admin123!', 'AdminCredCore123!', 'admin123'):
    import warnings
    warnings.warn(
        '⚠️  CREDCORE_ADMIN_PASSWORD no configurada o usa valor por defecto. '
        'Configure una contraseña segura en producción.',
        stacklevel=1,
    )

# Security
ENFORCE_2FA = os.environ.get('ENFORCE_2FA', 'true').lower() == 'true'
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True
# FIX B1: Proxy SSL header
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# FIX B2: HttpOnly cookie explícito
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
# FIX M2: CSP header via middleware
MIDDLEWARE.append('apps.core.security_middleware.SecurityHeadersMiddleware')
# RIESGO 4: WAF middleware (antes de las vistas)
MIDDLEWARE.insert(0, 'apps.core.waf_middleware.WAFMiddleware')

# Static files with WhiteNoise
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/credcore/django.log',
            'maxBytes': 1024 * 1024 * 10,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['file'],
        'level': 'WARNING',
    },
}
