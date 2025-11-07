# Complete GitHub Cleanup Guide

## Current Branch Status (as of now)

**Total branches: 32**
- ✅ Main branch: 1
- 🔄 Current cleanup branch: 1
- ❌ Old merged branches to delete: 5
- 🤖 Dependabot updates: 25

---

## ⚡ Quick Cleanup Steps

Since `git push --delete` is giving 403 errors, use GitHub's web interface:

### 1. Go to Your Branches Page
Visit: **https://github.com/glockpete/Forecastin/branches**

### 2. Delete These 5 Old Merged Branches
Click the trash icon next to each:
- `master` (duplicate of main)
- `fix-missing-get-all-entities-method`
- `claude/cleanup-old-branches-011CUspwSLNi7BNvq8Rbye3x`
- `claude/websocket-1006-robustness-011CUsrWo6KtEvGcWc5PqTCy`
- `claude/infrastructure-improvements-011CUtpLBWRrBeFgPoQKFRyc`

### 3. Handle Dependabot Branches (Choose One Option)

**Option A: Merge All Patch Updates (Recommended)**
Merge these 2 branches via GitHub PR interface - they bundle safe minor updates:
- `dependabot/npm_and_yarn/frontend/patch-updates-48d53c9a71` (frontend patches)
- `dependabot/pip/api/patch-updates-de32c5d597` (backend patches)

Then delete the remaining 23 individual Dependabot branches.

**Option B: Merge Everything Dependabot Suggests**
Review and merge all 25 Dependabot PRs individually (time-consuming but thorough).

**Option C: Delete All Dependabot Branches**
If you don't want to update dependencies right now, delete all 25 branches.

---

## 🤖 Dependabot Branch Breakdown

### GitHub Actions Updates (5 branches)
- `dependabot/github_actions/actions/checkout-5`
- `dependabot/github_actions/actions/download-artifact-6`
- `dependabot/github_actions/actions/setup-node-6`
- `dependabot/github_actions/actions/setup-python-6`
- `dependabot/github_actions/actions/upload-artifact-5`

### Frontend NPM Updates (10 branches)
- `dependabot/npm_and_yarn/frontend/patch-updates-48d53c9a71` ⭐ (bundles multiple)
- `dependabot/npm_and_yarn/frontend/deck.gl-9.2.2`
- `dependabot/npm_and_yarn/frontend/deck.gl/core-9.2.2`
- `dependabot/npm_and_yarn/frontend/deck.gl/geo-layers-9.2.2`
- `dependabot/npm_and_yarn/frontend/react-router-dom-7.9.5`
- `dependabot/npm_and_yarn/frontend/tailwindcss-4.1.17`
- `dependabot/npm_and_yarn/frontend/vitejs/plugin-react-5.1.0`
- `dependabot/npm_and_yarn/frontend/vitest-4.0.8`
- `dependabot/npm_and_yarn/frontend/web-vitals-5.1.0`
- `dependabot/npm_and_yarn/frontend/zod-4.1.12`

### Backend Python Updates (10 branches)
- `dependabot/pip/api/patch-updates-de32c5d597` ⭐ (bundles multiple)
- `dependabot/pip/api/flake8-7.3.0`
- `dependabot/pip/api/hiredis-2.4.0`
- `dependabot/pip/api/locust-2.42.2`
- `dependabot/pip/api/psycopg-binary--3.2.12`
- `dependabot/pip/api/pydantic-settings-2.11.0`
- `dependabot/pip/api/python-dateutil-2.9.0.post0`
- `dependabot/pip/api/shapely-2.1.2`
- `dependabot/pip/api/structlog-23.3.0`
- `dependabot/pip/api/ujson-5.11.0`

---

## 📋 Bulk Delete Script

If you prefer command-line deletion and your permissions allow it later:

```bash
#!/bin/bash
# Delete old merged branches
git push origin --delete \\
  master \\
  fix-missing-get-all-entities-method \\
  claude/cleanup-old-branches-011CUspwSLNi7BNvq8Rbye3x \\
  claude/websocket-1006-robustness-011CUsrWo6KtEvGcWc5PqTCy \\
  claude/infrastructure-improvements-011CUtpLBWRrBeFgPoQKFRyc

# Delete all Dependabot branches (if you don't want the updates)
git push origin --delete \\
  dependabot/github_actions/actions/checkout-5 \\
  dependabot/github_actions/actions/download-artifact-6 \\
  dependabot/github_actions/actions/setup-node-6 \\
  dependabot/github_actions/actions/setup-python-6 \\
  dependabot/github_actions/actions/upload-artifact-5 \\
  dependabot/npm_and_yarn/frontend/deck.gl-9.2.2 \\
  dependabot/npm_and_yarn/frontend/deck.gl/core-9.2.2 \\
  dependabot/npm_and_yarn/frontend/deck.gl/geo-layers-9.2.2 \\
  dependabot/npm_and_yarn/frontend/patch-updates-48d53c9a71 \\
  dependabot/npm_and_yarn/frontend/react-router-dom-7.9.5 \\
  dependabot/npm_and_yarn/frontend/tailwindcss-4.1.17 \\
  dependabot/npm_and_yarn/frontend/vitejs/plugin-react-5.1.0 \\
  dependabot/npm_and_yarn/frontend/vitest-4.0.8 \\
  dependabot/npm_and_yarn/frontend/web-vitals-5.1.0 \\
  dependabot/npm_and_yarn/frontend/zod-4.1.12 \\
  dependabot/pip/api/flake8-7.3.0 \\
  dependabot/pip/api/hiredis-2.4.0 \\
  dependabot/pip/api/locust-2.42.2 \\
  dependabot/pip/api/patch-updates-de32c5d597 \\
  dependabot/pip/api/psycopg-binary--3.2.12 \\
  dependabot/pip/api/pydantic-settings-2.11.0 \\
  dependabot/pip/api/python-dateutil-2.9.0.post0 \\
  dependabot/pip/api/shapely-2.1.2 \\
  dependabot/pip/api/structlog-23.3.0 \\
  dependabot/pip/api/ujson-5.11.0
```

---

## 🎯 Recommended Action Plan

1. **Immediately**: Delete the 5 old merged branches via GitHub UI
2. **Consider**: Merge the 2 patch-update bundles (safe minor updates)
3. **Then**: Delete remaining 23 individual Dependabot branches
4. **Result**: Down to just `main` branch (clean repo!)

---

## ✅ What We've Accomplished

- ✅ Merged 6 valuable branches with fixes and improvements
- ✅ 21 old branches were already deleted
- ✅ Identified 5 more old branches to delete
- ✅ Organized 25 Dependabot updates for easy review
- ✅ Created comprehensive cleanup documentation

**After cleanup, you'll go from 32 branches → 1 branch (main)!**
