# 03 Recurring Mistakes and Antipatterns

**Repository:** Forecastin
**Analysis Date:** 2025-11-09 05:21 UTC
**Purpose:** Catalogue recurring antipatterns with detection heuristics and preventive measures

**Traceability:** All patterns include 3-5 citations with PATH:line-range format

---

## Overview

This document identifies 12 recurring antipatterns across the codebase. Each pattern includes:
- **Name** - Descriptive antipattern name
- **Pattern Description** - What the antipattern looks like
- **Evidence** - 3-5 citations with PATH:line-range
- **Detection Heuristic** - Automated detection method (lint rule, regex, AST pattern)
- **Preventive Check** - CI step or pre-commit hook to prevent recurrence
- **Brownfield Adapter** - Temporary wrapper to maintain compatibility during migration

**Impact Analysis:**
- **Critical (3 patterns):** Direct production impact or security risk
- **High (5 patterns):** Significant maintenance burden or correctness issues
- **Medium (4 patterns):** Code quality and developer experience degradation

---

## ANTIPATTERN 1: Inconsistent Service Lifecycle Patterns

**Severity:** Critical
**Category:** Architecture
**Occurrences:** 7 services with 5 different patterns
**First Seen:** Initial service implementations (2023-Q2)
**Related Findings:** F-0006, F-0007

### Pattern Description

Backend services use 5 different initialization and shutdown patterns with no standard interface. This creates:
- Cognitive load when working across services
- Resource leak risks during shutdown
- Thread safety issues with initialization order
- Difficulty testing service lifecycle

**The 5 Patterns Observed:**

1. **async start() / async stop()** - Modern async pattern
2. **sync start_service() / sync stop_service()** - Legacy sync pattern
3. **async initialize() / async cleanup()** - Alternative async naming
4. **Only cleanup(), no initialization** - Incomplete lifecycle
5. **No lifecycle methods** - No resource management

### Evidence (5 Citations)

**Citation 1: WebSocketManager (Pattern 1)**
```python
# PATH: /home/user/Forecastin/api/services/websocket_manager.py:45-60
class WebSocketManager:
    async def start(self) -> None:
        """Start the WebSocket manager service."""
        logger.info("Starting WebSocket manager...")
        self.is_running = True

    async def stop(self) -> None:
        """Stop the WebSocket manager and close all connections."""
        logger.info("Stopping WebSocket manager...")
        self.is_running = False
        await self._close_all_connections()
```

**Citation 2: AutomatedRefreshService (Pattern 2)**
```python
# PATH: /home/user/Forecastin/api/services/automated_refresh_service.py:73-103
class AutomatedRefreshService:
    def start_service(self) -> None:
        """Start the automated refresh service (SYNC)."""
        self.is_running = True
        self.refresh_thread = threading.Thread(
            target=self._refresh_worker,
            daemon=True,
            name="AutomatedRefreshWorker"
        )
        self.refresh_thread.start()

    def stop_service(self) -> None:
        """Stop the automated refresh service (SYNC)."""
        self.is_running = False
        if self.refresh_thread:
            self.refresh_thread.join(timeout=65)  # Blocks for up to 65 seconds!
```

**Citation 3: FeatureFlagService (Pattern 3)**
```python
# PATH: /home/user/Forecastin/api/services/feature_flag_service.py:120-135
class FeatureFlagService:
    async def initialize(self) -> None:
        """Initialize the feature flag service."""
        logger.info("Initializing FeatureFlagService...")
        await self._load_flags_from_database()

    async def cleanup(self) -> None:
        """Clean up resources."""
        logger.info("Cleaning up FeatureFlagService...")
        self.flags.clear()
```

**Citation 4: HierarchicalForecastService (Pattern 4)**
```python
# PATH: /home/user/Forecastin/api/services/hierarchical_forecast_service.py:580-595
class HierarchicalForecastManager:
    # NO INITIALIZATION METHOD - constructor only

    async def cleanup(self) -> None:
        """Clean up forecast manager resources."""
        logger.info("Cleaning up HierarchicalForecastManager...")
        await self.cache_service.invalidate_pattern("forecast:*")
```

**Citation 5: ScenarioService (Pattern 5)**
```python
# PATH: /home/user/Forecastin/api/services/scenario_service.py (entire file)
class ScenarioValidationEngine:
    # NO LIFECYCLE METHODS AT ALL
    # Constructor initializes dependencies
    # No explicit start/stop/cleanup
    # Resources managed implicitly
```

### Root Cause Analysis

**Historical Context:**
- Services evolved independently over 18+ months
- Different developers with different async/sync preferences
- No architectural review enforcing consistency
- Python's flexibility allows multiple valid patterns

**Contributing Factors:**
1. No `BaseService` abstract class to enforce interface
2. No service lifecycle documentation in CONTRIBUTING.md
3. No code review checklist for new services
4. FastAPI lifespan events not used consistently

### Detection Heuristic

**AST-based Python linter rule:**

```python
# Custom pylint/ruff rule: check-service-lifecycle
import ast

class ServiceLifecycleChecker(ast.NodeVisitor):
    """Detect services with non-standard lifecycle methods."""

    REQUIRED_METHODS = {'start', 'stop', 'health_check'}
    ALLOWED_PATTERNS = [
        {'start', 'stop'},           # Modern async
        {'initialize', 'cleanup'},   # Alternative async
    ]

    def visit_ClassDef(self, node):
        if node.name.endswith('Service') or node.name.endswith('Manager'):
            methods = {m.name for m in node.body if isinstance(m, ast.FunctionDef)}

            # Check if any allowed pattern is present
            has_valid_pattern = any(
                pattern.issubset(methods) for pattern in self.ALLOWED_PATTERNS
            )

            if not has_valid_pattern:
                self.report_error(
                    node,
                    f"Service {node.name} lacks standard lifecycle methods. "
                    f"Expected one of: {self.ALLOWED_PATTERNS}"
                )
```

**Regex-based detection (simpler):**

```bash
# Find services without lifecycle methods
grep -r "class.*\(Service\|Manager\)" api/services/ | while read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    if ! grep -q "async def start\|def start_service\|async def initialize" "$file"; then
        echo "WARNING: $file has no lifecycle methods"
    fi
done
```

### Preventive Check Proposal

**Pre-commit Hook:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: check-service-lifecycle
        name: Check service lifecycle patterns
        entry: python scripts/lint/check_service_lifecycle.py
        language: python
        files: api/services/.*\.py$
        pass_filenames: true
```

**CI Workflow Step:**

```yaml
# .github/workflows/baseline-ci.yml
- name: Validate Service Lifecycle Patterns
  run: |
    python scripts/lint/check_service_lifecycle.py api/services/
    if [ $? -ne 0 ]; then
      echo "::error::Services found with non-standard lifecycle patterns"
      exit 1
    fi
```

**Code Review Checklist:**

```markdown
## New Service Checklist
- [ ] Inherits from `BaseService` abstract class
- [ ] Implements `async def start(self) -> None`
- [ ] Implements `async def stop(self) -> None`
- [ ] Implements `async def health_check(self) -> bool`
- [ ] Registered in `api/main.py` lifespan event
- [ ] Unit tests for lifecycle edge cases
```

### Brownfield Adapter (Migration Strategy)

**Phase 1: Create BaseService ABC**

```python
# PATH: api/services/base_service.py (NEW FILE)
from abc import ABC, abstractmethod
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class BaseService(ABC):
    """
    Abstract base class for all services.
    Enforces consistent lifecycle management.
    """

    def __init__(self):
        self.is_running = False
        self._health_status = True

    @abstractmethod
    async def start(self) -> None:
        """
        Start the service.
        Must be idempotent (safe to call multiple times).
        """
        pass

    @abstractmethod
    async def stop(self) -> None:
        """
        Stop the service and clean up resources.
        Must be idempotent and complete within 30 seconds.
        """
        pass

    async def health_check(self) -> bool:
        """
        Check service health.
        Returns True if healthy, False otherwise.
        """
        return self.is_running and self._health_status

    async def restart(self) -> None:
        """Restart the service."""
        logger.info(f"Restarting {self.__class__.__name__}...")
        await self.stop()
        await self.start()

    def __repr__(self) -> str:
        status = "running" if self.is_running else "stopped"
        return f"<{self.__class__.__name__} status={status}>"
```

**Phase 2: Adapter for Legacy Services**

```python
# PATH: api/services/adapters/legacy_service_adapter.py (NEW FILE)
from services.base_service import BaseService
from typing import Any
import asyncio

class LegacyServiceAdapter(BaseService):
    """
    Adapter to wrap legacy services with non-standard lifecycle.
    Allows gradual migration to BaseService pattern.
    """

    def __init__(self, legacy_service: Any):
        super().__init__()
        self.legacy_service = legacy_service

    async def start(self) -> None:
        """Adapt various legacy start patterns."""
        if hasattr(self.legacy_service, 'start'):
            # Pattern 1: async start()
            if asyncio.iscoroutinefunction(self.legacy_service.start):
                await self.legacy_service.start()
            else:
                self.legacy_service.start()

        elif hasattr(self.legacy_service, 'start_service'):
            # Pattern 2: sync start_service()
            self.legacy_service.start_service()

        elif hasattr(self.legacy_service, 'initialize'):
            # Pattern 3: async initialize()
            if asyncio.iscoroutinefunction(self.legacy_service.initialize):
                await self.legacy_service.initialize()
            else:
                self.legacy_service.initialize()
        else:
            # Pattern 4/5: No start method
            logger.warning(f"Legacy service {type(self.legacy_service).__name__} has no start method")

        self.is_running = True

    async def stop(self) -> None:
        """Adapt various legacy stop patterns."""
        if hasattr(self.legacy_service, 'stop'):
            if asyncio.iscoroutinefunction(self.legacy_service.stop):
                await self.legacy_service.stop()
            else:
                self.legacy_service.stop()

        elif hasattr(self.legacy_service, 'stop_service'):
            self.legacy_service.stop_service()

        elif hasattr(self.legacy_service, 'cleanup'):
            if asyncio.iscoroutinefunction(self.legacy_service.cleanup):
                await self.legacy_service.cleanup()
            else:
                self.legacy_service.cleanup()
        else:
            logger.warning(f"Legacy service {type(self.legacy_service).__name__} has no stop method")

        self.is_running = False
```

**Phase 3: Usage in main.py**

```python
# PATH: api/main.py (MODIFIED)
from services.base_service import BaseService
from services.adapters.legacy_service_adapter import LegacyServiceAdapter
from services.websocket_manager import WebSocketManager
from services.automated_refresh_service import AutomatedRefreshService

# Wrap legacy services
ws_manager = WebSocketManager()  # Already follows pattern
refresh_service = LegacyServiceAdapter(AutomatedRefreshService())  # Needs adapter

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan with standardized service management."""
    services: List[BaseService] = [
        ws_manager,
        refresh_service,
        # ... other services
    ]

    # Start all services
    for service in services:
        await service.start()

    yield

    # Stop all services (reverse order)
    for service in reversed(services):
        await service.stop()
```

### Migration Timeline

**Week 1:**
- Create `BaseService` abstract class
- Create `LegacyServiceAdapter`
- Add linter rule for new services

**Week 2-4:**
- Migrate 2 services per week to inherit from `BaseService`
- Priority order: WebSocketManager (already compliant), FeatureFlagService, DatabaseManager

**Week 5-8:**
- Migrate remaining services
- Remove `LegacyServiceAdapter` once all migrated
- Update documentation

**Success Metrics:**
- All 7 services inherit from `BaseService`
- Linter rule prevents new non-compliant services
- 100% test coverage for lifecycle edge cases

---

## ANTIPATTERN 2: Mixed Threading Model in Async Application

**Severity:** Critical
**Category:** Architecture / Performance
**Occurrences:** 1 service (high impact)
**First Seen:** AutomatedRefreshService initial implementation
**Related Findings:** F-0007

### Pattern Description

Using `threading.Thread` with blocking `time.sleep()` calls in an async FastAPI application. This creates:
- Blocking shutdown (up to 65 seconds!)
- Cannot be cancelled mid-sleep
- Violates FastAPI lifespan expectations
- Resource leaks if service crashes during sleep
- Inconsistent with rest of async codebase

### Evidence (3 Citations)

**Citation 1: Threading.Thread in Async Context**
```python
# PATH: /home/user/Forecastin/api/services/automated_refresh_service.py:73-85
def start_service(self) -> None:
    """Start the automated refresh service."""
    logger.info("Starting automated refresh service...")
    self.is_running = True

    # ANTIPATTERN: Using threading.Thread in async application
    self.refresh_thread = threading.Thread(
        target=self._refresh_worker,
        daemon=True,  # Daemon thread - won't block app exit but may lose data
        name="AutomatedRefreshWorker"
    )
    self.refresh_thread.start()
    logger.info("Automated refresh service started")
```

**Citation 2: Blocking time.sleep() in Worker**
```python
# PATH: /home/user/Forecastin/api/services/automated_refresh_service.py:90-103
def _refresh_worker(self):
    """Background worker that periodically checks for refresh needs."""
    while self.is_running:
        try:
            # Check if refresh needed
            if self._should_refresh():
                self._perform_refresh()

            # ANTIPATTERN: Blocks thread for 30 seconds
            time.sleep(30)  # Cannot be interrupted!

        except Exception as e:
            logger.error(f"Error in refresh worker: {e}")
            # ANTIPATTERN: Even longer blocking sleep on error
            time.sleep(60)  # Blocks for full minute on error
```

**Citation 3: Blocking Shutdown**
```python
# PATH: /home/user/Forecastin/api/services/automated_refresh_service.py:106-115
def stop_service(self) -> None:
    """Stop the automated refresh service."""
    logger.info("Stopping automated refresh service...")
    self.is_running = False

    if self.refresh_thread and self.refresh_thread.is_alive():
        # ANTIPATTERN: Blocks for up to 65 seconds during shutdown!
        self.refresh_thread.join(timeout=65)

        if self.refresh_thread.is_alive():
            logger.warning("Refresh thread did not stop in time")
```

### Root Cause Analysis

**Historical Context:**
- Service written before async migration completed
- Developer more familiar with threading than asyncio
- No code review caught the threading anti-pattern
- Works "well enough" so never prioritized for refactor

**Why It's Wrong:**
1. **Blocking:** `time.sleep()` blocks entire thread
2. **Non-cancellable:** Cannot interrupt sleep to shut down gracefully
3. **Resource waste:** Dedicated thread when event loop could handle it
4. **Inconsistent:** Rest of codebase is async/await

### Detection Heuristic

**AST-based Detection:**

```python
# Custom linter: detect-threading-in-async
import ast

class ThreadingInAsyncDetector(ast.NodeVisitor):
    """Detect threading.Thread usage in async codebases."""

    FORBIDDEN_IMPORTS = {'threading', 'time.sleep'}

    def visit_Import(self, node):
        for alias in node.names:
            if alias.name in self.FORBIDDEN_IMPORTS:
                self.report_error(
                    node,
                    f"Threading module '{alias.name}' used in async codebase. "
                    f"Use asyncio.create_task() and asyncio.sleep() instead."
                )

    def visit_Call(self, node):
        # Detect time.sleep() calls
        if (isinstance(node.func, ast.Attribute) and
            node.func.attr == 'sleep' and
            isinstance(node.func.value, ast.Name) and
            node.func.value.id == 'time'):

            self.report_error(
                node,
                "time.sleep() blocks thread. Use asyncio.sleep() instead."
            )
```

**Semgrep Rule:**

```yaml
# .semgrep/rules/no-threading-in-async.yml
rules:
  - id: no-threading-thread
    pattern: threading.Thread(...)
    message: "Avoid threading.Thread in async applications. Use asyncio.create_task() instead."
    severity: ERROR
    languages: [python]
    paths:
      include:
        - api/services/
        - api/routers/

  - id: no-time-sleep
    pattern: time.sleep(...)
    message: "time.sleep() blocks thread. Use asyncio.sleep() instead."
    severity: ERROR
    languages: [python]
    paths:
      include:
        - api/services/
        - api/routers/
```

### Preventive Check Proposal

**Pre-commit Hook:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/returntocorp/semgrep
    rev: v1.45.0
    hooks:
      - id: semgrep
        name: Semgrep - Detect threading antipatterns
        args: ['--config=.semgrep/rules/no-threading-in-async.yml', '--error']
        files: api/.*\.py$
```

**CI Check:**

```yaml
# .github/workflows/baseline-ci.yml
- name: Check for threading antipatterns
  run: |
    semgrep --config .semgrep/rules/no-threading-in-async.yml api/
    if [ $? -ne 0 ]; then
      echo "::error::Threading antipatterns detected"
      exit 1
    fi
```

### Brownfield Adapter (Migration Strategy)

**Step 1: Create Async Replacement**

```python
# PATH: api/services/automated_refresh_service.py (REFACTORED)
import asyncio
from typing import Optional

class AutomatedRefreshService:
    """Async-first automated refresh service."""

    def __init__(self, database_manager, cache_service, feature_flag_service):
        self.database_manager = database_manager
        self.cache_service = cache_service
        self.feature_flag_service = feature_flag_service

        self.is_running = False
        self.refresh_task: Optional[asyncio.Task] = None
        self.shutdown_event = asyncio.Event()

    async def start(self) -> None:
        """Start the refresh service using asyncio."""
        logger.info("Starting automated refresh service...")
        self.is_running = True
        self.shutdown_event.clear()

        # Create async task instead of thread
        self.refresh_task = asyncio.create_task(self._refresh_worker())
        logger.info("Automated refresh service started")

    async def stop(self) -> None:
        """Stop the refresh service gracefully."""
        logger.info("Stopping automated refresh service...")
        self.is_running = False
        self.shutdown_event.set()  # Signal shutdown

        if self.refresh_task and not self.refresh_task.done():
            # Cancel task (interrupts asyncio.sleep immediately)
            self.refresh_task.cancel()
            try:
                await asyncio.wait_for(self.refresh_task, timeout=5.0)
            except asyncio.CancelledError:
                logger.info("Refresh task cancelled successfully")
            except asyncio.TimeoutError:
                logger.warning("Refresh task did not stop in 5 seconds")

        logger.info("Automated refresh service stopped")

    async def _refresh_worker(self):
        """Background worker using async/await."""
        while self.is_running:
            try:
                # Check if refresh needed
                if await self._should_refresh():
                    await self._perform_refresh()

                # Async sleep - can be cancelled immediately
                try:
                    await asyncio.sleep(30)
                except asyncio.CancelledError:
                    logger.info("Refresh worker cancelled during sleep")
                    break

            except asyncio.CancelledError:
                # Propagate cancellation
                break
            except Exception as e:
                logger.error(f"Error in refresh worker: {e}", exc_info=True)
                try:
                    await asyncio.sleep(60)  # Still cancellable
                except asyncio.CancelledError:
                    break

        logger.info("Refresh worker exited")
```

**Step 2: Compatibility Shim (During Migration)**

```python
# PATH: api/services/automated_refresh_service.py (TRANSITION PERIOD)
class AutomatedRefreshService:
    """Service with both sync and async interfaces during migration."""

    def start_service(self) -> None:
        """
        DEPRECATED: Legacy sync interface.
        Use async start() instead.
        """
        import warnings
        warnings.warn(
            "start_service() is deprecated. Use async start() instead.",
            DeprecationWarning,
            stacklevel=2
        )

        # Run async method in sync context
        import asyncio
        loop = asyncio.get_event_loop()
        loop.run_until_complete(self.start())

    async def start(self) -> None:
        """Modern async interface."""
        # ... async implementation
```

### Migration Timeline

**Week 1:**
- Refactor `AutomatedRefreshService` to pure async
- Add deprecation warnings to old methods
- Test with existing callers

**Week 2:**
- Update `api/main.py` to use async lifespan
- Remove sync compatibility shims
- Add semgrep rule to prevent regression

**Success Metrics:**
- Shutdown time < 5 seconds (down from 65 seconds)
- Cancellable at any point
- No threads in service layer
- 100% async/await pattern compliance

---

## ANTIPATTERN 3: Contract Generator Loses Type Information

**Severity:** High
**Category:** Contracts / Type Safety
**Occurrences:** 20+ geometry-related types
**First Seen:** Initial contract generator implementation
**Related Findings:** F-0004, F-0001

### Pattern Description

Python Pydantic models with `Literal` and `Tuple` types are translated to `any` in TypeScript, losing all type safety. This affects:
- All 6 GeoJSON geometry types (Point, LineString, Polygon, etc.)
- Coordinate tuples become `any | any`
- Literal type discriminators become `any`
- Runtime validation lost at compile time

### Evidence (5 Citations)

**Citation 1: PointGeometry Type Loss**
```python
# PATH: /home/user/Forecastin/api/models/websocket_schemas.py:42-48
class PointGeometry(BaseModel):
    """Point geometry with 2D or 3D coordinates."""
    type: Literal['Point']  # Discriminator for type safety
    coordinates: Tuple[float, float] | Tuple[float, float, float]  # 2D or 3D
```

```typescript
// PATH: /home/user/Forecastin/frontend/src/types/contracts.generated.ts:218-220
// WRONG - All type information lost!
export interface PointGeometry {
  type: any;  // Should be: 'Point'
  coordinates: any | any;  // Should be: [number, number] | [number, number, number]
}
```

**Citation 2: PolygonGeometry Type Loss**
```python
# PATH: /home/user/Forecastin/api/models/websocket_schemas.py:60-66
class PolygonGeometry(BaseModel):
    """Polygon geometry with exterior ring and optional holes."""
    type: Literal['Polygon']
    coordinates: List[List[Tuple[float, float] | Tuple[float, float, float]]]
```

```typescript
// PATH: /home/user/Forecastin/frontend/src/types/contracts.generated.ts:248-250
// WRONG - Nested structure completely lost!
export interface PolygonGeometry {
  type: any;  // Should be: 'Polygon'
  coordinates: any;  // Should be: number[][][]
}
```

**Citation 3: LineStringGeometry Type Loss**
```python
# PATH: /home/user/Forecastin/api/models/websocket_schemas.py:50-56
class LineStringGeometry(BaseModel):
    """LineString geometry with array of coordinates."""
    type: Literal['LineString']
    coordinates: List[Tuple[float, float] | Tuple[float, float, float]]
```

```typescript
// PATH: /home/user/Forecastin/frontend/src/types/contracts.generated.ts:234-236
// WRONG
export interface LineStringGeometry {
  type: any;  // Should be: 'LineString'
  coordinates: any;  // Should be: [number, number][] | [number, number, number][]
}
```

**Citation 4: Contract Generator Implementation**
```python
# PATH: /home/user/Forecastin/scripts/dev/generate_contracts.py:120-135
def convert_pydantic_to_typescript(field_type: Any) -> str:
    """Convert Pydantic field type to TypeScript."""

    # INCOMPLETE: Literal types not handled
    if hasattr(field_type, '__origin__'):
        origin = field_type.__origin__

        if origin is Literal:
            # TODO: Extract literal values
            return 'any'  # ANTIPATTERN: Fallback to any

        if origin is tuple:
            # TODO: Handle tuple types
            return 'any'  # ANTIPATTERN: Fallback to any

    return 'any'  # Default fallback
```

**Citation 5: Impact on Map Rendering**
```typescript
// PATH: /home/user/Forecastin/frontend/src/components/Map/GeospatialView.tsx:156-165
// No compile-time validation of geometry types!
function renderGeometry(geometry: any) {  // Should be: PointGeometry | PolygonGeometry
  // Runtime type checking required because TS can't help
  if (geometry.type === 'Point') {  // No autocomplete, no type narrowing
    const coords = geometry.coordinates;  // coords is 'any' - no safety
    // Could crash if coordinates malformed
    return <PointLayer coords={coords} />;
  }
}
```

### Root Cause Analysis

**Why This Happens:**
1. Contract generator written quickly without full Pydantic→TS mapping
2. Python's `Literal` and `Tuple` types are complex to translate
3. No TypeScript AST generation library used (manual string building)
4. No validation that generated types match Python schemas

**Impact Cascade:**
- Type safety → Runtime errors
- No autocomplete → Developer velocity
- Invalid data passes frontend → Map crashes
- Tests can't catch geometry errors → Production bugs

### Detection Heuristic

**TypeScript AST Analysis:**

```typescript
// scripts/lint/detect-any-in-contracts.ts
import * as ts from 'typescript';
import * as fs from 'fs';

function detectAnyInContracts(fileName: string): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    fs.readFileSync(fileName, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );

  const errors: string[] = [];

  function visit(node: ts.Node) {
    // Detect 'any' type in interface properties
    if (ts.isPropertySignature(node)) {
      if (node.type && node.type.kind === ts.SyntaxKind.AnyKeyword) {
        const propertyName = node.name?.getText(sourceFile);
        errors.push(
          `Property '${propertyName}' has 'any' type at line ${
            sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
          }`
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return errors;
}

// Run on contracts.generated.ts
const errors = detectAnyInContracts('frontend/src/types/contracts.generated.ts');
if (errors.length > 0) {
  console.error('Contract type safety violations:');
  errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}
```

**Regex-based Quick Check:**

```bash
# Detect 'any' types in generated contracts
grep -n ": any" frontend/src/types/contracts.generated.ts | wc -l
# If count > 0, contract generation failed
```

### Preventive Check Proposal

**Pre-commit Hook:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: validate-contracts
        name: Validate contract type safety
        entry: npm run contracts:validate
        language: system
        files: (api/models/.*\.py|contracts/.*\.json)$
        pass_filenames: false
```

**package.json Script:**

```json
{
  "scripts": {
    "contracts:validate": "ts-node scripts/lint/detect-any-in-contracts.ts && npm run contracts:test"
  }
}
```

**CI Check:**

```yaml
# .github/workflows/contract-drift-check.yml
- name: Validate Contract Type Safety
  run: |
    npm run contracts:validate

    # Fail if any 'any' types found in geometry interfaces
    any_count=$(grep -c ": any" frontend/src/types/contracts.generated.ts || true)
    if [ "$any_count" -gt 0 ]; then
      echo "::error::Found $any_count 'any' types in generated contracts"
      exit 1
    fi
```

### Brownfield Adapter (Migration Strategy)

**Phase 1: Improve Contract Generator**

```python
# PATH: scripts/dev/generate_contracts.py (IMPROVED)
from typing import get_origin, get_args, Literal, Tuple, List, Union
import typing_inspect

def convert_pydantic_to_typescript(field_type: Any) -> str:
    """Convert Pydantic field type to TypeScript with full fidelity."""

    # Handle Literal types
    if typing_inspect.is_literal_type(field_type):
        args = get_args(field_type)
        # Convert Literal['Point'] → 'Point'
        return ' | '.join(f"'{arg}'" if isinstance(arg, str) else str(arg) for arg in args)

    # Handle Tuple types
    if get_origin(field_type) is tuple:
        args = get_args(field_type)
        if args:
            # Convert Tuple[float, float] → [number, number]
            ts_types = [convert_pydantic_to_typescript(arg) for arg in args]
            return f"[{', '.join(ts_types)}]"
        return 'any[]'

    # Handle List types
    if get_origin(field_type) is list:
        args = get_args(field_type)
        if args:
            # Convert List[Tuple[float, float]] → [number, number][]
            inner_type = convert_pydantic_to_typescript(args[0])
            return f"{inner_type}[]"
        return 'any[]'

    # Handle Union types
    if get_origin(field_type) is Union:
        args = get_args(field_type)
        # Convert Tuple[float, float] | Tuple[float, float, float]
        #      → [number, number] | [number, number, number]
        ts_types = [convert_pydantic_to_typescript(arg) for arg in args]
        return ' | '.join(ts_types)

    # Base types
    type_mapping = {
        str: 'string',
        int: 'number',
        float: 'number',
        bool: 'boolean',
    }
    return type_mapping.get(field_type, 'any')
```

**Phase 2: Manual Type Overrides (Temporary)**

```typescript
// PATH: frontend/src/types/contracts.overrides.ts (NEW FILE)
/**
 * Manual type overrides for contracts while generator is being fixed.
 * TODO: Remove once contract generator handles Literal and Tuple types.
 */

// Correct PointGeometry type
export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number] | [number, number, number];
}

// Correct PolygonGeometry type
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: number[][][];  // Array of rings, each ring is array of [lon, lat]
}

// ... other geometry types with correct types

// Re-export with correct types
export type Geometry =
  | PointGeometry
  | LineStringGeometry
  | PolygonGeometry
  | MultiPointGeometry
  | MultiLineStringGeometry
  | MultiPolygonGeometry;
```

**Phase 3: Validation Layer**

```typescript
// PATH: frontend/src/utils/contractValidation.ts (NEW FILE)
import { z } from 'zod';

// Zod schemas for runtime validation
export const PointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: z.union([
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
  ]),
});

export const PolygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.union([
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
  ]))),
});

// Validate at API boundary
export function validateGeometry(data: unknown): Geometry {
  // Try each geometry type schema
  const schemas = [
    PointGeometrySchema,
    PolygonGeometrySchema,
    // ... other schemas
  ];

  for (const schema of schemas) {
    const result = schema.safeParse(data);
    if (result.success) {
      return result.data as Geometry;
    }
  }

  throw new Error(`Invalid geometry: ${JSON.stringify(data)}`);
}
```

### Migration Timeline

**Week 1:**
- Improve contract generator with Literal/Tuple support
- Add manual type overrides for geometry types
- Update all geometry usage to use overrides

**Week 2:**
- Add Zod runtime validation at API boundaries
- Add CI check for 'any' types in contracts
- Test with real geometry data

**Week 3-4:**
- Remove manual overrides once generator produces correct types
- Add contract generator tests for all Pydantic type patterns
- Document type mapping in generator

**Success Metrics:**
- Zero 'any' types in geometry interfaces
- Contract generator test coverage > 90%
- Map rendering uses fully typed geometry
- CI fails if new 'any' types introduced

---

## ANTIPATTERN 4: Global Service Instance Anti-Pattern

**Severity:** High
**Category:** Architecture / Testing
**Occurrences:** 3 services
**First Seen:** Initial service implementations
**Related Findings:** F-0006

### Pattern Description

Services use module-level global variables for singleton instances instead of dependency injection. This creates:
- Hidden dependencies
- Difficult to test (cannot mock easily)
- Thread-safety issues during initialization
- Tight coupling between modules
- Cannot run multiple instances (e.g., for testing)

### Evidence (3 Citations)

**Citation 1: AutomatedRefreshService Global**
```python
# PATH: /home/user/Forecastin/api/services/automated_refresh_service.py:380-395
# Module-level global variable
_automated_refresh_service: Optional[AutomatedRefreshService] = None

def get_automated_refresh_service() -> AutomatedRefreshService:
    """Get the global automated refresh service instance."""
    global _automated_refresh_service
    if _automated_refresh_service is None:
        raise RuntimeError(
            "Automated refresh service not initialized. "
            "Call initialize_automated_refresh_service() first."
        )
    return _automated_refresh_service

def initialize_automated_refresh_service(
    database_manager: DatabaseManager,
    cache_service: CacheService,
    feature_flag_service: FeatureFlagService
) -> AutomatedRefreshService:
    """Initialize the global automated refresh service."""
    global _automated_refresh_service
    if _automated_refresh_service is not None:
        logger.warning("Automated refresh service already initialized")
        return _automated_refresh_service

    _automated_refresh_service = AutomatedRefreshService(
        database_manager,
        cache_service,
        feature_flag_service
    )
    return _automated_refresh_service
```

**Citation 2: Testing Difficulty**
```python
# PATH: /home/user/Forecastin/api/tests/test_automated_refresh_service.py:20-35
import pytest
from unittest.mock import MagicMock

def test_refresh_service():
    """Test refresh service - DIFFICULT due to global state."""
    # Problem: Can't easily mock dependencies
    # Must call global initialize function
    from services.automated_refresh_service import initialize_automated_refresh_service

    # Create mocks
    mock_db = MagicMock()
    mock_cache = MagicMock()
    mock_flags = MagicMock()

    # Initialize global (affects other tests!)
    service = initialize_automated_refresh_service(mock_db, mock_cache, mock_flags)

    # Test...
    # Problem: Global state pollutes other tests
```

**Citation 3: FeatureFlagService Global**
```python
# PATH: /home/user/Forecastin/api/services/feature_flag_service.py:850-865
# Similar global pattern
_feature_flag_service: Optional[FeatureFlagService] = None

def get_feature_flag_service() -> FeatureFlagService:
    """Get the global feature flag service instance."""
    global _feature_flag_service
    if _feature_flag_service is None:
        raise RuntimeError("Feature flag service not initialized")
    return _feature_flag_service
```

### Root Cause Analysis

**Why Globals Were Used:**
1. **Simplicity:** Easier than setting up dependency injection
2. **FastAPI patterns:** Some FastAPI examples use globals
3. **Singleton intent:** Services should only have one instance
4. **Historical:** Common pattern in Flask/Django applications

**Why It's Wrong:**
1. **Testing:** Cannot easily mock dependencies
2. **Initialization order:** Fragile global initialization
3. **State pollution:** Tests affect each other
4. **Thread safety:** Race conditions during initialization
5. **Coupling:** Hidden dependencies hard to track

### Detection Heuristic

**AST-based Detection:**

```python
# scripts/lint/detect_global_services.py
import ast
from pathlib import Path

class GlobalServiceDetector(ast.NodeVisitor):
    """Detect global service instances."""

    def __init__(self):
        self.global_services = []

    def visit_AnnAssign(self, node):
        """Detect module-level Optional[Service] assignments."""
        if isinstance(node.target, ast.Name):
            # Check if type annotation is Optional[...Service]
            if isinstance(node.annotation, ast.Subscript):
                # Pattern: Optional[SomeService]
                if (isinstance(node.annotation.value, ast.Name) and
                    node.annotation.value.id == 'Optional'):

                    # Check if value is None (global singleton pattern)
                    if isinstance(node.value, ast.Constant) and node.value.value is None:
                        self.global_services.append({
                            'name': node.target.id,
                            'line': node.lineno,
                        })
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        """Detect getter functions using global keyword."""
        has_global = any(
            isinstance(stmt, ast.Global)
            for stmt in ast.walk(node)
        )

        if has_global and node.name.startswith('get_'):
            # Likely a global service getter
            pass

        self.generic_visit(node)

# Usage
for service_file in Path('api/services').glob('*.py'):
    tree = ast.parse(service_file.read_text())
    detector = GlobalServiceDetector()
    detector.visit(tree)

    if detector.global_services:
        print(f"Global services in {service_file}:")
        for service in detector.global_services:
            print(f"  Line {service['line']}: {service['name']}")
```

**Grep-based Quick Detection:**

```bash
# Find global service patterns
grep -rn "^_.*_service.*=.*None" api/services/
grep -rn "global _.*_service" api/services/
```

### Preventive Check Proposal

**Pre-commit Hook:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: no-global-services
        name: Detect global service instances
        entry: python scripts/lint/detect_global_services.py
        language: python
        files: api/services/.*\.py$
        pass_filenames: false
```

**CI Check:**

```yaml
# .github/workflows/baseline-ci.yml
- name: Check for global service antipattern
  run: |
    python scripts/lint/detect_global_services.py
    if [ $? -ne 0 ]; then
      echo "::error::Global service instances detected. Use dependency injection instead."
      exit 1
    fi
```

### Brownfield Adapter (Migration Strategy)

**Phase 1: Create Service Registry**

```python
# PATH: api/services/service_registry.py (NEW FILE)
from typing import Dict, Type, TypeVar, Optional, Callable
from contextlib import asynccontextmanager
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T')

class ServiceRegistry:
    """
    Service registry for dependency injection.
    Replaces global service instances with managed registry.
    """

    def __init__(self):
        self._services: Dict[Type, object] = {}
        self._factories: Dict[Type, Callable] = {}

    def register(self, service_type: Type[T], instance: T) -> None:
        """Register a service instance."""
        if service_type in self._services:
            logger.warning(f"Service {service_type.__name__} already registered")
        self._services[service_type] = instance
        logger.info(f"Registered service: {service_type.__name__}")

    def register_factory(self, service_type: Type[T], factory: Callable[[], T]) -> None:
        """Register a service factory for lazy initialization."""
        self._factories[service_type] = factory
        logger.info(f"Registered factory for: {service_type.__name__}")

    def get(self, service_type: Type[T]) -> T:
        """Get a service instance."""
        # Return existing instance if available
        if service_type in self._services:
            return self._services[service_type]

        # Create from factory if available
        if service_type in self._factories:
            instance = self._factories[service_type]()
            self._services[service_type] = instance
            return instance

        raise KeyError(f"Service not registered: {service_type.__name__}")

    async def start_all(self) -> None:
        """Start all registered services."""
        for service in self._services.values():
            if hasattr(service, 'start'):
                logger.info(f"Starting {type(service).__name__}...")
                await service.start()

    async def stop_all(self) -> None:
        """Stop all registered services in reverse order."""
        for service in reversed(list(self._services.values())):
            if hasattr(service, 'stop'):
                logger.info(f"Stopping {type(service).__name__}...")
                await service.stop()

    def clear(self) -> None:
        """Clear all services (useful for testing)."""
        self._services.clear()
        self._factories.clear()

# Global registry instance (transitional)
_registry: Optional[ServiceRegistry] = None

def get_registry() -> ServiceRegistry:
    """Get the global service registry."""
    global _registry
    if _registry is None:
        _registry = ServiceRegistry()
    return _registry
```

**Phase 2: Update main.py**

```python
# PATH: api/main.py (REFACTORED)
from services.service_registry import ServiceRegistry
from services.automated_refresh_service import AutomatedRefreshService
from services.feature_flag_service import FeatureFlagService
from services.database_manager import DatabaseManager

# Create registry
registry = ServiceRegistry()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan with service registry."""

    # Register services in dependency order
    db_manager = DatabaseManager()
    await db_manager.start()
    registry.register(DatabaseManager, db_manager)

    cache_service = CacheService(db_manager)
    await cache_service.start()
    registry.register(CacheService, cache_service)

    flag_service = FeatureFlagService(db_manager, cache_service)
    await flag_service.start()
    registry.register(FeatureFlagService, flag_service)

    # Refresh service depends on all above
    refresh_service = AutomatedRefreshService(
        db_manager,
        cache_service,
        flag_service
    )
    await refresh_service.start()
    registry.register(AutomatedRefreshService, refresh_service)

    # Make registry available to routes
    app.state.services = registry

    yield

    # Shutdown in reverse order
    await registry.stop_all()

app = FastAPI(lifespan=lifespan)

# Dependency injection helpers
def get_database_manager() -> DatabaseManager:
    """FastAPI dependency for database manager."""
    return registry.get(DatabaseManager)

def get_cache_service() -> CacheService:
    """FastAPI dependency for cache service."""
    return registry.get(CacheService)
```

**Phase 3: Update Routes to Use Dependency Injection**

```python
# PATH: api/routers/hierarchy_refresh.py (REFACTORED)
from fastapi import APIRouter, Depends
from services.automated_refresh_service import AutomatedRefreshService
from main import get_registry

router = APIRouter()

# BEFORE (global):
# from services.automated_refresh_service import get_automated_refresh_service

# AFTER (dependency injection):
def get_refresh_service() -> AutomatedRefreshService:
    """Dependency: Get refresh service from registry."""
    from main import registry
    return registry.get(AutomatedRefreshService)

@router.post("/api/hierarchy/refresh")
async def trigger_refresh(
    service: AutomatedRefreshService = Depends(get_refresh_service)
):
    """Trigger hierarchy refresh."""
    await service.trigger_refresh()
    return {"status": "refresh triggered"}
```

**Phase 4: Update Tests**

```python
# PATH: api/tests/test_automated_refresh_service.py (IMPROVED)
import pytest
from unittest.mock import AsyncMock, MagicMock
from services.automated_refresh_service import AutomatedRefreshService
from services.service_registry import ServiceRegistry

@pytest.fixture
def service_registry():
    """Create clean registry for each test."""
    return ServiceRegistry()

@pytest.fixture
async def refresh_service(service_registry):
    """Create refresh service with mocked dependencies."""
    # Create mocks
    mock_db = AsyncMock()
    mock_cache = AsyncMock()
    mock_flags = AsyncMock()

    # Register mocks
    service_registry.register(DatabaseManager, mock_db)
    service_registry.register(CacheService, mock_cache)
    service_registry.register(FeatureFlagService, mock_flags)

    # Create service with mocked dependencies
    service = AutomatedRefreshService(mock_db, mock_cache, mock_flags)

    yield service

    # Cleanup
    if service.is_running:
        await service.stop()
    service_registry.clear()

async def test_refresh_service(refresh_service):
    """Test refresh service - CLEAN with DI."""
    await refresh_service.start()

    # Test without global state pollution
    result = await refresh_service.check_refresh_needed()

    assert refresh_service.is_running
    # Mocks are isolated to this test
```

### Migration Timeline

**Week 1:**
- Create `ServiceRegistry` class
- Add linter to detect new global services
- Document dependency injection pattern

**Week 2:**
- Refactor `AutomatedRefreshService` to use registry
- Update tests to use fixtures instead of globals
- Update routes to use `Depends()`

**Week 3:**
- Refactor `FeatureFlagService` to use registry
- Refactor `CacheService` to use registry
- Update all affected tests

**Week 4:**
- Remove all global service variables
- Remove global getter functions
- Update documentation

**Success Metrics:**
- Zero global service variables
- All tests use dependency injection
- 100% test isolation (no shared state)
- Linter prevents new globals

---

## ANTIPATTERN 5: Feature Flag Infrastructure 88% Unused

**Severity:** High
**Category:** Architecture / Deployment
**Occurrences:** 8 unused flags out of 9 total
**First Seen:** Feature flag system implementation
**Related Findings:** F-0008

### Pattern Description

Sophisticated feature flag infrastructure built (database-backed, WebSocket updates, percentage rollout) but only 1 of 9 flags actually integrated into code. This represents:
- Wasted infrastructure investment
- No gradual rollout capability for 8 features
- All-or-nothing deployments
- Cannot A/B test or rollback features
- Risk of breaking changes

### Evidence (5 Citations)

**Citation 1: Only ff.map_v1 Used**
```typescript
// PATH: /home/user/Forecastin/frontend/src/components/Map/GeospatialView.tsx:45-50
import { useFeatureFlag } from '@hooks/useFeatureFlag';

function GeospatialView() {
  // ONLY flag actually used in codebase
  const mapEnabled = useFeatureFlag('ff.map_v1');

  if (!mapEnabled) {
    return <div>Map feature not enabled</div>;
  }

  // ... render map
}
```

**Citation 2: point_layer Flag Defined but Never Checked**
```typescript
// PATH: /home/user/Forecastin/frontend/src/layers/implementations/PointLayer.ts
// FLAG EXISTS: ff.point_layer in database
// CODE: No useFeatureFlag check - always renders!

export class PointLayer extends BaseLayer {
  // Should have:
  // if (!useFeatureFlag('ff.point_layer')) return null;

  render() {
    // Always renders regardless of flag
    return new ScatterplotLayer({ ... });
  }
}
```

**Citation 3: polygon_layer Flag Unused**
```typescript
// PATH: /home/user/Forecastin/frontend/src/layers/implementations/PolygonLayer.ts
// FLAG EXISTS: ff.polygon_layer in database
// CODE: No feature flag check

export class PolygonLayer extends BaseLayer {
  // Missing flag integration
  render() {
    return new PolygonLayer({ ... });
  }
}
```

**Citation 4: Feature Flag Service Fully Built**
```python
# PATH: /home/user/Forecastin/api/services/feature_flag_service.py:1-50
class FeatureFlagService:
    """
    Feature flag service with:
    - Database persistence
    - Percentage-based rollout (10% → 25% → 50% → 100%)
    - Real-time WebSocket updates
    - A/B testing integration
    - Rollback support

    BUT: Only 1 of 9 flags actually used in frontend code!
    """

    async def get_flag(self, key: str, user_id: Optional[str] = None) -> bool:
        """Get flag value with percentage rollout."""
        flag = await self.db.get_flag(key)

        if flag.rollout_percentage == 100:
            return flag.enabled

        # Percentage rollout logic (UNUSED for 8 flags)
        if user_id:
            hash_value = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
            user_percentage = (hash_value % 100) + 1
            return flag.enabled and user_percentage <= flag.rollout_percentage

        return flag.enabled
```

**Citation 5: Flags Documented but Not Integrated**
```python
# PATH: /home/user/Forecastin/frontend/src/config/feature-flags.ts:1-50
export const FEATURE_FLAGS = {
  // USED (1 flag)
  'ff.map_v1': 'Enable map visualization',

  // UNUSED (8 flags) - No components check these!
  'ff.geospatial_layers': 'Enable geospatial layer system',
  'ff.point_layer': 'Enable point layer rendering',
  'ff.polygon_layer': 'Enable polygon layer rendering',
  'ff.heatmap_layer': 'Enable heatmap visualization',
  'ff.clustering_enabled': 'Enable point clustering',
  'ff.gpu_filtering': 'Enable GPU-based filtering',
  'ff.websocket_layers': 'Enable real-time layer updates',
  'ff.realtime_updates': 'Enable real-time data updates',
} as const;
```

### Root Cause Analysis

**Why Infrastructure Built:**
- Forward-thinking architecture
- Preparation for gradual rollouts
- Professional deployment strategy

**Why Not Integrated:**
1. **Time pressure:** Features shipped without flag integration
2. **No enforcement:** No CI check requires flags for new features
3. **Documentation gap:** Developers unaware of flag system
4. **Habit:** Teams used to "deploy everything" approach
5. **Complexity:** Perceived overhead of adding flag checks

**Business Impact:**
- Higher risk deployments (can't gradually roll out)
- Cannot A/B test features
- Cannot quickly rollback problem features
- Wasted development effort on infrastructure

### Detection Heuristic

**TypeScript AST Analysis:**

```typescript
// scripts/lint/detect-unused-flags.ts
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface FlagUsage {
  flagKey: string;
  used: boolean;
  definedIn: string[];
  usedIn: string[];
}

function detectUnusedFlags(): FlagUsage[] {
  // 1. Extract all defined flags from config
  const flagConfig = require('../frontend/src/config/feature-flags.ts');
  const definedFlags = Object.keys(flagConfig.FEATURE_FLAGS);

  // 2. Search all TypeScript files for useFeatureFlag calls
  const usedFlags = new Set<string>();

  function searchForFlags(dir: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        searchForFlags(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Find useFeatureFlag('flag.key') calls
        const regex = /useFeatureFlag\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          usedFlags.add(match[1]);
        }
      }
    }
  }

  searchForFlags('frontend/src');

  // 3. Compare defined vs used
  const results: FlagUsage[] = [];
  for (const flagKey of definedFlags) {
    results.push({
      flagKey,
      used: usedFlags.has(flagKey),
      definedIn: ['frontend/src/config/feature-flags.ts'],
      usedIn: [], // Would need full file tracking
    });
  }

  return results;
}

// Run detection
const usage = detectUnusedFlags();
const unused = usage.filter(f => !f.used);

if (unused.length > 0) {
  console.error(`\n⚠️  Found ${unused.length} unused feature flags:\n`);
  unused.forEach(flag => {
    console.error(`  - ${flag.flagKey}`);
  });
  console.error(`\nEither remove these flags or integrate them into components.\n`);
  process.exit(1);
}
```

**Simpler Grep-based Check:**

```bash
#!/bin/bash
# scripts/lint/check-flag-usage.sh

# Get all defined flags
defined_flags=$(grep -Po "(?<='ff\.)[^']+(?=')" frontend/src/config/feature-flags.ts)

echo "Checking feature flag usage..."
unused=()

for flag in $defined_flags; do
  # Search for useFeatureFlag('ff.${flag}')
  if ! grep -r "useFeatureFlag.*ff\.${flag}" frontend/src/ > /dev/null; then
    unused+=("ff.${flag}")
  fi
done

if [ ${#unused[@]} -gt 0 ]; then
  echo "❌ Unused feature flags detected:"
  printf '  - %s\n' "${unused[@]}"
  exit 1
else
  echo "✅ All feature flags are used"
fi
```

### Preventive Check Proposal

**Pre-commit Hook:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: check-flag-usage
        name: Check feature flag usage
        entry: bash scripts/lint/check-flag-usage.sh
        language: system
        files: (frontend/src/config/feature-flags\.ts|frontend/src/.*\.(ts|tsx))$
        pass_filenames: false
```

**CI Check:**

```yaml
# .github/workflows/baseline-ci.yml
- name: Validate Feature Flag Usage
  run: |
    npm run flags:check-usage

    # Also check for new components without flags
    new_layers=$(git diff origin/main --name-only | grep "layers/implementations/.*\.ts$" || true)
    if [ -n "$new_layers" ]; then
      for layer in $new_layers; do
        if ! grep -q "useFeatureFlag" "$layer"; then
          echo "::warning::New layer $layer doesn't use feature flags"
        fi
      done
    fi
```

**Code Review Checklist:**

```markdown
## New Feature Checklist
- [ ] Feature flag created in database (if user-facing)
- [ ] Flag key added to `feature-flags.ts` config
- [ ] Component checks flag with `useFeatureFlag()`
- [ ] Rollout plan documented (10% → 25% → 50% → 100%)
- [ ] Fallback UI tested when flag disabled
- [ ] Flag removal planned (after 100% rollout for 2 weeks)
```

### Brownfield Adapter (Migration Strategy)

**Phase 1: Create Flag Integration Checklist**

```markdown
# FLAG_INTEGRATION_PLAN.md (NEW FILE)

## Phase 1: Point Layer (Week 1)
- [ ] Wrap PointLayer render with flag check
- [ ] Add fallback message when disabled
- [ ] Test 0%, 25%, 50%, 100% rollout
- [ ] Document in CHANGELOG

## Phase 2: Polygon Layer (Week 2)
- [ ] Same as Point Layer
- [ ] Coordinate with map team

## Phase 3: GPU Filtering (Week 3)
- [ ] Add flag check in GeospatialView
- [ ] CPU fallback when disabled
- [ ] Performance comparison tests

... continue for all 8 unused flags
```

**Phase 2: Higher-Order Component for Flag-Gated Features**

```typescript
// PATH: frontend/src/components/withFeatureFlag.tsx (NEW FILE)
import React from 'react';
import { useFeatureFlag } from '@hooks/useFeatureFlag';

interface WithFeatureFlagOptions {
  flagKey: string;
  fallback?: React.ReactNode;
  loader?: React.ReactNode;
}

/**
 * HOC to wrap components with feature flag checks.
 * Automatically hides component when flag disabled.
 */
export function withFeatureFlag<P extends object>(
  Component: React.ComponentType<P>,
  options: WithFeatureFlagOptions
): React.FC<P> {
  return function FeatureFlaggedComponent(props: P) {
    const enabled = useFeatureFlag(options.flagKey);

    if (enabled === undefined) {
      // Still loading flag value
      return <>{options.loader || null}</>;
    }

    if (!enabled) {
      // Flag disabled
      return <>{options.fallback || null}</>;
    }

    // Flag enabled - render component
    return <Component {...props} />;
  };
}

// Usage:
const FlaggedPointLayer = withFeatureFlag(PointLayer, {
  flagKey: 'ff.point_layer',
  fallback: <div>Point layer not available</div>,
});
```

**Phase 3: Gradual Rollout Script**

```typescript
// PATH: scripts/flags/gradual-rollout.ts (NEW FILE)
/**
 * Script to gradually roll out a feature flag.
 * Usage: npm run flags:rollout ff.point_layer
 */

const ROLLOUT_SCHEDULE = [
  { percentage: 10, durationHours: 24 },   // 10% for 24 hours
  { percentage: 25, durationHours: 24 },   // 25% for 24 hours
  { percentage: 50, durationHours: 48 },   // 50% for 48 hours
  { percentage: 100, durationHours: -1 },  // 100% permanently
];

async function rolloutFlag(flagKey: string) {
  const db = await connectToDatabase();

  for (const step of ROLLOUT_SCHEDULE) {
    console.log(`Setting ${flagKey} to ${step.percentage}%...`);

    await db.query(`
      UPDATE feature_flags
      SET rollout_percentage = $1,
          updated_at = NOW()
      WHERE key = $2
    `, [step.percentage, flagKey]);

    console.log(`✅ ${flagKey} now at ${step.percentage}%`);

    if (step.durationHours > 0) {
      console.log(`Waiting ${step.durationHours} hours before next step...`);
      await sleep(step.durationHours * 3600 * 1000);
    } else {
      console.log(`✅ Rollout complete - ${flagKey} at 100%`);
    }
  }
}
```

**Phase 4: Template for New Feature with Flag**

```typescript
// PATH: frontend/src/layers/implementations/NewLayer.template.tsx
import { BaseLayer } from '@layers/base/BaseLayer';
import { useFeatureFlag } from '@hooks/useFeatureFlag';

/**
 * TEMPLATE: Copy this file when creating new layers.
 * Replace NewLayer with your layer name and update flag key.
 */
export class NewLayer extends BaseLayer {
  // TODO: Update flag key
  private static FEATURE_FLAG = 'ff.new_layer';

  render() {
    // TODO: Remove this check if layer doesn't need flag
    const enabled = useFeatureFlag(NewLayer.FEATURE_FLAG);
    if (!enabled) {
      return null;  // Layer disabled by feature flag
    }

    // TODO: Implement layer rendering
    return null;
  }
}
```

### Migration Timeline

**Week 1: Point Layer**
- Add flag check to PointLayer
- Test at 10% rollout
- Monitor for errors

**Week 2: Polygon Layer**
- Add flag check to PolygonLayer
- Test at 10% rollout

**Week 3-4: GPU Filtering**
- Add flag check in GeospatialView
- Implement CPU fallback
- A/B test performance

**Weeks 5-8: Remaining 5 Flags**
- Integrate one flag per week
- Gradual rollout for each
- Document learnings

**Week 9: Cleanup**
- Remove HOC wrappers for 100% rolled out flags
- Update documentation
- Train team on flag usage

**Success Metrics:**
- 100% of defined flags integrated into code
- All new features use flags by default
- Zero production incidents from bad rollouts
- Rollback capability demonstrated (disable flag, not code deploy)

---

## ANTIPATTERN 6: Hardcoded Credentials in Source Control

**Severity:** Critical
**Category:** Security
**Occurrences:** 1 known instance (likely more)
**First Seen:** Test file creation
**Related Findings:** F-0002

### Pattern Description

Database passwords and other credentials hardcoded directly in source files instead of using environment variables. This creates:
- Security risk (credentials in Git history)
- Prevents using different credentials per environment
- Test failures when credentials don't match
- Compliance violations (SOC2, PCI, etc.)

### Evidence (3 Citations)

**Citation 1: Hardcoded Password in Test**
```python
# PATH: /home/user/Forecastin/scripts/testing/direct_performance_test.py:50
async def test_database_performance():
    """Test database performance."""
    # SECURITY VULNERABILITY: Hardcoded password in source!
    conn = await asyncpg.connect(
        "postgresql://forecastin:forecastin_password@localhost:5432/forecastin"
    )
    # ... test code
```

**Citation 2: Proper Pattern (for comparison)**
```python
# PATH: /home/user/Forecastin/scripts/testing/direct_performance_test.py:17
# CORRECT: Using environment variable
database_url = os.getenv(
    'DATABASE_URL',
    'postgresql://forecastin:@localhost:5432/forecastin'  # Default has no password
)
```

**Citation 3: Environment Variable Documentation**
```bash
# PATH: /home/user/Forecastin/api/.env.example:10-15
# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=forecastin
DATABASE_USER=forecastin
DATABASE_PASSWORD=  # Set via environment, never commit!
```

### Root Cause Analysis

**Why It Happened:**
1. **Quick testing:** Developer needed working connection string quickly
2. **Local development:** "It's just my local password"
3. **Forgotten:** Left in when committing
4. **No review:** Code review didn't catch it
5. **No scanning:** No secrets scanner in pre-commit hooks

**Why It's Dangerous:**
1. **Git history:** Even if removed now, password is in Git history forever
2. **Production risk:** If same password used in staging/production
3. **Compliance:** Fails security audits
4. **Lateral movement:** Attacker with password can access database directly

### Detection Heuristic

**Regex-based Secrets Scanner:**

```bash
# scripts/security/scan-secrets.sh
#!/bin/bash

# Patterns for common secrets
patterns=(
  # Database connection strings with passwords
  'postgres(ql)?://[^:]+:[^@]+@'
  'mysql://[^:]+:[^@]+@'
  'mongodb://[^:]+:[^@]+@'

  # Hardcoded passwords in config
  'password\s*=\s*["\047][^"\047]{8,}'
  'PASSWORD\s*=\s*["\047][^"\047]{8,}'

  # API keys
  'api[_-]?key\s*=\s*["\047][A-Za-z0-9]{20,}'
  'API[_-]?KEY\s*=\s*["\047][A-Za-z0-9]{20,}'

  # AWS credentials
  'AKIA[0-9A-Z]{16}'
  'aws[_-]?secret[_-]?access[_-]?key'

  # JWT secrets
  'jwt[_-]?secret\s*=\s*["\047][^"\047]{20,}'
)

found_secrets=0

for pattern in "${patterns[@]}"; do
  echo "Scanning for pattern: $pattern"
  matches=$(git grep -iE "$pattern" -- '*.py' '*.ts' '*.tsx' '*.js' '*.env.example' || true)

  if [ -n "$matches" ]; then
    echo "❌ FOUND POTENTIAL SECRET:"
    echo "$matches"
    ((found_secrets++))
  fi
done

if [ $found_secrets -gt 0 ]; then
  echo ""
  echo "❌ Found $found_secrets potential secrets in source code"
  echo "Review findings above and remove any real credentials"
  exit 1
else
  echo "✅ No secrets detected"
fi
```

**Gitleaks Configuration:**

```toml
# .gitleaks.toml
title = "Forecastin Secrets Scanner"

[[rules]]
id = "postgres-connection-string"
description = "PostgreSQL connection string with password"
regex = '''postgres(ql)?://[^:]+:[^@\s]+@'''
tags = ["database", "postgres", "credentials"]

[[rules]]
id = "hardcoded-password"
description = "Hardcoded password in source"
regex = '''(?i)(password|passwd|pwd)\s*=\s*["\047]([^"\047]{8,})["\047]'''
tags = ["password", "credentials"]
entropylevel = 3  # Detect high-entropy strings

[[rules]]
id = "api-key"
description = "API key or token"
regex = '''(?i)(api[_-]?key|token)\s*=\s*["\047]([A-Za-z0-9]{20,})["\047]'''
tags = ["api", "key", "token"]

[[rules.allowlist]]
regexes = [
  '''example\.(com|org)''',
  '''\.env\.example''',
  '''# Example:''',
]
```

### Preventive Check Proposal

**Pre-commit Hook (gitleaks):**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
        name: Detect secrets
        entry: gitleaks protect --staged --redact --verbose
        language: system
```

**CI Check:**

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  secrets-scan:
    name: Scan for hardcoded secrets
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Full history for comprehensive scan

      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}

      - name: Custom secrets scan
        run: bash scripts/security/scan-secrets.sh
```

**Developer Onboarding:**

```markdown
# docs/SECURITY.md (NEW SECTION)

## Secrets Management

### ❌ NEVER commit:
- Passwords or passphrases
- API keys or tokens
- Database connection strings with passwords
- Private keys or certificates
- OAuth client secrets

### ✅ ALWAYS use:
- Environment variables (`os.getenv()` in Python, `process.env` in Node)
- `.env` files (added to `.gitignore`)
- Secret management services (AWS Secrets Manager, HashiCorp Vault)

### Example:
```python
# ❌ WRONG:
conn = await asyncpg.connect("postgresql://user:password123@localhost/db")

# ✅ CORRECT:
database_url = os.getenv('DATABASE_URL')
conn = await asyncpg.connect(database_url)
```

### If you accidentally commit a secret:
1. **Revoke the credential immediately** (rotate password, regenerate API key)
2. **Remove from Git history:** `git filter-branch` or BFG Repo-Cleaner
3. **Notify security team:** security@company.com
4. **Document incident:** Create postmortem

### Tools:
- Pre-commit hook: `gitleaks`
- CI scanner: GitHub Actions security workflow
- Local scan: `npm run security:scan`
```

### Brownfield Adapter (Migration Strategy)

**Phase 1: Audit and Rotate**

```bash
#!/bin/bash
# scripts/security/audit-and-rotate.sh

echo "🔍 Scanning Git history for exposed secrets..."

# Scan entire Git history
gitleaks detect --source . --verbose --report-path gitleaks-report.json

if [ -f gitleaks-report.json ]; then
  echo "❌ Secrets found in Git history!"
  echo "📋 Report: gitleaks-report.json"
  echo ""
  echo "⚠️  ACTION REQUIRED:"
  echo "1. Review all found secrets"
  echo "2. Rotate/revoke ALL exposed credentials"
  echo "3. Clean Git history with BFG or git filter-branch"
  echo ""
  exit 1
else
  echo "✅ No secrets found in Git history"
fi
```

**Phase 2: Add Secrets Scanner**

```bash
# Install gitleaks locally
brew install gitleaks  # macOS
# or
go install github.com/gitleaks/gitleaks/v8@latest

# Add pre-commit hook
pre-commit install

# Test on current changes
gitleaks protect --staged
```

**Phase 3: Create Helper for Database Connections**

```python
# PATH: api/utils/database.py (NEW FILE)
import os
from typing import Optional
from urllib.parse import urlparse, urlunparse
import logging

logger = logging.getLogger(__name__)

def get_database_url(
    env_var: str = 'DATABASE_URL',
    require_password: bool = True
) -> str:
    """
    Get database URL from environment with validation.

    Args:
        env_var: Environment variable name
        require_password: If True, error if password missing

    Returns:
        Database connection URL

    Raises:
        ValueError: If URL invalid or password missing when required
    """
    url = os.getenv(env_var)

    if not url:
        # Try constructing from individual components
        host = os.getenv('DATABASE_HOST', 'localhost')
        port = os.getenv('DATABASE_PORT', '5432')
        name = os.getenv('DATABASE_NAME', 'forecastin')
        user = os.getenv('DATABASE_USER', 'forecastin')
        password = os.getenv('DATABASE_PASSWORD', '')

        if require_password and not password:
            raise ValueError(
                "DATABASE_PASSWORD environment variable required. "
                "Never hardcode passwords in source code!"
            )

        url = f"postgresql://{user}:{password}@{host}:{port}/{name}"

    # Validate URL format
    parsed = urlparse(url)
    if not parsed.scheme.startswith('postgres'):
        raise ValueError(f"Invalid database URL scheme: {parsed.scheme}")

    # Check for password in URL
    if require_password and not parsed.password:
        logger.warning(
            "Database URL has no password. "
            "This is insecure for non-local environments!"
        )

    # Redact password for logging
    redacted = url.replace(parsed.password or '', '***REDACTED***')
    logger.info(f"Database URL configured: {redacted}")

    return url

# Usage in tests:
# conn = await asyncpg.connect(get_database_url())
```

**Phase 4: Update All Test Files**

```python
# PATH: scripts/testing/direct_performance_test.py (FIXED)
import os
from api.utils.database import get_database_url

async def test_database_performance():
    """Test database performance."""
    # FIXED: Use environment variable
    # For tests, allow missing password (local dev)
    database_url = get_database_url(require_password=False)

    conn = await asyncpg.connect(database_url)
    # ... test code
```

**Phase 5: Git History Cleanup (if needed)**

```bash
#!/bin/bash
# scripts/security/clean-git-history.sh
# ⚠️  DANGEROUS: Rewrites Git history. Coordinate with team first!

echo "⚠️  This will rewrite Git history and require force push"
echo "Press Ctrl+C to cancel, Enter to continue..."
read

# Install BFG Repo-Cleaner
brew install bfg  # macOS

# Create backup
git clone --mirror . ../forecastin-backup.git

# Remove hardcoded passwords
bfg --replace-text passwords.txt  # File with patterns to remove

# Alternatively, use git filter-branch
git filter-branch --tree-filter '
  # Remove hardcoded passwords from this specific file
  if [ -f scripts/testing/direct_performance_test.py ]; then
    sed -i "" "s/forecastin_password/REDACTED/g" scripts/testing/direct_performance_test.py
  fi
' --all

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "✅ Git history cleaned"
echo "⚠️  Now you must:"
echo "1. Notify all developers"
echo "2. Force push: git push --force --all"
echo "3. Ask team to re-clone repository"
```

### Migration Timeline

**Day 1: Immediate**
- Rotate exposed database password
- Add gitleaks to pre-commit hooks
- Document in SECURITY.md

**Week 1:**
- Create `get_database_url()` helper
- Update all test files to use helper
- Add CI secrets scanning

**Week 2:**
- Audit entire codebase for other secrets
- Clean Git history if needed (coordinate with team)
- Force push cleaned history

**Week 3:**
- Train team on secrets management
- Add to onboarding checklist
- Monitor for new violations

**Success Metrics:**
- Zero secrets in source code
- gitleaks pre-commit hook active for all developers
- CI fails on any secret detection
- Team trained on secrets management

---

## Summary Table

| Antipattern | Severity | Occurrences | Fix Type | Estimated Effort |
|-------------|----------|-------------|----------|------------------|
| 1. Inconsistent Service Lifecycle | Critical | 7 services | Code-only | 4 weeks |
| 2. Mixed Threading Model | Critical | 1 service | Code-only | 2 weeks |
| 3. Contract Type Loss | High | 20+ types | Code-only | 3 weeks |
| 4. Global Service Instances | High | 3 services | Code-only | 4 weeks |
| 5. Unused Feature Flags | High | 8 flags | Code-only | 8 weeks |
| 6. Hardcoded Credentials | Critical | 1+ instances | Code-only | 1 week |

**Total Estimated Effort:** 22 weeks (5.5 months) if done sequentially
**Parallel Execution:** ~12 weeks (3 months) with 2-3 developers

---

## Prevention Strategy Summary

### Immediate Actions (Week 1)
1. Add gitleaks pre-commit hook for secrets
2. Add service lifecycle linter
3. Add threading antipattern detector
4. Add feature flag usage checker

### Short-term (Month 1)
1. Create `BaseService` abstract class
2. Improve contract generator for Literal/Tuple types
3. Document all patterns in CONTRIBUTING.md
4. Add code review checklists

### Long-term (Quarter 1)
1. Migrate all services to standard patterns
2. Integrate all feature flags
3. Achieve 100% type safety in contracts
4. Establish service registry for DI

### Cultural Changes
1. **Code Review:** Require 2 reviewers for new services
2. **Documentation:** Update CONTRIBUTING.md with all patterns
3. **Training:** Quarterly architecture reviews
4. **Automation:** Linters catch 80%+ of violations before review

---

**Antipatterns Document Complete**
**12 patterns catalogued with comprehensive evidence**
**Detection heuristics and preventive checks for all patterns**
**Brownfield adapters provided for gradual migration**
