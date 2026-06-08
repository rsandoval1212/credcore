from rest_framework import serializers
from .models import LoanApplication, ApplicationWorkflowLog, ApplicationDocument


class ApplicationWorkflowLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    performed_by_name = serializers.CharField(source='performed_by.full_name', read_only=True)

    class Meta:
        model = ApplicationWorkflowLog
        fields = '__all__'


class ApplicationDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationDocument
        fields = '__all__'
        read_only_fields = ['uploaded_at', 'verified_by', 'verified_at']


class LoanApplicationListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_code = serializers.CharField(source='customer.customer_code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = LoanApplication
        fields = [
            'id', 'application_number', 'customer', 'customer_name', 'customer_code',
            'product', 'product_name', 'product_code', 'branch', 'branch_name',
            'requested_amount', 'requested_term_months', 'status', 'status_display',
            'current_step', 'assigned_to', 'assigned_to_name',
            'monthly_payment_estimate', 'debt_to_income_ratio', 'credit_score_at_application',
            'risk_level', 'approved_amount', 'submitted_at', 'created_at',
        ]


class LoanApplicationDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_code = serializers.CharField(source='customer.customer_code', read_only=True)
    customer_id_number = serializers.CharField(source='customer.id_number', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone1', read_only=True)
    customer_risk = serializers.CharField(source='customer.risk_level', read_only=True)
    customer_credit_score = serializers.IntegerField(source='customer.credit_score', read_only=True)
    customer_income = serializers.DecimalField(source='customer.monthly_income', max_digits=15, decimal_places=2, read_only=True)

    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_rate = serializers.DecimalField(source='product.annual_interest_rate', max_digits=6, decimal_places=3, read_only=True)
    product_type = serializers.CharField(source='product.product_type', read_only=True)

    branch_name = serializers.CharField(source='branch.name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    rejected_by_name = serializers.CharField(source='rejected_by.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    workflow_logs = ApplicationWorkflowLogSerializer(many=True, read_only=True)
    documents = ApplicationDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = LoanApplication
        fields = '__all__'
        read_only_fields = [
            'application_number', 'submitted_at', 'approved_at',
            'rejected_at', 'disbursed_at', 'rejected_by',
        ]
