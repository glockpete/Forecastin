# Schema Mismatch in Hierarchy Resolver (Critical Performance Issue)

**Severity:** P0 - CRITICAL  
**Priority:** Critical  
**Type:** Bug  
**Status:** Open  
**Assignee:** TBD  
**Labels:** `bug`, `critical`, `performance`, `database`, `cache`

## Description

Critical schema mismatch in the hierarchy resolver completely breaks the L4 cache layer, causing 177% performance degradation. SQL queries reference `e.entity_id` column which doesn't exist (correct column is `e.id`), resulting in JOIN failures and degraded performance.

## Impact

- **Performance:** 3.46ms actual vs 1.25ms target (177% over target)
- **Cache Layer:** L4 cache completely broken, L3 queries degraded
- **Query Reliability:** Silent JOIN failures masked by COALESCE operations

## Evidence from Documentation

### Honest Review Critical Finding ([`checks/HONEST_REVIEW.md`](checks/HONEST_REVIEW.md:55-92))
The review identifies this as the most critical issue in the codebase:

**Location:** [`api/navigation_api/database/optimized_hierarchy_resolver.py:510-522`](api/navigation_api/database/optimized_hierarchy_resolver.py:510-522)

**Defect:** SQL queries reference non-existent `e.entity_id` column (correct column is `e.id`)

**Minimal Fix Required:**
```python
# BEFORE (line 510-522):
cur.execute("""
    SELECT 
        e.entity_id,  # ❌ WRONG - column doesn't exist
        e.path,
        e.path_depth,
        e.path_hash,
        e.confidence_score,
        COALESCE(mv.ancestors, ARRAY[]::text[]) as ancestors,
        COALESCE(mv.descendant_count, 0) as descendants
    FROM entities e
    LEFT JOIN mv_entity_ancestors mv ON e.entity_id = mv.entity_id  # ❌ JOIN fails
    WHERE e.entity_id = %s  # ❌ WHERE clause never matches
    LIMIT 1
""", (entity_id,))

# AFTER:
cur.execute("""
    SELECT 
        e.id as entity_id,  # ✅ CORRECT
        e.path,
        e.path_depth,
        e.path_hash,
        e.confidence_score,
        COALESCE(mv.ancestors, ARRAY[]::text[]) as ancestors,
        COALESCE(mv.descendant_count, 0) as descendants
    FROM entities e
    LEFT JOIN mv_entity_ancestors mv ON e.id = mv.entity_id  # ✅ JOIN works
    WHERE e.id = %s  # ✅ WHERE clause matches
    LIMIT 1
""", (entity_id,))
```

### Performance Impact Analysis
- **Target Performance:** <1.25ms ancestor resolution (P95 <1.87ms)
- **Current Performance:** 3.46ms actual (177% degradation)
- **Cache Strategy:** Four-tier caching (L1 Memory → L2 Redis → L3 Database → L4 Materialized Views)

## Root Cause Analysis

### Silent JOIN Failures ([`checks/HONEST_REVIEW.md`](checks/HONEST_REVIEW.md:151-166))
The COALESCE operations mask JOIN failures, making the issue difficult to detect:

```python
# LEFT JOIN succeeds but returns NULLs due to schema mismatch
COALESCE(mv.ancestors, ARRAY[]::text[]) as ancestors  # Masks the failure
```

### Missing Query Validation
No validation method exists to detect schema mismatches in query results.

## Proposed Solution

### Immediate Fix (Critical)
1. **Fix Column References:** Replace `e.entity_id` with `e.id` in all affected queries
2. **Add Query Validation:** Implement validation to detect JOIN failures
3. **Performance Testing:** Verify performance returns to <1.25ms target

### Validation Method
```python
def _validate_query_result(self, row: Dict) -> bool:
    """Validate query results to catch schema mismatches."""
    required_fields = ['entity_id', 'path', 'path_depth', 'path_hash']
    for field in required_fields:
        if field not in row or row[field] is None:
            self.logger.error(f"Query validation failed: missing or NULL field '{field}'")
            return False
    return True
```

## Affected Components

- [`api/navigation_api/database/optimized_hierarchy_resolver.py`](api/navigation_api/database/optimized_hierarchy_resolver.py) - Core resolver
- Materialized view refresh operations
- Cache invalidation logic

## Risk Assessment

### 🟢 LOW RISK (After Fix)
- Simple column reference correction
- No architectural changes required
- Immediate performance improvement

### 🟡 MEDIUM RISK (Current State)  
- Performance degradation affecting user experience
- Cache layer ineffective
- Potential data consistency issues

### 🔴 HIGH RISK (If Unfixed)
- Continued performance degradation
- Cache layer remains broken
- Scaling limitations

## Acceptance Criteria

- [ ] All SQL queries use correct column references (`e.id` instead of `e.entity_id`)
- [ ] Query validation method implemented to detect schema mismatches
- [ ] Performance returns to <1.25ms target (P95 <1.87ms)
- [ ] L4 cache layer functioning correctly
- [ ] No silent JOIN failures

## Estimated Effort

**Small (S) - 1-2 hours** for immediate fix including testing

## Related Documentation

- [`checks/HONEST_REVIEW.md`](checks/HONEST_REVIEW.md) - Comprehensive analysis
- Performance targets and SLO validation requirements
- Four-tier caching architecture documentation

## Additional Context

This issue represents the single most critical performance blocker in the codebase. The sophisticated four-tier caching strategy with RLock thread safety is currently undermined by this simple schema mismatch. Fixing this will immediately restore the platform's performance targets and enable proper cache utilization.