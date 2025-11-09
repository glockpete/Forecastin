---
name: "⚡ Constructor/Async Mocking Issue"
description: "Report issues with constructor initialization, async operations, or mocking patterns"
title: "Constructor/Async Issue: [Brief description]"
labels: ["bug", "testing", "async", "mocking"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## Constructor/Async Mocking Issue Report

        Use this template to report issues with constructor initialization, async operations, or mocking patterns. Before creating an issue, please check:

        - [ ] Review async patterns in [TESTING_GUIDE.md](../docs/TESTING_GUIDE.md)
        - [ ] Check mocking examples in test files
        - [ ] Verify constructor patterns in existing code

        **Common Constructor/Async Issues:**
        - Constructor dependency injection failures
        - Async initialization race conditions
        - Mocking complex async operations
        - Test setup/teardown timing issues

  - type: textarea
    id: issue_description
    attributes:
      label: "Issue Description"
      description: "Describe the constructor or async mocking issue"
      placeholder: "Constructor fails to initialize dependencies properly, causing async operations to fail"
    validations:
      required: true

  - type: dropdown
    id: issue_type
    attributes:
      label: "Issue Type"
      description: "What type of issue is this?"
      options:
        - "Constructor Initialization Failure"
        - "Async Operation Race Condition"
        - "Mocking Pattern Inadequate"
        - "Dependency Injection Problem"
        - "Test Setup/Teardown Timing"
        - "Async/Await Pattern Issue"
        - "Other"
    validations:
      required: true

  - type: textarea
    id: reproduction_steps
    attributes:
      label: "Reproduction Steps"
      description: "Steps to reproduce the constructor/async issue"
      placeholder: |
        1. Create instance of class with async dependencies
        2. Attempt to call async method immediately after construction
        3. Observe that dependencies are not fully initialized
        4. Error: "Cannot read properties of undefined"
      value: |
        1. 
        2.
        3.
        4.
    validations:
      required: true

  - type: textarea
    id: code_example
    attributes:
      label: "Code Example"
      description: "Relevant code showing the issue (use code blocks)"
      placeholder: |
        ```typescript
        class Service {
          constructor(private dependency: AsyncDependency) {}
          
          async initialize() {
            await this.dependency.setup(); // Race condition if not awaited
          }
          
          async operation() {
            // Fails if initialize() not completed
            return this.dependency.method();
          }
        }
        ```

  - type: textarea
    id: error_messages
    attributes:
      label: "Error Messages"
      description: "Specific error messages or stack traces"
      placeholder: |
        ```
        TypeError: Cannot read properties of undefined (reading 'method')
        at Service.operation (service.ts:45)
        Race condition detected: dependency not initialized
        ```

  - type: textarea
    id: expected_behavior
    attributes:
      label: "Expected Behavior"
      description: "What should happen with proper constructor/async handling"
      placeholder: "Constructor should properly initialize dependencies, and async operations should complete in correct order"

  - type: textarea
    id: actual_behavior
    attributes:
      label: "Actual Behavior"
      description: "What actually happens (race conditions, undefined errors)"
      placeholder: "Async operations fail due to uninitialized dependencies or race conditions"

  - type: textarea
    id: mocking_approach
    attributes:
      label: "Current Mocking Approach"
      description: "How are you currently mocking the problematic component?"
      placeholder: |
        ```typescript
        // Current mocking that doesn't work
        jest.mock('./dependency', () => ({
          AsyncDependency: jest.fn().mockImplementation(() => ({
            method: jest.fn().mockResolvedValue('result')
          }))
        }));
        ```

  - type: textarea
    id: proposed_fix
    attributes:
      label: "Proposed Fix (Optional)"
      description: "If you have a suggested fix, describe it here"
      placeholder: |
        Use factory pattern with async initialization:
        ```typescript
        class Service {
          private static async create(dependency: AsyncDependency): Promise<Service> {
            const instance = new Service(dependency);
            await instance.initialize();
            return instance;
          }
          
          private constructor(private dependency: AsyncDependency) {}
          
          private async initialize() {
            await this.dependency.setup();
          }
        }
        ```

  - type: dropdown
    id: severity
    attributes:
      label: "Severity Level"
      description: "How critical is this constructor/async issue?"
      options:
        - "P0 - Critical (Blocks application startup)"
        - "P1 - High (Causes runtime failures)"
        - "P2 - Medium (Causes test failures)"
        - "P3 - Low (Code quality issue)"
    validations:
      required: true

  - type: textarea
    id: testing_impact
    attributes:
      label: "Testing Impact"
      description: "How does this issue affect testing?"
      placeholder: |
        - Tests fail due to timing issues
        - Cannot properly mock async dependencies
        - Test setup becomes complex and flaky
        - Coverage decreases due to untestable code paths

  - type: textarea
    id: dependencies
    attributes:
      label: "Dependencies Involved"
      description: "Which dependencies or services are causing the issue?"
      placeholder: |
        - Database connections
        - WebSocket services
        - Feature flag services
        - Cache services
        - External API clients

  - type: textarea
    id: environment
    attributes:
      label: "Environment Information"
      description: "Runtime environment and testing framework details"
      placeholder: |
        - Testing Framework: Vitest/Jest/Pytest
        - Async Library: async/await, Promises
        - Mocking Library: jest.fn(), unittest.mock
        - Runtime: Node.js/Browser

  - type: textarea
    id: additional_context
    attributes:
      label: "Additional Context"
      description: "Any other context, related patterns, or architectural considerations"

  - type: checkboxes
    id: verification
    attributes:
      label: "Verification Checklist"
      description: "Please verify the following before submitting"
      options:
        - label: "I have reviewed existing constructor patterns in the codebase"
          required: true
        - label: "I have tried different mocking approaches"
          required: true
        - label: "I have checked for race conditions with async/await"
          required: true
        - label: "I have checked for existing similar issues"
          required: true

  - type: markdown
    attributes:
      value: |
        ## Related Documentation

        - [Testing Guide](../docs/TESTING_GUIDE.md) - Mocking patterns and async testing
        - [Startup Procedures](../docs/STARTUP_PROCEDURES_AND_ERROR_PATTERNS.md) - Service initialization
        - [Bug Report - Top 25 Defects](../checks/bug_report.md) - Common patterns and fixes
        - [Stack-Level Fixes](../docs/STACK_LEVEL_FIXES_CHEATSHEET.md) - Implementation patterns

        ## Recommended Patterns

        **Async Constructor Pattern:**
        ```typescript
        class Service {
          static async create(deps: Dependencies): Promise<Service> {
            const instance = new Service(deps);
            await instance.initialize();
            return instance;
          }
        }
        ```

        **Proper Mocking Pattern:**
        ```typescript
        const mockDependency = {
          method: vi.fn().mockResolvedValue('result'),
          setup: vi.fn().mockResolvedValue(undefined)
        };