# BUG-002: Test Fixtures Missing Required layerId Property

**Severity:** P0 - CRITICAL  
**Priority:** High  
**Type:** Bug  
**Status:** Open  
**Assignee:** TBD  
**Labels:** `bug`, `critical`, `testing`, `websocket`

## Description

MessageDeduplicator tests fail with "Cannot read properties of undefined (reading 'layerId')" because test message fixtures don't include the `data.layerId` property required by `LayerDataUpdateMessage` schema.

## Impact

- **Test failures:** 8 test failures in realtimeHandlers.test.ts
- **WebSocket validation broken:** Message validation fails due to missing required properties
- **Category:** Testing

## Affected Components

- `tests/realtimeHandlers.test.ts` - MessageDeduplicator test suite
- WebSocket message validation system

## Reproduction Steps

1. Run `npm test`
2. Observe 8 failures in MessageDeduplicator test suite
3. Error at `src/types/ws_messages.ts:969` - `layerMsg.data.layerId`
4. Error message: "Cannot read properties of undefined (reading 'layerId')"

## Expected Behavior

Test messages should match `LayerDataUpdateMessage` schema with all required properties, including `data.layerId`.

## Actual Behavior

Test messages are missing the `data.layerId` property, causing undefined access error during validation.

## Proposed Fix

Update test fixtures in `tests/realtimeHandlers.test.ts` to include the required `layerId` property:

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

## Code References

- **File:** `tests/realtimeHandlers.test.ts`
- **Schema:** `src/types/ws_messages.ts` - LayerDataUpdateMessage definition
- **Related:** REPORT.md Section 3, Failed Tests 1-8
- **Estimated Fix Time:** 30 minutes

## Acceptance Criteria

- [ ] All MessageDeduplicator tests pass
- [ ] Test fixtures include all required properties per WebSocket message schemas
- [ ] No undefined property access errors during test execution
- [ ] WebSocket message validation works correctly in tests

## Additional Context

This issue affects the reliability of WebSocket message handling tests and should be fixed to ensure proper validation of real-time data updates.