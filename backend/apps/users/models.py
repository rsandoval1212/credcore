"""
Modelos de usuarios, roles y permisos de CredCore.
"""
import pyotp
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from apps.users.managers import UserManager


class Role(models.Model):
    """Rol del sistema (Administrador, Gerente, Oficial de Crédito, Cajero, etc.)."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Rol'
        verbose_name_plural = 'Roles'

    def __str__(self):
        return self.name


class Permission(models.Model):
    """Permiso granular por módulo y acción."""
    MODULE_CHOICES = [
        ('dashboard', 'Dashboard'),
        ('customers', 'Clientes'),
        ('loan_applications', 'Solicitudes'),
        ('loans', 'Préstamos'),
        ('payments', 'Cobros'),
        ('cash', 'Caja'),
        ('collections', 'Cobranza'),
        ('guarantees', 'Garantías'),
        ('accounting', 'Contabilidad'),
        ('reports', 'Reportes'),
        ('contracts', 'Contratos'),
        ('documents', 'Documentos'),
        ('commissions', 'Comisiones'),
        ('legal', 'Legal'),
        ('users', 'Usuarios'),
        ('branches', 'Sucursales'),
        ('config', 'Configuración'),
        ('audit', 'Auditoría'),
    ]
    ACTION_CHOICES = [
        ('view', 'Ver'),
        ('create', 'Crear'),
        ('edit', 'Editar'),
        ('delete', 'Eliminar'),
        ('approve', 'Aprobar'),
        ('reject', 'Rechazar'),
        ('export', 'Exportar'),
        ('print', 'Imprimir'),
    ]

    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    codename = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        unique_together = ['module', 'action']

    def __str__(self):
        return self.codename

    def save(self, *args, **kwargs):
        if not self.codename:
            self.codename = f'{self.module}.{self.action}'
        super().save(*args, **kwargs)


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = ['role', 'permission']


class User(AbstractBaseUser, PermissionsMixin):
    """Usuario del sistema."""
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='users/avatars/', null=True, blank=True)

    branch = models.ForeignKey(
        'branches.Branch', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='users'
    )
    roles = models.ManyToManyField(Role, through='UserRole', through_fields=('user', 'role'), blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_blocked = models.BooleanField(default=False)
    blocked_reason = models.TextField(blank=True)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    # 2FA
    totp_secret = models.CharField(max_length=32, blank=True)
    two_factor_enabled = models.BooleanField(default=False)

    # Timestamps
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)
    last_password_change = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    objects = UserManager()

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f'{self.get_full_name()} ({self.email})'

    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    @property
    def full_name(self):
        """Propiedad para compatibilidad con serializers que usan source='X.full_name'."""
        return self.get_full_name()

    def get_totp_uri(self):
        return pyotp.totp.TOTP(self.totp_secret).provisioning_uri(
            name=self.email, issuer_name='CredCore'
        )

    def verify_totp(self, token: str) -> bool:
        return pyotp.TOTP(self.totp_secret).verify(token)

    def has_permission(self, module: str, action: str) -> bool:
        if self.is_superuser:
            return True
        codename = f'{module}.{action}'
        return self.roles.filter(
            role_permissions__permission__codename=codename
        ).exists()


class UserRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    branch = models.ForeignKey(
        'branches.Branch', null=True, blank=True, on_delete=models.CASCADE
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        User, null=True, on_delete=models.SET_NULL, related_name='+'
    )

    class Meta:
        unique_together = ['user', 'role', 'branch']


class UserSession(models.Model):
    """Registro de sesiones de usuario."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    session_key = models.CharField(max_length=40, blank=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    login_at = models.DateTimeField(auto_now_add=True)
    logout_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-login_at']

    def __str__(self):
        return f'{self.user.email} - {self.login_at}'
