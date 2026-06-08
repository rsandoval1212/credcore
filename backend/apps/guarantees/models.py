"""Garantías prendarias e hipotecarias."""
from django.db import models
from apps.core.models import BaseModel


class Guarantee(BaseModel):
    TYPE_CHOICES = [
        ('VEHICLE', 'Vehículo'), ('REAL_ESTATE', 'Inmueble'),
        ('EQUIPMENT', 'Equipo'), ('INVENTORY', 'Inventario'), ('OTHER', 'Otro'),
    ]
    STATUS_CHOICES = [
        ('ACTIVE', 'Activa'), ('RELEASED', 'Liberada'), ('FORECLOSED', 'Ejecutada'),
    ]

    loan = models.ForeignKey('loans.Loan', on_delete=models.PROTECT, related_name='guarantees')
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='guarantees')
    guarantee_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description = models.TextField()
    estimated_value = models.DecimalField(max_digits=15, decimal_places=2)
    appraisal_date = models.DateField(null=True, blank=True)
    appraiser = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='ACTIVE')
    release_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Garantía'
        verbose_name_plural = 'Garantías'

    def __str__(self):
        return f'{self.get_guarantee_type_display()} - {self.loan.loan_number}'


class VehicleGuarantee(models.Model):
    guarantee = models.OneToOneField(Guarantee, on_delete=models.CASCADE, related_name='vehicle')
    make = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    year = models.PositiveSmallIntegerField()
    color = models.CharField(max_length=50)
    plate_number = models.CharField(max_length=20)
    chassis_number = models.CharField(max_length=50)
    engine_number = models.CharField(max_length=50, blank=True)
    mileage = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f'{self.year} {self.make} {self.model} - {self.plate_number}'


class RealEstateGuarantee(models.Model):
    PROPERTY_TYPE_CHOICES = [
        ('HOUSE', 'Casa'), ('APARTMENT', 'Apartamento'),
        ('LAND', 'Terreno'), ('COMMERCIAL', 'Local Comercial'), ('OTHER', 'Otro'),
    ]

    guarantee = models.OneToOneField(Guarantee, on_delete=models.CASCADE, related_name='real_estate')
    property_type = models.CharField(max_length=20, choices=PROPERTY_TYPE_CHOICES)
    address = models.TextField()
    city = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    area_m2 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    title_number = models.CharField(max_length=100, blank=True)
    registry = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f'{self.get_property_type_display()} - {self.address[:50]}'


class GuaranteeDocument(models.Model):
    guarantee = models.ForeignKey(Guarantee, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=100)
    file = models.FileField(upload_to='guarantees/documents/%Y/%m/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='+')
    notes = models.TextField(blank=True)

    def __str__(self):
        return f'{self.document_type} - {self.guarantee}'
