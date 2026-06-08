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

    class Meta:
        model = User
        fields = ['email', 'username', 'first_name', 'last_name', 'phone',
                  'branch', 'password', 'password_confirm']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Las contraseñas no coinciden.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    totp_code = serializers.CharField(required=False, max_length=6)

    def validate(self, data):
        user = authenticate(username=data['email'], password=data['password'])
        if not user:
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
        return data
