# Phase 0 — Branch Protection Configuration

**Status:** Ready to configure
**Date:** 2025-11-08 (Asia/Tokyo)
**Priority:** CRITICAL — Must be done before any PR merges

---

## Overview

Branch protection rules enforce guardrails that prevent broken code from entering critical branches. These settings **must be configured in GitHub** to complete Phase 0.

Since the `gh` CLI is not available in this environment, you must configure these settings manually through the GitHub web interface.

---

## Branches to Protect

Configure protection rules for the following branches:

### 1. `main` (Production)
**Highest protection level** — This is the production-ready code.

### 2. `develop` (Integration)
**High protection level** — This is where feature branches merge before staging.

### 3. `staging` (Pre-production)
**High protection level** — Final testing before production release.

---

## Required Protection Rules

### For `main` branch:

Navigate to: **Settings → Branches → Add branch protection rule**

**Branch name pattern:** `main`

#### Required Settings:

✅ **Require a pull request before merging**
- ✅ Require approvals: **1** (increase to 2 for larger teams)
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners (after setting up CODEOWNERS)

✅ **Require status checks to pass before merging**
- ✅ Require branches to be up to date before merging
- **Required status checks:**
  - `CI Success Gate` (from baseline-ci.yml)
  - `lint`
  - `typecheck_backend`
  - `typecheck_frontend`
  - `unit`
  - `build_frontend`
  - `build_backend`

✅ **Require conversation resolution before merging**

✅ **Require linear history**
- This prevents merge commits and enforces rebasing or squash-merging
- Keeps git history clean and auditable

✅ **Do not allow bypassing the above settings**
- Even administrators must follow the rules (recommended)

❌ **Do NOT enable:**
- "Allow force pushes" — Never allow force push to `main`
- "Allow deletions" — Prevent accidental branch deletion

---

### For `develop` branch:

**Branch name pattern:** `develop`

Same settings as `main` with one modification:

- Require approvals: **1** (can be same as main)
- All other settings identical to `main`

---

### For `staging` branch:

**Branch name pattern:** `staging`

Same settings as `main` with these modifications:

- Require approvals: **1**
- Linear history: **optional** (can allow merge commits for staging)
- All other settings identical to `main`

---

## Feature Branch Naming Convention

Feature branches should follow these patterns:

```
feat/<short-description>     # New features
fix/<short-description>      # Bug fixes
ops/<short-description>      # Operational changes (CI, deployment, etc.)
docs/<short-description>     # Documentation updates
refactor/<short-description> # Code refactoring
test/<short-description>     # Test additions/improvements
```

**Examples:**
```
feat/dark-mode-toggle
fix/api-timeout-retry
ops/ci-parallelization
docs/api-authentication-guide
refactor/reduce-db-queries
test/add-integration-tests
```

**Claude branches:**
All Claude Code agent branches will use the pattern: `claude/**`

**Recovery branch:**
Created for emergency rollbacks and cleanup: `recovery/2025-11-cleanup`

---

## Step-by-Step Configuration Guide

### 1. Navigate to Repository Settings

1. Go to your repository: `https://github.com/glockpete/Forecastin`
2. Click **Settings** (top right, requires admin access)
3. Click **Branches** in the left sidebar

### 2. Add Branch Protection Rule for `main`

1. Click **Add branch protection rule**
2. **Branch name pattern:** `main`
3. Enable all checkboxes as listed above
4. In "Require status checks to pass before merging":
   - Search for and add: `CI Success Gate`
   - Add the 6 individual job names: `lint`, `typecheck_backend`, `typecheck_frontend`, `unit`, `build_frontend`, `build_backend`
5. Scroll down and click **Create** or **Save changes**

### 3. Repeat for `develop` and `staging`

Repeat step 2 for `develop` and `staging` branches with the same settings.

### 4. Verify Configuration

After setting up, verify:
- Try to push directly to `main` → Should be rejected
- Try to merge a PR without CI passing → Should be blocked
- Try to merge with unresolved comments → Should be blocked

---

## Status Checks Setup

The required status checks come from `.github/workflows/baseline-ci.yml`. After the first PR runs, GitHub will recognize these checks.

### Initial Setup Caveat:

On the **first PR** to a branch after protection is enabled:
- GitHub may not yet know about the status checks
- You may need to trigger a PR first, then add the checks to the protection rule after they appear

**Workaround:**
1. Set up branch protection without status checks initially
2. Create a test PR to trigger baseline-ci.yml
3. After CI runs, go back to branch protection settings
4. Add the status checks that now appear in the dropdown

---

## CODEOWNERS Integration

The `.github/CODEOWNERS` file has been created with placeholder team names.

### Update CODEOWNERS:

1. Open `.github/CODEOWNERS`
2. Replace `@your-org/team-name` with actual GitHub usernames or team names
3. If you're the sole developer, replace all with: `@glockpete`

**Example for solo developer:**
```
# Default ownership
* @glockpete

# Backend
/api/** @glockpete

# Frontend
/frontend/** @glockpete
```

### Enable in Branch Protection:

Once CODEOWNERS is configured with real usernames:
1. Go to branch protection settings
2. ✅ Enable "Require review from Code Owners"
3. This ensures files you've marked require your review

---

## Linear History Enforcement

Linear history is enforced by:
- **Require linear history** checkbox in branch protection

This means only these merge strategies are allowed:
- ✅ Squash and merge (recommended for features)
- ✅ Rebase and merge (for clean history)
- ❌ Create a merge commit (disabled)

**Why linear history?**
- Easier to bisect and debug
- Cleaner git log
- Easier to revert atomic changes
- Required for CalVer versioning strategy in Phase 9

---

## Testing Your Protection Rules

### Test 1: Direct Push (Should Fail)

```bash
git checkout main
echo "test" >> README.md
git commit -am "test direct push"
git push origin main
# Expected: ERROR: Protected branch update failed
```

### Test 2: PR Without CI (Should Block)

1. Create a PR to `main`
2. Before CI completes, try to merge
3. Expected: "Required status checks must pass"

### Test 3: PR With Unresolved Comments (Should Block)

1. Create a PR to `main`
2. Add a review comment
3. Try to merge without resolving
4. Expected: "All conversations must be resolved"

---

## Rollback and Emergency Access

### If You Need Emergency Access:

**Option 1: Temporary Protection Bypass** (Admins only)
1. Go to Settings → Branches → Edit rule
2. Uncheck "Do not allow bypassing the above settings"
3. Perform emergency fix
4. **IMMEDIATELY** re-enable protection

**Option 2: Recovery Branch** (Recommended)
1. Use the `recovery/2025-11-cleanup` branch
2. This branch is not protected
3. Fix the issue there first
4. Then properly PR to `main` with CI

**Never:**
- Force push to `main`, `develop`, or `staging`
- Disable protection rules without documenting why
- Bypass CI "just this once" — it always comes back to bite you

---

## Phase 0 Completion Checklist

After configuring branch protection, verify:

- [ ] `main` branch protected with all required rules
- [ ] `develop` branch protected
- [ ] `staging` branch protected
- [ ] CODEOWNERS file updated with real usernames
- [ ] Status checks configured to require all CI jobs
- [ ] Linear history enforced
- [ ] Force push disabled
- [ ] Test: Direct push to `main` is rejected
- [ ] Test: PR without passing CI is blocked
- [ ] Test: PR with unresolved comments is blocked

---

## Documentation References

- **GitHub Docs:** [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- **CODEOWNERS Syntax:** [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- **Status Checks:** [About status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)

---

## Troubleshooting

### Problem: Status checks don't appear in dropdown

**Solution:** Create and run a PR first. After baseline-ci.yml runs once, the checks will appear in the dropdown.

### Problem: "Review from Code Owners" is required but I can't approve my own PR

**Solution:**
- If you're a solo developer, temporarily disable "Require review from Code Owners"
- Or add a second GitHub account / collaborator
- Or use branch protection exceptions for administrators

### Problem: Can't push to `develop` even with a PR

**Solution:** This is expected! You must:
1. Create a feature branch: `git checkout -b feat/my-feature`
2. Push feature branch: `git push -u origin feat/my-feature`
3. Open PR: `feat/my-feature` → `develop`
4. Wait for CI to pass
5. Merge PR

### Problem: CI is failing on a valid change

**Solution:**
1. Check CI logs in GitHub Actions tab
2. Run `make ci` locally to reproduce
3. Fix the issue in your feature branch
4. Push again — CI will re-run
5. Do NOT bypass CI or force merge

---

**Next Steps:**
After configuring branch protection, proceed to **Phase 1 — Inventory and Truth Alignment**.

---

**Configuration completed by:** _________________
**Date verified:** _________________
**Notes:**

