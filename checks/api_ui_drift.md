# API ↔ UI Drift Analysis

**Generated:** 2025-11-07
**Status:** ⚠️ INCOMPLETE - No OpenAPI schema available

---

## Executive Summary

API/UI contract drift cannot be fully validated due to missing OpenAPI schema. This report documents known mismatches based on TypeScript errors and frontend API usage patterns.

---

## 1. Missing OpenAPI Schema

**Searched Locations:**
- `/openapi.json` - ❌ NOT FOUND
- `/openapi.yaml` - ❌ NOT FOUND
- `/api/openapi.json` - ❌ NOT FOUND
- `/docs/openapi.yaml` - ❌ NOT FOUND

**Expected Generator:** `scripts/dev/generate_contracts.py` exists but not run

**Recommendation:** Run generator to create OpenAPI schema:
```bash
python scripts/dev/generate_contracts.py
```

---

## 2. Frontend API Endpoints (Detected)

From `frontend/src/hooks/useHierarchy.ts`:

### Hierarchy API

| Method | Endpoint | Frontend Usage | Backend Status |
|--------|----------|----------------|----------------|
| GET | `/api/hierarchy/root` | ✅ useRootHierarchy | ⚠️ UNKNOWN |
| GET | `/api/hierarchy/children?path={path}&depth={depth}` | ✅ useChildren | ⚠️ UNKNOWN |
| GET | `/api/hierarchy/breadcrumbs?path={path}` | ✅ useBreadcrumbs | ⚠️ UNKNOWN |
| GET | `/api/entities/{id}` | ✅ useEntity | ⚠️ UNKNOWN |
| GET | `/api/hierarchy/search?query={query}&filters={filters}` | ✅ useSearch | ⚠️ UNKNOWN |
| POST | `/api/entities` | ✅ useCreateEntity | ⚠️ UNKNOWN |
| PATCH | `/api/entities/{id}` | ✅ useUpdateEntity | ⚠️ UNKNOWN |
| DELETE | `/api/entities/{id}` | ✅ useDeleteEntity | ⚠️ UNKNOWN |
| POST | `/api/hierarchy/move` | ✅ useMoveEntity | ⚠️ UNKNOWN |
| GET | `/api/hierarchy/stats` | ✅ useHierarchyStats | ⚠️ UNKNOWN |

### Feature Flag API

From `frontend/src/hooks/useFeatureFlag.ts`:

| Method | Endpoint | Frontend Usage | Backend Status |
|--------|----------|----------------|----------------|
| GET | `/api/feature-flags/{flagName}` | ✅ useFeatureFlag | ⚠️ UNKNOWN |

### WebSocket Endpoint

From `frontend/src/integrations/LayerWebSocketIntegration.ts`:

| Protocol | Endpoint | Frontend Usage | Backend Status |
|----------|----------|----------------|----------------|
| WS | `/ws` (inferred) | ✅ LayerWebSocketIntegration | ⚠️ UNKNOWN |

---

## 3. Known Type Mismatches

### Issue 1: HierarchyResponse Missing `.entities` Property

**Severity:** HIGH

**Frontend Expectation:**
```typescript
interface HierarchyResponse<T extends EntityType> {
  entities: Entity<T>[];  // EXPECTED
  total?: number;
  hasMore?: boolean;
}
```

**TypeScript Errors (6 occurrences):**
- `src/components/MillerColumns/MillerColumns.tsx:160` - Property 'entities' does not exist
- `src/components/MillerColumns/MillerColumns.tsx:213` - Property 'entities' does not exist
- `src/components/MillerColumns/MillerColumns.tsx:329` - Property 'entities' does not exist
- `src/components/Search/SearchInterface.tsx:78` - Property 'entities' does not exist
- `src/components/Search/SearchInterface.tsx:80` - Property 'entities' does not exist
- `src/components/Search/SearchInterface.tsx:195` - Property 'entities' does not exist

**Backend Status:** ⚠️ UNKNOWN - Requires inspection of `api/main.py` hierarchy endpoints

**Fix Options:**
1. **Option A (Recommended):** Add `.entities` property to backend response
2. **Option B:** Update frontend to use actual property name returned by backend
3. **Option C:** Add response transformer in frontend API client

---

### Issue 2: Missing Utility Function Exports

**Severity:** HIGH

**Frontend Imports (5 occurrences):**
```typescript
import { getConfidence, getChildrenCount } from '../../../../types/contracts.generated';
```

**Files Affected:**
- `src/components/Entity/EntityDetail.tsx:24`
- `src/components/MillerColumns/MillerColumns.tsx:42`
- `src/components/Search/SearchInterface.tsx:21`

**contracts.generated.ts Status:** ❌ Functions NOT EXPORTED

**Fix:** Add utility function exports to contracts.generated.ts:
```typescript
export function getConfidence(entity: Entity): number {
  return entity.confidence ?? 0;
}

export function getChildrenCount(entity: Entity): number {
  return entity.childrenCount ?? 0;
}
```

---

### Issue 3: Missing Enum Definitions

**Severity:** HIGH

**TypeScript Errors:**
- `types/contracts.generated.ts:89` - Cannot find name 'RiskLevel'
- `types/contracts.generated.ts:122` - Cannot find name 'ValidationStatus'
- `types/contracts.generated.ts:165` - Cannot find name 'RiskLevel'

**Backend Status:** ⚠️ UNKNOWN - Pydantic models likely define these enums

**Fix:** Add enum definitions to contracts.generated.ts or import from proper module

---

### Issue 4: WebSocket Message Data Missing Properties

**Severity:** MEDIUM

**Frontend Expectation:**
```typescript
interface EntityUpdateMessage {
  type: 'entity_update';
  data: {
    entityId: string;  // EXPECTED
    entity: Entity;
  };
}
```

**TypeScript Error:**
- `src/handlers/realtimeHandlers.ts:118` - Property 'entityId' does not exist on type

**Backend Status:** ⚠️ UNKNOWN - Requires inspection of WebSocket message serialization in `api/services/websocket_manager.py`

---

## 4. Request/Response Type Mismatches

**Status:** ❌ CANNOT VERIFY - No OpenAPI schema available

**Potential Issues:**
1. Request body validation - Frontend may send fields backend doesn't expect
2. Response shape differences - Backend may return additional/different fields
3. Query parameter typing - String/number/boolean coercion mismatches
4. Enum value differences - Frontend and backend may use different enum values

**Required Actions:**
1. Generate OpenAPI schema from backend
2. Compare with frontend TypeScript types
3. Identify mismatches
4. Fix or document intentional differences

---

## 5. WebSocket Contract Validation

### Frontend WebSocket Message Types

**File:** `frontend/src/types/ws_messages.ts` (1,008 LOC)

**Message Types (Discriminated Union):**
- `entity_update`
- `hierarchy_change`
- `bulk_update`
- `cache_invalidate`
- `layer_data_update`
- `gpu_filter_sync`
- `performance_metrics`
- `error`
- `heartbeat`
- `connection_status`
- `subscription_update`
- `batch`
- (and 15+ more)

**Validation Status:**
- ✅ Frontend Zod validators PASS (23/23 tests in `tests/contracts/contract_drift.spec.ts`)
- ⚠️ Backend Pydantic models NOT VALIDATED against frontend types

### Backend WebSocket Implementation

**Files:**
- `api/services/websocket_manager.py` (714 LOC)
- `api/services/realtime_service.py` (686 LOC)

**Status:** ⚠️ UNKNOWN - Requires inspection

**Validation Required:**
1. Compare Pydantic message models with frontend TypeScript types
2. Validate serialization format (JSON structure)
3. Check required vs optional fields
4. Verify enum values match

---

## 6. Recommendations

### Immediate Actions (2-4 hours)

1. **Run contract generator:**
   ```bash
   python scripts/dev/generate_contracts.py
   git diff types/contracts.generated.ts
   ```

2. **Fix missing exports:**
   - Add `getConfidence` and `getChildrenCount` utility functions
   - Add `RiskLevel` and `ValidationStatus` enum definitions
   - Export `Entity` type from `useHierarchy.ts`

3. **Fix HierarchyResponse:**
   - Add `.entities` property to type definition OR
   - Update frontend code to use actual backend property name

### Short-term Actions (1-2 days)

4. **Generate OpenAPI schema:**
   - Add FastAPI OpenAPI export to `api/main.py`
   - Configure `operationId` for all endpoints
   - Export to `openapi.json`

5. **Set up drift validation:**
   - Add `openapi-typescript` to generate types from OpenAPI
   - Compare generated types with hand-written types
   - Add CI check to fail on drift

6. **Validate WebSocket contracts:**
   - Extract Pydantic models to separate file
   - Generate TypeScript types from Pydantic models
   - Compare with `ws_messages.ts`

### Long-term Actions (1-2 weeks)

7. **Automate contract generation:**
   - Add pre-commit hook to regenerate contracts
   - Add CI check to ensure contracts are up-to-date
   - Document contract generation process in CI.md

8. **Add contract testing:**
   - Use tools like Pact or Dredd for consumer-driven contract testing
   - Add backend tests that validate against frontend expectations
   - Add frontend tests that validate against backend OpenAPI schema

9. **Type-safe API client:**
   - Generate type-safe API client from OpenAPI schema
   - Replace hand-written fetch calls with generated client
   - Add runtime validation with Zod

---

## 7. Drift Detection Commands

**Once OpenAPI schema is available:**

```bash
# Generate TypeScript types from OpenAPI
npx openapi-typescript openapi.json -o src/types/api.generated.ts

# Compare with hand-written types
diff src/types/contracts.generated.ts src/types/api.generated.ts

# Validate requests/responses at runtime
npm install @hey-api/client-fetch
npx @hey-api/openapi-ts -i openapi.json -o src/generated/api-client
```

**For WebSocket contracts:**

```bash
# Generate TypeScript from Pydantic models
# (Requires pydantic-to-typescript or similar tool)
pydantic-to-typescript \
  --module api.models.websocket_messages \
  --output src/types/ws_messages.generated.ts

# Compare with hand-written types
diff src/types/ws_messages.ts src/types/ws_messages.generated.ts
```

---

**END OF api_ui_drift.md**
