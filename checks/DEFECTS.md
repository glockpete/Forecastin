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

_(No active P1/P2 defects — Phase 1 complete)_


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

### ✅ DEF-001: Console noise violates ESLint rules

- **Resolved:** 2025-11-08 (Phase 1)
- **Commit:** 119659c
- **Priority:** P1 (High)

**Resolution:**

Created `lib/logger.ts` with environment-gated logging and replaced all 85 console.* calls. Updated ESLint to enforce no-console at error level. Added ErrorBoundary for React error handling.

---

### ✅ DEF-002: Missing ESLint lint script in package.json

- **Resolved:** 2025-11-08 (Phase 1)
- **Commit:** 119659c
- **Priority:** P2 (Medium)

**Resolution:**

Added `lint` and `lint:fix` scripts to `frontend/package.json`.
