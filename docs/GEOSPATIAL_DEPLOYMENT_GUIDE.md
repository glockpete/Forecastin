# Geospatial Layer System - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the geospatial layer system to production, including feature flag rollout, performance validation, and rollback procedures.

## Prerequisites

- PostgreSQL with LTREE and PostGIS extensions installed
- Redis for multi-tier caching (L2)
- Frontend build with geospatial components
- Backend API with FeatureFlagService deployed

## Pre-Deployment Checklist

- [ ] Database migrations applied (`001_initial_schema.sql`, `002_ml_ab_testing_framework.sql`)
- [ ] Materialized views created (`mv_entity_ancestors`, `mv_descendant_counts`)
- [ ] Redis connection pool configured
- [ ] WebSocket infrastructure tested
- [ ] Performance monitoring enabled
- [ ] Feature flags initialized via `api/services/init_geospatial_flags.py`

## Deployment Phases

### Phase 1: Foundation (Weeks 1-2)

**Objective:** Enable core geospatial layer system for 10% of users

#### Step 1.1: Verify Prerequisites

```bash
# Ensure ff.map_v1 is enabled
curl http://localhost:9000/api/v1/feature-flags/ff.map_v1

# Expected response:
# {"flag_name": "ff.map_v1", "is_enabled": true, "rollout_percentage": 100}
```

If not enabled:

```bash
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.map_v1/enable
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.map_v1/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 100}'
```

#### Step 1.2: Enable Core Layers (10% Rollout)

```bash
# Enable ff.geo.layers_enabled with 10% rollout
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.geo.layers_enabled/enable
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 10}'
```

#### Step 1.3: Refresh Materialized Views

**⚠️ CRITICAL:** This step is required after initial deployment and after any hierarchy modifications.

```bash
# Via API endpoint (recommended)
curl -X POST http://localhost:9000/api/navigation/refresh-hierarchy-views

# Or via direct database connection
psql -d forecastin -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;"
psql -d forecastin -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_descendant_counts;"
```

#### Step 1.4: Monitor Performance Metrics

Monitor the following metrics for 48 hours:

```bash
# Check feature flag metrics
curl http://localhost:9000/api/v1/feature-flags/metrics

# Expected SLOs:
# - Render time: <10ms
# - Cache hit rate: >99.2%
# - WebSocket message latency: <100ms
# - Error rate: <1%
```

**Success Criteria:**
- Error rate < 1%
- P95 layer update latency < 100ms
- No memory leaks over 24 hours
- Cache hit rate > 99%

### Phase 2: Expansion (Weeks 3-4)

**Objective:** Increase rollout to 25% of users

#### Step 2.1: Validate Phase 1 Metrics

```bash
# Generate performance report
curl http://localhost:9000/api/v1/metrics/performance-report

# Check for SLO violations
grep "SLO_VIOLATION" /var/log/forecastin/api.log
```

#### Step 2.2: Increase Rollout to 25%

```bash
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 25}'
```

#### Step 2.3: Monitor Scaling Behavior

- Database query performance
- Cache hit rates across L1-L4 tiers
- Redis connection pool utilization
- WebSocket connection count

**Success Criteria:**
- Cache hit rate > 99%
- Database query time < 1.25ms (P95)
- Redis connection pool < 80% utilization
- No degradation in existing features

### Phase 3: Majority Rollout (Weeks 5-6)

**Objective:** Increase to 50% of users

#### Step 3.1: Infrastructure Capacity Check

```bash
# Check database connection pool
curl http://localhost:9000/api/v1/metrics/database-pool

# Check Redis capacity
redis-cli INFO stats | grep memory_usage

# Check WebSocket connections
curl http://localhost:9000/api/v1/metrics/websocket-connections
```

#### Step 3.2: Increase Rollout to 50%

```bash
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 50}'
```

**Success Criteria:**
- Infrastructure costs within budget
- No user-reported issues
- Performance SLOs maintained

### Phase 4: Full Rollout + Sub-Features (Weeks 7-8)

**Objective:** 100% rollout of core layers, gradual rollout of advanced features

#### Step 4.1: Full Rollout of Core Layers

```bash
# Enable for all users
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 100}'
```

#### Step 4.2: Enable GPU Rendering (10% Rollout)

```bash
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.geo.gpu_rendering_enabled/enable
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.geo.gpu_rendering_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 10}'
```

#### Step 4.3: Monitor GPU Performance

```bash
# Check GPU utilization (if applicable)
nvidia-smi --query-gpu=utilization.gpu,utilization.memory --format=csv

# Check GPU filter performance
curl http://localhost:9000/api/v1/metrics/gpu-filter-performance

# Expected: <100ms GPU filter time
```

**Success Criteria:**
- GPU filter time < 100ms
- CPU fallback functioning correctly
- No GPU-related crashes
- 60+ FPS for 100K+ points (GPU enabled)

## Rollback Procedures

### Emergency Rollback (Immediate)

**When to use:** Critical bugs, security issues, or system instability

```bash
# Disable master switch (disables all geospatial features)
curl -X PUT http://localhost:9000/api/v1/feature-flags/ff.geo.layers_enabled/disable
```

### Rollback Decision Matrix

| Severity | Issue Type | Strategy | Timeline |
|----------|-----------|----------|----------|
| **Critical** | Data loss, security breach | Emergency rollback | Immediate |
| **High** | Major functionality broken | Emergency rollback | <1 hour |
| **Medium** | Performance degradation | Gradual rollback | <4 hours |
| **Low** | UI glitches | Gradual rollback | <24 hours |

## Performance Validation

### Required Performance Tests

```bash
# Run integration tests
cd frontend
npm test -- src/layers/tests/GeospatialIntegrationTests.test.ts

# Run performance benchmarks
npm test -- src/tests/BaseLayerPerformanceBenchmarks.ts
```

### Performance SLO Checklist

- [x] Render time < 10ms (P95) - ✅ **Validated**
- [x] GPU filter time < 100ms (if enabled) - ✅ **Validated**
- [x] Cache hit rate > 99.2% - ✅ **Validated**
- [ ] Ancestor resolution < 1.25ms (P95: <1.87ms) - ❌ **3.46ms - SLO regression detected**
- [x] WebSocket message latency < 100ms - ✅ **Validated**
- [x] Throughput > 10,000 RPS - ✅ **42,726 RPS validated**
- [x] Materialized view refresh < 1000ms - ✅ **850ms validated**
- [x] WebSocket serialization < 2ms - ✅ **0.019ms validated**
- [x] Connection pool health < 80% - ✅ **65% validated**

**SLO Validation Status:** ⚠️ **Regression detected** - See [`slo_test_report.json`](../slo_test_report.json)

## Support

For issues or questions:

- Check logs: `/var/log/forecastin/api.log`
- Run diagnostics: `python api/services/init_geospatial_flags.py`
- Review metrics: `curl http://localhost:9000/api/v1/feature-flags/metrics`
- Consult documentation: `docs/GEOSPATIAL_FEATURE_FLAGS.md`

## Changelog

| Date | Version | Changes |
|------|---------| ---------|
| 2025-11-05 | 1.0.0 | Initial deployment guide for geospatial layer system |
| 2025-11-06 | 1.1.0 | Updated with current SLO validation status and performance regression detection |