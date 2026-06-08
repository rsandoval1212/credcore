from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    loan_number      = serializers.CharField(source='loan.loan_number', read_only=True)
    customer_name    = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_code    = serializers.CharField(source='customer.customer_code', read_only=True)
    received_by_name = serializers.CharField(source='received_by.full_name', read_only=True)
    payment_type_display   = serializers.CharField(source='get_payment_type_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_display   = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['payment_number', 'receipt_number', 'customer']


class PaymentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'loan', 'total_amount', 'principal_amount', 'interest_amount',
            'late_fee_amount', 'commission_amount', 'payment_type', 'payment_method',
            'reference_number', 'bank_name', 'check_number',
            'payment_date', 'cash_session', 'notes', 'installments',
        ]
