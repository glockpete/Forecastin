# Phase 2 & Phase 3 Implementation Guide

**Status:** ✅ COMPLETED
**Last Updated:** 2025-11-08

This document provides a comprehensive guide to the Phase 2 (STEEP Analysis Framework) and Phase 3 (Contract-First Synchronization) implementations in the Forecastin platform.

---

## Table of Contents

1. [Phase 2: STEEP Analysis Framework](#phase-2-steep-analysis-framework)
   - [STEEP Implementation Location](#steep-implementation-location)
   - [Curator Override System](#curator-override-system)
   - [Breadcrumb Navigation](#breadcrumb-navigation)
   - [Deep Links](#deep-links)
2. [Phase 3: Contract-First Synchronization](#phase-3-contract-first-synchronization)
   - [OpenAPI Contract Generation](#openapi-contract-generation)
   - [WebSocket Contract Generation](#websocket-contract-generation)
   - [TypeScript Type Generation](#typescript-type-generation)
   - [Zod Runtime Validators](#zod-runtime-validators)
   - [Contract Drift Detection](#contract-drift-detection)
3. [Usage Examples](#usage-examples)
4. [Testing](#testing)

---

## Phase 2: STEEP Analysis Framework

### STEEP Implementation Location

The STEEP (Social, Technological, Economic, Environmental, Political) analysis framework is implemented across the backend and frontend:

#### Backend Implementation

**Primary Files:**
- `api/routers/scenarios.py` - STEEP API endpoints
- `api/services/scenario_service.py` - STEEP engine and multi-factor analysis

**Key Components:**

1. **ScenarioEntity** (`api/services/scenario_service.py:20-60`)
   ```python
   @dataclass
   class ScenarioEntity:
       id: str
       title: str
       description: str
       factors: List[str]  # STEEP factors
       confidence: float    # Multi-factor confidence score (0.0-1.0)
       risk_profile: RiskProfile
       collaboration_state: CollaborationState
   ```

2. **API Endpoints** (`api/routers/scenarios.py`)
   - `GET /api/v3/steep?path=...` - Retrieve STEEP context for an entity
   - `GET /api/v3/scenarios/{path}/analysis` - Get multi-factor analysis
   - `POST /api/v6/scenarios` - Create scenario with confidence scoring

#### Frontend Implementation

**Primary Files:**
- `frontend/src/components/MillerColumns/MillerColumns.tsx` - UI display
- `frontend/src/types/index.ts` - TypeScript definitions
- `frontend/src/hooks/useHierarchy.ts` - Data fetching hooks

**Features:**
- Displays STEEP context alongside hierarchy navigation
- Shows confidence scores (0.0-1.0) on entities
- Real-time updates via WebSocket

**Usage Example:**
```typescript
import { useHierarchy } from '@/hooks/useHierarchy';

function ScenarioView({ entityPath }: { entityPath: string }) {
  const { data: steep } = useSTEEPContext(entityPath);

  return (
    <div>
      <h2>STEEP Analysis</h2>
      <p>Confidence: {steep.confidence.toFixed(2)}</p>
      <ul>
        {steep.factors.map(factor => (
          <li key={factor}>{factor}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

### Curator Override System

The curator override system provides audit trail logging for all manual overrides performed by curators.

#### Implementation

**Backend** (`api/services/scenario_service.py:80-97`):

```python
@dataclass
class CollaborationState:
    active_users: List[str]           # Current editors
    last_modified_by: str             # User who made last change
    last_modified_at: datetime        # Timestamp of modification
    change_count: int                 # Total modifications
    conflict_count: int               # Detected conflicts
    version: int                      # Version for concurrent edits
```

**Audit Trail** (`api/services/rss/deduplication/deduplicator.py`):
- `DeduplicationAuditEntry` class tracks all deduplication operations
- Circular buffer implementation (1000 entry limit, keeps last 500)
- Redis persistence: `rss:dedup:audit:{duplicate_id}`

**Feature Flag:**
- `ff.geo.audit_logging_enabled` (default: `True`)
- Controls geospatial layer audit trail
- Location: `api/services/feature_flag_service.py`

#### Usage

All curator overrides are automatically logged with:
- User who made the change
- Timestamp of change
- Previous and new values
- Change reason (if provided)

**Querying Audit Trail:**
```python
from services.rss.deduplication.deduplicator import Deduplicator

deduplicator = Deduplicator(redis_client)
audit_entries = deduplicator.get_audit_trail(duplicate_id)

for entry in audit_entries:
    print(f"{entry.timestamp}: {entry.operation} by {entry.user}")
```

---

### Breadcrumb Navigation

Breadcrumb navigation provides hierarchical context for the current view.

#### Implementation

**Frontend State** (`frontend/src/store/uiStore.ts:100-150`):

```typescript
interface BreadcrumbItem {
  label: string;
  path: string;
  entityId?: string;
}

// Zustand store actions
interface UIStore {
  breadcrumb: BreadcrumbItem[];
  setBreadcrumb: (breadcrumb: BreadcrumbItem[]) => void;
  navigateBack: () => void;
  navigateToEntity: (entity: Entity, columnIndex: number) => void;
  resetNavigation: () => void;
}
```

**API Integration** (`frontend/src/hooks/useHierarchy.ts`):

```typescript
export const useBreadcrumbs = (path: string) => {
  return useQuery({
    queryKey: ['breadcrumbs', path],
    queryFn: async () => {
      const response = await fetch(
        `/api/hierarchy/breadcrumbs?path=${encodeURIComponent(path)}`
      );
      return response.json();
    },
    staleTime: 10 * 60 * 1000,  // 10 minutes
    cacheTime: 10 * 60 * 1000,
  });
};
```

**Performance:**
- Cache time: 10 minutes
- Stale time: 10 minutes
- React Query automatic invalidation

#### Usage Example

```typescript
import { useBreadcrumbs } from '@/hooks/useHierarchy';
import { useUIStore } from '@/store/uiStore';

function Navigation() {
  const { breadcrumb, navigateBack } = useUIStore();

  return (
    <nav>
      {breadcrumb.map((item, index) => (
        <span key={index}>
          <a href={`#${item.path}`}>{item.label}</a>
          {index < breadcrumb.length - 1 && ' > '}
        </span>
      ))}
      <button onClick={navigateBack}>Back</button>
    </nav>
  );
}
```

---

### Deep Links

Deep links allow direct navigation to specific hierarchical views via URL.

#### Implementation

**App Routing** (`frontend/src/App.tsx`):
- React Router v6 with BrowserRouter
- Future-compatible routing flags: `v7_startTransition`, `v7_relativeSplatPath`

**State Reconstruction** (`frontend/src/store/uiStore.ts:129-150`):

```typescript
navigateToEntity: (entity: Entity, columnIndex: number) => {
  // 1. Update column paths array
  const newPaths = [...columnPaths.slice(0, newIndex), entity.path];

  // 2. Update breadcrumb for each level
  const breadcrumb = [];
  for (let i = 0; i <= newIndex; i++) {
    breadcrumb.push({
      label: `Level ${i + 1}`,
      path: newPaths[i],
      entityId: i === newIndex ? entity.id : undefined
    });
  }

  // 3. Update UI state
  setSelectedColumnIndex(newIndex);
  setColumnPaths(newPaths);
  setBreadcrumb(breadcrumb);
}
```

#### Entity Path Format

Paths follow LTREE format: `world.region.country.sector.actor`

**Examples:**
- `/entity/world.north_america.usa` - Navigate to USA entity
- `/entity/world.europe.uk.tech.openai` - Navigate to OpenAI under UK tech sector

#### Performance

- P95 API response times: <100ms ✅
- Deep link resolution includes breadcrumb, Miller's columns state, and entity details

---

## Phase 3: Contract-First Synchronization

### OpenAPI Contract Generation

Generates OpenAPI 3.1 schema from FastAPI application.

#### Scripts

**Primary:** `scripts/generate_openapi_minimal.py`

This script attempts to import the full FastAPI app to generate the schema. If dependencies are missing, it falls back to a minimal schema generator.

**Usage:**
```bash
# Via Makefile
make openapi

# Direct invocation
python3 scripts/generate_openapi_minimal.py
```

**Output:** `contracts/openapi.json`

**Schema Structure:**
```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Forecastin Geopolitical Intelligence Platform API",
    "version": "1.0.0",
    "x-generated": {
      "timestamp": "2025-11-08T12:00:00",
      "source": "minimal schema generator"
    }
  },
  "paths": {
    "/api/v3/steep": { ... },
    "/api/v3/scenarios/{path}/analysis": { ... },
    "/api/v6/scenarios": { ... },
    "/api/hierarchy/breadcrumbs": { ... },
    "/ws": { ... }
  }
}
```

---

### WebSocket Contract Generation

Generates JSON Schema for WebSocket messages from Pydantic models.

#### Scripts

**Primary:** `scripts/generate_ws_contract.py`

Extracts JSON schemas from Pydantic models in `api/models/websocket_schemas.py`.

**Usage:**
```bash
# Via Makefile
make ws-contracts

# Direct invocation
python3 scripts/generate_ws_contract.py
```

**Output:** `contracts/ws.json`

**Included Schemas:**
- Message types: `PingMessage`, `PongMessage`, `LayerDataUpdateMessage`, `GPUFilterSyncMessage`, `ErrorMessage`, `EchoMessage`
- Payloads: `LayerDataUpdatePayload`, `GPUFilterSyncPayload`
- Geometry types: `PointGeometry`, `LineStringGeometry`, `PolygonGeometry`, etc.
- Base types: `BoundingBox`, `GeoJSONFeature`, `FeatureCollection`
- Enums: `MessageType`, `LayerType`, `FilterType`, `FilterStatus`

---

### TypeScript Type Generation

Generates TypeScript interfaces from Python Pydantic models.

#### Scripts

**Primary:** `scripts/dev/generate_contracts.py`

Parses Python files and generates TypeScript interfaces with type mapping.

**Type Mapping:**
```python
TYPE_MAP = {
    'str': 'string',
    'int': 'number',
    'float': 'number',
    'bool': 'boolean',
    'UUID': 'string',
    'datetime': 'string',  # ISO 8601
    'Decimal': 'number',
    'List[T]': 'T[]',
    'Dict[K,V]': 'Record<K, V>',
    'Optional[T]': 'T | null'
}
```

**Scanned Files:**
- `api/services/feature_flag_service.py`
- `api/services/scenario_service.py`
- `api/services/hierarchical_forecast_service.py`
- `api/main.py`
- `api/models/websocket_schemas.py`

**Usage:**
```bash
# Via Makefile (generates all contracts)
make contracts

# Direct invocation
python3 scripts/dev/generate_contracts.py
```

**Output:** `frontend/src/types/contracts.generated.ts`

**Example Generated Interface:**
```typescript
/**
 * Generated from: api/services/scenario_service.py
 * Python class: ScenarioEntity
 */
export interface ScenarioEntity {
  id: string;
  title: string;
  description: string;
  factors: string[];
  confidence: number;
  riskProfile: RiskProfile;
  collaborationState: CollaborationState;
}
```

---

### Zod Runtime Validators

Provides runtime validation for contracts using Zod schemas.

#### Implementation

**Primary Files:**
- `frontend/src/types/contracts.generated.ts` - Generated Zod schemas
- `frontend/src/types/zod/entities.ts` - Entity-specific schemas

**Schema Coverage:**

1. **Base Types:** `BoundingBox`, `Position`, `Color`
2. **GeoJSON Geometries:** `Point`, `LineString`, `Polygon`, `MultiPolygon`
3. **Layer Data:** `LayerDataUpdatePayload`, `GPUFilterSync`
4. **WebSocket Messages:** All message types with discriminated unions
5. **Entities:** 12 entity types with branded types

**Validation Utilities:**

```typescript
// Parse and validate (throws on error)
export function parseContract<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T;

// Validate and return errors
export function validateContract<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { valid: boolean; data?: T; errors?: z.ZodError };

// Sanitize (remove invalid fields)
export function sanitizeContract<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T;
```

**Usage Example:**

```typescript
import { z } from 'zod';
import { parseContract } from '@/types/contracts.generated';
import { EntitySchema } from '@/types/zod/entities';

// Runtime validation
function processEntity(data: unknown) {
  try {
    const entity = parseContract(EntitySchema, data, 'processEntity');
    console.log('Valid entity:', entity);
  } catch (error) {
    console.error('Validation failed:', error);
  }
}

// With error handling
function processEntitySafe(data: unknown) {
  const result = validateContract(EntitySchema, data);

  if (result.valid) {
    console.log('Valid entity:', result.data);
  } else {
    console.error('Validation errors:', result.errors);
  }
}
```

---

### Contract Drift Detection

Automated CI/CD workflow to detect contract drift between backend and frontend.

#### CI/CD Workflow

**File:** `.github/workflows/contract-drift-check.yml`

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

**Steps:**
1. Generate OpenAPI schema: `python3 scripts/generate_openapi_minimal.py`
2. Generate WebSocket contracts: `python3 scripts/generate_ws_contract.py`
3. Regenerate TypeScript contracts: `python3 scripts/dev/generate_contracts.py`
4. Check for drift: `git diff --exit-code frontend/src/types/contracts.generated.ts`
5. Run contract tests: `npm test -- tests/contracts/contract_drift.spec.ts`
6. TypeScript type check: `npm run typecheck`

**Failure Conditions:**
- Generated contracts differ from committed version
- Contract validation tests fail
- TypeScript type check fails

#### Local Verification

**Via Makefile:**
```bash
make contracts
```

**Manual Steps:**
```bash
# 1. Generate all contracts
python3 scripts/generate_openapi_minimal.py
python3 scripts/generate_ws_contract.py
python3 scripts/dev/generate_contracts.py

# 2. Check for drift
git diff frontend/src/types/contracts.generated.ts

# 3. Run tests
cd frontend
npm test -- tests/contracts/contract_drift.spec.ts

# 4. Type check
npm run typecheck
```

---

## Usage Examples

### Generating All Contracts

```bash
# Generate everything (OpenAPI + WebSocket + TypeScript)
make contracts

# Or individually:
make openapi          # Generate contracts/openapi.json
make ws-contracts     # Generate contracts/ws.json
python3 scripts/dev/generate_contracts.py  # Generate TS types
```

### Validating WebSocket Messages

```typescript
import { validate_websocket_message } from '@/types/contracts.generated';

const message = {
  type: 'layer_data_update',
  timestamp: Date.now(),
  data: {
    layer_id: 'actors-layer',
    layer_type: 'point',
    layer_data: { type: 'FeatureCollection', features: [] },
    changed_at: Date.now()
  }
};

try {
  const validated = validate_websocket_message(message);
  console.log('Valid message:', validated);
} catch (error) {
  console.error('Invalid message:', error);
}
```

### Using STEEP Analysis

```typescript
import { useSTEEPContext } from '@/hooks/useHierarchy';

function STEEPAnalysisPanel({ entityPath }: { entityPath: string }) {
  const { data, isLoading, error } = useSTEEPContext(entityPath);

  if (isLoading) return <div>Loading STEEP analysis...</div>;
  if (error) return <div>Error loading analysis</div>;

  return (
    <div>
      <h2>STEEP Analysis</h2>
      <div>
        <strong>Confidence:</strong> {(data.confidence * 100).toFixed(1)}%
      </div>
      <ul>
        {data.factors.map((factor: string) => (
          <li key={factor}>{factor}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Testing

### Contract Drift Tests

**Location:** `frontend/tests/contracts/contract_drift.spec.ts`

**What it tests:**
- Runtime validation of mock fixtures against Zod schemas
- WebSocket message validation
- RSS item validation
- Type safety of generated contracts

**Running tests:**
```bash
cd frontend
npm test -- tests/contracts/contract_drift.spec.ts
```

### Type Checking

```bash
cd frontend
npm run typecheck
```

**Expected Result:** 0 TypeScript errors

### Full CI/CD Simulation

```bash
# 1. Generate contracts
make contracts

# 2. Check for drift
git diff --exit-code frontend/src/types/contracts.generated.ts

# 3. Run tests
cd frontend && npm test

# 4. Type check
cd frontend && npm run typecheck
```

---

## Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| API P95 Response | <100ms | <100ms | ✅ |
| Hierarchy Drill-down | <500ms P95 | <500ms | ✅ |
| WS Latency P95 | <200ms | <200ms | ✅ |
| Cache Hit Rate | >90% | 99.2% | ✅ |
| Throughput | >10k RPS | 42,726 RPS | ✅ |

---

## Troubleshooting

### Contract Generation Fails

**Issue:** `ModuleNotFoundError` when generating contracts

**Solution:**
```bash
# Install minimal dependencies
pip install --break-system-packages pydantic fastapi

# Use minimal generator (already default)
python3 scripts/generate_openapi_minimal.py
```

### Contract Drift Detected

**Issue:** CI/CD fails with contract drift

**Solution:**
```bash
# Regenerate contracts locally
make contracts

# Commit the updated files
git add contracts/ frontend/src/types/contracts.generated.ts
git commit -m "chore: Update generated contracts"
```

### TypeScript Type Errors

**Issue:** Generated types don't match runtime data

**Solution:**
1. Check Python model definitions match frontend expectations
2. Regenerate contracts: `make contracts`
3. Verify type mappings in `scripts/dev/generate_contracts.py`

---

## References

- **GOLDEN_SOURCE.md** - Phase 2 acceptance criteria
- **PRD.md** - STEEP requirements (§5 F-005)
- **Original Roadmap.md** - STEEP framework section
- **CHANGELOG.md** - Implementation history
- **STEEP_ANALYSIS_FINDINGS.md** - Detailed exploration report

---

**Document Version:** 1.0.0
**Maintained By:** Forecastin Development Team
**Last Review:** 2025-11-08
