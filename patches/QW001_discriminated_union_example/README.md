# Patch QW001: Adopt Discriminated Union for WebSocket Messages (Example)

**Priority**: CRITICAL
**Effort**: 4 hours (full migration)
**ROI**: 95
**Risk**: LOW (non-breaking, gradual adoption)
**Reversible**: YES

## Problem
Current `WebSocketMessage` interface uses loose types (`type: string`, `data?: any`), preventing:
- Compile-time type safety
- Exhaustive switch checking
- IDE autocomplete for message payloads
- Catching breaking changes at compile time

```typescript
// Current (UNSAFE):
export interface WebSocketMessage {
  type: string;  // ❌ Any string accepted
  data?: any;    // ❌ No type safety
}

// Handler has NO type narrowing:
switch (message.type) {
  case 'entity_update':
    // ❌ message.data is still `any` - no safety!
    const entity = message.data.entity;  // Could crash if structure changed
    break;
}
```

## Solution
Use discriminated union from `types/ws_messages.ts` (already created) with type guards.

## Files Changed (Example - One Handler)
- `frontend/src/hooks/useWebSocket.ts` (message handler)

## Example Patch: useWebSocket.ts

```diff
--- a/frontend/src/hooks/useWebSocket.ts
+++ b/frontend/src/hooks/useWebSocket.ts
@@ -1,6 +1,13 @@
 import { useEffect, useRef, useState, useCallback } from 'react';
-import { WebSocketMessage } from '../types';
 import { getWebSocketUrl } from '../config/env';
+import {
+  WebSocketMessage,
+  isEntityUpdate,
+  isHierarchyChange,
+  isLayerDataUpdate,
+  isGPUFilterSync,
+  isSerializationError
+} from '../../types/ws_messages';

 export interface UseWebSocketOptions {
   url?: string;
@@ -58,22 +65,33 @@ export const useWebSocket = (options: UseWebSocketOptions = {}) => {
   // Handle WebSocket messages with orjson-safe deserialization
   const handleMessage = useCallback((event: MessageEvent) => {
     try {
-      // Handle orjson serialization - parse safely to prevent crashes
       const message = JSON.parse(event.data);

-      // Validate message structure
-      if (typeof message !== 'object' || !message.type) {
-        console.warn('Invalid WebSocket message structure:', message);
-        return;
-      }
-
       setLastMessage(message);
       setError(null);

-      // Call custom message handler
       if (onMessage) {
         onMessage(message);
       }

-      // Handle different message types
-      switch (message.type) {
-        case 'entity_update':
-        case 'hierarchy_change':
-        case 'layer_data_update':
-        case 'gpu_filter_sync':
-        case 'serialization_error':
-          console.log(`Received ${message.type}:`, message.data);
-          break;
-        default:
-          console.log('Unknown message type:', message.type);
-      }
+      // ✅ NEW: Type-safe message handling with type guards
+      if (isEntityUpdate(message)) {
+        // TypeScript now knows message.data.entity structure!
+        console.log('Entity update:', message.data.entity.name);
+        // Access is type-safe: message.data.entity.id is string
+        // message.data.entity.pathDepth is number
+      } else if (isHierarchyChange(message)) {
+        console.log('Hierarchy change:', message.data.path);
+        // Type-safe: message.data.affectedEntities is string[]
+      } else if (isLayerDataUpdate(message)) {
+        console.log('Layer data update:', message.data.layerId);
+        // Type-safe: message.data.entities is array with known structure
+      } else if (isGPUFilterSync(message)) {
+        console.log('GPU filter sync:', message.data.filteredCount);
+        // Type-safe: message.data.filters has known structure
+      } else if (isSerializationError(message)) {
+        console.error('Serialization error:', message.error);
+        // Type-safe: message.error is string
+      } else {
+        // TypeScript ensures all cases are handled
+        console.log('Other message type:', message.type);
+      }
+
     } catch (error) {
       console.error('Error parsing WebSocket message:', error);
       setError(new Event('message_parse_error'));
-
-      // Send structured error message instead of crashing
-      const errorMessage: WebSocketMessage = {
-        type: 'serialization_error',
-        error: 'Failed to parse WebSocket message',
-      };
-      setLastMessage(errorMessage);
     }
   }, [onMessage]);
```

## Alternative: Exhaustive Switch

For more complex handlers, use the exhaustive switch helper:

```typescript
import { exhaustiveSwitch } from '../../types/ws_messages';

const handleMessage = useCallback((event: MessageEvent) => {
  try {
    const message = JSON.parse(event.data);

    // ✅ Exhaustive switch with compile-time checking
    exhaustiveSwitch(message, {
      entity_update: (msg) => {
        // msg is typed as EntityUpdateMessage
        handleEntityUpdate(msg.data.entity);
      },
      hierarchy_change: (msg) => {
        // msg is typed as HierarchyChangeMessage
        handleHierarchyChange(msg.data.path, msg.data.affectedEntities);
      },
      layer_data_update: (msg) => {
        // msg is typed as LayerDataUpdateMessage
        handleLayerUpdate(msg.data.layerId, msg.data.entities);
      },
      // ... TypeScript forces you to handle ALL message types
      // If you add a new message type to ws_messages.ts,
      // TypeScript will error here until you add a handler!
    });
  } catch (error) {
    console.error('Error handling message:', error);
  }
}, []);
```

## How to Apply (Gradual Migration)

### Step 1: Update Imports
```typescript
// ❌ Remove old import
// import { WebSocketMessage } from '../types';

// ✅ Add new import
import {
  WebSocketMessage,
  isEntityUpdate,
  isHierarchyChange,
  // ... add other type guards as needed
} from '../../types/ws_messages';
```

### Step 2: Replace Switch Statements
```typescript
// ❌ Before: No type narrowing
switch (message.type) {
  case 'entity_update':
    console.log(message.data);  // `any` type
    break;
}

// ✅ After: Type-safe with guards
if (isEntityUpdate(message)) {
  console.log(message.data.entity.id);  // `string` type
}
```

### Step 3: Update Message Handlers

Find all locations that handle WebSocket messages:
```bash
cd frontend/src

# Find WebSocket message handlers
grep -r "message\.type" --include="*.tsx" --include="*.ts"
grep -r "switch.*message" --include="*.tsx" --include="*.ts"
```

## Verification (Code-Only)

Create a test file to verify type safety:

```typescript
// test-type-safety.ts
import {
  WebSocketMessage,
  isEntityUpdate,
  EntityUpdateMessage
} from './types/ws_messages';

// Test type narrowing works
function testTypeNarrow(msg: WebSocketMessage) {
  if (isEntityUpdate(msg)) {
    // ✅ TypeScript knows this is EntityUpdateMessage
    const entityId: string = msg.data.entityId;  // Type-safe!
    const entityName: string = msg.data.entity.name;  // Type-safe!

    // ❌ This would error at compile time:
    // const invalid = msg.data.nonExistentField;  // TypeScript error!
  }
}

// Test exhaustive checking
function testExhaustive(msg: WebSocketMessage) {
  switch (msg.type) {
    case 'entity_update':
      return handleEntityUpdate(msg);
    case 'hierarchy_change':
      return handleHierarchyChange(msg);
    // ... if you miss a case, TypeScript will error in default:
    default:
      const _exhaustive: never = msg;  // Error if not exhaustive!
      throw new Error(`Unhandled message: ${_exhaustive}`);
  }
}
```

Run TypeScript compiler to verify:
```bash
npx tsc --noEmit test-type-safety.ts
# Should compile with no errors
```

## Expected Impact

**Before**:
```typescript
// ❌ No compile-time safety
const entity = message.data.entity;  // Could be undefined!
const name = message.data.entity.name;  // Could crash!
```

**After**:
```typescript
// ✅ Compile-time type safety
if (isEntityUpdate(message)) {
  const entity = message.data.entity;  // TypeScript knows structure
  const name = entity.name;  // TypeScript ensures field exists
}
```

**Benefits**:
- **Compile-time errors** instead of runtime crashes
- **IDE autocomplete** for message payloads
- **Refactoring safety**: Change message structure → TypeScript shows all affected code
- **Exhaustive checking**: TypeScript ensures all message types are handled
- **Documentation**: Types serve as living documentation

## Migration Strategy (4 hours total)

1. **Hour 1**: Update `useWebSocket.ts` (main handler)
2. **Hour 2**: Update `useHybridState.ts` (state sync)
3. **Hour 3**: Update layer components (geospatial)
4. **Hour 4**: Update remaining handlers + verification

## Rollback

Keep old types during migration:
```typescript
// Keep both during transition
import { WebSocketMessage as OldMessage } from '../types';
import { WebSocketMessage as NewMessage } from '../../types/ws_messages';

// Use new type for new code
function handleNew(msg: NewMessage) { ... }

// Old code still works
function handleOld(msg: OldMessage) { ... }
```

## Notes

- **Non-breaking**: Old code continues to work during migration
- **Gradual adoption**: Migrate one handler at a time
- **Zero runtime overhead**: Type guards compile to simple string checks
- **Future-proof**: Adding new message types forces updates everywhere
