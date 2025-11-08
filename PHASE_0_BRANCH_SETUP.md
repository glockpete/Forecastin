# Phase 0 — Branch Setup Instructions

**Status:** Branches created locally, need to be pushed after PR merge
**Date:** 2025-11-08 (Asia/Tokyo)

---

## Branches Created Locally

The following branches have been created locally but **cannot be pushed during this Claude Code session** due to git restrictions:

1. `develop` — Long-lived integration branch
2. `staging` — Pre-production testing branch
3. `recovery/2025-11-cleanup` — Emergency recovery branch

---

## Why Can't They Be Pushed Now?

The current git configuration only allows pushing branches matching the pattern:
```
claude/*-011CUvmmr8yymohXGKVkTQoU
```

The `develop`, `staging`, and `recovery/*` branches don't match this pattern, so they receive a 403 error when pushed.

---

## How to Push These Branches

### Option 1: After PR Merge (Recommended)

After the Phase 0 PR is merged to main:

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Create and push the long-lived branches from main
git checkout -b develop
git push -u origin develop

git checkout main
git checkout -b staging
git push -u origin staging

git checkout main
git checkout -b recovery/2025-11-cleanup
git push -u origin recovery/2025-11-cleanup
```

### Option 2: Manual Push (If You Have Direct Access)

If you have direct git access without session restrictions:

```bash
# The branches already exist locally, just push them
git push -u origin develop
git push -u origin staging
git push -u origin recovery/2025-11-cleanup
```

---

## Verify Branches Exist Locally

You can verify the branches were created:

```bash
git branch -a
```

You should see:
```
* claude/phase-0-guardrails-setup-011CUvmmr8yymohXGKVkTQoU
  develop
  staging
  recovery/2025-11-cleanup
```

---

## Branch Protection Setup Order

**Important:** Set up branch protection in this order:

1. ✅ **First:** Merge Phase 0 PR to main (or whatever the target branch is)
2. ⚠️ **Second:** Push `develop`, `staging`, and `recovery/*` branches to remote
3. ⚠️ **Third:** Configure branch protection rules (see `PHASE_0_BRANCH_PROTECTION.md`)

This order ensures:
- The baseline CI workflow exists before requiring it in branch protection
- Status checks are visible in GitHub before adding them to protection rules
- Branches exist before you can protect them

---

## Alternative: Branch Protection First

If you prefer to configure branch protection before creating branches:

1. Merge Phase 0 PR
2. Configure branch protection for `main` only (using baseline-ci status checks)
3. Create `develop` and `staging` branches from main
4. Configure branch protection for `develop` and `staging`
5. Create `recovery/*` branches as needed (these typically don't need protection)

---

## Quick Reference

### Branch Purposes

| Branch | Purpose | Protection Level | Merge Strategy |
|--------|---------|------------------|----------------|
| `main` | Production-ready code | Highest | PR required, 1+ review, CI required |
| `develop` | Integration branch for features | High | PR required, 1+ review, CI required |
| `staging` | Pre-production testing | High | PR required, 1+ review, CI required |
| `recovery/*` | Emergency fixes and rollbacks | None | Direct push allowed (emergency use) |

### Feature Branch Workflow

```bash
# Start new feature from develop
git checkout develop
git pull origin develop
git checkout -b feat/my-feature

# Work on feature
git add .
git commit -m "feat: Add my feature"
git push -u origin feat/my-feature

# Open PR: feat/my-feature → develop
# After review and CI passes, merge to develop

# When ready for release
# Open PR: develop → staging (for testing)
# After staging validation
# Open PR: staging → main (for production)
```

---

## Status

- [x] Branches created locally
- [ ] Branches pushed to remote (blocked by git restrictions)
- [ ] Branch protection configured (manual step)

**Next Action:** After Phase 0 PR merges, push the branches using Option 1 above.

---

_This file can be deleted after branches are successfully pushed and protected._
