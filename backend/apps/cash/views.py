"""Gestión de caja: sesiones, transacciones y cierre."""
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import module_permissions
from .models import CashRegister, CashSession, CashTransaction
from .serializers import (
    CashRegisterSerializer, CashSessionSerializer,
    CashSessionListSerializer, CashTransactionSerializer,
)


class CashRegisterViewSet(viewsets.ModelViewSet):
    queryset = CashRegister.objects.filter(is_active=True).select_related('branch')
    permission_classes = [IsAuthenticated, module_permissions('cash')]
    serializer_class = CashRegisterSerializer

    def perform_create(self, serializer):
        """Auto-asigna la sucursal principal si no se especifica una.

        Versión escritorio: el usuario no gestiona sucursales, se usa una
        'Sucursal Principal' transparente.
        """
        from apps.branches.models import Branch
        branch = serializer.validated_data.get('branch')
        if not branch:
            branch = Branch.get_main()
        serializer.save(branch=branch)


class CashSessionViewSet(viewsets.ModelViewSet):
    queryset = CashSession.objects.select_related('cash_register', 'cashier', 'closed_by').prefetch_related('transactions', 'payments')
    permission_classes = [IsAuthenticated, module_permissions('cash')]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'cashier', 'cash_register']
    ordering_fields = ['opened_at', 'closed_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return CashSessionListSerializer
        return CashSessionSerializer

    def perform_create(self, serializer):
        serializer.save(cashier=self.request.user)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Sesión abierta del usuario actual."""
        session = CashSession.objects.filter(cashier=request.user, status='OPEN').first()
        if not session:
            return Response({'detail': 'Sin sesión activa.'}, status=404)
        return Response(CashSessionSerializer(session).data)

    @action(detail=True, methods=['post'])
    def open_session(self, request, pk=None):
        session = self.get_object()
        if session.status != 'CLOSED':
            return Response({'detail': 'La sesión ya está abierta.'}, status=400)
        session.status = 'OPEN'
        session.save(update_fields=['status'])
        return Response(CashSessionSerializer(session).data)

    @action(detail=True, methods=['post'])
    def close_session(self, request, pk=None):
        session = self.get_object()
        if session.status != 'OPEN':
            return Response({'detail': 'La sesión no está abierta.'}, status=400)

        closing_amount = request.data.get('closing_amount', 0)
        closing_notes  = request.data.get('notes', '')

        # Calcular totales
        totals = session.transactions.aggregate(
            income=Sum('amount', filter=Q(transaction_type='INCOME')),
            expense=Sum('amount', filter=Q(transaction_type='EXPENSE')),
        )
        total_income  = Decimal(str(totals['income']  or 0))
        total_expense = Decimal(str(totals['expense'] or 0))
        expected = Decimal(str(session.opening_amount)) + total_income - total_expense
        diff = Decimal(str(closing_amount)) - expected

        session.status          = 'CLOSED'
        session.closing_amount  = closing_amount
        session.total_income    = total_income
        session.total_expense   = total_expense
        session.expected_closing = expected
        session.difference      = diff
        session.closed_at       = timezone.now()
        session.closed_by       = request.user
        session.closing_notes   = closing_notes
        session.save()
        return Response(CashSessionSerializer(session).data)

    @action(detail=True, methods=['post'])
    def add_transaction(self, request, pk=None):
        session = self.get_object()
        if session.status != 'OPEN':
            return Response({'detail': 'La sesión no está abierta.'}, status=400)
        serializer = CashTransactionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(session=session, created_by=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['get'])
    def closing_report(self, request, pk=None):
        """FIX #22: Reporte detallado de cierre de caja."""
        session = self.get_object()
        txns = session.transactions.all().order_by('created_at')
        payments = session.payments.select_related('loan', 'customer').all()

        by_method = {}
        for p in payments:
            method = p.get_payment_method_display()
            by_method.setdefault(method, {'count': 0, 'total': 0})
            by_method[method]['count'] += 1
            by_method[method]['total'] += float(p.total_amount)

        return Response({
            'session_id': str(session.pk),
            'register': session.cash_register.name if session.cash_register else '',
            'cashier': session.cashier.get_full_name() if session.cashier else '',
            'opened_at': session.opened_at,
            'closed_at': session.closed_at,
            'opening_amount': float(session.opening_amount),
            'closing_amount': float(session.closing_amount or 0),
            'total_income': float(session.total_income or 0),
            'total_expense': float(session.total_expense or 0),
            'expected_closing': float(session.expected_closing or 0),
            'difference': float(session.difference or 0),
            'payments_count': payments.count(),
            'payments_total': float(payments.aggregate(t=Sum('total_amount'))['t'] or 0),
            'by_payment_method': by_method,
            'transactions': [
                {'type': t.transaction_type, 'amount': float(t.amount),
                 'description': t.description, 'created_at': t.created_at}
                for t in txns
            ],
            'notes': session.closing_notes or '',
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        today = timezone.now().date()
        first_day = today.replace(day=1)
        sessions_today = CashSession.objects.filter(opened_at__date=today)
        sessions_month = CashSession.objects.filter(opened_at__date__gte=first_day)
        data = {
            'open_sessions': CashSession.objects.filter(status='OPEN').count(),
            'today_sessions': sessions_today.count(),
            'today_income': sessions_today.aggregate(t=Sum('total_income'))['t'] or 0,
            'today_expense': sessions_today.aggregate(t=Sum('total_expense'))['t'] or 0,
            'month_income': sessions_month.aggregate(t=Sum('total_income'))['t'] or 0,
            'month_expense': sessions_month.aggregate(t=Sum('total_expense'))['t'] or 0,
        }
        return Response(data)
