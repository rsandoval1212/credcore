"""Gestión de respaldos del sistema."""
from django.db import models
from apps.core.models import TimeStampedModel


class BackupRecord(TimeStampedModel):
    STATUS_CHOICES = [
        ('IN_PROGRESS', 'En Proceso'), ('COMPLETED', 'Completado'),
        ('FAILED', 'Fallido'), ('DELETED', 'Eliminado'),
    ]
    TYPE_CHOICES = [('MANUAL', 'Manual'), ('AUTOMATIC', 'Automático')]
    STORAGE_CHOICES = [('LOCAL', 'Local'), ('CLOUD', 'Nube'), ('SHARED', 'Carpeta Compartida')]

    backup_type = models.CharField(max_length=15, choices=TYPE_CHOICES)
    storage = models.CharField(max_length=10, choices=STORAGE_CHOICES, default='LOCAL')
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, blank=True)
    file_size = models.BigIntegerField(default=0)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='IN_PROGRESS')
    created_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL
    )
    error_message = models.TextField(blank=True)
    checksum = models.CharField(max_length=64, blank=True)

    class Meta:
        verbose_name = 'Respaldo'
        verbose_name_plural = 'Respaldos'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.file_name} - {self.status}'
