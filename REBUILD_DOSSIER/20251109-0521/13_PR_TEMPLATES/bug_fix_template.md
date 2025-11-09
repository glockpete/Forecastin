# Bug Fix

## Bug Description

**Summary:** <!-- Brief description of the bug -->

**Severity:** <!-- Critical | High | Medium | Low -->

**Evidence:**
- Finding: F-#### (if from rebuild dossier)
- Issue: #<!-- issue number -->

## Root Cause

<!-- Explain what caused the bug -->

**PATH:** `path/to/file.py:line-range`

**Code causing issue:**
```python
# Current buggy code
```

**Why it's a bug:**
-
-

## Fix Implementation

**Changed code:**
```python
# Fixed code
```

**Why this fixes it:**
-
-

## Testing

### Reproduction Steps (Before Fix)

1.
2.
3.
4. Expected: ... / Actual: ...

### Verification Steps (After Fix)

1.
2.
3.
4. Result: ✅ Bug fixed

### Automated Tests Added

```bash
# Test that verifies the fix
pytest api/tests/unit/test_bug_fix.py -v
```

**Test code:**
```python
def test_bug_is_fixed():
    """Verify bug no longer occurs."""
    # Test implementation
    pass
```

## Regression Prevention

<!-- How to prevent this bug from happening again -->

- [ ] Added regression test
- [ ] Updated documentation
- [ ] Added linting rule (if applicable)
- [ ] Updated CI/CD checks

## Related Changes

**Files changed:**
- `path/to/file1.py` - Fix implementation
- `path/to/file2.py` - Related update
- `tests/test_fix.py` - Regression test

**Other impacts:**
-
-

## Deployment

**Safe to deploy:** Yes / No

**Rollback plan:**
1.
2.

## Checklist

- [ ] Bug reproduced locally
- [ ] Fix verified locally
- [ ] Regression test added
- [ ] All tests passing
- [ ] No new warnings or errors
- [ ] Documentation updated
