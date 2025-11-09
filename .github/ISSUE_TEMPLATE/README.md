# GitHub Issue Templates

This directory contains specialized issue templates for the Forecastin project, designed to capture comprehensive information for common defect categories based on our extensive bug analysis.

## Available Templates

### 🐛 TypeScript Compilation Error
**Use for:** TypeScript compilation failures, missing exports, type system issues
- Based on BUG-001, BUG-003, BUG-004, BUG-006 from bug_report.md
- Captures error codes, affected files, and reproduction steps
- References TypeScript error fixes documentation

### 🚩 Feature Flag Initialization Issue  
**Use for:** Feature flag service failures, configuration issues, gradual rollout problems
- Based on BUG-015 (88% adoption gap) from bug_report.md
- Captures flag names, initialization errors, and impact assessment
- References feature flag migration documentation

### 🔗 Schema Mismatch Issue
**Use for:** API contract, WebSocket message, or database schema mismatches
- Based on BUG-002 (test fixture schema issues) and BUG-003 (type mismatches)
- Captures expected vs actual schemas, validation failures
- References WebSocket schema standards and contract generation

### 🧪 Test Coverage Issue
**Use for:** Test failures, missing coverage, testing framework issues
- Based on BUG-002, BUG-008, BUG-009 from bug_report.md
- Captures test types, framework configuration, coverage impact
- References testing guide and performance requirements

### ⚡ Constructor/Async Mocking Issue
**Use for:** Constructor initialization, async operations, mocking pattern issues
- Captures race conditions, dependency injection problems, test timing
- References async testing patterns and service initialization

### 🐛 Bug Report (General)
**Use for:** Bugs not covered by specific templates
- General purpose template with standard bug reporting fields
- References comprehensive bug report documentation

## Template Structure

All templates follow a consistent structure:

1. **Header Section**: Template metadata (name, description, labels)
2. **Pre-submission Checklist**: Verification steps before creating issue
3. **Issue Description**: Clear problem statement
4. **Reproduction Steps**: Step-by-step instructions to reproduce
5. **Expected vs Actual Behavior**: Clear comparison
6. **Environment Information**: Runtime and testing environment details
7. **Severity Assessment**: P0-P4 classification based on bug_report.md
8. **Proposed Solutions**: Optional suggested fixes
9. **Verification Checklist**: Final validation before submission
10. **Related Documentation**: Links to relevant project documentation

## Severity Classification

Templates use the severity classification from bug_report.md:

- **P0 (Critical)**: Blocks development, compilation, or core functionality
- **P1 (High)**: Major functionality broken, security risk, compliance violation
- **P2 (Medium)**: Feature partially broken, performance degraded
- **P3 (Low)**: Minor issue, cosmetic, code quality

## Based on Evidence

These templates are based on extensive analysis of:

- [bug_report.md](../checks/bug_report.md) - Top 25 defects with detailed analysis
- [TYPESCRIPT_ERROR_FIXES_2025-11-07.md](../docs/TYPESCRIPT_ERROR_FIXES_2025-11-07.md) - TypeScript error patterns and fixes
- [STARTUP_PROCEDURES_AND_ERROR_PATTERNS.md](../docs/STARTUP_PROCEDURES_AND_ERROR_PATTERNS.md) - Common error patterns
- [STACK_LEVEL_FIXES_CHEATSHEET.md](../docs/STACK_LEVEL_FIXES_CHEATSHEET.md) - Implementation patterns
- [TESTING_GUIDE.md](../docs/TESTING_GUIDE.md) - Testing requirements and patterns

## Usage Guidelines

1. **Choose the appropriate template** based on the issue category
2. **Complete all required fields** marked with validation
3. **Follow pre-submission checklists** to avoid duplicate issues
4. **Include relevant documentation references** when applicable
5. **Use severity classification consistently** with project standards

## Configuration

The [config.yml](config.yml) file:
- Disables blank issues to encourage template usage
- Provides contact links to relevant documentation
- Guides users to appropriate resources before creating issues

## Related Resources

- [Pull Request Template](../pull_request_template.md) - For code changes
- [CI/CD Workflows](../workflows/) - For automated testing and validation
- [Documentation](../docs/) - Comprehensive project documentation
- [Bug Report](../checks/bug_report.md) - Detailed defect analysis

## Template Version

**Version**: 1.0.0  
**Last Updated**: 2025-11-08  
**Based on Analysis**: bug_report.md (2025-11-07)