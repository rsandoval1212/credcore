"""Workflow completo de solicitudes de préstamo."""
from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import LoanApplication, ApplicationWorkflowLog, ApplicationDocument
from .serializers import (
    LoanApplicationListSerializer, LoanApplicationDetailSerializer,
    ApplicationWorkflowLogSerializer, ApplicationDocumentSerializer,
)


class LoanApplicationViewSet(viewsets.ModelViewSet):
    queryset = LoanApplication.objects.filter(is_deleted=False).select_related(
        'customer', 'product', 'branch', 'assigned_to', 'rejected_by'
    ).prefetch_related('workflow_logs', 'documents')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'branch', 'product', 'assigned_to', 'risk_level']
    search_fields = [
        'application_number',
        'customer__first_name', 'customer__last_name',
        'customer__id_number', 'customer__customer_code',
    ]
    ordering_fields = ['created_at', 'requested_amount', 'submitted_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return LoanApplicationListSerializer
        return LoanApplicationDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_superuser and hasattr(user, 'branch') and user.branch:
            qs = qs.filter(branch=user.branch)
        return qs

    def perform_create(self, serializer):
        # Permitir tasa personalizada al crear la solicitud
        custom_rate = self.request.data.get('approved_rate')
        app = serializer.save(created_by=self.request.user)
        if custom_rate:
            try:
                app.approved_rate = Decimal(str(custom_rate))
                app.save(update_fields=['approved_rate'])
            except Exception:
                pass
        self._auto_analyze(app)

    def _auto_analyze(self, app):
        """Calcula métricas automáticas al crear/recalcular la solicitud.
        Usa approved_rate si está definida, de lo contrario usa la tasa del producto."""
        product = app.product
        customer = app.customer
        amount = app.requested_amount
        term = app.requested_term_months
        # Priorizar tasa personalizada sobre la del producto
        annual_rate = app.approved_rate if app.approved_rate else product.annual_interest_rate
        rate = annual_rate / Decimal('100') / Decimal('12')

        # Cuota nivelada (sistema francés)
        if rate > 0:
            monthly = amount * rate / (1 - (1 + rate) ** (-term))
        else:
            monthly = amount / term

        # DTI ratio (campo max_digits=5, decimal_places=2 → máx 999.99)
        income = customer.monthly_income if customer.monthly_income and customer.monthly_income > 0 else None
        if income:
            dti = min((monthly / income * 100).quantize(Decimal('0.01')), Decimal('999.99'))
        else:
            dti = Decimal('0.00')  # Sin datos de ingreso → no calcular DTI

        # Risk level
        score = customer.credit_score or 0
        if dti > 50 or score < 400:
            risk = 'HIGH'
        elif dti > 35 or score < 600:
            risk = 'MEDIUM'
        else:
            risk = 'LOW'

        app.monthly_payment_estimate = monthly.quantize(Decimal('0.01'))
        app.debt_to_income_ratio = dti
        app.credit_score_at_application = score
        app.risk_level = risk
        app.save(update_fields=[
            'monthly_payment_estimate', 'debt_to_income_ratio',
            'credit_score_at_application', 'risk_level',
        ])

    # ── Workflow actions ───────────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Enviar solicitud para revisión."""
        app = self.get_object()
        if app.status != 'DRAFT':
            return Response({'detail': 'Solo borradores pueden enviarse.'}, status=400)
        app.status = 'SUBMITTED'
        app.submitted_at = timezone.now()
        app.current_step = 1
        app.save(update_fields=['status', 'submitted_at', 'current_step'])
        self._log(app, 'SUBMITTED', request.user, 'Solicitud enviada para revisión')
        return Response(LoanApplicationDetailSerializer(app).data)

    @action(detail=True, methods=['post'])
    def start_review(self, request, pk=None):
        """Tomar solicitud para revisión."""
        app = self.get_object()
        if app.status != 'SUBMITTED':
            return Response({'detail': 'Solo solicitudes enviadas pueden revisarse.'}, status=400)
        app.status = 'UNDER_REVIEW'
        app.assigned_to = request.user
        app.save(update_fields=['status', 'assigned_to'])
        self._log(app, 'APPROVED_STEP', request.user, 'Solicitud tomada para revisión')
        return Response(LoanApplicationDetailSerializer(app).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Aprobar solicitud."""
        app = self.get_object()
        if app.status not in ('SUBMITTED', 'UNDER_REVIEW'):
            return Response({'detail': 'La solicitud no puede aprobarse en su estado actual.'}, status=400)

        approved_amount = request.data.get('approved_amount', app.requested_amount)
        approved_term = request.data.get('approved_term_months', app.requested_term_months)
        approved_rate = request.data.get('approved_rate', app.product.annual_interest_rate)
        comments = request.data.get('comments', '')

        app.status = 'APPROVED'
        app.approved_amount = approved_amount
        app.approved_term_months = approved_term
        app.approved_rate = approved_rate
        app.approved_at = timezone.now()
        app.save(update_fields=[
            'status', 'approved_amount', 'approved_term_months',
            'approved_rate', 'approved_at',
        ])
        self._log(app, 'APPROVED_STEP', request.user, comments or 'Solicitud aprobada')
        return Response(LoanApplicationDetailSerializer(app).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Rechazar solicitud."""
        app = self.get_object()
        if app.status in ('APPROVED', 'DISBURSED', 'CANCELLED'):
            return Response({'detail': 'No se puede rechazar en este estado.'}, status=400)
        reason = request.data.get('reason', '')
        if not reason:
            return Response({'detail': 'Debe indicar el motivo del rechazo.'}, status=400)
        app.status = 'REJECTED'
        app.rejection_reason = reason
        app.rejected_at = timezone.now()
        app.rejected_by = request.user
        app.save(update_fields=['status', 'rejection_reason', 'rejected_at', 'rejected_by'])
        self._log(app, 'REJECTED', request.user, reason)
        return Response(LoanApplicationDetailSerializer(app).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancelar solicitud."""
        app = self.get_object()
        if app.status in ('APPROVED', 'DISBURSED'):
            return Response({'detail': 'No se puede cancelar en este estado.'}, status=400)
        app.status = 'CANCELLED'
        app.save(update_fields=['status'])
        self._log(app, 'CANCELLED', request.user, request.data.get('reason', 'Cancelada'))
        return Response(LoanApplicationDetailSerializer(app).data)

    @action(detail=True, methods=['post'])
    def disburse(self, request, pk=None):
        """Marcar como desembolsada y crear el préstamo."""
        app = self.get_object()
        if app.status != 'APPROVED':
            return Response({'detail': 'Solo solicitudes aprobadas pueden desembolsarse.'}, status=400)

        # Crear préstamo automáticamente
        from apps.loans.models import Loan
        from decimal import Decimal

        amount = Decimal(str(app.approved_amount or app.requested_amount))
        term = app.approved_term_months or app.requested_term_months
        rate = app.approved_rate or app.product.annual_interest_rate

        monthly_rate = rate / Decimal('100') / Decimal('12')
        if monthly_rate > 0:
            monthly_payment = amount * monthly_rate / (1 - (1 + monthly_rate) ** (-term))
        else:
            monthly_payment = amount / term

        disbursement_date = timezone.now().date()
        from dateutil.relativedelta import relativedelta
        maturity_date = disbursement_date + relativedelta(months=term)

        loan = Loan.objects.create(
            customer=app.customer,
            product=app.product,
            branch=app.branch,
            application=app,
            principal_amount=amount,
            outstanding_principal=amount,
            annual_interest_rate=rate,
            term_months=term,
            monthly_payment=monthly_payment.quantize(Decimal('0.01')),
            disbursement_date=disbursement_date,
            maturity_date=maturity_date,
            status='ACTIVE',
            created_by=request.user,
        )

        # Generar tabla de amortización
        try:
            loan.generate_schedule()
        except Exception:
            pass

        app.status = 'DISBURSED'
        app.disbursed_at = timezone.now()
        app.save(update_fields=['status', 'disbursed_at'])
        self._log(app, 'DISBURSED', request.user, f'Préstamo {loan.loan_number} creado')

        from apps.loans.serializers import LoanDetailSerializer
        return Response({
            'application': LoanApplicationDetailSerializer(app).data,
            'loan': LoanDetailSerializer(loan).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def upload_document(self, request, pk=None):
        app = self.get_object()
        serializer = ApplicationDocumentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(application=app)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """Recalcular métricas financieras."""
        app = self.get_object()
        self._auto_analyze(app)
        return Response(LoanApplicationDetailSerializer(app).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Estadísticas del módulo de solicitudes."""
        qs = self.get_queryset()
        from django.db.models import Count, Sum
        data = qs.aggregate(
            total=Count('id'),
            draft=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(status='DRAFT')),
            submitted=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(status='SUBMITTED')),
            under_review=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(status='UNDER_REVIEW')),
            approved=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(status='APPROVED')),
            rejected=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(status='REJECTED')),
            disbursed=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(status='DISBURSED')),
            total_requested=Sum('requested_amount'),
            total_approved=Sum('approved_amount'),
        )
        return Response(data)

    def _log(self, app, action, user, comments=''):
        ApplicationWorkflowLog.objects.create(
            application=app,
            step=app.current_step,
            action=action,
            performed_by=user,
            comments=comments,
        )
