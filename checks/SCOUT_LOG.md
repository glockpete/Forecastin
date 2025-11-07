# SCOUT LOG - Code Audit Trail
**Audit Date**: 2025-11-06
**Target**: TypeScript/React + FastAPI Codebase
**Method**: Code-Only Static Analysis (No Runtime)

## Entry Format
`{timestamp} | {component} | {file:line} | {symptom} | {hypothesis} | {proof} | {fix} | {residual_risk}`

---

## 001 | WebSocket Message Schema | Multiple Files | CRITICAL
**Component**: WebSocket Communication Layer
**Files**:
- frontend/src/hooks/useWebSocket.ts:80-90
- frontend/src/types/index.ts:57-63
- api/main.py:128-145

**Symptom**: No discriminated union type for WebSocket messages; frontend handles messages with loose `any` types.

**Hypothesis**: Current `WebSocketMessage` interface uses `type: string` and `data?: any`, which prevents:
1. Exhaustive type checking
2. Compile-time validation of message payloads
3. Type-safe message handlers

**Proof**:
```typescript
// frontend/src/types/index.ts:57-63
export interface WebSocketMessage {
  type: string;  // ❌ Should be discriminated union
  data?: any;     // ❌ No type safety
  error?: string;
  channels?: string[];
  timestamp?: string;
}
```

```typescript
// frontend/src/hooks/useWebSocket.ts:80-90
switch (message.type) {
  case 'entity_update':
  case 'hierarchy_change':
  case 'layer_data_update':
  case 'gpu_filter_sync':
  case 'serialization_error':
    // ❌ No type narrowing, data.* access is unsafe
    console.log(`Received ${message.type}:`, message.data);
    break;
}
```

**Fix**: Create discriminated union in `types/ws_messages.ts` with:
- Type guards for each message kind
- Exhaustive switch helpers
- Strict payload types per message type

**Residual Risk**: LOW after fix. Migration requires updating all message handlers.

---

## 002 | Contract Drift | Backend ↔ Frontend | HIGH
**Component**: Scenario Entity Serialization
**Files**:
- api/services/scenario_service.py:101-138
- frontend/src/types/outcomes.ts:26-48

**Symptom**: Backend `ScenarioEntity` uses camelCase in `to_dict()` but Pydantic dataclasses have snake_case fields.

**Hypothesis**: Serialization inconsistency causes frontend to receive different field names than expected.

**Proof**:
```python
# api/services/scenario_service.py:101-138
@dataclass
class ScenarioEntity:
    scenario_id: str
    path: str
    path_depth: int      # ❌ snake_case field
    path_hash: str       # ❌ snake_case field
    confidence_score: float
    risk_assessment: RiskProfile
    validation_status: ValidationStatus
    collaboration_data: CollaborationState

    def to_dict(self) -> Dict[str, Any]:
        return {
            'scenario_id': self.scenario_id,
            'path': self.path,
            'path_depth': self.path_depth,    # ❌ snake_case in JSON
            'path_hash': self.path_hash,      # ❌ snake_case in JSON
            'confidence_score': self.confidence_score,
            ...
        }
```

Frontend has NO corresponding `ScenarioEntity` type at all.

**Fix**:
1. Add Pydantic `Config` with `alias_generator = to_camel` for automatic conversion
2. Generate TypeScript interfaces from Pydantic models
3. Create `scripts/dev/generate_contracts.py` for automation

**Residual Risk**: MEDIUM. Existing code may rely on snake_case; requires testing.

---

## 003 | Optional Fields | Frontend Types | MEDIUM
**Component**: Entity Type Definition
**Files**:
- frontend/src/types/index.ts:7-20

**Symptom**: Many optional fields without safe access guards or normalization.

**Hypothesis**: Runtime access to undefined optional fields causes errors.

**Proof**:
```typescript
// frontend/src/types/index.ts:7-20
export interface Entity {
  id: string;
  name: string;
  type: string;
  parentId?: string;        // ❌ Optional, no guard
  path: string;
  pathDepth: number;
  confidence?: number;      // ❌ Optional, no guard
  metadata?: Record<string, any>;  // ❌ any type
  createdAt?: string;       // ❌ Optional date string
  updatedAt?: string;       // ❌ Optional date string
  hasChildren?: boolean;    // ❌ Optional
  childrenCount?: number;   // ❌ Optional
}
```

**Fix**:
1. Create constructor/mapper functions that normalize optionals
2. Use `Required<Pick<Entity, 'id' | 'name'>>` + `Partial<...>` pattern
3. Add safe accessor utilities: `getConfidence(entity): number`

**Residual Risk**: LOW after migration. Requires component updates.

---

## 004 | WebSocket Handler Idempotency | Frontend Hook | HIGH
**Component**: WebSocket Message Handler
**Files**: frontend/src/hooks/useWebSocket.ts:60-102

**Symptom**: Message handler does NOT deduplicate messages or maintain message order invariants.

**Hypothesis**: Duplicate messages or out-of-order delivery causes:
1. Double cache updates
2. UI flickering
3. Stale data overwriting fresh data

**Proof**:
```typescript
// frontend/src/hooks/useWebSocket.ts:60-102
const handleMessage = useCallback((event: MessageEvent) => {
  try {
    const message = JSON.parse(event.data);

    if (typeof message !== 'object' || !message.type) {
      console.warn('Invalid WebSocket message structure:', message);
      return;
    }

    setLastMessage(message);  // ❌ No dedup, no ordering check
    setError(null);

    if (onMessage) {
      onMessage(message);  // ❌ Called for every duplicate
    }
    // ...
}, [onMessage]);
```

**Fix**:
1. Add message ID and timestamp to backend message schema
2. Implement message deduplication using LRU cache (last 100 message IDs)
3. Add sequence numbers for ordering enforcement
4. Create idempotent cache update functions

**Residual Risk**: MEDIUM. Requires backend changes for message IDs.

---

## 005 | Serialization Type Mismatch | Backend | MEDIUM
**Component**: `safe_serialize_message` Implementation
**Files**:
- api/main.py:128-145
- api/services/realtime_service.py:167-199

**Symptom**: Duplicated `safe_serialize_message()` functions with slightly different implementations.

**Hypothesis**: Code duplication causes inconsistent serialization behavior.

**Proof**:
```python
# api/main.py:128-145
def safe_serialize_message(message: Dict[str, Any]) -> str:
    try:
        return orjson.dumps(message, option=orjson.OPT_NON_STR_KEYS).decode('utf-8')
    except Exception as e:
        logger.error(f"Serialization error: {e}")
        error_response = {
            "type": "serialization_error",
            "error": str(e),
            "timestamp": time.time()
        }
        return orjson.dumps(error_response).decode('utf-8')
```

```python
# api/services/realtime_service.py:167-199
def safe_serialize_message(message: Dict[str, Any]) -> str:
    try:
        return orjson.dumps(message, option=orjson.OPT_NON_STR_KEYS).decode('utf-8')
    except Exception as e:
        logger.error(f"Serialization error: {e}")
        error_response = {
            "type": "serialization_error",
            "error": str(e),
            "timestamp": time.time(),
            "original_message_type": message.get("type", "unknown")  # ✅ Extra field
        }
        try:
            return orjson.dumps(error_response).decode('utf-8')
        except Exception as serialize_error:
            return '{"type": "serialization_error", "error": "Failed to serialize error response"}'
```

**Fix**:
1. Consolidate into single implementation in `api/services/serialization_utils.py`
2. Import from single source
3. Add unit tests for datetime, dataclass, Decimal, set serialization

**Residual Risk**: LOW. Simple refactoring.

---

## 006 | Missing TypeScript Strict Checks | Frontend Config | MEDIUM
**Component**: TypeScript Configuration
**Files**: frontend/tsconfig.json

**Symptom**: Need to verify strict mode settings and potential excess property errors.

**Hypothesis**: Without strict mode, excess properties and unsafe assignments slip through.

**Proof**: Need to read tsconfig.json to confirm strict settings.

**Fix**: Ensure:
- `"strict": true`
- `"noImplicitAny": true`
- `"strictNullChecks": true`
- `"strictPropertyInitialization": true`

**Residual Risk**: LOW if already configured.

---

## 007 | React Query Cache Keys | Frontend Hooks | MEDIUM
**Component**: Cache Key Factory
**Files**: frontend/src/types/outcomes.ts:206-217

**Symptom**: Cache keys use object reference equality in filters, causing cache misses.

**Hypothesis**: Passing `{ role: ['ceo'] }` twice creates two different object references, leading to duplicate fetches.

**Proof**:
```typescript
// frontend/src/types/outcomes.ts:206-217
export const outcomesKeys = {
  all: ['outcomes'] as const,
  opportunities: () => [...outcomesKeys.all, 'opportunities'] as const,
  opportunitiesFiltered: (filters: LensFilters) =>
    [...outcomesKeys.opportunities(), filters] as const,  // ❌ Object reference
  // ...
}
```

**Fix**: Serialize filters to stable string representation:
```typescript
opportunitiesFiltered: (filters: LensFilters) =>
  [...outcomesKeys.opportunities(), JSON.stringify(filters)] as const,
```

**Residual Risk**: LOW. Requires test updates.

---

## 008 | LTREE Path Validation | Backend/Frontend | MEDIUM
**Component**: Entity Path Handling
**Files**:
- api/services/scenario_service.py:109
- frontend/src/types/index.ts:12

**Symptom**: No validation for LTREE path format on frontend.

**Hypothesis**: Invalid paths sent to backend cause database errors.

**Proof**: Frontend `Entity.path: string` has no validation. Backend expects valid LTREE paths (e.g., `"root.child.grandchild"`).

**Fix**:
1. Add LTREE path validator on frontend: `/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/`
2. Add zod schema for runtime validation
3. Create path builder utility

**Residual Risk**: LOW. Backend already validates, frontend validation is defensive.

---

## 009 | Reconnection Exponential Backoff | Frontend WebSocket | LOW
**Component**: WebSocket Reconnection Logic
**Files**: frontend/src/hooks/useWebSocket.ts:178-194

**Symptom**: Current implementation is CORRECT and follows best practices.

**Hypothesis**: No issue found. Implementation uses exponential backoff with jitter.

**Proof**:
```typescript
// frontend/src/hooks/useWebSocket.ts:178-194
if (!isManualDisconnect.current && reconnectCountRef.current < reconnectAttempts) {
  // Exponential backoff: 3s, 6s, 12s, 24s, 30s (capped)
  const baseDelay = reconnectInterval * Math.pow(2, reconnectCountRef.current);
  // Add jitter: ±20% randomization to prevent thundering herd
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
  const delay = Math.min(baseDelay + jitter, 30000);

  console.log(`[useWebSocket] Reconnecting in ${delay.toFixed(0)}ms (attempt ${reconnectCountRef.current + 1}/${reconnectAttempts})...`);
  reconnectTimeoutRef.current = setTimeout(() => {
    reconnectCountRef.current++;
    connect();
  }, delay);
}
```

**Fix**: None needed. Document as best practice example.

**Residual Risk**: NONE.

---

## 010 | Frontend Date Handling | Type Definition | MEDIUM
**Component**: Entity Date Fields
**Files**: frontend/src/types/index.ts:16-17

**Symptom**: Dates represented as `string` without ISO validation.

**Hypothesis**: Invalid date strings cause Date parsing errors.

**Proof**:
```typescript
// frontend/src/types/index.ts:16-17
export interface Entity {
  // ...
  createdAt?: string;  // ❌ No validation, should be ISO string
  updatedAt?: string;  // ❌ No validation
}
```

**Fix**:
1. Add branded type: `type ISODateString = string & { __brand: 'ISODateString' }`
2. Add validator: `function isISODate(s: string): s is ISODateString`
3. Add parse utility: `function parseEntityDate(s?: string): Date | undefined`

**Residual Risk**: LOW. Defensive improvement.

---

## 011 | Feature Flag Rollout Calculation | Frontend Hook | HIGH
**Component**: Feature Flag Evaluation
**Files**:
- api/services/feature_flag_service.py:36-56
- frontend/src/hooks/useFeatureFlag.ts

**Symptom**: Need to verify frontend correctly implements rollout percentage logic.

**Hypothesis**: Mismatch in hash-based bucketing causes inconsistent flag evaluation.

**Proof**: Need to read frontend implementation to compare with backend.

**Fix**: Ensure both use same hash algorithm (likely MD5 or SHA256) and modulo logic.

**Residual Risk**: HIGH if mismatch exists.

---

## 012 | GPS/GeoJSON Type Inconsistency | Layer Types | MEDIUM
**Component**: Geospatial Entity Types
**Files**: frontend/src/layers/types/layer-types.ts

**Symptom**: Need to verify GeoJSON type definitions match actual backend responses.

**Hypothesis**: Geometry type mismatch causes rendering errors.

**Proof**: Need to read layer-types.ts and compare with backend GeoJSON generation.

**Fix**: Generate types from GeoJSON spec or use @types/geojson.

**Residual Risk**: MEDIUM. Geospatial data is complex.

---

## Next Steps
- Continue analyzing layer system types
- Read tsconfig.json to verify strict mode
- Analyze frontend useFeatureFlag implementation
- Read full layer-types.ts for contract drift
- Examine cache invalidation strategy in useHybridState
- Identify N+1 query patterns in hierarchy resolver usage

---
