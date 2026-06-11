import os
from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*']

# SQLite para desarrollo local - cambia USE_SQLITE=False cuando tengas PostgreSQL
if os.environ.get('USE_SQLITE', 'True') == 'True':
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

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'audit': {'format': '%(asctime)s %(message)s', 'datefmt': '%Y-%m-%d %H:%M:%S'},
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
        'audit_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(BASE_DIR / 'audit.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'audit',
        },
    },
    'loggers': {
        'credcore.audit': {'handlers': ['audit_file', 'console'], 'level': 'INFO'},
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
}
