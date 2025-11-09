# ADR-0001: Service Lifecycle Standard

**Status:** Accepted
**Date:** 2025-11-09
**Deciders:** Engineering Team
**Evidence:** F-0006, F-0007, Antipattern-1

---

## Context

Current services have inconsistent lifecycle management patterns:
- Some use `__init__()` with blocking operations
- Others use `start()` methods (sync and async mixed)
- No standard `stop()` or cleanup mechanism
- No health check interface
- Threading mixed with asyncio (AP-2)

**PATH Evidence:**
- `/home/user/Forecastin/api/services/automated_refresh_service.py:25-50` - Thread-based, no async start
- `/home/user/Forecastin/api/services/websocket_manager.py:15-40` - Async start, no stop
- 7 services, 5 different patterns

---

## Decision

We will adopt a standard service lifecycle based on `BaseService` abstract class:

```python
from abc import ABC, abstractmethod
from enum import Enum

class ServiceHealth(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"

class BaseService(ABC):
    """Abstract base class for all services."""

    def __init__(self):
        self.is_running = False

    @abstractmethod
    async def start(self) -> None:
        """
        Start the service.
        MUST be idempotent - safe to call multiple times.
        MUST complete within 30 seconds.
        """
        pass

    @abstractmethod
    async def stop(self) -> None:
        """
        Stop the service gracefully.
        MUST complete within 30 seconds.
        MUST be safe to call even if not started.
        """
        pass

    async def health_check(self) -> ServiceHealth:
        """Check service health."""
        return ServiceHealth.HEALTHY if self.is_running else ServiceHealth.UNHEALTHY
```

**All services MUST:**
1. Inherit from `BaseService`
2. Implement `start()` and `stop()` as async methods
3. Be idempotent (safe to start/stop multiple times)
4. Complete startup/shutdown within 30 seconds
5. Use `asyncio` primitives (no threading unless required for I/O)

---

## Consequences

**Positive:**
- Consistent lifecycle across all services
- Easier testing (mock start/stop)
- Graceful shutdown guaranteed
- Health checks standardized
- No more threading/asyncio conflicts

**Negative:**
- Requires refactoring 7 existing services (~12 hours)
- Services must convert from threading to asyncio

**Migration:**
- Phase 1: Create `BaseService` (T-0101)
- Phase 2: Migrate services one by one (T-0102, T-0103)
- Phase 3: Enforce in CI (linting rule)

---

## Related

- **Addresses:** F-0006, F-0007, AP-1, AP-2
- **Tasks:** T-0101, T-0102, T-0103
- **ADRs:** ADR-0004 (Observability Standards)
