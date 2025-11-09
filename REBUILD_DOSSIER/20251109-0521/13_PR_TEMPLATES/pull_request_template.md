# Pull Request

## Summary

<!-- Provide a concise summary of the changes in this PR -->

## Type of Change

<!-- Mark relevant items with [x] -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test coverage improvement

## Related Issues/Tasks

<!-- Link to related issues or tasks from rebuild plan -->

- Fixes #<!-- issue number -->
- Addresses F-#### (Finding from 02_FINDINGS.md)
- Implements T-#### (Task from 05_REBUILD_PLAN.csv)
- Related ADR: ADR-####

## Changes Made

<!-- Detailed list of changes -->

### Backend Changes

-
-

### Frontend Changes

-
-

### Database Changes

- [ ] Migrations included
- [ ] Migration tested (up and down)
- [ ] Rollback procedure documented

### Contract Changes

- [ ] Pydantic contracts updated
- [ ] TypeScript contracts regenerated
- [ ] No `any` types introduced (verified)
- [ ] Contract tests added

## Testing

<!-- Describe the tests you've added or run -->

### Unit Tests

```bash
# Backend
pytest api/tests/unit/test_....py -v

# Frontend
cd frontend && npm run test test_name
```

### Integration Tests

```bash
pytest api/tests/integration/test_....py -v
```

### Contract Tests

```bash
pytest api/tests/contracts/test_....py -v
```

### Manual Testing

<!-- Describe manual testing steps performed -->

1.
2.
3.

## Performance Impact

<!-- Required if performance-related changes -->

- [ ] Performance budgets checked
- [ ] No regression >5%
- [ ] Benchmark results:

```
Before:
After:
Change:
```

## Security Considerations

<!-- Mark if applicable -->

- [ ] No hardcoded secrets (Gitleaks passed)
- [ ] Input validation added
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitization)
- [ ] Authentication/authorization checked
- [ ] Sensitive data handling reviewed

## Breaking Changes

<!-- If this is a breaking change, describe migration path -->

**Breaking changes:**
-

**Migration guide:**
1.
2.
3.

## Screenshots/Videos

<!-- If UI changes, include screenshots -->

**Before:**


**After:**


## Checklist

<!-- Ensure all items are checked before requesting review -->

### Code Quality

- [ ] Code follows project style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex logic
- [ ] No commented-out code left behind
- [ ] No console.log/print statements in production code

### Testing

- [ ] Unit tests added/updated
- [ ] All tests passing locally
- [ ] Code coverage maintained (≥80%)
- [ ] Edge cases tested

### Documentation

- [ ] README updated (if needed)
- [ ] API documentation updated
- [ ] Inline code documentation added
- [ ] CHANGELOG updated (if applicable)

### Contracts (if applicable)

- [ ] Pydantic contracts updated
- [ ] TypeScript contracts regenerated
- [ ] Contract tests added
- [ ] Zero `any` types in generated contracts
- [ ] Required exports present

### Feature Flags (if applicable)

- [ ] Feature flag added to database
- [ ] FeatureGate HOC used in frontend
- [ ] Rollout strategy documented
- [ ] Fallback behavior tested

### Observability (if applicable)

- [ ] Structured logging added
- [ ] Correlation IDs propagated
- [ ] Metrics tracked
- [ ] Sentry error capture tested

### Deployment

- [ ] Database migrations tested (up and down)
- [ ] Environment variables documented
- [ ] Rollback procedure documented
- [ ] Deployment notes added (if special steps needed)

## Deployment Notes

<!-- Any special considerations for deployment -->

**Pre-deployment:**
-

**Deployment steps:**
1.
2.

**Post-deployment:**
-

**Rollback procedure:**
1.
2.

## Reviewer Notes

<!-- Anything specific you want reviewers to focus on -->

**Focus areas:**
-
-

**Questions for reviewers:**
-
-

---

## For Reviewers

### Review Checklist

- [ ] Code follows established patterns (BaseService, FeatureGate, etc.)
- [ ] No antipatterns introduced (check 03_MISTAKES_AND_PATTERNS.md)
- [ ] Performance budgets met (check 16_PERF_BUDGETS.md)
- [ ] Security best practices followed (check 15_SECURITY_AND_COMPLIANCE.md)
- [ ] Tests are comprehensive
- [ ] Documentation is clear

### Approval Criteria

- [ ] At least 1 approval required
- [ ] All status checks passing
- [ ] No unresolved comments
- [ ] Merge conflicts resolved
