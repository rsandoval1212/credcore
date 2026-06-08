"""
Script para crear datos de demostración en CredCore.
Ejecutar: python setup_demo.py
"""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
os.environ['USE_SQLITE'] = 'True'
os.environ['USE_REDIS'] = 'False'
django.setup()

from decimal import Decimal
from datetime import date
from apps.branches.models import Branch
from apps.loan_products.models import LoanProduct
from apps.customers.models import Customer
from apps.users.models import User
from apps.cash.models import CashRegister

def run():
    print("🚀 Configurando datos de demostración...")

    # ── Sucursal principal ──────────────────────────────────────────────────
    branch, created = Branch.objects.get_or_create(
        code='SC-001',
        defaults={
            'name': 'Sucursal Central',
            'address': 'Av. 27 de Febrero #123, Santo Domingo',
            'city': 'Santo Domingo',
            'province': 'Distrito Nacional',
            'phone': '809-555-0100',
            'is_active': True,
            'is_main': True,
        }
    )
    if created:
        print(f"  ✅ Sucursal creada: {branch.name}")
    else:
        print(f"  ⏭️  Sucursal ya existe: {branch.name}")

    # ── Productos financieros ───────────────────────────────────────────────
    products = [
        {
            'name': 'Préstamo Personal Estándar',
            'code': 'PP-EST',
            'product_type': 'PERSONAL',
            'annual_interest_rate': Decimal('24.000'),
            'late_fee_rate': Decimal('0.100'),
            'commission_rate': Decimal('2.000'),
            'min_amount': Decimal('5000.00'),
            'max_amount': Decimal('200000.00'),
            'min_term_months': 3,
            'max_term_months': 36,
            'payment_method': 'NIVELADA',
            'loan_number_prefix': 'PP',
            'approval_levels': 1,
            'auto_approve_limit': Decimal('50000.00'),
        },
        {
            'name': 'Microcrédito Comercial',
            'code': 'MC-COM',
            'product_type': 'MICROCREDIT',
            'annual_interest_rate': Decimal('36.000'),
            'late_fee_rate': Decimal('0.150'),
            'commission_rate': Decimal('3.000'),
            'min_amount': Decimal('1000.00'),
            'max_amount': Decimal('50000.00'),
            'min_term_months': 1,
            'max_term_months': 18,
            'payment_method': 'NIVELADA',
            'loan_number_prefix': 'MC',
            'approval_levels': 1,
            'auto_approve_limit': Decimal('15000.00'),
        },
        {
            'name': 'Préstamo Hipotecario',
            'code': 'PH-001',
            'product_type': 'MORTGAGE',
            'annual_interest_rate': Decimal('16.000'),
            'late_fee_rate': Decimal('0.080'),
            'commission_rate': Decimal('1.500'),
            'min_amount': Decimal('500000.00'),
            'max_amount': Decimal('5000000.00'),
            'min_term_months': 12,
            'max_term_months': 120,
            'payment_method': 'NIVELADA',
            'loan_number_prefix': 'PH',
            'requires_guarantee': True,
            'approval_levels': 2,
            'auto_approve_limit': Decimal('0.00'),
        },
    ]

    for pd in products:
        p, created = LoanProduct.objects.get_or_create(
            code=pd['code'],
            defaults={**pd, 'branch': branch, 'is_active': True}
        )
        status = "✅ Creado" if created else "⏭️  Existe"
        print(f"  {status}: {p.name} ({p.code})")

    # ── Caja ───────────────────────────────────────────────────────────────
    cash, created = CashRegister.objects.get_or_create(
        name="Caja Principal",
        defaults={'branch': branch, 'currency': 'DOP', 'is_active': True}
    )
    if created:
        print(f"  ✅ Caja creada: {cash.name}")
    else:
        print(f"  ⏭️  Caja ya existe: {cash.name}")

    # ── Asignar sucursal al admin ──────────────────────────────────────────
    try:
        admin = User.objects.get(email='admin@credcore.local')
        if not admin.branch:
            admin.branch = branch
            admin.save(update_fields=['branch'])
            print(f"  ✅ Sucursal asignada al admin")
        else:
            print(f"  ⏭️  Admin ya tiene sucursal")
    except User.DoesNotExist:
        print("  ⚠️  Usuario admin no encontrado")

    # ── Clientes de ejemplo ───────────────────────────────────────────────
    demo_customers = [
        {
            'first_name': 'Juan', 'second_name': 'Carlos',
            'last_name': 'Pérez', 'second_last_name': 'García',
            'id_type': 'CEDULA', 'id_number': '001-1234567-8',
            'phone1': '809-555-0101', 'email': 'juan.perez@email.com',
            'gender': 'M', 'marital_status': 'MARRIED',
            'date_of_birth': date(1985, 3, 15),
            'nationality': 'Dominicano',
            'address': 'Calle 5 #12, Los Prados', 'sector': 'Los Prados',
            'municipality': 'Santo Domingo Norte', 'province': 'Santo Domingo',
            'city': 'Santo Domingo', 'country': 'República Dominicana',
            'occupation': 'Empleado Bancario', 'employer': 'Banco Popular',
            'employment_years': 5, 'monthly_income': Decimal('45000.00'),
            'other_income': Decimal('5000.00'), 'monthly_expenses': Decimal('20000.00'),
            'status': 'ACTIVE', 'risk_level': 'LOW', 'credit_score': 780,
        },
        {
            'first_name': 'María', 'second_name': 'Elena',
            'last_name': 'Rodríguez', 'second_last_name': 'Martínez',
            'id_type': 'CEDULA', 'id_number': '002-9876543-1',
            'phone1': '829-555-0202', 'email': 'maria.rodriguez@gmail.com',
            'gender': 'F', 'marital_status': 'SINGLE',
            'date_of_birth': date(1990, 7, 22),
            'nationality': 'Dominicana',
            'address': 'Av. Independencia #45, Gazcue', 'sector': 'Gazcue',
            'municipality': 'Distrito Nacional', 'province': 'Distrito Nacional',
            'city': 'Santo Domingo', 'country': 'República Dominicana',
            'occupation': 'Comerciante', 'employer': 'Negocio Propio',
            'employment_years': 3, 'monthly_income': Decimal('30000.00'),
            'other_income': Decimal('0.00'), 'monthly_expenses': Decimal('15000.00'),
            'status': 'ACTIVE', 'risk_level': 'MEDIUM', 'credit_score': 620,
        },
        {
            'first_name': 'Carlos', 'second_name': 'Antonio',
            'last_name': 'Medina', 'second_last_name': 'Sánchez',
            'id_type': 'CEDULA', 'id_number': '003-5555555-5',
            'phone1': '849-555-0303', 'email': 'carlos.medina@hotmail.com',
            'gender': 'M', 'marital_status': 'MARRIED',
            'date_of_birth': date(1975, 11, 8),
            'nationality': 'Dominicano',
            'address': 'Calle Las Flores #78, Los Alcarrizos', 'sector': 'Los Alcarrizos',
            'municipality': 'Los Alcarrizos', 'province': 'Santo Domingo',
            'city': 'Santo Domingo', 'country': 'República Dominicana',
            'occupation': 'Técnico Electricista', 'employer': 'Edenorte',
            'employment_years': 10, 'monthly_income': Decimal('25000.00'),
            'other_income': Decimal('8000.00'), 'monthly_expenses': Decimal('18000.00'),
            'status': 'ACTIVE', 'risk_level': 'LOW', 'credit_score': 710,
        },
    ]

    for cd in demo_customers:
        existing = Customer.objects.filter(id_number=cd['id_number']).first()
        if existing:
            print(f"  ⏭️  Cliente ya existe: {existing.get_full_name()}")
        else:
            customer = Customer.objects.create(**cd, branch=branch)
            print(f"  ✅ Cliente creado: {customer.get_full_name()} ({customer.customer_code})")

    print("\n✨ Datos de demostración configurados exitosamente!")
    print(f"\n📊 Resumen:")
    print(f"   Sucursales:  {Branch.objects.count()}")
    print(f"   Productos:   {LoanProduct.objects.count()}")
    print(f"   Clientes:    {Customer.objects.filter(is_deleted=False).count()}")
    print(f"   Cajas:       {CashRegister.objects.count()}")
    print(f"\n🌐 Accede en: http://localhost:3000")

if __name__ == '__main__':
    run()
