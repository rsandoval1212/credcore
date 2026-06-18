from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0006_loan_total_installments_loan_client_installments'),
    ]

    operations = [
        migrations.AddField(
            model_name='loan',
            name='is_confidential',
            field=models.BooleanField(default=False, help_text='Préstamo rápido confidencial (solo admin)'),
        ),
    ]
