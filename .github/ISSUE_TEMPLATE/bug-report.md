---
name: "🐛 Bug Report"
description: "Report a general bug or issue not covered by specific templates"
title: "Bug: [Brief description]"
labels: ["bug"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## General Bug Report

        Use this template for bugs that don't fit the specific category templates. Before creating an issue, please check:

        - [ ] Search existing issues to avoid duplicates
        - [ ] Check [bug_report.md](../checks/bug_report.md) for known issues
        - [ ] Verify the issue exists in the latest version

        **Consider using specific templates for:**
        - 🐛 TypeScript Compilation Error
        - 🚩 Feature Flag Initialization Issue  
        - 🔗 Schema Mismatch Issue
        - 🧪 Test Coverage Issue
        - ⚡ Constructor/Async Mocking Issue

  - type: textarea
    id: bug_description
    attributes:
      label: "Bug Description"
      description: "Clear and concise description of the bug"
      placeholder: "When performing X action, Y unexpected behavior occurs"
    validations:
      required: true

  - type: textarea
    id: reproduction_steps
    attributes:
      label: "Reproduction Steps"
      description: "Steps to reproduce the behavior"
      placeholder: |
        1. Go to '...'
        2. Click on '....'
        3. Scroll down to '....'
        4. See error
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
      description: "What you expected to happen"
      placeholder: "The application should perform X action without errors"

  - type: textarea
    id: actual_behavior
    attributes:
      label: "Actual Behavior"
      description: "What actually happened"
      placeholder: "Instead, the application crashes with error Y"

  - type: textarea
    id: screenshots
    attributes:
      label: "Screenshots"
      description: "If applicable, add screenshots to help explain your problem"

  - type: textarea
    id: error_logs
    attributes:
      label: "Error Logs"
      description: "Relevant error messages, stack traces, or console output"
      placeholder: |
        ```
        Error: Something went wrong
        at Function.module.exports (file.js:10:15)
        ```

  - type: dropdown
    id: severity
    attributes:
      label: "Severity Level"
      description: "How critical is this bug?"
      options:
        - "P0 - Critical (Blocks core functionality)"
        - "P1 - High (Major feature broken)"
        - "P2 - Medium (Partial functionality issue)"
        - "P3 - Low (Minor issue/cosmetic)"
    validations:
      required: true

  - type: textarea
    id: environment
    attributes:
      label: "Environment"
      description: "Please complete the following information"
      placeholder: |
        - OS: [e.g., Windows 11, macOS 14, Ubuntu 22.04]
        - Browser: [e.g., Chrome 119, Firefox 120, Safari 17]
        - Node.js Version: [e.g., 18.17.0]
        - Python Version: [e.g., 3.11.0]
        - Application Version: [commit hash or version]

  - type: textarea
    id: additional_context
    attributes:
      label: "Additional Context"
      description: "Add any other context about the problem here"

  - type: checkboxes
    id: verification
    attributes:
      label: "Verification Checklist"
      description: "Please verify the following before submitting"
      options:
        - label: "I have searched existing issues and found no duplicates"
          required: true
        - label: "I have reproduced the issue in the latest version"
          required: true
        - label: "I have provided clear reproduction steps"
          required: true
        - label: "I have included relevant error messages or logs"
          required: true

  - type: markdown
    attributes:
      value: |
        ## Bug Severity Classification (Reference)

        Based on [bug_report.md](../checks/bug_report.md):

        - **P0 (Critical):** Blocks development, compilation, or core functionality
        - **P1 (High):** Major functionality broken, security risk, compliance violation  
        - **P2 (Medium):** Feature partially broken, performance degraded
        - **P3 (Low):** Minor issue, cosmetic, code quality

        ## Related Documentation

        - [Bug Report - Top 25 Defects](../checks/bug_report.md)
        - [Startup Procedures](../docs/STARTUP_PROCEDURES_AND_ERROR_PATTERNS.md)
        - [Testing Guide](../docs/TESTING_GUIDE.md)
        - [Performance Optimization](../docs/PERFORMANCE_OPTIMIZATION_REPORT.md)

        ## Quick Troubleshooting

        **For startup issues:**
        - Check `docker-compose logs` for service errors
        - Verify database connectivity
        - Check WebSocket connection status

        **For frontend issues:**
        - Check browser console for errors
        - Verify API endpoints are accessible
        - Check WebSocket connectivity

        **For backend issues:**
        - Check API logs for errors
        - Verify database migrations applied
        - Check feature flag service status