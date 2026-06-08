"""Productos financieros y su configuración."""
from django.db import models
from apps.core.models import TimeStampedModel


class LoanProduct(TimeStampedModel):
    PRODUCT_TYPE_CHOICES = [
        ('PERSONAL', 'Préstamo Personal'),
        ('COMMERCIAL', 'Préstamo Comercial'),
        ('MORTGAGE', 'Préstamo Hipotecario'),
        ('PRENDARIO', 'Préstamo Prendario'),
        ('MICROCREDIT', 'Microcrédito'),
        ('CREDIT_LINE', 'Línea de Crédito'),
    ]
    RATE_TYPE_CHOICES = [('FIXED', 'Fija'), ('VARIABLE', 'Variable')]
    CALC_METHOD_CHOICES = [('SIMPLE', 'Interés Simple'), ('COMPOUND', 'Interés Compuesto')]
    PAYMENT_METHOD_CHOICES = [
        ('NIVELADA', 'Cuotas Niveladas'),
        ('DECRECIENTE', 'Cuotas Decrecientes'),
        ('PERSONALIZADA', 'Cuotas Personalizadas'),
    ]
    PAYMENT_FREQUENCY_CHOICES = [
        ('DAILY',    'Diario'),
        ('WEEKLY',   'Semanal'),
        ('BIWEEKLY', 'Quincenal'),
        ('MONTHLY',  'Mensual'),
    ]

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES)

    # Tasas
    interest_rate_type = models.CharField(max_length=10, choices=RATE_TYPE_CHOICES, default='FIXED')
    calculation_method = models.CharField(max_length=10, choices=CALC_METHOD_CHOICES, default='SIMPLE')
    payment_method    = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='NIVELADA')
    payment_frequency = models.CharField(max_length=10, choices=PAYMENT_FREQUENCY_CHOICES, default='MONTHLY')
    annual_interest_rate = models.DecimalField(max_digits=6, decimal_places=3, help_text='Tasa anual en %')
    late_fee_rate = models.DecimalField(max_digits=6, decimal_places=3, default=0, help_text='Mora diaria en %')
    commission_rate = models.DecimalField(max_digits=6, decimal_places=3, default=0, help_text='Comisión en %')

    # Límites
    min_amount = models.DecimalField(max_digits=15, decimal_places=2)
    max_amount = models.DecimalField(max_digits=15, decimal_places=2)
    min_term_months = models.PositiveSmallIntegerField()
    max_term_months = models.PositiveSmallIntegerField()

    # Requisitos
    requires_guarantee = models.BooleanField(default=False)
    requires_guarantor = models.BooleanField(default=False)
    min_credit_score = models.PositiveSmallIntegerField(null=True, blank=True)

    # Workflow de aprobación
    approval_levels = models.PositiveSmallIntegerField(default=1)
    auto_approve_limit = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Numeración
    loan_number_prefix = models.CharField(max_length=10, blank=True)

    is_active = models.BooleanField(default=True)
    branch = models.ForeignKey(
        'branches.Branch', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='loan_products'
    )

    class Meta:
        verbose_name = 'Producto Financiero'
        verbose_name_plural = 'Productos Financieros'

    def __str__(self):
        return f'{self.code} - {self.name}'


class ApprovalWorkflowStep(TimeStampedModel):
    """Paso en el workflow de aprobación de un producto."""
    product = models.ForeignKey(LoanProduct, on_delete=models.CASCADE, related_name='workflow_steps')
    step_order = models.PositiveSmallIntegerField()
    step_name = models.CharField(max_length=100)
    required_role = models.ForeignKey('users.Role', on_delete=models.PROTECT)
    max_amount_for_auto = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['step_order']
        unique_together = ['product', 'step_order']

    def __str__(self):
        return f'{self.product.code} - Paso {self.step_order}: {self.step_name}'
