# 🤖 Enterprise Agentic RAG

A production-grade Multi-Agent RAG system with FastAPI backend, Next.js frontend, LangGraph orchestration, and Qdrant vector database.

[![CI](https://github.com/harshchavan009/AI-Chatbot/actions/workflows/ci.yml/badge.svg)](https://github.com/harshchavan009/AI-Chatbot/actions/workflows/ci.yml)
[![CD](https://github.com/harshchavan009/AI-Chatbot/actions/workflows/cd.yml/badge.svg)](https://github.com/harshchavan009/AI-Chatbot/actions/workflows/cd.yml)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)                 │
│              Port 80/443 (HTTP → HTTPS)                  │
└──────────────────┬──────────────────┬───────────────────┘
                   │                  │
       ┌───────────▼────┐    ┌────────▼────────┐
       │  Next.js 15    │    │  FastAPI + UV    │
       │  (Frontend)    │    │  (Backend API)   │
       │  Port 3000     │    │  Port 8000       │
       └────────────────┘    └────────┬────────┘
                                      │
              ┌───────────────────────┼──────────────┐
              │                       │              │
   ┌──────────▼──────┐   ┌───────────▼──────┐  ┌────▼────┐
   │  PostgreSQL 16  │   │   Qdrant 1.9     │  │  Redis  │
   │  (Primary DB)   │   │  (Vector Store)  │  │  (Cache)│
   └─────────────────┘   └──────────────────┘  └─────────┘
```

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, TypeScript, TailwindCSS |
| **Backend** | FastAPI, Python 3.11, LangGraph |
| **Database** | PostgreSQL 16, SQLAlchemy 2 |
| **Vector DB** | Qdrant 1.9 |
| **Cache/Queue** | Redis 7, Celery |
| **AI** | OpenAI GPT-4o, text-embedding-3-small |
| **Auth** | JWT + Refresh Tokens, RBAC |
| **Container** | Docker, Docker Compose |
| **CI/CD** | GitHub Actions |
| **Cloud** | Railway, Render, AWS ECS Fargate |

---

## 🛠 Quick Start (Local Development)

### Prerequisites

- Docker Desktop
- Python 3.11+
- Node.js 20+
- OpenAI API key

### 1. Clone & Setup

```bash
git clone https://github.com/harshchavan009/AI-Chatbot.git
cd AI-Chatbot

# Create and configure .env
make setup
# Edit .env and fill in your OPENAI_API_KEY and other values
```

### 2. Start with Docker Compose

```bash
make dev
```

This starts:
- 🐘 PostgreSQL at `localhost:5432`
- 🔴 Redis at `localhost:6379`
- 🟣 Qdrant at `localhost:6333`
- ⚡ FastAPI backend at `localhost:8000`
- 🌐 Next.js frontend at `localhost:3000`
- 🌸 Celery Flower at `localhost:5555`
- 🔀 Nginx at `localhost:80`

### 3. Access the app

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |
| Flower (Celery) | http://localhost:5555 |
| Qdrant Dashboard | http://localhost:6333/dashboard |

### 4. Run without Docker (local dev)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing

```bash
# Run all tests
make test

# Run backend tests with coverage
make test-backend

# Run inside Docker (full integration)
make test-ci
```

---

## 📦 Deployment

### Option 1: Railway (Easiest)

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init`
4. Set secrets in the Railway dashboard
5. Deploy: `railway up`

Required Railway environment variables:
```
DATABASE_URL         → Railway PostgreSQL addon
REDIS_URL            → Railway Redis addon
QDRANT_URL           → Your Qdrant Cloud instance
JWT_SECRET_KEY       → 32-byte random hex string
OPENAI_API_KEY       → Your OpenAI API key
```

### Option 2: Render

1. Connect your GitHub repository at [render.com](https://render.com)
2. Select **New → Blueprint** and point to `render.yaml`
3. Set secrets in the Render dashboard
4. Deploy

### Option 3: AWS ECS Fargate

```bash
# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file infra/aws/cloudformation.yml \
  --stack-name enterprise-rag-production \
  --parameter-overrides \
    Environment=production \
    BackendImage=<ECR_URI>/enterprise-rag-backend:latest \
    FrontendImage=<ECR_URI>/enterprise-rag-frontend:latest \
    DBPassword=<STRONG_PASSWORD> \
    OpenAIAPIKey=<YOUR_KEY> \
    JWTSecretKey=<32_BYTE_HEX> \
    DomainName=your-domain.com \
    CertificateArn=arn:aws:acm:... \
  --capabilities CAPABILITY_NAMED_IAM
```

---

## 🔑 Required GitHub Secrets (for CD pipeline)

Configure in `Settings → Secrets and variables → Actions`:

| Secret | Description |
|--------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `RAILWAY_TOKEN` | Railway CLI token |
| `RAILWAY_PROJECT_ID` | Railway project ID |
| `RENDER_API_KEY` | Render API key |
| `RENDER_BACKEND_SERVICE_ID` | Render backend service ID |
| `RENDER_FRONTEND_SERVICE_ID` | Render frontend service ID |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret |
| `DOCKERHUB_USERNAME` | DockerHub username (optional) |
| `DOCKERHUB_TOKEN` | DockerHub token (optional) |
| `SLACK_WEBHOOK_URL` | Slack deploy notifications (optional) |
| `CODECOV_TOKEN` | Codecov token (optional) |

---

## 📁 Project Structure

```
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── agents/            # LangGraph multi-agent system
│   │   ├── api/               # Route handlers
│   │   ├── core/              # Auth, config, security
│   │   ├── models/            # SQLAlchemy models
│   │   ├── rag/               # RAG pipeline
│   │   ├── services/          # Business logic
│   │   └── tasks/             # Celery background tasks
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                  # Next.js application
│   ├── src/app/               # Pages (App Router)
│   ├── Dockerfile
│   └── next.config.js
│
├── infra/                     # Infrastructure configs
│   ├── aws/                   # CloudFormation + ECS task defs
│   ├── nginx/                 # Nginx configs (dev + prod)
│   ├── postgres/              # DB init scripts
│   └── qdrant/                # Vector DB config
│
├── .github/workflows/         # GitHub Actions
│   ├── ci.yml                 # Test & lint on PR
│   ├── cd.yml                 # Build & deploy on main
│   └── nightly.yml            # Security audits + DB backup
│
├── docker-compose.yml         # Development stack
├── docker-compose.prod.yml    # Production stack
├── railway.toml               # Railway deployment config
├── render.yaml                # Render deployment config
├── Makefile                   # Developer shortcuts
└── .env.example               # Environment variable template
```

---

## 🔒 Security

- JWT + Refresh token auth with RBAC
- All secrets via environment variables / AWS Secrets Manager
- TLS enforced in production Nginx
- Rate limiting on auth endpoints
- Non-root Docker users
- Trivy + Gitleaks scanning in CI
- SQL injection protection via SQLAlchemy ORM
- CORS allowlist configuration

---

## 📊 Monitoring

- Celery task monitoring: Flower (`/flower`)
- API health: `/health`
- Structured JSON logging in production
- AWS CloudWatch integration (ECS deployment)
- Optional Sentry error tracking (`SENTRY_DSN` env var)

---

## 📄 License

MIT
