from django.contrib import admin
from .models import ExchangeRate, CurrencyTransaction


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ['date', 'buy_rate', 'sell_rate', 'spread', 'is_active']
    list_filter = ['is_active']
    ordering = ['-date']


@admin.register(CurrencyTransaction)
class CurrencyTransactionAdmin(admin.ModelAdmin):
    list_display = ['receipt_number', 'operation', 'usd_amount', 'dop_amount', 'rate_applied', 'status', 'created_at']
    list_filter = ['operation', 'status', 'payment_method']
    search_fields = ['receipt_number', 'customer_name', 'customer_id_number']
    ordering = ['-created_at']
