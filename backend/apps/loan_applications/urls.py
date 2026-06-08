from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LoanApplicationViewSet

router = DefaultRouter()
router.register(r'', LoanApplicationViewSet, basename='loan-applications')

urlpatterns = [
    path('', include(router.urls)),
]
