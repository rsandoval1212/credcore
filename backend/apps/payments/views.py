"""Cobros, pagos y recibos — con transacciones atómicas y reversión."""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Count, Sum, Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from apps.core.permissions import module_permissions
from django_filters.rest_framework import DjangoFilterBackend
from .models import Payment
from .serializers import PaymentSerializer, PaymentCreateSerializer


from apps.core.mixins import SoftDeleteViewSetMixin


class PaymentViewSet(SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.filter(is_deleted=False).select_related(
        'loan', 'customer', 'received_by', 'cash_session'
    )
    permission_classes = [IsAuthenticated, module_permissions('payments')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'status': ['exact'],
        'payment_type': ['exact'],
        'payment_method': ['exact'],
        'payment_date': ['exact', 'gte', 'lte'],
        'created_at': ['gte', 'lte', 'date__gte', 'date__lte'],
    }
    search_fields = [
        'payment_number', 'receipt_number',
        'loan__loan_number',
        'customer__first_name', 'customer__last_name', 'customer__id_number',
    ]
    ordering_fields = ['payment_date', 'total_amount', 'created_at']

    def get_serializer_class(self):
        if self.action in ('update', 'partial_update'):
            return PaymentCreateSerializer
        return PaymentSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Valida con CreateSerializer, responde con PaymentSerializer completo."""
        create_serializer = PaymentCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)

        # FIX #7: Validar montos positivos
        total = create_serializer.validated_data.get('total_amount', 0)
        if total is not None and Decimal(str(total)) <= 0:
            raise ValidationError({'total_amount': 'El monto debe ser mayor a cero.'})

        # FIX #11: Validar fecha de pago no futura
        pdate = create_serializer.validated_data.get('payment_date')
        if pdate and pdate > timezone.now().date():
            raise ValidationError({'payment_date': 'No se permiten pagos con fecha futura.'})

        self.perform_create(create_serializer)
        payment = create_serializer.instance

        # FIX #21: Notificar pago recibido via SSE
        try:
            from apps.core.sse_views import push_notification
            if payment.loan and payment.loan.officer_id:
                push_notification(payment.loan.officer_id, 'payment_received', {
                    'title': 'Pago Recibido',
                    'message': f'Pago de RD$ {payment.total_amount:,.2f} registrado para {payment.loan.loan_number}',
                    'payment_id': str(payment.pk),
                })
        except Exception:
            pass  # No bloquear el pago por error en notificacion

        response_serializer = PaymentSerializer(payment)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        loan = serializer.validated_data['loan']
        # FIX #9: Lock del préstamo para evitar pagos concurrentes
        from apps.loans.models import Loan
        loan = Loan.objects.select_for_update().get(pk=loan.pk)

        payment = serializer.save(
            customer=loan.customer,
            received_by=self.request.user,
            created_by=self.request.user,
        )
        self._apply_payment_to_loan(payment, loan)

    def _apply_payment_to_loan(self, payment, loan):
        """Aplica el pago al saldo del préstamo y actualiza cuotas."""
        remaining = Decimal(str(payment.total_amount))
        installments = payment.installments.all()

        if installments.exists():
            for inst in installments.order_by('installment_number'):
                if remaining <= 0:
                    break
                to_pay = min(remaining, Decimal(str(inst.total_amount)) - Decimal(str(inst.total_paid)))
                if to_pay <= 0:
                    continue
                inst.total_paid = Decimal(str(inst.total_paid)) + to_pay
                inst.paid_date = payment.payment_date
                inst.status = 'PAID' if inst.total_paid >= Decimal(str(inst.total_amount)) else 'PARTIAL'
                inst.save(update_fields=['total_paid', 'paid_date', 'status'])
                remaining -= to_pay
        else:
            # Pago sin cuota específica: aplicar al siguiente pendiente
            pending = loan.schedule.filter(status__in=['PENDING', 'PARTIAL', 'OVERDUE']).order_by('installment_number')
            for inst in pending:
                if remaining <= 0:
                    break
                to_pay = min(remaining, Decimal(str(inst.total_amount)) - Decimal(str(inst.total_paid)))
                inst.total_paid = Decimal(str(inst.total_paid)) + to_pay
                inst.paid_date = payment.payment_date
                inst.status = 'PAID' if inst.total_paid >= Decimal(str(inst.total_amount)) else 'PARTIAL'
                inst.save(update_fields=['total_paid', 'paid_date', 'status'])
                remaining -= to_pay

        # Actualizar saldos del préstamo
        loan.total_paid = Decimal(str(loan.total_paid)) + Decimal(str(payment.total_amount))
        loan.outstanding_principal = max(
            Decimal('0'),
            Decimal(str(loan.outstanding_principal)) - Decimal(str(payment.principal_amount))
        )
        loan.outstanding_interest = max(
            Decimal('0'),
            Decimal(str(loan.outstanding_interest)) - Decimal(str(payment.interest_amount))
        )
        loan.outstanding_late_fees = max(
            Decimal('0'),
            Decimal(str(loan.outstanding_late_fees)) - Decimal(str(payment.late_fee_amount))
        )
        loan.installments_paid = loan.schedule.filter(status='PAID').count()
        loan.installments_remaining = loan.schedule.filter(status__in=['PENDING', 'PARTIAL', 'OVERDUE']).count()
        loan.last_payment_date = payment.payment_date

        # Si se cancela el préstamo
        total_outstanding = loan.outstanding_principal + loan.outstanding_interest + loan.outstanding_late_fees
        if total_outstanding <= Decimal('0.01') or payment.payment_type == 'FULL_PAYMENT':
            loan.status = 'COMPLETED'
            loan.completed_at = timezone.now()

        loan.save(update_fields=[
            'total_paid', 'outstanding_principal', 'outstanding_interest',
            'outstanding_late_fees', 'installments_paid', 'installments_remaining',
            'last_payment_date', 'status', 'completed_at',
        ])

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        today = timezone.now().date()
        first_day = today.replace(day=1)
        data = qs.aggregate(
            total=Count('id'),
            today_count=Count('id', filter=Q(payment_date=today)),
            today_amount=Sum('total_amount', filter=Q(payment_date=today)),
            month_count=Count('id', filter=Q(payment_date__gte=first_day)),
            month_amount=Sum('total_amount', filter=Q(payment_date__gte=first_day)),
            confirmed_total=Sum('total_amount', filter=Q(status='CONFIRMED')),
            cash_amount=Sum('total_amount', filter=Q(payment_method='CASH', status='CONFIRMED')),
            transfer_amount=Sum('total_amount', filter=Q(payment_method='BANK_TRANSFER', status='CONFIRMED')),
        )
        return Response(data)

    # FIX #2: Cancelar pago REVIERTE los saldos del préstamo
    @transaction.atomic
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        payment = self.get_object()
        if payment.status == 'CANCELLED':
            return Response({'detail': 'Ya está cancelado.'}, status=400)

        reason = request.data.get('reason', '')
        loan = payment.loan

        # Lock del préstamo
        from apps.loans.models import Loan
        loan = Loan.objects.select_for_update().get(pk=loan.pk)

        # Revertir saldos del préstamo
        loan.total_paid = max(Decimal('0'), Decimal(str(loan.total_paid)) - Decimal(str(payment.total_amount)))
        loan.outstanding_principal = Decimal(str(loan.outstanding_principal)) + Decimal(str(payment.principal_amount))
        loan.outstanding_interest = Decimal(str(loan.outstanding_interest)) + Decimal(str(payment.interest_amount))
        loan.outstanding_late_fees = Decimal(str(loan.outstanding_late_fees)) + Decimal(str(payment.late_fee_amount))

        # Si el préstamo estaba completado, reactivarlo
        if loan.status == 'COMPLETED':
            loan.status = 'ACTIVE'
            loan.completed_at = None

        # Revertir cuotas que fueron pagadas por este pago
        remaining = Decimal(str(payment.total_amount))
        paid_installments = loan.schedule.filter(
            paid_date=payment.payment_date, status__in=['PAID', 'PARTIAL']
        ).order_by('-installment_number')
        for inst in paid_installments:
            if remaining <= 0:
                break
            revert = min(remaining, Decimal(str(inst.total_paid)))
            inst.total_paid = max(Decimal('0'), Decimal(str(inst.total_paid)) - revert)
            inst.status = 'PENDING' if inst.total_paid == 0 else 'PARTIAL'
            if inst.total_paid == 0:
                inst.paid_date = None
            inst.save(update_fields=['total_paid', 'status', 'paid_date'])
            remaining -= revert

        loan.installments_paid = loan.schedule.filter(status='PAID').count()
        loan.installments_remaining = loan.schedule.filter(status__in=['PENDING', 'PARTIAL', 'OVERDUE']).count()
        loan.save(update_fields=[
            'total_paid', 'outstanding_principal', 'outstanding_interest',
            'outstanding_late_fees', 'installments_paid', 'installments_remaining',
            'status', 'completed_at',
        ])

        # Marcar pago como cancelado
        payment.status = 'CANCELLED'
        payment.notes = f"ANULADO: {reason}\n{payment.notes}"
        payment.save(update_fields=['status', 'notes'])

        return Response(PaymentSerializer(payment).data)
