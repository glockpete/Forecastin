# Delete All Dependabot Branches

## 🚀 Fastest Method: GitHub CLI

If you have `gh` CLI installed, run this one command:

```bash
# Delete all 25 Dependabot branches at once
gh api repos/glockpete/Forecastin/git/refs --method GET | \
  jq -r '.[] | select(.ref | contains("dependabot")) | .ref' | \
  sed 's|refs/heads/||' | \
  xargs -I {} gh api repos/glockpete/Forecastin/git/refs/heads/{} --method DELETE
```

Or use this simpler approach:

```bash
# Delete all Dependabot branches
gh pr list --state open --author "app/dependabot" --json number --jq '.[].number' | \
  xargs -I {} gh pr close {} && \
gh api repos/glockpete/Forecastin/branches --paginate | \
  jq -r '.[] | select(.name | startswith("dependabot/")) | .name' | \
  xargs -I {} gh api repos/glockpete/Forecastin/git/refs/heads/{} --method DELETE
```

## 📱 Method 2: GitHub Web Interface (Manual but Works)

Go to: **https://github.com/glockpete/Forecastin/branches**

You'll see all branches with a delete icon (trash can). Click delete on:

### GitHub Actions (5 branches):
- [ ] `dependabot/github_actions/actions/checkout-5`
- [ ] `dependabot/github_actions/actions/download-artifact-6`
- [ ] `dependabot/github_actions/actions/setup-node-6`
- [ ] `dependabot/github_actions/actions/setup-python-6`
- [ ] `dependabot/github_actions/actions/upload-artifact-5`

### Frontend NPM (10 branches):
- [ ] `dependabot/npm_and_yarn/frontend/deck.gl-9.2.2`
- [ ] `dependabot/npm_and_yarn/frontend/deck.gl/core-9.2.2`
- [ ] `dependabot/npm_and_yarn/frontend/deck.gl/geo-layers-9.2.2`
- [ ] `dependabot/npm_and_yarn/frontend/patch-updates-48d53c9a71`
- [ ] `dependabot/npm_and_yarn/frontend/react-router-dom-7.9.5`
- [ ] `dependabot/npm_and_yarn/frontend/tailwindcss-4.1.17`
- [ ] `dependabot/npm_and_yarn/frontend/vitejs/plugin-react-5.1.0`
- [ ] `dependabot/npm_and_yarn/frontend/vitest-4.0.8`
- [ ] `dependabot/npm_and_yarn/frontend/web-vitals-5.1.0`
- [ ] `dependabot/npm_and_yarn/frontend/zod-4.1.12`

### Backend Python (10 branches):
- [ ] `dependabot/pip/api/flake8-7.3.0`
- [ ] `dependabot/pip/api/hiredis-2.4.0`
- [ ] `dependabot/pip/api/locust-2.42.2`
- [ ] `dependabot/pip/api/patch-updates-de32c5d597`
- [ ] `dependabot/pip/api/psycopg-binary--3.2.12`
- [ ] `dependabot/pip/api/pydantic-settings-2.11.0`
- [ ] `dependabot/pip/api/python-dateutil-2.9.0.post0`
- [ ] `dependabot/pip/api/shapely-2.1.2`
- [ ] `dependabot/pip/api/structlog-23.3.0`
- [ ] `dependabot/pip/api/ujson-5.11.0`

## 🔧 Method 3: Browser Console (Faster than clicking)

1. Go to: https://github.com/glockpete/Forecastin/branches
2. Open browser console (F12)
3. Paste this JavaScript:

```javascript
// Find all Dependabot branch delete buttons and click them
document.querySelectorAll('[data-target-branch]').forEach(el => {
  const branchName = el.getAttribute('data-target-branch');
  if (branchName && branchName.includes('dependabot/')) {
    // Find the delete button for this branch
    const deleteBtn = el.querySelector('[data-confirm-text="Delete this branch?"]');
    if (deleteBtn) {
      console.log('Deleting:', branchName);
      deleteBtn.click();
      // Confirm deletion
      setTimeout(() => {
        const confirmBtn = document.querySelector('[data-confirm-button]');
        if (confirmBtn) confirmBtn.click();
      }, 100);
    }
  }
});
```

**Note:** This will trigger delete confirmations - you'll need to confirm each one.

## 🎯 Also Delete These 5 Old Branches

While you're at it, delete these merged branches too:
- [ ] `master`
- [ ] `fix-missing-get-all-entities-method`
- [ ] `claude/cleanup-old-branches-011CUspwSLNi7BNvq8Rbye3x`
- [ ] `claude/websocket-1006-robustness-011CUsrWo6KtEvGcWc5PqTCy`
- [ ] `claude/infrastructure-improvements-011CUtpLBWRrBeFgPoQKFRyc`

## ⚙️ Disable Dependabot (Optional)

To prevent this from happening again:

1. Go to: https://github.com/glockpete/Forecastin/settings/security_analysis
2. Find "Dependabot" section
3. Disable "Dependabot security updates" and "Dependabot version updates"

Or configure it to auto-merge or group updates in `.github/dependabot.yml`

## ✅ After Cleanup

You'll have just:
- `main` (your primary branch)
- `claude/cleanup-github-branches-011CUtz8nM1PPXYx5mEJV9Qw` (this cleanup branch - delete after merging)

**Result: 32 branches → 2 branches (then → 1 after merging this PR)**
