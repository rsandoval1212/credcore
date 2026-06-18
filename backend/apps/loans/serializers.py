from rest_framework import serializers
from .models import Loan, LoanSchedule
from apps.customers.serializers import CustomerListSerializer


class LoanScheduleSerializer(serializers.ModelSerializer):
    is_overdue = serializers.BooleanField(read_only=True)
    balance_due = serializers.SerializerMethodField()

    class Meta:
        model = LoanSchedule
        fields = '__all__'

    def get_balance_due(self, obj):
        """Monto pendiente de pago en esta cuota."""
        return float(obj.total_amount) - float(obj.total_paid)


class LoanListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_code = serializers.CharField(source='customer.customer_code', read_only=True)
    product_name  = serializers.CharField(source='product.name', read_only=True)
    branch_name   = serializers.CharField(source='branch.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_frequency_display = serializers.CharField(source='get_payment_frequency_display', read_only=True)
    total_outstanding = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            'id', 'loan_number', 'customer', 'customer_name', 'customer_code',
            'product_name', 'branch_name', 'principal_amount', 'outstanding_principal',
            'outstanding_interest', 'outstanding_late_fees', 'total_outstanding',
            'monthly_payment', 'annual_interest_rate', 'term_months',
            'payment_frequency', 'payment_frequency_display',
            'total_installments', 'client_installments', 'is_confidential',
            'status', 'status_display', 'days_past_due',
            'disbursement_date', 'maturity_date',
            'installments_paid', 'installments_remaining', 'total_paid',
        ]

    def get_total_outstanding(self, obj):
        return (
            float(obj.outstanding_principal) +
            float(obj.outstanding_interest) +
            float(obj.outstanding_late_fees)
        )


class LoanDetailSerializer(serializers.ModelSerializer):
    customer_data  = CustomerListSerializer(source='customer', read_only=True)
    product_name   = serializers.CharField(source='product.name', read_only=True)
    product_code   = serializers.CharField(source='product.code', read_only=True)
    branch_name    = serializers.CharField(source='branch.name', read_only=True)
    officer_name   = serializers.CharField(source='officer.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    schedule       = LoanScheduleSerializer(many=True, read_only=True)
    total_outstanding = serializers.SerializerMethodField()
    next_payment   = serializers.SerializerMethodField()
    overdue_installments = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = '__all__'
        read_only_fields = [
            'loan_number', 'monthly_payment', 'total_interest', 'total_to_pay',
            'outstanding_principal', 'outstanding_interest', 'outstanding_late_fees',
            'total_paid', 'days_past_due', 'installments_paid', 'installments_remaining',
        ]

    def get_total_outstanding(self, obj):
        return (
            float(obj.outstanding_principal) +
            float(obj.outstanding_interest) +
            float(obj.outstanding_late_fees)
        )

    def get_next_payment(self, obj):
        nxt = obj.schedule.filter(status__in=['PENDING', 'PARTIAL', 'OVERDUE']).first()
        if nxt:
            return {
                'installment_number': nxt.installment_number,
                'due_date': nxt.due_date,
                'total_amount': float(nxt.total_amount),
                'total_paid': float(nxt.total_paid),
                'status': nxt.status,
                'is_overdue': nxt.is_overdue,
            }
        return None

    def get_overdue_installments(self, obj):
        from django.utils import timezone
        return obj.schedule.filter(
            status__in=['PENDING', 'PARTIAL'],
            due_date__lt=timezone.now().date()
        ).count()


class LoanSimulatorSerializer(serializers.Serializer):
    product_id  = serializers.IntegerField()
    amount      = serializers.DecimalField(max_digits=15, decimal_places=2)
    term_months = serializers.IntegerField(min_value=1, max_value=360)
    start_date  = serializers.DateField(required=False)
