# GitHub Issues for Critical Defects

This directory contains GitHub issue templates for critical defects identified in the codebase, including constructor signature and async mocking issues.

## Issues Created

| Issue | Title | Severity | Estimated Fix Time |
|-------|-------|----------|-------------------|
| [BUG-001](BUG-001_Missing_Type_Exports.md) | Missing Type Exports Block TypeScript Compilation | P0 - CRITICAL | 15 minutes |
| [BUG-002](BUG-002_Test_Fixtures_Missing_layerId.md) | Test Fixtures Missing Required layerId Property | P0 - CRITICAL | 30 minutes |
| [BUG-003](BUG-003_HierarchyResponse_Missing_entities.md) | HierarchyResponse Type Missing .entities Property | P0 - CRITICAL | 15 minutes - 1 hour |
| [BUG-004](BUG-004_Missing_Enum_Definitions.md) | Missing Enum Definitions in Generated Contracts | P0 - CRITICAL | 5-15 minutes |
| [BUG-005](BUG-005_main_py_Exceeds_Maintainability_Threshold.md) | api/main.py Exceeds Maintainability Threshold | P0 - CRITICAL | 4-6 hours |
| [BUG-015](BUG-015_Feature_Flag_Initialization.md) | Feature Flag Infrastructure Unused (88% Adoption Gap) | P1 - HIGH | 6-8 hours |
| [BUG-016](BUG-016_Constructor_Signature_Inconsistencies.md) | Constructor Signature Inconsistencies Across Service Implementations | P1 - HIGH | 3-4 hours |
| [BUG-017](BUG-017_Async_Mocking_Framework_Issues.md) | Async Mocking Framework Issues and Inconsistent Patterns | P1 - HIGH | 2-3 hours |
| [BUG-018](BUG-018_Service_Initialization_Pattern_Issues.md) | Service Initialization Pattern Issues and Thread Safety Concerns | P1 - HIGH | 4-5 hours |

## Usage Instructions

### For GitHub Repository

1. **Copy the content** from each markdown file
2. **Create a new issue** in your GitHub repository
3. **Paste the content** and adjust labels/assignees as needed
4. **Reference related documentation** from the bug report

### For Project Management

- **Priority Order:** Address issues in the order listed above
- **Quick Wins:** BUG-001, BUG-003, BUG-004 can be fixed quickly
- **Architecture:** BUG-005 requires significant refactoring effort

## Issue Template Structure

Each issue includes:

- **Header:** Severity, priority, type, status, assignee, labels
- **Description:** Clear problem statement
- **Impact:** What functionality is affected
- **Reproduction Steps:** How to reproduce the issue
- **Expected vs Actual Behavior:** Clear comparison
- **Proposed Fix:** Specific code changes or approaches
- **Code References:** Files and related documentation
- **Acceptance Criteria:** Clear completion criteria
- **Additional Context:** Any relevant background information

## Related Documentation

- **Source:** [`checks/bug_report.md`](../checks/bug_report.md)
- **Detailed Analysis:** [`REPORT.md`](../docs/REPORT.md)
- **API/UI Drift:** [`checks/api_ui_drift.md`](../checks/api_ui_drift.md)
- **Scout Log:** [`SCOUT_LOG.md`](../SCOUT_LOG.md)

## Next Steps

1. **Immediate Action:** Fix BUG-001, BUG-003, BUG-004 to unblock development
2. **Testing:** Address BUG-002 to restore test reliability
3. **Architecture:** Plan and execute BUG-005 refactor
4. **Infrastructure:** Address BUG-015 feature flag adoption gap
5. **Code Quality:** Fix BUG-016, BUG-017, BUG-018 constructor and async mocking issues
6. **Validation:** Ensure all fixes maintain existing functionality

## Estimated Total Effort

- **P0 Critical Issues:** 6-9 hours total
- **P1 High Issues:** 15-20 hours total
- **Recommended Timeline:**
  - P0: Fix immediately (today/this week)
  - P1: Schedule for next sprint
- **Priority:** P0 issues block development and should be addressed first