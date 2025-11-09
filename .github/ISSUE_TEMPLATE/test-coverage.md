---
name: "🧪 Test Coverage Issue"
description: "Report test failures, missing test coverage, or testing framework issues"
title: "Test Issue: [Brief description]"
labels: ["bug", "testing", "coverage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## Test Coverage Issue Report

        Use this template to report test failures, missing test coverage, or testing framework issues. Before creating an issue, please check:

        - [ ] Run tests locally to confirm the failure (`npm test` or `pytest`)
        - [ ] Check test coverage requirements in [TESTING_GUIDE.md](../docs/TESTING_GUIDE.md)
        - [ ] Verify testing framework configuration

        **Common Test Issues:**
        - Test framework mismatches (BUG-008)
        - Missing type guards in tests (BUG-009)
        - Test fixtures with incorrect schemas (BUG-002)
        - Inadequate test coverage

  - type: textarea
    id: issue_description
    attributes:
      label: "Issue Description"
      description: "Describe the test issue and its impact"
      placeholder: "Test file imports from @jest/globals but project uses Vitest, causing runtime errors"
    validations:
      required: true

  - type: dropdown
    id: test_type
    attributes:
      label: "Test Type"
      description: "What type of test is affected?"
      options:
        - "Unit Test"
        - "Integration Test"
        - "Performance Test"
        - "WebSocket Test"
        - "API Test"
        - "Frontend Component Test"
        - "Test Framework Configuration"
        - "Other"
    validations:
      required: true

  - type: textarea
    id: reproduction_steps
    attributes:
      label: "Reproduction Steps"
      description: "Steps to reproduce the test issue"
      placeholder: |
        1. Run `npm test`
        2. Observe error in GeospatialIntegrationTests.test.ts
        3. Error: "Do not import '@jest/globals' outside of the Jest test environment"
      value: |
        1. 
        2.
        3.
    validations:
      required: true

  - type: textarea
    id: affected_tests
    attributes:
      label: "Affected Tests"
      description: "Which specific test files or test cases are failing?"
      placeholder: |
        - tests/realtimeHandlers.test.ts (8 failures)
        - src/layers/tests/GeospatialIntegrationTests.test.ts (0 tests execute)
        - src/layers/types/layer-types.test.ts (ReferenceError)

  - type: textarea
    id: error_messages
    attributes:
      label: "Error Messages"
      description: "Specific error messages or stack traces"
      placeholder: |
        ```
        ReferenceError: isLayerData is not defined
        at layer-types.test.ts:193
        Error: Do not import '@jest/globals' outside of the Jest test environment
        at node_modules/@jest/globals/build/index.js:23
        ```

  - type: textarea
    id: expected_behavior
    attributes:
      label: "Expected Behavior"
      description: "What should happen when tests run successfully"
      placeholder: "All tests should execute without framework errors, and test coverage should meet requirements"

  - type: textarea
    id: actual_behavior
    attributes:
      label: "Actual Behavior"
      description: "What actually happens (test failures, framework errors)"
      placeholder: "Test file cannot execute due to missing dependencies or framework incompatibility"

  - type: textarea
    id: test_environment
    attributes:
      label: "Test Environment"
      description: "Testing framework and environment details"
      placeholder: |
        - Testing Framework: Vitest/Jest/Pytest
        - Test Runner: npm test/pytest
        - Environment: local/CI
        - Coverage Tool: vitest --coverage/pytest-cov

  - type: textarea
    id: proposed_fix
    attributes:
      label: "Proposed Fix (Optional)"
      description: "If you have a suggested fix, describe it here"
      placeholder: |
        Replace Jest imports with Vitest:
        ```typescript
        // Before
        import { describe, it, expect } from '@jest/globals';

        // After  
        import { describe, it, expect } from 'vitest';
        ```

  - type: dropdown
    id: severity
    attributes:
      label: "Severity Level"
      description: "How critical is this test issue?"
      options:
        - "P0 - Critical (Blocks all testing)"
        - "P1 - High (Major test suite failures)"
        - "P2 - Medium (Specific test failures)"
        - "P3 - Low (Coverage or quality issue)"
    validations:
      required: true

  - type: textarea
    id: coverage_impact
    attributes:
      label: "Coverage Impact"
      description: "How does this issue affect test coverage?"
      placeholder: |
        - Current coverage: X%
        - Target coverage: 80% (backend), 70% (frontend)
        - Files with inadequate coverage: [list files]
        - Critical paths untested: [list functionality]

  - type: textarea
    id: framework_configuration
    attributes:
      label: "Framework Configuration"
      description: "Relevant testing framework configuration details"
      placeholder: |
        - Vitest config: [frontend/vitest.config.ts]
        - Pytest config: [api/pytest.ini or pyproject.toml]
        - Test patterns: [test file locations]
        - Mock configurations: [MSW, unittest.mock]

  - type: textarea
    id: additional_context
    attributes:
      label: "Additional Context"
      description: "Any other context, related test improvements, or migration requirements"

  - type: checkboxes
    id: verification
    attributes:
      label: "Verification Checklist"
      description: "Please verify the following before submitting"
      options:
        - label: "I have run tests locally to confirm the issue"
          required: true
        - label: "I have checked test framework configuration"
          required: true
        - label: "I have verified the issue exists in both local and CI environments"
          required: true
        - label: "I have checked for existing similar issues"
          required: true

  - type: markdown
    attributes:
      value: |
        ## Related Documentation

        - [Testing Guide](../docs/TESTING_GUIDE.md)
        - [Bug Report - Top 25 Defects](../checks/bug_report.md) (BUG-002, BUG-008, BUG-009)
        - [WebSocket Testing](../docs/WEBSOCKET_SCHEMA_STANDARDS.md)
        - [Performance Testing](../docs/PERFORMANCE_OPTIMIZATION_REPORT.md)
        - [CI/CD Pipeline](../.github/workflows/ci.yml)

        ## Test Coverage Requirements

        | Component | Target Coverage | Current Status |
        |-----------|----------------|----------------|
        | Backend Core | 80% | - |
        | Backend Services | 85% | - |
        | Frontend Components | 70% | - |
        | Frontend Hooks | 80% | - |
        | Integration Tests | 60% | - |