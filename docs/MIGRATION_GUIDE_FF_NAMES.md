# Feature Flag Name Standardization - Migration Guide

**Date**: 2025-11-07
**Breaking Change**: YES
**Estimated Downtime**: < 5 minutes
**Rollback Time**: < 2 minutes

---

## Executive Summary

This migration standardizes all feature flag names to the `ff.geo.*` pattern documented in `GEOSPATIAL_FEATURE_FLAGS.md`. This fixes critical contract drift where frontend requests flags that don't exist in the database.

### What Changes

| Old Name (Backend) | Old Name (Frontend) | New Name (Standardized) |
|--------------------|---------------------|-------------------------|
| `ff_geospatial_layers` | `ff.geospatial_layers` | `ff.geo.layers_enabled` |
| `ff_gpu_filtering` | `ff.gpu_filtering` | `ff.geo.gpu_rendering_enabled` |
| `ff_point_layer` | `ff.point_layer` | `ff.geo.point_layer_active` |
| `ff_polygon_layer` | `ff.polygon_layer` | `ff.geo.polygon_layer_active` |
| `ff_heatmap_layer` | `ff.heatmap_layer` | `ff.geo.heatmap_layer_active` |
| `ff_clustering_enabled` | `ff.clustering_enabled` | `ff.geo.clustering_enabled` |
| `ff_websocket_layers` | `ff.websocket_layers` | `ff.geo.websocket_layers_enabled` |
| `ff_realtime_updates` | `ff.realtime_updates` | `ff.geo.realtime_updates_enabled` |

---

## Prerequisites

- [ ] Database backup completed
- [ ] Services in maintenance mode (optional but recommended)
- [ ] All team members notified
- [ ] Rollback scripts tested on staging

---

## Migration Steps

### Step 1: Database Migration (2 minutes)

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d forecastin

# Run migration
\i migrations/001_standardize_feature_flag_names.sql

# Verify migration success
SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff.geo%';
-- Should return all flags with ff.geo.* pattern

# Check for old-style flags (should return 0 rows)
SELECT flag_name FROM feature_flags
WHERE flag_name LIKE 'ff_%'
  AND flag_name NOT LIKE 'ff.%'
  AND flag_name != 'ff.map_v1';
```

**Expected Output**:
```
flag_name
---------------------------------
ff.geo.layers_enabled
ff.geo.gpu_rendering_enabled
ff.geo.point_layer_active
ff.geo.polygon_layer_active
...
(11 rows)
```

---

### Step 2: Backend Code Updates (Auto-Applied)

The following files need updates. Apply the git patch:

```bash
git apply migrations/001_backend_flag_names.patch
```

**Files Modified**:
1. `api/services/feature_flag_service.py` (lines 81-129, 856-923)
2. `api/services/init_geospatial_flags.py` (lines 58-81)

**Key Changes**:
- Class field names updated to remove `ff_` prefix
- Method references updated to use `ff.geo.*` pattern
- Documentation strings updated

---

### Step 3: Frontend Code Updates (Auto-Applied)

```bash
git apply migrations/001_frontend_flag_names.patch
```

**Files Modified**:
1. `frontend/src/hooks/useFeatureFlag.ts` (lines 261-289)
2. `frontend/src/config/feature-flags.ts` (lines 12-19, 59-62, 105-108, 164-215)

**Key Changes**:
- Hook calls updated to use `ff.geo.*` pattern
- Interface definitions updated
- Environment variable mappings updated

---

### Step 4: Restart Services (1 minute)

```bash
# Backend
docker-compose restart api

# Frontend
cd frontend && npm run build
docker-compose restart frontend

# Or if running locally:
# Backend: supervisorctl restart api
# Frontend: pm2 restart frontend
```

---

### Step 5: Verification (2 minutes)

#### Backend Verification

```bash
# Check feature flags API
curl http://localhost:9000/api/feature-flags | jq '.[] | select(.flag_name | startswith("ff.geo"))'

# Expected: All geospatial flags should have ff.geo.* names
```

#### Frontend Verification

```bash
# Check browser console (open http://localhost:3000)
# Run in DevTools console:
window.__FEATURE_FLAGS__ = {};
fetch('/api/feature-flags')
  .then(r => r.json())
  .then(flags => {
    flags.forEach(f => {
      console.log(f.flag_name, '→', f.is_enabled);
    });
  });

# Expected: All flags should use ff.geo.* naming
```

#### Contract Verification

```bash
# Verify frontend can read flags backend creates
curl -X POST http://localhost:9000/api/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "flag_name": "ff.geo.test_flag",
    "description": "Test flag for migration verification",
    "is_enabled": true,
    "rollout_percentage": 100
  }'

# Then check frontend can access it:
curl http://localhost:3000/api/feature-flags/ff.geo.test_flag/enabled

# Clean up test flag:
curl -X DELETE http://localhost:9000/api/feature-flags/ff.geo.test_flag
```

---

## Rollback Procedure

If migration causes issues:

### Emergency Rollback (< 2 minutes)

```bash
# 1. Rollback database
psql -h localhost -U postgres -d forecastin \
  -f migrations/001_standardize_feature_flag_names_ROLLBACK.sql

# 2. Revert code changes
git revert HEAD~3..HEAD  # Reverts last 3 commits (migration commits)

# 3. Restart services
docker-compose restart api frontend

# 4. Verify rollback
curl http://localhost:9000/api/feature-flags | jq '.[].flag_name' | grep 'ff_'
# Should return old-style names
```

---

## Post-Migration Checklist

- [ ] All 11 geospatial flags use `ff.geo.*` naming
- [ ] Frontend can successfully fetch flags
- [ ] Feature flag service metrics show > 95% cache hit rate
- [ ] No errors in backend logs related to flags
- [ ] No errors in frontend console related to flags
- [ ] Test user can enable/disable features via UI
- [ ] WebSocket flag updates work correctly

---

## Testing Matrix

| Test Case | Expected Behavior | Verification |
|-----------|-------------------|--------------|
| Create new flag | Uses `ff.geo.*` naming | POST /api/feature-flags |
| Update existing flag | Finds flag by new name | PUT /api/feature-flags/ff.geo.* |
| Delete flag | Deletes by new name | DELETE /api/feature-flags/ff.geo.* |
| Frontend reads flag | Receives flag data | GET /api/feature-flags/ff.geo.*/enabled |
| Dependency enforcement | Child flag disabled when parent disabled | Test ff.geo.point_layer_active with ff.geo.layers_enabled=false |
| WebSocket notifications | Real-time flag updates work | Update flag, check WS message |
| Cache invalidation | Updated flags reflect immediately | Update flag, verify no stale cache |
| Gradual rollout | Rollout percentage respected | Test with user_id hashing |

---

## Known Issues & Workarounds

### Issue 1: Cached Flag Names

**Symptom**: Frontend still requests old flag names after migration

**Cause**: Browser cached JavaScript bundles

**Workaround**:
```bash
# Force cache bust
sed -i 's/version: "1.0.0"/version: "1.0.1"/' frontend/package.json
cd frontend && npm run build
```

### Issue 2: Feature Flag Service Not Finding Flags

**Symptom**: 404 errors when requesting flags

**Cause**: Database migration incomplete

**Workaround**:
```sql
-- Verify migration completed
SELECT COUNT(*) FROM feature_flags WHERE flag_name LIKE 'ff.geo%';
-- Should return 11 (or more)

-- If 0, re-run migration
\i migrations/001_standardize_feature_flag_names.sql
```

---

## Performance Impact

Expected performance impact: **NONE**

- Database queries unchanged (still indexed on `flag_name`)
- Cache keys updated (automatic with service restart)
- No additional network calls
- No schema changes (only data changes)

---

## Monitoring

### Metrics to Watch (First Hour)

```bash
# Feature flag service health
curl http://localhost:9000/api/feature-flags/metrics

# Check cache hit rate (should be > 95%)
# Check average response time (should be < 1.25ms)
```

### Alerts to Configure

```yaml
# Grafana/Prometheus alerts
- alert: FeatureFlagCacheHitRateLow
  expr: feature_flag_cache_hit_rate < 0.90
  for: 5m
  annotations:
    summary: "Feature flag cache hit rate dropped below 90%"

- alert: FeatureFlagResponseTimeSlow
  expr: feature_flag_avg_response_time_ms > 2
  for: 5m
  annotations:
    summary: "Feature flag response time exceeds 2ms"
```

---

## Communication Plan

### Before Migration

**Email to Team** (1 hour before):
> Subject: Feature Flag Migration - 5 Minute Maintenance Window
>
> We're standardizing feature flag names to fix contract drift issues.
>
> **When**: Today at [TIME]
> **Duration**: 5 minutes
> **Impact**: Brief API unavailability
> **Action Required**: Clear browser cache after deployment

### After Migration

**Slack Announcement**:
> ✅ Feature flag migration complete! All flags now use `ff.geo.*` naming.
> Please clear your browser cache and refresh the app.
> Report any issues in #engineering.

---

## FAQ

**Q: Why are we changing flag names?**
A: Frontend was requesting flags with names that don't exist in the database, causing features to fail silently.

**Q: Will this break existing features?**
A: No. The migration updates database records AND code simultaneously, maintaining feature functionality.

**Q: How long will this take?**
A: ~5 minutes total: 2min migration, 1min restart, 2min verification.

**Q: What if something goes wrong?**
A: We have a tested rollback procedure that takes < 2 minutes to execute.

**Q: Do I need to update my local development environment?**
A: Yes. Pull latest code and run the migration on your local database.

---

**Migration prepared by**: Claude Code Agent
**Reviewed by**: [Pending]
**Approved by**: [Pending]
