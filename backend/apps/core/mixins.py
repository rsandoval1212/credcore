"""
FIX #18 & #19: Soft-delete mixin para ViewSets.
Asegura que destroy() use soft-delete y filtre registros eliminados.
"""
from rest_framework import status
from rest_framework.response import Response


class AutoMainBranchMixin:
    """Auto-asigna la 'Sucursal Principal' cuando no se envía 'branch'.

    En la versión de escritorio (un solo negocio) el usuario no gestiona
    sucursales. Este mixin inyecta la sucursal principal antes de validar,
    de modo que módulos como clientes, préstamos o solicitudes se puedan
    crear sin que el frontend tenga que enviar una sucursal.
    """

    def create(self, request, *args, **kwargs):
        data = request.data
        try:
            data = data.copy() if hasattr(data, 'copy') else dict(data)
        except Exception:
            data = dict(data)

        if not data.get('branch'):
            from apps.branches.models import Branch
            data['branch'] = Branch.get_main().pk

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class SoftDeleteViewSetMixin:
    """Mixin que intercepta destroy() para hacer soft-delete en vez de hard-delete.
    También filtra is_deleted=False por defecto en get_queryset."""

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(qs.model, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs

    def perform_destroy(self, instance):
        # Admins (superuser o staff) pueden forzar eliminación incluso de activos
        is_admin = getattr(self.request.user, 'is_superuser', False) or getattr(self.request.user, 'is_staff', False)
        force = self.request.query_params.get('force', '').lower() in ('1', 'true', 'yes')

        if hasattr(instance, 'is_deleted'):
            if hasattr(instance, 'status') and instance.status in ('ACTIVE', 'DISBURSED'):
                if not (is_admin and force):
                    raise Exception('Registro activo. Admin debe pasar ?force=true para eliminarlo.')
            instance.delete(user=self.request.user)
        else:
            instance.delete()
