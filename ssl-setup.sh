#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CredCore — Script para configurar SSL con Let's Encrypt
# Uso: bash ssl-setup.sh tu-dominio.com tu-email@gmail.com
# ═══════════════════════════════════════════════════════════════════════════════
set -e

DOMAIN=${1:?"Uso: bash ssl-setup.sh DOMINIO EMAIL"}
EMAIL=${2:?"Uso: bash ssl-setup.sh DOMINIO EMAIL"}

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[✓]${NC} $1"; }

echo "═══════════════════════════════════════════════════════════"
echo "  Configurando SSL para: $DOMAIN"
echo "═══════════════════════════════════════════════════════════"

# 1. Actualizar nginx.conf con el dominio real
echo "Actualizando configuración Nginx con dominio $DOMAIN..."
sed -i "s/credcore\.com/$DOMAIN/g" nginx/nginx.conf
sed -i "s/credcore\.com/$DOMAIN/g" .env.production
log "Dominio actualizado en configuración"

# 2. Primero, necesitamos un nginx temporal sin SSL para el challenge
cat > /tmp/nginx-temp.conf << 'EOF'
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name _;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'CredCore SSL setup in progress...';
            add_header Content-Type text/plain;
        }
    }
}
EOF

# 3. Levantar nginx temporal
echo "Levantando servidor temporal para verificación DNS..."
docker run -d --name certbot_nginx \
    -p 80:80 \
    -v "$(pwd)/nginx/ssl:/etc/nginx/ssl" \
    -v certbot_data:/var/www/certbot \
    -v /tmp/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
    nginx:1.27-alpine

sleep 3
log "Servidor temporal activo"

# 4. Obtener certificado SSL
echo "Solicitando certificado SSL a Let's Encrypt..."
docker run --rm \
    -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
    -v certbot_data:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

log "Certificado SSL obtenido"

# 5. Limpiar nginx temporal
docker stop certbot_nginx && docker rm certbot_nginx
rm /tmp/nginx-temp.conf
log "Servidor temporal eliminado"

# 6. Reiniciar con configuración completa
echo "Reiniciando con SSL habilitado..."
docker compose -f docker-compose.prod.yml up -d nginx
log "Nginx con SSL reiniciado"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "  ${GREEN}✅ SSL configurado para $DOMAIN${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Accede a: https://$DOMAIN"
echo ""
echo "  El certificado se renueva automáticamente."
echo "  Para renovar manualmente:"
echo "  docker compose -f docker-compose.prod.yml run certbot renew"
echo ""
