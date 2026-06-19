"""Vistas de préstamos: lista, detalle, amortización, simulador, estadísticas."""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Count, Sum, Q, Avg
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import module_permissions
from .models import Loan, LoanSchedule
from .serializers import (
    LoanListSerializer, LoanDetailSerializer,
    LoanScheduleSerializer, LoanSimulatorSerializer,
)


from apps.core.mixins import SoftDeleteViewSetMixin, AutoMainBranchMixin


class LoanViewSet(AutoMainBranchMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    queryset = Loan.objects.filter(is_deleted=False).select_related(
        'customer', 'product', 'branch', 'officer'
    ).prefetch_related('schedule')
    permission_classes = [IsAuthenticated, module_permissions('loans')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'status': ['exact'],
        'branch': ['exact'],
        'product': ['exact'],
        'officer': ['exact'],
        'created_at': ['gte', 'lte', 'date__gte', 'date__lte'],
        'disbursement_date': ['gte', 'lte'],
    }
    search_fields = [
        'loan_number',
        'customer__first_name', 'customer__last_name',
        'customer__id_number', 'customer__customer_code',
    ]
    ordering_fields = ['created_at', 'disbursement_date', 'days_past_due', 'outstanding_principal']

    def get_serializer_class(self):
        if self.action == 'list':
            return LoanListSerializer
        return LoanDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_superuser and hasattr(user, 'branch') and user.branch:
            qs = qs.filter(branch=user.branch)
        if not (user.is_superuser or user.is_staff):
            qs = qs.filter(is_confidential=False)
        return qs

    # ── Tabla de amortización ─────────────────────────────────────────────────
    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        loan = self.get_object()
        return Response(LoanScheduleSerializer(loan.schedule.all(), many=True).data)

    # ── Préstamo directo (sin pasar por solicitud) ──────────────────────────────
    @transaction.atomic
    @action(detail=False, methods=['post'])
    def direct(self, request):
        """Registra un préstamo directo con soporte para modalidades:
        WEEKLY (semanal flat), BIWEEKLY (quincenal), MONTHLY (mensual)."""
        from decimal import InvalidOperation
        from datetime import date, timedelta
        from dateutil.relativedelta import relativedelta
        from apps.customers.models import Customer
        from apps.loan_products.models import LoanProduct

        data = request.data
        try:
            customer = Customer.objects.get(pk=data.get('customer'), is_deleted=False)
        except (Customer.DoesNotExist, ValueError, TypeError):
            return Response({'detail': 'Cliente no válido.'}, status=400)
        try:
            product = LoanProduct.objects.get(pk=data.get('product'))
        except (LoanProduct.DoesNotExist, ValueError, TypeError):
            return Response({'detail': 'Producto no válido.'}, status=400)

        try:
            amount = Decimal(str(data.get('amount')))
        except (TypeError, ValueError, InvalidOperation):
            return Response({'detail': 'Monto no válido.'}, status=400)
        if amount <= 0:
            return Response({'detail': 'El monto debe ser mayor a cero.'}, status=400)

        branch = customer.branch or product.branch
        if not branch:
            return Response({'detail': 'El cliente no tiene sucursal asignada. Edita el cliente primero.'}, status=400)

        if not request.user.is_superuser:
            user_branch = getattr(request.user, 'branch_id', None)
            if user_branch and customer.branch_id and user_branch != customer.branch_id:
                return Response({'detail': 'No puede crear préstamos para clientes de otra sucursal.'}, status=403)

        disb = data.get('disbursement_date')
        try:
            disbursement_date = date.fromisoformat(disb) if disb else timezone.now().date()
        except (TypeError, ValueError):
            disbursement_date = timezone.now().date()

        frequency = data.get('payment_frequency', 'MONTHLY').upper()

        # ── Modalidad SEMANAL (flat o con tasa) ──
        if frequency == 'WEEKLY':
            try:
                total_inst = int(data.get('total_installments', 13))
                client_inst = int(data.get('client_installments', 10))
            except (TypeError, ValueError):
                return Response({'detail': 'Semanas no válidas.'}, status=400)
            if total_inst < 1:
                return Response({'detail': 'El total de semanas debe ser al menos 1.'}, status=400)

            rate_raw = data.get('rate')
            try:
                weekly_rate = Decimal(str(rate_raw)) if rate_raw not in (None, '', '0') else None
            except (TypeError, ValueError, InvalidOperation):
                weekly_rate = None

            if weekly_rate and weekly_rate > 0:
                if weekly_rate > Decimal('100'):
                    return Response({'detail': 'La tasa no puede ser mayor a 100%.'}, status=400)
                total_interest = amount * weekly_rate / Decimal('100')
                total_to_pay = amount + total_interest
                cuota = total_to_pay / Decimal(str(total_inst))
                effective_rate = weekly_rate
                client_inst = total_inst
            else:
                if client_inst < 1 or client_inst >= total_inst:
                    return Response({'detail': 'Las semanas del cliente deben ser menores al total.'}, status=400)
                cuota = amount / Decimal(str(client_inst))
                total_to_pay = cuota * total_inst
                total_interest = total_to_pay - amount
                effective_rate = (total_interest / amount) * 100

            annual_rate = effective_rate * Decimal('52') / Decimal(str(total_inst))
            term_months = max(1, int((Decimal(str(total_inst)) / Decimal('4.33')).to_integral_value()))
            maturity_date = disbursement_date + timedelta(weeks=total_inst)

            loan = Loan.objects.create(
                customer=customer, product=product, branch=branch,
                principal_amount=amount, outstanding_principal=amount,
                annual_interest_rate=annual_rate.quantize(Decimal('0.001')),
                term_months=term_months,
                payment_frequency='WEEKLY',
                interest_type='SIMPLE',
                total_installments=total_inst,
                client_installments=client_inst,
                monthly_payment=cuota.quantize(Decimal('0.01')),
                total_interest=total_interest.quantize(Decimal('0.01')),
                total_to_pay=total_to_pay.quantize(Decimal('0.01')),
                disbursement_date=disbursement_date,
                maturity_date=maturity_date,
                status='ACTIVE', created_by=request.user,
            )

        # ── Modalidad CONFIDENCIAL (préstamo rápido, admin fija ganancia) ──
        elif frequency == 'CONFIDENTIAL':
            if not (request.user.is_superuser or request.user.is_staff):
                return Response({'detail': 'Solo administradores pueden crear préstamos confidenciales.'}, status=403)
            try:
                days = int(data.get('days', 1))
            except (TypeError, ValueError):
                return Response({'detail': 'Días no válidos.'}, status=400)

            total_to_receive_raw = data.get('total_to_receive')
            rate_raw = data.get('rate')
            try:
                conf_rate = Decimal(str(rate_raw)) if rate_raw not in (None, '', '0') else None
            except (TypeError, ValueError, InvalidOperation):
                conf_rate = None

            if total_to_receive_raw not in (None, '', '0'):
                try:
                    total_to_receive = Decimal(str(total_to_receive_raw))
                except (TypeError, ValueError, InvalidOperation):
                    return Response({'detail': 'Total a recibir no válido.'}, status=400)
            elif conf_rate and conf_rate > 0:
                if conf_rate > Decimal('500'):
                    return Response({'detail': 'La tasa no puede ser mayor a 500%.'}, status=400)
                total_to_receive = amount * (1 + conf_rate / Decimal('100'))
            else:
                return Response({'detail': 'Ingrese la tasa de interés o el total a recibir.'}, status=400)

            if total_to_receive <= amount:
                return Response({'detail': 'El total a recibir debe ser mayor al monto prestado.'}, status=400)
            if days < 1:
                return Response({'detail': 'Los días deben ser al menos 1.'}, status=400)

            profit = total_to_receive - amount
            annual_rate = (profit / amount) * Decimal('365') / Decimal(str(days)) * 100
            maturity_date = disbursement_date + timedelta(days=days)

            loan = Loan.objects.create(
                customer=customer, product=product, branch=branch,
                principal_amount=amount, outstanding_principal=amount,
                annual_interest_rate=annual_rate.quantize(Decimal('0.001')),
                term_months=1,
                payment_frequency='DAILY',
                interest_type='SIMPLE',
                is_confidential=True,
                total_installments=1,
                monthly_payment=total_to_receive.quantize(Decimal('0.01')),
                total_interest=profit.quantize(Decimal('0.01')),
                total_to_pay=total_to_receive.quantize(Decimal('0.01')),
                disbursement_date=disbursement_date,
                maturity_date=maturity_date,
                status='ACTIVE', created_by=request.user,
            )

        # ── Modalidad QUINCENAL / MENSUAL ──
        else:
            try:
                term = int(data.get('term_months'))
            except (TypeError, ValueError):
                return Response({'detail': 'Plazo no válido.'}, status=400)
            if term <= 0:
                return Response({'detail': 'El plazo debe ser mayor a cero.'}, status=400)

            rate_raw = data.get('rate')
            try:
                period_rate = Decimal(str(rate_raw)) if rate_raw not in (None, '') else Decimal('10')
            except (TypeError, ValueError, InvalidOperation):
                return Response({'detail': 'Tasa no válida.'}, status=400)
            if period_rate <= 0 or period_rate > Decimal('100'):
                return Response({'detail': 'La tasa debe estar entre 0.01% y 100%.'}, status=400)

            if frequency == 'BIWEEKLY':
                annual_rate = period_rate * 26
                term_months = max(1, int((Decimal(str(term)) / 2).to_integral_value()))
                total_periods = term
                maturity_date = disbursement_date + timedelta(weeks=term * 2)
            else:
                frequency = 'MONTHLY'
                annual_rate = period_rate * 12
                term_months = term
                total_periods = term
                maturity_date = disbursement_date + relativedelta(months=term)

            # Cuota flat (interés simple)
            period_r = period_rate / Decimal('100')
            total_interest = amount * period_r * Decimal(str(total_periods))
            total_to_pay = amount + total_interest
            cuota = total_to_pay / Decimal(str(total_periods))

            loan = Loan.objects.create(
                customer=customer, product=product, branch=branch,
                principal_amount=amount, outstanding_principal=amount,
                annual_interest_rate=annual_rate.quantize(Decimal('0.001')),
                term_months=term_months,
                payment_frequency=frequency,
                interest_type='SIMPLE',
                total_installments=total_periods,
                monthly_payment=cuota.quantize(Decimal('0.01')),
                total_interest=total_interest.quantize(Decimal('0.01')),
                total_to_pay=total_to_pay.quantize(Decimal('0.01')),
                disbursement_date=disbursement_date,
                maturity_date=maturity_date,
                status='ACTIVE', created_by=request.user,
            )

        try:
            loan.generate_schedule()
        except Exception as e:
            import logging
            logging.getLogger('credcore.audit').error(
                f"[SCHEDULE_FAIL] loan={loan.loan_number} error={e}"
            )

        return Response(LoanDetailSerializer(loan).data, status=status.HTTP_201_CREATED)

    # ── Simulador ─────────────────────────────────────────────────────────────
    @action(detail=False, methods=['post'])
    def simulate(self, request):
        serializer = LoanSimulatorSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        from apps.loan_products.models import LoanProduct
        from apps.core.utils import calculate_amortization_schedule

        try:
            product = LoanProduct.objects.get(id=serializer.validated_data['product_id'])
        except LoanProduct.DoesNotExist:
            return Response({'detail': 'Producto no encontrado.'}, status=404)

        schedule = calculate_amortization_schedule(
            principal=Decimal(str(serializer.validated_data['amount'])),
            annual_rate=product.annual_interest_rate,
            term_months=serializer.validated_data['term_months'],
            payment_method=product.payment_method,
            start_date=serializer.validated_data.get('start_date'),
        )
        total_interest = sum(item['interest_amount'] for item in schedule)
        total_to_pay   = sum(item['total_amount']   for item in schedule)
        return Response({
            'monthly_payment': float(schedule[0]['total_amount']) if schedule else 0,
            'total_interest':  float(total_interest),
            'total_to_pay':    float(total_to_pay),
            'schedule':        schedule,
        })

    # ── Estadísticas del portafolio ───────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        today = timezone.now().date()
        data = qs.aggregate(
            total=Count('id'),
            active=Count('id', filter=Q(status='ACTIVE')),
            completed=Count('id', filter=Q(status='COMPLETED')),
            defaulted=Count('id', filter=Q(status='DEFAULTED')),
            written_off=Count('id', filter=Q(status='WRITTEN_OFF')),
            total_portfolio=Sum('outstanding_principal', filter=Q(status='ACTIVE')),
            total_disbursed=Sum('principal_amount'),
            total_collected=Sum('total_paid'),
            overdue_count=Count('id', filter=Q(status='ACTIVE', days_past_due__gt=0)),
            overdue_portfolio=Sum('outstanding_principal', filter=Q(status='ACTIVE', days_past_due__gt=0)),
            avg_days_past_due=Avg('days_past_due', filter=Q(status='ACTIVE', days_past_due__gt=0)),
        )
        # Tasa de morosidad
        active = data.get('active') or 1
        overdue = data.get('overdue_count') or 0
        data['delinquency_rate'] = round((overdue / active) * 100, 2)
        return Response(data)

    # ── Actualizar mora (endpoint manual) ─────────────────────────────────────
    @action(detail=True, methods=['post'])
    def update_delinquency(self, request, pk=None):
        loan = self.get_object()
        today = timezone.now().date()
        overdue = loan.schedule.filter(status__in=['PENDING', 'PARTIAL'], due_date__lt=today)
        if overdue.exists():
            first_overdue = overdue.order_by('due_date').first()
            loan.days_past_due = (today - first_overdue.due_date).days
            if loan.days_past_due >= 90:
                loan.status = 'DEFAULTED'
            loan.save(update_fields=['days_past_due', 'status'])
        return Response(LoanDetailSerializer(loan).data)

    # ── Castigar préstamo ────────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def write_off(self, request, pk=None):
        loan = self.get_object()
        if loan.status not in ('ACTIVE', 'DEFAULTED'):
            return Response({'detail': 'Solo préstamos activos o en mora pueden ser castigados.'}, status=400)
        reason = request.data.get('reason', '')
        loan.status = 'WRITTEN_OFF'
        loan.notes = f"Castigado: {reason}\n" + loan.notes
        loan.save(update_fields=['status', 'notes'])
        return Response(LoanDetailSerializer(loan).data)

    # ── Historial de pagos del préstamo ──────────────────────────────────────
    @action(detail=True, methods=['get'])
    def payments(self, request, pk=None):
        loan = self.get_object()
        from apps.payments.models import Payment
        from apps.payments.serializers import PaymentSerializer
        pmts = Payment.objects.filter(loan=loan).order_by('-payment_date')
        return Response(PaymentSerializer(pmts, many=True).data)

    # Admin agrega mora manualmente a un préstamo o cuota atrasada
    @action(detail=True, methods=['post'], url_path='add-late-fee')
    def add_late_fee(self, request, pk=None):
        if not (request.user.is_superuser or request.user.is_staff):
            return Response({'detail': 'Solo administradores pueden agregar mora.'}, status=403)
        loan = self.get_object()
        try:
            amount = Decimal(str(request.data.get('amount', 0))).quantize(Decimal('0.01'))
        except Exception:
            return Response({'detail': 'Monto inválido.'}, status=400)
        if amount <= 0:
            return Response({'detail': 'El monto debe ser mayor a cero.'}, status=400)

        reason = (request.data.get('reason') or 'Mora agregada manualmente').strip()
        installment_number = request.data.get('installment_number')

        with transaction.atomic():
            loan_locked = Loan.objects.select_for_update().get(pk=loan.pk)
            loan_locked.outstanding_late_fees = Decimal(str(loan_locked.outstanding_late_fees)) + amount

            if installment_number:
                try:
                    sched = loan_locked.schedule.get(installment_number=int(installment_number))
                    sched.late_fee_amount = Decimal(str(sched.late_fee_amount or 0)) + amount
                    sched.total_amount = Decimal(str(sched.total_amount)) + amount
                    sched.save(update_fields=['late_fee_amount', 'total_amount'])
                except Exception:
                    pass

            loan_locked.notes = f"[MORA +{amount} por {request.user.email}: {reason}]\n{loan_locked.notes or ''}"
            loan_locked.save(update_fields=['outstanding_late_fees', 'notes'])

        return Response(LoanDetailSerializer(loan_locked).data)

    @action(detail=True, methods=['post'])
    def waive_late_fees(self, request, pk=None):
        """
        Condona la mora de un préstamo (la pone a 0).
        Opcionalmente se puede especificar un monto parcial con { amount: 500 }.
        """
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Solo administradores pueden condonar mora.'}, status=403)

        loan = self.get_object()
        from decimal import Decimal

        amount = request.data.get('amount')  # None = condonar todo
        reason = request.data.get('reason', 'Gracia otorgada por administrador')

        current_fee = Decimal(str(loan.outstanding_late_fees))
        if current_fee <= 0:
            return Response({'detail': 'Este préstamo no tiene mora pendiente.'}, status=400)

        if amount is not None:
            to_waive = min(Decimal(str(amount)), current_fee)
        else:
            to_waive = current_fee

        loan.outstanding_late_fees = max(Decimal('0'), current_fee - to_waive)

        # También actualizar cuotas con mora pendiente
        loan.schedule.filter(late_fee_amount__gt=0).update(late_fee_amount=0)
        loan.save(update_fields=['outstanding_late_fees'])

        # Registrar en notas del préstamo
        note = f"\n[{request.user.get_full_name()}] Mora condonada: RD${to_waive} — {reason}"
        loan.notes = (loan.notes or '') + note
        loan.save(update_fields=['notes'])

        return Response({
            'detail': f'Mora condonada: RD${to_waive:.2f}',
            'waived_amount': float(to_waive),
            'remaining_late_fees': float(loan.outstanding_late_fees),
        })

    @action(detail=True, methods=['post'])
    def adjust_late_fee_rate(self, request, pk=None):
        """
        Ajusta la tasa de interés moratorio del préstamo.
        Payload: { new_rate: 0.5, reason: "..." }
        """
        if not request.user.is_superuser and not request.user.is_staff:
            return Response({'detail': 'Solo administradores pueden ajustar la tasa de mora.'}, status=403)

        loan = self.get_object()
        from decimal import Decimal

        new_rate = request.data.get('new_rate')
        reason   = request.data.get('reason', 'Ajuste de tasa por administrador')

        if new_rate is None:
            return Response({'detail': 'Se requiere new_rate.'}, status=400)

        new_rate_dec = Decimal(str(new_rate))
        if new_rate_dec < 0 or new_rate_dec > 100:
            return Response({'detail': 'La tasa debe estar entre 0% y 100%.'}, status=400)

        old_rate = loan.late_fee_rate
        loan.late_fee_rate = new_rate_dec
        note = f"\n[{request.user.get_full_name()}] Tasa mora ajustada: {old_rate}% → {new_rate_dec}% — {reason}"
        loan.notes = (loan.notes or '') + note
        loan.save(update_fields=['late_fee_rate', 'notes'])

        return Response({
            'detail': f'Tasa de mora actualizada a {new_rate_dec}%',
            'old_rate': float(old_rate),
            'new_rate': float(new_rate_dec),
        })

    # ── Firma digital del cliente ────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """Guarda la firma digital del cliente. Payload: { signature: "data:image/png;base64,..." }"""
        loan = self.get_object()
        signature_data = request.data.get('signature', '')
        if not signature_data or len(signature_data) < 100:
            return Response({'detail': 'Firma inválida o vacía.'}, status=400)

        loan.client_signature = signature_data
        loan.signature_date   = timezone.now()
        # Obtener IP del request
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        loan.signature_ip = x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')
        loan.save(update_fields=['client_signature', 'signature_date', 'signature_ip'])

        return Response({
            'detail': 'Firma registrada exitosamente.',
            'signed_at': loan.signature_date.isoformat(),
        })

    # ── Generar tabla de amortización manualmente ─────────────────────────────
    @action(detail=True, methods=['post'])
    def generate_schedule(self, request, pk=None):
        loan = self.get_object()
        if loan.schedule.exists():
            return Response({'detail': 'Ya existe tabla de amortización.'}, status=400)
        try:
            _build_schedule(loan)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)
        return Response(LoanScheduleSerializer(loan.schedule.all(), many=True).data)


# ── Función auxiliar para generar tabla ──────────────────────────────────────
def _build_schedule(loan: Loan):
    """Genera y guarda la tabla de amortización del préstamo."""
    from apps.core.utils import calculate_amortization_schedule, calculate_weekly_flat_schedule, calculate_confidential_schedule

    # Préstamo confidencial (una sola cuota)
    if loan.is_confidential:
        items = calculate_confidential_schedule(
            principal=loan.principal_amount,
            total_to_receive=loan.total_to_pay,
            days=(loan.maturity_date - loan.disbursement_date).days,
            start_date=loan.disbursement_date,
        )
    # Modalidad semanal flat (10 de 13)
    elif loan.payment_frequency == 'WEEKLY' and loan.total_installments and loan.client_installments:
        items = calculate_weekly_flat_schedule(
            principal=loan.principal_amount,
            total_installments=loan.total_installments,
            client_installments=loan.client_installments,
            start_date=loan.disbursement_date,
        )
    else:
        items = calculate_amortization_schedule(
            principal=loan.principal_amount,
            annual_rate=loan.annual_interest_rate,
            term_months=loan.term_months,
            payment_method=loan.payment_method if loan.payment_method else 'NIVELADA',
            start_date=loan.disbursement_date,
            payment_frequency=getattr(loan, 'payment_frequency', 'MONTHLY') or 'MONTHLY',
            interest_type=getattr(loan, 'interest_type', 'SIMPLE') or 'SIMPLE',
            total_periods_override=loan.total_installments,
        )
    balance = loan.principal_amount
    to_create = []
    for item in items:
        balance -= item['principal_amount']
        to_create.append(LoanSchedule(
            loan=loan,
            installment_number=item['installment_number'],
            due_date=item['due_date'],
            principal_amount=item['principal_amount'],
            interest_amount=item['interest_amount'],
            total_amount=item['total_amount'],
            balance_after=max(balance, Decimal('0')),
        ))
    LoanSchedule.objects.bulk_create(to_create)

    # Actualizar totales del préstamo
    total_interest = sum(i['interest_amount'] for i in items)
    total_to_pay   = sum(i['total_amount']    for i in items)
    loan.total_interest         = total_interest
    loan.total_to_pay           = total_to_pay
    loan.monthly_payment        = items[0]['total_amount'] if items else 0
    loan.installments_remaining = len(items)
    loan.save(update_fields=['total_interest', 'total_to_pay', 'monthly_payment', 'installments_remaining'])
