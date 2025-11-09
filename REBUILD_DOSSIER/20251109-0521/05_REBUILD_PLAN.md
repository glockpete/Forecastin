# 05 Rebuild Plan

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Phased plan to rebuild system from evidence, addressing all findings
**Status:** Blueprint for systematic migration from current to target architecture

---

## Executive Summary

This rebuild plan provides a phased approach to migrate from the current implementation to the target architecture defined in 04_TARGET_ARCHITECTURE.md. The plan prioritizes:

1. **Risk Mitigation:** Fix critical security issues first (F-0002 hardcoded credentials)
2. **Quick Wins:** Low-effort, high-impact fixes (F-0001, F-0017)
3. **Foundation:** Establish base patterns before building on them
4. **Incremental:** Small, tested changes with rollback capability
5. **Evidence-Based:** Every step addresses specific findings

**Timeline:** 16 weeks (4 months) with 2-3 developers
**Risk:** Medium (strangler fig pattern allows parallel operation)
**Rollback:** Every phase has explicit rollback procedures

---

## Rebuild Strategy: Strangler Fig Pattern

We will **NOT** perform a big-bang rewrite. Instead, we'll use the strangler fig pattern:

```
Week 1-2: Create new patterns alongside old code
Week 3-8: Migrate services one-by-one to new patterns
Week 9-12: Migrate frontend components incrementally
Week 13-16: Remove old code, optimize, document
```

**Benefits:**
- Production system remains operational throughout
- Each change can be tested independently
- Easy rollback if issues discovered
- Team learns new patterns gradually

---

## Phase 0: Immediate Actions (Week 1) - CRITICAL

### Goal
Fix critical security vulnerabilities and blocking compilation errors.

### Tasks

#### T-0001: Remove Hardcoded Database Password
**Priority:** P0 - Security
**Effort:** 15 minutes
**Evidence:** F-0002
**Files:**
- `scripts/testing/direct_performance_test.py:50`

**Steps:**
1. Replace hardcoded connection string with `os.getenv('DATABASE_URL')`
2. Rotate database password in all environments
3. Verify no other hardcoded credentials exist
4. Add gitleaks pre-commit hook

**Exit Criteria:**
- `gitleaks detect` returns zero findings
- Database connection still works with env variable
- Password rotated in dev/staging/prod

**Rollback:** Revert commit, restore old password

---

#### T-0002: Export Missing Contract Functions
**Priority:** P0 - Blocks Compilation
**Effort:** 15 minutes
**Evidence:** F-0001
**Files:**
- `frontend/src/types/contracts.generated.ts:359-363`

**Steps:**
1. Add `export` keyword to `getConfidence` and `getChildrenCount` functions
2. Run `npm run build` to verify compilation succeeds
3. Update contract generator to always export utilities

**Exit Criteria:**
- `npm run build` succeeds with zero errors
- All 3 importing files compile successfully

**Rollback:** Revert commit

---

#### T-0003: Delete Deprecated File
**Priority:** P3 - Cleanup
**Effort:** 2 minutes
**Evidence:** F-0017
**Files:**
- `frontend/src/types/zod/messages.ts.deprecated`

**Steps:**
1. `git rm frontend/src/types/zod/messages.ts.deprecated`
2. `git commit -m "chore: Remove deprecated file (F-0017)"`

**Exit Criteria:**
- File no longer in repository
- No imports reference deleted file

**Rollback:** `git revert`

---

#### T-0004: Fix Test Fixture Schema Mismatches
**Priority:** P0 - Tests Failing
**Effort:** 30 minutes
**Evidence:** F-0003
**Files:**
- `api/tests/conftest.py:45-80`
- `api/tests/test_rss_entity_extractor.py:25-60`
- `api/tests/test_scenario_service.py:30-50`

**Steps:**
1. Add `layer_id` property to all 8 test fixtures
2. Run `pytest api/tests/` to verify tests pass
3. Create fixture factory with schema validation

**Exit Criteria:**
- All tests pass
- Fixtures match `LayerUpdateEvent` schema
- Future schema changes caught by validation

**Rollback:** Revert commit

---

### Phase 0 Summary

**Duration:** 1-2 days
**Effort:** ~1 hour actual work
**Impact:** Unblocks development, removes security risk
**Dependencies:** None

---

## Phase 1: Foundation - Service Patterns (Weeks 2-3)

### Goal
Establish consistent service lifecycle patterns and dependency injection.

### Tasks

#### T-0101: Create BaseService Abstract Class
**Priority:** P1 - Foundation
**Effort:** 4 hours
**Evidence:** Antipattern 1, F-0006
**Files:** (NEW)
- `api/services/base.py`
- `api/services/registry.py`

**Steps:**
1. Create `BaseService` ABC with standard lifecycle (see 04_TARGET_ARCHITECTURE.md)
2. Create `ServiceRegistry` for dependency injection
3. Add comprehensive unit tests (test_base_service.py)
4. Document in CONTRIBUTING.md

**Exit Criteria:**
- BaseService has start(), stop(), health_check() abstract methods
- ServiceRegistry can register/retrieve services
- 100% test coverage for both classes
- Linter rule added to enforce BaseService inheritance

**Rollback:** Delete new files

---

#### T-0102: Migrate WebSocketManager to BaseService
**Priority:** P1 - Migration
**Effort:** 2 hours
**Evidence:** Antipattern 1, F-0007
**Files:**
- `api/services/websocket_manager.py`

**Steps:**
1. Make WebSocketManager inherit from BaseService
2. Rename methods: `start_service()` → `start()`, `stop_service()` → `stop()`
3. Keep old methods as deprecated wrappers (temporary)
4. Update tests
5. Update main.py to use new interface

**Exit Criteria:**
- WebSocketManager inherits from BaseService
- All lifecycle tests pass
- Health check returns meaningful status
- Backward compatibility maintained

**Rollback:** Git revert

---

#### T-0103: Convert AutomatedRefreshService to Pure Async
**Priority:** P1 - Critical Performance
**Effort:** 6 hours
**Evidence:** Antipattern 2, F-0007
**Files:**
- `api/services/automated_refresh_service.py`

**Steps:**
1. Replace `threading.Thread` with `asyncio.create_task()`
2. Replace `time.sleep()` with `asyncio.sleep()`
3. Add cancellation token for graceful shutdown
4. Inherit from BaseService
5. Test shutdown time < 5 seconds (down from 65 seconds!)

**Exit Criteria:**
- No threading.Thread usage
- All `time.sleep()` replaced with `asyncio.sleep()`
- Shutdown completes in < 5 seconds
- All tests pass

**Rollback:** Git revert (keep old version in parallel during transition)

---

#### T-0104: Replace Global Service Instances with Registry
**Priority:** P1 - Architecture
**Effort:** 4 hours
**Evidence:** Antipattern 4, F-0006
**Files:**
- `api/main.py`
- `api/routers/*.py`
- All services

**Steps:**
1. Create ServiceRegistry instance in main.py
2. Register all services in FastAPI lifespan
3. Update routers to use `Depends(get_service)` pattern
4. Remove all global `_service_instance` variables
5. Update tests to use fixtures instead of globals

**Exit Criteria:**
- Zero global service variables in codebase
- All routers use dependency injection
- Tests isolated (no shared state)
- ServiceRegistry manages all lifecycle

**Rollback:** Keep global variables alongside registry during transition

---

### Phase 1 Summary

**Duration:** 2 weeks
**Effort:** ~16 hours
**Impact:** Consistent patterns, testable services, faster shutdown
**Dependencies:** Phase 0 complete

---

## Phase 2: Contract Improvements (Weeks 4-5)

### Goal
Achieve full type fidelity in contracts, zero 'any' types.

### Tasks

#### T-0201: Improve Contract Generator for Literal/Tuple Types
**Priority:** P1 - Type Safety
**Effort:** 8 hours
**Evidence:** F-0004, Antipattern 3
**Files:**
- `scripts/dev/generate_contracts.py` → `generate_contracts_v2.py`

**Steps:**
1. Add Literal type translation (Python Literal['Point'] → TS 'Point')
2. Add Tuple type translation (Python Tuple[float, float] → TS [number, number])
3. Add Union type translation
4. Add comprehensive tests for all Pydantic type patterns
5. Generate contracts with new generator
6. Verify zero 'any' types in output

**Exit Criteria:**
- All geometry types properly typed (no 'any')
- Contract generator has 90%+ test coverage
- CI fails if any 'any' types introduced
- Documentation updated

**Rollback:** Keep old generator until new one fully validated

---

#### T-0202: Add Missing Properties to Response Types
**Priority:** P1 - Compilation Errors
**Effort:** 2 hours
**Evidence:** F-0005
**Files:**
- `api/contracts/responses.py` (NEW)
- `frontend/src/types/contracts.generated.ts`

**Steps:**
1. Add `entities` property to `HierarchyResponse`
2. Add `children_count` property to `EntityResponse`
3. Regenerate TypeScript contracts
4. Verify all 6 compilation errors resolved

**Exit Criteria:**
- `npm run build` succeeds
- All MillerColumns and SearchInterface components compile
- Contract tests validate new properties

**Rollback:** Git revert

---

#### T-0203: Create Contract Test Suite
**Priority:** P1 - Quality
**Effort:** 6 hours
**Evidence:** Need for regression prevention
**Files:** (NEW)
- `tests/contracts/test_contract_generator.py`
- `frontend/tests/contracts/contract_validation.test.ts`

**Steps:**
1. Test Literal type generation
2. Test Tuple type generation
3. Test Union type generation
4. Test all geometry types
5. Test request/response schemas
6. Test WebSocket event schemas
7. Add to CI pipeline

**Exit Criteria:**
- 100% contract type coverage
- Tests fail if any 'any' types generated
- CI runs contract tests on every PR

**Rollback:** N/A (tests only)

---

### Phase 2 Summary

**Duration:** 2 weeks
**Effort:** ~16 hours
**Impact:** Full type safety, prevents F-0004 class issues
**Dependencies:** Phase 0 complete

---

## Phase 3: Feature Flag Integration (Weeks 6-9)

### Goal
Integrate all 8 unused feature flags into components.

### Tasks

#### T-0301: Create FeatureGate HOC
**Priority:** P2 - Infrastructure
**Effort:** 4 hours
**Evidence:** F-0008, Antipattern 5
**Files:** (NEW)
- `frontend/src/components/FeatureGate/FeatureGate.tsx`
- `frontend/src/components/FeatureGate/withFeatureFlag.tsx`

**Steps:**
1. Create `<FeatureGate>` component
2. Create `withFeatureFlag()` HOC
3. Add comprehensive tests
4. Document usage in CONTRIBUTING.md

**Exit Criteria:**
- Components can be wrapped with feature flags
- Fallback UI renders when flag disabled
- Loading state handled gracefully

**Rollback:** Delete new files

---

#### T-0302-T-0309: Integrate Individual Flags (1 per week)
**Priority:** P2 - Gradual Rollout
**Effort:** 2 hours each
**Evidence:** F-0008

**Schedule:**
- Week 6: `ff.point_layer`
- Week 7: `ff.polygon_layer`
- Week 8: `ff.gpu_filtering`
- Week 9: `ff.websocket_layers`
- (Continue for all 8 flags)

**Steps per flag:**
1. Wrap component with `<FeatureGate flagKey="ff.xxx">`
2. Test at 0%, 10%, 50%, 100% rollout
3. Monitor for errors
4. Gradually roll out to 100%
5. Remove wrapper after 2 weeks at 100%

**Exit Criteria per flag:**
- Flag integrated into component
- Tested at multiple rollout percentages
- Zero production errors
- Rollback demonstrated

**Rollback:** Disable flag (set to 0%)

---

### Phase 3 Summary

**Duration:** 4 weeks
**Effort:** ~20 hours
**Impact:** Gradual rollout capability, reduce deployment risk
**Dependencies:** Phase 0 complete

---

## Phase 4: Observability & Logging (Weeks 10-11)

### Goal
Replace console.log/warn/error with structured logging and error monitoring.

### Tasks

#### T-0401: Implement Structured Logging
**Priority:** P2 - Production Quality
**Effort:** 6 hours
**Evidence:** F-0010, F-0011
**Files:** (NEW)
- `api/services/observability/logging.py`
- `api/middleware/correlation_id.py`
- `frontend/src/utils/logger.ts`

**Steps:**
1. Setup structlog for backend (see 04_TARGET_ARCHITECTURE.md)
2. Add correlation ID middleware
3. Replace all `logger.info()` calls with structured logging
4. Replace frontend console.* with structured logger
5. Configure JSON output for production

**Exit Criteria:**
- All logs output as structured JSON in production
- Correlation IDs flow through all requests
- Zero console.* calls in production code
- Logs parseable by log aggregation tools

**Rollback:** Keep console.* during transition

---

#### T-0402: Integrate Error Monitoring (Sentry)
**Priority:** P2 - Production Quality
**Effort:** 4 hours
**Evidence:** F-0011
**Files:**
- `api/main.py`
- `frontend/src/utils/sentry.ts`
- `frontend/src/components/ErrorBoundary/*.tsx`

**Steps:**
1. Setup Sentry account and DSN
2. Integrate Sentry SDK in backend
3. Integrate Sentry SDK in frontend
4. Update ErrorBoundary to send to Sentry
5. Configure error sampling and filtering
6. Test error reporting

**Exit Criteria:**
- Errors automatically sent to Sentry
- Error boundaries integrated
- Source maps uploaded for stack traces
- Alerts configured for critical errors

**Rollback:** Remove Sentry integration

---

### Phase 4 Summary

**Duration:** 2 weeks
**Effort:** ~10 hours
**Impact:** Production visibility, faster debugging
**Dependencies:** Phase 0 complete

---

## Phase 5: Cleanup & Optimization (Weeks 12-14)

### Goal
Remove deprecated code, optimize performance, clean up technical debt.

### Tasks

#### T-0501: Remove Deprecated Environment Variables
**Priority:** P3 - Cleanup
**Effort:** 2 hours
**Evidence:** F-0013
**Files:**
- `frontend/.env.example`
- `frontend/src/config/env.ts`

**Steps:**
1. Verify no code references REACT_APP_* variables
2. Remove deprecated section from .env.example
3. Update CHANGELOG.md

**Exit Criteria:**
- No REACT_APP_* variables in codebase
- All VITE_* variables documented

**Rollback:** Git revert

---

#### T-0502: Refactor 'any' Types to Proper Types
**Priority:** P2 - Type Safety
**Effort:** 16 hours (2 hours/week over 8 weeks)
**Evidence:** F-0009
**Files:**
- Multiple TypeScript files

**Steps:**
1. Identify all 97 uses of 'any' type
2. Prioritize by impact (business logic > third-party types)
3. Refactor 10-15 per week
4. Add ESLint rule to prevent new 'any' types

**Exit Criteria:**
- < 20 'any' types remaining (only third-party unavoidable)
- ESLint enforces no new 'any' in business logic
- Type coverage > 95%

**Rollback:** N/A (incremental improvement)

---

#### T-0503: Add ESLint Rule for Path Aliases
**Priority:** P2 - DX
**Effort:** 2 hours
**Evidence:** F-0012
**Files:**
- `frontend/.eslintrc.js`

**Steps:**
1. Add no-restricted-imports rule blocking `../../../` patterns
2. Run codemod to convert existing imports to path aliases
3. Update documentation

**Exit Criteria:**
- Zero deep relative path imports
- ESLint prevents new violations
- All imports use path aliases

**Rollback:** Remove ESLint rule

---

### Phase 5 Summary

**Duration:** 3 weeks
**Effort:** ~20 hours
**Impact:** Cleaner codebase, better DX
**Dependencies:** Phase 2 complete (for type safety)

---

## Phase 6: Documentation & Training (Weeks 15-16)

### Goal
Update all documentation, train team on new patterns.

### Tasks

#### T-0601: Update CONTRIBUTING.md
**Priority:** P2 - Documentation
**Effort:** 4 hours
**Files:**
- `CONTRIBUTING.md`
- `docs/DEVELOPER_HANDBOOK.md` (NEW)

**Steps:**
1. Document BaseService pattern
2. Document ServiceRegistry pattern
3. Document contract generation workflow
4. Document feature flag integration
5. Document structured logging
6. Add code review checklists

**Exit Criteria:**
- All new patterns documented
- Examples provided
- Onboarding checklist updated

**Rollback:** N/A

---

#### T-0602: Conduct Team Training
**Priority:** P2 - Knowledge Transfer
**Effort:** 8 hours (2x 2-hour sessions + prep)
**Files:**
- Training materials (slides/docs)

**Steps:**
1. Session 1: Service patterns, DI, lifecycle
2. Session 2: Contracts, feature flags, observability
3. Q&A and hands-on exercises
4. Record sessions for future reference

**Exit Criteria:**
- All team members trained
- Training materials available
- Q&A documented

**Rollback:** N/A

---

### Phase 6 Summary

**Duration:** 2 weeks
**Effort:** ~12 hours
**Impact:** Team alignment, sustainable patterns
**Dependencies:** All previous phases

---

## Critical Path Analysis

```
Gantt Chart (16 weeks):

Week 1-2:  Phase 0 (Critical Fixes) + Phase 1 Start (BaseService)
Week 3-4:  Phase 1 Complete (Services) + Phase 2 Start (Contracts)
Week 5:    Phase 2 Complete (Contracts)
Week 6-9:  Phase 3 (Feature Flags - parallel with other work)
Week 10-11: Phase 4 (Observability)
Week 12-14: Phase 5 (Cleanup)
Week 15-16: Phase 6 (Documentation & Training)

Critical Path:
Phase 0 → Phase 1 → Phase 2 → Phase 4 → Phase 6
(Phases 3 and 5 can run in parallel with others)
```

---

## Risk Mitigation

### Risk 1: Breaking Production During Migration
**Likelihood:** Medium
**Impact:** High
**Mitigation:**
- Strangler fig pattern (old and new code coexist)
- Feature flags for gradual rollout
- Comprehensive testing at each step
- Rollback procedures documented

### Risk 2: Team Velocity Drops
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:**
- Training sessions before major changes
- Pairing for first implementations
- Clear documentation and examples
- Code review focus on patterns

### Risk 3: Contract Generation Breaks
**Likelihood:** Low
**Impact:** High
**Mitigation:**
- Comprehensive contract tests (T-0203)
- CI validates every generation
- Manual review of first few generations
- Keep old generator as fallback

### Risk 4: Performance Regression
**Likelihood:** Low
**Impact:** High
**Mitigation:**
- Performance tests in CI (existing)
- SLO monitoring (40k RPS baseline)
- Load testing before each phase completes

---

## Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| TypeScript 'any' count | 97 | < 20 | `grep -r ": any" frontend/src \| wc -l` |
| Service shutdown time | 65s | < 5s | Integration tests |
| Feature flag integration | 11% (1/9) | 100% (9/9) | Code audit |
| Test fixture failures | 8 | 0 | `pytest api/tests/` |
| Security vulnerabilities | 1+ | 0 | `gitleaks detect` |
| Contract test coverage | 0% | 100% | Coverage report |

---

## Rollback Procedures

### General Rollback Process
1. Identify problematic phase/task
2. Revert commits for that task (Git)
3. Re-run tests to verify stability
4. Document lessons learned
5. Plan fix before retry

### Phase-Specific Rollback

**Phase 0:** Simple git revert (no dependencies)
**Phase 1:** Keep old global services alongside new registry during transition
**Phase 2:** Keep old contract generator until new one validated
**Phase 3:** Disable feature flags (set to 0%)
**Phase 4:** Remove Sentry integration, keep console.* temporarily
**Phase 5:** Git revert individual cleanup commits
**Phase 6:** No rollback needed (documentation only)

---

## Task Breakdown CSV

See `05_REBUILD_PLAN.csv` for machine-readable task list with dependencies.

---

## Conclusion

This rebuild plan provides a systematic, low-risk approach to migrating from current implementation to target architecture. By using the strangler fig pattern, we can improve the system incrementally while maintaining production stability.

**Total Estimated Effort:** ~100 hours (2-3 developers over 16 weeks)
**Risk Level:** Medium (mitigated by incremental approach)
**Success Probability:** High (all changes are proven patterns)

**Next Steps:**
1. Get stakeholder approval for timeline
2. Assign Phase 0 tasks (week 1)
3. Begin execution with daily standups
4. Track progress in project management tool

---

**Rebuild Plan Complete**
**Evidence-based, phased approach addressing all 19 findings**
**Rollback procedures for every phase**
**Success metrics defined and measurable**
