# Pull Request Queue

**Project:** Forecastin Frontend Refactoring
**Purpose:** Planned PRs with scope, affected files, and acceptance criteria
**Branch Strategy:** One PR per phase, surgical changes, <300 LOC diff where possible
**Started:** 2025-11-08

---

## Queued PRs

### PR-001: Phase 0 — Establish checks/ scaffolding and baseline

**Status:** In Progress
**Priority:** P0 (Foundational)
**Type:** chore
**Estimated LOC:** ~200
**Effort:** 1 hour

**Scope:**

Create the checks/ directory structure and baseline inventory for the refactoring project.

**Files Created:**

- `checks/BUGLOG.md` — Console errors and defects log
- `checks/quick_wins.json` — Machine-readable trivial fixes
- `checks/DEFECTS.md` — Prioritised defect registry
- `checks/PR_QUEUE.md` — This file
- `checks/SCOUT_LOG.md` — Updated with Phase 0 findings

**Acceptance Criteria:**

- [ ] All checks/ files created with initial content
- [ ] SCOUT_LOG.md documents Phase 0 inventory
- [ ] DEFECTS.md lists all identified issues with priority
- [ ] BUGLOG.md captures console noise with file-line citations
- [ ] CI passes (typecheck, tests)

**Commit Message:**

```
chore(setup): establish checks/ scaffolding and scripts

- Create BUGLOG.md for console error tracking
- Create quick_wins.json for trivial fixes
- Create DEFECTS.md for prioritised issue registry
- Create PR_QUEUE.md for planned PR pipeline
- Update SCOUT_LOG.md with Phase 0 baseline inventory

Phase 0 deliverable: inventory and baselines established
```

---

### PR-002: Phase 1 — Eradicate console noise and add error boundaries

**Status:** Planned
**Priority:** P1 (High)
**Type:** fix
**Estimated LOC:** ~250-300
**Effort:** 3-4 hours

**Scope:**

Replace all prohibited console.* calls with a structured logging utility. Add React error boundaries for graceful error handling.

**Files Created:**

- `frontend/src/lib/logger.ts` — Environment-gated logging utility
- `frontend/src/components/ErrorBoundary.tsx` — React error boundary component

**Files Modified:**

- `frontend/src/utils/idempotencyGuard.ts` — Replace console.debug
- `frontend/src/hooks/useHybridState.ts` — Replace 4x console.log
- `frontend/src/integrations/LayerWebSocketIntegration.ts` — Replace 5x console.log
- `frontend/src/config/env.ts` — Replace 2x console.debug
- `frontend/src/handlers/validatedHandlers.ts` — Replace 3x console.debug
- `frontend/src/config/feature-flags.ts` — Replace 1x console.log
- `frontend/src/utils/stateManager.ts` — Replace 19x console.log/group
- `frontend/src/utils/errorRecovery.ts` — Replace 8x console.log/warn
- `frontend/src/handlers/realtimeHandlers.ts` — Replace 8x console.log/warn
- `frontend/.eslintrc.js` — Strengthen no-console rule
- `frontend/src/App.tsx` — Wrap with <ErrorBoundary />
- `frontend/package.json` — Add lint and lint:fix scripts

**Acceptance Criteria:**

- [ ] Logger utility respects NODE_ENV (no debug in production)
- [ ] All prohibited console.* replaced with logger calls
- [ ] ErrorBoundary catches errors and reports in dev
- [ ] `npm run lint` shows zero no-console warnings
- [ ] `npm run typecheck` passes
- [ ] All tests pass

**Commit Message:**

```
fix(frontend): eradicate console noise and add error boundaries

- Add lib/logger.ts with environment-gated logging
- Replace 50+ console.log/debug calls with logger
- Add <ErrorBoundary /> component and wrap app root
- Strengthen ESLint no-console rule
- Add lint and lint:fix scripts to package.json

Closes: DEF-001
Phase 1 deliverable: zero console noise in production
```

---

### PR-003: Phase 2 — Enforce dark theme background and surface tokens

**Status:** Planned
**Priority:** P1 (High)
**Type:** feat
**Estimated LOC:** ~200
**Effort:** 3-4 hours

**Scope:**

Fix the "plain background" issue by enforcing dark theme consistently across the application.

**Files Created:**

- `frontend/src/styles/tokens.css` — Design tokens for dark theme
- `frontend/src/tests/ui/smoke.test.tsx` — Visual regression guard

**Files Modified:**

- `frontend/src/index.css` — Add global dark background
- `frontend/tailwind.config.js` — Extend theme with dark palette
- `frontend/src/App.tsx` — Apply dark theme classes
- Layout components (identify during implementation)
- Card/panel components (identify during implementation)

**Acceptance Criteria:**

- [ ] Global dark background applied to html/body/#root
- [ ] Tailwind theme extended with dark tokens
- [ ] All layout shells use dark theme classes
- [ ] All card/panel components use theme tokens
- [ ] Smoke test verifies presence of theme classes
- [ ] Visual inspection confirms no plain/white backgrounds
- [ ] No new console warnings
- [ ] All tests pass

**Commit Message:**

```
feat(ui): enforce dark theme background and surface tokens

- Create styles/tokens.css with dark theme design tokens
- Add global dark background to html/body/#root
- Extend Tailwind theme with dark palette
- Update layout shells to use theme tokens
- Normalise card/panel components with theme classes
- Add smoke test for theme class presence

Closes: DEF-004
Phase 2 deliverable: consistent dark theme enforcement
```

---

### PR-004: Phase 3 — Normalise contract import paths and add aliases

**Status:** Planned
**Priority:** P2 (Medium)
**Type:** refactor
**Estimated LOC:** ~150-200
**Effort:** 2-3 hours

**Scope:**

Replace deep relative imports with tsconfig path aliases for cleaner, more maintainable code.

**Files Modified:**

- `frontend/src/components/MillerColumns/MillerColumns.tsx` — Use @types alias
- `frontend/src/components/Outcomes/*.tsx` — Use @types and @utils aliases
- `frontend/src/components/Search/SearchInterface.tsx` — Use @types alias
- `frontend/src/components/Entity/EntityDetail.tsx` — Use @types alias
- All files importing from `../../types/*` or `../../utils/*`
- `frontend/.eslintrc.js` — Add import style enforcement rule
- `frontend/package.json` — Add prebuild script to verify contracts exist

**Acceptance Criteria:**

- [ ] All imports use path aliases where applicable
- [ ] No relative imports crossing >1 directory level
- [ ] ESLint rule enforces import style
- [ ] prebuild script verifies contracts.generated.ts exists
- [ ] `npm run typecheck` passes
- [ ] All tests pass

**Commit Message:**

```
refactor(types): normalise contract import paths and add aliases

- Replace deep relative imports with @types/* aliases
- Replace utils relative imports with @utils/* aliases
- Add ESLint rule to enforce import style
- Add prebuild script to verify contracts exist
- Update 20+ files to use path aliases

Closes: DEF-003
Phase 3 deliverable: clean, maintainable import paths
```

---

### PR-005: Phase 4 — Enable strict TypeScript mode and discriminated unions

**Status:** Planned
**Priority:** P2 (Medium)
**Type:** chore
**Estimated LOC:** ~100-150
**Effort:** 2-3 hours

**Scope:**

Enable stricter TypeScript compiler options and add discriminated unions for WebSocket messages.

**Files Modified:**

- `frontend/tsconfig.json` — Enable exactOptionalPropertyTypes, noUncheckedIndexedAccess
- `frontend/src/types/ws_messages.ts` — Add discriminated unions
- Any files with type errors after enabling strict flags
- `frontend/package.json` — Ensure typecheck runs in CI

**Acceptance Criteria:**

- [ ] `exactOptionalPropertyTypes` enabled
- [ ] `noUncheckedIndexedAccess` enabled
- [ ] Discriminated unions added for WS messages
- [ ] assertNever guards for exhaustiveness
- [ ] `npm run typecheck` passes
- [ ] All tests pass

**Commit Message:**

```
chore(ts): enable strict mode and add discriminated unions

- Enable exactOptionalPropertyTypes in tsconfig
- Enable noUncheckedIndexedAccess in tsconfig
- Add discriminated unions for WebSocket messages
- Add assertNever guards for exhaustiveness
- Fix type errors from stricter checking

Closes: DEF-003, DEF-004 from quick_wins.json
Phase 4 deliverable: stricter type safety
```

---

## Completed PRs

_(Empty — will be updated as PRs are merged)_

---

## Deferred PRs

### PR-006: Phase 5 — WebSocket handler resilience

**Reason:** Requires runtime testing with live WebSocket connection
**Status:** Blocked by no-server constraint

### PR-007: Phase 6 — Prevent console regressions with CI gates

**Reason:** Depends on PR-002 completion
**Status:** Waiting for Phase 1

### PR-008: Phase 7 — Documentation updates

**Reason:** Depends on all previous phases
**Status:** Waiting for Phases 1-4

---

## PR Metrics & Goals

**Target:**
- Average PR size: <250 LOC
- Time to review: <30 minutes
- Time to merge: <2 hours after approval

**Quality Gates:**
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run test` passes
- [ ] No new console.* warnings
- [ ] Clear before/after evidence in PR description
- [ ] File-line citations for all changes
