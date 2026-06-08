from rest_framework import serializers
from .models import (
    Customer, CustomerReference, CustomerCommercialReference,
    CustomerBankReference, CustomerDocument, CustomerFinancialSummary,
    CustomerEmployment, CustomerBusiness, CustomerFinancialInfo,
    CustomerGuarantor, CustomerActivity, CustomerCreditEvaluation,
)


class CustomerEmploymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerEmployment
        exclude = ['customer']


class CustomerBusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerBusiness
        exclude = ['customer']


class CustomerFinancialInfoSerializer(serializers.ModelSerializer):
    total_income = serializers.ReadOnlyField()
    total_expenses = serializers.ReadOnlyField()
    payment_capacity = serializers.ReadOnlyField()

    class Meta:
        model = CustomerFinancialInfo
        exclude = ['customer']


class CustomerReferenceSerializer(serializers.ModelSerializer):
    relationship_display = serializers.CharField(source='get_relationship_display', read_only=True)

    class Meta:
        model = CustomerReference
        fields = '__all__'
        read_only_fields = ['customer']


class CustomerCommercialReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerCommercialReference
        fields = '__all__'
        read_only_fields = ['customer']


class CustomerBankReferenceSerializer(serializers.ModelSerializer):
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)

    class Meta:
        model = CustomerBankReference
        fields = '__all__'
        read_only_fields = ['customer']


class CustomerGuarantorSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerGuarantor
        fields = '__all__'
        read_only_fields = ['customer']


class CustomerActivitySerializer(serializers.ModelSerializer):
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    result_display = serializers.CharField(source='get_result_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = CustomerActivity
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'customer']


class CustomerCreditEvaluationSerializer(serializers.ModelSerializer):
    rating_display = serializers.CharField(source='get_rating_display', read_only=True)

    class Meta:
        model = CustomerCreditEvaluation
        fields = '__all__'
        read_only_fields = ['evaluated_at', 'evaluated_by']


class CustomerDocumentSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)

    class Meta:
        model = CustomerDocument
        fields = '__all__'
        read_only_fields = ['uploaded_at', 'verified_by', 'verified_at']


class CustomerFinancialSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerFinancialSummary
        exclude = ['customer']


class CustomerListSerializer(serializers.ModelSerializer):
    """Serializer liviano para listados."""
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id', 'customer_code', 'customer_type', 'full_name', 'id_type', 'id_number',
            'phone1', 'phone2', 'email', 'whatsapp',
            'status', 'status_display', 'risk_level', 'risk_level_display',
            'credit_score', 'active_loans_count', 'total_loans_count',
            'outstanding_balance', 'total_paid', 'photo',
            'monthly_income', 'other_income', 'monthly_expenses',
            'branch', 'created_at', 'province', 'city',
        ]


class CustomerDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    marital_status_display = serializers.CharField(source='get_marital_status_display', read_only=True)
    payment_capacity = serializers.FloatField(source='get_payment_capacity', read_only=True)

    references = CustomerReferenceSerializer(many=True, read_only=True)
    commercial_references = CustomerCommercialReferenceSerializer(many=True, read_only=True)
    bank_references = CustomerBankReferenceSerializer(many=True, read_only=True)
    documents = CustomerDocumentSerializer(many=True, read_only=True)
    guarantors = CustomerGuarantorSerializer(many=True, read_only=True)
    financial_summary = CustomerFinancialSummarySerializer(read_only=True)
    employment = CustomerEmploymentSerializer(read_only=True)
    business = CustomerBusinessSerializer(read_only=True)
    financial_info = CustomerFinancialInfoSerializer(read_only=True)
    latest_evaluation = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = [
            'customer_code', 'credit_score', 'risk_level',
            'active_loans_count', 'total_loans_count', 'outstanding_balance', 'total_paid',
        ]

    def get_latest_evaluation(self, obj):
        ev = obj.credit_evaluations.first()
        if ev:
            return CustomerCreditEvaluationSerializer(ev).data
        return None
