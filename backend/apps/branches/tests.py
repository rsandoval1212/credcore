"""
Tests para el módulo de sucursales.
Ejecutar: python manage.py test apps.branches.tests --verbosity=2
"""
from django.test import TestCase
from django.db import IntegrityError
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User
from apps.branches.models import Branch, BranchSettings


class BranchModelTests(TestCase):
    """Tests del modelo Branch."""

    def test_create_branch(self):
        b = Branch.objects.create(
            name='Sucursal Central', code='SC01',
            address='Av. 27 de Febrero #100', city='Santo Domingo',
            province='Distrito Nacional',
        )
        self.assertIsNotNone(b.pk)
        self.assertEqual(str(b), 'SC01 - Sucursal Central')

    def test_unique_code(self):
        """El código de sucursal debe ser único."""
        Branch.objects.create(
            name='A', code='UNIQUE01',
            address='Dir', city='SD', province='DN',
        )
        with self.assertRaises(IntegrityError):
            Branch.objects.create(
                name='B', code='UNIQUE01',
                address='Dir2', city='SD', province='DN',
            )

    def test_default_is_active(self):
        b = Branch.objects.create(
            name='Test', code='T01',
            address='Dir', city='C', province='P',
        )
        self.assertTrue(b.is_active)

    def test_branch_with_manager(self):
        user = User.objects.create_user(
            email='mgr@test.com', username='mgr',
            first_name='Mgr', last_name='Test', password='Pass123!',
        )
        b = Branch.objects.create(
            name='Con Gerente', code='CG01',
            address='Dir', city='C', province='P',
            manager=user,
        )
        self.assertEqual(b.manager, user)


class BranchSettingsTests(TestCase):
    """Tests del modelo BranchSettings."""

    def setUp(self):
        self.branch = Branch.objects.create(
            name='Sucursal', code='S01',
            address='Dir', city='C', province='P',
        )

    def test_create_settings(self):
        s = BranchSettings.objects.create(branch=self.branch)
        self.assertEqual(s.currency, 'DOP')
        self.assertEqual(s.currency_symbol, 'RD$')

    def test_custom_settings(self):
        s = BranchSettings.objects.create(
            branch=self.branch,
            max_loan_amount=5000000,
            loan_number_prefix='PRES-SD',
        )
        self.assertEqual(s.loan_number_prefix, 'PRES-SD')


class BranchAPITests(TestCase):
    """Tests de la API de sucursales."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin@test.com', username='admin',
            first_name='Admin', last_name='Test', password='Pass123!',
        )
        self.client.force_authenticate(user=self.admin)

    def test_list_branches(self):
        res = self.client.get('/api/v1/branches/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_create_branch(self):
        res = self.client.post('/api/v1/branches/', {
            'name': 'Nueva Sucursal', 'code': 'NS01',
            'address': 'Calle Nueva', 'city': 'Santiago',
            'province': 'Santiago',
        }, format='json')
        self.assertIn(res.status_code, [status.HTTP_201_CREATED, status.HTTP_200_OK])

    def test_unauthenticated_blocked(self):
        client = APIClient()
        res = client.get('/api/v1/branches/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
