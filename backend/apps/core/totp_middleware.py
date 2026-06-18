"""
RIESGO 2: Enforcement de 2FA (TOTP) para usuarios staff/superuser.

Middleware que verifica si los usuarios admin tienen 2FA configurado.
Si no lo tienen, redirige a la configuración de 2FA.

Funcionalidad:
- Genera secretos TOTP por usuario (campo totp_secret en User)
- Verifica tokens TOTP de 6 dígitos
- Bloquea acceso a rutas protegidas si 2FA no está verificado en la sesión
"""
import time
import hmac
import hashlib
import struct
import base64
import os
import logging
from django.http import JsonResponse

logger = logging.getLogger('credcore.2fa')

# Rutas que NO requieren 2FA (login, health, etc.)
EXEMPT_PATHS = (
    '/api/v1/users/login/',
    '/api/v1/users/token/refresh/',
    '/api/v1/health/',
    '/api/v1/users/2fa/',
    '/admin/',
    '/static/',
    '/media/',
)


def generate_totp_secret() -> str:
    """Genera un secreto TOTP base32 de 32 caracteres."""
    return base64.b32encode(os.urandom(20)).decode('utf-8')


def _hotp(secret_b32: str, counter: int) -> str:
    """Genera un código HOTP de 6 dígitos."""
    key = base64.b32decode(secret_b32, casefold=True)
    msg = struct.pack('>Q', counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = struct.unpack('>I', h[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % 10**6).zfill(6)


def verify_totp(secret_b32: str, token: str, window: int = 1) -> bool:
    """Verifica un token TOTP con ventana de tolerancia."""
    if not secret_b32 or not token or len(token) != 6:
        return False
    counter = int(time.time()) // 30
    for offset in range(-window, window + 1):
        if hmac.compare_digest(_hotp(secret_b32, counter + offset), token):
            return True
    return False


def get_totp_uri(secret: str, email: str) -> str:
    """Genera la URI para QR code de Google Authenticator."""
    from urllib.parse import quote
    return f'otpauth://totp/CredCore:{quote(email)}?secret={secret}&issuer=CredCore&digits=6&period=30'


class TwoFactorEnforcementMiddleware:
    """
    Middleware que requiere 2FA para usuarios staff/superuser.

    Para APIs con JWT: el token debe incluir claim 'totp_verified': True.
    Si el usuario es staff y no tiene totp_verified, retorna 403.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Solo aplicar a rutas API no exentas
        if any(request.path.startswith(p) for p in EXEMPT_PATHS):
            return self.get_response(request)

        # Solo aplicar si el usuario está autenticado y es staff
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return self.get_response(request)

        if not (user.is_staff or user.is_superuser):
            return self.get_response(request)

        totp_secret = getattr(user, 'totp_secret', None)
        if not totp_secret:
            return JsonResponse({
                'detail': 'Debe configurar la autenticación de dos factores (2FA).',
                'setup_url': '/api/v1/users/2fa/setup/',
                'code': '2fa_setup_required',
            }, status=403)

        totp_verified = False
        if hasattr(request, 'auth') and request.auth:
            totp_verified = request.auth.get('totp_verified', False)

        if not totp_verified:
            return JsonResponse({
                'detail': 'Debe verificar su código 2FA antes de continuar.',
                'code': '2fa_verify_required',
            }, status=403)

        return self.get_response(request)
