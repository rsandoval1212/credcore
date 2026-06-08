from django.contrib.auth.hashers import make_password
from apps.users.models import User, Role

# Create admin role
admin_role, _ = Role.objects.get_or_create(
    name='Administrador',
    defaults={'description': 'Acceso completo al sistema', 'is_active': True}
)

# Create admin user
admin_user, created = User.objects.get_or_create(
    email='admin@credcore.local',
    defaults={
        'username': 'admin',
        'first_name': 'Administrador',
        'last_name': 'CredCore',
        'is_staff': True,
        'is_superuser': True,
        'is_active': True,
        'password': make_password('AdminCredCore123!')
    }
)

# Assign role
admin_user.roles.add(admin_role)

if created:
    print(f"✅ Usuario admin creado exitosamente")
    print(f"   Email: admin@credcore.local")
    print(f"   Contraseña: AdminCredCore123!")
else:
    print(f"ℹ️  Usuario admin ya existía")
