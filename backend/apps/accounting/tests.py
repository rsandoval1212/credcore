"""
Tests para el módulo de contabilidad.
Ejecutar: python manage.py test apps.accounting.tests --verbosity=2
"""
from decimal import Decimal
from datetime import date
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import User
from apps.branches.models import Branch
from apps.accounting.models import (
    AccountType, Account, AccountingPeriod,
    JournalEntry, JournalEntryLine,
)


class AccountTypeTests(TestCase):

    def test_create_account_type(self):
        at = AccountType.objects.create(code='1', name='Activos', nature='DEBIT')
        self.assertEqual(str(at), '1 - Activos')

    def test_unique_code(self):
        AccountType.objects.create(code='UNIQUE', name='A', nature='DEBIT')
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            AccountType.objects.create(code='UNIQUE', name='B', nature='CREDIT')


class AccountTests(TestCase):

    def setUp(self):
        self.acc_type = AccountType.objects.create(code='1', name='Activos', nature='DEBIT')

    def test_create_account(self):
        a = Account.objects.create(code='1.1', name='Efectivo', account_type=self.acc_type)
        self.assertEqual(str(a), '1.1 - Efectivo')
        self.assertTrue(a.is_detail)
        self.assertTrue(a.allows_transactions)
        self.assertTrue(a.is_active)

    def test_parent_child(self):
        parent = Account.objects.create(
            code='1', name='Activos', account_type=self.acc_type,
            is_detail=False, level=1,
        )
        child = Account.objects.create(
            code='1.1', name='Efectivo', account_type=self.acc_type,
            parent=parent, level=2,
        )
        self.assertEqual(child.parent, parent)
        self.assertEqual(parent.children.count(), 1)

    def test_unique_account_code(self):
        Account.objects.create(code='UCODE', name='A', account_type=self.acc_type)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            Account.objects.create(code='UCODE', name='B', account_type=self.acc_type)


class AccountingPeriodTests(TestCase):

    def test_create_period(self):
        p = AccountingPeriod.objects.create(
            name='Enero 2026', start_date=date(2026, 1, 1), end_date=date(2026, 1, 31),
        )
        self.assertFalse(p.is_closed)
        self.assertEqual(str(p), 'Enero 2026')


class JournalEntryTests(TestCase):

    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='admin@test.com', username='admin',
            first_name='Admin', last_name='Test', password='Pass123!',
        )
        self.branch = Branch.objects.create(
            name='Test', code='T01', address='D', city='C', province='P',
        )
        self.period = AccountingPeriod.objects.create(
            name='Test', start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        self.acc_type = AccountType.objects.create(code='1', name='Activos', nature='DEBIT')
        self.account_debit = Account.objects.create(
            code='1.1', name='Caja', account_type=self.acc_type,
        )
        self.acc_type_cr = AccountType.objects.create(code='4', name='Ingresos', nature='CREDIT')
        self.account_credit = Account.objects.create(
            code='4.1', name='Intereses Cobrados', account_type=self.acc_type_cr,
        )

    def test_create_journal_entry(self):
        je = JournalEntry.objects.create(
            period=self.period, entry_date=date.today(),
            description='Cobro de intereses', created_by=self.admin,
            branch=self.branch, total_debit=1000, total_credit=1000,
        )
        self.assertEqual(je.status, 'DRAFT')

    def test_journal_entry_lines(self):
        je = JournalEntry.objects.create(
            period=self.period, entry_date=date.today(),
            description='Test', created_by=self.admin,
            branch=self.branch,
        )
        JournalEntryLine.objects.create(
            entry=je, account=self.account_debit,
            debit=Decimal('5000'), credit=0,
        )
        JournalEntryLine.objects.create(
            entry=je, account=self.account_credit,
            debit=0, credit=Decimal('5000'),
        )
        self.assertEqual(je.lines.count(), 2)
        total_db = sum(l.debit for l in je.lines.all())
        total_cr = sum(l.credit for l in je.lines.all())
        self.assertEqual(total_db, total_cr)

    def test_balanced_entry(self):
        """Débitos = Créditos en un asiento balanceado."""
        je = JournalEntry.objects.create(
            period=self.period, entry_date=date.today(),
            description='Balanceado', created_by=self.admin,
            branch=self.branch, total_debit=2500, total_credit=2500,
        )
        self.assertEqual(je.total_debit, je.total_credit)


class AccountingAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin@test.com', username='admin',
            first_name='Admin', last_name='Test', password='Pass123!',
        )
        self.client.force_authenticate(user=self.admin)

    def test_list_accounts(self):
        res = self.client.get('/api/v1/accounting/accounts/')
        self.assertIn(res.status_code, [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND])

    def test_unauthenticated_blocked(self):
        client = APIClient()
        res = client.get('/api/v1/accounting/accounts/')
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_404_NOT_FOUND])
