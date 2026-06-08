"""Vistas de reportes con exportación a PDF y Excel."""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class LoanReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.loans.models import Loan
        from django.db.models import Sum, Count
        qs = Loan.objects.filter(is_deleted=False)
        summary = qs.aggregate(
            total_count=Count('id'),
            total_principal=Sum('principal_amount'),
            total_outstanding=Sum('outstanding_principal'),
            total_paid=Sum('total_paid'),
        )
        by_status = qs.values('status').annotate(count=Count('id'), total=Sum('outstanding_principal'))
        return Response({'summary': summary, 'by_status': list(by_status)})


class PaymentReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.payments.models import Payment
        from django.db.models import Sum, Count
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        qs = Payment.objects.filter(status='CONFIRMED')
        if date_from:
            qs = qs.filter(payment_date__gte=date_from)
        if date_to:
            qs = qs.filter(payment_date__lte=date_to)
        summary = qs.aggregate(
            total_count=Count('id'),
            total_amount=Sum('total_amount'),
            total_principal=Sum('principal_amount'),
            total_interest=Sum('interest_amount'),
            total_late_fees=Sum('late_fee_amount'),
        )
        return Response(summary)


class CollectionReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'message': 'Reporte de cobranza - implementar'})


class PortfolioReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.loans.models import Loan
        from django.db.models import Sum, Count
        buckets = [
            ('Al día', 0, 0), ('1-30 días', 1, 30),
            ('31-60 días', 31, 60), ('61-90 días', 61, 90),
            ('91-120 días', 91, 120), ('+120 días', 121, 9999),
        ]
        result = []
        for label, min_days, max_days in buckets:
            qs = Loan.objects.filter(status='ACTIVE', is_deleted=False)
            if min_days == 0:
                qs = qs.filter(days_past_due=0)
            else:
                qs = qs.filter(days_past_due__gte=min_days, days_past_due__lte=max_days)
            agg = qs.aggregate(count=Count('id'), total=Sum('outstanding_principal'))
            result.append({'bucket': label, **agg})
        return Response(result)
