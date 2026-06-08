"""Contabilidad: catalogo de cuentas, periodos y asientos contables."""
from decimal import Decimal
from django.utils import timezone
from django.db.models import Count, Sum, Q
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import AccountType, Account, AccountingPeriod, JournalEntry, JournalEntryLine
from .serializers import (
    AccountTypeSerializer, AccountSerializer,
    AccountingPeriodSerializer, JournalEntrySerializer, JournalEntryLineSerializer,
)


class AccountTypeViewSet(viewsets.ModelViewSet):
    queryset           = AccountType.objects.all().order_by('code')
    serializer_class   = AccountTypeSerializer
    permission_classes = [IsAuthenticated]


class AccountViewSet(viewsets.ModelViewSet):
    queryset           = Account.objects.filter(is_active=True).select_related('account_type', 'parent').order_by('code')
    serializer_class   = AccountSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields   = ['account_type', 'is_detail', 'allows_transactions', 'level']
    search_fields      = ['code', 'name', 'description']

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Devuelve el catálogo de cuentas en estructura de árbol."""
        accounts = self.get_queryset().filter(parent__isnull=True)
        result = self._build_tree(accounts)
        return Response(result)

    def _build_tree(self, accounts):
        nodes = []
        for acc in accounts:
            children = Account.objects.filter(parent=acc, is_active=True).order_by('code')
            nodes.append({
                'id': acc.id, 'code': acc.code, 'name': acc.name,
                'level': acc.level, 'is_detail': acc.is_detail,
                'account_type': acc.account_type_id,
                'account_type_name': acc.account_type.name,
                'children': self._build_tree(children),
            })
        return nodes


class AccountingPeriodViewSet(viewsets.ModelViewSet):
    queryset           = AccountingPeriod.objects.all().order_by('-start_date')
    serializer_class   = AccountingPeriodSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        period = self.get_object()
        if period.is_closed:
            return Response({'detail': 'El periodo ya esta cerrado.'}, status=400)
        period.is_closed = True
        period.closed_by = request.user
        period.closed_at = timezone.now()
        period.save(update_fields=['is_closed', 'closed_by', 'closed_at'])
        return Response(AccountingPeriodSerializer(period, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def current(self, request):
        today = timezone.now().date()
        period = AccountingPeriod.objects.filter(
            start_date__lte=today, end_date__gte=today, is_closed=False
        ).first()
        if not period:
            return Response({'detail': 'No hay periodo contable abierto.'}, status=404)
        return Response(AccountingPeriodSerializer(period, context={'request': request}).data)


class JournalEntryViewSet(viewsets.ModelViewSet):
    queryset = JournalEntry.objects.select_related(
        'period', 'branch', 'created_by'
    ).prefetch_related('lines__account').order_by('-entry_date', '-created_at')
    serializer_class   = JournalEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['status', 'period', 'branch']
    search_fields      = ['entry_number', 'description', 'reference']
    ordering_fields    = ['entry_date', 'total_debit', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_superuser and hasattr(user, 'branch') and user.branch:
            qs = qs.filter(branch=user.branch)
        return qs

    @action(detail=True, methods=['post'])
    def post_entry(self, request, pk=None):
        """Contabilizar un asiento en borrador."""
        entry = self.get_object()
        if entry.status != 'DRAFT':
            return Response({'detail': 'Solo asientos en borrador pueden contabilizarse.'}, status=400)
        lines = entry.lines.all()
        total_debit  = sum(Decimal(str(l.debit))  for l in lines)
        total_credit = sum(Decimal(str(l.credit)) for l in lines)
        if abs(total_debit - total_credit) > Decimal('0.01'):
            return Response({'detail': f'El asiento no esta balanceado. Debito: {total_debit} / Credito: {total_credit}'}, status=400)
        entry.status       = 'POSTED'
        entry.total_debit  = total_debit
        entry.total_credit = total_credit
        entry.save(update_fields=['status', 'total_debit', 'total_credit'])
        return Response(JournalEntrySerializer(entry, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def cancel_entry(self, request, pk=None):
        entry = self.get_object()
        if entry.status == 'CANCELLED':
            return Response({'detail': 'Ya esta cancelado.'}, status=400)
        entry.status = 'CANCELLED'
        entry.save(update_fields=['status'])
        return Response(JournalEntrySerializer(entry, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def add_line(self, request, pk=None):
        entry = self.get_object()
        if entry.status == 'POSTED':
            return Response({'detail': 'No se pueden agregar lineas a un asiento contabilizado.'}, status=400)
        serializer = JournalEntryLineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(entry=entry)
        # Recalcular totales
        lines = entry.lines.all()
        entry.total_debit  = sum(Decimal(str(l.debit))  for l in lines)
        entry.total_credit = sum(Decimal(str(l.credit)) for l in lines)
        entry.save(update_fields=['total_debit', 'total_credit'])
        return Response(JournalEntrySerializer(entry, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        data = qs.aggregate(
            total=Count('id'),
            draft=Count('id', filter=Q(status='DRAFT')),
            posted=Count('id', filter=Q(status='POSTED')),
            cancelled=Count('id', filter=Q(status='CANCELLED')),
            total_debits=Sum('total_debit', filter=Q(status='POSTED')),
            total_credits=Sum('total_credit', filter=Q(status='POSTED')),
        )
        return Response(data)
