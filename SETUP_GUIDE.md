# Forecastin Setup Guide

This guide provides step-by-step instructions for setting up the Forecastin project after the blocker fixes in PR #96.

## 📋 Prerequisites

- **Docker Desktop** (for PostgreSQL and Redis)
- **Node.js** v18+ and npm (for frontend)
- **Python** 3.10+ and pip (for backend API)
- **Git** (for cloning the repository)

---

## 🚀 Quick Start (Recommended)

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/glockpete/Forecastin.git
cd Forecastin

# Copy environment template
cp .env.example .env

# Edit .env and set your database password
nano .env  # or use your preferred editor
```

**Minimum required in `.env`:**
```bash
DATABASE_PASSWORD=your_secure_password_here
```

### 2. Verify Configuration

```bash
# Test that environment variables are set correctly
cd api
python config_validation.py
```

Expected output:
```
✅ Configuration validation passed
Configuration Summary
==================================================
  API_PORT                  = 9000
  DATABASE_HOST             = localhost
  DATABASE_PASSWORD         = ***word
  ...
==================================================
```

### 3. Install Dependencies

#### Backend (Python)
```bash
cd api
pip install -r requirements.txt
```

#### Frontend (React/TypeScript)
```bash
cd ../frontend
npm install
```

### 4. Start Services

#### Option A: Using Docker Compose (Recommended)
```bash
# From project root
docker-compose up -d

# Check that services are running
docker-compose ps
```

Expected output:
```
NAME                   STATUS              PORTS
forecastin_postgres    Up (healthy)        5432->5432
forecastin_redis       Up (healthy)        6379->6379
forecastin_api         Up (healthy)        9000->9000
forecastin_frontend    Up                  3000->80
```

#### Option B: Manual Development Mode

**Terminal 1 - Database & Cache:**
```bash
docker-compose up -d postgres redis
```

**Terminal 2 - Backend API:**
```bash
cd api
uvicorn main:app --reload --host 0.0.0.0 --port 9000
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm start
```

### 5. Verify Installation

#### Check Backend Health
```bash
curl http://localhost:9000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected"
}
```

#### Check Frontend
Open browser to: http://localhost:3000

#### Run Type Checking (Frontend)
```bash
cd frontend
npm run typecheck
```

Expected: **0 TypeScript errors**

---

## 🔧 Detailed Setup Instructions

### Environment Variables

The project now uses environment variables for all configuration. Here's the complete reference:

#### Required Variables
- `DATABASE_PASSWORD` - PostgreSQL password (empty for dev, required for production)

#### Optional Variables (with defaults)
- `DATABASE_HOST` - Default: `localhost`
- `DATABASE_PORT` - Default: `5432`
- `DATABASE_NAME` - Default: `forecastin`
- `DATABASE_USER` - Default: `forecastin`
- `REDIS_HOST` - Default: `localhost`
- `REDIS_PORT` - Default: `6379`
- `API_PORT` - Default: `9000`
- `ENVIRONMENT` - Default: `development` (options: development, staging, production)

#### Advanced Configuration
- `DATABASE_URL` - Full PostgreSQL connection string (overrides individual components)
- `REDIS_URL` - Full Redis connection string (overrides individual components)

**Example `.env` file:**
```bash
# Development configuration
DATABASE_PASSWORD=dev_password_123
ENVIRONMENT=development

# Production configuration (example)
# DATABASE_PASSWORD=super_secure_production_password_with_special_chars!@#
# ENVIRONMENT=production
# DATABASE_HOST=db.production.example.com
# REDIS_HOST=cache.production.example.com
```

### Python Backend Setup

#### Install Core Dependencies
```bash
cd api
pip install -r requirements.txt
```

#### Install Optional ML/Forecasting Dependencies
If you need Prophet-based hierarchical forecasting:

```bash
# These require build tools (gcc, g++, cmake)
pip install prophet pandas numpy pyarrow
```

Note: Prophet installation can take 5-10 minutes and requires ~1GB of build dependencies.

#### Verify Backend Installation
```bash
# Test configuration
python config_validation.py

# Run a simple test
python -c "from services.cache_service import CacheService; print('✅ Import successful')"
```

### Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install
```

This installs:
- React 18
- TypeScript
- Vite (test runner)
- TanStack Query
- Zustand (state management)
- Tailwind CSS
- deck.gl (geospatial visualization)

#### Verify Frontend Installation
```bash
# Type checking
npm run typecheck

# Run tests (requires vitest)
npm test

# Check for contract drift
npm run contracts:check
```

### Database Setup

#### Initialize PostgreSQL with Docker
```bash
docker-compose up -d postgres

# Wait for health check
docker-compose ps postgres
```

#### Run Migrations (if available)
```bash
# Migrations are automatically applied via docker-compose
# Located in: ./migrations/*.sql

# To manually run migrations:
docker exec -i forecastin_postgres psql -U forecastin -d forecastin < migrations/001_initial_schema.sql
```

#### Verify Database Connection
```bash
# Connect to database
docker exec -it forecastin_postgres psql -U forecastin -d forecastin

# Run test query
SELECT version();
\q
```

---

## 🧪 Running Tests

### Backend Tests
```bash
cd api

# Run all tests
pytest

# Run with coverage
pytest --cov=.

# Run specific test file
pytest tests/test_ws_health.py

# Run performance benchmarks
pytest tests/test_db_performance.py --benchmark-only
```

### Frontend Tests
```bash
cd frontend

# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Integration Tests
```bash
# WebSocket performance test
python scripts/testing/test_websocket_connection.py

# End-to-end performance test
python tests/integration/test_e2e_performance.py
```

---

## 🐛 Troubleshooting

### Issue: "Configuration validation failed"

**Problem**: Missing or invalid environment variables

**Solution**:
```bash
# Check what's missing
cd api
python config_validation.py

# Common fixes:
# 1. Set DATABASE_PASSWORD in .env
# 2. Verify DATABASE_HOST is correct
# 3. For production, ensure all required vars are set
```

### Issue: "ModuleNotFoundError: No module named 'navigation_api'"

**Problem**: Missing Python package initialization files

**Solution**: This was fixed in PR #96. Make sure you're on the latest commit:
```bash
git pull origin claude/audit-project-blockers-011CUvW7sLMxvu7TuxVKkQGA

# Verify files exist
ls api/navigation_api/__init__.py
ls api/navigation_api/database/__init__.py
```

### Issue: "Cannot find module 'react'" (TypeScript errors)

**Problem**: Frontend dependencies not installed

**Solution**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run typecheck  # Should show 0 errors
```

### Issue: "Database connection failed"

**Problem**: PostgreSQL not running or wrong credentials

**Solution**:
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres

# Verify environment variables
cat .env | grep DATABASE
```

### Issue: "Redis connection failed"

**Problem**: Redis not running

**Solution**:
```bash
# Start Redis
docker-compose up -d redis

# Check Redis health
docker exec forecastin_redis redis-cli ping
# Expected: PONG
```

### Issue: "Prophet import errors"

**Problem**: Optional ML dependencies not installed

**Solution**:
Prophet is optional. If you don't need forecasting:
- The API will start normally
- Forecasting endpoints will return a clear error message

To install Prophet:
```bash
# Install build dependencies (Ubuntu/Debian)
sudo apt-get install build-essential python3-dev

# Install Prophet
pip install prophet pandas numpy pyarrow
```

---

## 📚 Additional Resources

### Configuration Files
- `.env.example` - Environment variable template
- `api/config_validation.py` - Configuration validation script
- `docker-compose.yml` - Docker services configuration
- `api/requirements.txt` - Python dependencies
- `frontend/package.json` - Node.js dependencies

### Documentation
- `docs/STARTUP_PROCEDURES_AND_ERROR_PATTERNS.md` - Startup troubleshooting
- `docs/ENVIRONMENT_VARIABLES.md` - Environment variable reference
- `docs/DEVELOPER_SETUP.md` - Developer setup guide

### Scripts
- `scripts/deployment/startup_validation.py` - Service connectivity validation
- `scripts/monitoring/infrastructure_health_monitor.py` - Infrastructure monitoring

---

## 🎯 What Changed in PR #96?

### Critical Fixes
1. ✅ Created missing `__init__.py` files for navigation_api package
2. ✅ Removed all hardcoded credentials (14 files updated)
3. ✅ Added Prophet/pandas/numpy dependency guards
4. ✅ Added comprehensive environment variable validation

### Security Improvements
- No more hardcoded passwords in source code
- Production environment enforces DATABASE_PASSWORD requirement
- All credentials sourced from environment variables
- Startup validation with masked secrets in logs

### Developer Experience
- Clear error messages when dependencies are missing
- Configuration validation fails fast on startup
- Comprehensive `.env.example` template
- Automated environment validation script

---

## 🎉 Success Checklist

After setup, verify everything works:

- [ ] Configuration validation passes: `python api/config_validation.py`
- [ ] Backend type checking passes: No Python import errors
- [ ] Frontend type checking passes: `npm run typecheck` shows 0 errors
- [ ] Docker services are healthy: `docker-compose ps` shows all green
- [ ] Backend health endpoint responds: `curl http://localhost:9000/health`
- [ ] Frontend loads in browser: http://localhost:3000
- [ ] Database connection works: Check backend logs for "Database connection established"
- [ ] Redis connection works: Check backend logs for "Redis cache connection established"

---

## 📞 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review the startup logs: `docker-compose logs api`
3. Verify environment variables: `python api/config_validation.py`
4. Check GitHub issues: https://github.com/glockpete/Forecastin/issues

For PR #96 specific questions, refer to the PR discussion.
