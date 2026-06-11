"""
Base settings for CredCore - Sistema de Gestión de Créditos
"""
import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# FIX #5: SECRET_KEY segura — DEBE configurarse en producción via variable de entorno
_default_key = 'django-insecure-change-this-in-production'
SECRET_KEY = os.environ.get('SECRET_KEY', _default_key)
if SECRET_KEY == _default_key and not os.environ.get('DJANGO_SETTINGS_MODULE', '').endswith('development'):
    import warnings
    warnings.warn('⚠️  SECRET_KEY no configurada. Configura la variable de entorno SECRET_KEY en producción.', stacklevel=1)

DEBUG = False

ALLOWED_HOSTS = []

# ─── Applications ─────────────────────────────────────────────────────────────
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    # 'channels',  # Comentado temporalmente
    # 'celery',  # Comentado temporalmente
    # 'django_celery_beat',  # Comentado temporalmente
    # 'django_celery_results',  # Comentado temporalmente
    # 'storages',  # Comentado temporalmente
    # 'auditlog',  # Comentado temporalmente
    'drf_spectacular',
]

LOCAL_APPS = [
    'apps.core',
    'apps.users',
    'apps.branches',
    'apps.customers',
    'apps.loan_products',
    'apps.loan_applications',
    'apps.loans',
    'apps.payments',
    'apps.cash',
    'apps.guarantees',
    'apps.collections',
    'apps.accounting',
    'apps.currency_exchange',
    # 'apps.audit',  # Comentado temporalmente
    # 'apps.risk',  # Comentado temporalmente
    # 'apps.notifications',  # Comentado temporalmente
    # 'apps.contracts',  # Comentado temporalmente
    # 'apps.documents',  # Comentado temporalmente
    # 'apps.commissions',  # Comentado temporalmente
    # 'apps.legal',  # Comentado temporalmente
    # 'apps.backups',  # Comentado temporalmente
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ─── Middleware ───────────────────────────────────────────────────────────────
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.core.audit_middleware.AuditLogMiddleware',  # FIX #8: Audit log
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'credcore_db'),
        'USER': os.environ.get('DB_USER', 'credcore_user'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'credcore_password'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'CONN_MAX_AGE': 60,
        'OPTIONS': {
            'connect_timeout': 10,
        },
    }
}

# ─── Auth ─────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'users.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── Internationalization ─────────────────────────────────────────────────────
LANGUAGE_CODE = 'es'
TIME_ZONE = os.environ.get('TIME_ZONE', 'America/Santo_Domingo')
USE_I18N = True
USE_TZ = True

# ─── Static & Media ───────────────────────────────────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# FIX A1: Limitar tamaño de uploads para prevenir DoS
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024      # 25 MB max request body
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024       # 10 MB antes de escribir a disco
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000                  # Prevenir ataques por campos excesivos

# ─── REST Framework ───────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.core.cookie_auth.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'apps.core.exceptions.custom_exception_handler',

    # FIX #3: Rate limiting para prevenir fuerza bruta
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',       # Login, registro (no autenticados)
        'user': '120/minute',      # Usuarios autenticados
        'login': '5/minute',       # Intentos de login
        'verify_admin': '5/minute', # Verificación de admin
    },
}

# ─── JWT ─────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    # FIX A6: Lifetimes cortos para app financiera
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=8),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ─── CORS ─────────────────────────────────────────────────────────────────────
_default_cors = 'http://localhost:3000,http://127.0.0.1:3000'
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CORS_ALLOWED_ORIGINS', _default_cors).split(',')
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
# FIX C5: Headers CORS restringidos (no wildcard)
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# ─── Redis & Celery ───────────────────────────────────────────────────────────
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'django-cache'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# ─── Channels ─────────────────────────────────────────────────────────────────
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [REDIS_URL]},
    },
}

# ─── Cache ────────────────────────────────────────────────────────────────────
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# ─── Email ────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'CredCore <noreply@credcore.com>')

# ─── WhatsApp (Meta Business API) ────────────────────────────────────────────
WHATSAPP_ACCESS_TOKEN = os.environ.get('WHATSAPP_ACCESS_TOKEN', '')
WHATSAPP_PHONE_NUMBER_ID = os.environ.get('WHATSAPP_PHONE_NUMBER_ID', '')
WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'

# ─── Company Settings (defaults, overridden per-company) ──────────────────────
COMPANY_NAME = os.environ.get('COMPANY_NAME', 'CredCore Financiera')
COMPANY_CURRENCY = os.environ.get('COMPANY_CURRENCY', 'DOP')
COMPANY_CURRENCY_SYMBOL = os.environ.get('COMPANY_CURRENCY_SYMBOL', 'RD$')

# ─── API Docs ─────────────────────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE': 'CredCore API',
    'DESCRIPTION': 'Sistema Profesional de Gestión de Créditos',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# ─── Security ─────────────────────────────────────────────────────────────────
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30
SESSION_COOKIE_AGE = 28800  # 8 hours
AUTO_LOGOUT_MINUTES = 30
