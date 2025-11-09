---
name: "🚩 Feature Flag Initialization Issue"
description: "Report issues with feature flag initialization, configuration, or usage"
title: "Feature Flag Issue: [Brief description]"
labels: ["bug", "feature-flags", "configuration"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## Feature Flag Initialization Issue Report

        Use this template to report issues with feature flag initialization, configuration, or usage. Before creating an issue, please check:

        - [ ] Verify feature flag service is running (`docker-compose logs api | grep feature`)
        - [ ] Check feature flag configuration in [FEATURE_FLAG_MIGRATION_README.md](../docs/FEATURE_FLAG_MIGRATION_README.md)
        - [ ] Verify flag definitions in [feature-flags.ts](../frontend/src/feature-flags.ts)

        **Common Feature Flag Issues:**
        - Feature flag infrastructure unused (BUG-015)
        - Flag configuration mismatch
        - Initialization failures
        - Gradual rollout not working

  - type: textarea
    id: issue_description
    attributes:
      label: "Issue Description"
      description: "Describe the feature flag issue and its impact"
      placeholder: "Feature flag service fails to initialize, preventing gradual rollout of geospatial features"
    validations:
      required: true

  - type: input
    id: affected_flag
    attributes:
      label: "Affected Feature Flag"
      description: "The specific feature flag name (e.g., ff.geospatial_layers, ff.point_layer)"
      placeholder: "ff.geospatial_layers"

  - type: textarea
    id: reproduction_steps
    attributes:
      label: "Reproduction Steps"
      description: "Steps to reproduce the feature flag issue"
      placeholder: |
        1. Start the application with `docker-compose up`
        2. Check API logs for feature flag service errors
        3. Attempt to use the affected feature
        4. Observe that the feature is not available despite flag being enabled
      value: |
        1. 
        2.
        3.
        4.
    validations:
      required: true

  - type: textarea
    id: expected_behavior
    attributes:
      label: "Expected Behavior"
      description: "What should happen with the feature flag"
      placeholder: "Feature flag service should initialize successfully, and features should be controllable via flags"

  - type: textarea
    id: actual_behavior
    attributes:
      label: "Actual Behavior"
      description: "What actually happens (errors, unexpected behavior)"
      placeholder: "Feature flag service fails to start, all features are either fully enabled or disabled"

  - type: textarea
    id: error_logs
    attributes:
      label: "Error Logs"
      description: "Relevant error messages or log output"
      placeholder: |
        ```
        ERROR: FeatureFlagService initialization failed: Database connection timeout
        ERROR: Flag 'ff.geospatial_layers' not found in configuration
        ```

  - type: dropdown
    id: issue_type
    attributes:
      label: "Issue Type"
      description: "What type of feature flag issue is this?"
      options:
        - "Initialization Failure (service won't start)"
        - "Configuration Error (flags not loading)"
        - "Runtime Error (flag evaluation fails)"
        - "Usage Issue (flag not being checked)"
        - "Gradual Rollout Problem (A/B testing not working)"
        - "Other"
    validations:
      required: true

  - type: textarea
    id: environment
    attributes:
      label: "Environment Information"
      description: "Application environment and configuration details"
      placeholder: |
        - Environment: development/production
        - Feature Flag Service: local/remote
        - Configuration Source: database/environment variables
        - Backend Version: [commit hash or version]

  - type: textarea
    id: proposed_solution
    attributes:
      label: "Proposed Solution (Optional)"
      description: "If you have a suggested solution, describe it here"
      placeholder: |
        Add proper error handling for feature flag service initialization:
        ```typescript
        try {
          await featureFlagService.initialize();
        } catch (error) {
          logger.error('Feature flag service failed to initialize', error);
          // Fallback to default configuration
        }
        ```

  - type: dropdown
    id: severity
    attributes:
      label: "Severity Level"
      description: "How critical is this feature flag issue?"
      options:
        - "P0 - Critical (Blocks deployment/rollout)"
        - "P1 - High (Prevents safe feature testing)"
        - "P2 - Medium (Limited functionality impact)"
        - "P3 - Low (Configuration issue)"
    validations:
      required: true

  - type: textarea
    id: impact_assessment
    attributes:
      label: "Impact Assessment"
      description: "What is the impact on deployment safety and feature management?"
      placeholder: |
        - Cannot gradually roll out geospatial features
        - Cannot A/B test layer rendering performance  
        - Cannot quickly rollback problematic changes
        - Cannot monitor performance per feature

  - type: textarea
    id: additional_context
    attributes:
      label: "Additional Context"
      description: "Any other context, related issues, or configuration details"

  - type: checkboxes
    id: verification
    attributes:
      label: "Verification Checklist"
      description: "Please verify the following before submitting"
      options:
        - label: "I have checked the feature flag service logs"
          required: true
        - label: "I have verified the feature flag configuration"
          required: true
        - label: "I have tested with different flag values"
          required: true
        - label: "I have checked for existing similar issues"
          required: true

  - type: markdown
    attributes:
      value: |
        ## Related Documentation

        - [Feature Flag Migration Guide](../docs/FEATURE_FLAG_MIGRATION_README.md)
        - [Feature Flag Naming Standard](../docs/FEATURE_FLAG_NAMING_STANDARD.md)
        - [Bug Report - Top 25 Defects](../checks/bug_report.md) (BUG-015)
        - [Startup Procedures](../docs/STARTUP_PROCEDURES_AND_ERROR_PATTERNS.md)
        - [Testing Guide](../docs/TESTING_GUIDE.md)