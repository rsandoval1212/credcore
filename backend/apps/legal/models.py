"""Gestión de expedientes legales."""
from django.db import models
from apps.core.models import TimeStampedModel


class LegalCase(TimeStampedModel):
    TYPE_CHOICES = [
        ('DEMAND', 'Demanda'), ('EMBARGO', 'Embargo'), ('EXECUTION', 'Ejecución'), ('OTHER', 'Otro')
    ]
    STATUS_CHOICES = [
        ('OPEN', 'Abierto'), ('IN_PROGRESS', 'En Proceso'), ('WON', 'Ganado'),
        ('LOST', 'Perdido'), ('SETTLED', 'Acordado'), ('CLOSED', 'Cerrado'),
    ]

    loan = models.ForeignKey('loans.Loan', on_delete=models.PROTECT, related_name='legal_cases')
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='legal_cases')
    case_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    case_number = models.CharField(max_length=100, blank=True)
    court = models.CharField(max_length=200, blank=True)
    attorney = models.CharField(max_length=200, blank=True)
    attorney_phone = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='OPEN')
    filed_at = models.DateField(null=True, blank=True)
    amount_claimed = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount_recovered = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    next_hearing_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey('users.User', on_delete=models.PROTECT)

    class Meta:
        verbose_name = 'Caso Legal'
        verbose_name_plural = 'Casos Legales'

    def __str__(self):
        return f'{self.get_case_type_display()} - {self.loan.loan_number}'


class LegalDocument(models.Model):
    case = models.ForeignKey(LegalCase, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=100)
    file = models.FileField(upload_to='legal/documents/%Y/%m/')
    document_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.document_type} - {self.case}'
