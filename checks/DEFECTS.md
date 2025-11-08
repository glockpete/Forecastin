# Defect & Issue Registry

**Project:** Forecastin Frontend Refactoring
**Purpose:** Prioritised list of defects, technical debt, and issues requiring resolution
**Started:** 2025-11-08

---

## Priority Classification

- **P0 (Critical):** Blocks core functionality, security risk, or prevents deployment
- **P1 (High):** Significant user impact, code quality blocker, or prevents future work
- **P2 (Medium):** Moderate impact, technical debt, or quality improvement
- **P3 (Low):** Nice-to-have, minor improvements, or cosmetic issues

---

## Active Defects

### DEF-001: Console noise violates ESLint rules

- **Priority:** P1 (High)
- **Severity:** Medium
- **Confidence:** Very High (100% — verified via grep)
- **Effort:** Medium (2-4 hours)
- **Category:** Code Quality

**Description:**

34+ violations of the `no-console` ESLint rule across the codebase. Raw `console.log` and `console.debug` calls are used for debugging and operational logging, creating noise and preventing clean production builds.

**Impact:**

- ESLint warnings on every build
- Console noise in production
- No environment-based log level control
- Difficult to debug issues in production

**Affected Files:**

- `frontend/src/utils/idempotencyGuard.ts`
- `frontend/src/hooks/useHybridState.ts`
- `frontend/src/integrations/LayerWebSocketIntegration.ts`
- `frontend/src/config/env.ts`
- `frontend/src/handlers/validatedHandlers.ts`
- `frontend/src/config/feature-flags.ts`
- `frontend/src/utils/stateManager.ts`
- `frontend/src/utils/errorRecovery.ts`
- `frontend/src/handlers/realtimeHandlers.ts`

**Proposed Solution:**

Phase 1: Console Noise Elimination (see BUGLOG.md)

**Acceptance Criteria:**

- [ ] Logger utility created at `frontend/src/lib/logger.ts`
- [ ] All prohibited console.* calls replaced with logger
- [ ] ESLint shows zero no-console warnings
- [ ] `npm run lint` passes cleanly
- [ ] Logger respects NODE_ENV (no debug logs in production)

---

### DEF-002: Missing ESLint lint script in package.json

- **Priority:** P2 (Medium)
- **Severity:** Low
- **Confidence:** Very High (100% — verified)
- **Effort:** Trivial (5 minutes)
- **Category:** Tooling

**Description:**

ESLint configuration exists at `frontend/.eslintrc.js`, but there's no `lint` script in `frontend/package.json` to run it. This means developers must manually run eslint or rely on IDE integration.

**Impact:**

- Inconsistent linting across development environments
- Cannot run lint in CI/CD without custom commands
- Harder to enforce code quality standards

**Proposed Solution:**

Add to `frontend/package.json` scripts:
```json
"lint": "eslint src --ext .ts,.tsx",
"lint:fix": "eslint src --ext .ts,.tsx --fix"
```

**Acceptance Criteria:**

- [ ] `npm run lint` executes successfully
- [ ] `npm run lint:fix` auto-fixes fixable issues

---

### DEF-003: Inconsistent import styles (relative vs. aliases)

- **Priority:** P2 (Medium)
- **Severity:** Low
- **Confidence:** High (90% — verified via grep)
- **Effort:** Medium (2-3 hours)
- **Category:** Code Style

**Description:**

Despite `tsconfig.json` defining path aliases (`@types/*`, `@components/*`, etc.), most imports use relative paths like `../../types/contracts.generated`. This creates:
- Harder-to-read import statements
- Brittle code when files move
- Inconsistent code style

**Affected Files:**

All component files in `frontend/src/components/*`

**Proposed Solution:**

Phase 3: Import Path Normalisation
- Update all imports to use path aliases
- Add ESLint rule to prefer absolute imports
- Add codemod script to automate conversion

**Acceptance Criteria:**

- [ ] All imports use path aliases where applicable
- [ ] No relative imports crossing more than one directory level
- [ ] ESLint rule enforces import style

---

### DEF-004: No dark theme background enforcement

- **Priority:** P1 (High)
- **Severity:** High
- **Confidence:** Unknown (requires visual inspection)
- **Effort:** Medium (3-5 hours)
- **Category:** UI / Theming

**Description:**

User reports "plain background" issue. The application lacks consistent dark theme enforcement across all routes and components.

**Root Cause Hypothesis:**

- Missing global theme wrapper on `html`/`body`/`#root`
- Incomplete Tailwind theme configuration
- Components not using theme tokens
- Layout components missing background classes

**Proposed Solution:**

Phase 2: Dark Theme Enforcement (see brief)

**Acceptance Criteria:**

- [ ] Global dark background applied to html/body/#root
- [ ] All layout shells use dark theme tokens
- [ ] All card/panel components use theme tokens
- [ ] Visual regression test confirms dark theme
- [ ] No white/plain backgrounds visible in any route

---

## Deferred Defects

_(Empty — issues requiring runtime environment or blocked by dependencies)_

---

## Resolved Defects

_(Empty — will be populated as defects are fixed)_
