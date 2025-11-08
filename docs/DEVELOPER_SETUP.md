# Developer Setup Guide

This guide will help you set up a local development environment for Forecastin.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Docker)](#quick-start-docker)
- [Local Development Setup](#local-development-setup)
- [Database Setup](#database-setup)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [Running Tests](#running-tests)
- [Common Issues](#common-issues)
- [Development Workflow](#development-workflow)

## Prerequisites

### Required Software

- **Docker Desktop** (recommended) or Docker + Docker Compose
  - Docker Engine 20.10+
  - Docker Compose 2.0+
- **Git** 2.30+

### Optional (for local development without Docker)

- **Python** 3.9 or higher
- **Node.js** 18.x or higher
- **PostgreSQL** 13+ with PostGIS and LTREE extensions
- **Redis** 6+

### Development Tools (Recommended)

- **IDE**: VS Code, PyCharm, or WebStorm
- **API Testing**: Postman, Insomnia, or Thunder Client
- **Database Client**: pgAdmin, DBeaver, or psql
- **Git Client**: GitHub Desktop, GitKraken, or command line

## Quick Start (Docker)

The fastest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/glockpete/Forecastin.git
cd Forecastin

# Start all services
docker-compose up

# Access the services:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:9000/docs
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3001 (admin/admin)
```

**That's it!** The application is now running with hot-reload enabled for development.

### Docker Development Commands

```bash
# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f api

# Rebuild containers after dependency changes
docker-compose build
docker-compose up

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Run commands in containers
docker-compose exec api pytest tests/
docker-compose exec frontend npm test
```

## Local Development Setup

For more control and faster iteration, you can run services locally.

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/glockpete/Forecastin.git
cd Forecastin

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install backend dependencies
cd api
pip install -r requirements.txt
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Environment Configuration

Create `.env` file in the root directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://forecastin:forecastin_password@localhost:5432/forecastin
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=forecastin
DATABASE_PASSWORD=forecastin_password
DATABASE_NAME=forecastin

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379

# API Configuration
API_PORT=9000
ENVIRONMENT=development

# WebSocket Configuration
WS_PING_INTERVAL=30
WS_PING_TIMEOUT=10
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
PUBLIC_BASE_URL=http://localhost:9000
WS_PUBLIC_URL=ws://localhost:9000/ws

# Frontend Configuration
REACT_APP_API_URL=http://localhost:9000
REACT_APP_WS_URL=ws://localhost:9000
```

See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for complete documentation.

### 3. Start Infrastructure Services

You can run PostgreSQL and Redis via Docker while running the application locally:

```bash
# Start only database and cache
docker-compose up postgres redis -d
```

Or install and run them natively (see platform-specific instructions below).

## Database Setup

### Using Docker (Recommended)

```bash
docker-compose up postgres -d
```

### Manual Installation

#### macOS (Homebrew)

```bash
brew install postgresql@13 postgis
brew services start postgresql@13

# Create database and user
psql postgres -c "CREATE USER forecastin WITH PASSWORD 'forecastin_password';"
psql postgres -c "CREATE DATABASE forecastin OWNER forecastin;"
psql forecastin -c "CREATE EXTENSION ltree;"
psql forecastin -c "CREATE EXTENSION postgis;"
```

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql-13 postgresql-13-postgis-3
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql -c "CREATE USER forecastin WITH PASSWORD 'forecastin_password';"
sudo -u postgres psql -c "CREATE DATABASE forecastin OWNER forecastin;"
sudo -u postgres psql forecastin -c "CREATE EXTENSION ltree;"
sudo -u postgres psql forecastin -c "CREATE EXTENSION postgis;"
```

### Running Migrations

```bash
cd api

# Apply migrations
psql $DATABASE_URL -f ../migrations/001_initial_schema.sql
psql $DATABASE_URL -f ../migrations/002_ml_ab_testing_framework.sql
psql $DATABASE_URL -f ../migrations/004_rss_entity_extraction_schema.sql
psql $DATABASE_URL -f ../migrations/004_automated_materialized_view_refresh.sql
```

### Verifying Database Setup

```bash
# Connect to database
psql postgresql://forecastin:forecastin_password@localhost:5432/forecastin

# Check extensions
\dx

# Check tables
\dt

# Expected output should include:
# - entities
# - entity_relationships
# - feature_flags
# - rss_feeds
# - scenarios
# And LTREE, PostGIS extensions
```

## Frontend Development

### Start Development Server

```bash
cd frontend
npm start
```

The frontend will be available at http://localhost:3000 with hot-reload enabled.

### Frontend Structure

```
frontend/
├── src/
│   ├── components/       # React components
│   │   ├── MillerColumns/
│   │   └── Map/
│   ├── hooks/           # Custom React hooks
│   ├── layers/          # Geospatial layer implementations
│   ├── services/        # API clients
│   ├── store/           # Zustand state management
│   ├── ws/              # WebSocket management
│   └── App.tsx          # Main application component
├── public/              # Static assets
└── package.json
```

### Frontend Development Commands

```bash
# Start development server
npm start

# Run tests
npm test

# Run tests
npm run test

# Type checking
npx tsc --noEmit

# Build for production
npm run build

# Check feature flag functionality
npm run ff:check
```

### TypeScript Strict Mode

The frontend uses **strict TypeScript configuration** to ensure type safety. All layer infrastructure files comply with:

- `strict: true` - All strict type-checking options enabled
- `noImplicitOverride: true` - Requires explicit `override` keyword
- `exactOptionalPropertyTypes: true` - Prevents `undefined` assignment to optional properties
- `noUncheckedIndexedAccess: true` - Array/object access returns `T | undefined`
- `noImplicitReturns: true` - All code paths must return a value

**Common Patterns:**

```typescript
// Override modifiers for inherited methods
protected override methodName(): void { }

// Conditional property spreading for optional properties
{
  ...config,
  ...(optionalValue !== undefined && { optionalKey: optionalValue })
}

// Null checks for array access
const element = array[index];
if (!element) return;
// safe to use element
```

For more details, see [TypeScript Error Fixes Documentation](./TYPESCRIPT_ERROR_FIXES_2025-11-07.md).

```bash
# Additional frontend commands

# Verify contract drift
npm run contracts:check
```

### TypeScript Configuration

The project uses strict TypeScript mode. All code must compile without errors:

```bash
# Type check only (no build)
npx tsc --noEmit

# Watch mode for type checking
npx tsc --noEmit --watch
```

## Backend Development

### Start Development Server

```bash
cd api
python main.py
```

Or with uvicorn for auto-reload:

```bash
cd api
uvicorn main:app --reload --host 0.0.0.0 --port 9000
```

The API will be available at:
- **API Docs**: http://localhost:9000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:9000/redoc (ReDoc)
- **Health Check**: http://localhost:9000/health

### Backend Structure

```
api/
├── main.py                    # FastAPI application entry point
├── navigation_api/
│   └── database/
│       └── optimized_hierarchy_resolver.py
├── services/
│   ├── cache_service.py       # Multi-tier caching
│   ├── database_manager.py    # Database connections
│   ├── feature_flag_service.py
│   ├── realtime_service.py    # WebSocket management
│   └── rss/                   # RSS ingestion services
├── tests/                     # Test files
└── requirements.txt
```

### Backend Development Commands

```bash
# Run development server with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 9000

# Run tests
pytest tests/ -v

# Run tests with coverage
pytest tests/ --cov=. --cov-report=html

# Run specific test file
pytest tests/test_performance.py -v

# Run performance tests
pytest tests/test_performance.py --benchmark

# Check code style
flake8 .

# Format code
black .

# Type checking
mypy .
```

### Database Queries

The application uses the OptimizedHierarchyResolver for database operations:

```python
from navigation_api.database.optimized_hierarchy_resolver import OptimizedHierarchyResolver

# Initialize
resolver = OptimizedHierarchyResolver(db_manager)

# Query hierarchy
ancestors = await resolver.get_ancestors("world.asia.japan")
descendants = await resolver.get_descendants("world.asia")

# Refresh materialized views
await resolver.refresh_all_materialized_views()
```

## Running Tests

### Full Test Suite

```bash
# Backend tests
cd api
pytest tests/ -v

# Frontend tests
cd frontend
npm test

# Both (from root)
docker-compose exec api pytest tests/
docker-compose exec frontend npm test
```

### Specific Test Categories

```bash
# Backend unit tests
pytest tests/ -v -m "not integration"

# Backend integration tests
pytest tests/ -v -m integration

# Backend performance tests
pytest tests/test_performance.py

# WebSocket tests
pytest tests/test_ws_echo.py tests/test_ws_health.py

# Frontend component tests
npm test -- --testPathPattern=components

# Frontend integration tests
npm test -- --testPathPattern=integration
```

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for detailed testing documentation.

## Common Issues

### Issue: Port Already in Use

**Symptom**: `Error: bind: address already in use`

**Solution**:
```bash
# Find process using port
lsof -i :9000  # or :3000 for frontend

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.yml or .env
```

### Issue: Database Connection Failed

**Symptom**: `psycopg2.OperationalError: could not connect to server`

**Solutions**:
1. Ensure PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   # or
   brew services list | grep postgresql
   ```

2. Check connection string in `.env`:
   ```
   DATABASE_URL=postgresql://forecastin:forecastin_password@localhost:5432/forecastin
   ```

3. Test connection manually:
   ```bash
   psql postgresql://forecastin:forecastin_password@localhost:5432/forecastin
   ```

### Issue: Redis Connection Failed

**Symptom**: `redis.exceptions.ConnectionError`

**Solution**:
```bash
# Start Redis
docker-compose up redis -d
# or
brew services start redis

# Test connection
redis-cli ping
# Should return: PONG
```

### Issue: LTREE Extension Not Found

**Symptom**: `ERROR: type "ltree" does not exist`

**Solution**:
```bash
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS ltree;"
```

### Issue: WebSocket Connection Failed (1006)

**Symptom**: WebSocket closes immediately with code 1006

**Solutions**:
1. Check CORS configuration in `api/main.py`
2. Ensure `ALLOWED_ORIGINS` includes your frontend URL
3. Use `ws://` for HTTP or `wss://` for HTTPS
4. See [README.md](../README.md#websocket-hardening) for detailed troubleshooting

### Issue: TypeScript Compilation Errors

**Symptom**: `error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'`

**Solution**:
```bash
# Clear TypeScript cache
rm -rf frontend/node_modules/.cache

# Reinstall dependencies
cd frontend
npm ci

# Check for type definition updates
npm outdated @types/*
```

### Issue: npm Install Fails

**Symptom**: `npm ERR! code ERESOLVE`

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

## Development Workflow

### Daily Development

1. **Start your day**:
   ```bash
   git pull origin main
   docker-compose up -d
   ```

2. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes with hot-reload**:
   - Backend changes: Auto-reload via uvicorn
   - Frontend changes: Auto-reload via react-scripts
   - Database changes: Run migration scripts

4. **Test your changes**:
   ```bash
   pytest tests/
   npm test
   ```

5. **Commit and push**:
   ```bash
   git add .
   git commit -m "feat(scope): description"
   git push origin feature/your-feature-name
   ```

### Testing Changes

Always test your changes before committing:

```bash
# Run full test suite
cd api && pytest tests/ -v
cd frontend && npm test

# Manual testing checklist:
# 1. API health: http://localhost:9000/health
# 2. API docs: http://localhost:9000/docs
# 3. Frontend loads: http://localhost:3000
# 4. WebSocket connects: Check browser console
# 5. Database queries work: Check logs
```

### Debugging

#### Backend Debugging

Add breakpoints using Python debugger:

```python
import pdb; pdb.set_trace()
```

Or use VS Code debugger with this `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["main:app", "--reload", "--port", "9000"],
      "cwd": "${workspaceFolder}/api",
      "env": {
        "DATABASE_URL": "postgresql://forecastin:forecastin_password@localhost:5432/forecastin"
      }
    }
  ]
}
```

#### Frontend Debugging

Use Chrome DevTools:
- **Components**: React Developer Tools extension
- **Network**: Check WebSocket frames in Network tab
- **State**: Redux/Zustand DevTools

#### Database Debugging

```bash
# Connect to database
psql postgresql://forecastin:forecastin_password@localhost:5432/forecastin

# Enable query logging
SET log_statement = 'all';

# Explain query performance
EXPLAIN ANALYZE SELECT * FROM entities WHERE path <@ 'world.asia';
```

## IDE Setup

### VS Code

Recommended extensions:

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-azuretools.vscode-docker",
    "ckolkman.vscode-postgres",
    "bradlc.vscode-tailwindcss"
  ]
}
```

### PyCharm

1. Mark `api` as Sources Root
2. Configure Python interpreter to use virtual environment
3. Enable FastAPI support
4. Configure PostgreSQL data source

## Performance Monitoring

Monitor performance during development:

```bash
# Check API performance
curl http://localhost:9000/health

# Check cache metrics
curl http://localhost:9000/api/feature-flags/metrics/cache

# Check materialized view status
curl http://localhost:9000/api/entities/refresh/status

# Monitor WebSocket health
wscat -c ws://localhost:9000/ws/health
```

## Next Steps

- Read [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
- Review [TESTING_GUIDE.md](TESTING_GUIDE.md) for testing best practices
- Check [AGENTS.md](../AGENTS.md) for non-obvious patterns
- Explore [GOLDEN_SOURCE.md](GOLDEN_SOURCE.md) for project architecture

## Getting Help

- Check existing [GitHub Issues](https://github.com/glockpete/Forecastin/issues)
- Review [TROUBLESHOOTING.md](../README.md#common-issues-and-solutions)
- Ask in GitHub Discussions

---

**Happy coding!** 🚀
