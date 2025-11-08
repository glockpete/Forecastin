# CI/CD Requirements and Invariants

## Required Checks

All pull requests to `main` must pass the following checks:

### Frontend CI

**Workflow:** `.github/workflows/frontend.yml`

Required checks:
1. **TypeScript Type Check** - `npm run typecheck`
2. **Production Build** - `npm run build`

Both checks must pass. Any TypeScript errors or build failures will block merging.

### Backend CI

**Workflow:** `.github/workflows/backend.yml`

Required checks:
1. **Ruff Linting** - Code quality and style checks
2. **mypy Type Checking** - Static type analysis (currently with `--ignore-missing-imports`)

Backend checks are currently set to `continue-on-error: true` for gradual adoption.

## Frontend Invariants

### Import Policy

**CRITICAL:** No relative imports outside `frontend/src/`.

React Scripts (Create React App) enforces this constraint. Violations will cause build failures.

Generated frontend types MUST live in `frontend/src/types/`:
- `frontend/src/types/contracts.generated.ts` - API contracts (single source of truth)
- `frontend/src/types/ws_messages.ts` - WebSocket message types (discriminated unions)

### Path Aliases

Always use TypeScript path aliases instead of relative imports:

```typescript
// ✅ Good
import { Entity } from '@types/index';
import { BaseLayer } from '@layers/base/BaseLayer';
import { Button } from '@components/UI/Button';

// ❌ Bad
import { Entity } from '../../types/index';
import { BaseLayer } from '../layers/base/BaseLayer';
```

Configured aliases (see `frontend/tsconfig.json`):
- `@types/*` → `frontend/src/types/*`
- `@layers/*` → `frontend/src/layers/*`
- `@components/*` → `frontend/src/components/*`
- `@lib/*` → `frontend/src/lib/*`
- `@hooks/*` → `frontend/src/hooks/*`
- `@utils/*` → `frontend/src/utils/*`

### TypeScript Configuration

Current settings (see `frontend/tsconfig.json`):
- `strict: true` - All strict type checks enabled
- `exactOptionalPropertyTypes: false` - Disabled to unblock build (re-enable incrementally)
- `noUncheckedIndexedAccess: false` - Disabled to unblock build (re-enable incrementally)

## Backend Invariants

### Feature Flag Naming

Use standardised dot notation:

```python
# ✅ Good
'ff.geo.layers_enabled'
'ff.geo.websocket_layers_enabled'

# ❌ Bad (legacy - do not use)
'ff_websocket_layers_enabled'
```

See `frontend/src/config/feature-flags.ts` for the complete list.

## Local Development

Before committing, run these checks locally:

```bash
# Frontend
cd frontend
npm run typecheck  # Must pass
npm run build      # Must pass

# Backend (if modified)
cd ..
ruff check api/
mypy api/ --ignore-missing-imports
```

## Adding New Workflows

When adding new CI workflows:
1. Place in `.github/workflows/`
2. Use descriptive names
3. Add appropriate path filters to avoid unnecessary runs
4. Document new checks in this file

## Troubleshooting

### Frontend build fails with "imports outside src"

Check that all imports from generated types use path aliases or are within `src/`:

```typescript
// Wrong
import { Entity } from '../../../../types/contracts.generated';

// Correct
import { Entity } from '@types/contracts.generated';
```

### TypeScript type errors

Run `npm run typecheck` locally to see full error details. Common issues:
- Passing `undefined` to optional props (use conditional spread)
- Array/object access without null checks (add assertions where safe)
- Mismatched WebSocket message types (use type guards and casts)

### Ruff/mypy failures

Run the checks locally with the same flags as CI:
```bash
ruff check api/ --select=E9,F63,F7,F82
mypy api/ --ignore-missing-imports
```

## Future Improvements

1. **Stricter TypeScript** - Re-enable `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` incrementally
2. **Backend Type Coverage** - Improve mypy coverage by adding type stubs for dependencies
3. **Test Coverage** - Add test coverage requirements to CI
4. **Performance Checks** - Add SLO validation to CI for critical endpoints
