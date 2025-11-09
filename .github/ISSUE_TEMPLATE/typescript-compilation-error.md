---
name: "🐛 TypeScript Compilation Error"
description: "Report TypeScript compilation errors, missing exports, or type system issues"
title: "TypeScript Error: [Brief description of error]"
labels: ["bug", "typescript", "compilation"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## TypeScript Compilation Error Report

        Use this template to report TypeScript compilation errors, missing exports, or type system issues. Before creating an issue, please check:

        - [ ] Run `npx tsc --noEmit` to confirm the error
        - [ ] Check if the error is already documented in [bug_report.md](../checks/bug_report.md)
        - [ ] Verify TypeScript configuration in [tsconfig.json](../frontend/tsconfig.json)

        **Common TypeScript Issues:**
        - Missing type exports (BUG-001)
        - exactOptionalPropertyTypes violations (BUG-006)
        - Missing enum definitions (BUG-004)
        - HierarchyResponse type issues (BUG-003)

  - type: textarea
    id: error_description
    attributes:
      label: "Error Description"
      description: "Describe the TypeScript compilation error and its impact"
      placeholder: "TypeScript compilation fails with error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'"
    validations:
      required: true

  - type: input
    id: error_code
    attributes:
      label: "TypeScript Error Code"
      description: "The specific TypeScript error code (e.g., TS2345, TS2307)"
      placeholder: "TS2345"
    validations:
      required: true

  - type: textarea
    id: reproduction_steps
    attributes:
      label: "Reproduction Steps"
      description: "Steps to reproduce the compilation error"
      placeholder: |
        1. Run `npx tsc --noEmit`
        2. Observe error in [filename]:[line]
        3. Error message: "Module has no exported member 'getConfidence'"
      value: |
        1. Run `npx tsc --noEmit`
        2. 
        3.
    validations:
      required: true

  - type: textarea
    id: affected_files
    attributes:
      label: "Affected Files"
      description: "List files where the error occurs"
      placeholder: |
        - frontend/src/components/MillerColumns.tsx:42
        - frontend/src/types/contracts.generated.ts:89
        - frontend/src/hooks/useHierarchy.ts:32

  - type: textarea
    id: expected_behavior
    attributes:
      label: "Expected Behavior"
      description: "What should happen when TypeScript compiles successfully"
      placeholder: "All types and utility functions should be properly exported and type-checked"

  - type: textarea
    id: actual_behavior
    attributes:
      label: "Actual Behavior"
      description: "What actually happens (error messages, compilation failure)"
      placeholder: "TypeScript compilation fails with 89 errors, blocking the build process"

  - type: textarea
    id: proposed_fix
    attributes:
      label: "Proposed Fix (Optional)"
      description: "If you have a suggested fix, describe it here"
      placeholder: |
        Add missing exports to contracts.generated.ts:
        ```typescript
        export function getConfidence(entity: Entity): number {
          return entity.confidence ?? 0;
        }
        ```

  - type: dropdown
    id: severity
    attributes:
      label: "Severity Level"
      description: "How critical is this compilation error?"
      options:
        - "P0 - Critical (Blocks development/compilation)"
        - "P1 - High (Major functionality broken)"
        - "P2 - Medium (Code quality issue)"
        - "P3 - Low (Minor type issue)"
    validations:
      required: true

  - type: textarea
    id: environment
    attributes:
      label: "Environment Information"
      description: "TypeScript version, Node.js version, and other relevant environment details"
      placeholder: |
        - TypeScript: 4.9.5
        - Node.js: 18.17.0
        - OS: Windows 11
        - Project: frontend

  - type: textarea
    id: additional_context
    attributes:
      label: "Additional Context"
      description: "Any other context, screenshots, or related issues"

  - type: checkboxes
    id: verification
    attributes:
      label: "Verification Checklist"
      description: "Please verify the following before submitting"
      options:
        - label: "I have run `npx tsc --noEmit` to confirm the error"
          required: true
        - label: "I have checked for existing similar issues"
          required: true
        - label: "I have included the exact error message and code"
          required: true
        - label: "I have provided reproduction steps"
          required: true

  - type: markdown
    attributes:
      value: |
        ## Related Documentation

        - [TypeScript Error Fixes (2025-11-07)](../docs/TYPESCRIPT_ERROR_FIXES_2025-11-07.md)
        - [Bug Report - Top 25 Defects](../checks/bug_report.md)
        - [Stack-Level Fixes Cheat Sheet](../docs/STACK_LEVEL_FIXES_CHEATSHEET.md)
        - [Testing Guide](../docs/TESTING_GUIDE.md)