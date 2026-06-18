"""
Modelos abstractos base para todo el sistema CredCore.
"""
import uuid
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """Agrega created_at y updated_at a todos los modelos."""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Usa UUID como primary key."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """Elimina lógicamente en lugar de físicamente."""
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )

    class Meta:
        abstract = True

    def delete(self, user=None, *args, **kwargs):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        if user:
            self.deleted_by = user
        self.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])

    def hard_delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)


class BaseModel(UUIDModel, TimeStampedModel, SoftDeleteModel):
    """Modelo base completo: UUID + timestamps + soft delete."""
    created_by = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    updated_by = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )

    class Meta:
        abstract = True
        ordering = ['-created_at']

    def save(self, **kwargs):
        if not self._state.adding:
            from apps.core.audit_middleware import get_current_user
            current = get_current_user()
            if current:
                self.updated_by = current
        super().save(**kwargs)


class CompanySettings(models.Model):
    """Configuración global de la institución prestamista (singleton)."""
    # Identidad
    company_name = models.CharField(max_length=200, default='CredCore')
    legal_name = models.CharField(max_length=200, blank=True, verbose_name='Razón Social')
    tax_id = models.CharField(max_length=30, blank=True, verbose_name='RNC / NIT')
    logo = models.ImageField(upload_to='company/', null=True, blank=True)

    # Contacto
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    province = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='República Dominicana')
    phone = models.CharField(max_length=20, blank=True)
    phone2 = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    whatsapp = models.CharField(max_length=20, blank=True, help_text='Número WhatsApp Business')

    # Bancos para depósitos
    bank_accounts = models.TextField(blank=True, help_text='Cuentas para recibir transferencias')

    # Monetario / formato
    currency = models.CharField(max_length=3, default='DOP')
    currency_symbol = models.CharField(max_length=5, default='RD$')
    secondary_currency = models.CharField(max_length=3, blank=True, default='USD', help_text='Moneda secundaria')
    secondary_currency_symbol = models.CharField(max_length=5, blank=True, default='US$')
    exchange_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0,
                                        help_text='Tasa de cambio: 1 USD = X DOP')
    timezone = models.CharField(max_length=50, default='America/Santo_Domingo')

    # Documentos
    receipt_footer = models.TextField(blank=True, default='¡Gracias por su preferencia!')
    statement_footer = models.TextField(blank=True, default='Documento generado automáticamente.')
    legal_notice = models.TextField(blank=True, help_text='Aviso legal en contratos')

    # Licenciamiento
    LICENSE_PLANS = [
        ('TRIAL',       'Prueba (30 días)'),
        ('BASIC',       'Básico (1 sucursal)'),
        ('PROFESSIONAL','Profesional (3 sucursales)'),
        ('ENTERPRISE',  'Empresarial (ilimitado)'),
    ]
    license_plan = models.CharField(max_length=15, choices=LICENSE_PLANS, default='TRIAL')
    license_key  = models.CharField(max_length=64, blank=True)
    license_expires = models.DateField(null=True, blank=True)
    max_branches = models.PositiveSmallIntegerField(default=1)
    max_users    = models.PositiveSmallIntegerField(default=5)

    # Sociales
    facebook = models.CharField(max_length=200, blank=True)
    instagram = models.CharField(max_length=200, blank=True)

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )

    class Meta:
        verbose_name = 'Configuración de Empresa'
        verbose_name_plural = 'Configuración de Empresa'

    def __str__(self):
        return self.company_name

    @classmethod
    def get_solo(cls):
        """Singleton: obtiene o crea la única instancia."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class BackupConfig(models.Model):
    """Configuración de copias de seguridad programadas."""
    FREQUENCY_CHOICES = [
        ('DAILY',   'Diario'),
        ('WEEKLY',  'Semanal'),
        ('MONTHLY', 'Mensual'),
        ('MANUAL',  'Solo Manual'),
    ]
    enabled = models.BooleanField(default=False)
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='DAILY')
    time_of_day = models.TimeField(default='02:00', help_text='Hora del día (24h)')
    retention_days = models.PositiveSmallIntegerField(
        default=30, help_text='Días que se conservan los backups antes de eliminarse'
    )
    notify_emails = models.TextField(
        blank=True, help_text='Correos a notificar (uno por línea)'
    )
    last_run_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=20, blank=True)
    last_error = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Configuración de Backup'
        verbose_name_plural = 'Configuración de Backup'

    def __str__(self):
        return f'Backup {self.get_frequency_display()} ({"activo" if self.enabled else "desactivado"})'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class BackupRecord(models.Model):
    """Registro de cada backup ejecutado."""
    STATUS_CHOICES = [
        ('IN_PROGRESS', 'En Progreso'),
        ('COMPLETED',   'Completado'),
        ('FAILED',      'Fallido'),
    ]
    TRIGGER_CHOICES = [
        ('MANUAL',    'Manual'),
        ('SCHEDULED', 'Programado'),
    ]
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, blank=True)
    file_size_bytes = models.BigIntegerField(default=0)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='IN_PROGRESS')
    trigger = models.CharField(max_length=10, choices=TRIGGER_CHOICES, default='MANUAL')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    triggered_by = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Backup'

    def __str__(self):
        return f'{self.file_name} ({self.get_status_display()})'

    @property
    def file_size_mb(self):
        return round(self.file_size_bytes / (1024 * 1024), 2) if self.file_size_bytes else 0
