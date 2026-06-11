"""
Permisos RBAC para CredCore.

Uso en ViewSets:
    from apps.core.permissions import module_permissions

    class CustomerViewSet(viewsets.ModelViewSet):
        permission_classes = [IsAuthenticated, module_permissions('customers')]

Esto automáticamente mapea:
    - list/retrieve -> customers.view
    - create        -> customers.create
    - update/partial_update -> customers.edit
    - destroy       -> customers.delete

Para acciones custom:
    @action(detail=True, methods=['post'])
    @requires_permission('loans', 'approve')
    def approve(self, request, pk=None):
        ...
"""
from functools import wraps
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.exceptions import PermissionDenied


# Mapeo de acción DRF -> acción de permiso CredCore
ACTION_MAP = {
    'list': 'view',
    'retrieve': 'view',
    'create': 'create',
    'update': 'edit',
    'partial_update': 'edit',
    'destroy': 'delete',
}


class ModulePermission(BasePermission):
    """
    Permiso basado en módulo. Verifica que el usuario tenga el permiso
    correspondiente al módulo y acción que está ejecutando.

    Superusers siempre tienen acceso total.
    """
    module = ''

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Superusers bypasean todo
        if user.is_superuser:
            return True

        # Determinar la acción de permiso
        action = getattr(view, 'action', None)

        # Acciones custom (approve, reject, cancel, stats, etc.)
        # Para acciones custom, por defecto requieren 'view'
        perm_action = ACTION_MAP.get(action, 'view')

        return user.has_permission(self.module, perm_action)


def module_permissions(module_name: str):
    """
    Factory que crea una clase de permiso para un módulo específico.

    Uso:
        permission_classes = [IsAuthenticated, module_permissions('customers')]
    """
    return type(
        f'{module_name.title()}ModulePermission',
        (ModulePermission,),
        {'module': module_name},
    )


def requires_permission(module: str, action: str):
    """
    Decorador para acciones custom de ViewSet que requieren un permiso específico.

    Uso:
        @action(detail=True, methods=['post'])
        @requires_permission('loans', 'approve')
        def approve(self, request, pk=None):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            user = request.user
            if not user.is_superuser and not user.has_permission(module, action):
                raise PermissionDenied(
                    f'No tiene permiso para {action} en {module}.'
                )
            return func(self, request, *args, **kwargs)
        return wrapper
    return decorator


class IsAdminOrReadOnly(BasePermission):
    """Solo admins pueden escribir; el resto solo lectura."""
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user and (request.user.is_superuser or request.user.is_staff)


class IsSuperAdmin(BasePermission):
    """Solo superusuarios."""
    def has_permission(self, request, view):
        return request.user and request.user.is_superuser
