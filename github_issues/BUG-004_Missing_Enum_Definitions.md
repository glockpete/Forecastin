# BUG-004: Missing Enum Definitions in Generated Contracts

**Severity:** P0 - CRITICAL  
**Priority:** High  
**Type:** Bug  
**Status:** Open  
**Assignee:** TBD  
**Labels:** `bug`, `critical`, `typescript`, `code-generation`

## Description

`contracts.generated.ts` references `RiskLevel` and `ValidationStatus` enums that are not defined, causing TypeScript compilation errors. The generated contract file contains references to types that don't exist.

## Impact

- **TypeScript errors:** 3 compilation errors
- **Contract types incomplete:** Generated API contracts are missing required type definitions
- **Category:** Type System / Code Generation

## Affected Components

- `types/contracts.generated.ts` (lines 89, 122, 165)

## Reproduction Steps

1. Run `npx tsc --noEmit`
2. Observe errors at types/contracts.generated.ts:89,122,165
3. Error messages:
   - "Cannot find name 'RiskLevel'"
   - "Cannot find name 'ValidationStatus'"

## Expected Behavior

All referenced types in generated contracts should be properly defined or imported.

## Actual Behavior

Enums are referenced in the generated code but not defined, causing compilation failures.

## Proposed Fix

### Option 1: Regenerate Contracts (Recommended)

Run the contract generator to ensure all types are properly generated:

```bash
python scripts/dev/generate_contracts.py
```

### Option 2: Manual Enum Definitions

If regeneration doesn't work, manually add the missing enum definitions to `contracts.generated.ts`:

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

## Code References

- **File:** `types/contracts.generated.ts`
- **Generator:** `scripts/dev/generate_contracts.py`
- **Related:** REPORT.md Section 2, Category 7; checks/api_ui_drift.md Section 3 Issue 3
- **Estimated Fix Time:** 5 minutes (regenerate) or 15 minutes (manual)

## Acceptance Criteria

- [ ] TypeScript compilation succeeds without missing enum errors
- [ ] All referenced types in contracts.generated.ts are properly defined
- [ ] Contract generation process produces complete type definitions
- [ ] No manual type definitions required after regeneration

## Additional Context

This issue suggests a problem with the contract generation process. The preferred solution is to fix the generator rather than manually patching the output file.