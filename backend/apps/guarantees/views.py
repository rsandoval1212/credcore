from django.db import transaction
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import module_permissions
from .models import Guarantee, VehicleGuarantee, RealEstateGuarantee, GuaranteeDocument
from .serializers import GuaranteeSerializer, GuaranteeDocumentSerializer


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

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        guarantee = serializer.save(created_by=request.user)

        vehicle_data = request.data.get('vehicle')
        if vehicle_data and guarantee.guarantee_type == 'VEHICLE':
            VehicleGuarantee.objects.create(guarantee=guarantee, **vehicle_data)

        real_estate_data = request.data.get('real_estate')
        if real_estate_data and guarantee.guarantee_type == 'REAL_ESTATE':
            RealEstateGuarantee.objects.create(guarantee=guarantee, **real_estate_data)

        guarantee.refresh_from_db()
        return Response(GuaranteeSerializer(guarantee).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def upload_document(self, request, pk=None):
        guarantee = self.get_object()
        file = request.FILES.get('file')
        doc_type = request.data.get('document_type', 'FOTO')
        notes = request.data.get('notes', '')
        if not file:
            return Response({'detail': 'No se envió archivo.'}, status=400)
        doc = GuaranteeDocument.objects.create(
            guarantee=guarantee, file=file,
            document_type=doc_type, uploaded_by=request.user, notes=notes,
        )
        return Response(GuaranteeDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)
