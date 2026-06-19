"""Importación masiva de datos desde un archivo JSON empaquetado.

El JSON tiene la forma:
{
  "meta": { "source": "...", "generated_at": "...", "version": 1 },
  "customers": [ {first_name, last_name, id_number, phone1, ...}, ... ],
  "loans":     [ {customer_id_number, amount, term_months, monthly_payment,
                  loan_date, paid_installments, ...}, ... ],
  "payments":  [ {loan_reference, total_amount, payment_date, ...}, ... ],
  "guarantees":[ {customer_id_number, type, description, value, ...}, ... ],
}

Idempotente: usa id_number para Customer; (customer, amount, disbursement_date)
para Loan. Cada fila va en su propio savepoint; un error no aborta el batch.
"""
import json
import secrets
from datetime import date, timedelta
from decimal import Decimal

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.response import Response
from django.db import transaction


def _gen_code(prefix: str, model_cls, field: str = 'customer_code'):
    while True:
        code = prefix + ''.join(secrets.choice('0123456789') for _ in range(8))
        if not model_cls.objects.filter(**{field: code}).exists():
            return code


def _decimal(v, default=Decimal('0')):
    try:
        return Decimal(str(v)).quantize(Decimal('0.01'))
    except Exception:
        return default


def _parse_date(s):
    if not s:
        return None
    if isinstance(s, date):
        return s
    try:
        return date.fromisoformat(str(s)[:10])
    except Exception:
        return None


class BulkSyncPreviewView(APIView):
    """Devuelve un preview de qué se importaría sin tocar la BD."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, JSONParser]

    def post(self, request):
        if not (request.user.is_superuser or request.user.is_staff):
            return Response({'detail': 'Solo administradores.'}, status=403)

        data = self._read_payload(request)
        if isinstance(data, Response):
            return data

        from apps.customers.models import Customer
        from apps.loans.models import Loan

        customers = data.get('customers') or []
        loans = data.get('loans') or []
        payments = data.get('payments') or []
        guarantees = data.get('guarantees') or []

        existing_cedulas = set(Customer.objects.values_list('id_number', flat=True))

        new_customers = sum(1 for c in customers if c.get('id_number') and c['id_number'] not in existing_cedulas)
        dup_customers = len(customers) - new_customers

        return Response({
            'meta': data.get('meta') or {},
            'customers': {'total': len(customers), 'new': new_customers, 'duplicated': dup_customers},
            'loans': {'total': len(loans)},
            'payments': {'total': len(payments)},
            'guarantees': {'total': len(guarantees)},
        })

    def _read_payload(self, request):
        file = request.FILES.get('file')
        if file:
            try:
                content = file.read().decode('utf-8')
                return json.loads(content)
            except Exception as e:
                return Response({'detail': f'JSON inválido: {e}'}, status=400)
        if isinstance(request.data, dict):
            return request.data
        return Response({'detail': 'Sin archivo ni payload JSON válido.'}, status=400)


class BulkSyncImportView(APIView):
    """Aplica el JSON a la base de datos. Idempotente."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, JSONParser]

    def post(self, request):
        if not (request.user.is_superuser or request.user.is_staff):
            return Response({'detail': 'Solo administradores.'}, status=403)

        data = self._read_payload(request)
        if isinstance(data, Response):
            return data

        from apps.customers.models import Customer
        from apps.loans.models import Loan, LoanSchedule
        from apps.payments.models import Payment
        from apps.guarantees.models import Guarantee
        from apps.branches.models import Branch
        from apps.loan_products.models import LoanProduct

        branch = Branch.objects.filter(is_main=True).first() or Branch.objects.first()
        if not branch:
            return Response({'detail': 'No hay sucursal principal configurada.'}, status=400)
        product = LoanProduct.objects.filter(is_active=True).first()
        if not product:
            return Response({'detail': 'No hay producto de préstamo activo.'}, status=400)

        counters = {'customers': 0, 'loans': 0, 'payments': 0, 'guarantees': 0,
                    'skipped_customers': 0, 'skipped_loans': 0, 'skipped_payments': 0,
                    'errors': 0}
        error_msgs = []

        # 1) Customers
        cedula_to_customer = {}
        for row in (data.get('customers') or []):
            try:
                with transaction.atomic():
                    cedula = (row.get('id_number') or '').strip()
                    if not cedula:
                        continue
                    cust = Customer.objects.filter(id_number=cedula).first()
                    if cust:
                        counters['skipped_customers'] += 1
                    else:
                        cust = Customer.objects.create(
                            customer_code=_gen_code('CLI', Customer),
                            first_name=(row.get('first_name') or 'Cliente')[:50],
                            last_name=(row.get('last_name') or 'Sin Apellido')[:50],
                            id_number=cedula,
                            id_type=row.get('id_type') or 'CEDULA',
                            phone1=(row.get('phone1') or '')[:20],
                            phone2=(row.get('phone2') or '')[:20],
                            email=(row.get('email') or '')[:100],
                            whatsapp=(row.get('whatsapp') or '')[:20],
                            address=(row.get('address') or '')[:200],
                            gender=row.get('gender') or 'M',
                            customer_type=row.get('customer_type') or 'NATURAL',
                            status=row.get('status') or 'ACTIVE',
                            country=row.get('country') or 'Republica Dominicana',
                            nationality=row.get('nationality') or 'Dominicano/a',
                            branch=branch,
                        )
                        counters['customers'] += 1
                    cedula_to_customer[cedula] = cust
            except Exception as e:
                counters['errors'] += 1
                error_msgs.append(f"Customer {row.get('id_number','?')}: {str(e)[:120]}")

        # 2) Loans
        loan_ref_to_obj = {}
        for row in (data.get('loans') or []):
            try:
                with transaction.atomic():
                    cedula = (row.get('customer_id_number') or '').strip()
                    customer = cedula_to_customer.get(cedula) or Customer.objects.filter(id_number=cedula).first()
                    if not customer:
                        counters['skipped_loans'] += 1
                        continue

                    amount = _decimal(row.get('amount'))
                    loan_date = _parse_date(row.get('loan_date') or row.get('disbursement_date')) or date.today()

                    existing = Loan.objects.filter(customer=customer, principal_amount=amount, disbursement_date=loan_date).first()
                    if existing:
                        counters['skipped_loans'] += 1
                        loan_ref_to_obj[row.get('reference') or ''] = existing
                        continue

                    plazo = int(row.get('term_months') or 1)
                    cuota = _decimal(row.get('monthly_payment')) or amount
                    total_to_pay = cuota * plazo
                    total_interest = max(Decimal('0'), total_to_pay - amount)
                    annual_rate = Decimal('0')
                    if amount > 0 and plazo > 0:
                        annual_rate = (total_interest / amount * Decimal('12') / plazo * 100).quantize(Decimal('0.001'))
                        annual_rate = max(Decimal('0'), min(annual_rate, Decimal('999.999')))

                    from dateutil.relativedelta import relativedelta
                    maturity = loan_date + relativedelta(months=plazo)
                    first_pay = _parse_date(row.get('first_payment_date')) or maturity

                    loan = Loan.objects.create(
                        loan_number=_gen_code('PP', Loan, 'loan_number'),
                        customer=customer, product=product, branch=branch,
                        principal_amount=amount, outstanding_principal=amount,
                        annual_interest_rate=annual_rate, term_months=plazo,
                        payment_method='NIVELADA', payment_frequency=row.get('payment_frequency') or 'MONTHLY',
                        interest_type='SIMPLE',
                        total_installments=plazo, monthly_payment=cuota,
                        total_interest=total_interest, total_to_pay=total_to_pay,
                        disbursement_date=loan_date, first_payment_date=first_pay, maturity_date=maturity,
                        status=row.get('status') or 'ACTIVE',
                        notes='Importado via sync masivo. ' + (row.get('notes') or ''),
                    )

                    # Generar tabla de amortización
                    interest_per = total_interest / plazo if plazo else Decimal('0')
                    principal_per = amount / plazo if plazo else amount
                    for i in range(1, plazo + 1):
                        due = first_pay + relativedelta(months=i - 1)
                        balance = amount - principal_per * i
                        LoanSchedule.objects.create(
                            loan=loan, installment_number=i, due_date=due,
                            principal_amount=principal_per.quantize(Decimal('0.01')),
                            interest_amount=interest_per.quantize(Decimal('0.01')),
                            total_amount=cuota,
                            balance_after=balance.quantize(Decimal('0.01')) if balance > 0 else Decimal('0'),
                            status='PENDING',
                        )

                    # Marcar cuotas pagadas si vienen
                    paid_count = int(row.get('paid_installments') or 0)
                    paid_count = max(0, min(paid_count, plazo))
                    if paid_count > 0:
                        last_pay = _parse_date(row.get('last_payment_date')) or first_pay
                        for i in range(1, paid_count + 1):
                            sched = loan.schedule.filter(installment_number=i).first()
                            if sched:
                                sched.total_paid = cuota
                                sched.paid_date = last_pay
                                sched.status = 'PAID'
                                sched.save()
                        loan.installments_paid = paid_count
                        loan.installments_remaining = plazo - paid_count
                        loan.outstanding_principal = max(Decimal('0'), amount - principal_per * paid_count)
                        loan.total_paid = cuota * paid_count
                        loan.last_payment_date = last_pay
                        if loan.outstanding_principal <= Decimal('0.01'):
                            loan.status = 'COMPLETED'
                        loan.save()

                    counters['loans'] += 1
                    if row.get('reference'):
                        loan_ref_to_obj[row['reference']] = loan
            except Exception as e:
                counters['errors'] += 1
                error_msgs.append(f"Loan {row.get('reference','?')}: {str(e)[:120]}")

        # 3) Payments
        for row in (data.get('payments') or []):
            try:
                with transaction.atomic():
                    ref = row.get('loan_reference') or row.get('loan_number')
                    loan = loan_ref_to_obj.get(ref) or Loan.objects.filter(loan_number=ref).first()
                    if not loan:
                        counters['skipped_payments'] += 1
                        continue
                    Payment.objects.create(
                        payment_number=_gen_code('PAG', Payment, 'payment_number'),
                        receipt_number=_gen_code('REC', Payment, 'receipt_number'),
                        loan=loan, customer=loan.customer,
                        total_amount=_decimal(row.get('total_amount')),
                        principal_amount=_decimal(row.get('principal_amount')),
                        interest_amount=_decimal(row.get('interest_amount')),
                        late_fee_amount=_decimal(row.get('late_fee_amount')),
                        payment_method=row.get('payment_method') or 'CASH',
                        payment_type=row.get('payment_type') or 'REGULAR',
                        payment_date=_parse_date(row.get('payment_date')) or date.today(),
                        status='CONFIRMED', received_by=request.user,
                        notes='Importado via sync masivo',
                    )
                    counters['payments'] += 1
            except Exception as e:
                counters['errors'] += 1
                error_msgs.append(f"Payment: {str(e)[:120]}")

        # 4) Guarantees
        for row in (data.get('guarantees') or []):
            try:
                with transaction.atomic():
                    cedula = (row.get('customer_id_number') or '').strip()
                    customer = cedula_to_customer.get(cedula) or Customer.objects.filter(id_number=cedula).first()
                    if not customer:
                        continue
                    Guarantee.objects.create(
                        customer=customer,
                        guarantee_type=row.get('guarantee_type') or 'OTHER',
                        description=(row.get('description') or '')[:500],
                        estimated_value=_decimal(row.get('estimated_value')),
                        status='ACTIVE',
                    )
                    counters['guarantees'] += 1
            except Exception as e:
                counters['errors'] += 1
                error_msgs.append(f"Guarantee: {str(e)[:120]}")

        return Response({
            'success': True,
            'imported': counters,
            'errors_sample': error_msgs[:20],
        })

    def _read_payload(self, request):
        file = request.FILES.get('file')
        if file:
            try:
                content = file.read().decode('utf-8')
                return json.loads(content)
            except Exception as e:
                return Response({'detail': f'JSON inválido: {e}'}, status=400)
        if isinstance(request.data, dict):
            return request.data
        return Response({'detail': 'Sin archivo ni payload JSON válido.'}, status=400)
