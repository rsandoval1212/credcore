import os
import sys
import django

# Configurar Django
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.development'
os.environ['USE_SQLITE'] = 'True'
os.environ['USE_REDIS'] = 'False'

# Agregar el directorio del backend al path
sys.path.insert(0, os.path.dirname(__file__))

# Configurar Django
django.setup()

# Ejecutar migraciones
from django.core.management import call_command
print("Ejecutando migraciones...")
call_command('migrate', '--run-syncdb')
print("✅ Migraciones completadas")

# Crear superusuario
from apps.users.models import User
from apps.users.models import Role

# Crear roles básicos si no existen
admin_role, _ = Role.objects.get_or_create(
    name='Administrador',
    defaults={'description': 'Acceso completo al sistema'}
)

# Crear usuario administrador
user_data = {
    'email': 'admin@credcore.local',
    'username': 'admin',
    'first_name': 'Admin',
    'last_name': 'CredCore',
    'phone': '+1234567890',
    'is_active': True,
    'is_staff': True,
    'is_superuser': True,
}

user, created = User.objects.get_or_create(
    email=user_data['email'],
    defaults={
        'username': user_data['username'],
        'first_name': user_data['first_name'],
        'last_name': user_data['last_name'],
        'phone': user_data['phone'],
        'is_active': user_data['is_active'],
        'is_staff': user_data['is_staff'],
        'is_superuser': user_data['is_superuser'],
    }
)

if created:
    _pwd = os.environ.get('CREDCORE_ADMIN_PASSWORD', 'AdminCredCore123!')
    user.set_password(_pwd)
    user.save()
    user.roles.add(admin_role)
    print(f"✅ Usuario administrador creado:")
    print(f"   Email: admin@credcore.local")
    print(f"   Contraseña: (variable CREDCORE_ADMIN_PASSWORD o default)")
else:
    print("⚠️ El usuario administrador ya existe")
    print(f"   Email: admin@credcore.local")
