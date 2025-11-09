---
name: "🔗 Schema Mismatch Issue"
description: "Report API contract, WebSocket message, or database schema mismatches"
title: "Schema Mismatch: [Brief description]"
labels: ["bug", "schema", "contract", "api"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## Schema Mismatch Issue Report

        Use this template to report API contract, WebSocket message, or database schema mismatches. Before creating an issue, please check:

        - [ ] Regenerate contracts if API/WS schemas changed (`python scripts/dev/generate_contracts.py`)
        - [ ] Verify schema definitions in [contracts/](../contracts/) directory
        - [ ] Check for existing contract drift in [contract-drift-check.yml](../.github/workflows/contract-drift-check.yml)

        **Common Schema Issues:**
        - WebSocket message schema validation failures (BUG-002)
        - API response type mismatches (BUG-003)
        - Database schema vs application model mismatches
        - Frontend/backend type inconsistencies

  - type: textarea
    id: issue_description
    attributes:
      label: "Issue Description"
      description: "Describe the schema mismatch and its impact"
      placeholder: "WebSocket message validation fails because test fixtures don't include required layerId property"
    validations:
      required: true

  - type: dropdown
    id: schema_type
    attributes:
      label: "Schema Type"
      description: "What type of schema is mismatched?"
      options:
        - "API Contract (OpenAPI/REST)"
        - "WebSocket Message Schema"
        - "Database Schema"
        - "TypeScript Type Definitions"
        - "Frontend/Backend Contract"
        - "Test Fixture Schema"
        - "Other"
    validations:
      required: true

  - type: textarea
    id: reproduction_steps
    attributes:
      label: "Reproduction Steps"
      description: "Steps to reproduce the schema mismatch"
      placeholder: |
        1. Run `npm test`
        2. Observe test failures in realtimeHandlers.test.ts
        3. Error: "Cannot read properties of undefined (reading 'layerId')"
        4. Check that test message fixtures match LayerDataUpdateMessage schema
      value: |
        1. 
        2.
        3.
        4.
    validations:
      required: true

  - type: textarea
    id: expected_schema
    attributes:
      label: "Expected Schema"
      description: "What the schema should look like (reference actual schema definitions)"
      placeholder: |
        LayerDataUpdateMessage should include:
        ```typescript
        {
          type: 'layer_data_update',
          data: {
            layerId: string,  // Required property
            operation: 'update' | 'add' | 'remove',
            layerType: string,
            entities: Entity[],
            affectedBounds: Bounds
          },
          timestamp: number
        }
        ```

  - type: textarea
    id: actual_schema
    attributes:
      label: "Actual Schema"
      description: "What the actual schema or data looks like"
      placeholder: |
        Test fixtures are missing required properties:
        ```typescript
        const testMessage = {
          type: 'layer_data_update',
          data: {
            // Missing layerId property
            operation: 'update',
            layerType: 'point',
            entities: []
          }
        }
        ```

  - type: textarea
    id: error_messages
    attributes:
      label: "Error Messages"
      description: "Specific error messages or validation failures"
      placeholder: |
        ```
        TypeError: Cannot read properties of undefined (reading 'layerId')
        at src/types/ws_messages.ts:969
        ValidationError: Missing required property 'layerId'
        ```

  - type: textarea
    id: affected_components
    attributes:
      label: "Affected Components"
      description: "Which parts of the system are affected by this mismatch?"
      placeholder: |
        - Frontend: TypeScript compilation errors
        - Backend: API validation failures
        - Tests: Fixture validation errors
        - WebSocket: Message handling failures

  - type: textarea
    id: proposed_fix
    attributes:
      label: "Proposed Fix (Optional)"
      description: "If you have a suggested fix, describe it here"
      placeholder: |
        Update test fixtures to include all required properties:
        ```typescript
        const testMessage: LayerDataUpdateMessage = {
          type: 'layer_data_update',
          data: {
            layerId: 'test-layer-1',  // ADD THIS
            operation: 'update',
            layerType: 'point',
            entities: [],
            affectedBounds: { /* ... */ }
          },
          timestamp: Date.now()
        };
        ```

  - type: dropdown
    id: severity
    attributes:
      label: "Severity Level"
      description: "How critical is this schema mismatch?"
      options:
        - "P0 - Critical (Blocks compilation/tests)"
        - "P1 - High (Causes runtime errors)"
        - "P2 - Medium (Causes test failures)"
        - "P3 - Low (Type safety issue)"
    validations:
      required: true

  - type: textarea
    id: contract_generation
    attributes:
      label: "Contract Generation Status"
      description: "Have contracts been regenerated after schema changes?"
      placeholder: |
        - [ ] OpenAPI spec regenerated (`contracts/openapi.json`)
        - [ ] WS schema regenerated (`contracts/ws.json`)
        - [ ] Frontend types regenerated (`frontend/src/types/*.generated.ts`)
        - [ ] Runtime guards updated

  - type: textarea
    id: environment
    attributes:
      label: "Environment Information"
      description: "Application environment and version details"
      placeholder: |
        - Backend Version: [commit hash]
        - Frontend Version: [commit hash]
        - Contract Version: [generation timestamp]
        - Test Environment: local/CI

  - type: textarea
    id: additional_context
    attributes:
      label: "Additional Context"
      description: "Any other context, related PRs, or migration requirements"

  - type: checkboxes
    id: verification
    attributes:
      label: "Verification Checklist"
      description: "Please verify the following before submitting"
      options:
        - label: "I have regenerated contracts if schema changed"
          required: true
        - label: "I have checked the actual schema definitions"
          required: true
        - label: "I have verified the mismatch exists in both environments"
          required: true
        - label: "I have checked for existing similar issues"
          required: true

  - type: markdown
    attributes:
      value: |
        ## Related Documentation

        - [WebSocket Schema Standards](../docs/WEBSOCKET_SCHEMA_STANDARDS.md)
        - [Contract Generation Guide](../scripts/dev/generate_contracts.py)
        - [Bug Report - Top 25 Defects](../checks/bug_report.md) (BUG-002, BUG-003)
        - [API Contract Validation](../.github/workflows/contract-drift-check.yml)
        - [Testing Guide](../docs/TESTING_GUIDE.md)