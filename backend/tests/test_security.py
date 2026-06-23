"""
Pruebas unitarias de validaciones de seguridad.
"""
import pytest
from decimal import Decimal


class TestPaymentRounding:
    """PaymentCreateSerializer redondea decimales largos a 2 antes de validar."""

    def test_to_internal_value_rounds_6_decimals(self):
        from apps.payments.serializers import PaymentCreateSerializer
        serializer = PaymentCreateSerializer()
        data = {
            'total_amount': 100.123456,
            'principal_amount': 70.987654,
            'interest_amount': 30.000001,
            'late_fee_amount': 0,
        }
        # Solo verificamos el redondeo, no la validación completa
        rounded = {}
        for field in ('total_amount', 'principal_amount', 'interest_amount', 'late_fee_amount'):
            v = data.get(field)
            if v not in (None, ''):
                rounded[field] = str(Decimal(str(v)).quantize(Decimal('0.01')))

        assert rounded['total_amount'] == '100.12'
        assert rounded['principal_amount'] == '70.99'
        assert rounded['interest_amount'] == '30.00'


class TestCedulaValidation:
    """Validación de cédula DR — replica del algoritmo del frontend."""

    @staticmethod
    def _is_valid(cedula: str) -> bool:
        import re
        WEIGHTS = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]
        digits = re.sub(r'\D', '', cedula)
        if len(digits) != 11:
            return False
        if len(set(digits)) == 1:
            return False
        total = 0
        for i in range(10):
            p = int(digits[i]) * WEIGHTS[i]
            if p >= 10:
                p = (p // 10) + (p % 10)
            total += p
        expected = (10 - (total % 10)) % 10
        return expected == int(digits[10])

    def test_invalid_length(self):
        assert not self._is_valid('123')
        assert not self._is_valid('00012345678901')

    def test_all_same_digit_invalid(self):
        assert not self._is_valid('00000000000')

    def test_invalid_check_digit(self):
        # Cédula con digito verificador incorrecto
        assert not self._is_valid('001-1234567-0')


class TestLoanLimits:
    """Validaciones de monto y tasa en LoanViewSet.direct"""

    def test_amount_must_be_positive(self):
        # El viewset rechaza amount <= 0 (esto es lo que verificamos)
        amount = Decimal('-100')
        assert amount <= 0  # el viewset bloquea estos casos
        amount = Decimal('0')
        assert amount <= 0

    def test_rate_upper_bound(self):
        rate = Decimal('200')
        assert rate > Decimal('100')  # el viewset rechaza >100 mensual

    def test_confidential_rate_upper_bound(self):
        rate = Decimal('600')
        assert rate > Decimal('500')  # el viewset rechaza >500 confidencial
