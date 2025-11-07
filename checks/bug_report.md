# Bug Report - Top 10 Defects

**Date**: 2025-11-07  
**Session**: claude/codebase-audit-and-fixes-011CUtPZZvGBYFe9mD7ehTT4  
**Audit Type**: Static Analysis (No Services Running)

---

## Defect #1: Feature Flag Name Mismatch

**Severity**: 🔴 CRITICAL  
**Component**: Feature Flags (Backend + Frontend)  
**Impact**: Runtime failures, flags not found  
**Scope**: 4 files across backend/frontend

### Description
Feature flag names are inconsistent between documentation, database initialization, backend service, and frontend code.

### Reproduction
1. Backend initializes flags: `ff.geo.layers_enabled` (`init_geospatial_flags.py:58`)
2. Backend service queries: `ff_geospatial_layers` (`feature_flag_service.py:81`)
3. Frontend requests: `ff.geospatial_layers` (`useFeatureFlag.ts:263`)
4. Result: Backend/frontend request flags that don't exist in database

### Expected Behaviour
All code should use documented flag names from `GEOSPATIAL_FEATURE_FLAGS.md`:
- `ff.geo.layers_enabled`
- `ff.geo.gpu_rendering_enabled`
- `ff.geo.point_layer_active`

### Actual Behaviour
Four different naming patterns used across codebase:
- Initialization: `ff.geo.layers_enabled` ✅
- Backend: `ff_geospatial_layers` ❌
- Frontend Hook: `ff.geospatial_layers` ❌
- Frontend Config: `ff_geospatial_enabled` ❌

### Risk Assessment
- **Likelihood**: 100% (always occurs)
- **Impact**: HIGH - Features don't work as frontend/backend can't find flags
- **Detection**: LOW - Silent failures, no error logging
- **Blast Radius**: All geospatial features affected

### Fix Sketch
```python
# api/services/feature_flag_service.py:81-108
class GeospatialFeatureFlags:
    # BEFORE
    ff_geospatial_layers: bool = False
    ff_gpu_filtering: bool = False
    ff_point_layer: bool = False
    
    # AFTER
    ff_geo_layers_enabled: bool = False  # Match docs
    ff_geo_gpu_rendering_enabled: bool = False
    ff_geo_point_layer_active: bool = False
```

```typescript
// frontend/src/hooks/useFeatureFlag.ts:263
// BEFORE
const flags = await Promise.all([
  checkFlag('ff.geospatial_layers'),
  // ...
]);

// AFTER
const flags = await Promise.all([
  checkFlag('ff.geo.layers_enabled'),  // Match docs
  // ...
]);
```

### Database Migration Required
```sql
UPDATE feature_flags
SET flag_name = 'ff.geo.layers_enabled'
WHERE flag_name = 'ff_geospatial_layers';
-- Repeat for other flags
```

### Testing
```bash
# 1. Update all 4 locations to use ff.geo.* pattern
# 2. Run database migration
# 3. Start backend: python -m api.main
# 4. Check logs: grep "ff.geo" api.log
# 5. Test frontend requests hit correct flags
```

---

## Defect #2: Feature Flag Dependencies Not Enforced

**Severity**: 🔴 CRITICAL  
**Component**: Feature Flags (Backend)  
**Impact**: Logical violations of dependency chain  
**Scope**: 1 file (`feature_flag_service.py`)

### Description
Feature flag dependency chain (`ff.map_v1 → ff.geo.layers_enabled → child flags`) is defined in database but not enforced at runtime in `get_flag_with_rollout()` method.

### Reproduction
1. Set `ff.map_v1 = False`
2. Set `ff.geo.layers_enabled = True`
3. Call `GET /api/feature-flags/ff.geo.layers_enabled/enabled`
4. Expected: Returns `False` (parent disabled)
5. Actual: Returns `True` (ignores parent)

### Expected Behaviour
```python
def get_flag_with_rollout(self, flag_name: str, user_id: Optional[str] = None) -> bool:
    flag = self.get_flag(flag_name)
    if not flag or not flag.is_enabled:
        return False
    
    # NEW: Check parent flags
    for parent_name in flag.dependencies:
        if not self.get_flag_with_rollout(parent_name, user_id):
            return False  # Parent disabled, so child must be disabled
    
    # Existing rollout logic
    return self._check_rollout(flag, user_id)
```

### Actual Behaviour
```python
# feature_flag_service.py:776-805
def get_flag_with_rollout(self, flag_name: str, user_id: Optional[str] = None) -> bool:
    # ❌ NO DEPENDENCY CHECKING
    flag = self.get_flag(flag_name)
    if not flag or not flag.is_enabled:
        return False
    # Rollout logic only - ignores dependencies
```

### Risk Assessment
- **Likelihood**: MEDIUM (requires misconfiguration)
- **Impact**: HIGH - Violates documented contracts
- **Detection**: LOW - No validation or alerts
- **Blast Radius**: All dependent features

### Fix Sketch
```python
# api/services/feature_flag_service.py:776
def get_flag_with_rollout(self, flag_name: str, user_id: Optional[str] = None) -> bool:
    flag = self.get_flag(flag_name)
    if not flag or not flag.is_enabled:
        return False
    
    # NEW: Enforce dependency chain
    if flag.dependencies:
        for parent_flag_name in flag.dependencies:
            parent_enabled = self.get_flag_with_rollout(parent_flag_name, user_id)
            if not parent_enabled:
                logger.warning(
                    f"Flag {flag_name} disabled: parent {parent_flag_name} is disabled"
                )
                return False
    
    # Existing rollout logic
    if user_id is None:
        return random.randint(1, 100) <= flag.rollout_percentage
    
    user_hash = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
    user_bucket = (user_hash % 100) + 1
    return user_bucket <= flag.rollout_percentage
```

### Testing
```python
# tests/test_feature_flags.py
def test_dependency_chain_enforced():
    # Set up: parent disabled, child enabled
    service.create_flag("parent", enabled=False, dependencies=[])
    service.create_flag("child", enabled=True, dependencies=["parent"])
    
    # Test: child should be disabled because parent is disabled
    assert service.get_flag_with_rollout("child", "user123") is False
```

---

## Defect #3: WebSocket Message Structure Drift

**Severity**: 🟡 MEDIUM  
**Component**: WebSocket Layer (Backend + Frontend)  
**Impact**: Type definitions don't match actual messages  
**Scope**: 2 files

### Description
Backend emits `{type, data, timestamp}` but frontend types expect `{type, payload, meta: {timestamp}}`.

### Reproduction
1. Backend sends: `{"type": "layer_data_update", "data": {...}, "timestamp": 1699999999}`
2. Frontend types expect: `{type: "layer_data_update", payload: {...}, meta: {timestamp: ...}}`
3. Frontend handler works because it uses `data` field (defensive)
4. But TypeScript types lie about actual shape

### Expected Behaviour
Backend and frontend agree on structure:
```typescript
{
  type: "layer_data_update",
  payload: { layer_id, layer_type, layer_data, bbox, changed_at },
  meta: { timestamp, clientId?, sequence? }
}
```

### Actual Behaviour
**Backend** (`realtime_service.py:404-414`):
```python
message = {
    "type": "layer_data_update",
    "data": { ... },  # ❌ Should be "payload"
    "timestamp": time.time()  # ❌ Should be in "meta"
}
```

**Frontend Types** (`ws_messages.ts:41`):
```typescript
export const LayerDataUpdateMessageSchema = z.object({
  type: z.literal('layer_data_update'),
  payload: LayerDataUpdatePayloadSchema,  // ✅ Expects "payload"
  meta: MessageMetaSchema,  // ✅ Expects "meta"
});
```

**Frontend Handler** (`realtimeHandlers.ts:260`):
```typescript
// ✅ Defensive - works with actual "data" field
message: WebSocketMessage & { data?: { ... } }
```

### Risk Assessment
- **Likelihood**: 100% (always occurs)
- **Impact**: MEDIUM - Handler works but types are wrong
- **Detection**: MEDIUM - TypeScript warns but doesn't block
- **Blast Radius**: All WebSocket messages

### Fix Sketch (Option A: Fix Backend)
```python
# api/services/realtime_service.py:404
def broadcast_layer_data_update(self, layer_id, layer_type, data, bbox):
    message = {
        "type": "layer_data_update",
        "payload": {  # Changed from "data"
            "layer_id": layer_id,
            "layer_type": layer_type,
            "layer_data": data,
            "bbox": bbox,
            "changed_at": time.time()
        },
        "meta": {  # New wrapper
            "timestamp": time.time(),
            "clientId": None,
            "sequence": None
        }
    }
```

### Fix Sketch (Option B: Fix Frontend Types)
```typescript
// frontend/src/types/ws_messages.ts:41
export const LayerDataUpdateMessageSchema = z.object({
  type: z.literal('layer_data_update'),
  data: LayerDataUpdatePayloadSchema,  // Changed from "payload"
  timestamp: z.number(),  // Flat instead of meta wrapper
});
```

**Recommendation**: Option A (fix backend) aligns with documentation.

---

## Defect #4: Performance Threshold Not Enforced

**Severity**: 🟡 MEDIUM  
**Component**: LTREE Refresh API (Backend)  
**Impact**: SLO violations not detected or alerted  
**Scope**: 1 file (`main.py`)

### Description
Documentation claims "<1000ms" performance target for LTREE refresh, but code only measures duration without comparing to target or alerting on violations.

### Reproduction
1. Trigger slow refresh: `POST /api/entities/refresh`
2. Response includes: `{"duration_ms": 1500}`
3. No warning logged
4. No alert sent
5. SLO violation silent

### Expected Behaviour
```python
# api/main.py:449-454
start_time = time.time()
refresh_results = hierarchy_resolver.refresh_all_materialized_views()
duration_ms = (time.time() - start_time) * 1000

# NEW: Enforce threshold
if duration_ms > 1000:
    logger.warning(
        f"LTREE refresh exceeded 1000ms target: {duration_ms:.2f}ms"
    )
    # Optional: Send alert to monitoring system
    await alert_service.send("LTREE_SLO_VIOLATION", duration_ms)

return {
    "status": "success" if duration_ms <= 1000 else "degraded",
    "duration_ms": duration_ms,
    "slo_compliant": duration_ms <= 1000
}
```

### Actual Behaviour
```python
# api/main.py:449-454
start_time = time.time()
refresh_results = hierarchy_resolver.refresh_all_materialized_views()
duration_ms = (time.time() - start_time) * 1000
# ❌ No threshold check
return {"status": "success", "duration_ms": duration_ms}
```

### Risk Assessment
- **Likelihood**: LOW (current performance is 850ms avg)
- **Impact**: MEDIUM - Gradual degradation undetected
- **Detection**: LOW - No monitoring or alerts
- **Blast Radius**: LTREE refresh operations

### Fix Sketch
```python
# api/main.py:449-475
SLO_REFRESH_TARGET_MS = 1000

@app.post("/api/entities/refresh")
async def refresh_materialized_views():
    start_time = time.time()
    refresh_results = hierarchy_resolver.refresh_all_materialized_views()
    duration_ms = (time.time() - start_time) * 1000
    
    # Enforce threshold
    slo_compliant = duration_ms <= SLO_REFRESH_TARGET_MS
    if not slo_compliant:
        logger.warning(
            f"LTREE refresh SLO violation: {duration_ms:.2f}ms > {SLO_REFRESH_TARGET_MS}ms"
        )
    
    status = "success" if not failed_views else "partial_success"
    if not slo_compliant:
        status = "degraded"
    
    return {
        "status": status,
        "message": "...",
        "results": refresh_results,
        "duration_ms": duration_ms,
        "slo_compliant": slo_compliant,
        "slo_target_ms": SLO_REFRESH_TARGET_MS,
        "failed_views": failed_views if failed_views else []
    }
```

### Testing
```python
# tests/test_ltree_refresh.py
@pytest.mark.asyncio
async def test_slo_violation_logged(monkeypatch):
    # Mock slow refresh
    async def slow_refresh(*args):
        await asyncio.sleep(1.5)  # 1500ms
        return {"mv_entity_ancestors": True}
    
    monkeypatch.setattr(hierarchy_resolver, "refresh_all_materialized_views", slow_refresh)
    
    # Trigger refresh
    response = await client.post("/api/entities/refresh")
    
    # Assert
    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["slo_compliant"] is False
    assert "SLO violation" in caplog.text
```

---

## Defect #5: Entity Type Not Exported

**Severity**: 🟡 MEDIUM  
**Component**: Frontend Types  
**Impact**: Compilation error when dependencies installed  
**Scope**: 1 file (`useHierarchy.ts`)

### Description
`Entity` type declared in `useHierarchy.ts` but not exported, causing TS2459 error when imported by other files.

### Reproduction
1. Install dependencies: `cd frontend && npm install`
2. Compile TypeScript: `npx tsc --noEmit`
3. Error: `src/components/Entity/EntityDetail.tsx(21,21): error TS2459: Module '"../../hooks/useHierarchy"' declares 'Entity' locally, but it is not exported.`

### Expected Behaviour
```typescript
// frontend/src/hooks/useHierarchy.ts
export type Entity = {
  id: string;
  name: string;
  // ...
};
```

### Actual Behaviour
```typescript
// frontend/src/hooks/useHierarchy.ts
type Entity = {  // ❌ Missing 'export' keyword
  id: string;
  name: string;
  // ...
};
```

### Risk Assessment
- **Likelihood**: 100% (blocks compilation)
- **Impact**: MEDIUM - Prevents builds
- **Detection**: HIGH - TypeScript compilation error
- **Blast Radius**: All files importing Entity from useHierarchy

### Fix Sketch
```typescript
// frontend/src/hooks/useHierarchy.ts
// ONE CHARACTER FIX:
export type Entity = {  // Add 'export' keyword
  id: string;
  name: string;
  type: string;
  parentId?: string;
  path: string;
  pathDepth: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  hasChildren?: boolean;
  childrenCount?: number;
};
```

### Testing
```bash
cd frontend
npm install
npx tsc --noEmit
# Should compile with 0 errors (after dependency install)
```

---

## Defect #6-10: Lower Priority Issues

### Defect #6: Missing API Endpoints (Documentation Drift)
**Severity**: 🟢 LOW  
**Scope**: Feature flags API

Documentation shows dedicated endpoints that don't exist:
- `PUT /api/feature-flags/{flag_name}/disable`
- `PUT /api/feature-flags/{flag_name}/rollout`
- `POST /api/feature-flags/{flag_name}/rollback`

Generic `PUT /api/feature-flags/{flag_name}` can handle these, but specific endpoints missing.

---

### Defect #7: Undocumented LTREE Endpoints
**Severity**: 🟢 LOW  
**Scope**: LTREE refresh API

4 automated endpoints implemented but not documented:
- `POST /api/entities/refresh/automated/start`
- `POST /api/entities/refresh/automated/stop`
- `POST /api/entities/refresh/automated/force`
- `GET /api/entities/refresh/automated/metrics`

---

### Defect #8: Undocumented WebSocket Messages
**Severity**: 🟢 LOW  
**Scope**: WebSocket layer

7 message types implemented but not in `WEBSOCKET_LAYER_MESSAGES.md`:
- `entity_update`
- `hierarchy_change`
- `bulk_update`
- `cache_invalidate`
- `search_update`
- `heartbeat`
- `error`

---

### Defect #9: Hardcoded `is_map_v1_enabled()` Return
**Severity**: 🟢 LOW  
**Scope**: Feature flags service

```python
# feature_flag_service.py:110-113
def is_map_v1_enabled(self) -> bool:
    """Check if map_v1 feature flag is enabled."""
    # TODO: Implement actual check
    return True  # ❌ Hardcoded
```

Should query actual `ff.map_v1` flag from database.

---

### Defect #10: Duplicate/Obsolete Files
**Severity**: 🟢 LOW  
**Scope**: Repository hygiene

- `requirements_new.txt` (20 bytes - empty?)
- `README.backup.md`
- `ts_errors_latest.txt` vs `ts_errors_current.txt`

Should be removed or populated.

---

## Summary Table

| # | Defect | Severity | Impact | Effort | Risk |
|---|--------|----------|--------|--------|------|
| 1 | Feature flag name mismatch | 🔴 CRITICAL | HIGH | 2h | Breaking |
| 2 | Flag dependencies not enforced | 🔴 CRITICAL | HIGH | 1h | Medium |
| 3 | WebSocket structure drift | 🟡 MEDIUM | MEDIUM | 2h | Breaking |
| 4 | Performance threshold not enforced | 🟡 MEDIUM | MEDIUM | 30m | None |
| 5 | Entity type not exported | 🟡 MEDIUM | MEDIUM | 1m | None |
| 6 | Missing API endpoints | 🟢 LOW | LOW | 1h | None |
| 7 | Undocumented LTREE endpoints | 🟢 LOW | LOW | 30m | None |
| 8 | Undocumented WS messages | 🟢 LOW | LOW | 30m | None |
| 9 | Hardcoded map_v1 check | 🟢 LOW | LOW | 15m | None |
| 10 | Duplicate files | 🟢 LOW | TRIVIAL | 5m | None |

---

**End of bug_report.md**
