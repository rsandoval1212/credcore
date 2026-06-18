"""Siembra productos financieros por defecto en instalaciones nuevas.

Sin productos, el módulo de Solicitudes no permite crear ninguna solicitud
("Seleccione un producto"). Esta migración crea un catálogo base SOLO si la
instalación no tiene ningún producto todavía, de modo que nunca interfiere con
catálogos ya configurados por el cliente.
"""
from decimal import Decimal
from django.db import migrations


DEFAULT_PRODUCTS = [
    {
        'name': 'Préstamo Personal', 'code': 'PP-EST', 'product_type': 'PERSONAL',
        'annual_interest_rate': Decimal('24.000'), 'late_fee_rate': Decimal('0.100'),
        'commission_rate': Decimal('2.000'),
        'min_amount': Decimal('5000.00'), 'max_amount': Decimal('200000.00'),
        'min_term_months': 3, 'max_term_months': 36, 'loan_number_prefix': 'PP',
        'auto_approve_limit': Decimal('50000.00'),
        'description': 'Préstamo personal de cuotas niveladas.',
    },
    {
        'name': 'Microcrédito', 'code': 'MC-COM', 'product_type': 'MICROCREDIT',
        'annual_interest_rate': Decimal('36.000'), 'late_fee_rate': Decimal('0.150'),
        'commission_rate': Decimal('3.000'),
        'min_amount': Decimal('1000.00'), 'max_amount': Decimal('50000.00'),
        'min_term_months': 1, 'max_term_months': 18, 'loan_number_prefix': 'MC',
        'auto_approve_limit': Decimal('15000.00'),
        'description': 'Microcrédito para capital de trabajo y pequeños negocios.',
    },
    {
        'name': 'Préstamo Comercial', 'code': 'PC-COM', 'product_type': 'COMMERCIAL',
        'annual_interest_rate': Decimal('28.000'), 'late_fee_rate': Decimal('0.120'),
        'commission_rate': Decimal('2.500'),
        'min_amount': Decimal('25000.00'), 'max_amount': Decimal('1000000.00'),
        'min_term_months': 6, 'max_term_months': 48, 'loan_number_prefix': 'PC',
        'auto_approve_limit': Decimal('0.00'),
        'description': 'Financiamiento para empresas y comercios.',
    },
    {
        'name': 'Préstamo Prendario', 'code': 'PR-001', 'product_type': 'PRENDARIO',
        'annual_interest_rate': Decimal('30.000'), 'late_fee_rate': Decimal('0.150'),
        'commission_rate': Decimal('3.000'),
        'min_amount': Decimal('10000.00'), 'max_amount': Decimal('500000.00'),
        'min_term_months': 3, 'max_term_months': 36, 'loan_number_prefix': 'PR',
        'requires_guarantee': True, 'auto_approve_limit': Decimal('0.00'),
        'description': 'Préstamo con garantía prendaria (vehículo u otro bien).',
    },
]


def seed_products(apps, schema_editor):
    LoanProduct = apps.get_model('loan_products', 'LoanProduct')
    # Solo sembrar si el catálogo está vacío — nunca tocar catálogos existentes.
    if LoanProduct.objects.exists():
        return
    for data in DEFAULT_PRODUCTS:
        LoanProduct.objects.create(
            interest_rate_type='FIXED',
            calculation_method='SIMPLE',
            payment_method='NIVELADA',
            payment_frequency='MONTHLY',
            approval_levels=1,
            is_active=True,
            **data,
        )


def unseed_products(apps, schema_editor):
    # Reverso: eliminar solo los productos por defecto que sigan sin uso.
    LoanProduct = apps.get_model('loan_products', 'LoanProduct')
    codes = [p['code'] for p in DEFAULT_PRODUCTS]
    LoanProduct.objects.filter(code__in=codes, loan__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('loan_products', '0003_loanproduct_payment_frequency'),
    ]

    operations = [
        migrations.RunPython(seed_products, unseed_products),
    ]
