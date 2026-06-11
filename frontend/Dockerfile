# ═══════════════════════════════════════════════════════════════════════════════
# CredCore Frontend — Multi-stage production build
# ═══════════════════════════════════════════════════════════════════════════════

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

# ── Production stage — serve with Nginx ──────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/credcore.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy service worker to root
COPY --from=build /app/public/sw.js /usr/share/nginx/html/sw.js 2>/dev/null || true

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
