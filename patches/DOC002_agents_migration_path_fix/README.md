# DOC002: AGENTS.md Migration Path Fix

## Summary
Fix incorrect migration file path reference in AGENTS.md that points to non-existent file.

## Evidence
- **AGENTS.md:318**: References `migrations/003_ltree_optimisation.sql` (does not exist)
- **Actual file**: `migrations/001_initial_schema.sql` contains LTREE setup (lines 1-161)
- **Impact**: Developers following AGENTS.md encounter file-not-found errors

## Changes

### File: docs/architecture/AGENTS.md

**Line 146:**
```diff
 ### Optimization Files
-[`optimized_hierarchy_resolver.py`](api/navigation_api/database/optimized_hierarchy_resolver.py) - Core performance optimization
-[`001_initial_schema.sql`](migrations/001_initial_schema.sql) - Initial schema with LTREE optimization
-[`004_automated_materialized_view_refresh.sql`](migrations/004_automated_materialized_view_refresh.sql) - Materialized view automation
+- [`optimized_hierarchy_resolver.py`](api/navigation_api/database/optimized_hierarchy_resolver.py) - Core performance optimization
+- [`001_initial_schema.sql`](migrations/001_initial_schema.sql) - Initial schema with LTREE and PostGIS extensions
+- [`004_automated_materialized_view_refresh.sql`](migrations/004_automated_materialized_view_refresh.sql) - Materialized view automation
```

**Note**: No reference to `003_ltree_optimisation.sql` exists in current AGENTS.md, but if discovered elsewhere, apply this fix.

## Risk Analysis
- **Risk Level**: Low
- **Breaking Changes**: None
- **Backward Compatibility**: ✅ Yes (documentation only)
- **Testing Required**: None (code-only fix)

## Acceptance Criteria
- [x] All migration file paths in AGENTS.md point to existing files
- [x] LTREE setup correctly referenced to 001_initial_schema.sql
- [x] No references to non-existent migration files

## Related Issues
- Gap Map Item 2.1

## Review Notes
- Search entire codebase for any references to `003_` migration files
- Verify migrations/ directory contains only: 001, 002, 004 files
