# Migración a PostgreSQL (cuándo y cómo)

## Cuándo migrar

CredCore corre por defecto con **SQLite** porque es lo ideal para el caso desktop monousuario. **NO** necesitas migrar a Postgres si:

- Solo hay 1 usuario activo a la vez (un dueño, un cobrador)
- Los datos caben en <2 GB
- El cliente usa la PC local sin compartir red

**Sí debes considerar migrar a Postgres cuando**:

- ≥2 usuarios accediendo simultáneamente (cajeros cobrando en paralelo)
- Errores `database is locked` aparecen en los logs
- La BD crece >2 GB
- El cliente quiere acceso desde varias computadoras en red local
- Necesitas hacer reportes pesados sin bloquear cobros en vivo

## Cómo migrar (cuando llegue el momento)

### 1. Instalar PostgreSQL en la máquina del cliente

- Descargar: https://www.postgresql.org/download/windows/
- Versión recomendada: 16.x
- Durante el setup, anotar la contraseña del usuario `postgres`

### 2. Crear la base de datos

```sql
CREATE DATABASE credcore;
CREATE USER credcore WITH PASSWORD 'clave_segura_aqui';
GRANT ALL PRIVILEGES ON DATABASE credcore TO credcore;
\c credcore
GRANT ALL ON SCHEMA public TO credcore;
```

### 3. Exportar datos de SQLite

En la máquina del cliente (con CredCore aún en SQLite):

```bash
cd "C:\Program Files\CredCore\_internal\backend"
python manage.py dumpdata --natural-foreign --natural-primary --exclude=contenttypes --exclude=auth.permission --exclude=admin.logentry > full_backup.json
```

### 4. Configurar CredCore para usar Postgres

Edita el launcher `credcore_app.py` agregando estas env vars antes de arrancar Django:

```python
env["DB_ENGINE"]   = "postgresql"
env["DB_NAME"]     = "credcore"
env["DB_USER"]     = "credcore"
env["DB_PASSWORD"] = "clave_segura_aqui"
env["DB_HOST"]     = "localhost"
env["DB_PORT"]     = "5432"
```

### 5. Aplicar migraciones contra Postgres vacío

```bash
python manage.py migrate
```

### 6. Importar los datos

```bash
python manage.py loaddata full_backup.json
```

### 7. Verificar

Abrir CredCore. Debería arrancar normal, ver los mismos clientes/préstamos. Si funciona, ya está usando Postgres.

## Plan de rollback

Si algo sale mal:
1. Detener CredCore
2. Quitar las env vars `DB_*` del launcher
3. Restaurar la `credcore.sqlite3` desde el último backup (`%APPDATA%\CredCore\backups\`)
4. Reabrir CredCore — vuelve a SQLite con los datos previos

## Diferencias importantes

| Aspecto | SQLite | PostgreSQL |
|---|---|---|
| Backup | Copiar archivo `.sqlite3` | `pg_dump` o `pg_basebackup` |
| Multi-usuario | Lockea bajo concurrencia | Diseñado para concurrencia |
| Tamaño | Bueno hasta 2 GB | Sin límite práctico |
| Velocidad reads simples | Más rápido | Comparable |
| Transacciones complejas | Bloquea más | Concurrencia real |
| Hosting | Embebido (cero config) | Requiere servidor |

## Implementación técnica ya lista

El archivo `backend/config/settings/development.py` ya tiene soporte para ambos motores. Solo necesitas setear las env vars al arrancar el launcher. **No requiere cambios de código adicionales**.
