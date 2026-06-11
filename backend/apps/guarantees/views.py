from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import module_permissions
from .models import Guarantee
from .serializers import GuaranteeSerializer


from apps.core.mixins import SoftDeleteViewSetMixin


class GuaranteeViewSet(SoftDeleteViewSetMixin, viewsets.ModelViewSet):
    queryset = Guarantee.objects.filter(is_deleted=False).select_related(
        'loan', 'customer'
    ).prefetch_related('vehicle', 'real_estate', 'documents')
    permission_classes = [IsAuthenticated, module_permissions('guarantees')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = {
        'guarantee_type': ['exact'],
        'status': ['exact'],
        'loan': ['exact'],
        'customer': ['exact'],
        'created_at': ['gte', 'lte', 'date__gte', 'date__lte'],
    }
    search_fields = ['loan__loan_number', 'customer__first_name', 'customer__last_name', 'description']
    serializer_class = GuaranteeSerializer
