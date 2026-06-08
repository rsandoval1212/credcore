import sqlite3

conn = sqlite3.connect('db.sqlite3')
cursor = conn.cursor()

# Crear tabla de migraciones si no existe
cursor.execute('''
CREATE TABLE IF NOT EXISTS django_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app TEXT NOT NULL,
    name TEXT NOT NULL,
    applied DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
''')

# Marcar las migraciones iniciales como realizadas (fake)
migrations = [
    ('users', '0001_initial'),
    ('accounting', '0001_initial'),
    ('admin', '0001_initial'),
    ('branches', '0001_initial'),
    ('cash', '0001_initial'),
    ('collections', '0001_initial'),
    ('customers', '0001_initial'),
    ('guarantees', '0001_initial'),
    ('loan_applications', '0001_initial'),
    ('loan_products', '0001_initial'),
    ('loans', '0001_initial'),
    ('payments', '0001_initial'),
    ('token_blacklist', '0001_initial'),
]

for app, migration_name in migrations:
    cursor.execute(
        'INSERT OR IGNORE INTO django_migrations (app, name) VALUES (?, ?)',
        (app, migration_name)
    )
    print(f"✓ Migración marcada: {app}.{migration_name}")

conn.commit()
conn.close()
print("\n✅ Todas las migraciones iniciales han sido marcadas como completadas")
