"""
Tests para utilidades core: generación de códigos, amortización, permisos.
Ejecutar: python manage.py test apps.core --verbosity=2
"""
from decimal import Decimal
from datetime import date
from django.test import TestCase
from apps.core.utils import (
    generate_code, calculate_amortization_schedule,
    format_currency, calculate_age, get_frequency_display,
)


class GenerateCodeTests(TestCase):
    """Tests de generación de códigos únicos."""

    def test_basic_generation(self):
        code = generate_code('CLI')
        self.assertTrue(code.startswith('CLI-'))
        self.assertEqual(len(code), 12)  # CLI- + 8 digits

    def test_custom_length(self):
        code = generate_code('LN', length=6)
        self.assertTrue(code.startswith('LN-'))
        self.assertEqual(len(code), 9)  # LN- + 6 digits

    def test_uniqueness(self):
        codes = {generate_code('T') for _ in range(100)}
        self.assertGreater(len(codes), 90)  # Al menos 90% únicos


class AmortizationTests(TestCase):
    """Tests del cálculo de amortización."""

    def test_nivelada_simple_basic(self):
        """Cuota nivelada con interés simple: 100k a 24% anual, 12 meses."""
        schedule = calculate_amortization_schedule(
            principal=Decimal('100000'),
            annual_rate=Decimal('24'),
            term_months=12,
            payment_method='NIVELADA',
            start_date=date(2025, 1, 1),
            payment_frequency='MONTHLY',
            interest_type='SIMPLE',
        )
        self.assertEqual(len(schedule), 12)
        # Último saldo debe ser 0
        self.assertEqual(schedule[-1]['balance'], Decimal('0'))
        # Todas las cuotas deben ser positivas
        for row in schedule:
            self.assertGreater(row['total_amount'], 0)
            self.assertGreater(row['principal_amount'], 0)
            self.assertGreaterEqual(row['interest_amount'], 0)

    def test_nivelada_compound_basic(self):
        """Cuota nivelada con interés compuesto."""
        schedule = calculate_amortization_schedule(
            principal=Decimal('100000'),
            annual_rate=Decimal('24'),
            term_months=12,
            payment_method='NIVELADA',
            start_date=date(2025, 1, 1),
            payment_frequency='MONTHLY',
            interest_type='COMPOUND',
        )
        self.assertEqual(len(schedule), 12)
        self.assertEqual(schedule[-1]['balance'], Decimal('0'))

    def test_decreciente(self):
        """Capital constante (decreciente)."""
        schedule = calculate_amortization_schedule(
            principal=Decimal('120000'),
            annual_rate=Decimal('18'),
            term_months=12,
            payment_method='DECRECIENTE',
            start_date=date(2025, 1, 1),
        )
        self.assertEqual(len(schedule), 12)
        self.assertEqual(schedule[-1]['balance'], Decimal('0'))
        # Primera cuota mayor que la última
        self.assertGreater(schedule[0]['total_amount'], schedule[-1]['total_amount'])

    def test_zero_rate(self):
        """Interés 0%: cuota = capital / períodos."""
        schedule = calculate_amortization_schedule(
            principal=Decimal('12000'),
            annual_rate=Decimal('0'),
            term_months=12,
        )
        self.assertEqual(len(schedule), 12)
        self.assertEqual(schedule[0]['total_amount'], Decimal('1000'))
        self.assertEqual(schedule[-1]['balance'], Decimal('0'))

    def test_weekly_frequency(self):
        """Frecuencia semanal: 12 meses = ~52 cuotas."""
        schedule = calculate_amortization_schedule(
            principal=Decimal('50000'),
            annual_rate=Decimal('24'),
            term_months=12,
            payment_frequency='WEEKLY',
        )
        self.assertEqual(len(schedule), 52)
        self.assertEqual(schedule[-1]['balance'], Decimal('0'))

    def test_biweekly_frequency(self):
        """Frecuencia quincenal: 12 meses = 26 cuotas."""
        schedule = calculate_amortization_schedule(
            principal=Decimal('50000'),
            annual_rate=Decimal('24'),
            term_months=12,
            payment_frequency='BIWEEKLY',
        )
        self.assertEqual(len(schedule), 26)
        self.assertEqual(schedule[-1]['balance'], Decimal('0'))

    def test_simple_interest_total(self):
        """Interés simple: total interés = P * r * n."""
        schedule = calculate_amortization_schedule(
            principal=Decimal('100000'),
            annual_rate=Decimal('24'),
            term_months=12,
            interest_type='SIMPLE',
        )
        total_interest = sum(row['interest_amount'] for row in schedule)
        # 100k * 24%/12 * 12 = 24,000
        self.assertAlmostEqual(float(total_interest), 24000.0, delta=100)


class UtilityTests(TestCase):
    """Tests de utilidades menores."""

    def test_format_currency(self):
        self.assertEqual(format_currency(Decimal('1500.50')), 'RD$ 1,500.50')

    def test_calculate_age(self):
        # Persona nacida hace ~30 años
        age = calculate_age(date(1995, 1, 1))
        self.assertGreaterEqual(age, 29)
        self.assertLessEqual(age, 32)

    def test_frequency_display(self):
        self.assertEqual(get_frequency_display('MONTHLY'), 'Mensual')
        self.assertEqual(get_frequency_display('WEEKLY'), 'Semanal')
        self.assertEqual(get_frequency_display('UNKNOWN'), 'Mensual')


class HealthCheckTests(TestCase):
    """Test del endpoint health check."""

    def test_health_check(self):
        from django.test import Client
        client = Client()
        res = client.get('/api/v1/health/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {'status': 'ok'})
