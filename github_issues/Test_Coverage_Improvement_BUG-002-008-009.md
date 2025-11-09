# Test Coverage Improvement (BUG-002, BUG-008, BUG-009)

**Severity:** P1 - HIGH  
**Priority:** High  
**Type:** Testing  
**Status:** Open  
**Assignee:** TBD  
**Labels:** `testing`, `bug`, `coverage`, `websocket`, `geospatial`

## Description

Three critical test-related issues require immediate attention to restore test reliability and coverage. These issues affect WebSocket message validation, geospatial integration tests, and layer type guards.

## Issues Included

1. **BUG-002:** Test fixtures missing required `layerId` property
2. **BUG-008:** Test framework mismatch in GeospatialIntegrationTests  
3. **BUG-009:** Missing type guards in layer-types.test.ts

## Evidence from Documentation

### BUG-002: Test Fixtures Missing layerId ([`checks/bug_report.md`](checks/bug_report.md:66-104))
**Impact:** 8 test failures in realtimeHandlers.test.ts, WebSocket validation broken

**Root Cause:** MessageDeduplicator tests fail with "Cannot read properties of undefined (reading 'layerId')" because test message fixtures don't include the required `data.layerId` property.

**Fix Required:**
```typescript
const testMessage: LayerDataUpdateMessage = {
  type: 'layer_data_update',
  data: {
    layerId: 'test-layer-1',  // ADD THIS REQUIRED PROPERTY
    operation: 'update',
    layerType: 'point',
    entities: [],
    affectedBounds: { /* ... */ }
  },
  timestamp: Date.now()
};
```

### BUG-008: Test Framework Mismatch ([`checks/bug_report.md`](checks/bug_report.md:332-369))
**Impact:** Test file broken, 0 tests execute

**Root Cause:** GeospatialIntegrationTests.test.ts imports from `@jest/globals` but project uses Vitest, causing runtime error: "Do not import '@jest/globals' outside of the Jest test environment"

**Fix Required:**
```typescript
// Before
import { describe, it, expect } from '@jest/globals';

// After
import { describe, it, expect } from 'vitest';

// Replace Jest APIs:
// jest.fn() → vi.fn()
// jest.mock() → vi.mock() 
// jest.spyOn() → vi.spyOn()
```

### BUG-009: Missing Type Guards ([`checks/bug_report.md`](checks/bug_report.md:373-425))
**Impact:** Test file broken, 0 tests execute

**Root Cause:** Test file references `isLayerData()`, `isVisualChannel()`, `isGPUFilterConfig()` type guards that don't exist, causing ReferenceError.

**Fix Required:**
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

## Test Coverage Context

### Current Coverage Status ([`checks/HONEST_REVIEW.md`](checks/HONEST_REVIEW.md:273-276))
**Evidence Required:** 90%+ test coverage for integration scenarios including cache coordination

**Test Scenario:** All component interactions tested with database and Redis dependencies

### Integration Test Gap ([`checks/HONEST_REVIEW.md`](checks/HONEST_REVIEW.md:212-216))
**Missing:** Comprehensive integration test suite

**Evidence:** Pipeline references integration tests that don't exist in the repository

## Affected Components

### BUG-002 (WebSocket Validation)
- `tests/realtimeHandlers.test.ts` - MessageDeduplicator test suite
- WebSocket message validation system
- `src/types/ws_messages.ts` - LayerDataUpdateMessage schema

### BUG-008 (Geospatial Tests)  
- `src/layers/tests/GeospatialIntegrationTests.test.ts` - Geospatial integration tests
- Test framework configuration

### BUG-009 (Layer Type Guards)
- `src/layers/types/layer-types.test.ts` - Layer type validation tests
- `src/layers/types/layer-types.ts` - Type guard implementations

## Proposed Solution

### Phase 1: Immediate Test Fixes (Critical)
1. **Fix BUG-002:** Update test fixtures with required `layerId` property
2. **Fix BUG-008:** Replace Jest imports with Vitest equivalents
3. **Fix BUG-009:** Implement missing type guards

### Phase 2: Test Coverage Expansion
1. **Create Integration Test Suite:** Add `tests/integration/` directory
2. **Add Performance Tests:** Validate <1.25ms performance targets
3. **Expand WebSocket Tests:** Cover all 28+ message types

### Phase 3: Continuous Improvement
1. **Add Coverage Requirements:** Enforce 90%+ coverage in CI
2. **Performance Monitoring:** Add SLO validation to tests
3. **Security Testing:** Include message validation fuzzing

## Acceptance Criteria

### BUG-002 Acceptance
- [ ] All MessageDeduplicator tests pass
- [ ] Test fixtures include all required properties per WebSocket message schemas
- [ ] No undefined property access errors during test execution
- [ ] WebSocket message validation works correctly in tests

### BUG-008 Acceptance  
- [ ] GeospatialIntegrationTests.test.ts executes without errors
- [ ] All Vitest imports correctly configured
- [ ] Jest APIs replaced with Vitest equivalents
- [ ] Test file contributes to coverage metrics

### BUG-009 Acceptance
- [ ] layer-types.test.ts executes without ReferenceError
- [ ] All type guards implemented and exported
- [ ] Type validation tests pass
- [ ] Type guards used in production code where appropriate

## Estimated Effort

**Total: 2-3 hours**
- **BUG-002:** 30 minutes
- **BUG-008:** 30 minutes  
- **BUG-009:** 1 hour
- **Testing & Validation:** 30 minutes

## Related Documentation

- [`checks/bug_report.md`](checks/bug_report.md) - Comprehensive bug analysis
- [`checks/HONEST_REVIEW.md`](checks/HONEST_REVIEW.md) - Codebase review findings
- Test coverage requirements and performance targets

## Additional Context

These test issues represent critical gaps in the testing infrastructure that prevent reliable validation of core functionality. Fixing them will:
- Restore test reliability for WebSocket message handling
- Enable geospatial feature testing
- Improve type safety through proper validation
- Contribute to overall test coverage goals

The platform's sophisticated architecture (four-tier caching, WebSocket validation, performance targets) requires robust testing to ensure reliability at scale.