"""
FIX #21: Server-Sent Events (SSE) para notificaciones en tiempo real.
No requiere Redis ni WebSocket — funciona con Django puro.
El frontend se conecta a /api/v1/notifications/stream/ y recibe eventos.
"""
import json
import time
import threading
from datetime import datetime
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


# Almacen simple de notificaciones en memoria (por usuario)
# En produccion usar Redis/DB
_notifications: dict[int, list] = {}
_lock = threading.Lock()


def push_notification(user_id: int, event_type: str, data: dict):
    """Envia una notificacion a un usuario especifico."""
    with _lock:
        if user_id not in _notifications:
            _notifications[user_id] = []
        _notifications[user_id].append({
            'type': event_type,
            'data': data,
            'timestamp': datetime.now().isoformat(),
        })
        # Mantener solo las ultimas 100
        _notifications[user_id] = _notifications[user_id][-100:]


def get_pending_notifications(user_id: int) -> list:
    """Obtiene y limpia notificaciones pendientes."""
    with _lock:
        notifs = _notifications.pop(user_id, [])
    return notifs


class NotificationStreamView(APIView):
    """SSE endpoint: el frontend mantiene conexion abierta y recibe eventos."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        def event_stream():
            user_id = request.user.pk
            # Enviar heartbeat inicial
            yield f"data: {json.dumps({'type': 'connected', 'message': 'Notificaciones activas'})}\n\n"

            timeout = 60  # Cerrar despues de 60s para evitar conexiones zombi
            start = time.time()

            while time.time() - start < timeout:
                notifs = get_pending_notifications(user_id)
                for n in notifs:
                    yield f"data: {json.dumps(n, ensure_ascii=False)}\n\n"

                if not notifs:
                    # Heartbeat cada 15s
                    yield f": heartbeat\n\n"

                time.sleep(3)  # Poll cada 3 segundos

            yield f"data: {json.dumps({'type': 'timeout', 'message': 'Reconectar'})}\n\n"

        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'  # Para nginx
        return response


class NotificationListView(APIView):
    """Polling alternativo: GET devuelve notificaciones pendientes."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifs = get_pending_notifications(request.user.pk)
        return Response({'notifications': notifs, 'count': len(notifs)})


class NotificationSendView(APIView):
    """Admin envia notificacion a un usuario. POST {user_id, type, message}"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            return Response({'detail': 'Sin permiso.'}, status=403)

        user_id = request.data.get('user_id')
        event_type = request.data.get('type', 'info')
        message = request.data.get('message', '')
        title = request.data.get('title', 'Notificacion')

        if not user_id:
            return Response({'detail': 'user_id requerido.'}, status=400)

        push_notification(int(user_id), event_type, {
            'title': title,
            'message': message,
            'from': request.user.get_full_name() or request.user.email,
        })
        return Response({'detail': 'Notificacion enviada.'})


class NotificationBroadcastView(APIView):
    """Admin envia notificacion a todos los usuarios activos."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_superuser:
            return Response({'detail': 'Solo superadmin.'}, status=403)

        from apps.users.models import User
        event_type = request.data.get('type', 'broadcast')
        message = request.data.get('message', '')
        title = request.data.get('title', 'Aviso del Sistema')

        active_users = User.objects.filter(is_active=True).values_list('pk', flat=True)
        for uid in active_users:
            push_notification(uid, event_type, {
                'title': title,
                'message': message,
                'from': 'Sistema',
            })

        return Response({'detail': f'Notificacion enviada a {len(active_users)} usuarios.'})
