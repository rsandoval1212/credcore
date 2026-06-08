from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LoanProductViewSet

router = DefaultRouter()
router.register(r'', LoanProductViewSet, basename='loan-products')

urlpatterns = [
    path('', include(router.urls)),
]
