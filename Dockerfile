# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# Enable static build
RUN npm run build && mv out dist

# Stage 2: Build the FastAPI backend
FROM python:3.11-slim AS backend-runner
WORKDIR /app

# Install system dependencies (ffmpeg for whisper audio track extraction, curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy frontend static build assets so FastAPI can serve them from dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend application files
COPY backend/ ./

# Expose backend port
EXPOSE 8000

ENV ENV=production
ENV PYTHONPATH=/app

# Start FastAPI via Uvicorn on dynamic Railway PORT fallback to 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
