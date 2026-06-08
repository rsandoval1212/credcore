# Celery es opcional — solo se carga si el paquete está instalado
try:
    from .celery import app as celery_app
    __all__ = ('celery_app',)
except ImportError:
    pass
