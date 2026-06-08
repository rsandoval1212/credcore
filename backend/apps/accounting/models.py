"""Contabilidad: catálogo de cuentas, asientos y períodos."""
from django.db import models
from apps.core.models import TimeStampedModel


class AccountType(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    nature = models.CharField(max_length=10, choices=[('DEBIT', 'Débito'), ('CREDIT', 'Crédito')])

    def __str__(self):
        return f'{self.code} - {self.name}'


class Account(TimeStampedModel):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    account_type = models.ForeignKey(AccountType, on_delete=models.PROTECT)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.PROTECT, related_name='children')
    level = models.PositiveSmallIntegerField(default=1)
    is_detail = models.BooleanField(default=True, help_text='Cuenta de detalle (vs. cuenta de grupo)')
    allows_transactions = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['code']
        verbose_name = 'Cuenta Contable'
        verbose_name_plural = 'Catálogo de Cuentas'

    def __str__(self):
        return f'{self.code} - {self.name}'


class AccountingPeriod(TimeStampedModel):
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)
    closed_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name


class JournalEntry(TimeStampedModel):
    STATUS_CHOICES = [('DRAFT', 'Borrador'), ('POSTED', 'Contabilizado'), ('CANCELLED', 'Cancelado')]

    entry_number = models.CharField(max_length=20, unique=True, blank=True)
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT)
    entry_date = models.DateField()
    description = models.TextField()
    reference = models.CharField(max_length=100, blank=True)
    total_debit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_credit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='DRAFT')
    created_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='+')
    branch = models.ForeignKey('branches.Branch', on_delete=models.PROTECT)

    # Referencia al origen del asiento
    source_type = models.CharField(max_length=50, blank=True)  # payment, disbursement, etc.
    source_id = models.CharField(max_length=50, blank=True)

    class Meta:
        verbose_name = 'Asiento Contable'
        verbose_name_plural = 'Asientos Contables'

    def __str__(self):
        return f'{self.entry_number} - {self.description[:50]}'


class JournalEntryLine(models.Model):
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
    description = models.CharField(max_length=200, blank=True)
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.account.code} | Db: {self.debit} | Cr: {self.credit}'
