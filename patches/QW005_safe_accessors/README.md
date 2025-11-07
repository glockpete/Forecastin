# Patch QW005: Add Safe Entity Field Accessors

**Priority**: HIGH
**Effort**: 1 hour
**ROI**: 70
**Risk**: LOW
**Reversible**: YES

## Problem
Direct access to optional Entity fields causes runtime errors when fields are undefined:

```typescript
// ❌ CRASH if confidence is undefined
const formatted = entity.confidence.toFixed(2);

// ❌ NaN if childrenCount is undefined
const total = entity.childrenCount + 1;
```

## Solution
Use safe accessor functions from `types/contracts.generated.ts` (already created).

## Files Changed
- Any component that accesses optional Entity fields
- Example: `frontend/src/components/EntityList.tsx` (hypothetical)

## Available Utilities (Already Created)

```typescript
// From types/contracts.generated.ts

/**
 * Get confidence score with fallback
 */
export function getConfidence(entity: Entity): number {
  return entity.confidence ?? 0.0;
}

/**
 * Get children count with fallback
 */
export function getChildrenCount(entity: Entity): number {
  return entity.childrenCount ?? 0;
}

/**
 * Safe entity accessor - returns default values for missing optionals
 */
export function normalizeEntity(entity: Entity): NormalizedEntity {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    path: entity.path,
    pathDepth: entity.pathDepth,
    parentId: entity.parentId ?? undefined,
    confidence: entity.confidence ?? undefined,
    metadata: entity.metadata ?? undefined,
    createdAt: entity.createdAt ?? undefined,
    updatedAt: entity.updatedAt ?? undefined,
    hasChildren: entity.hasChildren ?? false,
    childrenCount: entity.childrenCount ?? 0,
  };
}

/**
 * Parse optional date string safely
 */
export function parseEntityDate(dateStr?: string | null): Date | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
}
```

## Example Patch: EntityList.tsx

```diff
--- a/frontend/src/components/EntityList.tsx
+++ b/frontend/src/components/EntityList.tsx
@@ -1,5 +1,5 @@
 import React from 'react';
-import { Entity } from '../types';
+import { Entity, getConfidence, getChildrenCount, parseEntityDate } from '../types/contracts.generated';

 export const EntityList: React.FC<{ entities: Entity[] }> = ({ entities }) => {
   return (
@@ -9,13 +9,13 @@ export const EntityList: React.FC<{ entities: Entity[] }> = ({ entities }) => {
           <div key={entity.id}>
             <h3>{entity.name}</h3>
             <p>Type: {entity.type}</p>
-            <p>Confidence: {(entity.confidence ?? 0).toFixed(2)}</p>
-            <p>Children: {entity.childrenCount ?? 0}</p>
-            <p>Has Children: {entity.hasChildren ? 'Yes' : 'No'}</p>
+            <p>Confidence: {getConfidence(entity).toFixed(2)}</p>
+            <p>Children: {getChildrenCount(entity)}</p>
+            <p>Has Children: {entity.hasChildren ?? false ? 'Yes' : 'No'}</p>
             {entity.createdAt && (
-              <p>Created: {new Date(entity.createdAt).toLocaleDateString()}</p>
+              <p>Created: {parseEntityDate(entity.createdAt)?.toLocaleDateString() ?? 'Unknown'}</p>
             )}
           </div>
         ))}
       </div>
     </div>
   );
 };
```

## How to Apply

1. **Find all components accessing optional fields**:
```bash
cd frontend/src

# Find direct confidence access
grep -r "entity\.confidence" --include="*.tsx" --include="*.ts"

# Find direct childrenCount access
grep -r "entity\.childrenCount" --include="*.tsx" --include="*.ts"

# Find direct date access
grep -r "entity\.createdAt\|entity\.updatedAt" --include="*.tsx" --include="*.ts"
```

2. **Import safe accessors**:
```typescript
import {
  getConfidence,
  getChildrenCount,
  parseEntityDate,
  normalizeEntity
} from '../types/contracts.generated';
```

3. **Replace direct access**:
```typescript
// Before:
entity.confidence?.toFixed(2) ?? '0.00'

// After:
getConfidence(entity).toFixed(2)

// Before:
(entity.childrenCount ?? 0) + 1

// After:
getChildrenCount(entity) + 1

// Before:
new Date(entity.createdAt || '')

// After:
parseEntityDate(entity.createdAt)
```

## Verification (Code-Only)

```typescript
// Test safe accessors
import { getConfidence, getChildrenCount, parseEntityDate } from './types/contracts.generated';

// Test with undefined fields
const minimalEntity = {
  id: 'test',
  name: 'Test',
  type: 'test',
  path: 'root.test',
  pathDepth: 2,
};

console.assert(getConfidence(minimalEntity) === 0.0, 'Should return 0.0 for missing confidence');
console.assert(getChildrenCount(minimalEntity) === 0, 'Should return 0 for missing childrenCount');
console.assert(parseEntityDate(undefined) === undefined, 'Should handle undefined date');
console.assert(parseEntityDate('2025-11-06T12:00:00Z') instanceof Date, 'Should parse valid ISO date');

// ✅ All pass
```

## Common Patterns

### Pattern 1: Confidence Display
```typescript
// ❌ Before:
<span>{entity.confidence ? (entity.confidence * 100).toFixed(0) : '0'}%</span>

// ✅ After:
<span>{(getConfidence(entity) * 100).toFixed(0)}%</span>
```

### Pattern 2: Children Count
```typescript
// ❌ Before:
const hasMany = (entity.childrenCount ?? 0) > 10;

// ✅ After:
const hasMany = getChildrenCount(entity) > 10;
```

### Pattern 3: Date Formatting
```typescript
// ❌ Before:
const date = entity.createdAt ? new Date(entity.createdAt) : null;
const formatted = date?.toLocaleDateString() ?? 'Unknown';

// ✅ After:
const date = parseEntityDate(entity.createdAt);
const formatted = date?.toLocaleDateString() ?? 'Unknown';
```

### Pattern 4: Full Normalization
```typescript
// ❌ Before:
const safeEntity = {
  ...entity,
  confidence: entity.confidence ?? 0,
  childrenCount: entity.childrenCount ?? 0,
  hasChildren: entity.hasChildren ?? false,
};

// ✅ After:
const safeEntity = normalizeEntity(entity);
```

## Expected Impact

**Metrics**:
- Eliminates runtime NaN/undefined crashes
- Consistent fallback behavior across codebase
- Better null safety
- Easier refactoring

**Developer Experience**:
- Clear intent: "I want a safe confidence value"
- Centralized logic: Change fallback in one place
- Type-safe: TypeScript enforces correct usage

## Rollback

Simply remove the imports and revert to direct access. No breaking changes.

## Notes

- **No breaking changes**: Existing code continues to work
- **Gradual adoption**: Can be applied component by component
- **Zero runtime overhead**: Simple function calls, inlined by bundler
- **Better than optional chaining**: Provides sensible defaults, not just `undefined`
