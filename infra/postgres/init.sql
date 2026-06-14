-- Enterprise Agentic RAG — PostgreSQL initialization
-- This runs only on first container startup

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Set timezone
SET timezone = 'UTC';

-- Create additional databases if needed
-- (main DB is created by POSTGRES_DB env var)

\echo 'Database initialized successfully'
