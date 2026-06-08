"""Gestión documental avanzada con OCR y versionado."""
import uuid
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    document_type = models.CharField(max_length=50)
    file = models.FileField(upload_to='documents/%Y/%m/%d/')
    file_size = models.PositiveIntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)

    # Objeto relacionado (genérico)
    content_type = models.ForeignKey(ContentType, null=True, blank=True, on_delete=models.SET_NULL)
    object_id = models.CharField(max_length=50, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')

    # OCR
    ocr_text = models.TextField(blank=True)
    ocr_status = models.CharField(
        max_length=15,
        choices=[('PENDING', 'Pendiente'), ('PROCESSING', 'Procesando'), ('DONE', 'Listo'), ('FAILED', 'Fallido')],
        default='PENDING'
    )

    # Versionado
    version = models.PositiveSmallIntegerField(default=1)
    parent_document = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='versions'
    )

    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='verified_documents'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    uploaded_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='uploaded_documents')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Documento'
        verbose_name_plural = 'Documentos'

    def __str__(self):
        return f'{self.name} v{self.version}'
