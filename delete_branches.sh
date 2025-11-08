#!/bin/bash
# Script to delete all unnecessary GitHub branches
# Run this after the cleanup PR is merged

echo "🧹 Starting GitHub branch cleanup..."
echo ""

# Already merged branches
echo "Deleting already-merged branches..."
git push origin --delete \
  claude/approve-pending-prs-011CUtrjJr4viWTABQQ5SrQ9 \
  claude/cleanup-old-branches-011CUspwSLNi7BNvq8Rbye3x \
  claude/fix-websocket-retry-loop-011CUsuEpkSnzNZUfNnJbCsu \
  claude/github-file-structure-org-011CUthtgT3XnV5Zxy1VdQSe \
  claude/investigate-g-issue-011CUtJKPhPDKxyhsKffVDsZ \
  claude/merge-compatible-branches-011CUtN5Uq2VenNQfC2LBa2V \
  claude/merge-websocket-schema-systems-011CUtmdMUptNQqv3h8oiKZ9 \
  claude/reconcile-information-011CUtjw1eyruD8Unb22Eqdt \
  claude/resolve-pr-issues-011CUtxKdR3xVd9pEzHvoEXk \
  claude/review-code-quality-011CUth5VF3FuppUtn2wDbR4 \
  claude/review-remaining-tasks-011CUtogK7Fuhmg3gNjYBjvL \
  claude/websocket-1006-robustness-011CUsrWo6KtEvGcWc5PqTCy \
  copilot/how-to-use-github-actions \
  fix-missing-get-all-entities-method \
  master 2>&1

echo ""
echo "Deleting newly merged branches..."
git push origin --delete \
  claude/codebase-audit-and-fixes-011CUtPZZvGBYFe9mD7ehTT4 \
  claude/enforce-code-standards-011CUtVscu3Yir3JooQUtfut \
  claude/fix-websocket-race-memory-011CUtyS6L6FPMnp4bGvjky6 \
  claude/fix-websocket-smoke-tests-011CUtqruD8HHWdYsggi9qyk \
  claude/infrastructure-improvements-011CUtpLBWRrBeFgPoQKFRyc \
  claude/infrastructure-improvements-011CUtvKn4UQdpyV3My53Pfz \
  fix-connection-manager-race-condition 2>&1

echo ""
echo "Deleting incomplete/abandoned branches..."
git push origin --delete \
  claude/incomplete-request-011CUtd1HSZMgyajr2BqmDr7 \
  claude/incomplete-request-011CUtnukYxXwLtArV3yUXcr \
  claude/investigate-github-action-011CUtZZdbBKqs6BzDhHswEg \
  pr/complete-infrastructure-improvements 2>&1

echo ""
echo "✅ Branch cleanup complete!"
echo ""
echo "Remaining branches:"
git branch -r | grep origin/ | grep -v HEAD | grep -v main
