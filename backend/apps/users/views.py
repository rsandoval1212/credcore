from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from .models import User, Role
from .serializers import UserSerializer, UserCreateSerializer, LoginSerializer, RoleSerializer
from apps.core.permissions import module_permissions


# FIX #3: Throttles específicos para endpoints sensibles
class LoginThrottle(ScopedRateThrottle):
    scope = 'login'

class VerifyAdminThrottle(ScopedRateThrottle):
    scope = 'verify_admin'


class AuthViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['post'], permission_classes=[AllowAny],
            throttle_classes=[LoginThrottle])
    def login(self, request):
        from apps.core.cookie_auth import set_auth_cookies
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        user.failed_login_attempts = 0
        user.save(update_fields=['failed_login_attempts'])
        refresh = RefreshToken.for_user(user)
        response = Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })
        # Establecer tokens en httpOnly cookies (más seguro que sessionStorage)
        set_auth_cookies(response, refresh.access_token, refresh)
        return response

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):
        from apps.core.cookie_auth import clear_auth_cookies, REFRESH_COOKIE
        try:
            # Intentar obtener refresh del body o de la cookie
            refresh_token = request.data.get('refresh') or request.COOKIES.get(REFRESH_COOKIE)
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass
        response = Response({'detail': 'Sesión cerrada.'})
        clear_auth_cookies(response)
        return response

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        if not user.check_password(old_password):
            return Response({'detail': 'Contraseña actual incorrecta.'}, status=400)
        # FIX A2: Validar fortaleza de nueva contraseña
        try:
            validate_password(new_password, user)
        except DjangoValidationError as e:
            return Response({'detail': list(e.messages)}, status=400)
        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Contraseña actualizada.'})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated],
            throttle_classes=[VerifyAdminThrottle])
    def verify_admin(self, request):
        """
        Verifica la contraseña de un administrador.
        Usado para autorizar operaciones sensibles por usuarios no-admin.
        Devuelve { verified: true } si la contraseña del admin es correcta.
        """
        admin_email    = request.data.get('admin_email', '').strip()
        admin_password = request.data.get('admin_password', '')

        if not admin_email or not admin_password:
            return Response({'detail': 'Email y contraseña del administrador son requeridos.'}, status=400)

        # FIX B4: Respuesta genérica para prevenir enumeración de usuarios
        _generic_error = 'Credenciales de administrador incorrectas.'
        try:
            admin = User.objects.get(email=admin_email, is_active=True)
        except User.DoesNotExist:
            return Response({'detail': _generic_error}, status=401)

        if not admin.is_superuser and not admin.is_staff:
            return Response({'detail': _generic_error}, status=401)

        if not admin.check_password(admin_password):
            return Response({'detail': _generic_error}, status=401)

        return Response({
            'verified': True,
            'admin_name': admin.get_full_name() or admin.email,
        })

    # ── RIESGO 2: 2FA (TOTP) endpoints ──────────────────────────────────────

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated],
            url_path='2fa/setup')
    def totp_setup(self, request):
        """Genera un secreto TOTP y retorna la URI para QR."""
        from apps.core.totp_middleware import generate_totp_secret, get_totp_uri
        user = request.user
        if user.two_factor_enabled:
            return Response({'detail': '2FA ya está habilitado.'}, status=400)
        secret = generate_totp_secret()
        user.totp_secret = secret
        user.save(update_fields=['totp_secret'])
        return Response({
            'secret': secret,
            'uri': get_totp_uri(secret, user.email),
            'message': 'Escanea el QR con Google Authenticator o similar, luego verifica con /2fa/verify/',
        })

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated],
            url_path='2fa/verify')
    def totp_verify(self, request):
        """Verifica un token TOTP y activa 2FA."""
        from apps.core.totp_middleware import verify_totp
        user = request.user
        token = request.data.get('token', '')
        if not user.totp_secret:
            return Response({'detail': 'Primero configura 2FA con /2fa/setup/'}, status=400)
        if verify_totp(user.totp_secret, token):
            user.two_factor_enabled = True
            user.save(update_fields=['two_factor_enabled'])
            # Generar nuevo token JWT con claim totp_verified
            refresh = RefreshToken.for_user(user)
            refresh['totp_verified'] = True
            return Response({
                'verified': True,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            })
        return Response({'detail': 'Código TOTP inválido.'}, status=400)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated],
            url_path='2fa/disable')
    def totp_disable(self, request):
        """Desactiva 2FA (requiere contraseña actual)."""
        user = request.user
        password = request.data.get('password', '')
        if not user.check_password(password):
            return Response({'detail': 'Contraseña incorrecta.'}, status=400)
        user.totp_secret = ''
        user.two_factor_enabled = False
        user.save(update_fields=['totp_secret', 'two_factor_enabled'])
        return Response({'detail': '2FA desactivado.'})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().select_related('branch').prefetch_related('roles')
    permission_classes = [IsAuthenticated, module_permissions('users')]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['is_active', 'is_staff', 'is_superuser', 'branch']
    search_fields      = ['first_name', 'last_name', 'email', 'username', 'phone']
    ordering_fields    = ['date_joined', 'first_name', 'last_name']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        # Solo superadmin ve todos; staff ve activos
        qs = super().get_queryset()
        if not self.request.user.is_superuser:
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        if not self.request.user.is_superuser and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo administradores pueden crear usuarios.')
        serializer.save()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=True, methods=['post'])
    def assign_roles(self, request, pk=None):
        """Asigna roles a un usuario. Payload: { role_ids: [1,2,3] }"""
        from .models import UserRole
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Sin permiso.'}, status=403)
        user = self.get_object()
        role_ids = request.data.get('role_ids', [])
        # Clear existing roles and assign new ones (through model requires manual management)
        UserRole.objects.filter(user=user).delete()
        roles = Role.objects.filter(id__in=role_ids, is_active=True)
        for role in roles:
            UserRole.objects.create(user=user, role=role, assigned_by=request.user)
        # Refresh user to include new roles
        user = User.objects.select_related('branch').prefetch_related('roles').get(pk=user.pk)
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Activa o desactiva un usuario."""
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Sin permiso.'}, status=403)
        user = self.get_object()
        if user == request.user:
            return Response({'detail': 'No puedes desactivarte a ti mismo.'}, status=400)
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return Response({'is_active': user.is_active, 'message': f'Usuario {"activado" if user.is_active else "desactivado"}.'})

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """Admin resetea la contraseña de otro usuario."""
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Sin permiso.'}, status=403)
        user = self.get_object()
        new_password = request.data.get('new_password', '')
        # FIX A3: Usar Django password validators completos
        try:
            validate_password(new_password, user)
        except DjangoValidationError as e:
            return Response({'detail': list(e.messages)}, status=400)
        user.set_password(new_password)
        user.save()
        return Response({'detail': f'Contraseña de {user.get_full_name() or user.email} actualizada.'})

    @action(detail=True, methods=['patch'])
    def update_profile(self, request, pk=None):
        """Actualiza datos básicos de un usuario."""
        # FIX A4: Comparar con str() para evitar IDOR por tipo UUID vs string
        if not request.user.is_superuser and not request.user.is_staff and str(request.user.pk) != str(pk):
            return Response({'detail': 'Sin permiso.'}, status=403)
        user = self.get_object()
        # FIX #4: Solo superadmin puede modificar is_staff/is_superuser (previene escalamiento)
        if request.user.is_superuser:
            allowed = ['first_name', 'last_name', 'phone', 'branch', 'is_staff', 'is_superuser']
        else:
            allowed = ['first_name', 'last_name', 'phone']
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        return Response(UserSerializer(user).data)


# FIX #12: Solo admin puede gestionar roles
class RoleViewSet(viewsets.ModelViewSet):
    queryset           = Role.objects.all().order_by('name')
    serializer_class   = RoleSerializer
    permission_classes = [IsAuthenticated, module_permissions('users')]
    filter_backends    = [filters.SearchFilter]
    search_fields      = ['name', 'description']

    def create(self, request, *args, **kwargs):
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Solo administradores pueden gestionar roles.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Solo administradores pueden gestionar roles.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            return Response({'detail': 'Solo superadmin puede eliminar roles.'}, status=403)
        return super().destroy(request, *args, **kwargs)
