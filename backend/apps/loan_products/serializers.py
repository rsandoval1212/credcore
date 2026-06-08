from rest_framework import serializers
from .models import LoanProduct, ApprovalWorkflowStep


class ApprovalWorkflowStepSerializer(serializers.ModelSerializer):
    required_role_name = serializers.CharField(source='required_role.name', read_only=True)

    class Meta:
        model = ApprovalWorkflowStep
        fields = '__all__'


class LoanProductSerializer(serializers.ModelSerializer):
    product_type_display = serializers.CharField(source='get_product_type_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    workflow_steps = ApprovalWorkflowStepSerializer(many=True, read_only=True)

    class Meta:
        model = LoanProduct
        fields = '__all__'


class LoanProductListSerializer(serializers.ModelSerializer):
    product_type_display = serializers.CharField(source='get_product_type_display', read_only=True)

    class Meta:
        model = LoanProduct
        fields = [
            'id', 'name', 'code', 'product_type', 'product_type_display',
            'annual_interest_rate', 'min_amount', 'max_amount',
            'min_term_months', 'max_term_months', 'requires_guarantee',
            'requires_guarantor', 'is_active', 'approval_levels',
        ]
