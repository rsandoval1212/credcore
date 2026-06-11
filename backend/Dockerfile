# ═══════════════════════════════════════════════════════════════════════════════
# CredCore Backend — Multi-stage production Dockerfile
# ═══════════════════════════════════════════════════════════════════════════════
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    tesseract-ocr \
    tesseract-ocr-spa \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Dependencies stage ───────────────────────────────────────────────────────
FROM base AS deps

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Production stage ─────────────────────────────────────────────────────────
FROM base AS production

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Create non-root user
RUN groupadd -r credcore && useradd -r -g credcore -d /app -s /sbin/nologin credcore

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/staticfiles /app/media /var/log/credcore \
    && chown -R credcore:credcore /app /var/log/credcore

# Collect static files
RUN SECRET_KEY=build-placeholder \
    DJANGO_SETTINGS_MODULE=config.settings.production \
    DB_PASSWORD=build-placeholder \
    ALLOWED_HOSTS=localhost \
    python manage.py collectstatic --noinput 2>/dev/null || true

USER credcore

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health/ || exit 1

# Gunicorn with optimal settings for a financial app
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--worker-class", "gthread", \
     "--threads", "2", \
     "--timeout", "120", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "50", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
