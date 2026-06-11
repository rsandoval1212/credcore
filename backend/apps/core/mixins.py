"""
FIX #18 & #19: Soft-delete mixin para ViewSets.
Asegura que destroy() use soft-delete y filtre registros eliminados.
"""
from rest_framework import status
from rest_framework.response import Response


class SoftDeleteViewSetMixin:
    """Mixin que intercepta destroy() para hacer soft-delete en vez de hard-delete.
    También filtra is_deleted=False por defecto en get_queryset."""

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(qs.model, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs

    def perform_destroy(self, instance):
        if hasattr(instance, 'is_deleted'):
            # FIX #19: Proteger entidades con dependencias activas
            if hasattr(instance, 'status') and instance.status in ('ACTIVE', 'DISBURSED'):
                raise Exception('No se puede eliminar un registro activo.')
            instance.delete(user=self.request.user)
        else:
            instance.delete()
