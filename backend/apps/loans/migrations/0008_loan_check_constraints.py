from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0007_loan_is_confidential'),
    ]

    operations = [
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
