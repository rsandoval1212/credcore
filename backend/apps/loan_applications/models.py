"""Solicitudes de préstamo y workflow de aprobación."""
from django.db import models
from apps.core.models import BaseModel
from apps.core.validators import validate_file_extension, validate_file_size


class LoanApplication(BaseModel):
    STATUS_CHOICES = [
        ('DRAFT', 'Borrador'),
        ('SUBMITTED', 'Enviada'),
        ('UNDER_REVIEW', 'En Revisión'),
        ('APPROVED', 'Aprobada'),
        ('REJECTED', 'Rechazada'),
        ('CANCELLED', 'Cancelada'),
        ('DISBURSED', 'Desembolsada'),
    ]

    application_number = models.CharField(max_length=30, unique=True, blank=True)
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='loan_applications')
    product = models.ForeignKey('loan_products.LoanProduct', on_delete=models.PROTECT)
    branch = models.ForeignKey('branches.Branch', on_delete=models.PROTECT)

    # Solicitud
    requested_amount = models.DecimalField(max_digits=15, decimal_places=2)
    requested_term_months = models.PositiveSmallIntegerField()
    purpose = models.TextField(verbose_name='Propósito del préstamo')

    # Estado del workflow
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT', db_index=True)
    current_step = models.PositiveSmallIntegerField(default=1)
    assigned_to = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='assigned_applications'
    )

    # Análisis financiero
    monthly_payment_estimate = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    debt_to_income_ratio = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    credit_score_at_application = models.PositiveSmallIntegerField(null=True, blank=True)
    risk_level = models.CharField(max_length=10, blank=True)

    # Monto aprobado (puede diferir del solicitado)
    approved_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    approved_term_months = models.PositiveSmallIntegerField(null=True, blank=True)
    approved_rate = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)

    # Fechas clave
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    disbursed_at = models.DateTimeField(null=True, blank=True)

    # Rechazo
    rejection_reason = models.TextField(blank=True)
    rejected_by = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='rejected_applications'
    )

    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Solicitud de Préstamo'
        verbose_name_plural = 'Solicitudes de Préstamo'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.application_number} - {self.customer}'

    def save(self, *args, **kwargs):
        if not self.application_number:
            from apps.core.utils import generate_code
            self.application_number = generate_code('SOL', 8, model_class=type(self), field_name='application_number')
        super().save(*args, **kwargs)


class ApplicationWorkflowLog(models.Model):
    """Historial del workflow de aprobación."""
    ACTION_CHOICES = [
        ('SUBMITTED', 'Enviada'), ('APPROVED_STEP', 'Paso Aprobado'),
        ('REJECTED', 'Rechazada'), ('RETURNED', 'Devuelta'),
        ('ESCALATED', 'Escalada'), ('CANCELLED', 'Cancelada'),
        ('DISBURSED', 'Desembolsada'),
    ]

    application = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name='workflow_logs')
    step = models.PositiveSmallIntegerField()
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey('users.User', on_delete=models.PROTECT)
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.application.application_number} - {self.action}'


class ApplicationDocument(models.Model):
    """Documentos requeridos para la solicitud."""
    application = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50)
    document_name = models.CharField(max_length=200)
    file = models.FileField(upload_to='applications/documents/%Y/%m/',
                            validators=[validate_file_extension, validate_file_size])
    is_required = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.document_name} - {self.application}'
