from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('loans', '0005_loan_client_signature_loan_signature_date_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='loan',
            name='total_installments',
            field=models.PositiveSmallIntegerField(
                blank=True, null=True,
                help_text='Total de cuotas (ej: 13 semanas)',
            ),
        ),
        migrations.AddField(
            model_name='loan',
            name='client_installments',
            field=models.PositiveSmallIntegerField(
                blank=True, null=True,
                help_text='Cuotas que cubren el capital (ej: 10 de 13)',
            ),
        ),
    ]
