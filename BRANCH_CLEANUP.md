# Branch Cleanup Report

Generated: 2025-11-07

## Summary
Total branches before cleanup: **16**
Branches to delete: **15**
Branches to keep: **1** (main)

## Branches to Delete

### Claude Automated Task Branches (12 - all merged)
```bash
git push origin --delete claude/backup-and-create-readme-011CUs7cF5uHqD4fLx9Nhh21
git push origin --delete claude/cache-invalidation-probe-011CUs1rHDam5LZxCrRn3X8a
git push origin --delete claude/check-docs-next-task-011CUs387i9VmcGRZauUxExu
git push origin --delete claude/code-audit-typescript-fastapi-011CUs8udUtCKANpvfHYuGvm
git push origin --delete claude/e2e-contracts-mocks-tests-011CUsAPvoZyuCLJA31Rotdy
git push origin --delete claude/fix-deduplicator-memory-011CUsoAxs3YjamicNicZeGD
git push origin --delete claude/fix-sequence-tracking-011CUsoAxs3YjamicNicZeGD
git push origin --delete claude/fix-websocket-port-config-011CUsoAxs3YjamicNicZeGD
git push origin --delete claude/fix-websocket-validation-011CUsoAxs3YjamicNicZeGD
git push origin --delete claude/frontend-hardening-phases-011CUsCAoG1UCL2wg57LwQcP
git push origin --delete claude/incomplete-request-011CUsnAJNu2TYcNKXV1Kexh
git push origin --delete claude/resolve-conflicts-011CUskYbr1vT91XU9988Vix
```

### Feature Branches (3)
```bash
git push origin --delete docs-improve-readme
git push origin --delete fix-missing-get-all-entities-method
git push origin --delete master
```

## Quick Cleanup Script

Run this single command to delete all branches:

```bash
git push origin --delete \
  claude/backup-and-create-readme-011CUs7cF5uHqD4fLx9Nhh21 \
  claude/cache-invalidation-probe-011CUs1rHDam5LZxCrRn3X8a \
  claude/check-docs-next-task-011CUs387i9VmcGRZauUxExu \
  claude/code-audit-typescript-fastapi-011CUs8udUtCKANpvfHYuGvm \
  claude/e2e-contracts-mocks-tests-011CUsAPvoZyuCLJA31Rotdy \
  claude/fix-deduplicator-memory-011CUsoAxs3YjamicNicZeGD \
  claude/fix-sequence-tracking-011CUsoAxs3YjamicNicZeGD \
  claude/fix-websocket-port-config-011CUsoAxs3YjamicNicZeGD \
  claude/fix-websocket-validation-011CUsoAxs3YjamicNicZeGD \
  claude/frontend-hardening-phases-011CUsCAoG1UCL2wg57LwQcP \
  claude/incomplete-request-011CUsnAJNu2TYcNKXV1Kexh \
  claude/resolve-conflicts-011CUskYbr1vT91XU9988Vix \
  docs-improve-readme \
  fix-missing-get-all-entities-method \
  master
```

## Alternative: Delete via GitHub Web Interface

1. Go to: https://github.com/glockpete/Forecastin/branches
2. Find each branch listed above
3. Click the trash icon to delete
4. Confirm deletion

## Why These Branches Exist

- **Claude branches**: Automatically created for each Claude Code task session
- **master branch**: Duplicate of main (no unique commits)
- **docs-improve-readme**: Has unmerged README changes (deletion requested)
- **fix-missing-get-all-entities-method**: Already merged to main

## Note

Automated deletion via Claude Code failed with HTTP 403 (permission denied).
Please delete these branches manually using one of the methods above.
