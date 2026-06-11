"""FIX #21: URLs para notificaciones en tiempo real (SSE)."""
from django.urls import path
from . import sse_views as v

urlpatterns = [
    path('stream/', v.NotificationStreamView.as_view(), name='notification-stream'),
    path('pending/', v.NotificationListView.as_view(), name='notification-list'),
    path('send/', v.NotificationSendView.as_view(), name='notification-send'),
    path('broadcast/', v.NotificationBroadcastView.as_view(), name='notification-broadcast'),
]
