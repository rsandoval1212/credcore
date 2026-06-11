"""
RIESGO 4: WAF-like middleware — detección de patrones sospechosos y bloqueo por IP.

Protege contra:
- SQL Injection patterns
- XSS patterns
- Path traversal
- IP-based rate limiting con bloqueo temporal
"""
import re
import time
import logging
import threading
from django.http import JsonResponse

logger = logging.getLogger('credcore.waf')

# ── Patrones sospechosos ─────────────────────────────────────────────────────
SQL_INJECTION_PATTERNS = [
    re.compile(r"(\b(union|select|insert|update|delete|drop|alter|exec|execute)\b.*\b(from|into|table|database)\b)", re.I),
    re.compile(r"(\bor\b\s+\d+\s*=\s*\d+)", re.I),
    re.compile(r"(--|;|/\*|\*/|xp_|sp_)", re.I),
    re.compile(r"(\b(waitfor|benchmark|sleep)\s*\()", re.I),
]

XSS_PATTERNS = [
    re.compile(r"<\s*script", re.I),
    re.compile(r"javascript\s*:", re.I),
    re.compile(r"on(error|load|click|mouseover|focus|blur)\s*=", re.I),
    re.compile(r"<\s*iframe", re.I),
    re.compile(r"<\s*object", re.I),
]

PATH_TRAVERSAL_PATTERNS = [
    re.compile(r"\.\./"),
    re.compile(r"\.\.\\"),
    re.compile(r"%2e%2e[/\\]", re.I),
    re.compile(r"etc/(passwd|shadow|hosts)", re.I),
]

# ── IP tracker thread-safe ───────────────────────────────────────────────────
_lock = threading.Lock()
_ip_violations: dict[str, list[float]] = {}
_ip_blocked: dict[str, float] = {}

VIOLATION_WINDOW = 300      # 5 minutos
VIOLATION_THRESHOLD = 10    # violaciones antes de bloqueo
BLOCK_DURATION = 900        # bloqueo 15 minutos

# Rutas exentas (admin, static, media)
EXEMPT_PATHS = ('/admin/', '/static/', '/media/', '/favicon.ico')


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


def _is_blocked(ip: str) -> bool:
    with _lock:
        blocked_until = _ip_blocked.get(ip)
        if blocked_until and time.time() < blocked_until:
            return True
        elif blocked_until:
            del _ip_blocked[ip]
    return False


def _record_violation(ip: str) -> bool:
    """Registra violación. Retorna True si el IP queda bloqueado."""
    now = time.time()
    with _lock:
        violations = _ip_violations.setdefault(ip, [])
        # Limpiar violaciones fuera de ventana
        violations[:] = [t for t in violations if now - t < VIOLATION_WINDOW]
        violations.append(now)
        if len(violations) >= VIOLATION_THRESHOLD:
            _ip_blocked[ip] = now + BLOCK_DURATION
            _ip_violations.pop(ip, None)
            logger.warning(f'[WAF] IP BLOQUEADA por {BLOCK_DURATION}s: {ip}')
            return True
    return False


def _scan_string(value: str) -> str | None:
    """Escanea un string buscando patrones maliciosos. Retorna el tipo detectado o None."""
    for pattern in SQL_INJECTION_PATTERNS:
        if pattern.search(value):
            return 'sql_injection'
    for pattern in XSS_PATTERNS:
        if pattern.search(value):
            return 'xss'
    for pattern in PATH_TRAVERSAL_PATTERNS:
        if pattern.search(value):
            return 'path_traversal'
    return None


class WAFMiddleware:
    """Web Application Firewall middleware."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        # No inspeccionar rutas exentas
        if any(path.startswith(p) for p in EXEMPT_PATHS):
            return self.get_response(request)

        ip = _get_client_ip(request)

        # ── IP bloqueada? ────────────────────────────────────────────────
        if _is_blocked(ip):
            return JsonResponse(
                {'detail': 'Acceso temporalmente bloqueado.'},
                status=403,
            )

        # ── Escanear URL + query string ──────────────────────────────────
        to_scan = [request.get_full_path()]

        # Escanear parámetros GET
        for val in request.GET.values():
            to_scan.append(val)

        # Escanear body (solo si es pequeño y content-type adecuado)
        ct = request.content_type or ''
        if request.method in ('POST', 'PUT', 'PATCH') and 'multipart' not in ct:
            try:
                body = request.body[:4096].decode('utf-8', errors='ignore')
                to_scan.append(body)
            except Exception:
                pass

        # ── Detectar amenazas ────────────────────────────────────────────
        for text in to_scan:
            threat = _scan_string(text)
            if threat:
                logger.warning(
                    f'[WAF] {threat} detectado | IP={ip} | '
                    f'path={path} | method={request.method}'
                )
                blocked = _record_violation(ip)
                return JsonResponse(
                    {'detail': 'Solicitud rechazada por política de seguridad.'},
                    status=403,
                )

        return self.get_response(request)
