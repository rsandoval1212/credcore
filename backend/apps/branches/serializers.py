from rest_framework import serializers
from .models import Branch, BranchSettings


class BranchSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BranchSettings
        exclude = ['branch']


class BranchSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.full_name', read_only=True)
    settings = BranchSettingsSerializer(read_only=True)
    customers_count = serializers.SerializerMethodField()

    class Meta:
        model = Branch
        fields = '__all__'

    def get_customers_count(self, obj):
        return obj.customers.filter(is_deleted=False).count()


class BranchListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name', 'code', 'city', 'province', 'phone', 'is_active', 'is_main']
