from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CashRegisterViewSet, CashSessionViewSet

router = DefaultRouter()
router.register(r'registers', CashRegisterViewSet, basename='cash-registers')
router.register(r'sessions',  CashSessionViewSet,  basename='cash-sessions')

urlpatterns = [path('', include(router.urls))]
