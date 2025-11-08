# Repository Inventory

**Generated:** 2025-11-08 17:10:03 UTC (2025-11-09 02:10:03 JST)
**Purpose:** Comprehensive map of Forecastin codebase for Phase 1 truth alignment

---

## 1. Directory Tree Structure

### Backend (`/api`) - Directory listing (tree not available)

```
api
api/models
api/navigation_api
api/navigation_api/database
api/routers
api/services
api/services/rss
api/services/rss/anti_crawler
api/services/rss/deduplication
api/services/rss/entity_extraction
api/services/rss/route_processors
api/services/rss/websocket
api/tests
```

### Frontend (`/frontend`) - Directory listing (tree not available)

```
frontend
frontend/build
frontend/docs
frontend/mocks
frontend/mocks/rss
frontend/mocks/ws
frontend/src
frontend/src/components
frontend/src/components/Entity
frontend/src/components/Map
frontend/src/components/MillerColumns
frontend/src/components/Navigation
frontend/src/components/Outcomes
frontend/src/components/Search
frontend/src/components/UI
frontend/src/config
frontend/src/errors
frontend/src/handlers
frontend/src/hooks
frontend/src/integrations
frontend/src/layers
frontend/src/layers/base
frontend/src/layers/implementations
frontend/src/layers/registry
frontend/src/layers/tests
frontend/src/layers/types
frontend/src/layers/utils
frontend/src/store
frontend/src/tests
frontend/src/types
frontend/src/types/zod
frontend/src/utils
frontend/tests
frontend/tests/contracts
```

---

## 2. FastAPI Routes

### Routers

| File | Lines | Description |
|------|-------|-------------|
| `entities.py` | 51 | Get all active entities with hierarchy optimization |
| `feature_flags.py` | 173 | 
Router |
| `health.py` | 68 | Health check response model |
| `hierarchy.py` | 68 | 
Router |
| `hierarchy_refresh.py` | 163 | Manually refresh LTREE materialized views (required for LTREE performance) |
| `rss_ingestion.py` | 205 | 
Router |
| `scenarios.py` | 254 | 
Router |
| `test_data.py` | 373 | 
Router |
| `websocket.py` | 600 | 
Router |

### Route Endpoints

Extracted from router files:

```python
# entities.py
@router.get("")
@router.get("/{entity_id}/hierarchy")

# feature_flags.py
@router.get("")
@router.post("")
@router.put("/{flag_name}")
@router.delete("/{flag_name}")
@router.get("/{flag_name}")
@router.get("/{flag_name}/enabled")
@router.get("/feature-metrics")
@router.get("/metrics/cache")

# health.py
@router.get("/health", response_model=HealthResponse)

# hierarchy.py
@router.get("/root")
@router.get("/children")
@router.get("/breadcrumbs")
@router.get("/search")
@router.get("/stats")
@router.post("/move")

# hierarchy_refresh.py
@router.post("")
@router.get("/status")
@router.post("/automated/start")
@router.post("/automated/stop")
@router.post("/automated/force")
@router.get("/automated/metrics")

# rss_ingestion.py
@router.post("/ingest")
@router.post("/ingest/batch")
@router.get("/metrics")
@router.get("/health")
@router.get("/jobs/{job_id}")

# scenarios.py
@router.get("/v3/scenarios/{path:path}/forecasts")
@router.get("/v3/scenarios/{path:path}/hierarchy")
@router.post("/v6/scenarios")
@router.get("/v6/scenarios/{scenario_id}/analysis")

# test_data.py
@router.get("/opportunities")
@router.get("/actions")
@router.get("/stakeholders")
@router.get("/evidence")

# websocket.py
@router.websocket("/ws")
@router.websocket("/ws/echo")
@router.websocket("/ws/health")
@router.websocket("/ws/v3/scenarios/{path:path}/forecasts")

```

---

## 3. Pydantic Models & Schemas

### Model Files

| File | Lines | Purpose |
|------|-------|---------|
| `serializers.py` | 32 | 
Models |
| `websocket_schemas.py` | 358 | 
Models |

### Schema Classes

Pydantic BaseModel classes found:

```python
# __init__.py

# serializers.py

# websocket_schemas.py
class BoundingBox(BaseModel):
class PointGeometry(BaseModel):
class LineStringGeometry(BaseModel):
class PolygonGeometry(BaseModel):
class MultiPolygonGeometry(BaseModel):
class MultiLineStringGeometry(BaseModel):
class GeoJSONFeature(BaseModel):
class FeatureCollection(BaseModel):
class MessageMeta(BaseModel):
class LayerDataUpdatePayload(BaseModel):
class TemporalFilter(BaseModel):
class FilterParams(BaseModel):
class GPUFilterSyncPayload(BaseModel):
class BaseWebSocketMessage(BaseModel):

# WebSocket Schemas
class BoundingBox(BaseModel):
class PointGeometry(BaseModel):
class LineStringGeometry(BaseModel):
class PolygonGeometry(BaseModel):
class MultiPolygonGeometry(BaseModel):
class MultiLineStringGeometry(BaseModel):
class GeoJSONFeature(BaseModel):
class FeatureCollection(BaseModel):
class MessageMeta(BaseModel):
class LayerDataUpdatePayload(BaseModel):
class TemporalFilter(BaseModel):
class FilterParams(BaseModel):
class GPUFilterSyncPayload(BaseModel):
class BaseWebSocketMessage(BaseModel):
```

---

## 4. Database Migrations

### Migration Files

| File | Size | Description |
|------|------|-------------|
| `001_initial_schema.sql` | 214 lines | Phase 0 Initial Schema for Forecastin Geopolitical Intelligence Platform |
| `001_standardize_feature_flag_names.sql` | 184 lines | Migration: Standardize Feature Flag Names |
| `001_standardize_feature_flag_names_ROLLBACK.sql` | 57 lines | Rollback Migration: Standardize Feature Flag Names |
| `002_ml_ab_testing_framework.sql` | 537 lines | Migration: 002_ml_ab_testing_framework.sql |
| `004_automated_materialized_view_refresh.sql` | 374 lines | Phase 4: Automated Materialized View Refresh System |
| `004_rss_entity_extraction_schema.sql` | 166 lines | Migration: RSS Entity Extraction Schema |

**Total migrations:** 6

### Alembic Migrations

_No Alembic versions found (using raw SQL migrations)_

---

## 5. Frontend Routes & Components

### Routes/Pages

Routes extracted from App.tsx:

```tsx
        <Router
```

### Component Structure

| Component | Lines | Location |
|-----------|-------|----------|
| `ActionQueue.tsx` | 152 | `components/Outcomes` |
| `EntityDetail.tsx` | 208 | `components/Entity` |
| `ErrorBoundary.tsx` | 262 | `components/UI` |
| `EvidencePanel.tsx` | 187 | `components/Outcomes` |
| `GeospatialView.tsx` | 538 | `components/Map` |
| `HorizonLane.tsx` | 131 | `components/Outcomes` |
| `LensBar.tsx` | 256 | `components/Outcomes` |
| `LoadingSpinner.tsx` | 40 | `components/UI` |
| `MillerColumns.tsx` | 553 | `components/MillerColumns` |
| `NavigationPanel.tsx` | 135 | `components/Navigation` |
| `OpportunityRadar.tsx` | 144 | `components/Outcomes` |
| `OutcomesDashboard.tsx` | 289 | `components/Outcomes` |
| `SearchInterface.tsx` | 317 | `components/Search` |
| `StakeholderMap.tsx` | 114 | `components/Outcomes` |

**Total component files:** 14

### Shared Types

TypeScript type definition files:

| File | Lines | Purpose |
|------|-------|---------|
| `brand.ts` | 204 | 
Type definitions |
| `contracts.generated.ts` | 449 | 
Type definitions |
| `deck.gl.d.ts` | 377 | 
Type definitions |
| `index.ts` | 142 | 
Type definitions |
| `outcomes.ts` | 216 | 
Type definitions |
| `ws_messages.ts` | 1011 | 
Type definitions |

---

## 6. WebSocket Message Types

### Backend WebSocket Events

Message schemas from `api/models/websocket_schemas.py`:

```python
class BoundingBox(BaseModel):
class PointGeometry(BaseModel):
    type: Literal['Point']
class LineStringGeometry(BaseModel):
    type: Literal['LineString']
class PolygonGeometry(BaseModel):
    type: Literal['Polygon']
class MultiPolygonGeometry(BaseModel):
    type: Literal['MultiPolygon']
class MultiLineStringGeometry(BaseModel):
    type: Literal['MultiLineString']
class GeoJSONFeature(BaseModel):
    type: Literal['Feature']
class FeatureCollection(BaseModel):
    type: Literal['FeatureCollection']
class MessageMeta(BaseModel):
class LayerDataUpdatePayload(BaseModel):
class TemporalFilter(BaseModel):
class FilterParams(BaseModel):
class GPUFilterSyncPayload(BaseModel):
class BaseWebSocketMessage(BaseModel):
    type: Literal[MessageType.PING]
    type: Literal[MessageType.PONG]
    type: Literal[MessageType.LAYER_DATA_UPDATE]
    type: Literal[MessageType.GPU_FILTER_SYNC]
    type: Literal[MessageType.ERROR]
    type: Literal[MessageType.ECHO]
```

WebSocket handlers from `api/routers/websocket.py`:

```python
class ConnectionManager:
    async def send_personal_message(self, message: Dict[str, Any], client_id: str):
                await websocket.send_text(serialized_message)
    async def broadcast_message(self, message: Dict[str, Any]):
                    await websocket.send_text(serialized_message)
connection_manager = ConnectionManager()
                        await connection_manager.send_personal_message(response, client_id)
                        await connection_manager.send_personal_message(pong_response, client_id)
                await connection_manager.send_personal_message(response, client_id)
        await websocket.send_text(safe_serialize_message(welcome))
                await websocket.send_text(safe_serialize_message(ping_message))
                    await websocket.send_text(safe_serialize_message(echo_response))
                    await websocket.send_text(safe_serialize_message(echo_response))
        await websocket.send_text(safe_serialize_message(health_status))
                await websocket.send_text(safe_serialize_message(heartbeat))
                        await websocket.send_text(safe_serialize_message(status_response))
                await connection_manager.send_personal_message(response, client_id)
```

### Frontend WebSocket Types

WebSocket type files:
```typescript
// ws_messages.ts.old
  type MessageMeta,
export const LayerDataUpdateMessageSchema = z.object({
export type LayerDataUpdateMessage = z.infer<typeof LayerDataUpdateMessageSchema>;
export const GPUFilterSyncMessageSchema = z.object({
export type GPUFilterSyncMessage = z.infer<typeof GPUFilterSyncMessageSchema>;
export const PolygonUpdateMessageSchema = z.object({
export type PolygonUpdateMessage = z.infer<typeof PolygonUpdateMessageSchema>;
export const LinestringUpdateMessageSchema = z.object({
export type LinestringUpdateMessage = z.infer<typeof LinestringUpdateMessageSchema>;
export const GeometryBatchUpdateMessageSchema = z.object({
export type GeometryBatchUpdateMessage = z.infer<typeof GeometryBatchUpdateMessageSchema>;
export const HeartbeatMessageSchema = z.object({
export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;
export const ErrorMessageSchema = z.object({
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export const EntityUpdateMessageSchema = z.object({
export type EntityUpdateMessage = z.infer<typeof EntityUpdateMessageSchema>;
export const HierarchyChangeMessageSchema = z.object({
export type HierarchyChangeMessage = z.infer<typeof HierarchyChangeMessageSchema>;
export const BulkUpdateMessageSchema = z.object({
// ws_messages.ts
export const EntityUpdateMessageSchema = z.object({
export const HierarchyChangeMessageSchema = z.object({
export const BulkUpdateMessageSchema = z.object({
export const LayerDataUpdateMessageSchema = z.object({
export const GPUFilterSyncMessageSchema = z.object({
export const FeatureFlagChangeMessageSchema = z.object({
export const FeatureFlagCreatedMessageSchema = z.object({
export const FeatureFlagDeletedMessageSchema = z.object({
export const ForecastUpdateMessageSchema = z.object({
export const HierarchicalForecastUpdateMessageSchema = z.object({
export const ScenarioAnalysisUpdateMessageSchema = z.object({
export const ScenarioValidationUpdateMessageSchema = z.object({
export const CollaborationUpdateMessageSchema = z.object({
export const OpportunityUpdateMessageSchema = z.object({
export const ActionUpdateMessageSchema = z.object({
export const StakeholderUpdateMessageSchema = z.object({
export const EvidenceUpdateMessageSchema = z.object({
export const PingMessageSchema = z.object({
export const PongMessageSchema = z.object({
export const SerializationErrorMessageSchema = z.object({
```

---

## 7. Package Managers & Toolchain Versions

### Pinned Versions

| Tool | Version | Source |
|------|---------|--------|
| Node.js | `20.18.1` | `.nvmrc` |
| nodejs | `20.18.1` | `.tool-versions` |
| python | `3.11.9` | `.tool-versions` |
| Python | `3.11` | `pyproject.toml` |

### Backend Dependencies

- **Total Python packages:** 38 (from `api/requirements.txt`)
- **Key dependencies:**

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
redis==5.0.1
pydantic==2.6.0
pydantic-settings==2.1.0
pytest==8.3.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
pytest-benchmark==4.0.0
```

### Frontend Dependencies

From `frontend/package.json`:

```json
Dependencies: 27 
DevDependencies: 9
```

Key frontend packages:
```
    "deck.gl": "^9.2.2",
    "react": "^18.2.0",
    "typescript": "^5.3.0",
    "zustand": "^4.4.6"
    "start": "vite",
    "vite": "^5.4.11",
```

### Lockfiles Status

| Lockfile | Status | Size |
|----------|--------|------|
| `frontend/package-lock.json` | ✅ Committed | 380K |

---

## 8. Services & Background Jobs

### Service Files

| Service | Lines | Purpose |
|---------|-------|---------|
| `automated_refresh_service.py` | 397 | 
Service |
| `background_services.py` | 55 | 
Service |
| `cache_service.py` | 1347 | 
Service |
| `database_manager.py` | 323 | 
Service |
| `debug_error.py` | 21 | 
Service |
| `feature_flag_service.py` | 1204 | 
Service |
| `hierarchical_forecast_service.py` | 932 | 
Service |
| `init_geospatial_flags.py` | 142 | !/usr/bin/env python3 |
| `init_phase6_flags.py` | 359 | 
Service |
| `realtime_service.py` | 697 | 
Service |
| `scenario_service.py` | 1309 | 
Service |
| `simple_test.py` | 178 | 
Service |
| `test_feature_flag_integration.py` | 498 | 
Service |
| `test_services.py` | 543 | 
Service |
| `verify_implementation.py` | 238 | 
Service |
| `websocket_manager.py` | 715 | 
Service |

**Total service files:** 20

---

## 9. Feature Flags

### Feature Flag Configuration

Feature flags from `.env.example`:

```bash
No feature flags found
```

Feature flag service found: `api/services/feature_flag_service.py`

- **Lines:** 1204
- **Manages:** Feature flag initialization, validation, and runtime checks

---

## 10. Contracts & Cross-Boundary Types

### Contract Files

_No contracts directory found (should be created in Phase 3)_

### Shared Types

Repository root `/types` directory:
```
total 1.0K
-rw-r--r-- 1 root root 713 Nov  8 02:59 ws_messages.ts
```

---

## 11. Test Coverage

### Backend Tests

- **Test files:** 22

Backend test structure:
```
api/tests/test_scenario_service.py
api/tests/test_scenario_api.py
api/tests/__init__.py
api/tests/test_scenario_validation.py
api/tests/test_ws_health.py
api/tests/test_performance.py
api/tests/test_rss_performance_slos.py
api/tests/test_ltree_refresh.py
api/tests/test_hierarchical_forecast_service.py
api/tests/conftest.py
api/tests/test_ws_echo.py
api/tests/test_connection_manager.py
api/tests/test_rss_deduplicator.py
api/tests/test_feature_flag_service.py
api/tests/test_automated_refresh_service.py
api/tests/test_database_manager.py
api/tests/test_cache_optimization.py
api/tests/test_rss_entity_extractor.py
api/tests/test_anti_crawler_manager.py
api/tests/test_websocket_manager.py
```

### Frontend Tests

