"""
Pruebas unitarias de las funciones de cálculo de préstamos.
Estas son rápidas (sin DB) y aseguran que la lógica financiera nunca regrese.
"""
import pytest
from decimal import Decimal


class TestHealthScore:
    """calc_health_score en loans/serializers.py"""

    def test_loan_at_day_returns_green(self):
        from apps.loans.serializers import calc_health_score

        class FakeLoan:
            status = 'ACTIVE'
            days_past_due = 0
            total_installments = 12
            installments_paid = 6

        result = calc_health_score(FakeLoan())
        assert result['color'] == 'green'
        assert result['score'] >= 90

    def test_loan_15_days_late_returns_yellow(self):
        from apps.loans.serializers import calc_health_score

        class FakeLoan:
            status = 'ACTIVE'
            days_past_due = 15
            total_installments = 12
            installments_paid = 6

        result = calc_health_score(FakeLoan())
        assert result['color'] == 'yellow'

    def test_loan_45_days_late_returns_red(self):
        from apps.loans.serializers import calc_health_score

        class FakeLoan:
            status = 'ACTIVE'
            days_past_due = 45
            total_installments = 12
            installments_paid = 6

        result = calc_health_score(FakeLoan())
        assert result['color'] == 'red'

    def test_defaulted_loan_always_red(self):
        from apps.loans.serializers import calc_health_score

        class FakeLoan:
            status = 'DEFAULTED'
            days_past_due = 0
            total_installments = 12
            installments_paid = 6

        result = calc_health_score(FakeLoan())
        assert result['color'] == 'red'

    def test_early_loan_yellow(self):
        """Préstamo con muy pocas cuotas pagadas debe ser amarillo."""
        from apps.loans.serializers import calc_health_score

        class FakeLoan:
            status = 'ACTIVE'
            days_past_due = 0
            total_installments = 12
            installments_paid = 1

        result = calc_health_score(FakeLoan())
        assert result['color'] == 'yellow'


class TestUtils:
    """Helpers de apps.core.utils"""

    @pytest.mark.django_db
    def test_generate_code_format(self):
        from apps.core.utils import generate_code
        from apps.customers.models import Customer
        code = generate_code('TST', 6, model_class=Customer, field_name='customer_code')
        assert code.startswith('TST')
        # Formato observado: TST-NNNNNN (con guion separador)
        assert len(code) >= 9
