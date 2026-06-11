"""
Tests para el módulo de usuarios y autenticación.
Ejecutar: python manage.py test apps.users --verbosity=2
"""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User, Role, Permission, RolePermission, UserRole


@override_settings(
    DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class AuthTests(TestCase):
    """Tests de autenticación: login, logout, refresh, change_password."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='test@credcore.local',
            username='testuser',
            first_name='Test',
            last_name='User',
            password='TestPass123!',
        )
        self.admin = User.objects.create_superuser(
            email='admin@credcore.local',
            username='admin',
            first_name='Admin',
            last_name='User',
            password='AdminPass123!',
        )

    def test_login_success(self):
        res = self.client.post('/api/v1/auth/auth/login/', {
            'email': 'test@credcore.local',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertIn('user', res.data)
        self.assertEqual(res.data['user']['email'], 'test@credcore.local')

    def test_login_wrong_password(self):
        res = self.client.post('/api/v1/auth/auth/login/', {
            'email': 'test@credcore.local',
            'password': 'WrongPassword!',
        }, format='json')
        self.assertIn(res.status_code, [400, 401])

    def test_login_nonexistent_user(self):
        res = self.client.post('/api/v1/auth/auth/login/', {
            'email': 'noexist@credcore.local',
            'password': 'TestPass123!',
        }, format='json')
        self.assertIn(res.status_code, [400, 401])

    def test_me_authenticated(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/v1/auth/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['email'], 'test@credcore.local')

    def test_me_unauthenticated(self):
        res = self.client.get('/api/v1/auth/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/v1/auth/auth/logout/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_change_password(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/v1/auth/auth/change_password/', {
            'old_password': 'TestPass123!',
            'new_password': 'NewSecurePass456!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Verificar que la nueva contraseña funciona
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewSecurePass456!'))

    def test_change_password_wrong_old(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/v1/auth/auth/change_password/', {
            'old_password': 'WrongOld!',
            'new_password': 'NewSecurePass456!',
        }, format='json')
        self.assertEqual(res.status_code, 400)


class RBACTests(TestCase):
    """Tests del sistema de roles y permisos."""

    def setUp(self):
        self.client = APIClient()
        # Crear usuario normal
        self.user = User.objects.create_user(
            email='cajero@credcore.local',
            username='cajero',
            first_name='Cajero',
            last_name='Test',
            password='CajeroPass123!',
        )
        # Crear admin
        self.admin = User.objects.create_superuser(
            email='admin@credcore.local',
            username='admin',
            first_name='Admin',
            last_name='Test',
            password='AdminPass123!',
        )
        # Crear rol y permisos
        self.role = Role.objects.create(name='Cajero', description='Rol de cajero')
        self.perm_view = Permission.objects.create(
            module='customers', action='view', codename='customers.view'
        )
        self.perm_create = Permission.objects.create(
            module='customers', action='create', codename='customers.create'
        )
        RolePermission.objects.create(role=self.role, permission=self.perm_view)
        # Asignar rol al usuario
        UserRole.objects.create(user=self.user, role=self.role)

    def test_superuser_bypasses_rbac(self):
        self.assertTrue(self.admin.has_permission('customers', 'view'))
        self.assertTrue(self.admin.has_permission('customers', 'delete'))
        self.assertTrue(self.admin.has_permission('anything', 'anything'))

    def test_user_has_assigned_permission(self):
        self.assertTrue(self.user.has_permission('customers', 'view'))

    def test_user_lacks_unassigned_permission(self):
        self.assertFalse(self.user.has_permission('customers', 'create'))
        self.assertFalse(self.user.has_permission('customers', 'delete'))

    def test_user_no_role_no_permissions(self):
        lonely = User.objects.create_user(
            email='lonely@credcore.local',
            username='lonely',
            first_name='No',
            last_name='Role',
            password='LonelyPass123!',
        )
        self.assertFalse(lonely.has_permission('customers', 'view'))

    def test_api_endpoint_rbac_blocks_unauthorized(self):
        """Un usuario sin permiso customers.view no puede listar clientes."""
        no_perm_user = User.objects.create_user(
            email='noperm@credcore.local',
            username='noperm',
            first_name='No',
            last_name='Perm',
            password='NoPermPass123!',
        )
        self.client.force_authenticate(user=no_perm_user)
        res = self.client.get('/api/v1/customers/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_endpoint_rbac_allows_authorized(self):
        """Un usuario con permiso customers.view puede listar clientes."""
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/v1/customers/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_superuser_can_access_all(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/v1/customers/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class UserModelTests(TestCase):
    """Tests del modelo User."""

    def test_create_user(self):
        user = User.objects.create_user(
            email='new@test.com',
            username='newuser',
            first_name='New',
            last_name='User',
            password='TestPass123!',
        )
        self.assertEqual(user.email, 'new@test.com')
        self.assertTrue(user.check_password('TestPass123!'))
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_create_superuser(self):
        admin = User.objects.create_superuser(
            email='super@test.com',
            username='superuser',
            first_name='Super',
            last_name='Admin',
            password='SuperPass123!',
        )
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_staff)

    def test_full_name(self):
        user = User.objects.create_user(
            email='name@test.com', username='nameuser',
            first_name='Juan', last_name='Pérez',
            password='Test123!',
        )
        self.assertEqual(user.get_full_name(), 'Juan Pérez')
        self.assertEqual(user.full_name, 'Juan Pérez')

    def test_str_representation(self):
        user = User.objects.create_user(
            email='str@test.com', username='struser',
            first_name='Test', last_name='Str',
            password='Test123!',
        )
        self.assertIn('str@test.com', str(user))
