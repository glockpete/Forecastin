# Startup Quick Reference Guide

## Quick Start Checklist

### ✅ Pre-flight Check (2 minutes)
- [ ] Docker Desktop running
- [ ] Git repository cloned
- [ ] Sufficient disk space (10GB+)
- [ ] Ports 3000, 9000, 5432, 6379 available

### 🚀 Standard Startup (60 seconds)
```bash
# 1. Clone and start
git clone https://github.com/glockpete/Forecastin.git
cd Forecastin
docker-compose up

# 2. Verify services (30 seconds later)
# Frontend: http://localhost:3000 (should load without errors)
# API Docs: http://localhost:9000/docs (should load)
# Check console: docker-compose logs -f api | head -20
```

### 🔧 Development Mode Startup
```bash
# Start infrastructure only
docker-compose up postgres redis -d

# Backend (terminal 1)
cd api && uvicorn main:app --reload --port 9000

# Frontend (terminal 2)  
cd frontend && npm start
```

## Common Error Patterns & Immediate Fixes

### 🔴 WebSocket Connection Issues
**Symptoms:** Browser console errors, 1006 close codes

**Quick Fix:**
```bash
# Check configuration
docker-compose exec api env | grep WS_

# Test connection
npm install -g wscat
wscat -c ws://localhost:9000/ws/health

# Fix: Ensure .env has correct URLs
REACT_APP_WS_URL=ws://localhost:9000
WS_PUBLIC_URL=ws://localhost:9000/ws
```

### 🔴 Database Connection Failures
**Symptoms:** `psycopg2.OperationalError`, feature flags not loading

**Quick Fix:**
```bash
# Check database status
docker-compose ps postgres
psql postgresql://forecastin:forecastin_password@localhost:5432/forecastin -c "SELECT 1;"

# Fix: Restart database
docker-compose restart postgres
```

### 🔴 TypeScript Compilation Errors
**Symptoms:** Frontend build fails, 89+ TypeScript errors

**Quick Fix:**
```bash
cd frontend
rm -rf node_modules/.cache
npm ci
npx tsc --noEmit  # Verify fixes
```

### 🔴 Port Conflicts
**Symptoms:** `Error: bind: address already in use`

**Quick Fix:**
```bash
# Find conflicting processes
lsof -i :3000  # Frontend
lsof -i :9000  # Backend
lsof -i :5432  # Database

# Kill processes or change ports in docker-compose.yml
```

## Health Check Commands

### Service Status (30 seconds)
```bash
# All services
docker-compose ps

# Individual health checks
curl -f http://localhost:9000/health
curl -f http://localhost:3000/
redis-cli ping
psql $DATABASE_URL -c "SELECT 1;"
```

### Performance Validation (1 minute)
```bash
# Basic performance check
curl http://localhost:9000/api/performance/metrics

# Expected metrics:
# - Ancestor resolution: <10ms (current: 3.46ms - under investigation)
# - Throughput: >40,000 RPS (current: 42,726 RPS ✅)
# - Cache hit rate: >99% (current: 99.2% ✅)
```

## Emergency Procedures

### 🚨 Immediate Rollback
```bash
# Stop everything
docker-compose down

# Fresh start with clean volumes
docker-compose down -v
docker-compose up --build -d
```

### 🚨 Database Recovery
```bash
# Backup before changes
docker-compose exec postgres pg_dump -U forecastin forecastin > backup_$(date +%Y%m%d).sql

# Restore if needed
docker-compose exec -T postgres psql -U forecastin forecastin < backup.sql
```

### 🚨 Cache Reset
```bash
# Clear all caches
docker-compose exec redis redis-cli FLUSHALL
curl -X POST http://localhost:9000/api/cache/reset
```

## Development Workflow

### Daily Startup Sequence
```bash
# 1. Update code
git pull origin main

# 2. Start services
docker-compose up -d

# 3. Verify
curl http://localhost:9000/health
open http://localhost:3000
```

### Testing Before Commit
```bash
# Backend tests
docker-compose exec api pytest tests/ -v

# Frontend tests
cd frontend && npm test

# Type checking
npx tsc --noEmit

# Build verification
npm run build
```

## Configuration Reference

### Critical Environment Variables
```bash
# Backend (.env)
DATABASE_URL=postgresql://forecastin:forecastin_password@localhost:5432/forecastin
REDIS_URL=redis://localhost:6379/0
API_PORT=9000
WS_PING_INTERVAL=30

# Frontend (package.json scripts)
REACT_APP_API_URL=http://localhost:9000
REACT_APP_WS_URL=ws://localhost:9000
```

### Port Configuration
| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | React development server |
| Backend API | 9000 | FastAPI + WebSocket |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| Prometheus | 9090 | Metrics |
| Grafana | 3001 | Dashboard |

## Performance Targets

### Current SLO Status
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Ancestor Resolution | <10ms | 3.46ms | ⚠️ Under Investigation |
| Throughput | >40,000 RPS | 42,726 RPS | ✅ Passed |
| Cache Hit Rate | >99% | 99.2% | ✅ Passed |
| WebSocket Serialization | <1ms | 0.019ms | ✅ Passed |

### Monitoring Endpoints
- **Health**: `http://localhost:9000/health`
- **Performance**: `http://localhost:9000/api/performance/metrics`
- **Cache Metrics**: `http://localhost:9000/api/feature-flags/metrics/cache`
- **WebSocket Test**: `ws://localhost:9000/ws/health`

## Troubleshooting Matrix

### Problem → Solution Quick Reference

| Problem | Immediate Action | Verification |
|---------|------------------|-------------|
| WebSocket 1006 errors | Check `WS_PING_INTERVAL=30` | `wscat -c ws://localhost:9000/ws/health` |
| Database connection failed | Restart PostgreSQL | `psql $DATABASE_URL -c "SELECT 1;"` |
| Frontend build errors | Clear TypeScript cache | `npx tsc --noEmit` |
| Port already in use | Find/kill process or change port | `lsof -i :PORT` |
| Performance regression | Check materialized views | `psql -c "REFRESH MATERIALIZED VIEW mv_entity_ancestors;"` |

## Success Indicators

### ✅ System Ready Checklist
- [ ] All Docker services show "Up" status
- [ ] Frontend loads at http://localhost:3000 without console errors
- [ ] API docs available at http://localhost:9000/docs
- [ ] WebSocket connections established (check browser Network tab)
- [ ] Database queries execute successfully
- [ ] Performance metrics within SLO targets (except ancestor resolution)

### 🚨 System Not Ready Indicators
- ❌ Docker services not starting
- ❌ Browser console shows WebSocket errors
- ❌ API health endpoint returns error
- ❌ TypeScript compilation fails
- ❌ Performance metrics significantly degraded

## Support Resources

### Documentation Links
- [Full Startup Guide](./STARTUP_PROCEDURES_AND_ERROR_PATTERNS.md)
- [Developer Setup](../DEVELOPER_SETUP.md)
- [WebSocket Troubleshooting](../README.md#websocket-hardening)
- [Performance Investigation](../performance_regression_investigation.md)

### Log Locations for Debugging
- **Backend**: `docker-compose logs -f api`
- **Frontend**: Browser developer console
- **Database**: `docker-compose logs -f postgres`
- **System**: `docker-compose logs -f`

---

**Last Updated**: 2025-11-08  
**Status**: ✅ Production Ready (except ancestor resolution investigation)  
**TypeScript Compliance**: ✅ 0 errors (strict mode enabled)