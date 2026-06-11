"""
Token refresh que soporta httpOnly cookies.
Lee el refresh token de la cookie si no viene en el body.
Establece nuevas cookies con los tokens actualizados.
"""
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.response import Response
from rest_framework import status
from apps.core.cookie_auth import set_auth_cookies, REFRESH_COOKIE


class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        # Si no viene refresh en el body, intentar desde la cookie
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if not data.get('refresh'):
            cookie_refresh = request.COOKIES.get(REFRESH_COOKIE)
            if cookie_refresh:
                data['refresh'] = cookie_refresh

        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        response = Response(serializer.validated_data, status=status.HTTP_200_OK)

        # Actualizar cookies con nuevos tokens
        access = serializer.validated_data.get('access')
        refresh = serializer.validated_data.get('refresh', data.get('refresh'))
        if access:
            set_auth_cookies(response, access, refresh)

        return response
