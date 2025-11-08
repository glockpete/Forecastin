# Bug Report - Top 25 Defects

**Generated:** 2025-11-07
**Repository:** Forecastin Geopolitical Intelligence Platform
**Branch:** claude/forecastin-discovery-baseline-011CUu2Hzx1f4SFqQ6QgZ4Wh

---

## Bug Severity Classification

- **P0 (Critical):** Blocks development, compilation, or core functionality
- **P1 (High):** Major functionality broken, security risk, compliance violation
- **P2 (Medium):** Feature partially broken, performance degraded
- **P3 (Low):** Minor issue, cosmetic, code quality

---

## P0 - Critical Bugs (5 bugs)

### BUG-001: Missing Type Exports Block TypeScript Compilation

**Severity:** P0 - CRITICAL
**Impact:** TypeScript compilation fails with 89 errors, blocks build
**Affected Files:** 5+ component files
**Category:** Type System

**Description:**
`types/contracts.generated.ts` missing exports for utility functions and types:
- `getConfidence` (3 import attempts)
- `getChildrenCount` (2 import attempts)
- `Entity` type from useHierarchy.ts (1 import)
- `fromEntityId` function (1 import, should be `EntityId`)

**Reproduction Steps:**
1. Run `npx tsc --noEmit`
2. Observe errors in EntityDetail.tsx:24, MillerColumns.tsx:42, SearchInterface.tsx:21

**Expected Behavior:**
All types and utility functions should be exported from contracts.generated.ts

**Actual Behavior:**
TypeScript errors: "Module has no exported member 'getConfidence'"

**Proposed Fix:**
Add utility exports to contracts.generated.ts:
```typescript
export function getConfidence(entity: Entity): number {
  return entity.confidence ?? 0;
}

export function getChildrenCount(entity: Entity): number {
  return entity.childrenCount ?? 0;
}
```

Export Entity from useHierarchy.ts:
```typescript
export type { Entity } from '../types';
```

**Estimated Fix Time:** 15 minutes
**Related:** REPORT.md Section 2, Category 1

---

### BUG-002: Test Fixtures Missing Required layerId Property

**Severity:** P0 - CRITICAL
**Impact:** 8 test failures in realtimeHandlers.test.ts, WebSocket validation broken
**Affected Files:** tests/realtimeHandlers.test.ts
**Category:** Testing

**Description:**
MessageDeduplicator tests fail with "Cannot read properties of undefined (reading 'layerId')" because test message fixtures don't include the `data.layerId` property required by `LayerDataUpdateMessage` schema.

**Reproduction Steps:**
1. Run `npm test`
2. Observe 8 failures in MessageDeduplicator test suite
3. Error at src/types/ws_messages.ts:969 - `layerMsg.data.layerId`

**Expected Behavior:**
Test messages should match LayerDataUpdateMessage schema with all required properties

**Actual Behavior:**
Test messages missing `data.layerId`, causing undefined access error

**Proposed Fix:**
Update test fixtures in `tests/realtimeHandlers.test.ts`:
```typescript
const testMessage: LayerDataUpdateMessage = {
  type: 'layer_data_update',
  data: {
    layerId: 'test-layer-1',  // ADD THIS
    operation: 'update',
    layerType: 'point',
    entities: [],
    affectedBounds: { /* ... */ }
  },
  timestamp: Date.now()
};
```

**Estimated Fix Time:** 30 minutes
**Related:** REPORT.md Section 3, Failed Tests 1-8

---

### BUG-003: HierarchyResponse Type Missing .entities Property

**Severity:** P0 - CRITICAL
**Impact:** 6 TypeScript errors, data access broken in navigation components
**Affected Files:** MillerColumns.tsx, SearchInterface.tsx
**Category:** Type System / API Contract

**Description:**
Frontend code expects `HierarchyResponse<EntityType>` to have an `.entities` property, but the type definition doesn't include it. This causes TypeScript errors and potential runtime failures.

**Reproduction Steps:**
1. Run `npx tsc --noEmit`
2. Observe errors at:
   - MillerColumns.tsx:160,213,329
   - SearchInterface.tsx:78,80,195
3. Error message: "Property 'entities' does not exist on type 'HierarchyResponse<EntityType>'"

**Expected Behavior:**
HierarchyResponse should include entities array:
```typescript
interface HierarchyResponse<T extends EntityType> {
  entities: Entity<T>[];
  total?: number;
  hasMore?: boolean;
}
```

**Actual Behavior:**
Type definition missing `.entities` property

**Proposed Fix:**
Add `.entities` property to `HierarchyResponse` interface in types/index.ts

**Alternative Fix:**
If backend returns different property name, update frontend code to use correct property

**Estimated Fix Time:** 15 minutes (type fix) or 1 hour (refactor frontend code)
**Related:** REPORT.md Section 2, Category 2; checks/api_ui_drift.md Section 3 Issue 1

---

### BUG-004: Missing Enum Definitions in Generated Contracts

**Severity:** P0 - CRITICAL
**Impact:** 3 TypeScript errors, contract types incomplete
**Affected Files:** types/contracts.generated.ts
**Category:** Type System / Code Generation

**Description:**
`contracts.generated.ts` references `RiskLevel` and `ValidationStatus` enums that are not defined, causing compilation errors.

**Reproduction Steps:**
1. Run `npx tsc --noEmit`
2. Observe errors at types/contracts.generated.ts:89,122,165
3. Error: "Cannot find name 'RiskLevel'" and "Cannot find name 'ValidationStatus'"

**Expected Behavior:**
All referenced types should be defined or imported

**Actual Behavior:**
Enums referenced but not defined

**Proposed Fix Option 1 (Regenerate):**
Run contract generator: `python scripts/dev/generate_contracts.py`

**Proposed Fix Option 2 (Manual):**
Add enum definitions to contracts.generated.ts:
```typescript
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ValidationStatus {
  PENDING = 'pending',
  VALID = 'valid',
  INVALID = 'invalid'
}
```

**Estimated Fix Time:** 5 minutes (regenerate) or 15 minutes (manual)
**Related:** REPORT.md Section 2, Category 7; checks/api_ui_drift.md Section 3 Issue 3

---

### BUG-005: api/main.py Exceeds Maintainability Threshold

**Severity:** P0 - CRITICAL (Architecture)
**Impact:** Maintenance burden, difficult to test, violates single responsibility
**Affected Files:** api/main.py (2,014 LOC)
**Category:** Architecture / Code Organization

**Description:**
`api/main.py` contains 2,014 lines combining FastAPI app initialization, route handlers, middleware, startup/shutdown logic, and configuration. This violates single responsibility principle and makes the codebase difficult to maintain and test.

**Reproduction Steps:**
1. Open api/main.py
2. Observe file length: `wc -l api/main.py` → 2,014
3. Observe mixed concerns: routes, middleware, configuration all in one file

**Expected Behavior:**
FastAPI application should be organized into:
- main.py (200-300 LOC) - App initialization only
- routers/ - Separate router modules per domain
- middleware/ - Middleware modules
- config.py - Configuration

**Actual Behavior:**
All concerns mixed in single 2,014 LOC file

**Proposed Fix:**
Refactor into modular structure:
```
api/
├── main.py (200-300 LOC) - App initialization
├── routers/
│   ├── hierarchy.py - Hierarchy endpoints
│   ├── entities.py - Entity CRUD
│   ├── scenarios.py - Scenario endpoints
│   ├── websocket.py - WebSocket endpoints
│   └── feature_flags.py - Feature flag endpoints
└── middleware/
    ├── auth.py
    ├── cors.py
    └── error_handlers.py
```

**Estimated Fix Time:** 4-6 hours with full test coverage
**Related:** SCOUT_LOG.md Section 4, Critical Issue 1

---

## P1 - High Priority Bugs (10 bugs)

### BUG-006: exactOptionalPropertyTypes Violations (24 occurrences)

**Severity:** P1 - HIGH
**Impact:** Strict TypeScript compilation mode violations
**Affected Files:** 10+ files (Outcomes components, utils, handlers)
**Category:** Type Safety

**Description:**
TypeScript's `exactOptionalPropertyTypes: true` flag requires optional properties to explicitly include `| undefined` in their type declaration. 24 occurrences violate this rule.

**Pattern:**
```typescript
// ERROR: Type 'T | undefined' is not assignable to type 'T'
interface Props {
  onClick?: () => void;  // Should be: onClick?: (() => void) | undefined
}

// Usage that triggers error:
<Component onClick={handleClick || undefined} />
```

**Affected Files:**
- ActionQueue.tsx - onStatusChange prop
- EvidencePanel.tsx - onClick prop, object checks
- HorizonLane.tsx - selectedId prop
- OutcomesDashboard.tsx - LensFilters properties
- ErrorBoundary.tsx - setState with undefined
- errorCatalog.ts - context and stack properties
- LayerWebSocketIntegration.ts - details property
- uiStore.ts - entityId property
- clientId.ts - string assignments
- idempotencyGuard.ts - Timeout and Date
- validation.ts - schemaName property

**Proposed Fix (Choose One):**
1. Add `| undefined` to optional property types (recommended)
2. Remove undefined assignments, use object spread
3. Disable `exactOptionalPropertyTypes` (not recommended)

**Estimated Fix Time:** 2-3 hours for all 24 occurrences
**Related:** REPORT.md Section 2, Category 3

---

### BUG-007: Accessibility Violations - WCAG Non-Compliance (20 occurrences)

**Severity:** P1 - HIGH (Legal/Compliance Risk)
**Impact:** Website unusable for keyboard users, WCAG 2.1 AA non-compliant
**Affected Files:** MillerColumns, EvidencePanel, SearchInterface, OpportunityRadar, StakeholderMap
**Category:** Accessibility / Compliance

**Description:**
20 accessibility violations detected by ESLint jsx-a11y rules:
- 8 occurrences: Click handlers without keyboard listeners
- 8 occurrences: Non-interactive elements with click handlers
- 1 occurrence: autoFocus usage (reduces accessibility)
- 3 occurrences: Unescaped entities in JSX

**Examples:**
```typescript
// BAD: No keyboard handler
<div onClick={handleClick}>Click me</div>

// GOOD: Keyboard accessible
<div
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabIndex={0}
>
  Click me
</div>
```

**Legal Risk:** WCAG 2.1 AA compliance required for government/enterprise contracts

**Proposed Fix:**
1. Add keyboard handlers (onKeyDown/onKeyPress) alongside onClick
2. Add ARIA role="button" and tabIndex={0}
3. Replace div/span with <button> where appropriate
4. Remove autoFocus or add user preference check
5. Escape special characters in JSX text

**Estimated Fix Time:** 3-4 hours
**Related:** REPORT.md Section 4, Critical Errors

---

### BUG-008: Test Framework Mismatch in GeospatialIntegrationTests

**Severity:** P1 - HIGH
**Impact:** Test file broken, 0 tests execute
**Affected Files:** src/layers/tests/GeospatialIntegrationTests.test.ts
**Category:** Testing

**Description:**
Test file imports from `@jest/globals` but project uses Vitest, causing runtime error: "Do not import '@jest/globals' outside of the Jest test environment"

**Reproduction Steps:**
1. Run `npm test`
2. Observe error in GeospatialIntegrationTests.test.ts
3. Error at node_modules/@jest/globals/build/index.js:23

**Expected Behavior:**
Test file should use Vitest imports

**Actual Behavior:**
Test file uses Jest imports, incompatible with Vitest runner

**Proposed Fix:**
Replace Jest imports with Vitest:
```typescript
// Before
import { describe, it, expect } from '@jest/globals';

// After
import { describe, it, expect } from 'vitest';
```

Replace Jest APIs:
- `jest.fn()` → `vi.fn()`
- `jest.mock()` → `vi.mock()`
- `jest.spyOn()` → `vi.spyOn()`

**Estimated Fix Time:** 30 minutes
**Related:** REPORT.md Section 3, Failed Test Files

---

### BUG-009: Missing Type Guards in layer-types.test.ts

**Severity:** P1 - HIGH
**Impact:** Test file broken, 0 tests execute
**Affected Files:** src/layers/types/layer-types.test.ts
**Category:** Testing

**Description:**
Test file references `isLayerData()`, `isVisualChannel()`, `isGPUFilterConfig()` type guards that don't exist, causing ReferenceError.

**Reproduction Steps:**
1. Run `npm test`
2. Observe error: "ReferenceError: isLayerData is not defined"
3. Error at line 193

**Expected Behavior:**
Type guards should be defined and exported from layer-types.ts

**Actual Behavior:**
Type guards don't exist, test file cannot execute

**Proposed Fix:**
Implement type guards in `src/layers/types/layer-types.ts`:
```typescript
export function isLayerData(value: unknown): value is LayerData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'layerId' in value &&
    'layerType' in value
  );
}

export function isVisualChannel(value: unknown): value is VisualChannel {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'type' in value
  );
}

export function isGPUFilterConfig(value: unknown): value is GPUFilterConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'enabled' in value
  );
}
```

**Estimated Fix Time:** 1 hour
**Related:** REPORT.md Section 3, Failed Test Files

---

### BUG-010: Python Version Mismatch Between CI and Repository

**Severity:** P1 - HIGH
**Impact:** CI may not catch Python 3.11+ compatibility issues
**Affected Files:** .github/workflows/ci.yml, pyproject.toml
**Category:** CI/CD Configuration

**Description:**
CI workflow uses Python 3.9 (`PYTHON_VERSION: "3.9"`), but pyproject.toml specifies `requires-python = ">=3.11"`. This version mismatch means CI won't catch Python 3.11+ specific issues.

**Reproduction Steps:**
1. Check .github/workflows/ci.yml line 14: `PYTHON_VERSION: "3.9"`
2. Check pyproject.toml line 10: `requires-python = ">=3.11"`
3. Observe mismatch

**Expected Behavior:**
CI should use Python 3.11 to match repository requirements

**Actual Behavior:**
CI uses Python 3.9, doesn't test actual production environment

**Proposed Fix:**
Update .github/workflows/ci.yml:
```yaml
env:
  PYTHON_VERSION: "3.11"  # Changed from "3.9"
  NODE_VERSION: "18"
```

**Estimated Fix Time:** 2 minutes
**Related:** DISCOVERY.md Section 8, Issue 1; REPORT.md Section 10

---

### BUG-011: 13 NPM Security Vulnerabilities

**Severity:** P1 - HIGH (Security)
**Impact:** Potential security exploits (7 moderate, 6 high)
**Affected Files:** package-lock.json
**Category:** Security / Dependencies

**Description:**
NPM audit reports 13 vulnerabilities in frontend dependencies:
- 7 moderate severity
- 6 high severity

**Reproduction Steps:**
1. cd frontend
2. npm audit
3. Observe 13 vulnerabilities listed

**Expected Behavior:**
All dependencies should be free of known vulnerabilities

**Actual Behavior:**
13 vulnerabilities in dependency tree

**Proposed Fix:**
Run automated fix:
```bash
npm audit fix --force
```

**Warning:** `--force` may introduce breaking changes, test thoroughly after

**Manual Fix Required For:**
Check if any vulnerabilities cannot be auto-fixed and require manual dependency upgrades

**Estimated Fix Time:** 1-2 hours (including testing after fix)
**Related:** REPORT.md Section 1, Security Vulnerabilities

---

### BUG-012: Safety Version Conflict in Requirements Files

**Severity:** P1 - HIGH (Security)
**Impact:** Inconsistent security scanning results
**Affected Files:** api/requirements.txt, api/requirements-dev.txt
**Category:** Dependencies / Security

**Description:**
The `safety` security scanning tool has version mismatch:
- requirements.txt: `safety==3.7.0`
- requirements-dev.txt: `safety==2.3.5`

This means different environments may report different vulnerabilities.

**Reproduction Steps:**
1. Check api/requirements.txt line 56: `safety==3.7.0`
2. Check api/requirements-dev.txt line 19: `safety==2.3.5`
3. Observe version mismatch

**Expected Behavior:**
Both files should specify same safety version

**Actual Behavior:**
2 different versions specified

**Proposed Fix:**
Update api/requirements-dev.txt:
```diff
- safety==2.3.5
+ safety==3.7.0
```

**Estimated Fix Time:** 2 minutes
**Related:** DISCOVERY.md Section 8, Issue 3; REPORT.md Section 10

---

### BUG-013: Explicit 'any' Types Reduce Type Safety (30+ occurrences)

**Severity:** P1 - HIGH
**Impact:** Reduced type safety, potential runtime errors
**Affected Files:** GeospatialView, realtimeHandlers, feature-flags, and 10+ more
**Category:** Type Safety

**Description:**
30+ uses of `any` type detected by ESLint, bypassing TypeScript's type checking. This can lead to runtime errors that would be caught at compile time with proper typing.

**Examples:**
- GeospatialView.tsx: 10 any types (callback parameters, event handlers)
- realtimeHandlers.ts: 8 any types (message data, query keys)
- feature-flags.ts: 2 any types (variant data)

**Proposed Fix:**
Replace `any` with specific types:
```typescript
// Before
function handleMessage(message: any) { ... }

// After
function handleMessage(message: WebSocketMessage) { ... }
```

Use `unknown` with type guards for truly dynamic data:
```typescript
function parseData(data: unknown) {
  if (isWebSocketMessage(data)) {
    // TypeScript knows data is WebSocketMessage here
  }
}
```

**Estimated Fix Time:** 4-5 hours for all 30+ occurrences
**Related:** REPORT.md Section 4, Category 4

---

### BUG-014: React Hook Dependency Violations (8+ occurrences)

**Severity:** P1 - HIGH
**Impact:** Stale closures, infinite loops, bugs from missing dependencies
**Affected Files:** GeospatialView, OutcomesDashboard
**Category:** React Hooks

**Description:**
ESLint react-hooks/exhaustive-deps rule detects missing dependencies in useEffect, useCallback, useMemo hooks. This can cause stale closures (accessing old values) or unstable dependencies (causing infinite re-renders).

**Examples:**
1. **GeospatialView.tsx:158** - useCallback missing 6 dependencies
   ```typescript
   const handleMessage = useCallback(() => {
     handleEntityUpdate(...);  // Not in dependency array
     handleLayerMessage(...);  // Not in dependency array
     // ... 4 more missing
   }, []); // Empty array - missing dependencies!
   ```

2. **OutcomesDashboard.tsx:70** - useMemo with unstable dependency
   ```typescript
   const filteredOpps = useMemo(() => {
     return opportunities.filter(...);  // 'opportunities' changes every render
   }, [opportunities]);  // Should wrap 'opportunities' in useMemo
   ```

**Proposed Fix:**
Add missing dependencies:
```typescript
const handleMessage = useCallback(() => {
  handleEntityUpdate(...);
}, [handleEntityUpdate, handleLayerMessage, ...]); // Add all dependencies
```

Stabilize dependencies:
```typescript
const opportunities = useMemo(() => data?.opportunities ?? [], [data]);
const filteredOpps = useMemo(() => {
  return opportunities.filter(...);
}, [opportunities]); // Now stable
```

**Estimated Fix Time:** 2-3 hours
**Related:** REPORT.md Section 4, Category 5

---

### BUG-015: Feature Flag Infrastructure Unused (88% adoption gap)

**Severity:** P1 - HIGH
**Impact:** Gradual rollout mechanism exists but not used, risky deployments
**Affected Files:** 5 layer implementations, LayerWebSocketIntegration
**Category:** Feature Management

**Description:**
Feature flag infrastructure is fully implemented (backend service, frontend hook, local config) but only 1 out of 9 defined flags is used. Layer implementations don't check flags before executing, preventing gradual rollout and safe testing.

**Defined Flags:**
- ✅ ff.map_v1 - USED (2 components)
- ❌ ff.geospatial_layers - NOT USED
- ❌ ff.point_layer - NOT USED
- ❌ ff.polygon_layer - NOT USED
- ❌ ff.heatmap_layer - NOT USED
- ❌ ff.clustering_enabled - NOT USED
- ❌ ff.gpu_filtering - NOT USED
- ❌ ff.websocket_layers - NOT USED
- ❌ ff.realtime_updates - NOT USED

**Impact:**
- Cannot gradually roll out geospatial features
- Cannot A/B test layer rendering performance
- Cannot quickly rollback problematic changes
- Cannot monitor performance per feature

**Proposed Fix:**
Add flag checks to layer implementations:
```typescript
// In PointLayer.ts constructor
const { isEnabled } = useFeatureFlag('ff.point_layer');
if (!isEnabled) {
  return null; // Or throw error
}
```

**Estimated Fix Time:** 6-8 hours for all integrations
**Related:** checks/feature_flags_map.md Section 7-9

---

## P2 - Medium Priority Bugs (5 bugs)

### BUG-016: Deprecated File Not Removed

**Severity:** P2 - MEDIUM
**Impact:** Clutters codebase, potential confusion
**Affected Files:** frontend/src/types/zod/messages.ts.deprecated (7KB)
**Category:** Code Organization

**Description:**
Deprecated file `messages.ts.deprecated` still exists in codebase. Should be removed to avoid confusion and reduce codebase size.

**Proposed Fix:**
```bash
rm frontend/src/types/zod/messages.ts.deprecated
git add frontend/src/types/zod/messages.ts.deprecated
git commit -m "chore: remove deprecated messages.ts file"
```

**Estimated Fix Time:** 2 minutes
**Related:** checks/ts_prune.txt, Deprecated Files

---

### BUG-017: 100+ Unused Imports Clutter Codebase

**Severity:** P2 - MEDIUM
**Impact:** Code smell, confusing for developers, increases bundle size
**Affected Files:** 20+ files
**Category:** Code Quality

**Description:**
ESLint reports 100+ unused variable/import warnings across codebase. While not blocking functionality, this creates confusion and increases bundle size.

**Top Offenders:**
- App.tsx: 10 unused imports
- MillerColumns.tsx: 8 unused imports
- GeospatialView.tsx: 5 unused imports

**Proposed Fix:**
Run ESLint autofix:
```bash
npx eslint src --ext .ts,.tsx --fix
```

Review and manually remove remaining unused code

**Estimated Fix Time:** 1-2 hours (mostly automated)
**Related:** REPORT.md Section 4, Category 1

---

### BUG-018: 50+ Console Statements in Production Code

**Severity:** P2 - MEDIUM
**Impact:** Unstructured logging, performance overhead, information leakage
**Affected Files:** GeospatialView (14), OutcomesDashboard (4), MillerColumns (6), 10+ more
**Category:** Code Quality / Security

**Description:**
50+ console.log statements throughout codebase. Production code should use structured logging, not console statements.

**Issues:**
- Performance: Console statements can slow down application
- Security: May leak sensitive information to browser console
- Monitoring: Cannot aggregate logs, set alerts, or search logs
- Debugging: Difficult to filter relevant logs

**Proposed Fix:**
Replace with structured logging:
```typescript
// Before
console.log('Layer loaded:', layerId);

// After
logger.info('Layer loaded', { layerId, timestamp: Date.now() });
```

Implement logger service with log levels (debug, info, warn, error)

**Estimated Fix Time:** 2-3 hours
**Related:** REPORT.md Section 4, Category 2

---

### BUG-019: Query Key Type Safety - 'any' in Filters

**Severity:** P2 - MEDIUM
**Impact:** Reduced type safety in React Query cache keys
**Affected Files:** frontend/src/hooks/useHierarchy.ts:32
**Category:** Type Safety

**Description:**
Search query key factory uses `any` type for filters parameter, reducing type safety and potentially causing cache key instability.

**Current Code:**
```typescript
search: (query: string, filters?: any) =>
  [...hierarchyKeys.all, 'search', query, filters] as const,
```

**Issues:**
- `filters: undefined` vs `filters: { type: 'actor' }` create different cache keys
- No type safety for filter properties
- Can cause unexpected cache misses

**Proposed Fix:**
Define proper filter type:
```typescript
type SearchFilters = {
  type?: EntityType;
  confidence?: number;
  dateRange?: { start: string; end: string };
};

search: (query: string, filters?: SearchFilters) =>
  [...hierarchyKeys.all, 'search', query, filters ?? null] as const,
```

**Estimated Fix Time:** 15 minutes
**Related:** SCOUT_LOG.md Section 6

---

### BUG-020: Missing 'as const' on Stats Query Key

**Severity:** P2 - MEDIUM
**Impact:** Type inference may be less precise
**Affected Files:** frontend/src/hooks/useHierarchy.ts:167
**Category:** Type Safety

**Description:**
Stats query key uses tuple syntax but missing `as const`, making it inconsistent with other query keys.

**Current Code:**
```typescript
queryKey: [...hierarchyKeys.all, 'stats']  // Missing 'as const'
```

**Proposed Fix:**
```typescript
// Option 1: Add to factory (recommended)
export const hierarchyKeys = {
  // ...
  stats: () => [...hierarchyKeys.all, 'stats'] as const,
};

// Option 2: Inline as const
queryKey: [...hierarchyKeys.all, 'stats'] as const
```

**Estimated Fix Time:** 5 minutes
**Related:** SCOUT_LOG.md Section 6

---

## P3 - Low Priority Bugs (5 bugs)

### BUG-021: Peer Dependency Conflicts

**Severity:** P3 - LOW
**Impact:** Warning messages during npm install, potential compatibility issues
**Affected Files:** package.json
**Category:** Dependencies

**Description:**
@types/node version mismatch: package.json specifies ^16.18.59, but vitest requires ^18.0.0 || >=20.0.0.

**Current Workaround:** `--legacy-peer-deps` flag

**Proposed Fix:**
Update package.json:
```json
{
  "devDependencies": {
    "@types/node": "^18.0.0"  // Changed from ^16.18.59
  }
}
```

**Estimated Fix Time:** 5 minutes (+ testing)
**Related:** REPORT.md Section 1

---

### BUG-022: 12 Deprecated NPM Packages

**Severity:** P3 - LOW
**Impact:** Future maintenance burden, potential security issues
**Affected Packages:** glob@7, svgo@1, eslint@8, inflight, expression-eval, and 7 more
**Category:** Dependencies

**Description:**
12 npm packages are deprecated and should be upgraded to maintained versions.

**Top Priority:**
- eslint@8 → eslint@9 (no longer supported)
- glob@7 → glob@10 (security fixes)
- svgo@1 → svgo@2 (security fixes)

**Proposed Fix:**
Gradual upgrades:
```bash
npm install --save-dev eslint@latest
npm install --save-dev glob@latest
npm install --save-dev svgo@latest
```

Test after each upgrade

**Estimated Fix Time:** 3-4 hours (including testing)
**Related:** REPORT.md Section 1, Deprecated Packages

---

### BUG-023: Missing Override Modifiers in ErrorBoundary

**Severity:** P3 - LOW
**Impact:** TypeScript 4.3+ requirement violation
**Affected Files:** src/components/UI/ErrorBoundary.tsx
**Category:** Code Quality

**Description:**
4 React lifecycle methods need `override` keyword per TypeScript 4.3+ requirements.

**Proposed Fix:**
```typescript
override componentDidCatch(error: Error, errorInfo: ErrorInfo) { ... }
override componentDidMount() { ... }
override componentWillUnmount() { ... }
override render() { ... }
```

**Estimated Fix Time:** 5 minutes
**Related:** REPORT.md Section 2, Category 5

---

### BUG-024: Inconsistent Type Import Style

**Severity:** P3 - LOW
**Impact:** Code style inconsistency
**Affected Files:** 25+ files
**Category:** Code Style

**Description:**
ESLint detects 25+ files importing types without using `import type` syntax, violating `@typescript-eslint/consistent-type-imports` rule.

**Example:**
```typescript
// Current (inconsistent)
import { Entity } from './types';  // Only used as type

// Should be
import type { Entity } from './types';
```

**Proposed Fix:**
Run ESLint autofix:
```bash
npx eslint src --ext .ts,.tsx --fix --rule '@typescript-eslint/consistent-type-imports: error'
```

**Estimated Fix Time:** 10 minutes (automated)
**Related:** REPORT.md Section 4, Category 3

---

### BUG-025: Unescaped Entities in JSX (4 occurrences)

**Severity:** P3 - LOW
**Impact:** Minor display issue, potential XSS in edge cases
**Affected Files:** EvidencePanel.tsx, SearchInterface.tsx
**Category:** Code Quality

**Description:**
4 unescaped quote characters in JSX text should be escaped for correctness.

**Examples:**
```typescript
// Current
<div>"Invalid input"</div>

// Should be
<div>&quot;Invalid input&quot;</div>
// Or
<div>{'"Invalid input"'}</div>
```

**Proposed Fix:**
Manually escape or wrap in JavaScript string

**Estimated Fix Time:** 10 minutes
**Related:** REPORT.md Section 4, Critical Errors

---

## Summary

### Bug Count by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| **P0** | 5 | Critical - Blocks development/compilation |
| **P1** | 10 | High - Major functionality/security issues |
| **P2** | 5 | Medium - Code quality/performance |
| **P3** | 5 | Low - Minor issues/code style |
| **Total** | 25 | |

### Estimated Fix Effort

| Priority | Total Effort | Recommended Timeline |
|----------|--------------|---------------------|
| **P0** | 6-9 hours | Fix immediately (today) |
| **P1** | 20-28 hours | Fix this week |
| **P2** | 6-9 hours | Fix next sprint |
| **P3** | 4-5 hours | Fix opportunistically |
| **TOTAL** | 36-51 hours | 1-2 weeks focused effort |

### Quick Wins (< 30 min each)

1. BUG-001: Export missing types (15 min)
2. BUG-004: Add enum definitions (15 min)
3. BUG-010: Update CI Python version (2 min)
4. BUG-012: Align safety version (2 min)
5. BUG-016: Remove deprecated file (2 min)
6. BUG-019: Type search filters (15 min)
7. BUG-020: Add 'as const' to stats key (5 min)
8. BUG-021: Update @types/node (5 min)
9. BUG-023: Add override modifiers (5 min)
10. BUG-025: Escape JSX entities (10 min)

**Total Quick Wins Time:** ~1.5 hours

---

**END OF bug_report.md**
