"""
Autenticación JWT via httpOnly cookies.

En vez de enviar tokens en el body del response (donde el frontend los guarda
en sessionStorage/localStorage — vulnerable a XSS), los tokens se almacenan
en cookies httpOnly que el navegador envía automáticamente.

El access token va en cookie 'access_token'.
El refresh token va en cookie 'refresh_token'.

El frontend NO necesita manejar tokens manualmente.
"""
import os
from datetime import timedelta
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from django.conf import settings


# Cookie names
ACCESS_COOKIE = 'credcore_access'
REFRESH_COOKIE = 'credcore_refresh'


def get_cookie_settings():
    """Retorna configuración de cookies según el entorno."""
    is_prod = not settings.DEBUG
    domain = os.environ.get('COOKIE_DOMAIN', None)  # e.g. '.credcore.com'
    return {
        'httponly': True,
        'secure': is_prod,              # Solo HTTPS en producción
        'samesite': 'Lax',             # Protección CSRF
        'domain': domain,
        'path': '/',
    }


def set_auth_cookies(response, access_token, refresh_token):
    """Establece las cookies de autenticación en el response."""
    cookie_settings = get_cookie_settings()

    # Access token: vida corta (15 min por defecto)
    access_lifetime = settings.SIMPLE_JWT.get(
        'ACCESS_TOKEN_LIFETIME', timedelta(minutes=15)
    )
    response.set_cookie(
        ACCESS_COOKIE,
        str(access_token),
        max_age=int(access_lifetime.total_seconds()),
        **cookie_settings,
    )

    # Refresh token: vida más larga (8 horas por defecto)
    refresh_lifetime = settings.SIMPLE_JWT.get(
        'REFRESH_TOKEN_LIFETIME', timedelta(hours=8)
    )
    response.set_cookie(
        REFRESH_COOKIE,
        str(refresh_token),
        max_age=int(refresh_lifetime.total_seconds()),
        **cookie_settings,
    )

    return response


def clear_auth_cookies(response):
    """Elimina las cookies de autenticación."""
    cookie_settings = get_cookie_settings()
    for cookie_name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(
            cookie_name,
            path=cookie_settings['path'],
            domain=cookie_settings.get('domain'),
            samesite=cookie_settings['samesite'],
        )
    return response


class CookieJWTAuthentication(JWTAuthentication):
    """
    Autenticación que busca el JWT primero en la cookie httpOnly,
    y si no está ahí, en el header Authorization (backward compatible).
    """

    def authenticate(self, request):
        # 1) Intentar desde cookie httpOnly
        raw_token = request.COOKIES.get(ACCESS_COOKIE)
        if raw_token:
            try:
                validated = self.get_validated_token(raw_token)
                return self.get_user(validated), validated
            except InvalidToken:
                pass  # Cookie expirada, intentar header

        # 2) Fallback: header Authorization (compatibilidad con API clients, mobile, etc.)
        return super().authenticate(request)
