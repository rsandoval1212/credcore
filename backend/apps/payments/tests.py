"""
Tests para el módulo de pagos.
Ejecutar: python manage.py test apps.payments.tests --verbosity=2
"""
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.loan_products.models import LoanProduct
from apps.loans.models import Loan
from apps.payments.models import Payment


class PaymentModelTests(TestCase):
    """Tests del modelo Payment."""

    def setUp(self):
        self.branch = Branch.objects.create(
            name='Test', code='T01', address='D', city='C', province='P',
        )
        self.admin = User.objects.create_superuser(
            email='admin@test.com', username='admin',
            first_name='Admin', last_name='Test', password='Pass123!',
        )
        self.customer = Customer.objects.create(
            first_name='A', last_name='B', id_number='001-0000001-1',
            phone1='8091111111', branch=self.branch,
        )
        self.product = LoanProduct.objects.create(
            name='P', code='P01', product_type='PERSONAL',
            annual_interest_rate=24,
            min_amount=1000, max_amount=999999,
            min_term_months=1, max_term_months=60,
        )
        self.loan = Loan.objects.create(
            customer=self.customer, product=self.product,
            branch=self.branch,
            principal_amount=100000, annual_interest_rate=24,
            term_months=12, outstanding_principal=100000,
            disbursement_date=date.today(),
            maturity_date=date.today() + timedelta(days=365),
        )

    def test_create_payment(self):
        p = Payment.objects.create(
            loan=self.loan, customer=self.customer,
            total_amount=Decimal('9500'),
            principal_amount=Decimal('7500'),
            interest_amount=Decimal('2000'),
            payment_type='REGULAR',
            payment_method='CASH',
            received_by=self.admin,
            payment_date=date.today(),
        )
        self.assertIsNotNone(p.pk)
        self.assertTrue(p.payment_number.startswith('PAG-'))
        self.assertTrue(p.receipt_number.startswith('REC-'))

    def test_default_status_confirmed(self):
        p = Payment.objects.create(
            loan=self.loan, customer=self.customer,
            total_amount=5000, payment_type='REGULAR',
            received_by=self.admin, payment_date=date.today(),
        )
        self.assertEqual(p.status, 'CONFIRMED')

    def test_payment_types(self):
        """Todos los tipos de pago son válidos."""
        for ptype in ['REGULAR', 'PARTIAL', 'EXTRAORDINARY', 'FULL_PAYMENT', 'LATE_FEE']:
            p = Payment.objects.create(
                loan=self.loan, customer=self.customer,
                total_amount=1000, payment_type=ptype,
                received_by=self.admin, payment_date=date.today(),
            )
            self.assertEqual(p.payment_type, ptype)

    def test_payment_methods(self):
        """Todos los métodos de pago son válidos."""
        for method in ['CASH', 'BANK_TRANSFER', 'CHECK', 'CARD']:
            p = Payment.objects.create(
                loan=self.loan, customer=self.customer,
                total_amount=1000, payment_type='REGULAR',
                payment_method=method,
                received_by=self.admin, payment_date=date.today(),
            )
            self.assertEqual(p.payment_method, method)

    def test_auto_numbers_unique(self):
        p1 = Payment.objects.create(
            loan=self.loan, customer=self.customer,
            total_amount=5000, payment_type='REGULAR',
            received_by=self.admin, payment_date=date.today(),
        )
        p2 = Payment.objects.create(
            loan=self.loan, customer=self.customer,
            total_amount=5000, payment_type='REGULAR',
            received_by=self.admin, payment_date=date.today(),
        )
        self.assertNotEqual(p1.payment_number, p2.payment_number)
        self.assertNotEqual(p1.receipt_number, p2.receipt_number)


class PaymentAPITests(TestCase):
    """Tests de la API de pagos."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin@test.com', username='admin',
            first_name='Admin', last_name='Test', password='Pass123!',
        )
        self.client.force_authenticate(user=self.admin)

    def test_list_payments(self):
        res = self.client.get('/api/v1/payments/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_unauthenticated_blocked(self):
        client = APIClient()
        res = client.get('/api/v1/payments/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
