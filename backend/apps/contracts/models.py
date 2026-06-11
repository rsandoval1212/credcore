"""Contratos inteligentes con plantillas dinámicas."""
from django.db import models
from apps.core.models import BaseModel


class ContractTemplate(models.Model):
    CONTRACT_TYPE_CHOICES = [
        ('LOAN', 'Contrato de Préstamo'), ('PAGARE', 'Pagaré'),
        ('COMMITMENT', 'Carta de Compromiso'), ('REFINANCING', 'Acuerdo de Refinanciamiento'),
        ('MORA_AGREEMENT', 'Acuerdo de Mora'), ('GUARANTEE', 'Contrato de Garantía'),
    ]

    name = models.CharField(max_length=200)
    contract_type = models.CharField(max_length=20, choices=CONTRACT_TYPE_CHOICES)
    content = models.TextField(help_text='Plantilla HTML con variables Jinja2')
    is_active = models.BooleanField(default=True)
    version = models.PositiveSmallIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['contract_type', 'is_active']
        verbose_name = 'Plantilla de Contrato'

    def __str__(self):
        return f'{self.get_contract_type_display()} v{self.version}'


class Contract(BaseModel):
    STATUS_CHOICES = [
        ('DRAFT', 'Borrador'), ('PENDING_SIGNATURE', 'Pendiente de Firma'),
        ('SIGNED', 'Firmado'), ('CANCELLED', 'Cancelado'),
    ]

    contract_number = models.CharField(max_length=30, unique=True, blank=True)
    template = models.ForeignKey(ContractTemplate, on_delete=models.PROTECT)
    loan = models.ForeignKey(
        'loans.Loan', null=True, blank=True, on_delete=models.PROTECT, related_name='contracts'
    )
    application = models.ForeignKey(
        'loan_applications.LoanApplication', null=True, blank=True,
        on_delete=models.PROTECT, related_name='contracts'
    )
    content = models.TextField(help_text='HTML renderizado')
    pdf_file = models.FileField(upload_to='contracts/pdfs/%Y/%m/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')

    class Meta:
        verbose_name = 'Contrato'
        verbose_name_plural = 'Contratos'

    def __str__(self):
        return f'{self.contract_number}'

    def save(self, *args, **kwargs):
        if not self.contract_number:
            from apps.core.utils import generate_code
            self.contract_number = generate_code('CONT', 8, model_class=type(self), field_name='contract_number')
        super().save(*args, **kwargs)


class ContractSignature(models.Model):
    SIGNER_TYPE_CHOICES = [
        ('BORROWER', 'Prestatario'), ('GUARANTOR', 'Garante'),
        ('OFFICER', 'Oficial'), ('WITNESS', 'Testigo'),
    ]

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='signatures')
    signer_type = models.CharField(max_length=15, choices=SIGNER_TYPE_CHOICES)
    signer_name = models.CharField(max_length=200)
    signer_id_number = models.CharField(max_length=20)
    signature_data = models.TextField(blank=True, help_text='Base64 de la firma digital')
    signed_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_signed = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.get_signer_type_display()} - {self.signer_name}'
