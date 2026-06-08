"""Gestion de mora y cobranza — CollectionAction y PaymentAgreement."""
from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import CollectionAction, PaymentAgreement
from .serializers import CollectionActionSerializer, PaymentAgreementSerializer


class CollectionActionViewSet(viewsets.ModelViewSet):
    """Acciones de cobro: llamadas, visitas, acuerdos, SMS, WhatsApp, etc."""
    queryset = CollectionAction.objects.select_related(
        'loan', 'customer', 'performed_by'
    ).order_by('-created_at')
    serializer_class   = CollectionActionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['action_type', 'result', 'loan', 'customer']
    search_fields      = ['loan__loan_number', 'customer__first_name', 'customer__last_name', 'notes']
    ordering_fields    = ['created_at', 'days_past_due_at_action', 'amount_owed_at_action']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_superuser and hasattr(user, 'branch') and user.branch:
            qs = qs.filter(loan__branch=user.branch)
        return qs

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        today = timezone.now().date()
        first_day = today.replace(day=1)
        data = qs.aggregate(
            total=Count('id'),
            month_count=Count('id', filter=Q(created_at__date__gte=first_day)),
            today_count=Count('id', filter=Q(created_at__date=today)),
            promises=Count('id', filter=Q(result='PROMISE_TO_PAY')),
            agreements=Count('id', filter=Q(result='AGREEMENT_REACHED')),
            no_contact=Count('id', filter=Q(result='NO_CONTACT')),
        )
        # Top acciones del mes por tipo
        ACTION_LABELS = {
            'CALL': 'Llamada', 'VISIT': 'Visita', 'NOTICE': 'Notificación',
            'EMAIL': 'Correo', 'SMS': 'SMS', 'WHATSAPP': 'WhatsApp',
            'AGREEMENT': 'Acuerdo', 'LEGAL': 'Legal',
        }
        by_type_raw = (
            qs.filter(created_at__date__gte=first_day)
              .values('action_type')
              .annotate(count=Count('id'))
              .order_by('-count')[:5]
        )
        data['by_type'] = [
            {'action_type': r['action_type'], 'label': ACTION_LABELS.get(r['action_type'], r['action_type']), 'count': r['count']}
            for r in by_type_raw
        ]
        return Response(data)

    @action(detail=False, methods=['get'])
    def overdue_loans(self, request):
        """Lista préstamos en mora con sus últimas acciones de cobro."""
        from apps.loans.models import Loan
        from apps.loans.serializers import LoanListSerializer

        qs_loans = Loan.objects.filter(
            is_deleted=False, status__in=['ACTIVE', 'DEFAULTED'], days_past_due__gt=0
        ).select_related('customer', 'branch', 'product', 'officer').order_by('-days_past_due')

        user = request.user
        if not user.is_superuser and hasattr(user, 'branch') and user.branch:
            qs_loans = qs_loans.filter(branch=user.branch)

        serializer = LoanListSerializer(qs_loans, many=True)
        return Response({'count': qs_loans.count(), 'results': serializer.data})


class PaymentAgreementViewSet(viewsets.ModelViewSet):
    """Acuerdos de pago negociados con clientes en mora."""
    queryset = PaymentAgreement.objects.select_related(
        'loan', 'collection_action', 'created_by'
    ).order_by('-created_at')
    serializer_class   = PaymentAgreementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['status', 'loan']
    search_fields      = ['loan__loan_number', 'notes']
    ordering_fields    = ['agreed_payment_date', 'agreed_amount', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_superuser and hasattr(user, 'branch') and user.branch:
            qs = qs.filter(loan__branch=user.branch)
        return qs

    @action(detail=True, methods=['post'])
    def mark_fulfilled(self, request, pk=None):
        agreement = self.get_object()
        agreement.status = 'FULFILLED'
        agreement.save(update_fields=['status'])
        return Response(PaymentAgreementSerializer(agreement, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def mark_broken(self, request, pk=None):
        agreement = self.get_object()
        agreement.status = 'BROKEN'
        agreement.save(update_fields=['status'])
        return Response(PaymentAgreementSerializer(agreement, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        today = timezone.now().date()
        data = qs.aggregate(
            total=Count('id'),
            active=Count('id', filter=Q(status='ACTIVE')),
            fulfilled=Count('id', filter=Q(status='FULFILLED')),
            broken=Count('id', filter=Q(status='BROKEN')),
            overdue=Count('id', filter=Q(status='ACTIVE', agreed_payment_date__lt=today)),
            total_agreed=Sum('agreed_amount', filter=Q(status='ACTIVE')),
        )
        return Response(data)
