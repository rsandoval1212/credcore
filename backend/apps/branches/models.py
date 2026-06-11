from django.db import models
from apps.core.models import TimeStampedModel


class Branch(TimeStampedModel):
    name = models.CharField(max_length=200, verbose_name='Nombre')
    code = models.CharField(max_length=20, unique=True, verbose_name='Código')
    address = models.TextField(verbose_name='Dirección')
    city = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    manager = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='managed_branches'
    )
    is_active = models.BooleanField(default=True)
    is_main = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Sucursal'
        verbose_name_plural = 'Sucursales'
        ordering = ['name']

    def __str__(self):
        return f'{self.code} - {self.name}'

    @classmethod
    def get_main(cls):
        """Devuelve la sucursal principal, creándola si no existe.

        En la versión de escritorio (un solo negocio) las sucursales se
        manejan de forma transparente: siempre hay una 'Sucursal Principal'.
        """
        branch = cls.objects.filter(is_main=True).first() or cls.objects.first()
        if branch is None:
            branch = cls.objects.create(
                name='Sucursal Principal',
                code='PRINCIPAL',
                address='N/A',
                city='N/A',
                province='N/A',
                is_main=True,
                is_active=True,
            )
        return branch


class BranchSettings(models.Model):
    """Configuración específica por sucursal."""
    branch = models.OneToOneField(Branch, on_delete=models.CASCADE, related_name='settings')
    currency = models.CharField(max_length=3, default='DOP')
    currency_symbol = models.CharField(max_length=5, default='RD$')
    max_loan_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    loan_number_prefix = models.CharField(max_length=10, default='PRES')
    client_number_prefix = models.CharField(max_length=10, default='CLI')
    receipt_number_prefix = models.CharField(max_length=10, default='REC')
    working_hours_start = models.TimeField(default='08:00')
    working_hours_end = models.TimeField(default='17:00')

    def __str__(self):
        return f'Config - {self.branch.name}'
