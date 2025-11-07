# Patches Directory

This directory contains minimal diffs for code-only fixes identified in the codebase audit.

## Bucket A: Code-Only Fixes (No Services Required)

### 01_export_entity_type.patch
- **File**: `frontend/src/hooks/useHierarchy.ts`
- **Change**: Add `export` keyword to Entity type declaration
- **Impact**: Fixes TS2459 compilation error
- **Risk**: None
- **Testing**: `cd frontend && npm install && npx tsc --noEmit`

### 02_add_performance_threshold.patch
- **File**: `api/main.py`
- **Change**: Add SLO threshold checking and logging for LTREE refresh
- **Impact**: Enables detection of performance degradation
- **Risk**: None (monitoring only)
- **Testing**: `pytest api/tests/test_ltree_refresh.py`

## Applying Patches

```bash
# Apply single patch
git apply patches/01_export_entity_type.patch

# Apply all patches
git apply patches/*.patch

# Check what would be applied (dry run)
git apply --check patches/01_export_entity_type.patch
```

## Patch Format

All patches follow unified diff format:
- `---` Original file
- `+++` Modified file
- `@@` Line numbers
- `-` Removed lines
- `+` Added lines
- ` ` Context lines

## Testing After Applying

```bash
# Backend changes
cd api
pytest

# Frontend changes
cd frontend
npm install
npm run build
npm test

# Contract validation
npm run contracts:check
```

## Rollback

```bash
# Revert single patch
git apply -R patches/01_export_entity_type.patch

# Revert all changes
git checkout -- .
```

---

**Generated**: 2025-11-07  
**Session**: claude/codebase-audit-and-fixes-011CUtPZZvGBYFe9mD7ehTT4
