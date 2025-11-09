# 12 Task Breakdown

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Complete task list for rebuilding system from evidence
**Format:** Flattened list suitable for project management tools

---

## Task Categories

Tasks are labeled with:
- **code-only** - Can be implemented without infrastructure changes
- **needs-infra** - Requires deployment, services, or environment changes
- **backend** - Backend codebase changes
- **frontend** - Frontend codebase changes
- **contracts** - API/WebSocket contract changes
- **db** - Database schema changes
- **build** - Build system or tooling changes
- **docs** - Documentation updates

---

## Phase 0: Critical Fixes (Week 1)

### T-0001: Remove Hardcoded Database Password
**Status:** Pending
**Priority:** P0 - Critical Security
**Effort:** 15 minutes
**Labels:** code-only, security, backend
**Evidence:** F-0002
**Files:**
- `scripts/testing/direct_performance_test.py:50`

**Acceptance Test:**
```bash
# Verify no hardcoded credentials
gitleaks detect
# Should return: "No leaks found"

# Verify connection works with env variable
export DATABASE_URL="postgresql://user:pass@localhost/db"
python scripts/testing/direct_performance_test.py
# Should connect successfully
```

**Dependencies:** None
**Assigned To:** Backend Team
**Due:** Day 1

---

### T-0002: Export Missing Contract Functions
**Status:** Pending
**Priority:** P0 - Blocks Build
**Effort:** 15 minutes
**Labels:** code-only, frontend, contracts, build
**Evidence:** F-0001
**Files:**
- `frontend/src/types/contracts.generated.ts:359-363`

**Acceptance Test:**
```bash
# Build should succeed
cd frontend && npm run build
# Should exit with code 0

# TypeScript should compile without errors
npm run typecheck
# Should show "0 errors"
```

**Dependencies:** None
**Assigned To:** Frontend Team
**Due:** Day 1

---

### T-0003: Delete Deprecated File
**Status:** Pending
**Priority:** P3 - Cleanup
**Effort:** 2 minutes
**Labels:** code-only, frontend, cleanup
**Evidence:** F-0017
**Files:**
- `frontend/src/types/zod/messages.ts.deprecated`

**Acceptance Test:**
```bash
# File should not exist
ls frontend/src/types/zod/messages.ts.deprecated
# Should return: "No such file or directory"

# No imports should reference it
grep -r "messages.ts.deprecated" frontend/src/
# Should return no matches
```

**Dependencies:** None
**Assigned To:** Frontend Team
**Due:** Day 1

---

### T-0004: Fix Test Fixture Schema Mismatches
**Status:** Pending
**Priority:** P0 - Tests Failing
**Effort:** 30 minutes
**Labels:** code-only, backend, testing
**Evidence:** F-0003
**Files:**
- `api/tests/conftest.py:45-80` (3 fixtures)
- `api/tests/test_rss_entity_extractor.py:25-60` (2 fixtures)
- `api/tests/test_scenario_service.py:30-50` (3 fixtures)

**Acceptance Test:**
```bash
# All tests should pass
pytest api/tests/ -v
# Should show "8 passed" for affected tests

# Schema validation should work
python -c "from api.models.websocket_schemas import LayerUpdateEvent; LayerUpdateEvent(type='layer_update', layer_id='test', action='add', features=[], affected_count=0)"
# Should not raise ValidationError
```

**Dependencies:** None
**Assigned To:** Backend Team
**Due:** Day 2

---

## Phase 1: Service Patterns (Weeks 2-3)

### T-0101: Create BaseService Abstract Class
**Status:** Pending
**Priority:** P1 - Foundation
**Effort:** 4 hours
**Labels:** code-only, backend, architecture
**Evidence:** Antipattern 1, F-0006
**Files:** (NEW)
- `api/services/base.py`
- `api/services/registry.py`
- `api/tests/test_base_service.py`

**Acceptance Test:**
```python
# Test BaseService interface
from api.services.base import BaseService

class TestService(BaseService):
    async def start(self): self.is_running = True
    async def stop(self): self.is_running = False

service = TestService()
await service.start()
assert service.is_running
assert await service.health_check()

# Test registry
from api.services.registry import ServiceRegistry
registry = ServiceRegistry()
registry.register(TestService, service)
assert registry.get(TestService) == service
```

**Dependencies:** T-0004 (tests must pass first)
**Assigned To:** Backend Team
**Due:** Week 2

---

### T-0102: Migrate WebSocketManager to BaseService
**Status:** Pending
**Priority:** P1
**Effort:** 2 hours
**Labels:** code-only, backend, websocket
**Evidence:** Antipattern 1, F-0007
**Files:**
- `api/services/websocket_manager.py`

**Acceptance Test:**
```python
from api.services.websocket_manager import WebSocketManager
from api.services.base import BaseService

manager = WebSocketManager()
assert isinstance(manager, BaseService)

# Test lifecycle
await manager.start()
assert manager.is_running

health = await manager.health_check()
assert health.healthy

await manager.stop()
assert not manager.is_running
```

**Dependencies:** T-0101
**Assigned To:** Backend Team
**Due:** Week 2

---

### T-0103: Convert AutomatedRefreshService to Pure Async
**Status:** Pending
**Priority:** P1 - Performance
**Effort:** 6 hours
**Labels:** code-only, backend, performance
**Evidence:** Antipattern 2, F-0007
**Files:**
- `api/services/automated_refresh_service.py`

**Acceptance Test:**
```python
# Verify no threading
import ast
tree = ast.parse(open('api/services/automated_refresh_service.py').read())
threading_imports = [n for n in ast.walk(tree) if isinstance(n, ast.Import) and any(a.name == 'threading' for a in n.names)]
assert len(threading_imports) == 0, "No threading imports allowed"

# Test shutdown speed
import time
service = AutomatedRefreshService()
await service.start()

start = time.time()
await service.stop()
duration = time.time() - start

assert duration < 5.0, f"Shutdown took {duration}s (should be <5s)"
```

**Dependencies:** T-0101
**Assigned To:** Backend Team
**Due:** Week 3

---

### T-0104: Replace Global Service Instances
**Status:** Pending
**Priority:** P1
**Effort:** 4 hours
**Labels:** code-only, backend, architecture
**Evidence:** Antipattern 4, F-0006
**Files:**
- `api/main.py`
- `api/routers/*.py`

**Acceptance Test:**
```bash
# Verify no global service variables
grep -r "^_.*_service.*=.*None" api/services/
# Should return no matches

# Verify dependency injection in routers
grep -r "get_.*_service()" api/routers/
# Should find Depends() patterns

# Test isolation
pytest api/tests/ --count=5
# Run tests 5 times - all should pass (no shared state)
```

**Dependencies:** T-0101
**Assigned To:** Backend Team
**Due:** Week 3

---

## Phase 2: Contract Improvements (Weeks 4-5)

### T-0201: Improve Contract Generator
**Status:** Pending
**Priority:** P1
**Effort:** 8 hours
**Labels:** code-only, contracts, build
**Evidence:** F-0004, Antipattern 3
**Files:** (NEW)
- `scripts/dev/generate_contracts_v2.py`
- `tests/test_contract_generator.py`

**Acceptance Test:**
```bash
# Generate contracts with new generator
python scripts/dev/generate_contracts_v2.py

# Verify zero 'any' types in geometry
grep -c ": any" frontend/src/types/contracts.generated.ts
# Should return 0 (or very low number)

# Verify correct type translation
grep "type: 'Point'" frontend/src/types/contracts.generated.ts
# Should find: type: 'Point' (not type: any)

grep "coordinates: Coordinate" frontend/src/types/contracts.generated.ts
# Should find properly typed coordinates
```

**Dependencies:** T-0002
**Assigned To:** Full-stack Team
**Due:** Week 4

---

### T-0202: Add Missing Response Properties
**Status:** Pending
**Priority:** P1
**Effort:** 2 hours
**Labels:** code-only, contracts, backend, frontend
**Evidence:** F-0005
**Files:**
- `api/contracts/responses.py` (NEW)
- `frontend/src/types/contracts.generated.ts`

**Acceptance Test:**
```bash
# TypeScript compilation should succeed
cd frontend && npm run build
# Exit code 0

# Verify properties exist in types
grep "entities: EntityResponse\[\]" frontend/src/types/contracts.generated.ts
grep "children_count: number" frontend/src/types/contracts.generated.ts
# Both should match

# All 6 previous errors should be fixed
npm run typecheck 2>&1 | grep "MillerColumns.tsx"
# Should return no errors
```

**Dependencies:** T-0201
**Assigned To:** Full-stack Team
**Due:** Week 4

---

### T-0203: Create Contract Test Suite
**Status:** Pending
**Priority:** P1
**Effort:** 6 hours
**Labels:** code-only, testing, contracts
**Evidence:** Need for regression prevention
**Files:** (NEW)
- `tests/contracts/test_contract_generator.py`
- `frontend/tests/contracts/contract_validation.test.ts`

**Acceptance Test:**
```bash
# Run contract tests
pytest tests/contracts/ -v
npm test tests/contracts/

# Both should pass with 100% coverage
pytest tests/contracts/ --cov=scripts/dev/generate_contracts_v2.py --cov-report=term-missing
# Should show 100% coverage
```

**Dependencies:** T-0201
**Assigned To:** QA Team
**Due:** Week 5

---

## Phase 3: Feature Flag Integration (Weeks 6-9)

### T-0301: Create FeatureGate HOC
**Status:** Pending
**Priority:** P2
**Effort:** 4 hours
**Labels:** code-only, frontend, architecture
**Evidence:** F-0008, Antipattern 5
**Files:** (NEW)
- `frontend/src/components/FeatureGate/FeatureGate.tsx`
- `frontend/src/components/FeatureGate/withFeatureFlag.tsx`
- `frontend/tests/components/FeatureGate.test.tsx`

**Acceptance Test:**
```typescript
// Test component wrapping
const FlaggedComponent = withFeatureFlag(MyComponent, {
  flagKey: 'ff.test',
  fallback: <div>Disabled</div>
});

// Render with flag enabled
render(<FlaggedComponent />);
expect(screen.getByText('Enabled content')).toBeInTheDocument();

// Render with flag disabled
mockFeatureFlag('ff.test', false);
render(<FlaggedComponent />);
expect(screen.getByText('Disabled')).toBeInTheDocument();
```

**Dependencies:** T-0002
**Assigned To:** Frontend Team
**Due:** Week 6

---

### T-0302 through T-0309: Integrate Individual Flags
**Status:** Pending
**Priority:** P2
**Effort:** 2 hours each (16 hours total)
**Labels:** code-only, frontend
**Evidence:** F-0008

**Flags to integrate:**
1. T-0302: `ff.point_layer` (Week 6)
2. T-0303: `ff.polygon_layer` (Week 6)
3. T-0304: `ff.gpu_filtering` (Week 7)
4. T-0305: `ff.websocket_layers` (Week 7)
5. T-0306: `ff.heatmap_layer` (Week 8)
6. T-0307: `ff.clustering_enabled` (Week 8)
7. T-0308: `ff.geospatial_layers` (Week 9)
8. T-0309: `ff.realtime_updates` (Week 9)

**Acceptance Test (per flag):**
```bash
# Test at 0%
curl -X PATCH http://localhost:9000/api/feature-flags/ff.point_layer \
  -d '{"rollout_percentage": 0}'
# Component should not render

# Test at 50%
curl -X PATCH http://localhost:9000/api/feature-flags/ff.point_layer \
  -d '{"rollout_percentage": 50}'
# ~50% of users should see component

# Test at 100%
curl -X PATCH http://localhost:9000/api/feature-flags/ff.point_layer \
  -d '{"rollout_percentage": 100}'
# All users should see component
```

**Dependencies:** T-0301
**Assigned To:** Frontend Team
**Due:** Weeks 6-9 (staggered)

---

## Phase 4: Observability (Weeks 10-11)

### T-0401: Implement Structured Logging
**Status:** Pending
**Priority:** P2
**Effort:** 6 hours
**Labels:** code-only, backend, frontend, observability
**Evidence:** F-0010, F-0011
**Files:** (NEW)
- `api/services/observability/logging.py`
- `api/middleware/correlation_id.py`
- `frontend/src/utils/logger.ts`

**Acceptance Test:**
```bash
# Backend logs should be JSON in production
ENVIRONMENT=production python api/main.py &
curl http://localhost:9000/api/health
# Check logs - should be valid JSON with correlation_id

# Frontend logs should use structured logger
grep "console.log\|console.warn\|console.error" frontend/src/**/*.{ts,tsx}
# Should return 0 matches (except in logger.ts itself)
```

**Dependencies:** T-0001 (security fixed first)
**Assigned To:** DevOps Team
**Due:** Week 10

---

### T-0402: Integrate Error Monitoring (Sentry)
**Status:** Pending
**Priority:** P2
**Effort:** 4 hours
**Labels:** needs-infra, observability
**Evidence:** F-0011
**Files:**
- `api/main.py`
- `frontend/src/utils/sentry.ts`
- `frontend/src/components/ErrorBoundary/*.tsx`

**Acceptance Test:**
```bash
# Trigger test error
curl -X POST http://localhost:9000/api/test/error
# Should appear in Sentry dashboard

# Frontend error
# Click "Trigger Error" button in test UI
# Should appear in Sentry dashboard with source maps
```

**Dependencies:** T-0401, Sentry account setup
**Assigned To:** DevOps Team
**Due:** Week 11

---

## Phase 5: Cleanup (Weeks 12-14)

### T-0501: Remove Deprecated Environment Variables
**Status:** Pending
**Priority:** P3
**Effort:** 2 hours
**Labels:** code-only, frontend, cleanup
**Evidence:** F-0013
**Files:**
- `frontend/.env.example`
- `frontend/src/config/env.ts`

**Acceptance Test:**
```bash
# No REACT_APP_* variables
grep "REACT_APP_" frontend/.env.example
# Should return no matches

grep "REACT_APP_" frontend/src/**/*.{ts,tsx}
# Should return no matches
```

**Dependencies:** T-0202
**Assigned To:** Frontend Team
**Due:** Week 12

---

### T-0502: Refactor 'any' Types
**Status:** Pending
**Priority:** P2
**Effort:** 16 hours (incremental)
**Labels:** code-only, frontend, type-safety
**Evidence:** F-0009
**Files:** Multiple TypeScript files

**Acceptance Test:**
```bash
# Count remaining 'any' types
grep -r ": any" frontend/src/ | wc -l
# Should be < 20 (down from 97)

# ESLint should enforce
npm run lint
# Should fail on new 'any' types in business logic
```

**Dependencies:** T-0201 (contract generator fixed)
**Assigned To:** Frontend Team
**Due:** Weeks 12-14 (incremental)

---

### T-0503: Add ESLint Rule for Path Aliases
**Status:** Pending
**Priority:** P2
**Effort:** 2 hours
**Labels:** code-only, frontend, dx
**Evidence:** F-0012
**Files:**
- `frontend/.eslintrc.js`

**Acceptance Test:**
```bash
# No deep relative imports
grep -r "\.\./\.\./\.\." frontend/src/
# Should return no matches

# ESLint should catch violations
echo "import { foo } from '../../../bar';" > test.ts
npm run lint test.ts
# Should show error
rm test.ts
```

**Dependencies:** T-0201
**Assigned To:** Frontend Team
**Due:** Week 13

---

## Phase 6: Documentation (Weeks 15-16)

### T-0601: Update CONTRIBUTING.md
**Status:** Pending
**Priority:** P2
**Effort:** 4 hours
**Labels:** docs
**Evidence:** All patterns
**Files:**
- `CONTRIBUTING.md`
- `docs/DEVELOPER_HANDBOOK.md` (NEW)

**Acceptance Test:**
```markdown
# All patterns documented:
- [x] BaseService pattern
- [x] ServiceRegistry pattern
- [x] Contract generation workflow
- [x] Feature flag integration
- [x] Structured logging
- [x] Code review checklists
```

**Dependencies:** T-0104, T-0203, T-0401
**Assigned To:** Tech Writer
**Due:** Week 15

---

### T-0602: Conduct Team Training
**Status:** Pending
**Priority:** P2
**Effort:** 8 hours
**Labels:** docs
**Evidence:** Knowledge transfer

**Acceptance Test:**
- All team members attended sessions
- Training materials published
- Q&A documented
- Quiz passed by all attendees

**Dependencies:** T-0601
**Assigned To:** Tech Lead
**Due:** Week 16

---

## Summary Statistics

**Total Tasks:** 25
**Total Effort:** ~100 hours
**Timeline:** 16 weeks
**Phases:** 6
**Evidence Coverage:** All 19 findings addressed

**By Label:**
- code-only: 21 tasks (84%)
- needs-infra: 2 tasks (8%)
- backend: 10 tasks
- frontend: 14 tasks
- contracts: 5 tasks
- testing: 4 tasks
- docs: 2 tasks

**By Priority:**
- P0 (Critical): 4 tasks (Weeks 1-2)
- P1 (High): 9 tasks (Weeks 2-5)
- P2 (Medium): 10 tasks (Weeks 6-16)
- P3 (Low): 2 tasks (Week 1, 12)

**Machine-Readable:** See `12_TASKS_BREAKDOWN.csv`

---

**Task Breakdown Complete**
**All tasks traceable to findings and evidence**
**Acceptance tests defined for every task**
**Dependencies explicitly mapped**
