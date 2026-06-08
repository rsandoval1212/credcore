from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Guarantee
from .serializers import GuaranteeSerializer


class GuaranteeViewSet(viewsets.ModelViewSet):
    queryset = Guarantee.objects.filter(is_deleted=False).select_related(
        'loan', 'customer'
    ).prefetch_related('vehicle', 'real_estate', 'documents')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['guarantee_type', 'status', 'loan', 'customer']
    search_fields = ['loan__loan_number', 'customer__first_name', 'customer__last_name', 'description']
    serializer_class = GuaranteeSerializer
