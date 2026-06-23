import os
from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*']

# SQLite por defecto (desktop). PostgreSQL cuando cliente crezca a multi-usuario:
#   DB_ENGINE=postgresql + DB_HOST + DB_NAME + DB_USER + DB_PASSWORD
_db_engine = os.environ.get('DB_ENGINE', '').lower()

if _db_engine == 'postgresql' or os.environ.get('USE_SQLITE', 'True') == 'False':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME':     os.environ.get('DB_NAME', 'credcore'),
            'USER':     os.environ.get('DB_USER', 'credcore'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST':     os.environ.get('DB_HOST', 'localhost'),
            'PORT':     os.environ.get('DB_PORT', '5432'),
            'CONN_MAX_AGE': 60,
            'OPTIONS': {'connect_timeout': 10},
        }
    }
else:
    _db_path = os.environ.get('DB_PATH', str(BASE_DIR / 'db.sqlite3'))
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': _db_path,
            'OPTIONS': {
                'timeout': 20,
            },
        }
    }

# Cache en memoria cuando no hay Redis
if os.environ.get('USE_REDIS', 'False') == 'False':
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }

# debug_toolbar es opcional
try:
    import debug_toolbar  # noqa
    INSTALLED_APPS += ['debug_toolbar']
    MIDDLEWARE += ['debug_toolbar.middleware.DebugToolbarMiddleware']
except ImportError:
    pass

INTERNAL_IPS = ['127.0.0.1']
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

_AUDIT_LOG_PATH = os.environ.get('AUDIT_LOG_PATH', str(BASE_DIR / 'audit.log'))
try:
    os.makedirs(os.path.dirname(_AUDIT_LOG_PATH) or '.', exist_ok=True)
    _audit_handler = {
        'class': 'logging.handlers.RotatingFileHandler',
        'filename': _AUDIT_LOG_PATH,
        'maxBytes': 10 * 1024 * 1024,
        'backupCount': 5,
        'formatter': 'audit',
    }
    _audit_handlers = ['audit_file', 'console']
except (OSError, PermissionError):
    _audit_handler = {'class': 'logging.NullHandler'}
    _audit_handlers = ['console']

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'audit': {'format': '%(asctime)s %(message)s', 'datefmt': '%Y-%m-%d %H:%M:%S'},
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
        'audit_file': _audit_handler,
    },
    'loggers': {
        'credcore.audit': {'handlers': _audit_handlers, 'level': 'INFO'},
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
}
