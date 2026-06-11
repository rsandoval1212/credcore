from rest_framework import serializers
from .models import ExchangeRate, CurrencyTransaction


class ExchangeRateSerializer(serializers.ModelSerializer):
    set_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ExchangeRate
        fields = '__all__'

    def get_set_by_name(self, obj):
        return obj.set_by.get_full_name() if obj.set_by else ''


class CurrencyTransactionSerializer(serializers.ModelSerializer):
    operation_display = serializers.CharField(source='get_operation_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    operator_name = serializers.SerializerMethodField()
    customer_display = serializers.SerializerMethodField()

    class Meta:
        model = CurrencyTransaction
        fields = '__all__'

    def get_operator_name(self, obj):
        return obj.operator.get_full_name() if obj.operator else ''

    def get_customer_display(self, obj):
        if obj.customer:
            return str(obj.customer)
        return obj.customer_name or 'Cliente General'


class CurrencyTransactionCreateSerializer(serializers.Serializer):
    """Serializer para crear transacciones de cambio."""
    operation = serializers.ChoiceField(choices=['BUY', 'SELL'])
    usd_amount = serializers.DecimalField(max_digits=15, decimal_places=2, min_value=0.01)
    rate_applied = serializers.DecimalField(max_digits=10, decimal_places=4, required=False)
    customer = serializers.IntegerField(required=False, allow_null=True)
    customer_name = serializers.CharField(max_length=200, required=False, default='', allow_blank=True)
    customer_id_number = serializers.CharField(max_length=30, required=False, default='', allow_blank=True)
    customer_phone = serializers.CharField(max_length=20, required=False, default='', allow_blank=True)
    payment_method = serializers.ChoiceField(choices=['CASH', 'TRANSFER', 'CHECK'], default='CASH')
    reference_number = serializers.CharField(max_length=100, required=False, default='', allow_blank=True)
    notes = serializers.CharField(required=False, default='', allow_blank=True)
