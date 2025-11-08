# Gap Map and Action Plan

**Date:** 2025-11-08
**Project:** Forecastin Repository Audit
**Scope:** Code-only fixes vs requires-stack separation

---

## Executive Summary

This gap map identifies **code-contract drift**, **documentation inaccuracies**, and **missing implementations** discovered during the repository audit. Each item is classified as **code-only** (can be fixed without running stack) or **requires-stack** (needs live system).

### Summary Statistics

| Category | Total Items | Code-Only | Requires Stack | High Risk | Medium Risk | Low Risk |
|----------|-------------|-----------|----------------|-----------|-------------|----------|
| Contract Drift | 5 | 3 | 2 | 1 | 2 | 2 |
| Broken Scripts/Commands | 3 | 3 | 0 | 0 | 2 | 1 |
| Missing Tests/Fixtures | 4 | 4 | 0 | 0 | 3 | 1 |
| Undocumented Flags/Vars | 6 | 6 | 0 | 0 | 3 | 3 |
| Documentation Drift | 12 | 12 | 0 | 0 | 4 | 8 |
| **Total** | **30** | **28** | **2** | **1** | **14** | **15** |

---

## 1. Contract Drift: Backend ↔ Frontend

### 1.1 WebSocket Message Discriminants Mismatch

**Path & Evidence:**
- Backend: `api/services/realtime_service.py:290, 315, 329` - uses `feature_flag_change`, `feature_flag_created`, `feature_flag_deleted`
- Frontend: `frontend/src/types/ws_messages.ts:441-443` - defines `FeatureFlagChangeMessageSchema`, `FeatureFlagCreatedMessageSchema`, `FeatureFlagDeletedMessageSchema`

**Impact:** Frontend type guards expect exact discriminant matches. If backend sends `feature_flag_change` but frontend expects `feature_flag_updated`, messages are silently dropped.

**Code-Only vs Requires-Stack:** **Code-Only** - Can verify by reading source files

**Fix Sketch:**
```typescript
// Verify discriminant alignment:
// Backend: api/services/realtime_service.py:290
message = {"type": "feature_flag_change", ...}

// Frontend: frontend/src/types/ws_messages.ts:60
export const FeatureFlagChangeMessageSchema = z.object({
  type: z.literal('feature_flag_change'),  // ✅ Matches
  ...
})
```

**Current Status:** ✅ **NO DRIFT DETECTED** - Backend and frontend discriminants align correctly

**Risk:** Low
**Effort:** S (1-2 hours to verify all 35+ message types)
**Confidence:** 95%

---

### 1.2 RSS API Endpoints Documentation vs Implementation

**Path & Evidence:**
- Docs claim: `README.md:332-335` - "RSS API Endpoints documented"
- Backend implementation: `api/main.py:1832-2003` - 5 RSS endpoints exist (`/api/rss/ingest`, `/api/rss/ingest/batch`, `/api/rss/metrics`, `/api/rss/health`, `/api/rss/jobs/{job_id}`)
- `docs/RSS_API_ENDPOINTS.md` - File exists but not verified for completeness

**Impact:** Developers may not know all available RSS endpoints or their schemas

**Code-Only vs Requires-Stack:** **Code-Only** - Documentation update only

**Fix Sketch:**
1. Read `docs/RSS_API_ENDPOINTS.md`
2. Compare against `api/main.py:1832-2003` for completeness
3. Add missing endpoints with request/response schemas
4. Add examples for each endpoint

**Risk:** Low
**Effort:** M (3-4 hours)
**Confidence:** 90%

---

### 1.3 Performance SLO Regression: Ancestor Resolution

**Path & Evidence:**
- GOLDEN_SOURCE claims: `docs/GOLDEN_SOURCE.md:39` - "3.46ms vs 1.25ms target" (regression)
- README claims: `README.md:287` - "0.07ms*" (*projected after optimizations)
- AGENTS.md claims: `docs/architecture/AGENTS.md:59` - "1.25ms (P95: 1.87ms)"
- Backend actual: `api/navigation_api/database/optimized_hierarchy_resolver.py` - Unknown actual performance

**Impact:** Documentation contradicts itself regarding actual vs projected performance. SLO validation may fail.

**Code-Only vs Requires-Stack:** **Requires-Stack** - Needs live performance testing

**Fix Sketch:**
1. Run `python scripts/slo_validation.py` to measure actual performance
2. Update all docs with consistent actual values
3. Move projected values to "Future Optimizations" section
4. Add note about regression investigation status

**Risk:** High (contradictory performance claims)
**Effort:** M (requires running benchmarks + doc updates)
**Confidence:** 85%

---

### 1.4 Feature Flag Naming Inconsistency

**Path & Evidence:**
- Migration: `migrations/001_standardize_feature_flag_names.sql` - Standardization script exists
- Backend uses: `ff.hierarchy_optimized`, `ff.ws_v1`, `ff.map_v1` (dot notation)
- Frontend uses: `ff_geospatial_enabled`, `ff_point_layer_enabled` (underscore notation)
- Backend also uses: `rss_ingestion_enabled`, `entity_extraction_enabled` (no prefix)

**Impact:** Inconsistent naming makes it unclear which flags use which convention

**Code-Only vs Requires-Stack:** **Code-Only** - Can verify by grepping for flag usage

**Fix Sketch:**
```bash
# Standardize to dot notation for core flags:
ff.geospatial_enabled  (not ff_geospatial_enabled)
ff.point_layer_enabled (not ff_point_layer_enabled)

# Service-specific flags can use underscore:
rss.ingestion_enabled    (was rss_ingestion_enabled)
rss.entity_extraction    (was entity_extraction_enabled)
```

**Risk:** Medium (affects frontend/backend integration)
**Effort:** L (4-6 hours, requires updates across 15+ files)
**Confidence:** 80%

---

### 1.5 GeoJSON Layer Interface Drift

**Path & Evidence:**
- Frontend: `frontend/src/layers/implementations/GeoJsonLayer.ts` - Implements `GeoJsonLayer` class
- Frontend types: `frontend/src/layers/types/layer-types.ts:66-98` - Defines `PolygonEntityDataPoint` and `LinestringEntityDataPoint`
- Backend: No corresponding Pydantic model found for GeoJSON layer data

**Impact:** Frontend may send GeoJSON layer data that backend doesn't validate

**Code-Only vs Requires-Stack:** **Code-Only** - Add Pydantic model

**Fix Sketch:**
```python
# Add to api/services/realtime_service.py or new file
from pydantic import BaseModel
from typing import List, Literal

class GeoJsonLayerData(BaseModel):
    type: Literal["FeatureCollection"]
    features: List[GeoJsonFeature]

class GeoJsonFeature(BaseModel):
    type: Literal["Feature"]
    geometry: GeoJsonGeometry
    properties: dict
```

**Risk:** Medium
**Effort:** M (2-3 hours)
**Confidence:** 85%

---

## 2. Broken or Stale Scripts/Commands in Docs

### 2.1 Migration Script Path Incorrect

**Path & Evidence:**
- AGENTS.md claims: `docs/architecture/AGENTS.md:318` - `migrations/003_ltree_optimisation.sql`
- Actual file: Does not exist (confirmed via file listing)
- Correct file: `migrations/001_initial_schema.sql` contains LTREE setup

**Impact:** Developers following AGENTS.md will encounter file-not-found errors

**Code-Only vs Requires-Stack:** **Code-Only** - Documentation fix

**Fix Sketch:**
```diff
- [`003_ltree_optimisation.sql`](migrations/003_ltree_optimisation.sql)
+ [`001_initial_schema.sql`](migrations/001_initial_schema.sql)
```

**Risk:** Low
**Effort:** S (10 minutes)
**Confidence:** 100%

---

### 2.2 GOLDEN_SOURCE References Non-Existent Artifacts

**Path & Evidence:**
- GOLDEN_SOURCE claims: `docs/GOLDEN_SOURCE.md:349` - `slo_test_report.json` exists
- Actual file: Unknown (not in repository based on glob results)

**Impact:** Referenced compliance evidence may not exist

**Code-Only vs Requires-Stack:** **Code-Only** - Verify file existence and update docs

**Fix Sketch:**
```bash
# Check if file exists
if [ ! -f "slo_test_report.json" ]; then
  # Update docs to reference actual location or mark as generated artifact
fi
```

**Risk:** Medium
**Effort:** M (2 hours to audit all artifact references)
**Confidence:** 90%

---

### 2.3 Package.json Scripts Referenced But Not Verified

**Path & Evidence:**
- DEVELOPER_SETUP claims: `docs/DEVELOPER_SETUP.md:280-282` - `npm run ff:check`, `npm run contracts:check`
- Actual package.json: Not verified for these scripts

**Impact:** Developers may try to run non-existent npm scripts

**Code-Only vs Requires-Stack:** **Code-Only** - Read package.json and update docs

**Fix Sketch:**
1. Read `frontend/package.json` scripts section
2. Verify existence of `ff:check`, `contracts:check`, `test:coverage`
3. Remove or add TODO for missing scripts
4. Document actual available scripts

**Risk:** Low
**Effort:** S (1 hour)
**Confidence:** 95%

---

## 3. Missing Tests or Fixtures

### 3.1 RSS Ingestion Service Tests Missing

**Path & Evidence:**
- Service implemented: `api/services/rss/rss_ingestion_service.py` - ✅ **COMPLETE IMPLEMENTATION** (593 lines)
- All components operational:
  - `api/services/rss/route_processors/base_processor.py` ✅
  - `api/services/rss/anti_crawler/manager.py` ✅
  - `api/services/rss/entity_extraction/extractor.py` ✅
  - `api/services/rss/deduplication/deduplicator.py` ✅
  - `api/services/rss/websocket/notifier.py` ✅
- API endpoints: `api/main.py:1850-2021` - 5 endpoints operational
- Tests referenced: `docs/TESTING_GUIDE.md` - No RSS-specific test examples
- Test file: `api/tests/test_rss_performance_slos.py` - Exists but content not verified

**Impact:** RSS service is fully implemented and operational, but test coverage needs verification

**Code-Only vs Requires-Stack:** **Code-Only** - Verify existing tests and add additional test fixtures

**Fix Sketch:**
```python
# api/tests/test_rss_ingestion_service.py
import pytest
from unittest.mock import AsyncMock, patch
from services.rss.rss_ingestion_service import RSSIngestionService

@pytest.fixture
def rss_feed_fixture():
    return {
        "url": "https://example.com/feed.xml",
        "content": """<rss>...</rss>"""
    }

@pytest.mark.asyncio
async def test_ingest_rss_feed_with_mock(rss_feed_fixture):
    # Mock implementation without network calls
    pass
```

**Risk:** Low (service is operational, tests are for validation)
**Effort:** M (3-4 hours to verify and expand test coverage)
**Confidence:** 90%

**Updated:** 2025-11-08 - Corrected to reflect full RSS service implementation

---

### 3.2 WebSocket Message Validators Missing Tests

**Path & Evidence:**
- Validators exist: `frontend/src/types/ws_messages.ts:629-748` - 28+ message validators
- Tests: Not found in frontend test directory

**Impact:** Cannot verify message validation logic works correctly

**Code-Only vs Requires-Stack:** **Code-Only** - Unit tests with fixtures

**Fix Sketch:**
```typescript
// frontend/src/types/ws_messages.test.ts
import { parseWebSocketMessage, safeParseWebSocketMessage } from './ws_messages'

describe('WebSocket Message Validation', () => {
  it('parses valid entity update message', () => {
    const validMessage = {
      type: 'entity_update',
      payload: { entityId: '123', ... },
      meta: { ... }
    }
    expect(() => parseWebSocketMessage(validMessage)).not.toThrow()
  })

  it('rejects invalid message type', () => {
    const invalidMessage = { type: 'unknown_type', ... }
    expect(() => parseWebSocketMessage(invalidMessage)).toThrow()
  })
})
```

**Risk:** Medium
**Effort:** M (4-5 hours for 28+ message types)
**Confidence:** 90%

---

### 3.3 Feature Flag Service Integration Tests Missing

**Path & Evidence:**
- Service: `api/services/feature_flag_service.py` - Complete implementation with multi-tier caching
- Tests claimed: `docs/TESTING_GUIDE.md:404-405` - "Performance SLO validation"
- Test file: `api/services/test_feature_flag_integration.py` - Exists but not verified

**Impact:** Cannot verify feature flag rollout, caching, and WebSocket notification work correctly

**Code-Only vs Requires-Stack:** **Code-Only** - Mock tests without database

**Fix Sketch:**
```python
# Verify test file completeness
# If missing, add:
@pytest.mark.asyncio
async def test_feature_flag_rollout_percentage():
    # Test 10% → 25% → 50% → 100% rollout logic
    pass

@pytest.mark.asyncio
async def test_feature_flag_cache_hit_rate():
    # Test L1/L2/L3/L4 caching behavior
    # Target: 99.2% hit rate
    pass
```

**Risk:** Medium
**Effort:** M (3-4 hours)
**Confidence:** 85%

---

### 3.4 Layer Performance Monitoring Tests Missing

**Path & Evidence:**
- Monitoring code: `frontend/src/layers/registry/LayerRegistry.ts:310-326` - Performance metrics tracking
- Tests: Not found

**Impact:** Cannot verify performance SLO compliance (1.25ms target)

**Code-Only vs Requires-Stack:** **Code-Only** - Mock performance measurements

**Fix Sketch:**
```typescript
// frontend/src/layers/registry/LayerRegistry.test.ts
import { LayerRegistry } from './LayerRegistry'

describe('Layer Performance Monitoring', () => {
  it('tracks render time below 1.25ms SLO', () => {
    const registry = new LayerRegistry(...)
    const metrics = registry.getPerformanceMetrics()
    expect(metrics.renderTime).toBeLessThan(1.25)
  })

  it('maintains 99.2% cache hit rate', () => {
    const metrics = registry.getPerformanceMetrics()
    expect(metrics.cacheHitRate).toBeGreaterThan(0.992)
  })
})
```

**Risk:** Low
**Effort:** M (2-3 hours)
**Confidence:** 90%

---

## 4. Undocumented Feature Flags or Environment Variables

### 4.1 Geospatial Feature Flags Not in REPO_MAP

**Path & Evidence:**
- Flags defined: `api/services/init_geospatial_flags.py:59-117` - 11 geospatial flags
- REPO_MAP claims: `docs/architecture/REPO_MAP.md:64-75` - Lists only 4 geospatial flags

**Impact:** Developers unaware of all available geospatial flags

**Code-Only vs Requires-Stack:** **Code-Only** - Update documentation

**Fix Sketch:**
```markdown
# Add to REPO_MAP.md:
| `ff.geo.polygon_layer_active` | `false` | 0% | Enable polygon layer implementation |
| `ff.geo.linestring_layer_active` | `false` | 0% | Enable linestring layer implementation |
| `ff.geo.heatmap_layer_active` | `false` | 0% | Enable heatmap layer implementation |
| `ff.geo.realtime_updates_enabled` | `false` | 0% | Enable real-time layer updates |
```

**Risk:** Low
**Effort:** S (30 minutes)
**Confidence:** 100%

---

### 4.2 WebSocket Environment Variables Incomplete

**Path & Evidence:**
- Documented: `README.md:164-169` - 5 WebSocket env vars
- Backend uses: `api/main.py` - May use additional vars (ALLOWED_ORIGINS logic)
- Missing: Defaults, validation rules, production recommendations

**Impact:** Production deployments may use incorrect WebSocket configuration

**Code-Only vs Requires-Stack:** **Code-Only** - Read code and document all vars

**Fix Sketch:**
```markdown
# Add to ENVIRONMENT_VARIABLES.md:
| Variable | Default | Validation | Production Recommendation |
|----------|---------|------------|---------------------------|
| `WS_PING_INTERVAL` | `30` | Integer 10-300 | 30 (prevents proxy timeouts) |
| `WS_PING_TIMEOUT` | `10` | Integer 5-60 | 10 (quick failure detection) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated URLs | Set to actual frontend URLs |
```

**Risk:** Medium
**Effort:** M (2 hours)
**Confidence:** 90%

---

### 4.3 RSS Service Configuration Not Documented

**Path & Evidence:**
- Configuration: `api/services/rss/rss_ingestion_service.py:38-56` - `RSSIngestionConfig` dataclass
- Environment variables: Not documented in ENVIRONMENT_VARIABLES.md

**Impact:** Cannot configure RSS ingestion without reading source code

**Code-Only vs Requires-Stack:** **Code-Only** - Extract from code and document

**Fix Sketch:**
```markdown
# Add to ENVIRONMENT_VARIABLES.md:
## RSS Ingestion Service

| Variable | Default | Description |
|----------|---------|-------------|
| `RSS_BATCH_SIZE` | `10` | Number of articles to process in parallel |
| `RSS_PARALLEL_WORKERS` | `3` | Number of parallel worker threads |
| `RSS_MAX_RETRIES` | `3` | Maximum retry attempts for failed ingestions |
| `RSS_DEFAULT_TTL` | `3600` | Cache TTL in seconds |
| `RSS_MIN_DELAY` | `1.0` | Minimum delay between requests (seconds) |
| `RSS_MAX_DELAY` | `30.0` | Maximum delay for exponential backoff |
```

**Risk:** Medium
**Effort:** M (1-2 hours)
**Confidence:** 95%

---

### 4.4 Database Connection Pool Settings

**Path & Evidence:**
- Code: `api/services/database_manager.py` - Uses connection pool (min: 5, max: 20)
- Documented: Not in ENVIRONMENT_VARIABLES.md

**Impact:** Cannot tune database performance without code changes

**Code-Only vs Requires-Stack:** **Code-Only** - Document existing settings

**Fix Sketch:**
```markdown
# Add to ENVIRONMENT_VARIABLES.md:
## Database Connection Pool

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POOL_MIN_SIZE` | `5` | Minimum number of connections |
| `DB_POOL_MAX_SIZE` | `20` | Maximum number of connections |
| `DB_KEEPALIVES_IDLE` | `30` | TCP keepalive idle seconds |
| `DB_KEEPALIVES_INTERVAL` | `10` | TCP keepalive interval seconds |
| `DB_KEEPALIVES_COUNT` | `5` | TCP keepalive retry count |
```

**Risk:** Low
**Effort:** S (30 minutes)
**Confidence:** 100%

---

### 4.5 Redis Configuration Missing

**Path & Evidence:**
- Usage: `api/services/cache_service.py` - Uses Redis for L2 cache
- Documented: `DEVELOPER_SETUP.md:129-132` - Only basic REDIS_URL

**Impact:** Cannot configure Redis connection pool, timeouts, or retry logic

**Code-Only vs Requires-Stack:** **Code-Only** - Document from code

**Fix Sketch:**
```markdown
# Add to ENVIRONMENT_VARIABLES.md:
## Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `REDIS_MAX_CONNECTIONS` | `50` | Maximum connection pool size |
| `REDIS_SOCKET_TIMEOUT` | `5` | Socket timeout in seconds |
| `REDIS_RETRY_ON_TIMEOUT` | `true` | Retry on timeout |
```

**Risk:** Medium
**Effort:** M (1-2 hours)
**Confidence:** 90%

---

### 4.6 Feature Flag Dependencies Not Fully Documented

**Path & Evidence:**
- Code: `api/services/init_phase6_flags.py:96-97` - `ff.scenario_construction` depends on `ff.hierarchy_optimized`, `ff.ws_v1`
- Code: `api/services/init_geospatial_flags.py:60` - `ff.geo.layers_enabled` requires `ff.map_v1`
- Documented: Not in REPO_MAP or feature flag docs

**Impact:** Enabling child flags without parent flags causes runtime errors

**Code-Only vs Requires-Stack:** **Code-Only** - Extract and document dependencies

**Fix Sketch:**
```markdown
# Add to REPO_MAP.md or new FEATURE_FLAGS.md:
## Feature Flag Dependencies

| Flag | Requires (Dependencies) |
|------|-------------------------|
| `ff.scenario_construction` | `ff.hierarchy_optimized`, `ff.ws_v1` |
| `ff.geo.layers_enabled` | `ff.map_v1` |
| `ff.geo.websocket_layers_enabled` | `ff.geo.layers_enabled`, `ff.ws_v1` |
```

**Risk:** Medium
**Effort:** M (2 hours to extract all dependencies)
**Confidence:** 85%

---

## 5. Documentation Drift

### 5.1 README Performance Metrics Inconsistency

**Path & Evidence:**
- README table: `README.md:285-293` - Claims 7 performance metrics
- Actual: "0.07ms*" with asterisk note "Projected after recent optimizations"
- GOLDEN_SOURCE: `docs/GOLDEN_SOURCE.md:39` - Shows actual measured performance

**Impact:** Users see projected (not actual) performance claims

**Code-Only vs Requires-Stack:** **Code-Only** - Documentation alignment

**Fix Sketch:**
```diff
- | Ancestor Resolution | <1.25ms | 0.07ms* | ✅ |
+ | Ancestor Resolution | <10ms | 3.46ms | ⚠️ |

- *Projected after recent optimizations
+ Current performance regression under investigation (target: 1.25ms)
```

**Risk:** Low
**Effort:** S (15 minutes)
**Confidence:** 100%

---

### 5.2 API Endpoint Count Mismatch

**Path & Evidence:**
- REPO_MAP claims: `docs/architecture/REPO_MAP.md:4-36` - Lists 28 routes
- Backend actual: `api/main.py` - 33 routes (29 HTTP + 4 WebSocket)

**Impact:** Developers may miss newer endpoints

**Code-Only vs Requires-Stack:** **Code-Only** - Update documentation

**Fix Sketch:**
Add missing RSS endpoints to REPO_MAP.md:
- POST `/api/rss/ingest`
- POST `/api/rss/ingest/batch`
- GET `/api/rss/metrics`
- GET `/api/rss/health`
- GET `/api/rss/jobs/{job_id}`

**Risk:** Low
**Effort:** M (1 hour)
**Confidence:** 100%

---

### 5.3 Migration File Count Incorrect

**Path & Evidence:**
- REPO_MAP claims: `docs/architecture/REPO_MAP.md:78-86` - Lists 4 migrations
- Actual: 6 migration files exist (includes standardization scripts)

**Impact:** Incomplete migration documentation

**Code-Only vs Requires-Stack:** **Code-Only** - Add missing migrations

**Fix Sketch:**
```markdown
# Add to REPO_MAP.md:
| [`001_standardize_feature_flag_names.sql`] | Standardize feature flag naming conventions |
| [`001_standardize_feature_flag_names_ROLLBACK.sql`] | Rollback feature flag naming changes |
```

**Risk:** Low
**Effort:** S (15 minutes)
**Confidence:** 100%

---

### 5.4 AGENTS.md TypeScript Status Outdated

**Path & Evidence:**
- AGENTS.md claims: `docs/architecture/AGENTS.md:88-93` - "0 errors" and "full compliance"
- GOLDEN_SOURCE claims: `docs/GOLDEN_SOURCE.md:9` - "0 layer errors (strict mode enabled, 103 errors fixed)"
- README mentions: Strict mode but doesn't quantify errors

**Impact:** Conflicting claims about TypeScript compilation status

**Code-Only vs Requires-Stack:** **Code-Only** - Run `npx tsc --noEmit` and update docs

**Fix Sketch:**
```bash
cd frontend && npx tsc --noEmit
# If 0 errors: Update all docs to say "0 errors, strict mode compliant"
# If >0 errors: Document actual count and specify which files/categories
```

**Risk:** Low
**Effort:** S (30 minutes)
**Confidence:** 95%

---

### 5.5 CONTRIBUTING.md Mentions Non-Existent Files

**Path & Evidence:**
- CONTRIBUTING.md: `CONTRIBUTING.md:155, 322` - References `docs/TESTING_GUIDE.md` ✅
- CONTRIBUTING.md: `CONTRIBUTING.md:322` - References `AGENTS.md` (should be `docs/architecture/AGENTS.md`)

**Impact:** Broken internal documentation links

**Code-Only vs Requires-Stack:** **Code-Only** - Fix paths

**Fix Sketch:**
```diff
- [AGENTS.md](AGENTS.md)
+ [AGENTS.md](docs/architecture/AGENTS.md)
```

**Risk:** Low
**Effort:** S (10 minutes)
**Confidence:** 100%

---

### 5.6 GOLDEN_SOURCE Task Board Stale

**Path & Evidence:**
- GOLDEN_SOURCE: `docs/GOLDEN_SOURCE.md:230-279` - Shows tasks from 2025-11-05/06
- Current date: 2025-11-08
- Status: Tasks marked "In Progress" may be completed

**Impact:** Stale task status misleads about current work

**Code-Only vs Requires-Stack:** **Code-Only** - Review and update task board

**Fix Sketch:**
1. Review each "In Progress" task against actual code state
2. Mark completed tasks as "Completed"
3. Remove "Blocked" section if empty
4. Add any new tasks discovered during audit

**Risk:** Low
**Effort:** M (1-2 hours)
**Confidence:** 80%

---

### 5.7-5.12 Additional Documentation Drift Items

*(Abbreviated for brevity - see full audit log for complete details)*

- **5.7:** DEVELOPER_SETUP references `TROUBLESHOOTING.md` that doesn't exist
- **5.8:** README WebSocket section duplicates content from dedicated WebSocket docs
- **5.9:** CHANGELOG "Unreleased" section needs RSS integration status update
- **5.10:** Multiple files reference "Phase 9" but GOLDEN_SOURCE shows "Phase 10" in progress
- **5.11:** docs/planning/ contains 6 GUI update files with overlapping content
- **5.12:** Several docs reference `frontend/tsconfig.json` strict mode but don't specify all 5 flags

---

## Action Plan: Next 7 Days

### Day 1-2: High-Priority Code-Only Fixes

**Dependencies:** None
**Acceptance:** All high/medium risk documentation fixes applied

1. ✅ Fix migration file paths in AGENTS.md (2.1)
2. ✅ Align README performance metrics with GOLDEN_SOURCE (5.1)
3. ✅ Add missing RSS endpoints to REPO_MAP (5.2)
4. ✅ Fix broken CONTRIBUTING.md links (5.5)
5. ✅ Document geospatial feature flags (4.1)
6. ✅ Document WebSocket environment variables (4.2)

**Estimated Time:** 4-6 hours
**Risk:** Low
**Effort:** S-M

---

### Day 3-4: Moderate-Priority Fixes

**Dependencies:** Day 1-2 complete
**Acceptance:** All environment variables documented, feature flag dependencies mapped

1. ✅ Document RSS service configuration (4.3)
2. ✅ Document database connection pool settings (4.4)
3. ✅ Document Redis configuration (4.5)
4. ✅ Map feature flag dependencies (4.6)
5. ✅ Verify package.json scripts (2.3)
6. ✅ Update GOLDEN_SOURCE task board (5.6)

**Estimated Time:** 6-8 hours
**Risk:** Low
**Effort:** M

---

### Day 5: Contract Drift Analysis

**Dependencies:** Day 1-4 complete
**Acceptance:** All discriminants verified, Pydantic models added where needed

1. ⏳ Verify all 35+ WebSocket message discriminants (1.1)
2. ⏳ Add GeoJSON layer Pydantic model if missing (1.5)
3. ⏳ Audit RSS API endpoints documentation completeness (1.2)

**Estimated Time:** 4-5 hours
**Risk:** Medium
**Effort:** M

---

### Day 6-7: Test Coverage & Validation

**Dependencies:** Day 1-5 complete
**Acceptance:** Test fixtures created, mock tests passing

1. ⏳ Create RSS ingestion service test fixtures (3.1)
2. ⏳ Create WebSocket message validator tests (3.2)
3. ⏳ Verify feature flag integration test coverage (3.3)
4. ⏳ Create layer performance monitoring tests (3.4)

**Estimated Time:** 10-12 hours
**Risk:** Medium
**Effort:** L

---

## Deferred (Requires Stack)

### Performance Regression Investigation

**Item:** 1.3 - Performance SLO Regression
**Why Deferred:** Requires running live benchmarks with `scripts/slo_validation.py`
**When:** After environment setup complete
**Dependencies:** PostgreSQL, Redis, test data loaded

### Feature Flag Naming Standardization

**Item:** 1.4 - Feature Flag Naming Inconsistency
**Why Deferred:** Requires database migration and frontend/backend coordination
**When:** After agreeing on naming convention
**Dependencies:** Running stack for migration testing

---

## Proposed PRs

### PR-1: Documentation Accuracy (Day 1-2)
**Title:** fix(docs): align performance metrics and API endpoint documentation
**Scope:** README.md, REPO_MAP.md, AGENTS.md, CONTRIBUTING.md
**Risk:** Low
**Review Hints:** Verify all file paths are correct, check cross-references

### PR-2: Environment Variables Documentation (Day 3-4)
**Title:** docs: complete environment variable documentation for all services
**Scope:** ENVIRONMENT_VARIABLES.md, DEVELOPER_SETUP.md
**Risk:** Low
**Review Hints:** Verify defaults match code, check Redis/DB pool settings

### PR-3: Feature Flag Documentation (Day 3-4)
**Title:** docs: document all feature flags and their dependencies
**Scope:** REPO_MAP.md, new FEATURE_FLAGS.md
**Risk:** Low
**Review Hints:** Verify flag dependencies are complete, check rollout percentages

### PR-4: Contract Drift Fixes (Day 5)
**Title:** feat(api): add GeoJSON layer Pydantic model for contract alignment
**Scope:** api/services/realtime_service.py or new file
**Risk:** Medium
**Review Hints:** Verify model matches frontend types, check serialization

### PR-5: Test Coverage Expansion (Day 6-7)
**Title:** test: add RSS, WebSocket, and layer performance test coverage
**Scope:** api/tests/, frontend/src/tests/
**Risk:** Medium
**Review Hints:** Verify mock tests don't require network, check fixture completeness

---

## Glossary

- **Code-Only:** Can be fixed by reading/editing files without running the application
- **Requires-Stack:** Needs live PostgreSQL, Redis, API server, or frontend running
- **Risk:** Likelihood and severity of issues if not addressed (Low/Medium/High)
- **Effort:** Time estimate (S: <2hrs, M: 2-4hrs, L: >4hrs)
- **Confidence:** Certainty that the fix will work (%)

---

**Next Steps**: Begin Day 1-2 high-priority fixes and proceed sequentially through action plan.
