"""Vistas de préstamos: lista, detalle, amortización, simulador, estadísticas."""
from decimal import Decimal
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


from apps.core.mixins import SoftDeleteViewSetMixin


class LoanViewSet(SoftDeleteViewSetMixin, viewsets.ModelViewSet):
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
        return qs

    # ── Tabla de amortización ─────────────────────────────────────────────────
    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        loan = self.get_object()
        return Response(LoanScheduleSerializer(loan.schedule.all(), many=True).data)

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

    # ── Gestión de mora (solo admins/staff) ───────────────────────────────────
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
    from apps.core.utils import calculate_amortization_schedule
    items = calculate_amortization_schedule(
        principal=loan.principal_amount,
        annual_rate=loan.annual_interest_rate,
        term_months=loan.term_months,
        payment_method=loan.payment_method if loan.payment_method else 'NIVELADA',
        start_date=loan.disbursement_date,
        payment_frequency=getattr(loan, 'payment_frequency', 'MONTHLY') or 'MONTHLY',
        interest_type=getattr(loan, 'interest_type', 'SIMPLE') or 'SIMPLE',
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
