from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
import time

API = 'api/v1/'


def health_check(request):
    """Endpoint público para verificar que el servidor está activo (usado por el frontend como ping)."""
    return JsonResponse({'status': 'ok', 'timestamp': time.time()})


urlpatterns = [
    path('admin/', admin.site.urls),

    # Health check (sin autenticación — usado por el frontend para detectar conexión)
    path(f'{API}health/', health_check, name='health-check'),

    # Docs
    path(f'{API}schema/', SpectacularAPIView.as_view(), name='schema'),
    path(f'{API}docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path(f'{API}redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Auth & Users
    path(f'{API}auth/', include('apps.users.urls')),

    # Core modules (activos)
    path(f'{API}branches/', include('apps.branches.urls')),
    path(f'{API}customers/', include('apps.customers.urls')),
    path(f'{API}loan-products/', include('apps.loan_products.urls')),
    path(f'{API}loan-applications/', include('apps.loan_applications.urls')),
    path(f'{API}loans/', include('apps.loans.urls')),
    path(f'{API}payments/', include('apps.payments.urls')),
    path(f'{API}cash/', include('apps.cash.urls')),
    path(f'{API}guarantees/', include('apps.guarantees.urls')),
    path(f'{API}collections/', include('apps.collections.urls')),
    path(f'{API}accounting/', include('apps.accounting.urls')),
    path(f'{API}collections/', include('apps.collections.urls')),
    path(f'{API}accounting/', include('apps.accounting.urls')),
    path(f'{API}reports/', include('apps.core.report_urls')),
    path(f'{API}dashboard/', include('apps.core.dashboard_urls')),

    # Módulos opcionales — se activan cuando su app esté en INSTALLED_APPS
    # path(f'{API}risk/', include('apps.risk.urls')),
    # path(f'{API}contracts/', include('apps.contracts.urls')),
    # path(f'{API}documents/', include('apps.documents.urls')),
    # path(f'{API}notifications/', include('apps.notifications.urls')),
    # path(f'{API}commissions/', include('apps.commissions.urls')),
    # path(f'{API}legal/', include('apps.legal.urls')),
    # path(f'{API}audit/', include('apps.audit.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    try:
        import debug_toolbar
        urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
    except ImportError:
        pass
