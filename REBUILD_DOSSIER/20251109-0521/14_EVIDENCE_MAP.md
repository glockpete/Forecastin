# 14 Evidence Traceability Map

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Bidirectional traceability from findings to implementation

---

## Traceability Matrix

This document provides end-to-end traceability:

```
FINDING → ANTIPATTERN → ADR → ARCHITECTURE → PLAN STEP → TASK → TEST → PR
```

---

## Findings → Architecture → Tasks

| Finding | Antipattern | Architecture Solution | Plan Step | Tasks | Tests | ADR |
|---------|-------------|----------------------|-----------|-------|-------|-----|
| F-0001 | - | 04/contracts.ts:exports | Phase 0 | T-0002 | Contract tests | - |
| F-0002 | Antipattern-6 | 04/security.py | Phase 0 | T-0001 | Security scan | ADR-0005 |
| F-0003 | - | 04/events.py:layer_id | Phase 0 | T-0004 | Test fixtures | - |
| F-0004 | Antipattern-3 | 04/geometry.py | Phase 2 | T-0201 | T-0203 | ADR-0002 |
| F-0005 | - | 04/responses.py | Phase 2 | T-0202 | Contract tests | - |
| F-0006 | Antipattern-1,4 | 04/base.py | Phase 1 | T-0101,T-0104 | Service tests | ADR-0001 |
| F-0007 | Antipattern-2 | 04/websocket.py | Phase 1 | T-0102,T-0103 | Service tests | ADR-0001 |
| F-0008 | Antipattern-5 | 04/FeatureGate | Phase 3 | T-0301-T-0309 | Flag tests | ADR-0003 |
| F-0009 | - | Gradual refactoring | Phase 5 | T-0502 | Type tests | - |
| F-0010 | - | 04/logging.py | Phase 4 | T-0401 | Log tests | ADR-0004 |
| F-0011 | - | 04/sentry.ts | Phase 4 | T-0402 | Error tests | ADR-0004 |
| F-0012 | - | ESLint rule | Phase 5 | T-0503 | Lint tests | - |
| F-0013 | - | Cleanup .env | Phase 5 | T-0501 | Config tests | - |
| F-0014 | - | Update .env.example | Phase 5 | T-0501 | Config tests | - |
| F-0015 | - | 06/Alembic | Migration | Separate effort | Migration tests | - |
| F-0016 | - | ErrorBoundary hierarchy | UI rebuild | Frontend tasks | UI tests | - |
| F-0017 | - | Delete file | Phase 0 | T-0003 | - | - |
| F-0018 | - | CI fix | CI/CD | Add npm ci step | CI tests | - |
| F-0019 | - | Parallel execution | CI/CD | Job matrix | CI tests | - |

---

## Antipatterns → Solutions

| Antipattern | Root Cause | Architecture Solution | Prevention | Tasks |
|-------------|------------|----------------------|------------|-------|
| AP-1: Inconsistent Service Lifecycle | No base class | BaseService ABC + ServiceRegistry | Linter rule | T-0101 to T-0104 |
| AP-2: Mixed Threading Model | Legacy code | Pure async with asyncio | Semgrep rule | T-0103 |
| AP-3: Contract Type Loss | Incomplete generator | Full Pydantic→TS fidelity | Contract tests | T-0201, T-0203 |
| AP-4: Global Service Instances | No DI framework | ServiceRegistry with DI | Linter rule | T-0104 |
| AP-5: Unused Feature Flags | No integration | FeatureGate HOC | Usage checker | T-0301 to T-0309 |
| AP-6: Hardcoded Credentials | Quick testing | Environment variables | Gitleaks | T-0001 |

---

## ADRs → Findings → Tasks

| ADR | Title | Addresses | Key Decisions | Tasks |
|-----|-------|-----------|---------------|-------|
| ADR-0001 | Service Lifecycle Standard | F-0006, F-0007, AP-1, AP-2 | BaseService ABC, async-only, ServiceRegistry | T-0101 to T-0104 |
| ADR-0002 | Contract Generation Strategy | F-0004, F-0001, AP-3 | Full type fidelity, Literal/Tuple support | T-0201 to T-0203 |
| ADR-0003 | Feature Flag Architecture | F-0008, AP-5 | FeatureGate HOC, gradual rollout | T-0301 to T-0309 |
| ADR-0004 | Observability Standards | F-0010, F-0011 | Structured logging, Sentry integration | T-0401, T-0402 |
| ADR-0005 | Secrets Management | F-0002, AP-6 | No hardcoded credentials, gitleaks | T-0001 |

---

## Tasks → Tests → Exit Criteria

| Task | Test File | Test Type | Exit Criteria | Coverage |
|------|-----------|-----------|---------------|----------|
| T-0001 | scripts/security/scan-secrets.sh | Security | gitleaks returns 0 | 100% |
| T-0002 | frontend/build output | Build | npm run build succeeds | N/A |
| T-0003 | - | Manual | File deleted | N/A |
| T-0004 | api/tests/test_*.py | Unit | pytest passes | 100% |
| T-0101 | api/tests/test_base_service.py | Unit | All lifecycle tests pass | 100% |
| T-0102 | api/tests/test_websocket_manager.py | Unit | BaseService inheritance | 100% |
| T-0103 | api/tests/test_automated_refresh.py | Integration | Shutdown <5s | 100% |
| T-0104 | api/tests/test_*.py | Integration | Zero globals | 100% |
| T-0201 | tests/contracts/test_generator.py | Unit | Zero 'any' in geometry | 100% |
| T-0202 | frontend/build output | Build | Compilation succeeds | N/A |
| T-0203 | tests/contracts/*.py, *.ts | Unit | All types validated | 100% |
| T-0301 | frontend/tests/FeatureGate.test.tsx | Unit | HOC works correctly | 100% |
| T-0302-T-0309 | Integration with flag toggle | Integration | 0%/50%/100% tested | 100% |
| T-0401 | Log output validation | Integration | JSON logs in production | N/A |
| T-0402 | Sentry dashboard | Integration | Errors reported | N/A |
| T-0501 | grep for REACT_APP_ | Manual | Zero matches | N/A |
| T-0502 | frontend/build output | Build | <20 'any' types | >95% |
| T-0503 | ESLint output | Lint | Zero violations | N/A |

---

## PR Checklist → Findings

Every PR must include:

| Checklist Item | Addresses | Evidence |
|----------------|-----------|----------|
| Contract impact considered | F-0004, F-0005 | 04_TARGET_ARCHITECTURE.md |
| DB change has migration + tests | F-0015 | 06_MIGRATIONS.md |
| Error boundaries covered | F-0016 | UI rebuild docs |
| Performance budget delta | 16_PERF_BUDGETS.md | SLO validation |
| Evidence links (F-####) | All findings | This document |
| No hardcoded secrets | F-0002 | gitleaks scan |
| Service inherits BaseService | F-0006 | ADR-0001 |
| No threading in async code | F-0007 | Semgrep scan |
| Feature flag integrated | F-0008 | Usage checker |
| Structured logging used | F-0010, F-0011 | Log validation |

---

## Quality Gates → Findings

| Quality Gate | Pass Criteria | Addresses | Tool |
|--------------|---------------|-----------|------|
| No hardcoded secrets | gitleaks returns 0 | F-0002 | gitleaks |
| TypeScript builds | npm run build succeeds | F-0001, F-0005 | tsc |
| Contract types valid | Zero 'any' in geometry | F-0004 | grep + tests |
| Tests pass | pytest + npm test pass | All | pytest, vitest |
| No threading | Semgrep clean | F-0007 | semgrep |
| Service lifecycle | All inherit BaseService | F-0006 | AST linter |
| Feature flags used | Usage checker passes | F-0008 | custom script |
| Performance SLOs | Maintain baselines | R-0004 | performance tests |

---

## Finding → File → Line Range

Quick reference for all findings:

```
F-0001: frontend/src/types/contracts.generated.ts:359-363
F-0002: scripts/testing/direct_performance_test.py:50
F-0003: api/tests/{conftest.py:45-80, test_rss_entity_extractor.py:25-60, test_scenario_service.py:30-50}
F-0004: frontend/src/types/contracts.generated.ts:218-278 (geometry types)
F-0005: frontend/src/types/index.ts (HierarchyResponse missing entities)
F-0006: api/services/{websocket_manager.py, automated_refresh_service.py, feature_flag_service.py, ...}
F-0007: api/services/automated_refresh_service.py:73-103
F-0008: frontend/src/config/feature-flags.ts (9 flags, 1 used)
F-0009: frontend/src/ (97 'any' types)
F-0010: frontend/src/types/ws_messages.ts:715,723
F-0011: frontend/src/components/UI/ErrorBoundary.tsx:47,74-75
F-0012: docs/CI_REQUIREMENTS.md:118, checks/api_ui_drift.md:106
F-0013: frontend/.env.example:37-42
F-0014: scripts/deployment/startup_validation.py:33-34
F-0015: migrations/ (6 files, unclear order)
F-0016: frontend/src/components/UI/ErrorBoundary.tsx (single boundary)
F-0017: frontend/src/types/zod/messages.ts.deprecated
F-0018: .github/workflows/ (missing npm ci)
F-0019: .github/workflows/ci-cd-pipeline.yml (422 lines, 6 sequential jobs)
```

---

## Reverse Traceability: Tasks → Findings

To answer "Why are we doing this task?":

```
T-0001 → F-0002 → Security vulnerability
T-0002 → F-0001 → Blocks TypeScript compilation
T-0003 → F-0017 → Code cleanup
T-0004 → F-0003 → Test failures
T-0101 → F-0006, AP-1 → Inconsistent service patterns
T-0102 → F-0006, F-0007, AP-1 → WebSocket service migration
T-0103 → F-0007, AP-2 → Threading in async code
T-0104 → F-0006, AP-4 → Global service instances
T-0201 → F-0004, AP-3 → Contract type loss
T-0202 → F-0005 → Missing response properties
T-0203 → Regression prevention → Contract quality
T-0301 → F-0008, AP-5 → Unused feature flags
T-0302-T-0309 → F-0008, AP-5 → Flag integration
T-0401 → F-0010, F-0011 → Console logging in production
T-0402 → F-0011 → No error monitoring
T-0501 → F-0013 → Deprecated env variables
T-0502 → F-0009 → 'any' type proliferation
T-0503 → F-0012 → Deep relative imports
T-0601 → Knowledge transfer → Documentation
T-0602 → Knowledge transfer → Training
```

---

## Verification Checklist

Before closing the rebuild project, verify:

- [ ] All 19 findings addressed (F-0001 to F-0019)
- [ ] All 6 antipatterns resolved (AP-1 to AP-6)
- [ ] All 5 ADRs implemented (ADR-0001 to ADR-0005)
- [ ] All 25 tasks completed (T-0001 to T-0602)
- [ ] All quality gates passing
- [ ] All tests green (backend + frontend + contract + integration)
- [ ] Performance SLOs maintained (42k RPS, 3.46ms queries, 99.2% cache hit)
- [ ] Security scan clean (gitleaks, bandit, semgrep)
- [ ] Documentation updated (CONTRIBUTING.md, README.md, DEVELOPER_HANDBOOK.md)
- [ ] Team trained (T-0602 complete)

---

**Traceability Map Complete**
**Bidirectional mapping from findings to implementation**
**Quality gates linked to findings**
**Verification checklist for project closure**
