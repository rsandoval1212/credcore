"""
FIX M2 / B1 / B2: Security headers middleware.
Agrega CSP, Permissions-Policy y otros headers de seguridad.
"""


class SecurityHeadersMiddleware:
    """Agrega headers de seguridad a todas las respuestas."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Content Security Policy — restrictivo pero funcional
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' ws: wss:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )

        # Permissions Policy — deshabilitar APIs innecesarias
        response['Permissions-Policy'] = (
            'camera=(), microphone=(), geolocation=(), payment=()'
        )

        # Referrer Policy
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        return response
