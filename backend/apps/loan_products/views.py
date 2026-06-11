from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import module_permissions
from .models import LoanProduct
from .serializers import LoanProductSerializer, LoanProductListSerializer


class LoanProductViewSet(viewsets.ModelViewSet):
    queryset = LoanProduct.objects.filter(is_active=True).prefetch_related('workflow_steps')
    permission_classes = [IsAuthenticated, module_permissions('loans')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['product_type', 'is_active', 'branch']
    search_fields = ['name', 'code']

    def get_serializer_class(self):
        if self.action == 'list':
            return LoanProductListSerializer
        return LoanProductSerializer
