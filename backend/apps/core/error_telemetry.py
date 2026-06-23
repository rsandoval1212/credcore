"""
Telemetría de errores con Sentry opcional + log local siempre.

- Si SENTRY_DSN está en env vars, los errores van a Sentry.
- Siempre se loguean en %APPDATA%/CredCore/logs/errors.log con stacktrace.
- Endpoint POST /api/v1/system/telemetry/ permite que el frontend reporte errores.
"""
import os
import json
import logging
import traceback
from pathlib import Path
from datetime import datetime

logger = logging.getLogger('credcore.telemetry')


def _errors_log_path() -> Path:
    log_dir = os.environ.get('LOGS_DIR', '')
    if log_dir:
        return Path(log_dir) / 'errors.log'
    appdata = os.environ.get('APPDATA') or str(Path.home())
    p = Path(appdata) / 'CredCore' / 'logs'
    p.mkdir(parents=True, exist_ok=True)
    return p / 'errors.log'


def capture_exception(exc: BaseException, context: dict | None = None):
    """Registra una excepción a archivo local + Sentry si está configurado."""
    record = {
        'ts': datetime.now().isoformat(),
        'type': type(exc).__name__,
        'message': str(exc)[:500],
        'traceback': traceback.format_exc()[:3000],
        'context': context or {},
    }
    try:
        with open(_errors_log_path(), 'a', encoding='utf-8') as f:
            f.write(json.dumps(record, ensure_ascii=False, default=str) + '\n')
    except Exception:
        pass

    sentry_dsn = os.environ.get('SENTRY_DSN', '').strip()
    if sentry_dsn:
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except ImportError:
            pass
        except Exception:
            pass


def init_sentry_if_configured():
    """Inicializa Sentry SDK si SENTRY_DSN está en env. Llamar al startup de Django."""
    sentry_dsn = os.environ.get('SENTRY_DSN', '').strip()
    if not sentry_dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[DjangoIntegration()],
            traces_sample_rate=0.0,  # Sin tracing por defecto (gratis)
            send_default_pii=False,
            release=os.environ.get('APP_VERSION', 'dev'),
            environment='production' if not os.environ.get('DEBUG') == 'True' else 'development',
        )
    except ImportError:
        pass
    except Exception:
        pass


class ErrorTelemetryMiddleware:
    """Captura excepciones no manejadas y las envía a la telemetría."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        try:
            user_email = ''
            if hasattr(request, 'user') and request.user.is_authenticated:
                user_email = request.user.email
            capture_exception(exception, context={
                'path': request.path,
                'method': request.method,
                'user_email': user_email,
                'remote_addr': request.META.get('REMOTE_ADDR', ''),
            })
        except Exception:
            pass
        return None  # No interferir con el manejo normal
