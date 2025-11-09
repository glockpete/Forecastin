# BUG-003: HierarchyResponse Type Missing .entities Property

**Severity:** P0 - CRITICAL  
**Priority:** High  
**Type:** Bug  
**Status:** Open  
**Assignee:** TBD  
**Labels:** `bug`, `critical`, `typescript`, `api-contract`

## Description

Frontend code expects `HierarchyResponse<EntityType>` to have an `.entities` property, but the type definition doesn't include it. This causes TypeScript errors and potential runtime failures in navigation components.

## Impact

- **TypeScript errors:** 6 compilation errors
- **Data access broken:** Navigation components cannot access entity data
- **Category:** Type System / API Contract

## Affected Components

- MillerColumns.tsx (lines 160, 213, 329)
- SearchInterface.tsx (lines 78, 80, 195)

## Reproduction Steps

1. Run `npx tsc --noEmit`
2. Observe errors at:
   - MillerColumns.tsx:160,213,329
   - SearchInterface.tsx:78,80,195
3. Error message: "Property 'entities' does not exist on type 'HierarchyResponse<EntityType>'"

## Expected Behavior

`HierarchyResponse` should include an `entities` array property:

```typescript
interface HierarchyResponse<T extends EntityType> {
  entities: Entity<T>[];
  total?: number;
  hasMore?: boolean;
}
```

## Actual Behavior

Type definition is missing the `.entities` property that frontend code expects and uses.

## Proposed Fix

### Option 1: Add .entities property to HierarchyResponse interface

Add the missing property to the `HierarchyResponse` interface in `types/index.ts`:

```typescript
interface HierarchyResponse<T extends EntityType> {
  entities: Entity<T>[];
  total?: number;
  hasMore?: boolean;
}
```

### Option 2: Update frontend code (if backend returns different property)

If the backend returns entities under a different property name, update frontend code to use the correct property.

## Code References

- **Files:** `MillerColumns.tsx`, `SearchInterface.tsx`
- **Type Definition:** `types/index.ts` - HierarchyResponse interface
- **Related:** REPORT.md Section 2, Category 2; checks/api_ui_drift.md Section 3 Issue 1
- **Estimated Fix Time:** 15 minutes (type fix) or 1 hour (refactor frontend code)

## Acceptance Criteria

- [ ] TypeScript compilation succeeds without HierarchyResponse errors
- [ ] Navigation components can access entity data properly
- [ ] API contract between frontend and backend is consistent
- [ ] No runtime data access failures

## Additional Context

This issue represents an API contract mismatch between frontend expectations and backend responses. The fix should align the type definitions with actual data structures.