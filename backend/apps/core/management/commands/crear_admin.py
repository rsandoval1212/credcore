"""
Crea el usuario administrador por defecto si no existe.
Uso: python manage.py crear_admin
"""
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Crea el usuario administrador por defecto'

    def handle(self, *args, **options):
        import os
        from apps.users.models import User

        email = os.environ.get('CREDCORE_ADMIN_EMAIL', 'admin@credcore.com')
        password = os.environ.get('CREDCORE_ADMIN_PASSWORD', 'Admin123!')

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(
                f'  El administrador ya existe: {email}'
            ))
            return

        user = User.objects.create_superuser(
            email=email,
            username='admin',
            password=password,
            first_name='Administrador',
            last_name='CredCore',
        )

        self.stdout.write(self.style.SUCCESS(
            f'\n  ✅ Administrador creado exitosamente\n'
            f'     Email:      {email}\n'
            f'     Contraseña: (variable CREDCORE_ADMIN_PASSWORD)\n'
            f'     (Cámbiala en Configuracion > Usuarios)\n'
        ))
