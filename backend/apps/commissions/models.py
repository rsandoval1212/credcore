"""Sistema de comisiones para oficiales de crédito."""
from django.db import models
from apps.core.models import TimeStampedModel


class CommissionRule(TimeStampedModel):
    TYPE_CHOICES = [
        ('DISBURSEMENT', 'Por Desembolso'), ('COLLECTION', 'Por Recuperación'), ('GOAL', 'Por Meta'),
    ]
    CALC_CHOICES = [('FIXED', 'Fijo'), ('PERCENTAGE', 'Porcentaje')]

    name = models.CharField(max_length=200)
    product = models.ForeignKey(
        'loan_products.LoanProduct', null=True, blank=True, on_delete=models.SET_NULL
    )
    commission_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    calculation_method = models.CharField(max_length=15, choices=CALC_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=4)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class CommissionRecord(TimeStampedModel):
    STATUS_CHOICES = [('PENDING', 'Pendiente'), ('APPROVED', 'Aprobada'), ('PAID', 'Pagada')]

    officer = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='commissions')
    rule = models.ForeignKey(CommissionRule, on_delete=models.PROTECT)
    loan = models.ForeignKey('loans.Loan', null=True, blank=True, on_delete=models.PROTECT)
    payment = models.ForeignKey('payments.Payment', null=True, blank=True, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    period = models.CharField(max_length=7, help_text='YYYY-MM')
    paid_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.officer.get_full_name()} - {self.amount}'
