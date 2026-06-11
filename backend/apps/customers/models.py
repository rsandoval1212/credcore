"""
Módulo de Clientes - Expediente digital completo.
"""
from django.db import models
from apps.core.models import BaseModel
from apps.core.validators import (
    validate_image_extension, validate_image_size,
    validate_file_extension, validate_file_size,
)


class Customer(BaseModel):
    """Cliente del sistema (persona natural o jurídica)."""

    TYPE_CHOICES = [('NATURAL', 'Persona Natural'), ('JURIDICA', 'Persona Jurídica')]
    STATUS_CHOICES = [('ACTIVE', 'Activo'), ('INACTIVE', 'Inactivo'), ('BLOCKED', 'Bloqueado')]
    RISK_CHOICES = [('LOW', 'Bajo'), ('MEDIUM', 'Medio'), ('HIGH', 'Alto')]
    ID_TYPE_CHOICES = [('CEDULA', 'Cédula'), ('PASSPORT', 'Pasaporte'), ('RNC', 'RNC'), ('OTHER', 'Otro')]
    MARITAL_CHOICES = [
        ('SINGLE', 'Soltero/a'), ('MARRIED', 'Casado/a'),
        ('DIVORCED', 'Divorciado/a'), ('WIDOWED', 'Viudo/a'), ('UNION', 'Unión Libre'),
    ]

    # Identificación
    customer_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='NATURAL')
    customer_code = models.CharField(max_length=20, unique=True, blank=True)

    # Persona Natural
    first_name = models.CharField(max_length=100, blank=True)
    second_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    second_last_name = models.CharField(max_length=100, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=[('M', 'Masculino'), ('F', 'Femenino')], blank=True)
    marital_status = models.CharField(max_length=20, choices=MARITAL_CHOICES, blank=True)
    nationality = models.CharField(max_length=100, default='Dominicano/a', blank=True)

    # Persona Jurídica
    company_name = models.CharField(max_length=200, blank=True)
    company_type = models.CharField(max_length=100, blank=True)
    incorporation_date = models.DateField(null=True, blank=True)

    # Documento de identidad
    id_type = models.CharField(max_length=10, choices=ID_TYPE_CHOICES, default='CEDULA')
    id_number = models.CharField(max_length=20, unique=True, db_index=True)
    id_expiry_date = models.DateField(null=True, blank=True)

    # Foto del cliente
    photo = models.ImageField(upload_to='customers/photos/', null=True, blank=True,
                              validators=[validate_image_extension, validate_image_size])

    # Contacto
    phone1 = models.CharField(max_length=20)
    phone2 = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)

    # Dirección
    address = models.TextField(blank=True)
    sector = models.CharField(max_length=100, blank=True)
    municipality = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    province = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='República Dominicana')
    address_reference = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    # Información económica básica
    occupation = models.CharField(max_length=200, blank=True)
    employer = models.CharField(max_length=200, blank=True)
    employer_phone = models.CharField(max_length=20, blank=True)
    employer_address = models.TextField(blank=True)
    employment_years = models.PositiveSmallIntegerField(null=True, blank=True)
    monthly_income = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    other_income = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    monthly_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Relación con sistema
    branch = models.ForeignKey('branches.Branch', on_delete=models.PROTECT, related_name='customers')
    assigned_officer = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='assigned_customers'
    )

    # Status y riesgo
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)
    risk_level = models.CharField(max_length=10, choices=RISK_CHOICES, default='LOW')
    credit_score = models.PositiveSmallIntegerField(null=True, blank=True)
    is_blacklisted = models.BooleanField(default=False)
    blacklist_reason = models.TextField(blank=True)

    # Estadísticas (calculadas)
    total_loans_count = models.PositiveIntegerField(default=0)
    active_loans_count = models.PositiveIntegerField(default=0)
    total_paid = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    outstanding_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Notas
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['id_number']),
            models.Index(fields=['status', 'branch']),
            models.Index(fields=['customer_code']),
        ]

    def __str__(self):
        return f'{self.get_full_name()} ({self.customer_code})'

    def get_full_name(self):
        if self.customer_type == 'JURIDICA':
            return self.company_name
        parts = filter(None, [self.first_name, self.second_name, self.last_name, self.second_last_name])
        return ' '.join(parts)

    def get_payment_capacity(self):
        """Capacidad de pago = ingresos totales - gastos totales."""
        income = (self.monthly_income or 0) + (self.other_income or 0)
        expenses = self.monthly_expenses or 0
        return float(income) - float(expenses)

    def save(self, *args, **kwargs):
        if not self.customer_code:
            from apps.core.utils import generate_code
            self.customer_code = generate_code('CLI', 8, model_class=Customer, field_name='customer_code')
        super().save(*args, **kwargs)


class CustomerEmployment(models.Model):
    """Información laboral detallada del cliente."""
    CONTRACT_CHOICES = [
        ('INDEFINITE', 'Indefinido'), ('FIXED', 'Plazo Fijo'),
        ('TEMPORARY', 'Temporal'), ('PART_TIME', 'Medio Tiempo'),
    ]
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='employment')
    company = models.CharField(max_length=200, blank=True)
    position = models.CharField(max_length=200, blank=True)
    start_date = models.DateField(null=True, blank=True)
    salary = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    contract_type = models.CharField(max_length=20, choices=CONTRACT_CHOICES, blank=True)
    company_phone = models.CharField(max_length=20, blank=True)
    company_address = models.TextField(blank=True)
    supervisor_name = models.CharField(max_length=200, blank=True)
    supervisor_phone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f'Empleo de {self.customer}'


class CustomerBusiness(models.Model):
    """Negocio propio del cliente."""
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='business')
    business_name = models.CharField(max_length=200, blank=True)
    activity_type = models.CharField(max_length=200, blank=True)
    years_operating = models.PositiveSmallIntegerField(null=True, blank=True)
    monthly_income = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    monthly_expenses = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    address = models.TextField(blank=True)
    rnc = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f'Negocio de {self.customer}'


class CustomerFinancialInfo(models.Model):
    """Información financiera detallada del cliente."""
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='financial_info')
    # Ingresos
    salary_income = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    commission_income = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    business_income = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    other_income = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    # Gastos
    housing_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    food_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    transport_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    services_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    education_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    # Endeudamiento
    active_loans_debt = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    credit_card_debt = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    monthly_installments = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    @property
    def total_income(self):
        return float(self.salary_income) + float(self.commission_income) + \
               float(self.business_income) + float(self.other_income)

    @property
    def total_expenses(self):
        return float(self.housing_expenses) + float(self.food_expenses) + \
               float(self.transport_expenses) + float(self.services_expenses) + \
               float(self.education_expenses)

    @property
    def payment_capacity(self):
        return self.total_income - self.total_expenses - float(self.monthly_installments)

    def __str__(self):
        return f'Info financiera de {self.customer}'


class CustomerReference(models.Model):
    """Referencias personales del cliente."""
    RELATIONSHIP_CHOICES = [
        ('FAMILY', 'Familiar'), ('FRIEND', 'Amigo'),
        ('COLLEAGUE', 'Compañero de Trabajo'), ('NEIGHBOR', 'Vecino'), ('OTHER', 'Otro')
    ]
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='references')
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    relationship = models.CharField(max_length=20, choices=RELATIONSHIP_CHOICES)
    address = models.TextField(blank=True)
    occupation = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f'{self.name} - {self.get_relationship_display()}'


class CustomerCommercialReference(models.Model):
    """Referencias comerciales del cliente."""
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='commercial_references')
    company = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    relationship_years = models.PositiveSmallIntegerField(null=True, blank=True)

    def __str__(self):
        return f'{self.company} - {self.customer}'


class CustomerBankReference(models.Model):
    """Referencias bancarias del cliente."""
    ACCOUNT_CHOICES = [
        ('SAVINGS', 'Ahorros'), ('CHECKING', 'Corriente'), ('CREDIT', 'Crédito'), ('OTHER', 'Otro')
    ]
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='bank_references')
    bank_name = models.CharField(max_length=200)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_CHOICES)
    account_number = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f'{self.bank_name} - {self.customer}'


class CustomerGuarantor(models.Model):
    """Avales y codeudores del cliente."""
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='guarantors')
    name = models.CharField(max_length=200)
    id_number = models.CharField(max_length=20)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    occupation = models.CharField(max_length=200, blank=True)
    employer = models.CharField(max_length=200, blank=True)
    monthly_income = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f'Aval: {self.name} → {self.customer}'


class CustomerActivity(models.Model):
    """Registro de actividades: llamadas, visitas, reuniones, notas."""
    TYPE_CHOICES = [
        ('CALL', 'Llamada'), ('VISIT', 'Visita'),
        ('MEETING', 'Reunión'), ('NOTE', 'Nota Interna'), ('ALERT', 'Alerta'),
    ]
    RESULT_CHOICES = [
        ('POSITIVE', 'Positivo'), ('NEGATIVE', 'Negativo'),
        ('PENDING', 'Pendiente'), ('NO_ANSWER', 'Sin respuesta'),
    ]
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    date = models.DateTimeField()
    result = models.CharField(max_length=20, choices=RESULT_CHOICES, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'{self.get_activity_type_display()} - {self.customer}'


class CustomerCreditEvaluation(models.Model):
    """Evaluación crediticia con score automático."""
    RATING_CHOICES = [
        ('EXCELLENT', 'Excelente'), ('GOOD', 'Bueno'),
        ('REGULAR', 'Regular'), ('RISKY', 'Riesgoso'),
    ]
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='credit_evaluations')
    score = models.PositiveSmallIntegerField(default=0)
    rating = models.CharField(max_length=20, choices=RATING_CHOICES, blank=True)
    # Factores del score
    age_score = models.SmallIntegerField(default=0)
    income_score = models.SmallIntegerField(default=0)
    employment_score = models.SmallIntegerField(default=0)
    payment_history_score = models.SmallIntegerField(default=0)
    debt_score = models.SmallIntegerField(default=0)
    guarantees_score = models.SmallIntegerField(default=0)
    # Resultado
    recommended_max_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    risk_factors = models.JSONField(default=list, blank=True)
    ai_summary = models.TextField(blank=True)
    evaluated_at = models.DateTimeField(auto_now_add=True)
    evaluated_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='+'
    )

    class Meta:
        ordering = ['-evaluated_at']

    def __str__(self):
        return f'Evaluación {self.score} - {self.customer}'


class CustomerDocument(models.Model):
    """Documentos del expediente del cliente."""
    DOC_TYPE_CHOICES = [
        ('CEDULA_FRONT', 'Cédula (Frente)'), ('CEDULA_BACK', 'Cédula (Reverso)'),
        ('PASSPORT', 'Pasaporte'), ('RNC', 'RNC'),
        ('INCOME_PROOF', 'Comprobante de Ingresos'), ('BANK_STATEMENT', 'Estado de Cuenta'),
        ('ADDRESS_PROOF', 'Comprobante de Domicilio'), ('LABOR_CERT', 'Certificación Laboral'),
        ('SALARY_CERT', 'Certificación Salarial'), ('TAX_RETURN', 'Declaración de Impuestos'),
        ('VEHICLE_TITLE', 'Título de Vehículo'), ('PROPERTY_TITLE', 'Título de Propiedad'),
        ('PHOTO', 'Fotografía'), ('SIGNED_FORM', 'Formulario Firmado'), ('OTHER', 'Otro'),
    ]
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=30, choices=DOC_TYPE_CHOICES)
    file = models.FileField(upload_to='customers/documents/%Y/%m/',
                            validators=[validate_file_extension, validate_file_size])
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.get_document_type_display()} - {self.customer}'


class CustomerFinancialSummary(models.Model):
    """Resumen financiero calculado del cliente."""
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name='financial_summary')
    total_disbursed = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_paid = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    outstanding_principal = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    outstanding_interest = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    outstanding_late_fees = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    active_loans = models.PositiveSmallIntegerField(default=0)
    completed_loans = models.PositiveSmallIntegerField(default=0)
    defaulted_loans = models.PositiveSmallIntegerField(default=0)
    payment_on_time_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    max_days_past_due = models.PositiveSmallIntegerField(default=0)
    total_late_count = models.PositiveSmallIntegerField(default=0)
    next_payment_date = models.DateField(null=True, blank=True)
    next_payment_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Resumen financiero - {self.customer}'
