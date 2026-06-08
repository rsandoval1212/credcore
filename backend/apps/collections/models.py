"""Gestión de mora y cobranza."""
from django.db import models
from apps.core.models import TimeStampedModel


class CollectionAction(TimeStampedModel):
    ACTION_CHOICES = [
        ('CALL',      'Llamada Telefónica'),
        ('VISIT',     'Visita Domiciliar'),
        ('NOTICE',    'Notificación Escrita'),
        ('EMAIL',     'Correo Electrónico'),
        ('SMS',       'SMS'),
        ('WHATSAPP',  'WhatsApp'),
        ('AGREEMENT', 'Acuerdo de Pago'),
        ('LEGAL',     'Acción Legal'),
    ]
    RESULT_CHOICES = [
        ('CONTACT_MADE', 'Contacto Realizado'), ('NO_CONTACT', 'Sin Contacto'),
        ('PROMISE_TO_PAY', 'Promesa de Pago'), ('REFUSED', 'Negativa de Pago'),
        ('AGREEMENT_REACHED', 'Acuerdo Alcanzado'), ('PARTIAL_PAYMENT', 'Pago Parcial'),
    ]

    loan = models.ForeignKey('loans.Loan', on_delete=models.PROTECT, related_name='collection_actions')
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='collection_actions')
    action_type = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey('users.User', on_delete=models.PROTECT)
    notes = models.TextField()
    result = models.CharField(max_length=25, choices=RESULT_CHOICES, blank=True)
    next_action_date = models.DateField(null=True, blank=True)
    next_action_type = models.CharField(max_length=20, choices=ACTION_CHOICES, blank=True)
    days_past_due_at_action = models.PositiveSmallIntegerField(default=0)
    amount_owed_at_action = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    # Geolocalización (para visitas de campo)
    latitude  = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    address_visited = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Acción de Cobro'
        verbose_name_plural = 'Acciones de Cobro'

    def __str__(self):
        return f'{self.loan.loan_number} - {self.get_action_type_display()}'


class PaymentAgreement(TimeStampedModel):
    STATUS_CHOICES = [
        ('ACTIVE', 'Activo'), ('FULFILLED', 'Cumplido'),
        ('BROKEN', 'Incumplido'), ('CANCELLED', 'Cancelado'),
    ]

    loan = models.ForeignKey('loans.Loan', on_delete=models.PROTECT, related_name='payment_agreements')
    collection_action = models.ForeignKey(
        CollectionAction, null=True, blank=True, on_delete=models.SET_NULL
    )
    agreed_amount = models.DecimalField(max_digits=15, decimal_places=2)
    agreed_payment_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ACTIVE')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey('users.User', on_delete=models.PROTECT)

    class Meta:
        verbose_name = 'Acuerdo de Pago'
        verbose_name_plural = 'Acuerdos de Pago'

    def __str__(self):
        return f'{self.loan.loan_number} - RD$ {self.agreed_amount}'
