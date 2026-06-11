from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .token_views import CookieTokenRefreshView

router = DefaultRouter()
router.register(r'auth', views.AuthViewSet, basename='auth')
router.register(r'users', views.UserViewSet, basename='users')
router.register(r'roles', views.RoleViewSet, basename='roles')

urlpatterns = [
    path('', include(router.urls)),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
]
