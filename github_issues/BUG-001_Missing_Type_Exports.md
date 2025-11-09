# BUG-001: Missing Type Exports Block TypeScript Compilation

**Severity:** P0 - CRITICAL  
**Priority:** High  
**Type:** Bug  
**Status:** Open  
**Assignee:** TBD  
**Labels:** `bug`, `critical`, `typescript`, `compilation`

## Description

TypeScript compilation fails with 89 errors due to missing exports in `types/contracts.generated.ts`. The file is missing exports for utility functions and types that are imported by multiple components.

## Impact

- **Blocks development:** TypeScript compilation fails, preventing builds
- **Affected files:** 5+ component files including EntityDetail.tsx, MillerColumns.tsx, SearchInterface.tsx
- **Category:** Type System

## Affected Components

- `getConfidence` function (3 import attempts)
- `getChildrenCount` function (2 import attempts)
- `Entity` type from useHierarchy.ts (1 import)
- `fromEntityId` function (1 import, should be `EntityId`)

## Reproduction Steps

1. Run `npx tsc --noEmit`
2. Observe errors in:
   - EntityDetail.tsx:24
   - MillerColumns.tsx:42
   - SearchInterface.tsx:21
3. Error message: "Module has no exported member 'getConfidence'"

## Expected Behavior

All types and utility functions should be properly exported from `contracts.generated.ts` and available for import.

## Actual Behavior

TypeScript compilation fails with "Module has no exported member" errors.

## Proposed Fix

### Option 1: Add utility exports to contracts.generated.ts

```typescript
export function getConfidence(entity: Entity): number {
  return entity.confidence ?? 0;
}

export function getChildrenCount(entity: Entity): number {
  return entity.childrenCount ?? 0;
}
```

### Option 2: Export Entity from useHierarchy.ts

```typescript
export type { Entity } from '../types';
```

## Code References

- **File:** `types/contracts.generated.ts`
- **Related:** REPORT.md Section 2, Category 1
- **Estimated Fix Time:** 15 minutes

## Acceptance Criteria

- [ ] TypeScript compilation succeeds without errors
- [ ] All missing exports are properly defined
- [ ] All affected components can import required types/functions
- [ ] No regression in existing functionality

## Additional Context

This issue blocks development workflow and should be addressed immediately to unblock the team.