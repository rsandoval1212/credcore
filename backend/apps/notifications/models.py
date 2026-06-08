"""Sistema de notificaciones multicanal."""
from django.db import models
from apps.core.models import TimeStampedModel


class NotificationTemplate(TimeStampedModel):
    CHANNEL_CHOICES = [
        ('EMAIL', 'Correo Electrónico'), ('SMS', 'SMS'),
        ('WHATSAPP', 'WhatsApp'), ('INTERNAL', 'Interna'),
    ]
    EVENT_CHOICES = [
        ('PAYMENT_DUE', 'Cuota por Vencer'), ('PAYMENT_OVERDUE', 'Cuota Vencida'),
        ('LOAN_APPROVED', 'Préstamo Aprobado'), ('LOAN_REJECTED', 'Préstamo Rechazado'),
        ('LOAN_DISBURSED', 'Préstamo Desembolsado'), ('PAYMENT_RECEIVED', 'Pago Recibido'),
        ('LOAN_COMPLETED', 'Préstamo Completado'), ('ACCOUNT_CREATED', 'Cuenta Creada'),
        ('PASSWORD_RESET', 'Restablecimiento de Contraseña'), ('CUSTOM', 'Personalizado'),
    ]

    name = models.CharField(max_length=200)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    event_type = models.CharField(max_length=30, choices=EVENT_CHOICES)
    subject = models.CharField(max_length=300, blank=True)
    body = models.TextField(help_text='Plantilla Jinja2. Variables: {{customer_name}}, {{loan_number}}, etc.')
    is_active = models.BooleanField(default=True)
    send_days_before = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text='Días antes del vencimiento para enviar'
    )

    class Meta:
        unique_together = ['channel', 'event_type']
        verbose_name = 'Plantilla de Notificación'

    def __str__(self):
        return f'{self.get_event_type_display()} - {self.get_channel_display()}'


class Notification(TimeStampedModel):
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'), ('SENT', 'Enviada'),
        ('FAILED', 'Fallida'), ('READ', 'Leída'),
    ]

    template = models.ForeignKey(NotificationTemplate, null=True, blank=True, on_delete=models.SET_NULL)
    recipient_user = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.CASCADE, related_name='notifications'
    )
    recipient_customer = models.ForeignKey(
        'customers.Customer', null=True, blank=True, on_delete=models.CASCADE, related_name='notifications'
    )
    channel = models.CharField(max_length=10)
    recipient_address = models.CharField(max_length=200)
    subject = models.CharField(max_length=300, blank=True)
    body = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    # Objeto relacionado
    related_model = models.CharField(max_length=50, blank=True)
    related_id = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notificación'

    def __str__(self):
        return f'{self.channel} - {self.recipient_address} - {self.status}'
