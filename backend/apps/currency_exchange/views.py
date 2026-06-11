"""
Vistas para el módulo de Cambio de Divisas.
"""
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from apps.core.permissions import module_permissions
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.mixins import SoftDeleteViewSetMixin
from apps.core.utils import generate_code
from .models import ExchangeRate, CurrencyTransaction
from .serializers import (
    ExchangeRateSerializer,
    CurrencyTransactionSerializer,
    CurrencyTransactionCreateSerializer,
)


class ExchangeRateViewSet(viewsets.ModelViewSet):
    """CRUD de tasas de cambio diarias."""
    queryset = ExchangeRate.objects.all()
    serializer_class = ExchangeRateSerializer
    permission_classes = [IsAuthenticated, module_permissions('currency_exchange')]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_active', 'date']
    ordering_fields = ['date']

    def perform_create(self, serializer):
        serializer.save(set_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(set_by=self.request.user)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Retorna la tasa vigente de hoy (o la más reciente)."""
        today = timezone.now().date()
        rate = ExchangeRate.objects.filter(
            date__lte=today, is_active=True
        ).order_by('-date').first()
        if not rate:
            return Response({'detail': 'No hay tasa de cambio configurada.'}, status=404)
        return Response(ExchangeRateSerializer(rate).data)


class CurrencyTransactionViewSet(SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    """Compra y venta de dólares."""
    queryset = CurrencyTransaction.objects.filter(is_deleted=False).select_related(
        'exchange_rate', 'customer', 'operator', 'branch', 'cash_session'
    )
    serializer_class = CurrencyTransactionSerializer
    permission_classes = [IsAuthenticated, module_permissions('currency_exchange')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['operation', 'status', 'payment_method', 'branch']
    search_fields = ['receipt_number', 'customer_name', 'customer_id_number', 'notes']
    ordering_fields = ['created_at', 'usd_amount', 'dop_amount']

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        ser = CurrencyTransactionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        operation = d['operation']
        usd_amount = Decimal(str(d['usd_amount']))

        # Obtener tasa vigente
        today = timezone.now().date()
        rate_obj = ExchangeRate.objects.filter(
            date__lte=today, is_active=True
        ).order_by('-date').first()

        if not rate_obj:
            raise ValidationError({'detail': 'No hay tasa de cambio configurada. Configure una tasa antes de operar.'})

        # Tasa aplicada (puede ser override manual o la del día)
        if 'rate_applied' in d and d['rate_applied']:
            rate_applied = Decimal(str(d['rate_applied']))
        else:
            rate_applied = rate_obj.buy_rate if operation == 'BUY' else rate_obj.sell_rate

        # Calcular montos
        dop_amount = (usd_amount * rate_applied).quantize(Decimal('0.01'))

        # Calcular ganancia
        if operation == 'BUY':
            # Compramos USD: ganancia potencial = diferencia con venta
            profit = (usd_amount * (rate_obj.sell_rate - rate_applied)).quantize(Decimal('0.01'))
        else:
            # Vendemos USD: ganancia = diferencia con compra
            profit = (usd_amount * (rate_applied - rate_obj.buy_rate)).quantize(Decimal('0.01'))

        # Validar cédula para montos >= US$500 (regulación DGII)
        if usd_amount >= 500 and not d.get('customer_id_number') and not d.get('customer'):
            raise ValidationError({
                'customer_id_number': 'Requerido por regulación para montos >= US$500.'
            })

        # Generar número de recibo
        receipt_number = generate_code(
            prefix='CX',
            model_class=CurrencyTransaction,
            field_name='receipt_number',
        )

        # Buscar cliente registrado
        customer_obj = None
        if d.get('customer'):
            from apps.customers.models import Customer
            try:
                customer_obj = Customer.objects.get(pk=d['customer'])
            except Customer.DoesNotExist:
                pass

        txn = CurrencyTransaction.objects.create(
            operation=operation,
            exchange_rate=rate_obj,
            rate_applied=rate_applied,
            usd_amount=usd_amount,
            dop_amount=dop_amount,
            profit=profit,
            customer=customer_obj,
            customer_name=d.get('customer_name', ''),
            customer_id_number=d.get('customer_id_number', ''),
            customer_phone=d.get('customer_phone', ''),
            payment_method=d.get('payment_method', 'CASH'),
            reference_number=d.get('reference_number', ''),
            receipt_number=receipt_number,
            branch=getattr(request.user, 'branch', None),
            operator=request.user,
            created_by=request.user,
            notes=d.get('notes', ''),
        )

        return Response(
            CurrencyTransactionSerializer(txn).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Anular una transacción de cambio."""
        txn = self.get_object()
        if txn.status == 'CANCELLED':
            return Response({'detail': 'Ya está anulada.'}, status=400)
        reason = request.data.get('reason', '')
        txn.status = 'CANCELLED'
        txn.cancelled_reason = reason
        txn.save(update_fields=['status', 'cancelled_reason'])
        return Response(CurrencyTransactionSerializer(txn).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Estadísticas del módulo de cambio."""
        qs = self.get_queryset().filter(status='COMPLETED')
        today = timezone.now().date()
        first_day = today.replace(day=1)

        data = {
            # Hoy
            'today_buy_count': qs.filter(operation='BUY', created_at__date=today).count(),
            'today_buy_usd': qs.filter(operation='BUY', created_at__date=today).aggregate(t=Sum('usd_amount'))['t'] or 0,
            'today_buy_dop': qs.filter(operation='BUY', created_at__date=today).aggregate(t=Sum('dop_amount'))['t'] or 0,
            'today_sell_count': qs.filter(operation='SELL', created_at__date=today).count(),
            'today_sell_usd': qs.filter(operation='SELL', created_at__date=today).aggregate(t=Sum('usd_amount'))['t'] or 0,
            'today_sell_dop': qs.filter(operation='SELL', created_at__date=today).aggregate(t=Sum('dop_amount'))['t'] or 0,
            'today_profit': qs.filter(created_at__date=today).aggregate(t=Sum('profit'))['t'] or 0,
            # Mes
            'month_buy_usd': qs.filter(operation='BUY', created_at__date__gte=first_day).aggregate(t=Sum('usd_amount'))['t'] or 0,
            'month_sell_usd': qs.filter(operation='SELL', created_at__date__gte=first_day).aggregate(t=Sum('usd_amount'))['t'] or 0,
            'month_profit': qs.filter(created_at__date__gte=first_day).aggregate(t=Sum('profit'))['t'] or 0,
            'month_count': qs.filter(created_at__date__gte=first_day).count(),
            # Totales
            'total_transactions': qs.count(),
            'total_profit': qs.aggregate(t=Sum('profit'))['t'] or 0,
        }

        # Tasa vigente
        rate = ExchangeRate.objects.filter(date__lte=today, is_active=True).order_by('-date').first()
        if rate:
            data['current_buy_rate'] = rate.buy_rate
            data['current_sell_rate'] = rate.sell_rate
            data['current_spread'] = rate.spread
            data['rate_date'] = rate.date

        return Response(data)

    @action(detail=False, methods=['get'])
    def calculator(self, request):
        """Calculadora rápida: dado un monto y operación, retorna el resultado."""
        operation = request.query_params.get('operation', 'BUY')
        amount = request.query_params.get('amount', '0')
        currency = request.query_params.get('currency', 'USD')  # USD o DOP

        try:
            amount = Decimal(amount)
        except Exception:
            return Response({'detail': 'Monto inválido.'}, status=400)

        today = timezone.now().date()
        rate = ExchangeRate.objects.filter(date__lte=today, is_active=True).order_by('-date').first()
        if not rate:
            return Response({'detail': 'No hay tasa configurada.'}, status=404)

        rate_val = rate.buy_rate if operation == 'BUY' else rate.sell_rate

        if currency == 'USD':
            usd = amount
            dop = (amount * rate_val).quantize(Decimal('0.01'))
        else:
            dop = amount
            usd = (amount / rate_val).quantize(Decimal('0.01'))

        return Response({
            'operation': operation,
            'rate': rate_val,
            'usd_amount': usd,
            'dop_amount': dop,
            'rate_date': rate.date,
        })
