# 10 Risk Register

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Risk identification and mitigation strategies for rebuild

---

## Risk Assessment Matrix

| Risk ID | Risk | Likelihood | Impact | Severity | Mitigation | Kill Switch |
|---------|------|------------|--------|----------|------------|-------------|
| R-0001 | Production breakage during migration | Medium | High | HIGH | Strangler fig pattern, feature flags | Disable flags, rollback |
| R-0002 | Team velocity drops | Medium | Medium | MEDIUM | Training, pairing, clear docs | Add temporary resources |
| R-0003 | Contract generator breaks | Low | High | MEDIUM | Comprehensive tests, manual review | Use old generator |
| R-0004 | Performance regression | Low | High | MEDIUM | SLO monitoring, load tests | Rollback changes |
| R-0005 | Type safety issues | Medium | Medium | MEDIUM | Gradual migration, CI checks | Revert to any temporarily |
| R-0006 | Database migration failure | Low | Critical | HIGH | Alembic framework, backups | Restore from backup |
| R-0007 | Feature flag rollout issues | Medium | Medium | MEDIUM | Gradual rollout (10%→100%) | Set flag to 0% |
| R-0008 | Service lifecycle bugs | Medium | High | HIGH | Comprehensive tests, health checks | Restart services |
| R-0009 | Observability gap | Low | Medium | LOW | Structured logging from day 1 | N/A |
| R-0010 | Documentation drift | High | Low | LOW | Update docs with each change | N/A |

---

## R-0001: Production Breakage During Migration

**Description:** Changes introduced during rebuild cause production outages or data loss

**Likelihood:** Medium
**Impact:** High (user-facing outages, data loss, revenue impact)
**Severity:** HIGH

**Root Causes:**
- Incompatible changes deployed simultaneously
- Insufficient testing before production
- Rollback procedures not tested
- Dependencies between old and new code

**Mitigation Strategies:**

1. **Strangler Fig Pattern**
   - Run old and new code in parallel
   - Gradually shift traffic to new implementation
   - Evidence: 05_REBUILD_PLAN.md Phase 1-6 approach

2. **Feature Flags for All Changes**
   - Every user-facing change behind flag
   - Gradual rollout: 10% → 25% → 50% → 100%
   - Evidence: T-0301 to T-0309

3. **Comprehensive Testing**
   - Unit tests for all changes (target: 80%+ coverage)
   - Integration tests for service interactions
   - Load tests before production (maintain 40k RPS baseline)
   - Evidence: 16_PERF_BUDGETS.md

4. **Blue-Green Deployment**
   - Deploy to staging first
   - Smoke tests in staging
   - Swap production traffic only after validation

**Leading Indicators:**
- Increased error rate in staging
- Performance degradation in load tests
- Failed health checks
- Alert: > 5% error rate increase

**Kill Switch:**
```bash
# Immediate rollback procedure
# 1. Disable all new feature flags
curl -X POST http://localhost:9000/api/feature-flags/emergency-disable-all

# 2. Rollback deployment
kubectl rollout undo deployment/forecastin-api

# 3. Verify health
curl http://localhost:9000/api/health
```

**Test Plan Steps:** T-0001 through T-0602 with rollback tested for each

---

## R-0002: Team Velocity Drops

**Description:** Development speed decreases as team learns new patterns

**Likelihood:** Medium
**Impact:** Medium (delayed timeline, missed milestones)
**Severity:** MEDIUM

**Root Causes:**
- Learning curve for new patterns (BaseService, DI, etc.)
- Unfamiliarity with Alembic, Sentry, structured logging
- Time spent refactoring instead of features
- Code review bottlenecks

**Mitigation Strategies:**

1. **Comprehensive Training** (T-0602)
   - 2 training sessions before implementation
   - Hands-on workshops
   - Pair programming for first implementations
   - Evidence: 18_DEVELOPER_HANDBOOK.md

2. **Clear Documentation** (T-0601)
   - Step-by-step guides for each pattern
   - Code examples and templates
   - Decision trees for common scenarios
   - Evidence: CONTRIBUTING.md updates

3. **Gradual Adoption**
   - Phase 1-6 approach allows learning in stages
   - Don't introduce all patterns simultaneously
   - Evidence: 05_REBUILD_PLAN.md 16-week timeline

4. **Dedicated Support**
   - Architecture office hours (2h/week)
   - Slack channel for questions
   - Code review prioritization

**Leading Indicators:**
- PR review time > 2 days (baseline: <1 day)
- Declined feature velocity (track story points/sprint)
- Increased questions in Slack
- Alert: 30% velocity drop for 2 consecutive sprints

**Kill Switch:**
- Pause new pattern adoption
- Focus on completing in-progress work
- Add temporary contractor for support

**Test Plan Steps:** Monitor velocity metrics weekly, adjust timeline if needed

---

## R-0003: Contract Generator Breaks

**Description:** Improved contract generator produces incorrect TypeScript types

**Likelihood:** Low
**Impact:** High (blocks frontend development, type safety lost)
**Severity:** MEDIUM

**Root Causes:**
- Incomplete Python→TypeScript type mapping
- Edge cases not handled (nested unions, complex generics)
- Pydantic model changes break assumptions
- Generator not tested with all Pydantic features

**Mitigation Strategies:**

1. **Comprehensive Contract Tests** (T-0203)
   - Test all Pydantic type patterns
   - Test edge cases (nested types, unions, generics)
   - Golden file testing (compare generated output)
   - Evidence: tests/contracts/test_contract_generator.py

2. **Manual Review of First Generations**
   - Architect reviews first 5 generated contract files
   - Compare to Python source line-by-line
   - Verify no 'any' types introduced

3. **Keep Old Generator as Fallback**
   - Don't delete generate_contracts.py
   - Can switch back if issues found
   - Evidence: 05_REBUILD_PLAN.md T-0201 dependencies

4. **CI Contract Validation**
   - Fail build if 'any' types detected in geometry
   - Fail build if required properties missing
   - Evidence: .github/workflows/contract-drift-check.yml enhancement

**Leading Indicators:**
- 'any' types in generated contracts
- TypeScript compilation errors
- Contract drift test failures
- Alert: Any 'any' type in geometry interfaces

**Kill Switch:**
```bash
# Revert to old generator
mv scripts/dev/generate_contracts.py.backup scripts/dev/generate_contracts.py
npm run contracts:generate
git commit -m "Revert to old contract generator"
```

**Test Plan Steps:** T-0203 (100% contract type coverage required)

---

## R-0004: Performance Regression

**Description:** New implementation slower than current baseline

**Likelihood:** Low
**Impact:** High (user experience degradation, SLO violations)
**Severity:** MEDIUM

**Root Causes:**
- Async conversion introduces unnecessary await
- Service registry adds overhead
- Structured logging slower than console.*
- Contract validation adds latency

**Mitigation Strategies:**

1. **Performance Budgets Enforced** (16_PERF_BUDGETS.md)
   - Baseline: 42,726 RPS, 3.46ms ancestor resolution
   - Target: Maintain or improve baseline
   - Alert if performance drops >10%

2. **Load Testing Before Each Phase**
   - Run locust tests after each major change
   - Compare to baseline metrics
   - Evidence: scripts/testing/load_test_runner.py

3. **Profiling Critical Paths**
   - Profile BaseService overhead
   - Profile structured logging impact
   - Profile contract validation latency

4. **Optimization Budget**
   - Allocate 10% of time for optimization
   - Identify and fix bottlenecks early

**Leading Indicators:**
- P95 latency > 50ms (baseline: ~10ms)
- Throughput < 35,000 RPS (baseline: 42,726)
- Cache hit rate < 95% (baseline: 99.2%)
- Alert: Performance degradation >10% from baseline

**Kill Switch:**
```bash
# Rollback to previous version
git revert <commit-range>
kubectl rollout undo deployment/forecastin-api

# Verify performance restored
scripts/check_performance_slos.py
```

**Test Plan Steps:** Performance validation after T-0103, T-0401, T-0201

---

## R-0005: Type Safety Issues

**Description:** Refactoring 'any' types introduces new bugs

**Likelihood:** Medium
**Impact:** Medium (runtime errors, user bugs)
**Severity:** MEDIUM

**Root Causes:**
- Incorrect type annotations
- TypeScript narrowing not handled
- Over-aggressive refactoring
- Insufficient testing after type changes

**Mitigation Strategies:**

1. **Gradual Migration** (T-0502)
   - Refactor 10-15 'any' types per week
   - Test thoroughly after each batch
   - Prioritize business logic over library types

2. **Type Testing**
   - Use ts-expect-error for expected failures
   - Test type narrowing with runtime checks
   - Comprehensive unit test coverage

3. **ESLint Enforcement**
   - Prevent new 'any' types in business logic
   - Allow 'unknown' with proper narrowing
   - Evidence: T-0503

4. **Code Review Focus**
   - Type safety checklist in PR template
   - Two reviewers for type changes

**Leading Indicators:**
- Increased runtime TypeErrors
- Type-related bug reports
- Test failures after type changes
- Alert: >3 type-related bugs in week

**Kill Switch:**
```typescript
// Temporarily revert to 'any' for specific code
type Foo = any; // TODO: Re-refactor with proper types
```

**Test Plan Steps:** Test coverage >80% required for all refactored modules

---

## Risk Monitoring Dashboard

```yaml
# Prometheus alerts for risk monitoring

groups:
  - name: rebuild_risks
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        annotations:
          summary: "R-0001: Error rate >5%"

      - alert: PerformanceDegradation
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.050
        annotations:
          summary: "R-0004: P95 latency >50ms"

      - alert: ThroughputDrop
        expr: rate(http_requests_total[1m]) < 35000
        annotations:
          summary: "R-0004: Throughput <35k RPS"

      - alert: CacheHitRateDrops
        expr: rate(cache_hits[5m]) / rate(cache_requests[5m]) < 0.95
        annotations:
          summary: "R-0004: Cache hit rate <95%"
```

---

## Risk Review Schedule

| Frequency | Activity | Participants |
|-----------|----------|--------------|
| Daily | Review error rate, performance metrics | On-call engineer |
| Weekly | Review all risk indicators | Tech lead, product |
| End of Phase | Full risk assessment | All stakeholders |
| Post-incident | Update risk register | Incident commander |

---

**Risk Register Complete**
**10 risks identified with mitigation and kill switches**
**All risks mapped to plan steps and tests**
**Monitoring dashboard configured**
