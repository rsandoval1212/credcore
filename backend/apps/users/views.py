from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from .models import User, Role
from .serializers import UserSerializer, UserCreateSerializer, LoginSerializer, RoleSerializer


class AuthViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        user.failed_login_attempts = 0
        user.save(update_fields=['failed_login_attempts'])
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):
        try:
            token = RefreshToken(request.data.get('refresh'))
            token.blacklist()
        except Exception:
            pass
        return Response({'detail': 'Sesión cerrada.'})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        if not user.check_password(old_password):
            return Response({'detail': 'Contraseña actual incorrecta.'}, status=400)
        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Contraseña actualizada.'})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
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

        try:
            admin = User.objects.get(email=admin_email, is_active=True)
        except User.DoesNotExist:
            return Response({'detail': 'Administrador no encontrado.'}, status=404)

        if not admin.is_superuser and not admin.is_staff:
            return Response({'detail': 'El usuario indicado no es administrador.'}, status=403)

        if not admin.check_password(admin_password):
            return Response({'detail': 'Contraseña de administrador incorrecta.'}, status=401)

        return Response({
            'verified': True,
            'admin_name': admin.get_full_name() or admin.email,
        })


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().select_related('branch').prefetch_related('roles')
    permission_classes = [IsAuthenticated]
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

    @action(detail=True, methods=['post'])
    def assign_roles(self, request, pk=None):
        """Asigna roles a un usuario. Payload: { role_ids: [1,2,3] }"""
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Sin permiso.'}, status=403)
        user = self.get_object()
        role_ids = request.data.get('role_ids', [])
        roles = Role.objects.filter(id__in=role_ids, is_active=True)
        user.roles.set(roles)
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
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Sin permiso.'}, status=403)
        user = self.get_object()
        new_password = request.data.get('new_password', '')
        if len(new_password) < 8:
            return Response({'detail': 'La contraseña debe tener al menos 8 caracteres.'}, status=400)
        user.set_password(new_password)
        user.save()
        return Response({'detail': f'Contraseña de {user.get_full_name() or user.email} actualizada.'})

    @action(detail=True, methods=['patch'])
    def update_profile(self, request, pk=None):
        """Actualiza datos básicos de un usuario."""
        if not request.user.is_superuser and not request.user.is_staff and request.user.pk != pk:
            return Response({'detail': 'Sin permiso.'}, status=403)
        user = self.get_object()
        allowed = ['first_name', 'last_name', 'phone', 'branch', 'is_staff', 'is_superuser']
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        return Response(UserSerializer(user).data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset           = Role.objects.all().order_by('name')
    serializer_class   = RoleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter]
    search_fields      = ['name', 'description']
