# WebSocket Schema Standards

## Single Source of Truth: Zod Schemas

**Location**: `/frontend/src/types/ws_messages.ts`

This file contains the **ONLY** WebSocket message schema definitions for the entire project. All other files re-export from this unified schema.

### Why Zod?

1. **Runtime Validation**: Catches invalid messages at runtime, preventing silent failures
2. **Type Inference**: TypeScript types are automatically inferred from Zod schemas
3. **Exhaustive Checking**: Discriminated unions ensure all message types are handled
4. **Single Definition**: Schema and validation logic are defined once

## Null Discipline Standard

We follow a **strict null discipline** to ensure type safety and prevent common bugs:

### Rules

1. **`.optional()` for undefined**: Use when a field may be omitted from the object
   ```typescript
   confidence: z.number().optional()
   // Allows: { confidence: 0.9 } or { }
   // Disallows: { confidence: null }
   ```

2. **`.nullable()` for null**: Use when a field can explicitly be set to `null`
   ```typescript
   description: z.string().nullable()
   // Allows: { description: "text" } or { description: null }
   // Disallows: { } (field must be present)
   ```

3. **`.optional().nullable()` for both**: Use sparingly, only when truly necessary
   ```typescript
   metadata: z.record(z.any()).optional().nullable()
   // Allows: { metadata: {...} }, { metadata: null }, or { }
   ```

4. **NEVER mix union with optional**: Don't use `| null` with `.optional()`
   ```typescript
   // ❌ BAD: Confusing semantics
   field: z.string().nullable().optional()

   // ✅ GOOD: Pick one
   field: z.string().optional()  // Can be undefined
   field: z.string().nullable()  // Can be null
   ```

### TypeScript Configuration

`exactOptionalPropertyTypes` is **enabled** in `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "exactOptionalPropertyTypes": true
  }
}
```

This prevents assigning `undefined` to optional fields explicitly:

```typescript
// With exactOptionalPropertyTypes: true
interface Foo {
  bar?: string;
}

const foo: Foo = { bar: undefined }; // ❌ Error!
const foo: Foo = {};                 // ✅ OK
const foo: Foo = { bar: "value" };   // ✅ OK
```

## Message Structure

All WebSocket messages follow this structure:

```typescript
{
  type: 'message_type',        // Discriminator for type-safe unions
  data: { ... },               // Payload specific to message type
  timestamp?: number | string, // Optional timestamp
  channels?: string[]          // Optional channel list
}
```

### Message Categories

1. **Entity & Hierarchy**: `entity_update`, `hierarchy_change`, `bulk_update`
2. **Geospatial Layers**: `layer_data_update`, `gpu_filter_sync`
3. **Feature Flags**: `feature_flag_change`, `feature_flag_created`, `feature_flag_deleted`
4. **Scenarios**: `forecast_update`, `hierarchical_forecast_update`, `scenario_analysis_update`, `scenario_validation_update`, `collaboration_update`
5. **Outcomes**: `opportunity_update`, `action_update`, `stakeholder_update`, `evidence_update`
6. **System**: `ping`, `pong`, `heartbeat`, `echo`, `subscribe`, `unsubscribe`, `cache_invalidate`, `batch`, `error`, `serialization_error`, `connection_established`

## Runtime Validation

### Parsing Messages

Always use Zod validation when receiving WebSocket messages:

```typescript
import { safeParseWebSocketJSON } from '../types/ws_messages';

// Safe parsing (recommended)
const result = safeParseWebSocketJSON(rawData);
if (result.success) {
  const message = result.data; // Fully typed and validated
  // Handle message
} else {
  console.error('Validation failed:', result.error);
}

// Throwing parser (use when errors should propagate)
import { parseWebSocketJSON } from '../types/ws_messages';
try {
  const message = parseWebSocketJSON(rawData);
  // Handle message
} catch (error) {
  console.error('Validation failed:', error);
}
```

## Exhaustiveness Checking

Use TypeScript's exhaustiveness checking to ensure all message types are handled:

```typescript
function handleMessage(message: WebSocketMessage) {
  switch (message.type) {
    case 'entity_update':
      // Handle entity update
      break;
    case 'hierarchy_change':
      // Handle hierarchy change
      break;
    // ... all other cases
    default:
      // This will cause a TypeScript error if any case is missing
      const _exhaustiveCheck: never = message;
      console.warn('Unhandled message type:', _exhaustiveCheck);
  }
}
```

## Type Guards

Use type guards for type-safe narrowing:

```typescript
import { isEntityUpdate, isFeatureFlagChange } from '../types/ws_messages';

if (isEntityUpdate(message)) {
  // TypeScript knows message is EntityUpdateMessage
  const entityId = message.data.entityId;
}

if (isFeatureFlagChange(message)) {
  // TypeScript knows message is FeatureFlagChangeMessage
  const flagName = message.data.flagName;
}
```

## Adding New Message Types

When adding a new message type:

1. **Define the schema** in `/frontend/src/types/ws_messages.ts`:
   ```typescript
   export const NewMessageSchema = z.object({
     type: z.literal('new_message'),
     data: z.object({
       // ... payload definition
     }),
     timestamp: TimestampSchema,
     channels: ChannelsSchema,
   }).strict();

   export type NewMessage = z.infer<typeof NewMessageSchema>;
   ```

2. **Add to discriminated union**:
   ```typescript
   export const WebSocketMessageSchema = z.discriminatedUnion('type', [
     // ... existing schemas
     NewMessageSchema,
   ]);
   ```

3. **Add type guard**:
   ```typescript
   export function isNewMessage(msg: WebSocketMessage): msg is NewMessage {
     return msg.type === 'new_message';
   }
   ```

4. **Update all message handlers** to handle the new type (TypeScript will error if you forget!)

## Contract Generation

Backend Python models should follow the same null discipline:

```python
from typing import Optional
from pydantic import BaseModel

class MyModel(BaseModel):
    required_field: str
    optional_field: Optional[str] = None  # Maps to z.string().nullable()
    # For truly optional (can be omitted), use Field with default
    omittable_field: str = Field(default="")  # Maps to z.string().optional()
```

Run contract generation:

```bash
python scripts/dev/generate_contracts.py
```

This generates TypeScript interfaces from Python models, which should then be manually converted to Zod schemas in the unified file.

## Validation Metrics

Track validation failures for monitoring:

```typescript
import { ValidationMetrics } from '../utils/validation';

const metrics = new ValidationMetrics();

const result = safeParseWebSocketJSON(rawData);
if (result.success) {
  metrics.recordSuccess('websocket_message');
} else {
  metrics.recordFailure('websocket_message', result.error);
}

// Log metrics periodically
console.log(metrics.getStats());
```

## Testing

All message types should have test fixtures in `/frontend/mocks/ws/`:

```typescript
// example_message.json
{
  "type": "entity_update",
  "data": {
    "entityId": "123",
    "entity": { ... }
  },
  "timestamp": 1234567890
}
```

Validate fixtures against schemas:

```bash
npm run verify:contracts
```

## Backward Compatibility

### Deprecated Files

- `/types/ws_messages.ts` - Re-exports from unified schema
- `/frontend/src/types/zod/messages.ts.deprecated` - Old Zod schemas (deprecated)
- `/frontend/src/types/ws_messages.ts.old` - Old frontend schemas (backup)

These files exist for backward compatibility. New code should import from:
```typescript
import { WebSocketMessage } from './types/ws_messages';
```

## Impact

This standardization prevents:

1. **Silent runtime failures**: Invalid messages are caught immediately
2. **Type drift**: Schema changes are enforced at compile time
3. **Incomplete handlers**: Exhaustiveness checking ensures all types are handled
4. **Null bugs**: Strict null discipline prevents undefined/null confusion
5. **Documentation drift**: Single source of truth keeps docs aligned with code

## References

- [Zod Documentation](https://zod.dev/)
- [TypeScript Discriminated Unions](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes-func.html#discriminated-unions)
- [TypeScript `exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes)
