from rest_framework import serializers
from .models import CashRegister, CashSession, CashTransaction


class CashTransactionSerializer(serializers.ModelSerializer):
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    created_by_name  = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = CashTransaction
        fields = '__all__'
        read_only_fields = ['created_by']


class CashRegisterSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = CashRegister
        fields = '__all__'


class CashSessionSerializer(serializers.ModelSerializer):
    cashier_name    = serializers.CharField(source='cashier.full_name', read_only=True)
    closed_by_name  = serializers.CharField(source='closed_by.full_name', read_only=True)
    register_name   = serializers.CharField(source='cash_register.name', read_only=True)
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    transactions    = CashTransactionSerializer(many=True, read_only=True)
    payments_count  = serializers.SerializerMethodField()
    payments_total  = serializers.SerializerMethodField()

    class Meta:
        model = CashSession
        fields = '__all__'
        read_only_fields = ['cashier', 'opened_at', 'closed_at', 'closed_by',
                            'total_income', 'total_expense', 'expected_closing', 'difference']

    def get_payments_count(self, obj):
        return obj.payments.count()

    def get_payments_total(self, obj):
        from django.db.models import Sum
        return obj.payments.aggregate(t=Sum('total_amount'))['t'] or 0


class CashSessionListSerializer(serializers.ModelSerializer):
    cashier_name  = serializers.CharField(source='cashier.full_name', read_only=True)
    register_name = serializers.CharField(source='cash_register.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payments_total = serializers.SerializerMethodField()

    class Meta:
        model = CashSession
        fields = [
            'id', 'cash_register', 'register_name', 'cashier', 'cashier_name',
            'opening_amount', 'closing_amount', 'total_income', 'total_expense',
            'status', 'status_display', 'opened_at', 'closed_at', 'payments_total',
        ]

    def get_payments_total(self, obj):
        from django.db.models import Sum
        return float(obj.payments.aggregate(t=Sum('total_amount'))['t'] or 0)
