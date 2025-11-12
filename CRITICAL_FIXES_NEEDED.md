# CRITICAL FIXES REQUIRED BEFORE PRODUCTION

## Priority 1: Non-Deterministic Advisory Lock IDs (CRITICAL)

**Issue:** Python's `hash()` uses random seed, different processes generate different lock IDs for same view name.

**Impact:** Advisory locking doesn't work across processes - race conditions still possible!

**File:** `api/navigation_api/database/optimized_hierarchy_resolver.py`

**Lines:** 658, 688

**Fix:**

```python
# REPLACE THIS (2 locations):
lock_id = hash(view_name) & 0x7FFFFFFF

# WITH THIS:
import hashlib
lock_id = int(hashlib.md5(view_name.encode()).hexdigest()[:8], 16) & 0x7FFFFFFF
```

**Verification:**

```python
# Test that lock IDs are deterministic
from hashlib import md5
view = "mv_entity_ancestors"
lock1 = int(md5(view.encode()).hexdigest()[:8], 16) & 0x7FFFFFFF
lock2 = int(md5(view.encode()).hexdigest()[:8], 16) & 0x7FFFFFFF
assert lock1 == lock2, "Lock IDs must be deterministic!"
```

---

## Priority 2: Missing Unique Index for CONCURRENTLY

**Issue:** `mv_rss_source_statistics` can't use CONCURRENTLY refresh - always falls back to blocking refresh.

**Impact:** MV refresh blocks all SELECT queries, defeating the purpose of CONCURRENTLY.

**File:** `migrations/005_rss_feed_sources_schema.sql`

**After line:** 244

**Fix:**

```sql
-- Add after line 244:

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_rss_source_stats_unique
    ON mv_rss_source_statistics(region, language, political_orientation, source_type);

COMMENT ON INDEX idx_mv_rss_source_stats_unique IS
'Unique index on GROUP BY columns, required for CONCURRENTLY refresh to avoid blocking reads';
```

**Verification:**

```sql
-- Test that CONCURRENTLY works without falling back
BEGIN;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rss_source_statistics;
-- Should succeed, not raise feature_not_supported exception
ROLLBACK;
```

---

## Priority 3: Missing GRANTs on Monitoring Views

**Issue:** Application role can't query monitoring views - permission denied errors at runtime.

**Impact:** Health endpoint and monitoring queries will fail in production.

**File:** `migrations/006_production_validation_and_observability.sql`

**After line:** 314 (end of file)

**Fix:**

```sql
-- Add at end of migration:

-- ============================================================================
-- GRANT PERMISSIONS FOR APPLICATION ROLE
-- ============================================================================

-- Grant SELECT on monitoring views
GRANT SELECT ON v_materialized_view_health TO forecastin;
GRANT SELECT ON v_index_health TO forecastin;
GRANT SELECT ON v_gin_index_health TO forecastin;

-- Grant EXECUTE on alerting function
GRANT EXECUTE ON FUNCTION get_critical_alerts() TO forecastin;

COMMENT ON VIEW v_materialized_view_health IS
'Monitoring view - query with: SELECT * FROM v_materialized_view_health WHERE staleness_status = ''CRITICAL''';
```

**Verification:**

```sql
-- Test as application role
SET ROLE forecastin;
SELECT view_name, overall_health FROM v_materialized_view_health LIMIT 1;
SELECT * FROM get_critical_alerts();
RESET ROLE;
-- Should succeed without permission errors
```

---

## Optional Improvements (Non-Blocking)

### A) Complete Private IP Range Check

**File:** `api/services/validation.py`

**Line:** 230

**Current:** Only checks `172.16.` (missing 172.17-31)

**Better Fix:**

```python
import ipaddress

# Replace lines 224-231 with:
try:
    ip = ipaddress.ip_address(idna_hostname)
    if ip.is_private or ip.is_loopback or ip.is_link_local:
        raise ValidationError("Private/local IP addresses not allowed")
except ValueError:
    # Not an IP, it's a hostname - OK
    pass
```

### B) Integrate Confusables Detection

**File:** `api/services/rss/entity_extraction/extractor.py`

**Add:**

```python
from services.validation import sanitize_entity_name, ValidationError

# In entity extraction loop:
try:
    entity.name = sanitize_entity_name(entity.name)
except ValidationError as e:
    logger.warning(f"Skipping invalid entity: {e}")
    continue
```

### C) Wire MV Health into Health Endpoint

**File:** `api/routers/health.py`

**Add before return statement:**

```python
# Check database health
database_health = {}
try:
    # Assuming db connection available
    alerts = await conn.fetch("SELECT * FROM get_critical_alerts()")
    database_health["critical_alerts"] = len(alerts)
    if alerts:
        overall_status = "degraded"
except Exception as e:
    logger.warning(f"Could not fetch DB health: {e}")

return HealthResponse(
    ...
    database_health=database_health
)
```

---

## Deployment Steps

1. **Apply critical patches 1-3 above**
2. **Re-run tests:**
   ```bash
   python3 -m pytest tests/ -v
   ```
3. **Test in staging:**
   ```bash
   psql $STAGING_DB -f migrations/006_production_validation_and_observability.sql
   psql $STAGING_DB -c "SELECT * FROM get_critical_alerts();"
   ```
4. **Deploy to production during maintenance window**
5. **Verify post-deployment:**
   ```sql
   -- Check advisory locks working
   SELECT * FROM pg_locks WHERE locktype = 'advisory';

   -- Check MV can refresh concurrently
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rss_source_statistics;

   -- Check monitoring accessible
   SELECT * FROM v_materialized_view_health;
   ```

---

## Risk Assessment

**Without fixes:**
- 🔴 Advisory locking broken (race conditions possible)
- 🔴 MV refreshes always block queries (performance issue)
- 🔴 Monitoring views inaccessible (no observability)

**With fixes:**
- ✅ All critical security issues resolved
- ✅ Full observability in place
- ✅ Production-ready

**Estimated fix time:** 30 minutes
**Regression risk:** Low (changes are additive/corrective)
