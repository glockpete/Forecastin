# Contracts Ledger - Cross-Boundary Interface Catalog

**Purpose:** Single source of truth for all cross-boundary contracts in Forecastin
**Last Updated:** 2025-11-08 (Asia/Tokyo)
**Owner:** Architecture Team
**Status:** Phase 1 — Initial catalog created, requires Phase 3 contract generation

---

## Overview

This ledger catalogs all contracts and interfaces that cross system boundaries. Any change to these contracts requires:
1. Regenerating affected contract artifacts
2. Updating both sides of the boundary (backend + frontend)
3. Adding runtime guards (Zod validators, Pydantic validators)
4. Updating contract tests
5. PR review from both backend and frontend teams (per CODEOWNERS)

---

## Contract Categories

### 1. REST API Schemas (Backend → Frontend)

**Source:** FastAPI route definitions in `api/routers/*.py`
**Generated Artifact:** `contracts/openapi.json` (Phase 3)
**Frontend Types:** `frontend/src/types/api.generated.ts` (Phase 3)
**Validation:** Backend uses Pydantic models, Frontend should use Zod

#### Current Endpoints

| Endpoint | Method | Request Schema | Response Schema | Status |
|----------|--------|----------------|-----------------|--------|
| `/health` | GET | - | `HealthCheck` | ✅ Implemented |
| `/api/entities` | GET | Query params | `Entity[]` | ✅ Implemented |
| `/api/entities/{entity_id}/hierarchy` | GET | Path param | `HierarchyNode` | ✅ Implemented |
| `/api/entities/refresh` | POST | - | `RefreshStatus` | ✅ Implemented |
| `/api/entities/refresh/status` | GET | - | `RefreshMetrics` | ✅ Implemented |
| `/api/entities/refresh/automated/start` | POST | - | `RefreshStatus` | ✅ Implemented |
| `/api/entities/refresh/automated/stop` | POST | - | `RefreshStatus` | ✅ Implemented |
| `/api/entities/refresh/automated/force` | POST | - | `RefreshStatus` | ✅ Implemented |
| `/api/entities/refresh/automated/metrics` | GET | - | `AutomatedMetrics` | ✅ Implemented |
| `/api/feature-flags` | GET | - | `FeatureFlag[]` | ✅ Implemented |
| `/api/feature-flags` | POST | `FeatureFlagCreate` | `FeatureFlag` | ✅ Implemented |
| `/api/feature-flags/{flag_name}` | GET | Path param | `FeatureFlag` | ✅ Implemented |
| `/api/feature-flags/{flag_name}` | PUT | `FeatureFlagUpdate` | `FeatureFlag` | ✅ Implemented |
| `/api/feature-flags/{flag_name}` | DELETE | Path param | `DeleteResponse` | ✅ Implemented |
| `/api/feature-flags/{flag_name}/enabled` | GET | Path param | `EnabledResponse` | ✅ Implemented |
| `/api/feature-flags/metrics` | GET | - | `FeatureFlagMetrics` | ✅ Implemented |
| `/api/feature-flags/metrics/cache` | GET | - | `CacheMetrics` | ✅ Implemented |
| `/api/scenarios` | GET | Query params | `Scenario[]` | ✅ Implemented |
| `/api/scenarios` | POST | `ScenarioCreate` | `Scenario` | ✅ Implemented |
| `/api/scenarios/{scenario_id}` | GET | Path param | `Scenario` | ✅ Implemented |
| `/api/scenarios/{scenario_id}` | PUT | `ScenarioUpdate` | `Scenario` | ✅ Implemented |
| `/api/scenarios/{scenario_id}` | DELETE | Path param | `DeleteResponse` | ✅ Implemented |
| `/api/rss/ingest` | POST | `FeedIngestRequest` | `IngestResponse` | ✅ Implemented |
| `/api/rss/ingest/batch` | POST | `BatchIngestRequest` | `BatchIngestResponse` | ✅ Implemented |
| `/api/rss/metrics` | GET | - | `RSSMetrics` | ✅ Implemented |
| `/api/rss/health` | GET | - | `RSSHealthStatus` | ✅ Implemented |
| `/api/rss/jobs/{job_id}` | GET | Path param | `JobStatus` | ✅ Implemented |

**Schema Definitions Location:** `api/models/*.py`

**Key Pydantic Models:**
- `api/models/websocket_schemas.py` — WebSocket message schemas
- `api/models/serializers.py` — Entity serialization

**Action Items (Phase 3):**
- [ ] Generate `contracts/openapi.json` from FastAPI app
- [ ] Create TypeScript types generator script
- [ ] Add runtime Zod validators for frontend
- [ ] Add contract tests validating request/response formats

---

### 2. WebSocket Events (Backend ↔ Frontend)

**Source:** `api/models/websocket_schemas.py` and `api/routers/websocket.py`
**Generated Artifact:** `contracts/ws.json` (Phase 3)
**Frontend Types:** `frontend/src/types/ws.generated.ts` (Phase 3)
**Protocol:** JSON over WebSocket, serialized with `orjson`

#### Server → Client Events

| Event Type | Payload Schema | Trigger | Status |
|------------|----------------|---------|--------|
| `entity_update` | `EntityUpdateMessage` | Entity CRUD operations | ✅ Implemented |
| `hierarchy_refresh` | `HierarchyRefreshMessage` | Materialized view refresh | ✅ Implemented |
| `layer_data_update` | `LayerDataUpdateMessage` | Geospatial layer changes | ✅ Implemented |
| `gpu_filter_sync` | `GPUFilterSyncMessage` | GPU filter updates | ✅ Implemented |
| `feature_flag_update` | `FeatureFlagUpdateMessage` | Feature flag changes | ✅ Implemented |
| `rss_ingest_complete` | `RSSIngestCompleteMessage` | RSS ingestion finished | ✅ Implemented |
| `rss_entity_extracted` | `RSSEntityExtractedMessage` | New entity from RSS | ✅ Implemented |
| `health_check` | `HealthCheckMessage` | WebSocket health ping | ✅ Implemented |

#### Client → Server Events

| Event Type | Payload Schema | Purpose | Status |
|------------|----------------|---------|--------|
| `subscribe` | `SubscribeMessage` | Subscribe to specific channels | 🟡 Partial |
| `unsubscribe` | `UnsubscribeMessage` | Unsubscribe from channels | 🟡 Partial |
| `ping` | `PingMessage` | Keepalive ping | ✅ Implemented |

**Message Schema Location:** `api/models/websocket_schemas.py`

**Frontend Integration:** `frontend/src/ws/WebSocketManager.tsx`

**Key Schemas:**
```python
# api/models/websocket_schemas.py
class LayerDataUpdateMessage(BaseModel):
    type: Literal["layer_data_update"]
    layer_id: str
    layer_type: str
    bbox: tuple[float, float, float, float]
    changed_at: str

class GPUFilterSyncMessage(BaseModel):
    type: Literal["gpu_filter_sync"]
    layer_id: str
    filter_id: str
    changed_at: str

class FeatureFlagUpdateMessage(BaseModel):
    type: Literal["feature_flag_update"]
    flag_name: str
    enabled: bool
    rollout_percentage: int
    changed_at: str
```

**Action Items (Phase 3):**
- [ ] Generate `contracts/ws.json` from Pydantic schemas
- [ ] Create TypeScript type generator for WS messages
- [ ] Add Zod validators for incoming WS messages on frontend
- [ ] Add contract tests for all message types

---

### 3. Cache Keys (Backend Internal + Redis)

**Source:** `api/services/cache_service.py`
**Type:** String keys with structured namespace
**Store:** Redis + in-memory L1 cache

#### Cache Key Patterns

| Pattern | Example | Tier | TTL | Status |
|---------|---------|------|-----|--------|
| `entity:{id}` | `entity:123` | L1, L2 | 5 min | ✅ Implemented |
| `hierarchy:{id}:ancestors` | `hierarchy:456:ancestors` | L1, L2, L4 | 10 min | ✅ Implemented |
| `hierarchy:{id}:descendants` | `hierarchy:456:descendants` | L1, L2, L4 | 10 min | ✅ Implemented |
| `feature_flag:{name}` | `feature_flag:geo_layers` | L1, L2 | 1 min | ✅ Implemented |
| `rss:feed:{url_hash}` | `rss:feed:abc123` | L2 | 1 hour | ✅ Implemented |
| `rss:content:{content_hash}` | `rss:content:def456` | L2 | 24 hours | ✅ Implemented |
| `geo:layer:{layer_id}` | `geo:layer:points_v1` | L1, L2 | 5 min | ✅ Implemented |

**Cache Tiers:**
- **L1:** In-memory Python dict (thread-safe with RLock)
- **L2:** Redis
- **L3:** PostgreSQL direct queries
- **L4:** Materialized views

**Cache Invalidation:**
- Entity changes → Invalidate `entity:{id}` and related hierarchy keys
- Feature flag changes → Broadcast via WebSocket + invalidate all `feature_flag:*`
- RSS ingestion → Invalidate `rss:feed:*` and entity caches

**Action Items:**
- [x] Document cache key patterns (done above)
- [ ] Add cache key validator to prevent typos
- [ ] Monitor cache hit rates per key pattern
- [ ] Document cache invalidation strategy in runbooks

---

### 4. Feature Flags (Config → Runtime)

**Source:** Database `feature_flags` table + `api/services/feature_flag_service.py`
**Frontend:** `frontend/src/config/feature-flags.ts` and `frontend/src/hooks/useFeatureFlag.ts`
**Type:** Boolean flags with rollout percentage

#### Active Feature Flags

| Flag Name | Type | Default | Current % | Backend | Frontend | Status |
|-----------|------|---------|-----------|---------|----------|--------|
| `FF_MAP_V1` | boolean | false | 100% | ✅ | ✅ | Enabled |
| `FF_GEOSPATIAL_LAYERS` | boolean | false | 100% | ✅ | ✅ | Enabled |
| `FF_POINT_LAYER` | boolean | false | 100% | ✅ | ✅ | Enabled |
| `FF_GPU_FILTERING` | boolean | false | 100% | ✅ | ✅ | Enabled |
| `FF_WEBSOCKET_LAYERS` | boolean | false | 100% | ✅ | ✅ | Enabled |
| `FF_AB_ROUTING` | boolean | false | 100% | ✅ | ✅ | Enabled |
| `FF_RSS_INGESTION_V1` | boolean | false | 0% | ✅ | 🔴 | Disabled |
| `FF_RSS_ROUTE_PROCESSING` | boolean | false | 0% | ✅ | 🔴 | Disabled |
| `FF_RSS_ANTI_CRAWLER` | boolean | false | 0% | ✅ | 🔴 | Disabled |
| `FF_RSS_ENTITY_EXTRACTION` | boolean | false | 0% | ✅ | 🔴 | Disabled |
| `FF_RSS_DEDUPLICATION` | boolean | false | 0% | ✅ | 🔴 | Disabled |
| `FF_RSS_WEBSOCKET_NOTIFICATIONS` | boolean | false | 0% | ✅ | 🔴 | Disabled |
| `FF_USE_MOCKS` | boolean | false | 0% | ✅ | 🟡 | Dev only |

**Flag Dependencies:**
- `FF_GEOSPATIAL_LAYERS` requires `FF_MAP_V1`
- `FF_GPU_FILTERING` requires `FF_POINT_LAYER`
- `FF_RSS_ROUTE_PROCESSING` requires `FF_RSS_INGESTION_V1`
- All RSS flags should be enabled together for production

**Rollout Strategy:**
1. Enable in staging (0% production)
2. Canary rollout (10% → 25% → 50%)
3. Full rollout (100%)
4. Monitor for 7 days before removing flag

**Action Items:**
- [x] Document all feature flags (done above)
- [ ] Add feature flag dependency validation
- [ ] Create feature flag rollback playbook
- [ ] Add flag usage analytics

---

### 5. Environment Variables (Config → Runtime)

**Source:** `.env.example` files (root and `frontend/.env.example`)
**Backend:** `api/config_validation.py` validates required vars
**Frontend:** Vite environment variables (`VITE_*` prefix)

#### Backend Environment Variables

| Variable | Required | Default | Purpose | Status |
|----------|----------|---------|---------|--------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Yes | `redis://localhost:6379/0` | Redis connection string | ✅ |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000,...` | CORS allowed origins | ✅ |
| `WS_PING_INTERVAL` | No | `30` | WebSocket ping interval (seconds) | ✅ |
| `WS_PING_TIMEOUT` | No | `10` | WebSocket ping timeout (seconds) | ✅ |
| `CACHE_L1_MAX_SIZE` | No | `1000` | L1 cache max entries | ✅ |
| `CACHE_L1_TTL` | No | `300` | L1 cache TTL (seconds) | ✅ |
| `FEATURE_FLAG_CACHE_TTL` | No | `60` | Feature flag cache TTL (seconds) | ✅ |
| `RSS_RATE_LIMIT_REQUESTS` | No | `100` | RSS rate limit (requests/minute) | ✅ |
| `RSS_RATE_LIMIT_WINDOW` | No | `60` | RSS rate limit window (seconds) | ✅ |
| `TESTING` | No | `false` | Enable test mode | ✅ |

#### Frontend Environment Variables

| Variable | Required | Default | Purpose | Status |
|----------|----------|---------|---------|--------|
| `VITE_API_BASE_URL` | No | `http://localhost:9000` | Backend API URL | ✅ |
| `VITE_WS_URL` | No | `ws://localhost:9000/ws` | WebSocket URL | ✅ |
| `VITE_MAPLIBRE_API_KEY` | No | - | MapLibre API key (optional) | 🟡 |
| `VITE_FF_USE_MOCKS` | No | `false` | Use mock data instead of API | 🟡 |

**Action Items:**
- [x] Document all environment variables (done above)
- [ ] Add environment variable validation on startup
- [ ] Create separate .env.example for production
- [ ] Document sensitive vs non-sensitive variables

---

### 6. Database Schemas (PostgreSQL)

**Source:** `migrations/*.sql` SQL migration files
**ORM:** Direct SQL queries (no ORM) via asyncpg
**Migration Tool:** Raw SQL + manual tracking (consider Alembic for Phase 3)

#### Core Tables

| Table | Purpose | Key Columns | Status |
|-------|---------|-------------|--------|
| `entities` | Core entity storage | `id`, `name`, `path` (LTREE), `geom` (PostGIS) | ✅ Implemented |
| `hierarchy_cache` | Materialized hierarchy | `entity_id`, `ancestor_ids`, `descendant_ids` | ✅ Implemented |
| `feature_flags` | Feature flag config | `name`, `enabled`, `rollout_percentage` | ✅ Implemented |
| `scenarios` | Scenario planning | `id`, `name`, `metadata`, `variables` | ✅ Implemented |
| `rss_sources` | RSS feed sources | `id`, `url`, `route_config`, `status` | ✅ Implemented |
| `rss_items` | Ingested RSS items | `id`, `source_id`, `content_hash`, `extracted_at` | ✅ Implemented |
| `rss_entities` | Extracted entities | `id`, `item_id`, `entity_type`, `confidence` | ✅ Implemented |

#### Materialized Views

| View | Refresh | Purpose | Status |
|------|---------|---------|--------|
| `hierarchy_ancestors_mv` | Auto (trigger) | Ancestor lookups | ✅ Implemented |
| `hierarchy_descendants_mv` | Auto (trigger) | Descendant lookups | ✅ Implemented |

**Schema Evolution:**
- All changes via SQL migrations in `migrations/` directory
- Each migration must have a rollback plan
- Critical tables require DB backup before migration

**Action Items:**
- [ ] Adopt Alembic for version-controlled migrations
- [ ] Document DB schema in Entity-Relationship diagram
- [ ] Add migration testing in CI

---

### 7. Type Definitions (Shared Between Backend/Frontend)

**Current State:** 🔴 **Not centralized** — Types duplicated across backend/frontend
**Target State:** ✅ **Generated from backend schemas** (Phase 3)

#### Shared Type Concepts

| Type | Backend Definition | Frontend Usage | Status |
|------|-------------------|----------------|--------|
| `Entity` | Pydantic model | Duplicated TypeScript interface | 🟡 Needs generation |
| `FeatureFlag` | Pydantic model | Duplicated TypeScript interface | 🟡 Needs generation |
| `Scenario` | Pydantic model | Duplicated TypeScript interface | 🟡 Needs generation |
| `LayerDataUpdate` | Pydantic model | Duplicated TypeScript interface | 🟡 Needs generation |
| `GPUFilterSync` | Pydantic model | Duplicated TypeScript interface | 🟡 Needs generation |

**Action Items (Phase 3):**
- [ ] Generate TypeScript types from Pydantic models
- [ ] Add type generation to CI pipeline
- [ ] Fail PR if types are out of sync
- [ ] Document type generation process

---

## Contract Change Workflow

When changing a contract:

1. **Identify Impact**
   - Which boundaries are affected? (REST API, WebSocket, Cache, Feature Flags, DB, Types)
   - Does this break existing clients?

2. **Update Backend First**
   - Modify Pydantic models in `api/models/`
   - Update API routes in `api/routers/`
   - Regenerate `contracts/openapi.json` (Phase 3)
   - Regenerate `contracts/ws.json` (Phase 3)

3. **Update Frontend**
   - Regenerate TypeScript types: `npm run contracts:generate` (Phase 3)
   - Update components using affected types
   - Add Zod validators for runtime checks

4. **Add Tests**
   - Backend: Contract tests in `api/tests/`
   - Frontend: Contract drift tests in `frontend/tests/contracts/`

5. **PR Review**
   - CODEOWNERS will require both backend and frontend review
   - Include "Contract changes" section in PR template

6. **Deploy**
   - Backend first (backward compatible)
   - Frontend after backend is live
   - Monitor for contract violations

---

## Contract Testing

### Backend Contract Tests

Location: `api/tests/test_contracts.py` (to be created in Phase 3)

Tests should verify:
- All Pydantic models serialize/deserialize correctly
- All WebSocket messages have valid schemas
- OpenAPI spec matches actual routes

### Frontend Contract Tests

Location: `frontend/tests/contracts/contract_drift.spec.ts`

Tests should verify:
- Generated types match backend schemas
- Zod validators accept valid payloads
- Zod validators reject invalid payloads

---

## Contract Monitoring

### Runtime Validation

- **Backend:** Pydantic validates all incoming requests automatically
- **Frontend:** Should add Zod validators at API/WS boundaries (Phase 3)

### Observability

- **Contract violations:** Log to structured logs with schema/payload
- **Version mismatches:** Track via `X-API-Version` header (future)
- **Metrics:** Track validation failures per endpoint

---

## Phase 3 Deliverables

When implementing Phase 3 (Contract-First Synchronisation):

- [ ] Create `scripts/dev/generate_frontend_types.ts` script
- [ ] Export OpenAPI JSON: `contracts/openapi.json`
- [ ] Export WebSocket schemas: `contracts/ws.json`
- [ ] Generate TypeScript types: `frontend/src/types/api.generated.ts`, `frontend/src/types/ws.generated.ts`
- [ ] Add Zod runtime validators in frontend
- [ ] Add contract tests in backend and frontend
- [ ] Wire contract generation into CI (fail if types out of sync)
- [ ] Update this README with generation commands

---

## Related Documentation

- Phase 0 spec — Branch protection and CI requirements
- Phase 1 spec — Inventory and truth alignment (this phase)
- Phase 3 spec — Contract-first synchronization
- `CODEOWNERS` — Cross-boundary changes require dual approval
- `.github/pull_request_template.md` — Contract change checklist

---

**Maintained by:** Architecture Team
**Next Review:** After Phase 3 completion
**Questions?** See `CONTRIBUTING.md` for contract change guidance
