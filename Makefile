.PHONY: help setup dev migrate shell createsuperuser test lint format clean build

help:
	@echo "CredCore - Comandos disponibles:"
	@echo "  make setup          Configura el proyecto por primera vez"
	@echo "  make dev            Inicia el servidor de desarrollo"
	@echo "  make migrate        Ejecuta migraciones pendientes"
	@echo "  make shell          Abre Django shell"
	@echo "  make createsuperuser  Crea superusuario"
	@echo "  make test           Ejecuta pruebas"
	@echo "  make lint           Verifica código"
	@echo "  make format         Formatea código con black/isort"
	@echo "  make clean          Limpia archivos temporales"
	@echo "  make docker-up      Inicia servicios Docker"
	@echo "  make docker-down    Detiene servicios Docker"

setup:
	cp .env.example .env
	cd backend && python -m venv venv
	cd backend && venv/bin/pip install -r requirements/development.txt
	cd backend && venv/bin/python manage.py migrate
	cd backend && venv/bin/python manage.py createsuperuser --noinput || true
	cd frontend && npm install
	@echo "✅ Proyecto configurado. Ejecuta 'make dev'"

dev:
	@echo "Iniciando backend y frontend..."
	cd backend && python manage.py runserver &
	cd frontend && npm run dev

migrate:
	cd backend && python manage.py makemigrations
	cd backend && python manage.py migrate

shell:
	cd backend && python manage.py shell

createsuperuser:
	cd backend && python manage.py createsuperuser

test:
	cd backend && python -m pytest apps/ -v --cov=apps --cov-report=term-missing

lint:
	cd backend && flake8 apps/ config/
	cd backend && mypy apps/

format:
	cd backend && black apps/ config/
	cd backend && isort apps/ config/

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name ".DS_Store" -delete 2>/dev/null || true

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f backend

docker-migrate:
	docker-compose exec backend python manage.py migrate

docker-shell:
	docker-compose exec backend python manage.py shell
