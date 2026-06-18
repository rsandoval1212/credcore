from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Role, Permission, UserRole


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = '__all__'


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    roles = RoleSerializer(many=True, read_only=True)

    class Meta:
        model = User
        exclude = ['password', 'totp_secret']
        read_only_fields = ['date_joined', 'last_login', 'failed_login_attempts']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    role_ids = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)
    roles = RoleSerializer(many=True, read_only=True)
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'phone',
                  'branch', 'password', 'password_confirm', 'role_ids', 'roles',
                  'full_name', 'is_active', 'is_staff', 'is_superuser']
        read_only_fields = ['id', 'is_active']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Las contraseñas no coinciden.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        role_ids = validated_data.pop('role_ids', [])
        user = User.objects.create_user(password=password, **validated_data)
        # Assign roles via through model
        if role_ids:
            request = self.context.get('request')
            assigned_by = request.user if request else None
            for role_id in role_ids:
                try:
                    role = Role.objects.get(id=role_id, is_active=True)
                    UserRole.objects.get_or_create(
                        user=user, role=role,
                        defaults={'assigned_by': assigned_by}
                    )
                except Role.DoesNotExist:
                    pass
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    totp_code = serializers.CharField(required=False, max_length=6)

    def validate(self, data):
        import logging
        from django.conf import settings
        from django.utils import timezone as tz
        audit_logger = logging.getLogger('credcore.audit')

        from apps.users.models import User as UserModel
        try:
            target_user = UserModel.objects.get(email=data['email'])
        except UserModel.DoesNotExist:
            target_user = None

        if target_user and target_user.locked_until and target_user.locked_until > tz.now():
            mins = int((target_user.locked_until - tz.now()).total_seconds() // 60) + 1
            raise serializers.ValidationError(f'Cuenta bloqueada temporalmente. Intente en {mins} minutos.')

        user = authenticate(username=data['email'], password=data['password'])
        if not user:
            audit_logger.warning(f"[LOGIN_FAILED] email={data['email']} ip={self._get_ip()}")
            if target_user:
                target_user.failed_login_attempts += 1
                max_attempts = getattr(settings, 'MAX_LOGIN_ATTEMPTS', 5)
                lockout_mins = getattr(settings, 'LOCKOUT_DURATION_MINUTES', 30)
                if target_user.failed_login_attempts >= max_attempts:
                    target_user.locked_until = tz.now() + tz.timedelta(minutes=lockout_mins)
                    audit_logger.warning(f"[ACCOUNT_LOCKED] email={data['email']} ip={self._get_ip()}")
                target_user.save(update_fields=['failed_login_attempts', 'locked_until'])
            raise serializers.ValidationError('Credenciales incorrectas.')
        if not user.is_active:
            raise serializers.ValidationError('Cuenta inactiva.')
        if user.is_blocked:
            raise serializers.ValidationError(f'Cuenta bloqueada: {user.blocked_reason}')
        if user.two_factor_enabled:
            totp_code = data.get('totp_code')
            if not totp_code:
                raise serializers.ValidationError({'totp_code': 'Se requiere código 2FA.'})
            if not user.verify_totp(totp_code):
                raise serializers.ValidationError({'totp_code': 'Código 2FA inválido.'})
        data['user'] = user
        audit_logger.info(f"[LOGIN_OK] email={user.email} ip={self._get_ip()}")
        return data

    def _get_ip(self):
        """Obtiene IP del request context."""
        request = self.context.get('request')
        if request:
            xff = request.META.get('HTTP_X_FORWARDED_FOR')
            if xff:
                return xff.split(',')[0].strip()
            return request.META.get('REMOTE_ADDR', 'unknown')
        return 'unknown'
