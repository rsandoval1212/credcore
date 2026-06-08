"""Gestión de caja: apertura, cierre y transacciones."""
from django.db import models
from apps.core.models import TimeStampedModel


class CashRegister(TimeStampedModel):
    name = models.CharField(max_length=100)
    branch = models.ForeignKey('branches.Branch', on_delete=models.PROTECT, related_name='cash_registers')
    currency = models.CharField(max_length=3, default='DOP')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.name} - {self.branch.name}'


class CashSession(TimeStampedModel):
    STATUS_CHOICES = [
        ('OPEN', 'Abierta'), ('CLOSED', 'Cerrada'), ('RECONCILED', 'Conciliada'),
    ]

    cash_register = models.ForeignKey(CashRegister, on_delete=models.PROTECT, related_name='sessions')
    cashier = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='cash_sessions')

    opening_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    closing_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    expected_closing = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    difference = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    total_income = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_expense = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='OPEN', db_index=True)
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closing_notes = models.TextField(blank=True)
    closed_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='closed_sessions'
    )

    class Meta:
        ordering = ['-opened_at']

    def __str__(self):
        return f'{self.cash_register.name} - {self.opened_at.date()}'


class CashTransaction(TimeStampedModel):
    TRANSACTION_TYPE_CHOICES = [
        ('INCOME', 'Ingreso'), ('EXPENSE', 'Egreso'), ('TRANSFER', 'Transferencia'),
    ]
    CATEGORY_CHOICES = [
        ('LOAN_PAYMENT', 'Cobro de Préstamo'), ('LOAN_DISBURSEMENT', 'Desembolso'),
        ('COMMISSION', 'Comisión'), ('EXPENSE', 'Gasto Operativo'),
        ('TRANSFER_IN', 'Transferencia Entrada'), ('TRANSFER_OUT', 'Transferencia Salida'),
        ('OTHER', 'Otro'),
    ]

    session = models.ForeignKey(CashSession, on_delete=models.PROTECT, related_name='transactions')
    transaction_type = models.CharField(max_length=15, choices=TRANSACTION_TYPE_CHOICES)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    description = models.TextField(blank=True)
    reference = models.CharField(max_length=100, blank=True)
    related_payment = models.ForeignKey(
        'payments.Payment', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='cash_transactions'
    )
    created_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='+')

    def __str__(self):
        return f'{self.get_transaction_type_display()} - {self.amount}'
