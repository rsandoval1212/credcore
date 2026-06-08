from rest_framework import serializers
from .models import CollectionAction, PaymentAgreement


class CollectionActionSerializer(serializers.ModelSerializer):
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)
    result_display      = serializers.CharField(source='get_result_display', read_only=True)
    performed_by_name   = serializers.CharField(source='performed_by.full_name', read_only=True)
    loan_number         = serializers.CharField(source='loan.loan_number', read_only=True)
    customer_name       = serializers.SerializerMethodField()

    class Meta:
        model  = CollectionAction
        fields = '__all__'
        read_only_fields = ['performed_by', 'days_past_due_at_action', 'amount_owed_at_action',
                            'created_at', 'updated_at']

    def get_customer_name(self, obj):
        return obj.customer.get_full_name() if obj.customer else '—'

    def create(self, validated_data):
        validated_data['performed_by'] = self.context['request'].user
        loan = validated_data.get('loan')
        if loan:
            validated_data['days_past_due_at_action'] = loan.days_past_due
            validated_data['amount_owed_at_action'] = (
                float(loan.outstanding_principal) +
                float(loan.outstanding_interest) +
                float(loan.outstanding_late_fees)
            )
        return super().create(validated_data)


class PaymentAgreementSerializer(serializers.ModelSerializer):
    status_display  = serializers.CharField(source='get_status_display', read_only=True)
    loan_number     = serializers.CharField(source='loan.loan_number', read_only=True)
    customer_name   = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    is_overdue      = serializers.SerializerMethodField()

    class Meta:
        model  = PaymentAgreement
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_customer_name(self, obj):
        try:
            return obj.loan.customer.get_full_name()
        except Exception:
            return '—'

    def get_is_overdue(self, obj):
        from django.utils import timezone
        return obj.status == 'ACTIVE' and obj.agreed_payment_date < timezone.now().date()

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
