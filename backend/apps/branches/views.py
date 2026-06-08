from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Branch
from .serializers import BranchSerializer, BranchListSerializer


class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.filter(is_active=True).select_related('manager').prefetch_related('settings')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'is_main']
    search_fields = ['name', 'code', 'city']

    def get_serializer_class(self):
        if self.action == 'list':
            return BranchListSerializer
        return BranchSerializer
