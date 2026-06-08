from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CollectionActionViewSet, PaymentAgreementViewSet

router = DefaultRouter()
router.register(r'actions',    CollectionActionViewSet,  basename='collection-actions')
router.register(r'agreements', PaymentAgreementViewSet,  basename='payment-agreements')

urlpatterns = [
    path('', include(router.urls)),
]
