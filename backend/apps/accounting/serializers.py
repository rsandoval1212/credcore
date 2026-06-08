from rest_framework import serializers
from .models import AccountType, Account, AccountingPeriod, JournalEntry, JournalEntryLine


class AccountTypeSerializer(serializers.ModelSerializer):
    nature_display = serializers.CharField(source='get_nature_display', read_only=True)

    class Meta:
        model  = AccountType
        fields = '__all__'


class AccountSerializer(serializers.ModelSerializer):
    account_type_name  = serializers.CharField(source='account_type.name', read_only=True)
    parent_code        = serializers.CharField(source='parent.code', read_only=True)

    class Meta:
        model  = Account
        fields = '__all__'


class JournalEntryLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model  = JournalEntryLine
        fields = '__all__'


class JournalEntrySerializer(serializers.ModelSerializer):
    status_display   = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name  = serializers.CharField(source='created_by.full_name', read_only=True)
    branch_name      = serializers.CharField(source='branch.name', read_only=True)
    period_name      = serializers.CharField(source='period.name', read_only=True)
    lines            = JournalEntryLineSerializer(many=True, read_only=True)
    is_balanced      = serializers.SerializerMethodField()

    class Meta:
        model  = JournalEntry
        fields = '__all__'
        read_only_fields = ['entry_number', 'total_debit', 'total_credit', 'created_by',
                            'created_at', 'updated_at']

    def get_is_balanced(self, obj):
        return abs(float(obj.total_debit) - float(obj.total_credit)) < 0.01

    def create(self, validated_data):
        import uuid
        validated_data['created_by'] = self.context['request'].user
        validated_data['entry_number'] = f"AST-{str(uuid.uuid4())[:8].upper()}"
        return super().create(validated_data)


class AccountingPeriodSerializer(serializers.ModelSerializer):
    closed_by_name = serializers.CharField(source='closed_by.full_name', read_only=True)
    entries_count  = serializers.SerializerMethodField()

    class Meta:
        model  = AccountingPeriod
        fields = '__all__'
        read_only_fields = ['closed_by', 'closed_at', 'created_at', 'updated_at']

    def get_entries_count(self, obj):
        return obj.journalentry_set.count()
