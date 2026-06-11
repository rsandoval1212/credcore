"""
FIX #8: Audit logging — registra todas las operaciones de escritura.
Guarda: usuario, acción, endpoint, IP, timestamp, datos enviados.
"""
import json
import logging
from django.utils import timezone

logger = logging.getLogger('credcore.audit')


class AuditLogMiddleware:
    """Middleware que registra operaciones de escritura (POST/PUT/PATCH/DELETE)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Solo auditar escrituras en la API
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE') and request.path.startswith('/api/'):
            try:
                user = request.user if hasattr(request, 'user') and request.user.is_authenticated else None
                user_str = f"{user.email} (id={user.pk})" if user else 'anonymous'
                ip = self._get_client_ip(request)

                # FIX M5: Limitar body a 10KB antes de parsear (previene DoS por payload gigante)
                body = ''
                MAX_AUDIT_BODY = 10 * 1024  # 10 KB
                try:
                    if request.content_type and 'json' in request.content_type:
                        raw = request.body[:MAX_AUDIT_BODY]
                        data = json.loads(raw.decode('utf-8', errors='replace'))
                        # Censurar campos sensibles
                        for key in list(data.keys()):
                            if any(s in key.lower() for s in ['password', 'secret', 'token', 'key']):
                                data[key] = '***'
                        body = json.dumps(data, ensure_ascii=False)[:500]
                except Exception:
                    body = '<no-json>'

                log_entry = (
                    f"[AUDIT] {request.method} {request.path} | "
                    f"user={user_str} | ip={ip} | "
                    f"status={response.status_code} | body={body}"
                )
                logger.info(log_entry)

            except Exception:
                pass  # Nunca bloquear el request por un error de audit

        return response

    def _get_client_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')
