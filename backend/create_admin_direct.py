import sqlite3
import hashlib

# Conectar a la BD
conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Primero, crear las tablas necesarias
cursor.executescript('''
-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    password VARCHAR(128) NOT NULL,
    last_login DATETIME,
    email VARCHAR(254) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    avatar VARCHAR(100),
    branch_id INTEGER,
    is_active BOOLEAN DEFAULT 1,
    is_staff BOOLEAN DEFAULT 0,
    is_superuser BOOLEAN DEFAULT 0,
    is_verified BOOLEAN DEFAULT 0,
    two_fa_enabled BOOLEAN DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_password_change DATETIME,
    password_must_change BOOLEAN DEFAULT 0
);

-- Tabla de roles
CREATE TABLE IF NOT EXISTS users_role (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de usuario-roles
CREATE TABLE IF NOT EXISTS users_userrole (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users_user(id),
    FOREIGN KEY(role_id) REFERENCES users_role(id),
    UNIQUE(user_id, role_id)
);
''')

# Crear el rol de Administrador si no existe
cursor.execute('SELECT id FROM users_role WHERE name = ?', ('Administrador',))
role = cursor.fetchone()
if not role:
    cursor.execute('''
        INSERT INTO users_role (name, description, is_active)
        VALUES (?, ?, ?)
    ''', ('Administrador', 'Acceso completo al sistema', 1))
    role_id = cursor.lastrowid
    print(f"✅ Rol 'Administrador' creado (ID: {role_id})")
else:
    role_id = role[0]
    print(f"ℹ️ Rol 'Administrador' ya existe (ID: {role_id})")

# Crear el usuario admin si no existe
cursor.execute('SELECT id FROM users_user WHERE email = ?', ('admin@credcore.local',))
user = cursor.fetchone()

if not user:
    # Django usa PBKDF2 para las contraseñas
    # Para fines de desarrollo, usaremos una contraseña simple hasheada
    password = 'AdminCredCore123!'
    # Hash simple para desarrollo
    hashed_password = hashlib.pbkdf2_hmac('sha256', password.encode(), b'salt', 100000).hex()
    
    cursor.execute('''
        INSERT INTO users_user (
            email, username, first_name, last_name, phone,
            is_active, is_staff, is_superuser, password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'admin@credcore.local',
        'admin',
        'Admin',
        'CredCore',
        '+1234567890',
        1, 1, 1,
        f'pbkdf2_sha256$100000$salt${hashed_password}'
    ))
    
    admin_user_id = cursor.lastrowid
    
    # Asignar el rol de Administrador
    cursor.execute('''
        INSERT INTO users_userrole (user_id, role_id)
        VALUES (?, ?)
    ''', (admin_user_id, role_id))
    
    conn.commit()
    print(f"✅ Usuario administrador creado:")
    print(f"   Email:      admin@credcore.local")
    print(f"   Usuario:    admin")
    print(f"   Contraseña: AdminCredCore123!")
else:
    print("⚠️ El usuario administrador ya existe")
    print(f"   Email:  admin@credcore.local")
    print(f"   Usuario: admin")

conn.close()
