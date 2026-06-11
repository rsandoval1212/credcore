"""Préstamos activos, tabla de amortización y refinanciamientos."""
from django.db import models
from apps.core.models import BaseModel


class Loan(BaseModel):
    STATUS_CHOICES = [
        ('ACTIVE', 'Activo'), ('COMPLETED', 'Completado'),
        ('DEFAULTED', 'En Mora'), ('WRITTEN_OFF', 'Castigado'),
        ('CANCELLED', 'Cancelado'), ('REFINANCED', 'Refinanciado'),
    ]
    PAYMENT_METHOD_CHOICES = [
        ('NIVELADA', 'Cuotas Niveladas'), ('DECRECIENTE', 'Cuotas Decrecientes'),
        ('PERSONALIZADA', 'Cuotas Personalizadas'),
    ]
    PAYMENT_FREQUENCY_CHOICES = [
        ('DAILY',      'Diario'),
        ('WEEKLY',     'Semanal'),
        ('BIWEEKLY',   'Quincenal'),
        ('MONTHLY',    'Mensual'),
        ('CUSTOM',     'Personalizado'),
    ]
    INTEREST_TYPE_CHOICES = [
        ('SIMPLE',   'Interés Simple'),
        ('COMPOUND', 'Interés Compuesto'),
    ]

    loan_number = models.CharField(max_length=30, unique=True, blank=True)
    application = models.OneToOneField(
        'loan_applications.LoanApplication', on_delete=models.PROTECT,
        related_name='loan', null=True, blank=True
    )
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='loans')
    product = models.ForeignKey('loan_products.LoanProduct', on_delete=models.PROTECT)
    branch = models.ForeignKey('branches.Branch', on_delete=models.PROTECT)
    officer = models.ForeignKey(
        'users.User', null=True, on_delete=models.SET_NULL, related_name='managed_loans'
    )

    # Términos del préstamo
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2)
    annual_interest_rate = models.DecimalField(max_digits=6, decimal_places=3)
    term_months = models.PositiveSmallIntegerField()
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='NIVELADA')
    payment_frequency = models.CharField(max_length=10, choices=PAYMENT_FREQUENCY_CHOICES, default='MONTHLY')
    interest_type = models.CharField(max_length=10, choices=INTEREST_TYPE_CHOICES, default='SIMPLE')
    late_fee_rate = models.DecimalField(max_digits=6, decimal_places=3, default=0)
    commission_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Totales calculados al desembolso
    monthly_payment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_interest  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_to_pay    = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Saldos en tiempo real
    outstanding_principal = models.DecimalField(max_digits=15, decimal_places=2)
    outstanding_interest = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    outstanding_late_fees = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_paid = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Status
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)
    days_past_due = models.PositiveSmallIntegerField(default=0)
    installments_paid = models.PositiveSmallIntegerField(default=0)
    installments_remaining = models.PositiveSmallIntegerField(default=0)

    # Fechas
    disbursement_date = models.DateField()
    first_payment_date = models.DateField(null=True, blank=True)
    maturity_date = models.DateField()
    last_payment_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Refinanciamiento
    is_refinanced = models.BooleanField(default=False)
    original_loan = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='refinanced_loans'
    )

    notes = models.TextField(blank=True)
    # Firma digital del cliente (base64 del canvas de firma)
    client_signature = models.TextField(blank=True, help_text='Firma digital del cliente en formato base64 PNG')
    signature_date   = models.DateTimeField(null=True, blank=True)
    signature_ip     = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        verbose_name = 'Préstamo'
        verbose_name_plural = 'Préstamos'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'branch']),
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['days_past_due']),
        ]

    def __str__(self):
        return f'{self.loan_number} - {self.customer}'

    def save(self, *args, **kwargs):
        if not self.loan_number:
            from apps.core.utils import generate_code
            prefix = self.product.loan_number_prefix or 'PRES'
            self.loan_number = generate_code(prefix, 8, model_class=type(self), field_name='loan_number')
        super().save(*args, **kwargs)

    def generate_schedule(self):
        """Genera la tabla de amortización para este préstamo."""
        from apps.loans.views import _build_schedule
        _build_schedule(self)


class LoanSchedule(models.Model):
    """Tabla de amortización (plan de pagos)."""
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'), ('PARTIAL', 'Pago Parcial'),
        ('PAID', 'Pagada'), ('OVERDUE', 'Vencida'), ('WAIVED', 'Condonada'),
    ]

    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='schedule')
    installment_number = models.PositiveSmallIntegerField()
    due_date = models.DateField(db_index=True)

    # Montos esperados
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2)
    interest_amount = models.DecimalField(max_digits=15, decimal_places=2)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    late_fee_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Montos pagados
    paid_principal = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    paid_interest = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    paid_late_fees = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_paid = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    paid_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    balance_after = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    class Meta:
        ordering = ['installment_number']
        unique_together = ['loan', 'installment_number']

    def __str__(self):
        return f'{self.loan.loan_number} - Cuota {self.installment_number}'

    @property
    def is_overdue(self):
        from django.utils import timezone
        return self.status == 'PENDING' and self.due_date < timezone.now().date()
