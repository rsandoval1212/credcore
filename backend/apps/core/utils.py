"""Utilidades generales del sistema CredCore."""
import random
import string
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta


def generate_code(prefix: str, length: int = 8, model_class=None, field_name='customer_code') -> str:
    """Genera un código único con prefijo. Verifica unicidad si se pasa model_class.
    FIX #10: Previene códigos duplicados verificando contra la BD.
    FIX #W9: Usa select_for_update-safe check + retry para atomicidad bajo concurrencia."""
    from django.db import transaction, IntegrityError
    for _ in range(20):  # Máximo 20 intentos
        digits = ''.join(random.choices(string.digits, k=length))
        code = f"{prefix}-{digits}"
        if model_class is None:
            return code
        # Verificación atómica: check + catch IntegrityError en el caller
        with transaction.atomic():
            if not model_class.objects.filter(**{field_name: code}).exists():
                return code
    # Fallback con timestamp + random si todos colisionan
    import time
    return f"{prefix}-{int(time.time())}-{''.join(random.choices(string.digits, k=4))}"


# ── Frecuencias de pago ───────────────────────────────────────────────────────
FREQUENCY_CONFIG = {
    'DAILY':    {'periods_per_year': 365, 'delta': timedelta(days=1)},
    'WEEKLY':   {'periods_per_year': 52,  'delta': timedelta(weeks=1)},
    'BIWEEKLY': {'periods_per_year': 26,  'delta': timedelta(weeks=2)},
    'MONTHLY':  {'periods_per_year': 12,  'delta': None},   # usa relativedelta
}


def _next_due_date(current: date, frequency: str, step: int) -> date:
    """Calcula la fecha del siguiente vencimiento según la frecuencia."""
    if frequency == 'DAILY':
        return current + timedelta(days=step)
    elif frequency == 'WEEKLY':
        return current + timedelta(weeks=step)
    elif frequency == 'BIWEEKLY':
        return current + timedelta(weeks=step * 2)
    else:  # MONTHLY (default)
        return current + relativedelta(months=step)


def _periods_to_months(term_periods: int, frequency: str) -> Decimal:
    """Convierte períodos a meses equivalentes para cálculo de interés."""
    config = FREQUENCY_CONFIG.get(frequency, FREQUENCY_CONFIG['MONTHLY'])
    return Decimal(str(term_periods)) / Decimal(str(config['periods_per_year'])) * 12


def _period_rate(annual_rate: Decimal, frequency: str) -> Decimal:
    """Convierte tasa anual a tasa por período según la frecuencia."""
    config = FREQUENCY_CONFIG.get(frequency, FREQUENCY_CONFIG['MONTHLY'])
    periods = Decimal(str(config['periods_per_year']))
    return annual_rate / Decimal('100') / periods


def calculate_amortization_schedule(
    principal: Decimal,
    annual_rate: Decimal,
    term_months: int,
    payment_method: str = 'NIVELADA',
    start_date: date = None,
    payment_frequency: str = 'MONTHLY',
    interest_type: str = 'SIMPLE',
    total_periods_override: int = None,
) -> list[dict]:
    """
    Calcula la tabla de amortización con soporte de frecuencias.

    Args:
        principal:         Monto del préstamo
        annual_rate:       Tasa anual en % (ej: 24 para 24%)
        term_months:       Plazo en MESES (siempre en meses independiente de la frecuencia)
        payment_method:    NIVELADA | DECRECIENTE
        start_date:        Fecha del primer pago
        payment_frequency: DAILY | WEEKLY | BIWEEKLY | MONTHLY
        interest_type:     SIMPLE | COMPOUND
        total_periods_override: Número exacto de cuotas (evita redondeo)
    """
    if start_date is None:
        start_date = date.today()

    config = FREQUENCY_CONFIG.get(payment_frequency, FREQUENCY_CONFIG['MONTHLY'])
    periods_per_year = Decimal(str(config['periods_per_year']))

    if total_periods_override:
        total_periods = total_periods_override
    else:
        months_decimal = Decimal(str(term_months))
        total_periods  = int((months_decimal / 12 * periods_per_year).to_integral_value(ROUND_HALF_UP))
    if total_periods < 1:
        total_periods = 1

    # Tasa por período
    period_rate = annual_rate / Decimal('100') / periods_per_year

    schedule = []

    if payment_method == 'NIVELADA':
        # Cuota fija
        if period_rate == 0:
            payment = principal / Decimal(str(total_periods))
        elif interest_type == 'COMPOUND':
            # Sistema francés clásico (interés compuesto sobre saldo)
            r = period_rate
            n = total_periods
            payment = principal * (r * (1 + r) ** n) / ((1 + r) ** n - 1)
        else:
            # Interés simple flat: interés total = principal * rate * n períodos
            # La cuota es (capital + interés total) / n
            total_interest = principal * period_rate * Decimal(str(total_periods))
            payment = (principal + total_interest) / Decimal(str(total_periods))

        balance = principal
        for i in range(1, total_periods + 1):
            if interest_type == 'COMPOUND':
                interest = balance * period_rate
            else:
                # Interés simple flat: misma cuota de interés cada período
                interest = principal * period_rate

            principal_pmt = payment - interest
            if i == total_periods:
                # Última cuota: liquidar saldo exacto para evitar centavos residuales
                principal_pmt = balance
                interest = principal * period_rate if interest_type != 'COMPOUND' else balance * period_rate
            balance = max(Decimal('0'), balance - principal_pmt)
            due_date = _next_due_date(start_date, payment_frequency, i)

            schedule.append({
                'installment_number': i,
                'due_date': due_date,
                'principal_amount': round(principal_pmt, 2),
                'interest_amount':  round(interest, 2),
                'total_amount':     round(principal_pmt + interest, 2),
                'balance':          round(balance, 2),
            })

    elif payment_method == 'DECRECIENTE':
        # Capital constante
        principal_pmt = principal / Decimal(str(total_periods))
        balance = principal
        for i in range(1, total_periods + 1):
            if interest_type == 'COMPOUND':
                interest = balance * period_rate
            else:
                interest = principal * period_rate * (1 - Decimal(str(i - 1)) / Decimal(str(total_periods)))
            if i == total_periods:
                principal_pmt = balance
            balance = max(Decimal('0'), balance - principal_pmt)
            due_date = _next_due_date(start_date, payment_frequency, i)
            schedule.append({
                'installment_number': i,
                'due_date': due_date,
                'principal_amount': round(principal_pmt, 2),
                'interest_amount':  round(interest, 2),
                'total_amount':     round(principal_pmt + interest, 2),
                'balance':          round(balance, 2),
            })

    return schedule


def calculate_confidential_schedule(
    principal: Decimal,
    total_to_receive: Decimal,
    days: int,
    start_date: date = None,
) -> list[dict]:
    """Préstamo confidencial: una sola cuota al vencimiento."""
    if start_date is None:
        start_date = date.today()
    profit = total_to_receive - principal
    due_date = start_date + timedelta(days=days)
    return [{
        'installment_number': 1,
        'due_date': due_date,
        'principal_amount': round(principal, 2),
        'interest_amount': round(profit, 2),
        'total_amount': round(total_to_receive, 2),
        'balance': Decimal('0'),
    }]


def calculate_weekly_flat_schedule(
    principal: Decimal,
    total_installments: int,
    client_installments: int,
    start_date: date = None,
) -> list[dict]:
    """
    Modalidad semanal flat: cuota = capital / cuotas_cliente.
    El cliente paga total_installments cuotas; la diferencia es ganancia del prestamista.
    Ej: 13 semanas, 10 del cliente → cuota = monto/10, paga 13 cuotas.
    """
    if start_date is None:
        start_date = date.today()

    cuota = (principal / Decimal(str(client_installments))).quantize(Decimal('0.01'), ROUND_HALF_UP)
    total_to_pay = cuota * total_installments
    interest_total = total_to_pay - principal
    interest_per = (interest_total / Decimal(str(total_installments))).quantize(Decimal('0.01'), ROUND_HALF_UP)
    principal_per = (principal / Decimal(str(total_installments))).quantize(Decimal('0.01'), ROUND_HALF_UP)

    schedule = []
    balance = principal
    for i in range(1, total_installments + 1):
        p = principal_per if i < total_installments else balance
        balance = max(Decimal('0'), balance - p)
        due_date = start_date + timedelta(weeks=i)
        schedule.append({
            'installment_number': i,
            'due_date': due_date,
            'principal_amount': round(p, 2),
            'interest_amount': round(interest_per, 2),
            'total_amount': round(cuota, 2),
            'balance': round(balance, 2),
        })
    return schedule


def format_currency(amount: Decimal, currency: str = 'DOP', symbol: str = 'RD$') -> str:
    return f"{symbol} {amount:,.2f}"


def calculate_age(birth_date: date) -> int:
    today = date.today()
    return today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )


def get_frequency_display(frequency: str) -> str:
    return {
        'DAILY':    'Diario',
        'WEEKLY':   'Semanal',
        'BIWEEKLY': 'Quincenal',
        'MONTHLY':  'Mensual',
        'CUSTOM':   'Personalizado',
    }.get(frequency, 'Mensual')
