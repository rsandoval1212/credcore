#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CredCore — Script de Deployment para DigitalOcean
# Ejecutar en el servidor: bash deploy.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -e

echo "═══════════════════════════════════════════════════════════"
echo "  CredCore — Deployment Script"
echo "═══════════════════════════════════════════════════════════"

# ── Colores ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── 1. Verificar requisitos ─────────────────────────────────────────────────
echo ""
echo "Paso 1: Verificando requisitos..."
command -v docker >/dev/null 2>&1 || error "Docker no está instalado. Ejecuta: curl -fsSL https://get.docker.com | sh"
command -v docker compose >/dev/null 2>&1 || error "Docker Compose no está instalado."
log "Docker y Docker Compose disponibles"

# ── 2. Verificar .env.production ─────────────────────────────────────────────
if [ ! -f .env.production ]; then
    error "Archivo .env.production no encontrado. Cópialo y configúralo primero."
fi

# Verificar que se cambiaron los valores por defecto
if grep -q "CAMBIAR" .env.production; then
    warn "⚠️  .env.production contiene valores por defecto (CAMBIAR)."
    warn "   Edítalo antes de continuar: nano .env.production"
    read -p "¿Continuar de todos modos? (solo para pruebas) [y/N]: " confirm
    [ "$confirm" != "y" ] && exit 1
fi
log ".env.production encontrado"

# ── 3. Generar SECRET_KEY si no existe ───────────────────────────────────────
if grep -q "CAMBIAR-genera-con-python" .env.production; then
    NEW_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))" 2>/dev/null || openssl rand -base64 50 | tr -d '=/+' | head -c 50)
    sed -i "s|CAMBIAR-genera-con-python.*|${NEW_KEY}|" .env.production
    log "SECRET_KEY generada automáticamente"
fi

# ── 4. Crear directorios necesarios ─────────────────────────────────────────
mkdir -p backups/db nginx/ssl
log "Directorios creados"

# ── 5. Build de contenedores ────────────────────────────────────────────────
echo ""
echo "Paso 5: Construyendo contenedores (puede tomar 3-5 minutos)..."
docker compose -f docker-compose.prod.yml build --no-cache
log "Contenedores construidos"

# ── 6. Levantar base de datos primero ────────────────────────────────────────
echo ""
echo "Paso 6: Iniciando base de datos..."
docker compose -f docker-compose.prod.yml up -d db redis
echo "Esperando que PostgreSQL esté listo..."
sleep 10
docker compose -f docker-compose.prod.yml exec db pg_isready -U ${DB_USER:-credcore_user} || sleep 5
log "Base de datos lista"

# ── 7. Levantar backend y migrar ────────────────────────────────────────────
echo ""
echo "Paso 7: Iniciando backend y ejecutando migraciones..."
docker compose -f docker-compose.prod.yml up -d backend
sleep 5

# Ejecutar migraciones
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
log "Migraciones aplicadas"

# Collectstatic
docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
log "Archivos estáticos recolectados"

# Crear superusuario si no existe
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from apps.users.models import User
import os
email = os.environ.get('CREDCORE_ADMIN_EMAIL', 'admin@credcore.local')
if not User.objects.filter(email=email).exists():
    User.objects.create_superuser(
        email=email,
        username='admin',
        first_name='Admin',
        last_name='CredCore',
        password=os.environ.get('CREDCORE_ADMIN_PASSWORD', 'AdminCredCore123!')
    )
    print(f'Superusuario {email} creado')
else:
    print(f'Superusuario {email} ya existe')
"

# Seed RBAC
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from apps.users.models import Permission
if Permission.objects.count() == 0:
    print('Creando permisos RBAC...')
    for mod_code, mod_name in Permission.MODULE_CHOICES:
        for act_code, act_name in Permission.ACTION_CHOICES:
            Permission.objects.get_or_create(
                module=mod_code, action=act_code,
                defaults={'codename': f'{mod_code}.{act_code}', 'description': f'{act_name} {mod_name}'}
            )
    print(f'{Permission.objects.count()} permisos creados')
else:
    print(f'{Permission.objects.count()} permisos ya existen')
"
log "Backend configurado"

# ── 8. Levantar todo ────────────────────────────────────────────────────────
echo ""
echo "Paso 8: Levantando todos los servicios..."
docker compose -f docker-compose.prod.yml up -d
log "Todos los servicios iniciados"

# ── 9. Verificar ─────────────────────────────────────────────────────────────
echo ""
echo "Paso 9: Verificando servicios..."
sleep 10

# Health check
if curl -sf http://localhost:8000/api/v1/health/ > /dev/null 2>&1; then
    log "Backend API respondiendo ✓"
else
    warn "Backend aún iniciando... espera unos segundos y verifica manualmente"
fi

if curl -sf http://localhost/ > /dev/null 2>&1; then
    log "Frontend respondiendo ✓"
else
    warn "Frontend aún iniciando..."
fi

# ── 10. Resumen ──────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "  ${GREEN}✅ CredCore desplegado exitosamente!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Servicios activos:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "  Próximos pasos:"
echo "  1. Configura tu dominio DNS → IP del servidor"
echo "  2. Ejecuta: bash ssl-setup.sh tu-dominio.com"
echo "  3. Accede a https://tu-dominio.com"
echo ""
