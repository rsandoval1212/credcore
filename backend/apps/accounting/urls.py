from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AccountTypeViewSet, AccountViewSet, AccountingPeriodViewSet, JournalEntryViewSet

router = DefaultRouter()
router.register(r'account-types', AccountTypeViewSet,     basename='account-types')
router.register(r'accounts',      AccountViewSet,         basename='accounts')
router.register(r'periods',       AccountingPeriodViewSet, basename='accounting-periods')
router.register(r'entries',       JournalEntryViewSet,    basename='journal-entries')

urlpatterns = [
    path('', include(router.urls)),
]
