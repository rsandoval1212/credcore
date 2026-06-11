"""
Tests para el módulo de préstamos.
Ejecutar: python manage.py test apps.loans.tests --verbosity=2
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
from apps.loans.models import Loan, LoanSchedule


class LoanModelTests(TestCase):
    """Tests del modelo Loan."""

    def setUp(self):
        self.branch = Branch.objects.create(
            name='Sucursal Test', code='ST01',
            address='Dir', city='Santo Domingo', province='DN',
        )
        self.customer = Customer.objects.create(
            first_name='Juan', last_name='Pérez',
            id_number='001-1234567-8', phone1='8091234567',
            branch=self.branch,
        )
        self.product = LoanProduct.objects.create(
            name='Personal', code='PERS01',
            product_type='PERSONAL',
            annual_interest_rate=24,
            min_amount=5000, max_amount=500000,
            min_term_months=1, max_term_months=60,
        )
        self.user = User.objects.create_superuser(
            email='admin@test.com', username='admin',
            first_name='Admin', last_name='Test', password='Pass123!',
        )

    def _create_loan(self, **kwargs):
        defaults = dict(
            customer=self.customer,
            product=self.product,
            branch=self.branch,
            officer=self.user,
            principal_amount=Decimal('100000'),
            annual_interest_rate=Decimal('24.000'),
            term_months=12,
            outstanding_principal=Decimal('100000'),
            disbursement_date=date.today(),
            maturity_date=date.today() + timedelta(days=365),
        )
        defaults.update(kwargs)
        return Loan.objects.create(**defaults)

    def test_create_loan(self):
        loan = self._create_loan()
        self.assertIsNotNone(loan.pk)
        self.assertTrue(loan.loan_number)  # Auto-generated

    def test_auto_loan_number(self):
        loan = self._create_loan()
        self.assertTrue(len(loan.loan_number) > 0)

    def test_default_status_active(self):
        loan = self._create_loan()
        self.assertEqual(loan.status, 'ACTIVE')

    def test_loan_str(self):
        loan = self._create_loan()
        self.assertIn(loan.loan_number, str(loan))

    def test_loan_relationships(self):
        loan = self._create_loan()
        self.assertEqual(loan.customer, self.customer)
        self.assertEqual(loan.product, self.product)
        self.assertEqual(loan.branch, self.branch)

    def test_multiple_loans_same_customer(self):
        l1 = self._create_loan()
        l2 = self._create_loan()
        self.assertNotEqual(l1.loan_number, l2.loan_number)
        self.assertEqual(self.customer.loans.count(), 2)


class LoanScheduleTests(TestCase):
    """Tests del modelo LoanSchedule."""

    def setUp(self):
        self.branch = Branch.objects.create(
            name='Test', code='T01', address='D', city='C', province='P',
        )
        self.customer = Customer.objects.create(
            first_name='A', last_name='B',
            id_number='001-0000001-1', phone1='8091111111',
            branch=self.branch,
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
            principal_amount=50000, annual_interest_rate=24,
            term_months=6, outstanding_principal=50000,
            disbursement_date=date.today(),
            maturity_date=date.today() + timedelta(days=180),
        )

    def test_create_schedule_entry(self):
        entry = LoanSchedule.objects.create(
            loan=self.loan, installment_number=1,
            due_date=date.today() + timedelta(days=30),
            principal_amount=Decimal('8000'), interest_amount=Decimal('1000'),
            total_amount=Decimal('9000'),
        )
        self.assertEqual(entry.status, 'PENDING')

    def test_is_overdue(self):
        entry = LoanSchedule.objects.create(
            loan=self.loan, installment_number=1,
            due_date=date.today() - timedelta(days=5),
            principal_amount=5000, interest_amount=500, total_amount=5500,
        )
        self.assertTrue(entry.is_overdue)

    def test_not_overdue_future(self):
        entry = LoanSchedule.objects.create(
            loan=self.loan, installment_number=1,
            due_date=date.today() + timedelta(days=30),
            principal_amount=5000, interest_amount=500, total_amount=5500,
        )
        self.assertFalse(entry.is_overdue)

    def test_unique_installment_per_loan(self):
        LoanSchedule.objects.create(
            loan=self.loan, installment_number=1,
            due_date=date.today(), principal_amount=1000,
            interest_amount=100, total_amount=1100,
        )
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            LoanSchedule.objects.create(
                loan=self.loan, installment_number=1,
                due_date=date.today(), principal_amount=1000,
                interest_amount=100, total_amount=1100,
            )


class LoanAPITests(TestCase):
    """Tests de la API de préstamos."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin@test.com', username='admin',
            first_name='Admin', last_name='Test', password='Pass123!',
        )
        self.branch = Branch.objects.create(
            name='Test', code='T01', address='D', city='C', province='P',
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
        self.client.force_authenticate(user=self.admin)

    def test_list_loans(self):
        res = self.client.get('/api/v1/loans/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_unauthenticated_blocked(self):
        client = APIClient()
        res = client.get('/api/v1/loans/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
