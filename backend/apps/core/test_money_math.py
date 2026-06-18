"""Pruebas de los cálculos críticos de dinero.

Estas pruebas protegen contra regresiones en las rutas que multiplicadas por
muchos clientes representarían dinero real mal calculado: amortización (cuota
nivelada, decreciente, simple/compuesto, frecuencias), aplicación de pagos y
saldos.

Ejecutar:  python manage.py test apps.core.test_money_math
"""
from decimal import Decimal
from datetime import date

from django.test import SimpleTestCase

from apps.core.utils import calculate_amortization_schedule


# Tolerancia de 1 centavo para aritmética con Decimal redondeado a 2 dp
CENT = Decimal('0.01')


class AmortizationNiveladaSimpleTest(SimpleTestCase):
    """Cuota nivelada con interés simple (modo por defecto, el más usado)."""

    def test_zero_rate_splits_principal_evenly(self):
        sched = calculate_amortization_schedule(
            principal=Decimal('12000'), annual_rate=Decimal('0'),
            term_months=12, payment_method='NIVELADA',
            start_date=date(2026, 1, 1), interest_type='SIMPLE',
        )
        self.assertEqual(len(sched), 12)
        for row in sched:
            self.assertEqual(row['principal_amount'], Decimal('1000.00'))
            self.assertEqual(row['interest_amount'], Decimal('0.00'))
            self.assertEqual(row['total_amount'], Decimal('1000.00'))
        self.assertEqual(sum(r['principal_amount'] for r in sched), Decimal('12000.00'))

    def test_24pct_monthly_12m_levels_payment(self):
        """24% anual / 12 meses → interés simple = 2% mensual constante."""
        sched = calculate_amortization_schedule(
            principal=Decimal('12000'), annual_rate=Decimal('24'),
            term_months=12, payment_method='NIVELADA',
            start_date=date(2026, 1, 1), interest_type='SIMPLE',
        )
        # Cuota = (12000 + 12000*0.02*12) / 12 = (12000 + 2880) / 12 = 1240
        for row in sched:
            self.assertEqual(row['total_amount'], Decimal('1240.00'))
            self.assertEqual(row['interest_amount'], Decimal('240.00'))
            self.assertEqual(row['principal_amount'], Decimal('1000.00'))

    def test_totals_match_principal_and_interest(self):
        """La suma de capital == principal y la suma de intereses == interés total."""
        sched = calculate_amortization_schedule(
            principal=Decimal('50000'), annual_rate=Decimal('36'),
            term_months=24, payment_method='NIVELADA',
            interest_type='SIMPLE',
        )
        sum_principal = sum(r['principal_amount'] for r in sched)
        sum_interest = sum(r['interest_amount'] for r in sched)
        sum_total = sum(r['total_amount'] for r in sched)

        # Tolerar diferencia de centavos por redondeo de cuotas
        self.assertLessEqual(abs(sum_principal - Decimal('50000')), CENT * 24)
        self.assertEqual(sum_total, sum_principal + sum_interest)

    def test_due_dates_are_monthly(self):
        sched = calculate_amortization_schedule(
            principal=Decimal('10000'), annual_rate=Decimal('12'),
            term_months=3, start_date=date(2026, 1, 15),
        )
        self.assertEqual([r['due_date'] for r in sched], [
            date(2026, 2, 15), date(2026, 3, 15), date(2026, 4, 15)
        ])


class AmortizationNiveladaCompuestoTest(SimpleTestCase):
    """Cuota nivelada con interés compuesto (sistema francés clásico)."""

    def test_french_system_24pct_12m(self):
        sched = calculate_amortization_schedule(
            principal=Decimal('12000'), annual_rate=Decimal('24'),
            term_months=12, payment_method='NIVELADA',
            interest_type='COMPOUND',
        )
        # Sistema francés: cuota = P * r(1+r)^n / ((1+r)^n - 1)
        # P=12000, r=0.02, n=12 → cuota ≈ 1134.00
        self.assertAlmostEqual(float(sched[0]['total_amount']), 1134.00, delta=1.0)
        self.assertEqual(len(sched), 12)

        # En el sistema francés, el interés decrece y el capital crece cuota a cuota
        intereses = [r['interest_amount'] for r in sched]
        capitales = [r['principal_amount'] for r in sched]
        for i in range(len(intereses) - 1):
            self.assertGreater(intereses[i], intereses[i + 1],
                               f"Interés debe decrecer (cuota {i+1} vs {i+2})")
            self.assertLess(capitales[i], capitales[i + 1],
                            f"Capital debe crecer (cuota {i+1} vs {i+2})")


class AmortizationDecrecienteTest(SimpleTestCase):
    """Cuota decreciente (capital constante, interés baja con el saldo)."""

    def test_decreasing_payment_constant_principal(self):
        sched = calculate_amortization_schedule(
            principal=Decimal('12000'), annual_rate=Decimal('24'),
            term_months=12, payment_method='DECRECIENTE',
        )
        # Capital constante = 12000/12 = 1000
        for row in sched:
            self.assertEqual(row['principal_amount'], Decimal('1000.00'))
        # Cuotas decrecen porque el interés baja con el saldo
        cuotas = [r['total_amount'] for r in sched]
        for i in range(len(cuotas) - 1):
            self.assertGreater(cuotas[i], cuotas[i + 1])


class AmortizationFrequencyTest(SimpleTestCase):
    """Frecuencias semanal / quincenal / mensual: el número de cuotas cambia."""

    def test_monthly_frequency_creates_one_row_per_month(self):
        sched = calculate_amortization_schedule(
            principal=Decimal('12000'), annual_rate=Decimal('12'),
            term_months=12, payment_frequency='MONTHLY',
        )
        self.assertEqual(len(sched), 12)

    def test_biweekly_frequency_creates_more_rows(self):
        sched = calculate_amortization_schedule(
            principal=Decimal('12000'), annual_rate=Decimal('12'),
            term_months=12, payment_frequency='BIWEEKLY',
        )
        # 12 meses ≈ 26 quincenas (26 períodos al año)
        self.assertEqual(len(sched), 26)


class BalanceProgressionTest(SimpleTestCase):
    """El saldo final de la última cuota debe llegar a 0 (o muy cerca)."""

    def test_final_balance_reaches_zero_simple(self):
        sched = calculate_amortization_schedule(
            principal=Decimal('25000'), annual_rate=Decimal('24'),
            term_months=18, interest_type='SIMPLE',
        )
        final_balance = sched[-1]['balance']
        self.assertLessEqual(abs(final_balance), CENT * 24,
                             f"Saldo final debería ser 0, fue {final_balance}")

    def test_final_balance_reaches_zero_compound(self):
        sched = calculate_amortization_schedule(
            principal=Decimal('25000'), annual_rate=Decimal('24'),
            term_months=18, interest_type='COMPOUND',
        )
        final_balance = sched[-1]['balance']
        self.assertLessEqual(abs(final_balance), CENT * 24,
                             f"Saldo final debería ser 0, fue {final_balance}")
