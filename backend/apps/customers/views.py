from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import module_permissions
from .models import (
    Customer, CustomerDocument, CustomerActivity,
    CustomerCreditEvaluation, CustomerReference,
    CustomerCommercialReference, CustomerBankReference,
    CustomerGuarantor, CustomerEmployment, CustomerBusiness, CustomerFinancialInfo,
)
from .serializers import (
    CustomerListSerializer, CustomerDetailSerializer, CustomerDocumentSerializer,
    CustomerActivitySerializer, CustomerCreditEvaluationSerializer,
    CustomerReferenceSerializer, CustomerCommercialReferenceSerializer,
    CustomerBankReferenceSerializer, CustomerGuarantorSerializer,
    CustomerEmploymentSerializer, CustomerBusinessSerializer, CustomerFinancialInfoSerializer,
)


from apps.core.mixins import SoftDeleteViewSetMixin, AutoMainBranchMixin


class CustomerViewSet(AutoMainBranchMixin, SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.filter(is_deleted=False).select_related(
        'branch', 'assigned_officer', 'financial_summary', 'employment', 'business', 'financial_info'
    ).prefetch_related('references', 'commercial_references', 'bank_references', 'documents', 'guarantors')
    permission_classes = [IsAuthenticated, module_permissions('customers')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'status': ['exact'],
        'risk_level': ['exact'],
        'customer_type': ['exact'],
        'branch': ['exact'],
        'is_blacklisted': ['exact'],
        'created_at': ['gte', 'lte', 'date__gte', 'date__lte'],
    }
    search_fields = ['first_name', 'last_name', 'company_name', 'id_number', 'customer_code', 'phone1', 'email']
    ordering_fields = ['created_at', 'last_name', 'outstanding_balance', 'credit_score']

    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerListSerializer
        return CustomerDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_superuser and hasattr(user, 'branch') and user.branch:
            qs = qs.filter(branch=user.branch)
        return qs

    # ── Historial de préstamos ────────────────────────────────────────────────
    @action(detail=True, methods=['get'])
    def loan_history(self, request, pk=None):
        customer = self.get_object()
        from apps.loans.serializers import LoanListSerializer
        from apps.loans.models import Loan
        loans = Loan.objects.filter(customer=customer, is_deleted=False).select_related('product')
        return Response(LoanListSerializer(loans, many=True).data)

    # ── Historial de pagos ────────────────────────────────────────────────────
    @action(detail=True, methods=['get'])
    def payment_history(self, request, pk=None):
        customer = self.get_object()
        from apps.payments.serializers import PaymentSerializer
        from apps.payments.models import Payment
        payments = Payment.objects.filter(customer=customer).order_by('-created_at')[:50]
        return Response(PaymentSerializer(payments, many=True).data)

    # ── Documentos ────────────────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def upload_document(self, request, pk=None):
        customer = self.get_object()
        serializer = CustomerDocumentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(customer=customer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'], url_path='documents/(?P<doc_id>[^/.]+)/verify')
    def verify_document(self, request, pk=None, doc_id=None):
        customer = self.get_object()
        try:
            doc = customer.documents.get(pk=doc_id)
        except CustomerDocument.DoesNotExist:
            return Response({'detail': 'Documento no encontrado.'}, status=404)
        doc.is_verified = True
        doc.verified_by = request.user
        doc.verified_at = timezone.now()
        doc.save()
        return Response(CustomerDocumentSerializer(doc).data)

    # ── Actividades ───────────────────────────────────────────────────────────
    @action(detail=True, methods=['get', 'post'])
    def activities(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            acts = customer.activities.all()
            return Response(CustomerActivitySerializer(acts, many=True).data)
        serializer = CustomerActivitySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(customer=customer, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ── Evaluación crediticia ─────────────────────────────────────────────────
    @action(detail=True, methods=['get', 'post'])
    def credit_evaluation(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            evals = customer.credit_evaluations.all()[:5]
            return Response(CustomerCreditEvaluationSerializer(evals, many=True).data)
        # Calcular score automático
        score, factors, rating = self._calculate_score(customer)
        income = float(customer.monthly_income or 0) + float(customer.other_income or 0)
        recommended = income * 3 if income > 0 else 0
        ev = CustomerCreditEvaluation.objects.create(
            customer=customer,
            score=score,
            rating=rating,
            recommended_max_amount=recommended,
            risk_factors=factors,
            ai_summary=self._generate_summary(customer, score, rating),
            evaluated_by=request.user,
        )
        # Actualizar credit_score y risk_level en cliente
        customer.credit_score = score
        if score >= 750:
            customer.risk_level = 'LOW'
        elif score >= 500:
            customer.risk_level = 'MEDIUM'
        else:
            customer.risk_level = 'HIGH'
        customer.save(update_fields=['credit_score', 'risk_level'])
        return Response(CustomerCreditEvaluationSerializer(ev).data, status=status.HTTP_201_CREATED)

    def _calculate_score(self, customer):
        score = 0
        factors = []
        # Edad (max 100)
        if customer.date_of_birth:
            from datetime import date
            age = (date.today() - customer.date_of_birth).days // 365
            if 25 <= age <= 55:
                score += 100
            elif 18 <= age < 25 or 55 < age <= 65:
                score += 60
            else:
                score += 30
                factors.append('Edad fuera del rango óptimo')
        else:
            score += 50
        # Ingresos (max 250)
        income = float(customer.monthly_income or 0)
        if income >= 50000:
            score += 250
        elif income >= 25000:
            score += 180
        elif income >= 10000:
            score += 100
        else:
            score += 40
            if income == 0:
                factors.append('Sin ingresos registrados')
        # Historial (max 300)
        if customer.total_loans_count > 0:
            rate = float(getattr(getattr(customer, 'financial_summary', None), 'payment_on_time_rate', 0) or 0)
            if rate >= 95:
                score += 300
            elif rate >= 80:
                score += 200
            elif rate >= 60:
                score += 100
            else:
                score += 30
                factors.append('Mal historial de pagos')
        else:
            score += 150  # sin historial = neutro
        # Endeudamiento (max 200)
        expenses = float(customer.monthly_expenses or 0)
        if income > 0:
            debt_ratio = expenses / income
            if debt_ratio < 0.3:
                score += 200
            elif debt_ratio < 0.5:
                score += 130
            elif debt_ratio < 0.7:
                score += 70
            else:
                score += 20
                factors.append('Alto nivel de endeudamiento')
        else:
            score += 100
        # Antigüedad laboral (max 150)
        years = customer.employment_years or 0
        if years >= 5:
            score += 150
        elif years >= 2:
            score += 100
        elif years >= 1:
            score += 60
        else:
            score += 30
            factors.append('Poca antigüedad laboral')
        # Garantías (bonus)
        docs_count = customer.documents.filter(is_verified=True).count()
        if docs_count >= 5:
            score += 50
        elif docs_count >= 3:
            score += 30
        score = min(score, 1000)
        if score >= 800:
            rating = 'EXCELLENT'
        elif score >= 600:
            rating = 'GOOD'
        elif score >= 400:
            rating = 'REGULAR'
        else:
            rating = 'RISKY'
            factors.append('Score crediticio bajo')
        return score, factors, rating

    def _generate_summary(self, customer, score, rating):
        rating_text = {'EXCELLENT': 'excelente', 'GOOD': 'bueno', 'REGULAR': 'regular', 'RISKY': 'riesgoso'}
        income = float(customer.monthly_income or 0)
        return (
            f"El cliente {customer.get_full_name()} presenta un perfil crediticio {rating_text.get(rating, 'regular')} "
            f"con un score de {score}/1000. "
            f"{'Cuenta con historial crediticio previo.' if customer.total_loans_count > 0 else 'Es cliente nuevo sin historial.'} "
            f"{'Sus ingresos mensuales de RD$' + f'{income:,.0f}' + ' respaldan su capacidad de pago.' if income > 0 else 'No se registraron ingresos.'}"
        )

    # ── Sub-recursos: empleo, negocio, info financiera ────────────────────────
    @action(detail=True, methods=['get', 'put', 'patch'], url_path='employment')
    def employment(self, request, pk=None):
        customer = self.get_object()
        emp, _ = CustomerEmployment.objects.get_or_create(customer=customer)
        if request.method == 'GET':
            return Response(CustomerEmploymentSerializer(emp).data)
        serializer = CustomerEmploymentSerializer(emp, data=request.data, partial=request.method == 'PATCH')
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['get', 'put', 'patch'], url_path='business')
    def business(self, request, pk=None):
        customer = self.get_object()
        biz, _ = CustomerBusiness.objects.get_or_create(customer=customer)
        if request.method == 'GET':
            return Response(CustomerBusinessSerializer(biz).data)
        serializer = CustomerBusinessSerializer(biz, data=request.data, partial=request.method == 'PATCH')
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['get', 'put', 'patch'], url_path='financial-info')
    def financial_info(self, request, pk=None):
        customer = self.get_object()
        fi, _ = CustomerFinancialInfo.objects.get_or_create(customer=customer)
        if request.method == 'GET':
            return Response(CustomerFinancialInfoSerializer(fi).data)
        serializer = CustomerFinancialInfoSerializer(fi, data=request.data, partial=request.method == 'PATCH')
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    # ── Referencias ───────────────────────────────────────────────────────────
    @action(detail=True, methods=['get', 'post'], url_path='references-personal')
    def references_personal(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            return Response(CustomerReferenceSerializer(customer.references.all(), many=True).data)
        s = CustomerReferenceSerializer(data=request.data)
        if s.is_valid():
            s.save(customer=customer)
            return Response(s.data, status=201)
        return Response(s.errors, status=400)

    @action(detail=True, methods=['get', 'post'], url_path='references-commercial')
    def references_commercial(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            return Response(CustomerCommercialReferenceSerializer(customer.commercial_references.all(), many=True).data)
        s = CustomerCommercialReferenceSerializer(data=request.data)
        if s.is_valid():
            s.save(customer=customer)
            return Response(s.data, status=201)
        return Response(s.errors, status=400)

    @action(detail=True, methods=['get', 'post'], url_path='references-bank')
    def references_bank(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            return Response(CustomerBankReferenceSerializer(customer.bank_references.all(), many=True).data)
        s = CustomerBankReferenceSerializer(data=request.data)
        if s.is_valid():
            s.save(customer=customer)
            return Response(s.data, status=201)
        return Response(s.errors, status=400)

    @action(detail=True, methods=['get', 'post'])
    def guarantors(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            return Response(CustomerGuarantorSerializer(customer.guarantors.all(), many=True).data)
        s = CustomerGuarantorSerializer(data=request.data)
        if s.is_valid():
            s.save(customer=customer)
            return Response(s.data, status=201)
        return Response(s.errors, status=400)
