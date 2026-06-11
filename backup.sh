#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CredCore — Backup automático de base de datos
# Agregar a crontab: 0 2 * * * /root/credcore/backup.sh
# (Ejecuta backup diario a las 2:00 AM)
# ═══════════════════════════════════════════════════════════════════════════════

BACKUP_DIR="$(dirname "$0")/backups/db"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="credcore_backup_${DATE}.sql.gz"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando backup..."

# Dump de la base de datos comprimido
docker compose -f "$(dirname "$0")/docker-compose.prod.yml" exec -T db \
    pg_dump -U "${DB_USER:-credcore_user}" -d "${DB_NAME:-credcore_db}" \
    | gzip > "${BACKUP_DIR}/${FILENAME}"

if [ $? -eq 0 ]; then
    SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
    echo "[$(date)] ✓ Backup completado: ${FILENAME} (${SIZE})"
else
    echo "[$(date)] ✗ Error en backup"
    exit 1
fi

# Eliminar backups viejos (más de 30 días)
find "$BACKUP_DIR" -name "credcore_backup_*.sql.gz" -mtime +$KEEP_DAYS -delete
REMAINING=$(ls "$BACKUP_DIR"/credcore_backup_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Backups almacenados: ${REMAINING}"
