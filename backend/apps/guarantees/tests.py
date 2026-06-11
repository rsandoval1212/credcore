"""
Tests para el módulo de garantías.
Ejecutar: python manage.py test apps.guarantees.tests --verbosity=2
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
from apps.guarantees.models import (
    Guarantee, VehicleGuarantee, RealEstateGuarantee,
)


class GuaranteeModelTests(TestCase):
    """Tests del modelo Guarantee."""

    def setUp(self):
        self.branch = Branch.objects.create(
            name='Test', code='T01', address='D', city='C', province='P',
        )
        self.customer = Customer.objects.create(
            first_name='A', last_name='B', id_number='001-0000001-1',
            phone1='8091111111', branch=self.branch,
        )
        self.product = LoanProduct.objects.create(
            name='P', code='P01', product_type='PRENDARIO',
            annual_interest_rate=18, requires_guarantee=True,
            min_amount=1000, max_amount=999999,
            min_term_months=1, max_term_months=60,
        )
        self.loan = Loan.objects.create(
            customer=self.customer, product=self.product,
            branch=self.branch,
            principal_amount=200000, annual_interest_rate=18,
            term_months=24, outstanding_principal=200000,
            disbursement_date=date.today(),
            maturity_date=date.today() + timedelta(days=730),
        )

    def test_create_guarantee(self):
        g = Guarantee.objects.create(
            loan=self.loan, customer=self.customer,
            guarantee_type='VEHICLE',
            description='Toyota Corolla 2023',
            estimated_value=Decimal('450000'),
        )
        self.assertIsNotNone(g.pk)
        self.assertEqual(g.status, 'ACTIVE')

    def test_guarantee_types(self):
        for gtype in ['VEHICLE', 'REAL_ESTATE', 'EQUIPMENT', 'INVENTORY', 'OTHER']:
            g = Guarantee.objects.create(
                loan=self.loan, customer=self.customer,
                guarantee_type=gtype,
                description=f'Test {gtype}',
                estimated_value=100000,
            )
            self.assertEqual(g.guarantee_type, gtype)

    def test_guarantee_str(self):
        g = Guarantee.objects.create(
            loan=self.loan, customer=self.customer,
            guarantee_type='VEHICLE',
            description='Test', estimated_value=100000,
        )
        self.assertIn('Vehículo', str(g))


class VehicleGuaranteeTests(TestCase):

    def setUp(self):
        self.branch = Branch.objects.create(
            name='Test', code='T01', address='D', city='C', province='P',
        )
        self.customer = Customer.objects.create(
            first_name='A', last_name='B', id_number='001-0000001-1',
            phone1='8091111111', branch=self.branch,
        )
        self.product = LoanProduct.objects.create(
            name='P', code='P01', product_type='PRENDARIO',
            annual_interest_rate=18,
            min_amount=1000, max_amount=999999,
            min_term_months=1, max_term_months=60,
        )
        self.loan = Loan.objects.create(
            customer=self.customer, product=self.product,
            branch=self.branch,
            principal_amount=200000, annual_interest_rate=18,
            term_months=24, outstanding_principal=200000,
            disbursement_date=date.today(),
            maturity_date=date.today() + timedelta(days=730),
        )
        self.guarantee = Guarantee.objects.create(
            loan=self.loan, customer=self.customer,
            guarantee_type='VEHICLE',
            description='Auto', estimated_value=400000,
        )

    def test_create_vehicle(self):
        v = VehicleGuarantee.objects.create(
            guarantee=self.guarantee,
            make='Toyota', model='Corolla', year=2023,
            color='Blanco', plate_number='A123456',
            chassis_number='JTDKN3DU5A0000001',
        )
        self.assertEqual(str(v), '2023 Toyota Corolla - A123456')

    def test_vehicle_fields(self):
        v = VehicleGuarantee.objects.create(
            guarantee=self.guarantee,
            make='Honda', model='Civic', year=2024,
            color='Negro', plate_number='B999999',
            chassis_number='XYZ123',
            engine_number='ENG456', mileage=15000,
        )
        self.assertEqual(v.mileage, 15000)


class RealEstateGuaranteeTests(TestCase):

    def setUp(self):
        self.branch = Branch.objects.create(
            name='Test', code='T01', address='D', city='C', province='P',
        )
        self.customer = Customer.objects.create(
            first_name='A', last_name='B', id_number='001-0000001-1',
            phone1='8091111111', branch=self.branch,
        )
        self.product = LoanProduct.objects.create(
            name='P', code='P01', product_type='MORTGAGE',
            annual_interest_rate=12,
            min_amount=1000, max_amount=9999999,
            min_term_months=1, max_term_months=360,
        )
        self.loan = Loan.objects.create(
            customer=self.customer, product=self.product,
            branch=self.branch,
            principal_amount=3000000, annual_interest_rate=12,
            term_months=120, outstanding_principal=3000000,
            disbursement_date=date.today(),
            maturity_date=date.today() + timedelta(days=3650),
        )
        self.guarantee = Guarantee.objects.create(
            loan=self.loan, customer=self.customer,
            guarantee_type='REAL_ESTATE',
            description='Casa', estimated_value=5000000,
        )

    def test_create_real_estate(self):
        re = RealEstateGuarantee.objects.create(
            guarantee=self.guarantee,
            property_type='HOUSE',
            address='Calle Principal #50',
            city='Santo Domingo', province='Distrito Nacional',
            area_m2=Decimal('250.50'),
            title_number='TC-12345',
        )
        self.assertIn('Casa', str(re))

    def test_property_types(self):
        for ptype in ['HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OTHER']:
            g = Guarantee.objects.create(
                loan=self.loan, customer=self.customer,
                guarantee_type='REAL_ESTATE',
                description=f'Test {ptype}', estimated_value=1000000,
            )
            re = RealEstateGuarantee.objects.create(
                guarantee=g, property_type=ptype,
                address='Dir', city='C', province='P',
            )
            self.assertEqual(re.property_type, ptype)


class GuaranteeAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin@test.com', username='admin',
            first_name='Admin', last_name='Test', password='Pass123!',
        )
        self.client.force_authenticate(user=self.admin)

    def test_list_guarantees(self):
        res = self.client.get('/api/v1/guarantees/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_unauthenticated_blocked(self):
        client = APIClient()
        res = client.get('/api/v1/guarantees/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
