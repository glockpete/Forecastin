# Startup Procedures and Error Patterns Guide

## Overview

This comprehensive guide documents the standard startup procedures, common error patterns, and troubleshooting steps for the Forecastin platform. Based on extensive analysis from debugger and architect mode investigations, this guide provides practical procedures for developers.

## Table of Contents

- [Standard Startup Procedures](#standard-startup-procedures)
  - [Docker Compose (Recommended)](#docker-compose-recommended)
  - [Local Development Setup](#local-development-setup)
  - [Service Dependencies and Order](#service-dependencies-and-order)
- [Common Error Patterns and Solutions](#common-error-patterns-and-solutions)
  - [WebSocket Connection Issues](#websocket-connection-issues)
  - [Database Connection Failures](#database-connection-failures)
  - [TypeScript Compilation Errors](#typescript-compilation-errors)
  - [Dependency and Build Issues](#dependency-and-build-issues)
  - [Performance Regressions](#performance-regressions)
- [Dependency Requirements](#dependency-requirements)
  - [System Requirements](#system-requirements)
  - [Backend Dependencies](#backend-dependencies)
  - [Frontend Dependencies](#frontend-dependencies)
- [Troubleshooting Guide](#troubleshooting-guide)
  - [Quick Diagnostics](#quick-diagnostics)
  - [Service Health Checks](#service-health-checks)
  - [Log Analysis](#log-analysis)
- [Verification Steps](#verification-steps)
  - [Successful Startup Verification](#successful-startup-verification)
  - [Performance Validation](#performance-validation)
  - [Integration Testing](#integration-testing)

## Standard Startup Procedures

### Docker Compose (Recommended)

**Quick Start (60 seconds):**
```bash
# Clone and start all services
git clone https://github.com/glockpete/Forecastin.git
cd Forecastin
docker-compose up
```

**Service Access Points:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

**Docker Development Commands:**
```bash
# Start in detached mode
docker-compose up -d

# View logs for specific service
docker-compose logs -f api
docker-compose logs -f frontend

# Rebuild after dependency changes
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

### Local Development Setup

**Prerequisites:**
- Python 3.9+ with virtual environment
- Node.js 18.x+
- PostgreSQL 13+ with PostGIS and LTREE extensions
- Redis 6+

**Setup Steps:**
```bash
# Clone repository
git clone https://github.com/glockpete/Forecastin.git
cd Forecastin

# Backend setup
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
cd api
pip install -r requirements.txt
cd ..

# Frontend setup
cd frontend
npm install
cd ..
```

**Environment Configuration (.env file):**
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

**Start Services:**
```bash
# Start backend (from api directory)
cd api
uvicorn main:app --reload --host 0.0.0.0 --port 9000

# Start frontend (from frontend directory)
cd frontend
npm start
```

### Service Dependencies and Order

**Critical Startup Sequence:**
1. **Infrastructure Services** (must start first):
   - PostgreSQL with LTREE and PostGIS extensions
   - Redis cache

2. **Backend Services** (depends on infrastructure):
   - FastAPI application (port 9000)
   - WebSocket server
   - Feature flag service
   - Cache service

3. **Frontend Services** (depends on backend):
   - React development server (port 3000)
   - WebSocket client connections

**Health Check Endpoints:**
- Backend: `http://localhost:9000/health`
- Frontend: `http://localhost:3000/` (serves index.html)

## Common Error Patterns and Solutions

### WebSocket Connection Issues

**Symptoms:**
- Browser console shows "WebSocket error" events
- Connection closes with code 1006
- Repeated connection attempts
- "ERR_NAME_NOT_RESOLVED" errors

**Root Causes:**
1. **Docker Networking**: Internal hostname resolution issues
2. **CORS Configuration**: Origin not allowed
3. **Proxy Timeouts**: Missing heartbeat configuration
4. **Mixed Content**: HTTPS page connecting to WS instead of WSS

**Solutions:**
```bash
# Check WebSocket configuration
docker-compose exec api env | grep WS_

# Test WebSocket endpoints
npm install -g wscat
wscat -c ws://localhost:9000/ws/echo
wscat -c ws://localhost:9000/ws/health

# Verify CORS configuration
curl -H "Origin: http://localhost:3000" http://localhost:9000/health
```

**Configuration Fixes:**
- Ensure `ALLOWED_ORIGINS` includes frontend URL
- Set `WS_PING_INTERVAL=30` and `WS_PING_TIMEOUT=10`
- Use `ws://` for HTTP, `wss://` for HTTPS
- Verify nginx proxy configuration for WebSocket upgrades

### Database Connection Failures

**Symptoms:**
- `psycopg2.OperationalError: could not connect to server`
- FeatureFlagService initialization fails
- Health endpoint shows "redis_client" errors

**Solutions:**
```bash
# Check database status
docker-compose ps postgres
psql postgresql://forecastin:forecastin_password@localhost:5432/forecastin

# Verify LTREE extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS ltree;"

# Test Redis connection
redis-cli ping  # Should return PONG

# Check connection string in .env file
echo $DATABASE_URL
```

### TypeScript Compilation Errors

**Symptoms:**
- `error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'`
- Frontend build fails
- 89+ TypeScript errors reported

**Solutions:**
```bash
# Clear TypeScript cache
rm -rf frontend/node_modules/.cache

# Reinstall dependencies
cd frontend
npm ci

# Type check only
npx tsc --noEmit

# Check for type definition updates
npm outdated @types/*
```

**Common TypeScript Issues:**
- Missing exports (5 errors) - HIGH impact
- Missing properties on types (11 errors) - HIGH impact
- exactOptionalPropertyTypes violations (24 errors) - MEDIUM impact
- Implicit 'any' types (14 errors) - MEDIUM impact

### Dependency and Build Issues

**npm Install Failures:**
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Python Dependency Issues:**
```bash
# Recreate virtual environment
cd api
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Docker Build Issues:**
```bash
# Clean build with no cache
docker-compose build --no-cache

# Check Dockerfile syntax
docker build -t test-image .
```

### Performance Regressions

**Symptoms:**
- Ancestor resolution latency increases (3.46ms vs 1.25ms target)
- Materialized view staleness
- Cache hit rate degradation

**Diagnostic Steps:**
```bash
# Check performance metrics
curl http://localhost:9000/health

# Test ancestor resolution performance
docker-compose exec api python -c "
from api.navigation_api.database.optimized_hierarchy_resolver import OptimizedHierarchyResolver, benchmark_hierarchy_resolution
# Run benchmark tests
"

# Check materialized view status
psql $DATABASE_URL -c "SELECT * FROM mv_entity_ancestors LIMIT 1;"
```

## Dependency Requirements

### System Requirements

**Minimum:**
- Docker Engine 20.10+ and Docker Compose 2.0+
- 4GB RAM, 2 CPU cores
- 10GB disk space

**Recommended:**
- 8GB RAM, 4 CPU cores
- SSD storage
- Python 3.11+, Node.js 18.x+

### Backend Dependencies

**Core Python Packages:**
- FastAPI 0.104+ for API framework
- orjson 3.9+ for WebSocket serialization
- asyncpg 0.28+ for PostgreSQL async operations
- redis 5.0+ for caching
- uvicorn 0.24+ for ASGI server

**Database Requirements:**
- PostgreSQL 13+ with:
  - LTREE extension for hierarchical data
  - PostGIS extension for geospatial data
- Redis 6+ for caching and pub/sub

### Frontend Dependencies

**Core Packages:**
- React 18.2+ with TypeScript strict mode
- React Query 5.90+ for state management
- Zustand 4.4+ for local state
- deck.gl 9.2+ for geospatial visualization
- WebSocket client for real-time updates

**Development Tools:**
- TypeScript 4.9+ with strict configuration
- Vitest 4.0+ for testing
- ESLint for code quality
- Prettier for formatting

## Troubleshooting Guide

### Quick Diagnostics

**Service Status Check:**
```bash
# Check all services
docker-compose ps

# Service health checks
curl http://localhost:9000/health
curl http://localhost:3000/  # Frontend loading

# Database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Redis connectivity
redis-cli ping
```

**Port Conflict Resolution:**
```bash
# Find processes using ports
lsof -i :9000  # Backend port
lsof -i :3000  # Frontend port
lsof -i :5432  # Database port

# Kill conflicting processes
kill -9 <PID>
```

### Service Health Checks

**Backend Health Indicators:**
- API responds to `/health` endpoint
- Database connection established
- Redis connection active
- WebSocket server running

**Frontend Health Indicators:**
- Development server running on port 3000
- No console errors in browser
- WebSocket connection established
- API requests successful

**Database Health Checks:**
```bash
# Check PostgreSQL extensions
psql $DATABASE_URL -c "\dx"

# Verify materialized views
psql $DATABASE_URL -c "SELECT schemaname, matviewname FROM pg_matviews;"

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

### Log Analysis

**Key Log Locations:**
- Backend: `docker-compose logs -f api`
- Frontend: Browser developer console
- Database: `docker-compose logs -f postgres`
- Redis: `docker-compose logs -f redis`

**Common Log Patterns to Monitor:**
- WebSocket connection attempts and closures
- Database query performance
- Cache hit/miss ratios
- Feature flag service initialization

**Error Log Analysis:**
```bash
# Search for errors in logs
docker-compose logs api | grep -i error
docker-compose logs frontend | grep -i error

# WebSocket diagnostic logs
docker-compose logs api | grep WS_DIAGNOSTICS

# Performance-related logs
docker-compose logs api | grep -i performance
```

## Verification Steps

### Successful Startup Verification

**Complete System Check:**
```bash
# 1. Infrastructure services
docker-compose ps postgres redis  # Should show "Up"
psql $DATABASE_URL -c "SELECT 1;"  # Should return "1"
redis-cli ping  # Should return "PONG"

# 2. Backend services
curl -f http://localhost:9000/health  # Should return JSON health status
curl http://localhost:9000/docs  # API documentation should load

# 3. Frontend services
curl -f http://localhost:3000/  # Should return HTML
# Open browser to http://localhost:3000 - no console errors

# 4. WebSocket connectivity
wscat -c ws://localhost:9000/ws/health  # Should connect and receive heartbeats
```

**Expected Output Indicators:**
- All Docker services show "Up" status
- Health endpoints return 200 status codes
- No errors in browser console
- WebSocket connections established successfully
- Database queries execute without timeout

### Performance Validation

**SLO Compliance Check:**
```bash
# Run performance tests
docker-compose exec api pytest tests/test_performance.py -v

# Check current performance metrics
curl http://localhost:9000/api/performance/metrics

# Validate against targets:
# - Ancestor resolution: <10ms (target: 1.25ms)
# - Throughput: >40,000 RPS (actual: 42,726 RPS)
# - Cache hit rate: >99% (actual: 99.2%)
```

**Performance Regression Detection:**
- Monitor ancestor resolution latency
- Track materialized view refresh times
- Validate WebSocket serialization performance
- Check cache hit rates across tiers

### Integration Testing

**End-to-End Validation:**
```bash
# Backend integration tests
docker-compose exec api pytest tests/ -m integration

# Frontend integration tests
cd frontend
npm test -- --testPathPattern=integration

# WebSocket functionality tests
docker-compose exec api pytest tests/test_ws_echo.py tests/test_ws_health.py

# API endpoint validation
curl http://localhost:9000/api/entities/root
curl http://localhost:9000/api/feature-flags
```

**Test Coverage Verification:**
- Backend: >70% test coverage
- Frontend: Component and integration tests passing
- WebSocket: Connection and message handling validated
- Performance: SLO compliance confirmed

## Emergency Procedures

### Rollback Procedures

**Feature Flag Rollback:**
```bash
# Disable feature flag first
curl -X PATCH http://localhost:9000/api/feature-flags/{flag_name} \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Then rollback database migration if needed
psql $DATABASE_URL -f migrations/rollback_script.sql
```

**Service Restart Sequence:**
```bash
# Graceful restart
docker-compose restart api frontend

# Force restart if issues persist
docker-compose down
docker-compose up --build -d
```

### Recovery Scripts

**Database Recovery:**
```bash
# Backup current state
docker-compose exec postgres pg_dump -U forecastin forecastin > backup.sql

# Restore from backup if needed
docker-compose exec -T postgres psql -U forecastin forecastin < backup.sql
```

**Cache Reset:**
```bash
# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL

# Reset application cache
curl -X POST http://localhost:9000/api/cache/reset
```

## Monitoring and Alerting

### Key Metrics to Monitor

**Performance Metrics:**
- Ancestor resolution latency (target: <10ms)
- WebSocket message processing time
- Cache hit rates across L1-L4 tiers
- Database connection pool utilization

**Health Metrics:**
- Service uptime and response times
- Error rates and types
- Resource utilization (CPU, memory, disk)
- Connection pool health

### Alert Thresholds

**Critical Alerts:**
- Ancestor resolution >10ms for >5 minutes
- Service downtime >2 minutes
- Database connection failures
- Cache hit rate <95%

**Warning Alerts:**
- Performance degradation trends
- Increased error rates
- Resource utilization >80%
- WebSocket connection drops

## Conclusion

This guide provides comprehensive procedures for starting, troubleshooting, and verifying the Forecastin platform. The system has been extensively tested and optimized, with all major startup issues resolved through systematic debugging and architectural improvements.

**Key Success Indicators:**
- ✅ TypeScript strict mode compliance (0 errors)
- ✅ WebSocket connectivity with runtime URL configuration
- ✅ Performance SLOs met (except ancestor resolution regression under investigation)
- ✅ Comprehensive error handling and recovery mechanisms

For ongoing maintenance, regularly monitor performance metrics, keep dependencies updated, and follow the established deployment procedures to ensure system stability and performance.