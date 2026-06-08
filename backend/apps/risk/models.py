"""Motor de riesgo crediticio y scoring."""
from django.db import models
from apps.core.models import TimeStampedModel


class CreditScoringRule(TimeStampedModel):
    FIELD_CHOICES = [
        ('monthly_income', 'Ingresos Mensuales'),
        ('employment_years', 'Antigüedad Laboral'),
        ('debt_to_income_ratio', 'Relación Deuda/Ingreso'),
        ('active_loans_count', 'Préstamos Activos'),
        ('payment_on_time_rate', 'Tasa de Pago a Tiempo'),
        ('max_days_past_due', 'Máximo Días en Mora'),
        ('completed_loans', 'Préstamos Completados'),
    ]
    CONDITION_CHOICES = [
        ('gt', 'Mayor que'), ('gte', 'Mayor o igual que'),
        ('lt', 'Menor que'), ('lte', 'Menor o igual que'),
        ('eq', 'Igual a'), ('between', 'Entre'),
    ]

    name = models.CharField(max_length=200)
    field = models.CharField(max_length=50, choices=FIELD_CHOICES)
    condition = models.CharField(max_length=10, choices=CONDITION_CHOICES)
    value_min = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    value_max = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    score_points = models.SmallIntegerField(help_text='Positivo suma, negativo resta')
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=1.0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Regla de Scoring'
        verbose_name_plural = 'Reglas de Scoring'

    def __str__(self):
        return self.name


class RiskLevel(models.Model):
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=10, unique=True)
    min_score = models.PositiveSmallIntegerField()
    max_score = models.PositiveSmallIntegerField()
    color = models.CharField(max_length=7, default='#000000')
    max_loan_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    max_term_months = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['min_score']

    def __str__(self):
        return f'{self.code}: {self.min_score}-{self.max_score}'


class CreditEvaluation(TimeStampedModel):
    customer = models.ForeignKey('customers.Customer', on_delete=models.PROTECT, related_name='credit_evaluations')
    application = models.ForeignKey(
        'loan_applications.LoanApplication', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='credit_evaluation'
    )
    total_score = models.PositiveSmallIntegerField()
    risk_level = models.CharField(max_length=10)
    risk_level_obj = models.ForeignKey(RiskLevel, null=True, on_delete=models.SET_NULL)
    evaluation_details = models.JSONField(default=dict)
    recommendation = models.TextField(blank=True)
    evaluated_by = models.CharField(max_length=50, default='SYSTEM')
    evaluator_user = models.ForeignKey(
        'users.User', null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        verbose_name = 'Evaluación Crediticia'
        verbose_name_plural = 'Evaluaciones Crediticias'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.customer} - Score: {self.total_score} ({self.risk_level})'


class Blacklist(TimeStampedModel):
    id_number = models.CharField(max_length=20, unique=True, db_index=True)
    full_name = models.CharField(max_length=200)
    reason = models.TextField()
    source = models.CharField(max_length=100, blank=True)
    added_by = models.ForeignKey('users.User', on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Lista Negra'

    def __str__(self):
        return f'{self.id_number} - {self.full_name}'
