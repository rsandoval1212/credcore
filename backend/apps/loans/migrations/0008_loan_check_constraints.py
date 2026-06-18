from decimal import Decimal
from django.db import migrations, models


def clamp_invalid_values(apps, schema_editor):
    Loan = apps.get_model('loans', 'Loan')
    Loan.objects.filter(principal_amount__lte=0).update(principal_amount=Decimal('0.01'))
    Loan.objects.filter(annual_interest_rate__lt=0).update(annual_interest_rate=Decimal('0'))


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0007_loan_is_confidential'),
    ]

    operations = [
        migrations.RunPython(clamp_invalid_values, reverse_noop),
        migrations.AddConstraint(
            model_name='loan',
            constraint=models.CheckConstraint(
                check=models.Q(principal_amount__gt=0),
                name='loan_principal_positive',
            ),
        ),
        migrations.AddConstraint(
            model_name='loan',
            constraint=models.CheckConstraint(
                check=models.Q(annual_interest_rate__gte=0),
                name='loan_rate_non_negative',
            ),
        ),
    ]
