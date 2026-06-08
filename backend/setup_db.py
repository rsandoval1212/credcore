import os, sys

os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.development'
os.environ['USE_SQLITE'] = 'True'
os.environ['USE_REDIS'] = 'False'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("Iniciando setup...")
import django
django.setup()

from django.conf import settings
print("DB:", settings.DATABASES['default']['NAME'])

from django.core.management import call_command
print("\nEjecutando migraciones...")
call_command('migrate', '--run-syncdb', verbosity=1)

print("\nCreando admin...")
from apps.users.models import User
email = 'admin@credcore.com'
password = 'Admin123!'

if User.objects.filter(email=email).exists():
    u = User.objects.get(email=email)
    u.set_password(password)
    u.is_active = True
    u.is_superuser = True
    u.is_staff = True
    u.save()
    print("Admin actualizado:", email)
else:
    User.objects.create_superuser(
        email=email, username='admin', password=password,
        first_name='Admin', last_name='CredCore'
    )
    print("Admin creado:", email)

print("Usuarios en DB:", User.objects.count())
print("\nListo! Credenciales: admin@credcore.com / Admin123!")
