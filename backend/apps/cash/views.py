"""Gestión de caja: sesiones, transacciones y cierre."""
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import CashRegister, CashSession, CashTransaction
from .serializers import (
    CashRegisterSerializer, CashSessionSerializer,
    CashSessionListSerializer, CashTransactionSerializer,
)


class CashRegisterViewSet(viewsets.ModelViewSet):
    queryset = CashRegister.objects.filter(is_active=True).select_related('branch')
    permission_classes = [IsAuthenticated]
    serializer_class = CashRegisterSerializer


class CashSessionViewSet(viewsets.ModelViewSet):
    queryset = CashSession.objects.select_related('cash_register', 'cashier', 'closed_by').prefetch_related('transactions', 'payments')
    permission_classes = [IsAuthenticated]
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
