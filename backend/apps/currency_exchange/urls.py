from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'rates', views.ExchangeRateViewSet, basename='exchange-rates')
router.register(r'transactions', views.CurrencyTransactionViewSet, basename='currency-transactions')

urlpatterns = [
    path('', include(router.urls)),
]
