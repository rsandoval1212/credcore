"""
Módulo de Cambio de Divisas — Compra, Venta y Cambio de Dólares (USD/DOP).

Modelos:
- ExchangeRate: Tasas de cambio diarias (compra/venta)
- CurrencyTransaction: Registro de cada operación de cambio
"""
from django.db import models
from apps.core.models import BaseModel, TimeStampedModel


class ExchangeRate(TimeStampedModel):
    """Tasa de cambio diaria USD/DOP."""
    date = models.DateField(unique=True, db_index=True)

    # Tasas — lo que la empresa paga/cobra
    buy_rate = models.DecimalField(
        max_digits=10, decimal_places=4,
        help_text='Precio al que COMPRAMOS dólares (pagamos DOP por cada USD)'
    )
    sell_rate = models.DecimalField(
        max_digits=10, decimal_places=4,
        help_text='Precio al que VENDEMOS dólares (cobramos DOP por cada USD)'
    )

    # Tasa de referencia del Banco Central
    reference_rate = models.DecimalField(
        max_digits=10, decimal_places=4, null=True, blank=True,
        help_text='Tasa referencia Banco Central RD'
    )

    spread = models.DecimalField(
        max_digits=10, decimal_places=4, default=0,
        help_text='Diferencia entre venta y compra (ganancia por USD)'
    )

    is_active = models.BooleanField(default=True)
    set_by = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+'
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-date']
        verbose_name = 'Tasa de Cambio'
        verbose_name_plural = 'Tasas de Cambio'

    def __str__(self):
        return f'{self.date} | Compra: {self.buy_rate} | Venta: {self.sell_rate}'

    def save(self, *args, **kwargs):
        self.spread = self.sell_rate - self.buy_rate
        super().save(*args, **kwargs)


class CurrencyTransaction(BaseModel):
    """Registro de operación de compra/venta de divisas."""

    OPERATION_CHOICES = [
        ('BUY', 'Compra de USD'),       # Cliente vende USD, empresa compra
        ('SELL', 'Venta de USD'),        # Cliente compra USD, empresa vende
    ]
    STATUS_CHOICES = [
        ('COMPLETED', 'Completada'),
        ('CANCELLED', 'Anulada'),
        ('PENDING', 'Pendiente'),
    ]
    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Efectivo'),
        ('TRANSFER', 'Transferencia'),
        ('CHECK', 'Cheque'),
    ]

    # Tipo de operación
    operation = models.CharField(max_length=4, choices=OPERATION_CHOICES, db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='COMPLETED', db_index=True)

    # Tasa aplicada
    exchange_rate = models.ForeignKey(
        ExchangeRate, null=True, blank=True,
        on_delete=models.PROTECT, related_name='transactions'
    )
    rate_applied = models.DecimalField(
        max_digits=10, decimal_places=4,
        help_text='Tasa efectiva aplicada en esta operación'
    )

    # Montos
    usd_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Cantidad en dólares (USD)'
    )
    dop_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text='Cantidad en pesos dominicanos (DOP)'
    )
    profit = models.DecimalField(
        max_digits=15, decimal_places=2, default=0,
        help_text='Ganancia de la operación en DOP'
    )

    # Cliente (opcional — puede ser walk-in)
    customer = models.ForeignKey(
        'customers.Customer', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='currency_transactions'
    )
    customer_name = models.CharField(
        max_length=200, blank=True,
        help_text='Nombre del cliente (si no está registrado)'
    )
    customer_id_number = models.CharField(
        max_length=30, blank=True,
        help_text='Cédula/Pasaporte (requerido por ley para montos >= US$500)'
    )
    customer_phone = models.CharField(max_length=20, blank=True)

    # Pago
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES, default='CASH')
    reference_number = models.CharField(max_length=100, blank=True, help_text='No. de referencia/cheque')

    # Recibo
    receipt_number = models.CharField(max_length=30, unique=True, db_index=True)

    # Relación con caja
    cash_session = models.ForeignKey(
        'cash.CashSession', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='currency_transactions'
    )

    # Sucursal
    branch = models.ForeignKey(
        'branches.Branch', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='currency_transactions'
    )

    # Operador
    operator = models.ForeignKey(
        'users.User', on_delete=models.PROTECT,
        related_name='currency_operations'
    )

    notes = models.TextField(blank=True)
    cancelled_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Transacción de Cambio'
        verbose_name_plural = 'Transacciones de Cambio'

    def __str__(self):
        op = 'Compra' if self.operation == 'BUY' else 'Venta'
        return f'{self.receipt_number} | {op} US${self.usd_amount} @ {self.rate_applied}'
