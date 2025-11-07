# Next Steps: Infrastructure Validation

**Date**: 2025-11-06
**Status**: Performance optimizations complete - awaiting infrastructure validation
**Related**: [Performance Optimization Report](docs/PERFORMANCE_OPTIMIZATION_REPORT.md)

---

## Executive Summary

Performance optimizations for ancestor resolution have been **successfully implemented** in code. The next phase requires **infrastructure validation** with PostgreSQL and Redis running to confirm the projected performance improvements.

**Current Status**:
- ✅ Root cause identified (cold cache + lock contention)
- ✅ Code optimizations implemented (-0.8 to -1.3ms expected)
- ✅ Benchmark calculation fixed for accurate measurements
- ⏳ Infrastructure validation pending

**Expected Outcome**: 3.46ms → ~0.07ms (warm cache) or ~2.5ms (cold cache)

---

## Infrastructure Requirements

### Required Services

1. **PostgreSQL 16+**
   - LTREE extension enabled
   - PostGIS extension enabled
   - pg_trgm extension enabled
   - Database: `forecastin`
   - User: `forecastin` with password
   - Port: 5432

2. **Redis 6+**
   - Port: 6379
   - Connection pooling configured
   - Persistence enabled (optional for testing)

### Kubernetes Deployment (Recommended)

Based on your infrastructure requirements, use Kubernetes with:

```yaml
# PostgreSQL StatefulSet with:
- LTREE, PostGIS, pg_trgm extensions
- Persistent volume for data
- TCP keepalives: keepalives_idle=30, keepalives_interval=10, keepalives_count=5
- Secrets management for credentials
- Resource limits: 2-4 CPU, 4-8GB RAM

# Redis Deployment with:
- Persistent volume (optional)
- Connection pooling: max_connections=50
- Resource limits: 1-2 CPU, 2-4GB RAM

# Network Policies:
- Allow API → PostgreSQL (5432)
- Allow API → Redis (6379)
- Deny all other ingress
```

### Docker Compose (Alternative)

For local/development testing:

```bash
cd /home/user/Forecastin
docker-compose up -d postgres redis

# Verify services
docker-compose ps
docker-compose logs postgres
docker-compose logs redis
```

---

## Validation Steps

### Step 1: Service Health Checks

```bash
# PostgreSQL
psql -U forecastin -d forecastin -c "SELECT version();"
psql -U forecastin -d forecastin -c "SELECT * FROM pg_extension WHERE extname IN ('ltree', 'postgis', 'pg_trgm');"

# Redis
redis-cli ping
redis-cli INFO server
```

### Step 2: Database Schema Setup

If database is empty, run migrations:

```bash
cd api
python -m alembic upgrade head

# Or manually apply migrations
psql -U forecastin -d forecastin -f migrations/001_initial_schema.sql
psql -U forecastin -d forecastin -f migrations/002_ml_ab_testing_framework.sql
psql -U forecastin -d forecastin -f migrations/003_optimize_hierarchy_performance.sql
psql -U forecastin -d forecastin -f migrations/004_rss_entity_extraction_schema.sql
```

### Step 3: Verify Materialized Views

```sql
-- Check materialized views exist
SELECT schemaname, matviewname, ispopulated
FROM pg_matviews
WHERE matviewname IN ('mv_entity_ancestors', 'mv_descendant_counts');

-- Check view contents (should have data)
SELECT COUNT(*) FROM mv_entity_ancestors;
SELECT COUNT(*) FROM mv_descendant_counts;

-- Manual refresh if needed
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_descendant_counts;
```

### Step 4: Verify LTREE Indexes

```sql
-- Check for GiST indexes on LTREE columns
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef LIKE '%USING gist%'
  AND indexdef LIKE '%ltree%';

-- Expected indexes:
-- idx_entity_hierarchy_path (GiST on path column)
-- idx_entity_hierarchy_depth_path (composite on path_depth, path)
```

### Step 5: Run Performance Benchmarks

```bash
# Test optimized hierarchy resolver
cd api/navigation_api/database
python3 optimized_hierarchy_resolver.py

# Expected output:
# - L1 cache hits: >99%
# - Average latency: <0.1ms (warm cache)
# - P95 latency: <0.2ms
# - Throughput: >40,000 RPS
```

### Step 6: Run SLO Validation

```bash
cd /home/user/Forecastin
python3 scripts/slo_validation.py --output slo_validation_after_optimization.json

# Compare with previous report
diff slo_test_report.json slo_validation_after_optimization.json
```

### Step 7: Load Testing (Optional)

```bash
# Install dependencies
pip install locust

# Run load test
locust -f tests/performance/hierarchy_load_test.py --host=http://localhost:9000
```

---

## Expected Results

### Warm Cache Scenario (99.2% of requests)

**Before Optimization**:
- L1 hit overhead: ~0.15ms
- Status: ⚠️ Above 0.1ms ideal

**After Optimization**:
- L1 hit overhead: ~0.05ms
- Status: ✅ Well under 1.25ms target

**Validation**:
```bash
# Run 1000 iterations with warm cache
python3 -c "
from api.navigation_api.database.optimized_hierarchy_resolver import OptimizedHierarchyResolver, benchmark_hierarchy_resolution

resolver = OptimizedHierarchyResolver()
# Pre-warm cache
for i in range(100):
    resolver.get_hierarchy(f'entity_{i:03d}')

# Benchmark
results = benchmark_hierarchy_resolution(resolver, [f'entity_{i:03d}' for i in range(100)], 1000)
print(f'Average: {results[\"avg_latency_ms\"]:.3f}ms')
print(f'P95: {results[\"p95_latency_ms\"]:.3f}ms')
print(f'Cache hit rate: {results[\"cache_hit_ratio\"]:.1%}')
print(f'Meets SLO: {results[\"meets_performance_slos\"]}')
"
```

### Cold Cache Scenario (0.8% of requests)

**Before Optimization**:
- All tiers miss: ~3.46ms
- Status: ❌ 177% over target

**After Optimization**:
- All tiers miss: ~2.51ms
- Status: ⚠️ Still over target but 27% improvement

**Note**: Cold cache will always be slower, but optimizations reduce overhead significantly.

---

## Troubleshooting

### Issue: PostgreSQL Connection Fails

**Symptom**: `connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed`

**Solutions**:
1. Check service is running: `pg_lsclusters` or `kubectl get pods`
2. Verify pg_hba.conf allows connections
3. Check user exists: `SELECT * FROM pg_user WHERE usename = 'forecastin';`
4. Test with explicit host: `psql -h localhost -U forecastin -d forecastin`

### Issue: Redis Connection Fails

**Symptom**: `Error connecting to Redis`

**Solutions**:
1. Check service is running: `redis-cli ping`
2. Verify port 6379 is accessible
3. Check firewall/network policies
4. Test connection: `telnet localhost 6379`

### Issue: Materialized Views Empty

**Symptom**: `SELECT COUNT(*) FROM mv_entity_ancestors` returns 0

**Solutions**:
1. Check entities table has data: `SELECT COUNT(*) FROM entities;`
2. Manually refresh: `REFRESH MATERIALIZED VIEW mv_entity_ancestors;`
3. Check for errors: `SELECT * FROM pg_stat_activity WHERE query LIKE '%mv_entity%';`

### Issue: Performance Still Slow

**Symptom**: Benchmarks show >1ms latency even with warm cache

**Investigation**:
1. Check cache hit rate: Should be >99%
   ```python
   metrics = resolver.get_cache_performance_metrics()
   print(metrics['overall']['overall_hit_ratio'])
   ```

2. Check L1 cache size:
   ```python
   print(resolver.l1_cache.size())  # Should be near max (1000)
   ```

3. Profile with cProfile:
   ```bash
   python3 -m cProfile -s cumulative api/navigation_api/database/optimized_hierarchy_resolver.py
   ```

4. Check for lock contention:
   ```sql
   SELECT * FROM pg_locks WHERE NOT granted;
   ```

---

## Success Criteria

**Minimum Requirements**:
- ✅ PostgreSQL and Redis running and accessible
- ✅ Database schema and migrations applied
- ✅ Materialized views populated
- ✅ LTREE indexes present and used
- ✅ L1 cache hit rate >99%
- ✅ Average latency <1.25ms (warm cache)
- ✅ P95 latency <1.87ms (warm cache)
- ✅ Benchmark meets performance SLOs

**Deliverables**:
- Updated `slo_validation_after_optimization.json` report
- Performance benchmark results
- Comparison before/after metrics
- Updated README.md with validated performance

---

## Rollback Plan

If validation reveals issues with optimizations:

1. **Immediate Rollback**:
   ```bash
   git revert 9613754  # Revert Phase 2 optimizations
   git push origin claude/check-docs-next-task-011CUs387i9VmcGRZauUxExu
   ```

2. **Investigate Issues**:
   - Collect error logs
   - Run diagnostics
   - Profile performance bottlenecks

3. **Alternative Approaches**:
   - Database query optimization (EXPLAIN ANALYZE)
   - Index tuning
   - Connection pool adjustments
   - Materialized view refresh strategy

---

## Post-Validation Steps

Once validation is complete:

1. **Update Documentation**:
   - Update SLO status in README.md
   - Update performance metrics in Original Roadmap.md
   - Archive old test reports

2. **Create PR Summary**:
   - Document validated performance improvements
   - Include before/after benchmarks
   - Link to optimization reports

3. **Monitor Production**:
   - Set up Prometheus/Grafana dashboards
   - Configure alerts for performance degradation
   - Track cache hit rates over time

4. **Plan Next Phase**:
   - If target achieved: Move to next roadmap item
   - If target not met: Plan Phase 3 optimizations

---

## Related Documentation

- [Performance Diagnostic Report](docs/PERFORMANCE_DIAGNOSTIC_REPORT.md)
- [Performance Optimization Report](docs/PERFORMANCE_OPTIMIZATION_REPORT.md)
- [AGENTS.md](docs/AGENTS.md) - Architecture constraints
- [GOLDEN_SOURCE.md](docs/GOLDEN_SOURCE.md) - Core requirements
- [Original Roadmap.md](Original%20Roadmap.md) - SLO targets

---

**Last Updated**: 2025-11-06
**Next Review**: After infrastructure deployment
**Owner**: DevOps/Platform Team
