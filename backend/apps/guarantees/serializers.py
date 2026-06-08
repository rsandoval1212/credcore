from rest_framework import serializers
from .models import Guarantee, VehicleGuarantee, RealEstateGuarantee, GuaranteeDocument


class VehicleGuaranteeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleGuarantee
        exclude = ['guarantee']


class RealEstateGuaranteeSerializer(serializers.ModelSerializer):
    property_type_display = serializers.CharField(source='get_property_type_display', read_only=True)

    class Meta:
        model = RealEstateGuarantee
        exclude = ['guarantee']


class GuaranteeDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)

    class Meta:
        model = GuaranteeDocument
        fields = '__all__'
        read_only_fields = ['uploaded_by', 'uploaded_at']


class GuaranteeSerializer(serializers.ModelSerializer):
    guarantee_type_display = serializers.CharField(source='get_guarantee_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    loan_number    = serializers.CharField(source='loan.loan_number', read_only=True)
    customer_name  = serializers.CharField(source='customer.get_full_name', read_only=True)
    vehicle        = VehicleGuaranteeSerializer(read_only=True)
    real_estate    = RealEstateGuaranteeSerializer(read_only=True)
    documents      = GuaranteeDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Guarantee
        fields = '__all__'
