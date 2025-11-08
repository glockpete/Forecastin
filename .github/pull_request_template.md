# Pull Request

## Governance Checklist

**REQUIRED**: All items must be checked before merge.

- [ ] CI green (all jobs passing)
- [ ] Contracts regenerated and committed (if API/WS schemas changed)
- [ ] New or updated tests included
- [ ] Golden Source updated with dated status (if feature/architecture changed)
- [ ] Rollback note added (if deployment changes included)

---

## Scope

**What does this PR do?** _(1-3 sentences, focus on "why" not "what")_

<!-- Example:
Adds dark mode toggle to Settings to improve accessibility and user preference support.
Requested by multiple users in #123. No breaking changes to existing themes.
-->

**Type of change:**
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (code improvements with no functional changes)
- [ ] Documentation update
- [ ] Infrastructure/DevOps change
- [ ] Performance improvement
- [ ] Security fix

**Related issues:**
Closes #
Related to #

---

## Tests

**How has this been tested?**

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed
- [ ] Tested with mocks (`FF_USE_MOCKS=true`)
- [ ] Tested against live services

**Test coverage:**
- Backend coverage: _%
- Frontend coverage: _%

**Manual testing steps:**
1.
2.
3.

**Test evidence:**
<!-- Screenshots, logs, or test output demonstrating the fix/feature works -->

---

## Risk Assessment

**Deployment risk:** _(Low / Medium / High)_

**Potential impact areas:**
- [ ] Database schema changes
- [ ] API contract changes (breaking/non-breaking)
- [ ] WebSocket message format changes
- [ ] Frontend UI/UX changes
- [ ] Performance implications
- [ ] Security implications
- [ ] Third-party dependencies updated

**Migration requirements:**
- [ ] Database migration required (migration file: `migrations/versions/XXXXX_description.py`)
- [ ] Data backfill required
- [ ] Feature flag required
- [ ] Configuration changes required (document in `.env.example`)
- [ ] None

**Backward compatibility:**
- [ ] Fully backward compatible
- [ ] Requires coordinated frontend/backend deployment
- [ ] Breaking change (requires version bump and communication)

---

## Rollback Plan

**If this PR causes issues in production, how do we roll back?**

<!-- Example:
1. Revert commit: git revert <commit-sha>
2. Redeploy previous tag: make rollback TAG=2025.11.0+abc123
3. Run database rollback: alembic downgrade -1
4. No data loss expected; feature flag can be disabled: FF_NEW_FEATURE=false
-->

**Rollback complexity:** _(Simple / Moderate / Complex)_

**Data loss risk on rollback:** _(None / Low / High)_

---

## Screens / Evidence

<!-- For UI changes: screenshots or screen recordings
     For API changes: example requests/responses
     For performance: before/after metrics -->

**Before:**


**After:**


---

## Additional Context

**Cross-boundary changes:**
<!-- If this PR touches contracts, list all affected areas -->
- [ ] Backend API schema changes (documented in `contracts/openapi.json`)
- [ ] WebSocket event changes (documented in `contracts/ws.json`)
- [ ] Frontend type generation required
- [ ] Cache key changes
- [ ] Feature flag additions/changes

**Dependencies:**
<!-- List any PRs or external changes this depends on -->
- Depends on: #
- Blocks: #

**Documentation:**
- [ ] README updated
- [ ] GOLDEN_SOURCE.md updated with dated status
- [ ] API documentation updated
- [ ] Runbooks updated (if operational changes)
- [ ] CHANGELOG.md updated

**Performance considerations:**
<!-- If applicable: query performance, bundle size, memory usage, etc. -->


**Security considerations:**
<!-- If applicable: authentication, authorization, data validation, secrets, etc. -->


---

## Review Notes

**Specific areas for reviewer focus:**
<!-- What should reviewers pay extra attention to? -->
1.
2.
3.

**Questions for reviewers:**
<!-- Any specific decisions or trade-offs you'd like input on? -->


---

## Definition of Done

This PR is ready to merge when:

- [ ] All CI jobs pass (baseline-ci.yml)
- [ ] All governance checklist items checked
- [ ] At least 1 approving review from CODEOWNERS
- [ ] No unresolved review comments
- [ ] Branch is up to date with target branch
- [ ] Tests demonstrate the fix/feature works
- [ ] Documentation is complete and accurate
- [ ] Rollback plan is clear and tested (for high-risk changes)

---

**Reviewer Guide:**

When reviewing this PR, please verify:
1. **Scope clarity**: Is the "why" clear? Is the scope appropriate?
2. **Tests**: Are there sufficient tests? Do they cover edge cases?
3. **Risk**: Does the risk assessment match your understanding?
4. **Rollback**: Can we roll back safely if needed?
5. **Contracts**: If schemas changed, are both backend and frontend updated?
6. **Security**: Are there any security concerns (XSS, injection, auth bypass)?
7. **Performance**: Will this impact performance? Are there benchmarks?
8. **Documentation**: Is everything a future developer needs documented?

**For contract changes:**
- [ ] OpenAPI spec regenerated (`contracts/openapi.json`)
- [ ] WS schema regenerated (`contracts/ws.json`)
- [ ] Frontend types regenerated (`frontend/src/types/*.generated.ts`)
- [ ] Runtime guards added (Zod validators in frontend, Pydantic in backend)
- [ ] Contract tests updated

**For database changes:**
- [ ] Migration is reversible (has `downgrade()`)
- [ ] Migration tested locally
- [ ] Large data changes are batched
- [ ] Indexes added for new queries
- [ ] No breaking changes to existing queries

---

<!--
Template version: 1.0.0 (Phase 0)
Last updated: 2025-11-08
-->
