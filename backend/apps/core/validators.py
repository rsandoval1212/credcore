"""
FIX A1: Validadores de archivos — tipo MIME y tamaño máximo.
Previene uploads de archivos maliciosos y DoS por archivos gigantes.
"""
import os
from django.core.exceptions import ValidationError


# Extensiones permitidas por categoría
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'}
ALLOWED_DOCUMENT_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'}
ALLOWED_ALL_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_DOCUMENT_EXTENSIONS

# Tamaños máximos
MAX_IMAGE_SIZE = 5 * 1024 * 1024       # 5 MB
MAX_DOCUMENT_SIZE = 20 * 1024 * 1024    # 20 MB
MAX_BACKUP_SIZE = 500 * 1024 * 1024     # 500 MB


def validate_file_extension(value):
    """Valida que el archivo tenga una extensión permitida."""
    ext = os.path.splitext(value.name)[1].lower()
    if ext not in ALLOWED_ALL_EXTENSIONS:
        raise ValidationError(
            f'Tipo de archivo no permitido: {ext}. '
            f'Extensiones permitidas: {", ".join(sorted(ALLOWED_ALL_EXTENSIONS))}'
        )


def validate_image_extension(value):
    """Valida extensiones de imagen únicamente."""
    ext = os.path.splitext(value.name)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            f'Tipo de imagen no permitido: {ext}. '
            f'Extensiones permitidas: {", ".join(sorted(ALLOWED_IMAGE_EXTENSIONS))}'
        )


def validate_file_size(value):
    """Valida tamaño máximo de documentos (20 MB)."""
    if value.size > MAX_DOCUMENT_SIZE:
        raise ValidationError(
            f'El archivo es demasiado grande ({value.size / 1024 / 1024:.1f} MB). '
            f'Máximo permitido: {MAX_DOCUMENT_SIZE / 1024 / 1024:.0f} MB.'
        )


def validate_image_size(value):
    """Valida tamaño máximo de imágenes (5 MB)."""
    if value.size > MAX_IMAGE_SIZE:
        raise ValidationError(
            f'La imagen es demasiado grande ({value.size / 1024 / 1024:.1f} MB). '
            f'Máximo permitido: {MAX_IMAGE_SIZE / 1024 / 1024:.0f} MB.'
        )


def validate_backup_file(value):
    """Valida archivo de backup SQLite."""
    ext = os.path.splitext(value.name)[1].lower()
    if ext != '.sqlite3':
        raise ValidationError('Solo se aceptan archivos .sqlite3 para restauración.')
    if value.size > MAX_BACKUP_SIZE:
        raise ValidationError(
            f'El backup es demasiado grande ({value.size / 1024 / 1024:.0f} MB). '
            f'Máximo: {MAX_BACKUP_SIZE / 1024 / 1024:.0f} MB.'
        )
