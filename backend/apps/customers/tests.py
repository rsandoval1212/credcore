"""
Tests para el módulo de clientes.
Ejecutar: python manage.py test apps.customers --verbosity=2
"""
from django.test import TestCase
from django.db import IntegrityError
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User
from apps.customers.models import Customer
from apps.branches.models import Branch


class CustomerModelTests(TestCase):
    """Tests del modelo Customer."""

    def setUp(self):
        self.branch = Branch.objects.create(
            name='Sucursal Test', code='ST01',
            address='Calle Test', city='Santo Domingo', province='Distrito Nacional',
        )

    def test_create_customer(self):
        c = Customer.objects.create(
            first_name='Juan',
            last_name='Pérez',
            id_number='001-1234567-8',
            phone1='8091234567',
            email='juan@test.com',
            branch=self.branch,
        )
        self.assertIsNotNone(c.pk)
        self.assertTrue(c.customer_code.startswith('CLI-'))

    def test_unique_id_number(self):
        """La cédula debe ser única."""
        Customer.objects.create(
            first_name='A', last_name='B',
            id_number='001-0000001-1',
            phone1='8091111111',
            branch=self.branch,
        )
        with self.assertRaises(IntegrityError):
            Customer.objects.create(
                first_name='C', last_name='D',
                id_number='001-0000001-1',
                phone1='8092222222',
                branch=self.branch,
            )


class CustomerAPITests(TestCase):
    """Tests de la API de clientes."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin@credcore.local',
            username='admin',
            first_name='Admin',
            last_name='Test',
            password='AdminPass123!',
        )
        self.branch = Branch.objects.create(
            name='Sucursal Test', code='ST01',
            address='Calle Test', city='Santo Domingo', province='Distrito Nacional',
        )
        self.client.force_authenticate(user=self.admin)

    def test_list_customers(self):
        res = self.client.get('/api/v1/customers/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_create_customer(self):
        res = self.client.post('/api/v1/customers/', {
            'first_name': 'María',
            'last_name': 'García',
            'id_number': '002-3456789-0',
            'id_type': 'CEDULA',
            'phone1': '8095551234',
            'branch': self.branch.pk,
        }, format='json')
        self.assertIn(res.status_code, [status.HTTP_201_CREATED, status.HTTP_200_OK])

    def test_unauthenticated_blocked(self):
        client = APIClient()
        res = client.get('/api/v1/customers/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
