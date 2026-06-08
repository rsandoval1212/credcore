"""Auditoría empresarial completa."""
import uuid
from django.db import models


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'users.User', null=True, on_delete=models.SET_NULL, related_name='audit_logs'
    )
    action = models.CharField(max_length=50)  # CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100, blank=True)
    object_repr = models.TextField(blank=True)

    # Antes y después del cambio
    before_data = models.JSONField(null=True, blank=True)
    after_data = models.JSONField(null=True, blank=True)
    changes = models.JSONField(null=True, blank=True)

    # Información técnica
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    session_key = models.CharField(max_length=40, blank=True)
    request_method = models.CharField(max_length=10, blank=True)
    request_path = models.CharField(max_length=500, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    branch = models.ForeignKey(
        'branches.Branch', null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Log de Auditoría'
        verbose_name_plural = 'Logs de Auditoría'
        indexes = [
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]

    def __str__(self):
        return f'{self.action} - {self.model_name} - {self.timestamp}'
