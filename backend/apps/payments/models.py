"""Cobros, pagos y recibos."""
from django.db import models
from apps.core.models import BaseModel


class Payment(BaseModel):
    PAYMENT_TYPE_CHOICES = [
        ('REGULAR', 'Pago Regular'), ('PARTIAL', 'Pago Parcial'),
        ('EXTRAORDINARY', 'Abono Extraordinario'), ('FULL_PAYMENT', 'Cancelación Total'),
        ('LATE_FEE', 'Pago de Mora'),
    ]
    PAYMENT_METHOD_CHOICES = [
        ('CASH',          'Efectivo'),
        ('BANK_TRANSFER', 'Transferencia Bancaria'),
        ('CHECK',         'Cheque'),
        ('CARD',          'Tarjeta'),
        ('DEPOSIT',       'Depósito Bancario'),
        ('DIGITAL_WALLET','Billetera Digital'),
        ('OTHER',         'Otro'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'), ('CONFIRMED', 'Confirmado'),
        ('CANCELLED', 'Cancelado'), ('REVERSED', 'Revertido'),
    ]

    payment_number = models.CharField(max_length=30, unique=True, blank=True)
    loan = models.ForeignKey('loans.Loan', on_delete=models.PROTECT, related_name='payments')
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='payments')

    # Desglose del pago
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    interest_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    late_fee_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    commission_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='CASH')

    # Referencia bancaria
    reference_number = models.CharField(max_length=100, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    check_number = models.CharField(max_length=50, blank=True)

    # Recibo
    receipt_number = models.CharField(max_length=30, blank=True)

    # Caja
    cash_session = models.ForeignKey(
        'cash.CashSession', null=True, blank=True,
        on_delete=models.PROTECT, related_name='payments'
    )
    received_by = models.ForeignKey(
        'users.User', on_delete=models.PROTECT, related_name='received_payments'
    )

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='CONFIRMED')
    payment_date = models.DateField()
    notes = models.TextField(blank=True)

    # Cuotas cubiertas
    installments = models.ManyToManyField('loans.LoanSchedule', blank=True)

    class Meta:
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.payment_number} - {self.loan.loan_number}'

    def save(self, *args, **kwargs):
        if not self.payment_number:
            from apps.core.utils import generate_code
            self.payment_number = generate_code('PAG', 8)
        if not self.receipt_number:
            from apps.core.utils import generate_code
            self.receipt_number = generate_code('REC', 8)
        super().save(*args, **kwargs)
