# ============================================================
# Enterprise Agentic RAG — Makefile
# Usage: make <target>
# ============================================================

.PHONY: help setup dev prod down clean logs test build push

# ── Variables ─────────────────────────────────────────────────
COMPOSE_DEV  = docker compose -f docker-compose.yml
COMPOSE_PROD = docker compose -f docker-compose.prod.yml
BACKEND_DIR  = backend
FRONTEND_DIR = frontend

# ── Default ───────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Enterprise Agentic RAG — Available Commands"
	@echo "  ─────────────────────────────────────────────"
	@echo "  setup        Copy .env.example → .env and create upload dir"
	@echo "  dev          Start all services in development mode"
	@echo "  prod         Start all services in production mode"
	@echo "  down         Stop and remove all containers"
	@echo "  restart      Restart all services"
	@echo "  logs         Tail logs from all containers"
	@echo "  logs-backend Tail backend logs only"
	@echo "  test         Run all tests (backend + frontend)"
	@echo "  test-backend Run backend tests only"
	@echo "  build        Build Docker images"
	@echo "  push         Push images to registry"
	@echo "  migrate      Run database migrations"
	@echo "  shell        Open shell in backend container"
	@echo "  psql         Connect to PostgreSQL"
	@echo "  clean        Remove all containers, volumes, and images"
	@echo ""

# ── Setup ─────────────────────────────────────────────────────
setup:
	@[ -f .env ] && echo ".env already exists, skipping" || (cp .env.example .env && echo "✅ .env created from .env.example")
	@mkdir -p uploads infra/nginx/certs
	@echo "✅ Setup complete. Edit .env before running 'make dev'"

# ── Development ───────────────────────────────────────────────
dev:
	$(COMPOSE_DEV) up --build -d
	@echo "✅ Dev environment running"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Backend:  http://localhost:8000"
	@echo "   API Docs: http://localhost:8000/docs"
	@echo "   Flower:   http://localhost:5555"

dev-infra:
	$(COMPOSE_DEV) up -d postgres redis qdrant
	@echo "✅ Infrastructure services started (no app containers)"

# ── Production ────────────────────────────────────────────────
prod:
	$(COMPOSE_PROD) up -d
	@echo "✅ Production stack running"

# ── Shutdown ──────────────────────────────────────────────────
down:
	$(COMPOSE_DEV) down

down-prod:
	$(COMPOSE_PROD) down

restart:
	$(COMPOSE_DEV) restart

# ── Logs ──────────────────────────────────────────────────────
logs:
	$(COMPOSE_DEV) logs -f

logs-backend:
	$(COMPOSE_DEV) logs -f backend

logs-frontend:
	$(COMPOSE_DEV) logs -f frontend

logs-worker:
	$(COMPOSE_DEV) logs -f celery_worker

# ── Testing ───────────────────────────────────────────────────
test: test-backend test-frontend

test-backend:
	@echo "Running backend tests..."
	cd $(BACKEND_DIR) && PYTHONPATH=. pytest tests/ -v --tb=short

test-frontend:
	@echo "Running frontend type checks..."
	cd $(FRONTEND_DIR) && npx tsc --noEmit

test-ci:
	$(COMPOSE_DEV) run --rm backend \
		bash -c "PYTHONPATH=. pytest tests/ -v --cov=app --cov-report=term-missing"

# ── Build ─────────────────────────────────────────────────────
build:
	docker build -t enterprise-rag-backend:latest ./backend
	docker build -t enterprise-rag-frontend:latest ./frontend

build-backend:
	docker build -t enterprise-rag-backend:latest ./backend

build-frontend:
	docker build -t enterprise-rag-frontend:latest ./frontend

build-no-cache:
	docker build --no-cache -t enterprise-rag-backend:latest ./backend
	docker build --no-cache -t enterprise-rag-frontend:latest ./frontend

# ── Push ──────────────────────────────────────────────────────
push:
	@echo "Push via GitHub Actions CD pipeline (make build first)"

# ── Database ──────────────────────────────────────────────────
migrate:
	$(COMPOSE_DEV) exec backend python -c "from app.models.schemas import Base, engine; Base.metadata.create_all(engine); print('✅ Migrations applied')"

psql:
	$(COMPOSE_DEV) exec postgres psql -U postgres -d enterprise_rag

redis-cli:
	$(COMPOSE_DEV) exec redis redis-cli

# ── Shell access ──────────────────────────────────────────────
shell:
	$(COMPOSE_DEV) exec backend bash

shell-frontend:
	$(COMPOSE_DEV) exec frontend sh

# ── Cleanup ───────────────────────────────────────────────────
clean:
	$(COMPOSE_DEV) down -v --remove-orphans
	docker system prune -f
	@echo "✅ Cleaned up all containers and volumes"

clean-all: clean
	docker rmi enterprise-rag-backend:latest enterprise-rag-frontend:latest 2>/dev/null || true
	@echo "✅ Cleaned up images too"

# ── Secrets generation ────────────────────────────────────────
gen-secrets:
	@echo "JWT_SECRET_KEY=$$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
	@echo "POSTGRES_PASSWORD=$$(python3 -c 'import secrets; print(secrets.token_urlsafe(20))')"
	@echo "REDIS_PASSWORD=$$(python3 -c 'import secrets; print(secrets.token_urlsafe(20))')"
