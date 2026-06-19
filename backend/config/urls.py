from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

API = 'api/v1/'


def health_check(request):
    """Endpoint público para verificar que el servidor está activo (usado por el frontend como ping)."""
    return JsonResponse({'status': 'ok'})


from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def drive_config(request):
    """Configuración de Google Drive para respaldos automáticos."""
    import os, json
    from pathlib import Path
    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'detail': 'Solo administradores.'}, status=403)

    backups_dir = os.environ.get('BACKUPS_DIR', '')
    data_dir = Path(backups_dir).parent if backups_dir else Path(os.environ.get('APPDATA', str(Path.home()))) / 'CredCore'
    data_dir.mkdir(parents=True, exist_ok=True)
    sa_file = data_dir / 'service_account.json'
    fid_file = data_dir / 'drive_folder_id.txt'

    if request.method == 'GET':
        sa_email = None
        if sa_file.exists():
            try:
                sa_email = json.loads(sa_file.read_text(encoding='utf-8')).get('client_email')
            except Exception:
                sa_email = '(archivo inválido)'
        folder_id = fid_file.read_text(encoding='utf-8').strip() if fid_file.exists() else ''
        return JsonResponse({
            'configured': bool(sa_email and folder_id),
            'service_account_email': sa_email,
            'drive_folder_id': folder_id,
        })

    # POST: recibir el JSON y/o el folder_id
    file = request.FILES.get('service_account')
    folder_id = (request.data.get('drive_folder_id') or '').strip()
    saved = []
    if file:
        try:
            content = file.read().decode('utf-8')
            parsed = json.loads(content)
            if not parsed.get('client_email') or not parsed.get('private_key'):
                return JsonResponse({'detail': 'JSON de cuenta de servicio inválido.'}, status=400)
            sa_file.write_text(content, encoding='utf-8')
            saved.append('service_account.json')
        except Exception as e:
            return JsonResponse({'detail': f'No se pudo guardar el JSON: {e}'}, status=400)
    if folder_id:
        fid_file.write_text(folder_id, encoding='utf-8')
        saved.append('drive_folder_id.txt')
    if not saved:
        return JsonResponse({'detail': 'No se proporcionó nada para guardar.'}, status=400)
    return JsonResponse({'success': True, 'saved': saved})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def drive_test(request):
    """Prueba la conexión a Google Drive intentando listar la carpeta."""
    import os
    from pathlib import Path
    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'detail': 'Solo administradores.'}, status=403)

    backups_dir = os.environ.get('BACKUPS_DIR', '')
    data_dir = Path(backups_dir).parent if backups_dir else Path(os.environ.get('APPDATA', str(Path.home()))) / 'CredCore'
    sa_file = data_dir / 'service_account.json'
    fid_file = data_dir / 'drive_folder_id.txt'
    if not sa_file.exists() or not fid_file.exists():
        return JsonResponse({'success': False, 'message': 'Falta service_account.json o drive_folder_id.txt'}, status=400)

    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        scopes = ['https://www.googleapis.com/auth/drive.file']
        creds = service_account.Credentials.from_service_account_file(str(sa_file), scopes=scopes)
        svc = build('drive', 'v3', credentials=creds)
        folder_id = fid_file.read_text(encoding='utf-8').strip()
        meta = svc.files().get(fileId=folder_id, fields='id,name,owners').execute()
        return JsonResponse({'success': True, 'folder_name': meta.get('name'), 'folder_id': meta.get('id')})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)[:200]}, status=400)


from rest_framework.permissions import AllowAny as _AllowAny


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def audit_log_list(request):
    """Devuelve las últimas entradas de auditoría desde el log file."""
    import os
    from pathlib import Path
    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'detail': 'Solo administradores.'}, status=403)

    log_path = os.environ.get('AUDIT_LOG_PATH', '')
    if not log_path:
        backups_dir = os.environ.get('BACKUPS_DIR', '')
        data_dir = Path(backups_dir).parent if backups_dir else Path(os.environ.get('APPDATA', str(Path.home()))) / 'CredCore'
        log_path = str(data_dir / 'logs' / 'audit.log')

    if not Path(log_path).exists():
        return JsonResponse({'entries': [], 'total': 0, 'path': log_path})

    try:
        limit = min(int(request.GET.get('limit', 200)), 500)
    except Exception:
        limit = 200

    with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    entries = []
    for line in reversed(lines[-limit:]):
        line = line.strip()
        if not line:
            continue
        entries.append(line)
    return JsonResponse({'entries': entries, 'total': len(lines), 'path': log_path})


@api_view(['POST'])
@permission_classes([_AllowAny])
def admin_password_recovery(request):
    """Recupera la contraseña del superuser usando la clave de licencia activa.

    Body: { license_key: str, new_password: str }
    Solo permite resetear si la clave coincide con la licencia activa de la máquina.
    """
    import os
    from pathlib import Path
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError

    license_key = (request.data.get('license_key') or '').strip()
    new_password = request.data.get('new_password') or ''

    if not license_key or not new_password:
        return JsonResponse({'detail': 'Clave de licencia y nueva contraseña son requeridas.'}, status=400)

    # Verificar que la clave coincide con la licencia instalada
    backups_dir = os.environ.get('BACKUPS_DIR', '')
    data_dir = Path(backups_dir).parent if backups_dir else Path(os.environ.get('APPDATA', str(Path.home()))) / 'CredCore'
    license_file = data_dir / 'license.dat'

    if not license_file.exists():
        return JsonResponse({'detail': 'No hay licencia instalada en esta máquina.'}, status=400)

    try:
        installed = license_file.read_text(encoding='utf-8').strip()
    except Exception:
        return JsonResponse({'detail': 'No se pudo leer la licencia.'}, status=400)

    if license_key != installed:
        return JsonResponse({'detail': 'Clave de licencia incorrecta.'}, status=403)

    from apps.users.models import User as UserModel
    admin = UserModel.objects.filter(is_superuser=True).order_by('date_joined').first()
    if not admin:
        return JsonResponse({'detail': 'No hay administrador en el sistema.'}, status=400)

    try:
        validate_password(new_password, admin)
    except DjangoValidationError as e:
        return JsonResponse({'detail': list(e.messages)}, status=400)

    admin.set_password(new_password)
    admin.failed_login_attempts = 0
    admin.locked_until = None
    admin.save()

    import logging
    logging.getLogger('credcore.audit').warning(f"[ADMIN_RECOVERY] password reset for {admin.email}")

    return JsonResponse({'success': True, 'detail': f'Contraseña de {admin.email} restablecida.'})


@api_view(['GET', 'PUT'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def backup_destinations(request):
    """Listar / actualizar los destinos externos de respaldos.

    GET:  devuelve los destinos actuales (carpetas + USBs) con su estado, y
          además la lista de USBs detectadas (para que el frontend ofrezca un
          dropdown).
    PUT:  recibe {"destinations": ["usb:LABEL", "G:\\Mi unidad\\..."]} y
          re-escribe `%APPDATA%\\CredCore\\external_backup_path.txt`. La app
          de escritorio lee ese archivo en cada respaldo (sin reiniciar).

    Decorada con DRF + JWT: las vistas Django planas NO procesan el header
    Authorization (siempre dan user=anonymous + CSRF). Esta corrige eso.
    Solo accesible para superusuarios o staff (configuración crítica).
    """
    import os
    import sys
    from pathlib import Path

    if not (request.user.is_superuser or request.user.is_staff):
        return JsonResponse({'detail': 'Solo administradores.'}, status=403)

    # Localizar APPDATA\CredCore (la app de escritorio pasa BACKUPS_DIR; su
    # padre es el data dir). Si no, fallback a %APPDATA%\CredCore.
    backups_dir = os.environ.get('BACKUPS_DIR', '')
    if backups_dir:
        data_dir = Path(backups_dir).parent
    else:
        data_dir = Path(os.environ.get('APPDATA', str(Path.home()))) / 'CredCore'
    data_dir.mkdir(parents=True, exist_ok=True)
    config_file = data_dir / 'external_backup_path.txt'

    # `updater.py` vive junto al exe — reutilizamos helpers existentes
    app_dir = os.environ.get('CREDCORE_APP_DIR', '')
    if app_dir and app_dir not in sys.path:
        sys.path.insert(0, app_dir)

    def _detect_usbs():
        """Detecta USB conectadas en Windows con su etiqueta."""
        out = []
        if sys.platform != 'win32':
            return out
        try:
            import ctypes
            kernel = ctypes.windll.kernel32
            for letter in 'DEFGHIJKLMNOPQRSTUVWXYZ':
                root = f"{letter}:\\"
                if not Path(root).exists():
                    continue
                drive_type = kernel.GetDriveTypeW(root)  # 2 = USB removible
                if drive_type != 2:
                    continue
                vol = ctypes.create_unicode_buffer(261); fs = ctypes.create_unicode_buffer(261)
                ok = kernel.GetVolumeInformationW(root, vol, 261, None, None, None, fs, 261)
                out.append({
                    'letter': f"{letter}:",
                    'label': vol.value if ok else '',
                    'has_label': bool(ok and vol.value.strip()),
                })
        except Exception:
            pass
        return out

    def _verify_destination(line: str) -> dict:
        """Verifica si un destino (línea del config) es accesible AHORA."""
        from pathlib import Path
        s = line.strip()
        if s.lower().startswith('usb:'):
            label = s[4:].split('\\', 1)[0].split('/', 1)[0].strip()
            # Buscar USB con esa etiqueta
            for d in _detect_usbs():
                if d['label'].strip().upper() == label.upper():
                    return {'kind': 'usb', 'config': s, 'label': label, 'ok': True,
                            'message': f"USB {label} conectada en {d['letter']}"}
            return {'kind': 'usb', 'config': s, 'label': label, 'ok': False,
                    'message': f"USB '{label}' no conectada"}
        else:
            p = Path(s)
            if not p.exists():
                return {'kind': 'folder', 'config': s, 'ok': False,
                        'message': f"Carpeta no existe: {s}"}
            try:
                test = p / '.credcore_write_test'
                test.write_text('ok'); test.unlink()
                return {'kind': 'folder', 'config': s, 'ok': True,
                        'message': f"Carpeta accesible: {s}"}
            except Exception:
                return {'kind': 'folder', 'config': s, 'ok': False,
                        'message': f"Sin permisos de escritura en {s}"}

    if request.method == 'GET':
        destinations = []
        if config_file.exists():
            try:
                raw = config_file.read_text(encoding='utf-8-sig')
                for line in raw.splitlines():
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    destinations.append(_verify_destination(line))
            except Exception as e:
                return JsonResponse({'detail': f'Error leyendo configuración: {e}'}, status=500)
        return JsonResponse({
            'destinations': destinations,
            'available_usbs': _detect_usbs(),
            'config_file': str(config_file),
        })

    if request.method == 'PUT':
        # DRF ya parseó el JSON en request.data
        body = request.data if hasattr(request, 'data') else {}
        items = body.get('destinations') or []
        if not isinstance(items, list):
            return JsonResponse({'detail': 'destinations debe ser una lista.'}, status=400)

        lines = ['# Destinos de respaldo (editado desde la app).']
        lines.append('# UNA RUTA POR LÍNEA. Líneas con # son comentarios.')
        for item in items:
            s = str(item).strip()
            if s:
                lines.append(s)
        config_file.write_text('\n'.join(lines) + '\n', encoding='utf-8')

        # Devolver el estado nuevo (verificado)
        verified = []
        for s in items:
            if isinstance(s, str) and s.strip():
                verified.append(_verify_destination(s))
        return JsonResponse({
            'destinations': verified,
            'available_usbs': _detect_usbs(),
            'config_file': str(config_file),
        })

    return JsonResponse({'detail': 'Método no permitido.'}, status=405)


from rest_framework.decorators import api_view as _api_view, authentication_classes as _auth_cls, permission_classes as _perm_cls
from rest_framework.permissions import IsAuthenticated as _IsAuth
from rest_framework_simplejwt.authentication import JWTAuthentication as _JWTAuth


@_api_view(['GET'])
@_auth_cls([_JWTAuth])
@_perm_cls([_IsAuth])
def update_check(request):
    """Expone el estado de actualizaciones al frontend (requiere autenticación)."""
    import os, sys
    current = os.environ.get('APP_VERSION', '0.0.0')
    # `updater.py` vive junto al exe (un nivel arriba del backend en el bundle).
    # En desarrollo no estará disponible — devolver "sin update" no falla nada.
    update_dir = os.environ.get('CREDCORE_APP_DIR', '')
    if update_dir and update_dir not in sys.path:
        sys.path.insert(0, update_dir)
    try:
        from updater import check_for_update
    except Exception:
        return JsonResponse({'has_update': False, 'current_version': current})
    info = check_for_update(current)
    if not info:
        return JsonResponse({'has_update': False, 'current_version': current})
    return JsonResponse({
        'has_update': True,
        'current_version': current,
        'latest_version': info['version'],
        'download_url': info['download_url'],
        'notes': info['notes'],
        'mandatory': info['mandatory'],
    })


urlpatterns = [
    path('admin/', admin.site.urls),

    # Health check (sin autenticación — usado por el frontend para detectar conexión)
    path(f'{API}health/', health_check, name='health-check'),

    # Verificación de actualizaciones (consultada al cargar el dashboard)
    path(f'{API}system/update-check/', update_check, name='update-check'),

    # Configuración de destinos de respaldo (carpetas / USBs)
    path(f'{API}system/backup-destinations/', backup_destinations, name='backup-destinations'),
    path(f'{API}system/drive-config/', drive_config, name='drive-config'),
    path(f'{API}system/drive-test/', drive_test, name='drive-test'),
    path(f'{API}system/admin-recovery/', admin_password_recovery, name='admin-recovery'),
    path(f'{API}system/audit-log/', audit_log_list, name='audit-log'),
    path(f'{API}system/bulk-sync/preview/', __import__('apps.core.bulk_sync_views', fromlist=['BulkSyncPreviewView']).BulkSyncPreviewView.as_view(), name='bulk-sync-preview'),
    path(f'{API}system/bulk-sync/import/', __import__('apps.core.bulk_sync_views', fromlist=['BulkSyncImportView']).BulkSyncImportView.as_view(), name='bulk-sync-import'),

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
    path(f'{API}currency-exchange/', include('apps.currency_exchange.urls')),
    path(f'{API}reports/', include('apps.core.report_urls')),
    path(f'{API}dashboard/', include('apps.core.dashboard_urls')),

    # FIX #21: Notificaciones en tiempo real (SSE)
    path(f'{API}notifications/', include('apps.core.notification_urls')),

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
    # API docs solo visibles en desarrollo
    urlpatterns += [
        path(f'{API}schema/', SpectacularAPIView.as_view(), name='schema'),
        path(f'{API}docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        path(f'{API}redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    try:
        import debug_toolbar
        urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
    except ImportError:
        pass
