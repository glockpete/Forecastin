# Quick Start: Test Environment Setup

Get a working test environment for stack-level fixes in under 10 minutes.

---

## Prerequisites

```bash
# Check you have required tools
docker --version          # Need 20.10+
docker-compose --version  # Need 1.29+
python --version          # Need 3.11+
psql --version           # Need 14+
```

---

## 1. Start All Services (One Command)

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  # Database for materialized views testing
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: forecastin_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  # RSSHub for ingestion testing
  rsshub:
    image: diygod/rsshub:latest
    ports:
      - "1200:1200"
    environment:
      - CACHE_TYPE=memory
      - CACHE_EXPIRE=300
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:1200/"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Redis for caching (optional but recommended)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Rate-limited proxy for anti-crawler testing
  nginx-ratelimit:
    image: nginx:alpine
    ports:
      - "1201:80"
    volumes:
      - ./tests/fixtures/nginx-ratelimit.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - rsshub

volumes:
  postgres_data:
```

**Start everything:**

```bash
# From repo root
docker-compose -f docker-compose.dev.yml up -d

# Wait for health checks
docker-compose -f docker-compose.dev.yml ps

# Should see all services "healthy"
```

---

## 2. Initialize Database

```bash
# Run migrations
psql -h localhost -U dev -d forecastin_dev -f migrations/001_initial_schema.sql
psql -h localhost -U dev -d forecastin_dev -f migrations/002_entity_hierarchy.sql
psql -h localhost -U dev -d forecastin_dev -f migrations/003_feature_flags.sql
psql -h localhost -U dev -d forecastin_dev -f migrations/004_rss_entity_extraction_schema.sql

# Verify tables created
psql -h localhost -U dev -d forecastin_dev -c "\dt"

# Should see: entities, ingestion_jobs, rss_articles, feature_flags, etc.
```

**Insert test data:**

```sql
-- Insert test entities for hierarchy testing
INSERT INTO entities (entity_id, name, type, parent_id) VALUES
  ('root', 'Root Entity', 'root', NULL),
  ('org1', 'Organization 1', 'org', 'root'),
  ('dept1', 'Department 1', 'dept', 'org1'),
  ('team1', 'Team 1', 'team', 'dept1');

-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_descendant_counts;

-- Verify views populated
SELECT * FROM mv_entity_ancestors;
```

---

## 3. Configure Backend Environment

Create `.env.dev`:

```bash
# Database
DATABASE_URL=postgresql://dev:dev_password@localhost:5432/forecastin_dev
DB_POOL_MIN_SIZE=5
DB_POOL_MAX_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379/0

# RSSHub
RSSHUB_BASE_URL=http://localhost:1200

# Feature Flags
FEATURE_FLAGS_CACHE_TTL=300

# API
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=DEBUG
```

**Load environment:**

```bash
# Option 1: Export to shell
export $(cat .env.dev | xargs)

# Option 2: Use with python-dotenv
pip install python-dotenv
# Will auto-load .env.dev in FastAPI
```

---

## 4. Start Backend (FastAPI)

```bash
# Install dependencies
pip install -r requirements.txt

# Start with auto-reload
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# Should see:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Application startup complete
```

**Verify backend running:**

```bash
# Health check
curl http://localhost:8000/health

# Should return: {"status": "healthy"}
```

---

## 5. Test Each Fix

### Test #5: RSS Pipeline

```bash
# 1. Verify RSSHub is reachable
curl http://localhost:1200/github/trending/daily

# 2. Trigger ingestion via API (after implementing routes from cheat sheet)
curl -X POST http://localhost:8000/api/rss/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:1200/github/trending/daily",
    "category": "tech"
  }'

# 3. Check job status
curl http://localhost:8000/api/rss/jobs/{job_id}

# 4. Verify articles in database
psql -h localhost -U dev -d forecastin_dev \
  -c "SELECT article_id, title, published_at FROM rss_articles LIMIT 5;"
```

### Test #6: Materialized View Refresh

```bash
# 1. Insert new entity
curl -X POST http://localhost:8000/api/entities \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Team",
    "type": "team",
    "parent_id": "dept1"
  }'

# 2. Check if views refreshed (depending on strategy)
psql -h localhost -U dev -d forecastin_dev \
  -c "SELECT entity_id, ancestor_id FROM mv_entity_ancestors WHERE entity_id = 'new-team-id';"

# 3. Measure refresh performance
psql -h localhost -U dev -d forecastin_dev \
  -c "EXPLAIN ANALYZE REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;"
```

### Test #10: Anti-Crawler Patterns

```bash
# 1. Test rate limiting (20 rapid requests)
for i in {1..20}; do
  curl -w "\n%{http_code}\n" http://localhost:1201/github/trending/daily
  sleep 0.1
done
# Should see some 429 responses

# 2. Run integration tests
pytest tests/integration/test_rsshub_crawler.py -v -s

# 3. Check retry logs
docker-compose logs -f api | grep "retry"
```

---

## 6. Run Full Integration Test Suite

```bash
# Run all integration tests
pytest tests/integration/ -v --integration

# Run with coverage
pytest tests/integration/ --cov=api --cov-report=html

# Open coverage report
open htmlcov/index.html
```

---

## 7. Tear Down

```bash
# Stop all services
docker-compose -f docker-compose.dev.yml down

# Remove volumes (clean slate)
docker-compose -f docker-compose.dev.yml down -v

# Or keep data for next session (just stop containers)
docker-compose -f docker-compose.dev.yml stop
```

---

## Troubleshooting

### Database Connection Fails

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker-compose -f docker-compose.dev.yml logs postgres

# Test connection manually
psql -h localhost -U dev -d forecastin_dev -c "SELECT 1;"
```

### RSSHub Returns 500 Errors

```bash
# Check RSSHub logs
docker-compose -f docker-compose.dev.yml logs rsshub

# Restart service
docker-compose -f docker-compose.dev.yml restart rsshub

# Verify routes work
curl http://localhost:1200/rsshub/routes
```

### Backend Won't Start

```bash
# Check Python dependencies
pip list | grep fastapi

# Check environment variables
printenv | grep DATABASE_URL

# Run with verbose logging
LOG_LEVEL=DEBUG uvicorn api.main:app --reload
```

### Materialized View Refresh Slow

```bash
# Check entity count
psql -h localhost -U dev -d forecastin_dev \
  -c "SELECT COUNT(*) FROM entities;"

# If count > 10,000, consider:
# 1. Add more indexes
CREATE INDEX CONCURRENTLY idx_entities_parent_id ON entities(parent_id) WHERE parent_id IS NOT NULL;

# 2. Partition large tables
# 3. Use scheduled refresh instead of on-write
```

---

## Performance Benchmarks (Expected)

| Operation | Expected Time | Threshold |
|-----------|--------------|-----------|
| RSS feed fetch | <2s | Fail if >5s |
| Entity insert | <100ms | Fail if >500ms |
| View refresh (<1k entities) | <200ms | Fail if >1s |
| View refresh (<10k entities) | <2s | Fail if >10s |
| WebSocket message broadcast | <50ms | Fail if >200ms |

---

## Next Steps

Once this environment is stable:

1. **Implement fixes** from `STACK_LEVEL_FIXES_CHEATSHEET.md`
2. **Write integration tests** for each fix
3. **Measure performance** and adjust strategies
4. **Set up CI/CD** to run tests on every commit
5. **Deploy to staging** with same docker-compose setup
6. **Monitor production** with same health checks

---

## Quick Reference Commands

```bash
# Start everything
docker-compose -f docker-compose.dev.yml up -d

# Check status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Restart backend
docker-compose -f docker-compose.dev.yml restart api

# Run migrations
psql -h localhost -U dev -d forecastin_dev -f migrations/*.sql

# Start backend
uvicorn api.main:app --reload

# Run tests
pytest tests/integration/ -v

# Stop everything
docker-compose -f docker-compose.dev.yml down
```
