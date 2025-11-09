# 04 Target Architecture

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Define target architecture for rebuilding system from evidence
**Status:** Blueprint for greenfield rebuild addressing all findings from 02_FINDINGS.md

---

## Executive Summary

This document defines the target architecture for rebuilding Forecastin from scratch, incorporating lessons learned from the current implementation. All architectural decisions are evidence-based, citing specific findings and antipatterns.

**Key Principles:**
1. **Contract-First:** All interfaces defined before implementation
2. **Type-Safe:** Zero `any` types, complete Pydantic→TypeScript fidelity
3. **Consistent Patterns:** Single service lifecycle, single state management pattern
4. **Testable:** Dependency injection, mockable boundaries
5. **Observable:** Structured logging, distributed tracing, performance budgets
6. **Gradual Rollout:** Feature flags integrated from day one

**Addresses Findings:**
- F-0001 to F-0019 (all critical and high-priority findings)
- Antipatterns 1-6 from 03_MISTAKES_AND_PATTERNS.md
- Architectural gaps documented in checks/

---

## Table of Contents

1. [Module Boundaries](#module-boundaries)
2. [Contract Schemas](#contract-schemas)
3. [Service Interfaces](#service-interfaces)
4. [Event System](#event-system)
5. [Caching Strategy](#caching-strategy)
6. [Observability](#observability)
7. [Performance SLOs](#performance-slos)
8. [Security Architecture](#security-architecture)

---

## Module Boundaries

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   React UI   │  │  Mobile App  │  │  Admin Tool  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │       API Gateway / Load Balancer    │
          │         (nginx / Cloudflare)         │
          └──────────────────┬──────────────────┘
                             │
    ┌────────────────────────┴────────────────────────┐
    │                                                  │
┌───▼──────────────┐                    ┌─────────────▼────────┐
│   FastAPI App    │                    │   WebSocket Server   │
│  (REST API)      │                    │  (Real-time events)  │
│                  │                    │                      │
│ ┌──────────────┐ │                    │ ┌──────────────────┐ │
│ │   Routers    │ │                    │ │  Connection Mgr  │ │
│ └──────┬───────┘ │                    │ └────────┬─────────┘ │
│        │         │                    │          │           │
│ ┌──────▼───────┐ │                    │ ┌────────▼─────────┐ │
│ │  Services    │ │◄───────────────────┼─│  Pub/Sub Service │ │
│ └──────┬───────┘ │                    │ └──────────────────┘ │
└────────┼─────────┘                    └──────────────────────┘
         │                                         │
    ┌────▼─────────────────────────────────────────▼────┐
    │                 Service Registry                   │
    │  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
    │  │ Database│  │  Cache  │  │ Feature │            │
    │  │ Manager │  │ Service │  │  Flags  │  ... more  │
    │  └─────────┘  └─────────┘  └─────────┘            │
    └────┬──────────────┬──────────────┬─────────────────┘
         │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌───▼──────┐
    │ Postgres│    │  Redis  │    │ Postgres │
    │  (Data) │    │ (L2/L3) │    │ (Flags)  │
    └─────────┘    └─────────┘    └──────────┘
```

### Module Dependency Graph

```
api/
├── main.py                     # Entry point, lifespan, middleware
├── config/                     # Configuration and validation
│   ├── settings.py             # Pydantic settings (12-factor app)
│   ├── database.py             # Database configuration
│   └── cache.py                # Cache configuration
│
├── contracts/                  # **NEW** - Contract-first definitions
│   ├── __init__.py
│   ├── base.py                 # Base models and utilities
│   ├── requests.py             # Request DTOs
│   ├── responses.py            # Response DTOs
│   ├── events.py               # WebSocket event schemas
│   └── geometry.py             # GeoJSON types (fully typed)
│
├── services/                   # Business logic (DI-ready)
│   ├── base.py                 # BaseService ABC (**NEW**)
│   ├── registry.py             # ServiceRegistry (**NEW**)
│   ├── database/
│   │   ├── manager.py          # DatabaseManager (async)
│   │   └── queries.py          # Query builders
│   ├── cache/
│   │   ├── service.py          # CacheService (L1-L4)
│   │   └── strategies.py       # Caching strategies
│   ├── feature_flags/
│   │   ├── service.py          # FeatureFlagService
│   │   └── rollout.py          # Rollout strategies
│   ├── hierarchy/
│   │   ├── service.py          # HierarchyService (LTREE)
│   │   └── resolver.py         # Optimized resolver
│   ├── realtime/
│   │   ├── websocket.py        # WebSocketManager
│   │   └── pubsub.py           # Pub/Sub service
│   └── observability/
│       ├── logging.py          # Structured logging
│       ├── metrics.py          # Prometheus metrics
│       └── tracing.py          # Distributed tracing
│
├── routers/                    # API endpoints (thin layer)
│   ├── health.py               # Health checks
│   ├── hierarchy.py            # Hierarchy navigation
│   ├── entities.py             # Entity CRUD
│   ├── scenarios.py            # Scenario planning
│   └── websocket.py            # WebSocket endpoint
│
├── middleware/                 # **NEW** - Request/response middleware
│   ├── correlation_id.py       # Correlation ID injection
│   ├── request_logging.py      # Request/response logging
│   └── error_handling.py       # Global error handling
│
└── utils/                      # Utilities
    ├── serialization.py        # orjson helpers
    ├── validation.py           # Validation helpers
    └── security.py             # Security utilities

frontend/
├── src/
│   ├── contracts/              # **NEW** - Co-located with usage
│   │   ├── generated.ts        # Auto-generated from Python
│   │   ├── guards.ts           # Type guards
│   │   └── validators.ts       # Runtime validation (Zod)
│   │
│   ├── services/               # **NEW** - Service layer
│   │   ├── api.ts              # API client (typed)
│   │   ├── websocket.ts        # WebSocket client (typed)
│   │   └── featureFlags.ts     # Feature flag service
│   │
│   ├── state/                  # **RENAMED** from store/
│   │   ├── query/              # React Query queries
│   │   │   ├── hierarchy.ts
│   │   │   ├── entities.ts
│   │   │   └── scenarios.ts
│   │   ├── local/              # Zustand local state
│   │   │   ├── ui.ts
│   │   │   └── session.ts
│   │   └── sync.ts             # State synchronization
│   │
│   ├── components/
│   │   ├── ErrorBoundary/      # **NEW** - Systematic error boundaries
│   │   │   ├── Root.tsx        # Root-level boundary
│   │   │   ├── Route.tsx       # Route-level boundary
│   │   │   └── Feature.tsx     # Feature-level boundary
│   │   ├── FeatureGate/        # **NEW** - Feature flag HOC
│   │   │   └── FeatureGate.tsx
│   │   ├── Map/
│   │   ├── Navigation/
│   │   ├── Outcomes/
│   │   └── UI/
│   │
│   ├── layers/                 # Geospatial layer system
│   │   ├── base/
│   │   ├── implementations/
│   │   ├── registry/
│   │   └── hooks/              # **NEW** - Layer hooks
│   │
│   ├── hooks/
│   │   ├── useQuery.ts         # **NEW** - Typed query wrapper
│   │   ├── useMutation.ts      # **NEW** - Typed mutation wrapper
│   │   ├── useWebSocket.ts
│   │   ├── useFeatureFlag.ts
│   │   └── useHierarchy.ts
│   │
│   ├── utils/
│   │   ├── logger.ts           # **NEW** - Structured frontend logging
│   │   ├── sentry.ts           # **NEW** - Error monitoring
│   │   └── performance.ts      # **NEW** - Performance monitoring
│   │
│   └── errors/                 # **NEW** - Centralized error handling
│       ├── ErrorBoundary.tsx   # (moved from components/UI)
│       ├── handlers.ts         # Error handlers
│       └── catalog.ts          # Error catalog
```

**Dependency Rules:**

1. **Routers** depend on **Services** (never directly on database)
2. **Services** depend on **ServiceRegistry** (dependency injection)
3. **Contracts** have NO dependencies (pure data structures)
4. **Frontend components** depend on **hooks**, never directly on API
5. **Hooks** depend on **services**, which depend on **contracts**

**Evidence:**
- Addresses F-0006 (service lifecycle inconsistency)
- Addresses Antipattern 4 (global service instances)
- Addresses F-0012 (deep relative path imports)

---

## Contract Schemas

### Contract Generation Strategy

**Problem Solved:**
- F-0004: Literal and Tuple types lost in translation
- F-0001: Missing utility function exports
- F-0005: Missing properties in generated types

**Solution:**
Full-fidelity Pydantic→TypeScript translation with comprehensive type mapping.

### Python Contract Definitions

```python
# PATH: api/contracts/geometry.py (NEW FILE)
"""
GeoJSON geometry contracts.
These are the canonical definitions - TypeScript types generated from these.
"""

from typing import Literal, Tuple, List, Union, Annotated
from pydantic import BaseModel, Field, field_validator

# Type aliases for clarity
Coordinate2D = Tuple[float, float]
Coordinate3D = Tuple[float, float, float]
Coordinate = Coordinate2D | Coordinate3D

class PointGeometry(BaseModel):
    """GeoJSON Point geometry with proper typing."""

    type: Literal['Point']
    coordinates: Annotated[Coordinate, Field(description="[longitude, latitude] or [lon, lat, altitude]")]

    model_config = {'extra': 'forbid'}


class LineStringGeometry(BaseModel):
    """GeoJSON LineString geometry."""

    type: Literal['LineString']
    coordinates: Annotated[List[Coordinate], Field(min_length=2)]

    model_config = {'extra': 'forbid'}

    @field_validator('coordinates')
    @classmethod
    def validate_minimum_points(cls, v: List[Coordinate]) -> List[Coordinate]:
        if len(v) < 2:
            raise ValueError('LineString must have at least 2 points')
        return v


class PolygonGeometry(BaseModel):
    """GeoJSON Polygon geometry with ring validation."""

    type: Literal['Polygon']
    coordinates: Annotated[
        List[List[Coordinate]],
        Field(description="Array of rings (first is exterior, rest are holes)")
    ]

    model_config = {'extra': 'forbid'}

    @field_validator('coordinates')
    @classmethod
    def validate_rings(cls, v: List[List[Coordinate]]) -> List[List[Coordinate]]:
        for i, ring in enumerate(v):
            if len(ring) < 4:
                raise ValueError(f'Ring {i} must have at least 4 points (closed)')

            # Validate ring is closed (first point == last point)
            if ring[0] != ring[-1]:
                raise ValueError(f'Ring {i} must be closed (first point must equal last)')

        return v


# Union type with discriminator
Geometry = Annotated[
    Union[PointGeometry, LineStringGeometry, PolygonGeometry],
    Field(discriminator='type')
]
```

### TypeScript Generated Contracts

```typescript
// PATH: frontend/src/contracts/generated.ts (GENERATED - DO NOT EDIT)
/**
 * AUTO-GENERATED FROM api/contracts/geometry.py
 * Generated: 2025-11-09T05:21:00Z
 * Generator: scripts/dev/generate_contracts_v2.py
 *
 * DO NOT EDIT THIS FILE MANUALLY
 */

/**
 * [longitude, latitude]
 */
export type Coordinate2D = [number, number];

/**
 * [longitude, latitude, altitude]
 */
export type Coordinate3D = [number, number, number];

/**
 * Coordinate can be 2D or 3D
 */
export type Coordinate = Coordinate2D | Coordinate3D;

/**
 * GeoJSON Point geometry with proper typing.
 *
 * Python source: api/contracts/geometry.py:PointGeometry
 */
export interface PointGeometry {
  type: 'Point';  // NOT 'any' - full type fidelity!
  /**
   * [longitude, latitude] or [lon, lat, altitude]
   */
  coordinates: Coordinate;
}

/**
 * GeoJSON LineString geometry.
 *
 * Python source: api/contracts/geometry.py:LineStringGeometry
 */
export interface LineStringGeometry {
  type: 'LineString';
  /**
   * Array of coordinates (minimum 2 points)
   */
  coordinates: Coordinate[];  // NOT 'any[]' - proper array type!
}

/**
 * GeoJSON Polygon geometry with ring validation.
 *
 * Python source: api/contracts/geometry.py:PolygonGeometry
 */
export interface PolygonGeometry {
  type: 'Polygon';
  /**
   * Array of rings (first is exterior, rest are holes)
   */
  coordinates: Coordinate[][];  // NOT 'any' - proper nested arrays!
}

/**
 * Union type for all geometry types.
 * TypeScript will narrow type based on 'type' discriminator.
 */
export type Geometry =
  | PointGeometry
  | LineStringGeometry
  | PolygonGeometry;

/**
 * Type guard for PointGeometry
 */
export function isPointGeometry(geom: Geometry): geom is PointGeometry {
  return geom.type === 'Point';
}

/**
 * Type guard for LineStringGeometry
 */
export function isLineStringGeometry(geom: Geometry): geom is LineStringGeometry {
  return geom.type === 'LineString';
}

/**
 * Type guard for PolygonGeometry
 */
export function isPolygonGeometry(geom: Geometry): geom is PolygonGeometry {
  return geom.type === 'Polygon';
}

/**
 * Utility: Get centroid of a geometry
 * (Example of properly exported utility function - addresses F-0001)
 */
export function getGeometryCentroid(geom: Geometry): Coordinate2D {
  if (isPointGeometry(geom)) {
    const [lon, lat] = geom.coordinates;
    return [lon, lat];
  }

  if (isLineStringGeometry(geom)) {
    // Midpoint of first and last coordinate
    const first = geom.coordinates[0];
    const last = geom.coordinates[geom.coordinates.length - 1];
    return [
      (first[0] + last[0]) / 2,
      (first[1] + last[1]) / 2,
    ];
  }

  if (isPolygonGeometry(geom)) {
    // Centroid of exterior ring
    const ring = geom.coordinates[0];
    const sum = ring.reduce(
      (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
      [0, 0] as [number, number]
    );
    return [sum[0] / ring.length, sum[1] / ring.length];
  }

  // TypeScript exhaustiveness check ensures all cases handled
  const _exhaustive: never = geom;
  throw new Error(`Unknown geometry type: ${(_exhaustive as Geometry).type}`);
}
```

### Request/Response Contracts

```python
# PATH: api/contracts/requests.py (NEW FILE)
"""Request DTOs for all API endpoints."""

from typing import Optional, List
from pydantic import BaseModel, Field
from .geometry import Geometry

class HierarchyQueryRequest(BaseModel):
    """Request for hierarchical entity query."""

    parent_path: Optional[str] = Field(
        None,
        description="LTREE path of parent (null for root)"
    )
    entity_types: Optional[List[str]] = Field(
        None,
        description="Filter by entity types"
    )
    max_depth: Optional[int] = Field(
        None,
        ge=1,
        le=10,
        description="Maximum depth to traverse"
    )
    bbox: Optional[Geometry] = Field(
        None,
        description="Spatial bounding box filter"
    )
    offset: int = Field(0, ge=0)
    limit: int = Field(100, ge=1, le=1000)

    model_config = {'extra': 'forbid'}


class EntityCreateRequest(BaseModel):
    """Request to create a new entity."""

    name: str = Field(..., min_length=1, max_length=255)
    entity_type: str = Field(..., min_length=1)
    description: Optional[str] = None
    parent_id: Optional[str] = Field(None, description="Parent entity UUID")
    location: Optional[Geometry] = None
    metadata: dict = Field(default_factory=dict)
    confidence_score: float = Field(0.0, ge=0.0, le=1.0)

    model_config = {'extra': 'forbid'}
```

```python
# PATH: api/contracts/responses.py (NEW FILE)
"""Response DTOs for all API endpoints."""

from typing import Optional, List, Generic, TypeVar
from pydantic import BaseModel, Field
from datetime import datetime

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response wrapper."""

    items: List[T]
    total: int = Field(..., ge=0)
    offset: int = Field(..., ge=0)
    limit: int = Field(..., ge=1)
    has_more: bool

    model_config = {'extra': 'forbid'}


class EntityResponse(BaseModel):
    """Single entity response."""

    id: str
    name: str
    entity_type: str
    description: Optional[str]
    path: str  # LTREE path as string
    path_depth: int
    location: Optional[dict]  # GeoJSON
    confidence_score: float
    children_count: int  # ADDED - addresses F-0005
    created_at: datetime
    updated_at: datetime

    model_config = {'extra': 'forbid'}


class HierarchyResponse(BaseModel):
    """Hierarchical entity query response."""

    entities: List[EntityResponse]  # ADDED - addresses F-0005
    total: int
    has_more: bool

    # Pagination metadata
    offset: int
    limit: int

    # Query metadata
    parent_path: Optional[str]
    max_depth_reached: bool

    model_config = {'extra': 'forbid'}
```

### WebSocket Event Contracts

```python
# PATH: api/contracts/events.py (NEW FILE)
"""WebSocket event schemas with versioning."""

from typing import Literal, Optional, List, Union
from pydantic import BaseModel, Field
from datetime import datetime

# Base event with versioning envelope
class BaseEvent(BaseModel):
    """Base class for all WebSocket events."""

    version: Literal['1.0'] = '1.0'
    event_id: str = Field(..., description="Unique event ID for idempotency")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    correlation_id: Optional[str] = Field(None, description="Request correlation ID")

    model_config = {'extra': 'forbid'}


class LayerUpdateEvent(BaseEvent):
    """Event sent when a geospatial layer updates."""

    type: Literal['layer_update'] = 'layer_update'
    layer_id: str  # REQUIRED - addresses F-0003 (test fixture schema mismatch)
    action: Literal['add', 'update', 'remove']
    features: List[dict]  # GeoJSON features
    affected_count: int

    model_config = {'extra': 'forbid'}


class FeatureFlagUpdateEvent(BaseEvent):
    """Event sent when a feature flag changes."""

    type: Literal['feature_flag_update'] = 'feature_flag_update'
    flag_key: str
    enabled: bool
    rollout_percentage: int = Field(..., ge=0, le=100)

    model_config = {'extra': 'forbid'}


class HierarchyInvalidationEvent(BaseEvent):
    """Event sent when hierarchy cache should be invalidated."""

    type: Literal['hierarchy_invalidation'] = 'hierarchy_invalidation'
    affected_paths: List[str]  # LTREE paths affected
    reason: str

    model_config = {'extra': 'forbid'}


# Union type for all events (discriminated by 'type')
WebSocketEvent = Union[
    LayerUpdateEvent,
    FeatureFlagUpdateEvent,
    HierarchyInvalidationEvent,
]
```

### Contract Versioning Policy

**Version Format:** Semantic versioning (MAJOR.MINOR)
- **MAJOR:** Breaking changes (incompatible with previous version)
- **MINOR:** Additive changes (backward compatible)

**Compatibility Rules:**

1. **Backward Compatibility:**
   - New optional fields allowed (MINOR bump)
   - New event types allowed (MINOR bump)
   - Removing fields requires MAJOR bump
   - Changing field types requires MAJOR bump

2. **Version Negotiation:**
   - Client sends `Accept-Version: 1.0` header
   - Server responds with `Content-Version: 1.0` header
   - WebSocket: client sends `{"version": "1.0"}` in connection handshake

3. **Deprecation Process:**
   - Deprecation announced 90 days before removal
   - Both old and new versions supported during transition
   - Metrics track usage of deprecated endpoints
   - Remove when usage < 1% for 30 days

**Evidence:**
- Addresses F-0004 (contract type loss)
- Addresses F-0001 (missing exports)
- Addresses F-0003 (schema mismatches)

---

## Service Interfaces

### BaseService Abstract Class

```python
# PATH: api/services/base.py (NEW FILE)
"""
Base service class enforcing consistent lifecycle patterns.
Addresses Antipattern 1: Inconsistent Service Lifecycle Patterns
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from datetime import datetime
import logging
import asyncio

logger = logging.getLogger(__name__)

class ServiceState:
    """Service state tracking."""

    STOPPED = 'stopped'
    STARTING = 'starting'
    RUNNING = 'running'
    STOPPING = 'stopping'
    FAILED = 'failed'


class ServiceHealth(BaseModel):
    """Service health status."""

    healthy: bool
    state: str
    uptime_seconds: float
    last_health_check: datetime
    details: Dict[str, Any] = Field(default_factory=dict)


class BaseService(ABC):
    """
    Abstract base class for all services.

    Lifecycle:
    1. __init__() - Construct service with dependencies (DI)
    2. start() - Initialize resources, start background tasks
    3. <running> - Service operational
    4. stop() - Cleanup resources, stop tasks
    5. health_check() - Periodic health validation

    Thread Safety:
    - All methods must be thread-safe
    - Use asyncio.Lock for shared state
    - No blocking operations in async methods
    """

    def __init__(self):
        self._state = ServiceState.STOPPED
        self._started_at: Optional[datetime] = None
        self._health_status = ServiceHealth(
            healthy=False,
            state=self._state,
            uptime_seconds=0.0,
            last_health_check=datetime.utcnow()
        )
        self._state_lock = asyncio.Lock()

    @property
    def state(self) -> str:
        """Current service state."""
        return self._state

    @property
    def is_running(self) -> bool:
        """Check if service is in running state."""
        return self._state == ServiceState.RUNNING

    @abstractmethod
    async def start(self) -> None:
        """
        Start the service.

        Must be idempotent - calling multiple times should be safe.
        Should complete within 30 seconds or raise TimeoutError.

        Raises:
            RuntimeError: If service failed to start
            TimeoutError: If start takes > 30 seconds
        """
        pass

    @abstractmethod
    async def stop(self) -> None:
        """
        Stop the service and cleanup resources.

        Must be idempotent - calling multiple times should be safe.
        Must complete within 30 seconds.

        Raises:
            TimeoutError: If stop takes > 30 seconds
        """
        pass

    async def health_check(self) -> ServiceHealth:
        """
        Check service health.

        Default implementation checks if state is RUNNING.
        Override to add service-specific health checks.

        Returns:
            ServiceHealth object with detailed status
        """
        async with self._state_lock:
            uptime = 0.0
            if self._started_at:
                uptime = (datetime.utcnow() - self._started_at).total_seconds()

            self._health_status = ServiceHealth(
                healthy=self.is_running,
                state=self._state,
                uptime_seconds=uptime,
                last_health_check=datetime.utcnow(),
                details=await self._get_health_details()
            )

            return self._health_status

    async def _get_health_details(self) -> Dict[str, Any]:
        """
        Get service-specific health details.

        Override to add custom health checks.
        Called by health_check().
        """
        return {}

    async def restart(self) -> None:
        """Restart the service (stop then start)."""
        logger.info(f"Restarting {self.__class__.__name__}...")
        await self.stop()
        await self.start()
        logger.info(f"{self.__class__.__name__} restarted successfully")

    async def _set_state(self, new_state: str) -> None:
        """Thread-safe state transition."""
        async with self._state_lock:
            logger.debug(f"{self.__class__.__name__}: {self._state} → {new_state}")
            self._state = new_state

            if new_state == ServiceState.RUNNING and not self._started_at:
                self._started_at = datetime.utcnow()
            elif new_state == ServiceState.STOPPED:
                self._started_at = None

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} state={self._state}>"
```

### Service Registry (Dependency Injection)

```python
# PATH: api/services/registry.py (NEW FILE)
"""
Service registry for dependency injection.
Addresses Antipattern 4: Global Service Instance Anti-Pattern
"""

from typing import Dict, Type, TypeVar, Optional, Callable, List
import logging
from .base import BaseService

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseService)

class ServiceRegistry:
    """
    Registry for service lifecycle management and dependency injection.

    Usage:
        registry = ServiceRegistry()

        # Register services
        db_manager = DatabaseManager()
        registry.register(DatabaseManager, db_manager)

        cache_service = CacheService(db_manager)  # DI via constructor
        registry.register(CacheService, cache_service)

        # Retrieve services
        db = registry.get(DatabaseManager)
        cache = registry.get(CacheService)

        # Start all services
        await registry.start_all()

        # Stop all services (reverse order)
        await registry.stop_all()
    """

    def __init__(self):
        self._services: Dict[Type, BaseService] = {}
        self._factories: Dict[Type, Callable[[], BaseService]] = {}
        self._start_order: List[Type] = []  # Track registration order

    def register(self, service_type: Type[T], instance: T) -> None:
        """
        Register a service instance.

        Args:
            service_type: Service class type
            instance: Service instance (must be subclass of BaseService)

        Raises:
            TypeError: If instance is not a BaseService
            ValueError: If service_type already registered
        """
        if not isinstance(instance, BaseService):
            raise TypeError(
                f"Service must inherit from BaseService, got {type(instance)}"
            )

        if service_type in self._services:
            logger.warning(
                f"Service {service_type.__name__} already registered, overwriting"
            )
        else:
            self._start_order.append(service_type)

        self._services[service_type] = instance
        logger.info(f"Registered service: {service_type.__name__}")

    def register_factory(
        self,
        service_type: Type[T],
        factory: Callable[[], T]
    ) -> None:
        """
        Register a service factory for lazy initialization.

        Factory will be called on first get() if service not yet instantiated.

        Args:
            service_type: Service class type
            factory: Factory function returning service instance
        """
        self._factories[service_type] = factory
        logger.info(f"Registered factory for: {service_type.__name__}")

    def get(self, service_type: Type[T]) -> T:
        """
        Get a service instance.

        Args:
            service_type: Service class type

        Returns:
            Service instance

        Raises:
            KeyError: If service not registered and no factory available
        """
        # Return existing instance
        if service_type in self._services:
            return self._services[service_type]

        # Create from factory
        if service_type in self._factories:
            instance = self._factories[service_type]()
            self.register(service_type, instance)
            return instance

        raise KeyError(
            f"Service {service_type.__name__} not registered. "
            f"Available services: {list(s.__name__ for s in self._services.keys())}"
        )

    def has(self, service_type: Type[T]) -> bool:
        """Check if service is registered."""
        return service_type in self._services or service_type in self._factories

    async def start_all(self) -> None:
        """Start all registered services in registration order."""
        logger.info("Starting all services...")

        for service_type in self._start_order:
            service = self._services[service_type]
            logger.info(f"Starting {service_type.__name__}...")

            try:
                await service.start()
                logger.info(f"✓ {service_type.__name__} started")
            except Exception as e:
                logger.error(
                    f"✗ {service_type.__name__} failed to start: {e}",
                    exc_info=True
                )
                # Stop already-started services
                await self._stop_started_services(service_type)
                raise RuntimeError(f"Service startup failed: {service_type.__name__}") from e

        logger.info("All services started successfully")

    async def stop_all(self) -> None:
        """Stop all registered services in reverse registration order."""
        logger.info("Stopping all services...")

        # Stop in reverse order
        for service_type in reversed(self._start_order):
            if service_type not in self._services:
                continue

            service = self._services[service_type]
            logger.info(f"Stopping {service_type.__name__}...")

            try:
                await service.stop()
                logger.info(f"✓ {service_type.__name__} stopped")
            except Exception as e:
                logger.error(
                    f"✗ {service_type.__name__} failed to stop cleanly: {e}",
                    exc_info=True
                )
                # Continue stopping other services

        logger.info("All services stopped")

    async def health_check_all(self) -> Dict[str, ServiceHealth]:
        """
        Check health of all services.

        Returns:
            Dict mapping service name to health status
        """
        health_results = {}

        for service_type in self._start_order:
            if service_type not in self._services:
                continue

            service = self._services[service_type]
            service_name = service_type.__name__

            try:
                health = await service.health_check()
                health_results[service_name] = health
            except Exception as e:
                logger.error(f"Health check failed for {service_name}: {e}")
                health_results[service_name] = ServiceHealth(
                    healthy=False,
                    state='error',
                    uptime_seconds=0.0,
                    last_health_check=datetime.utcnow(),
                    details={'error': str(e)}
                )

        return health_results

    async def _stop_started_services(self, failed_service_type: Type) -> None:
        """Stop services that were started before a failure."""
        failed_index = self._start_order.index(failed_service_type)

        for service_type in reversed(self._start_order[:failed_index]):
            service = self._services[service_type]
            try:
                await service.stop()
            except Exception as e:
                logger.error(f"Error stopping {service_type.__name__}: {e}")

    def clear(self) -> None:
        """Clear all services (useful for testing)."""
        self._services.clear()
        self._factories.clear()
        self._start_order.clear()
        logger.info("Service registry cleared")
```

**Evidence:**
- Addresses Antipattern 1 (inconsistent lifecycle)
- Addresses Antipattern 4 (global instances)
- Addresses F-0006 (service initialization)
- Addresses F-0007 (mixed threading)

---

## Event System

### WebSocket Manager (Async-First)

```python
# PATH: api/services/realtime/websocket.py (REFACTORED)
"""
WebSocket manager using pure async patterns.
Addresses Antipattern 2: Mixed Threading Model
"""

import asyncio
from typing import Dict, Set, Optional, Callable, Any
from fastapi import WebSocket
from datetime import datetime
import logging

from ..base import BaseService
from ...contracts.events import WebSocketEvent

logger = logging.getLogger(__name__)

class ConnectionState:
    """State for a single WebSocket connection."""

    def __init__(self, websocket: WebSocket, client_id: str):
        self.websocket = websocket
        self.client_id = client_id
        self.connected_at = datetime.utcnow()
        self.subscriptions: Set[str] = set()  # Topic subscriptions
        self.last_heartbeat = datetime.utcnow()

class WebSocketManager(BaseService):
    """
    Manages WebSocket connections and pub/sub messaging.

    Pure async implementation - no threading!
    """

    def __init__(self, ping_interval: int = 30):
        super().__init__()
        self._connections: Dict[str, ConnectionState] = {}
        self._topic_subscribers: Dict[str, Set[str]] = {}  # topic -> client_ids
        self._ping_interval = ping_interval
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._connection_lock = asyncio.Lock()

    async def start(self) -> None:
        """Start the WebSocket manager."""
        await self._set_state('starting')
        logger.info("Starting WebSocket manager...")

        # Start heartbeat task
        self._heartbeat_task = asyncio.create_task(self._heartbeat_worker())

        await self._set_state('running')
        logger.info("WebSocket manager started")

    async def stop(self) -> None:
        """Stop the WebSocket manager and close all connections."""
        await self._set_state('stopping')
        logger.info("Stopping WebSocket manager...")

        # Cancel heartbeat task
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
            try:
                await asyncio.wait_for(self._heartbeat_task, timeout=5.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass

        # Close all connections
        await self._close_all_connections()

        await self._set_state('stopped')
        logger.info("WebSocket manager stopped")

    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """Register a new WebSocket connection."""
        await websocket.accept()

        async with self._connection_lock:
            self._connections[client_id] = ConnectionState(websocket, client_id)
            logger.info(f"Client {client_id} connected (total: {len(self._connections)})")

    async def disconnect(self, client_id: str) -> None:
        """Remove a WebSocket connection."""
        async with self._connection_lock:
            if client_id in self._connections:
                connection = self._connections[client_id]

                # Remove from all topics
                for topic in connection.subscriptions:
                    if topic in self._topic_subscribers:
                        self._topic_subscribers[topic].discard(client_id)

                del self._connections[client_id]
                logger.info(f"Client {client_id} disconnected (remaining: {len(self._connections)})")

    async def subscribe(self, client_id: str, topic: str) -> None:
        """Subscribe a client to a topic."""
        async with self._connection_lock:
            if client_id not in self._connections:
                raise ValueError(f"Client {client_id} not connected")

            connection = self._connections[client_id]
            connection.subscriptions.add(topic)

            if topic not in self._topic_subscribers:
                self._topic_subscribers[topic] = set()
            self._topic_subscribers[topic].add(client_id)

            logger.debug(f"Client {client_id} subscribed to '{topic}'")

    async def publish(self, topic: str, event: WebSocketEvent) -> int:
        """
        Publish an event to all subscribers of a topic.

        Returns:
            Number of clients event was sent to
        """
        if topic not in self._topic_subscribers:
            return 0

        subscribers = list(self._topic_subscribers[topic])
        sent_count = 0

        event_json = event.model_dump_json()  # Serialize once

        for client_id in subscribers:
            if client_id in self._connections:
                try:
                    connection = self._connections[client_id]
                    await connection.websocket.send_text(event_json)
                    sent_count += 1
                except Exception as e:
                    logger.error(f"Error sending to {client_id}: {e}")
                    await self.disconnect(client_id)

        logger.debug(f"Published '{topic}' to {sent_count} clients")
        return sent_count

    async def send_to_client(self, client_id: str, event: WebSocketEvent) -> bool:
        """
        Send an event to a specific client.

        Returns:
            True if sent successfully, False otherwise
        """
        if client_id not in self._connections:
            return False

        try:
            connection = self._connections[client_id]
            event_json = event.model_dump_json()
            await connection.websocket.send_text(event_json)
            return True
        except Exception as e:
            logger.error(f"Error sending to {client_id}: {e}")
            await self.disconnect(client_id)
            return False

    async def _heartbeat_worker(self) -> None:
        """
        Background worker for sending heartbeats.

        Pure async - uses asyncio.sleep (NOT time.sleep).
        Cancellable at any point.
        """
        logger.info(f"Heartbeat worker started (interval: {self._ping_interval}s)")

        try:
            while self.is_running:
                await asyncio.sleep(self._ping_interval)

                # Send ping to all connected clients
                disconnected = []

                for client_id, connection in list(self._connections.items()):
                    try:
                        await connection.websocket.send_json({"type": "ping"})
                        connection.last_heartbeat = datetime.utcnow()
                    except Exception as e:
                        logger.warning(f"Heartbeat failed for {client_id}: {e}")
                        disconnected.append(client_id)

                # Clean up disconnected clients
                for client_id in disconnected:
                    await self.disconnect(client_id)

        except asyncio.CancelledError:
            logger.info("Heartbeat worker cancelled")
        except Exception as e:
            logger.error(f"Heartbeat worker error: {e}", exc_info=True)

    async def _close_all_connections(self) -> None:
        """Close all WebSocket connections gracefully."""
        client_ids = list(self._connections.keys())

        for client_id in client_ids:
            connection = self._connections[client_id]
            try:
                await connection.websocket.close(code=1001, reason="Server shutting down")
            except Exception as e:
                logger.warning(f"Error closing connection {client_id}: {e}")

            await self.disconnect(client_id)

    async def _get_health_details(self) -> Dict[str, Any]:
        """Get WebSocket-specific health details."""
        return {
            'connected_clients': len(self._connections),
            'active_topics': len(self._topic_subscribers),
            'ping_interval': self._ping_interval,
        }
```

**Evidence:**
- Addresses Antipattern 2 (mixed threading)
- Addresses F-0007 (blocking shutdown)
- Pure async/await throughout

---

## Caching Strategy

### Four-Tier Cache Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Cache Tiers                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  L1: Thread-Safe LRU (In-Process Memory)                     │
│  ├─ Capacity: 10,000 entries                                 │
│  ├─ TTL: 60 seconds                                          │
│  ├─ Eviction: LRU                                            │
│  └─ Use: Hot path, sub-millisecond access                    │
│                                                               │
│  L2: Redis (Distributed Cache)                               │
│  ├─ Capacity: 100,000 entries                                │
│  ├─ TTL: 300 seconds (5 minutes)                             │
│  ├─ Eviction: LRU                                            │
│  └─ Use: Cross-instance sharing, ~1ms access                 │
│                                                               │
│  L3: PostgreSQL Buffer Cache                                 │
│  ├─ Capacity: Configured in postgresql.conf                  │
│  ├─ TTL: Until evicted by Postgres                           │
│  ├─ Eviction: Postgres internal algorithm                    │
│  └─ Use: Frequently accessed rows, ~5ms access               │
│                                                               │
│  L4: Materialized Views                                      │
│  ├─ Capacity: Full dataset                                   │
│  ├─ TTL: Until REFRESH MATERIALIZED VIEW                     │
│  ├─ Eviction: Manual refresh only                            │
│  └─ Use: Complex aggregations, ~10ms access                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Hierarchy: L1 → L2 → L3 → L4 → Database
Cache Hit Path: Check L1 → Check L2 → Check L3/L4 → Query DB
Cache Miss: Query DB → Populate L4/L3/L2/L1 (bottom-up)
```

### Cache Key Strategy

```python
# PATH: api/services/cache/strategies.py (NEW FILE)
"""
Cache key generation strategies.
Ensures consistent, collision-free cache keys.
"""

import hashlib
import json
from typing import Any, Dict, Optional

class CacheKeyStrategy:
    """Generate consistent cache keys."""

    @staticmethod
    def hierarchy_query(
        parent_path: Optional[str],
        entity_types: Optional[list],
        max_depth: Optional[int]
    ) -> str:
        """
        Generate cache key for hierarchy query.

        Format: hierarchy:{hash}
        where hash = SHA256(parent_path:entity_types:max_depth)
        """
        components = [
            parent_path or 'root',
            ','.join(sorted(entity_types or [])),
            str(max_depth or 'all')
        ]
        key_data = ':'.join(components)
        key_hash = hashlib.sha256(key_data.encode()).hexdigest()[:16]

        return f"hierarchy:{key_hash}"

    @staticmethod
    def entity(entity_id: str) -> str:
        """Generate cache key for single entity."""
        return f"entity:{entity_id}"

    @staticmethod
    def feature_flag(flag_key: str) -> str:
        """Generate cache key for feature flag."""
        return f"flag:{flag_key}"

    @staticmethod
    def custom(prefix: str, params: Dict[str, Any]) -> str:
        """
        Generate cache key from custom parameters.

        Args:
            prefix: Key prefix (e.g., 'search', 'scenario')
            params: Dictionary of parameters (will be sorted for consistency)

        Returns:
            Cache key in format: {prefix}:{hash}
        """
        # Sort keys for consistent hashing
        sorted_params = json.dumps(params, sort_keys=True)
        key_hash = hashlib.sha256(sorted_params.encode()).hexdigest()[:16]

        return f"{prefix}:{key_hash}"
```

### Cache Invalidation Rules

```python
# PATH: api/services/cache/invalidation.py (NEW FILE)
"""
Cache invalidation strategies.
Ensures eventual consistency across cache tiers.
"""

from typing import List, Set, Optional
import logging

logger = logging.getLogger(__name__)

class InvalidationRule:
    """Base class for cache invalidation rules."""

    async def invalidate(self, cache_service: 'CacheService', **kwargs) -> int:
        """
        Invalidate cache entries.

        Returns:
            Number of entries invalidated
        """
        raise NotImplementedError


class EntityUpdateRule(InvalidationRule):
    """Invalidate cache when entity is updated."""

    async def invalidate(
        self,
        cache_service: 'CacheService',
        entity_id: str,
        entity_path: Optional[str] = None
    ) -> int:
        """
        Invalidate:
        1. Direct entity cache
        2. Hierarchy queries containing this entity
        3. Ancestor hierarchy queries (path affected)
        """
        keys_to_invalidate: Set[str] = set()

        # 1. Direct entity cache
        keys_to_invalidate.add(f"entity:{entity_id}")

        # 2. Hierarchy queries (pattern match)
        # All hierarchy queries must be invalidated as we don't know which ones contain this entity
        keys_to_invalidate.update(
            await cache_service.get_keys_by_pattern("hierarchy:*")
        )

        # 3. If path is known, invalidate ancestor paths
        if entity_path:
            ancestor_paths = self._get_ancestor_paths(entity_path)
            for path in ancestor_paths:
                # Invalidate queries for each ancestor
                keys_to_invalidate.update(
                    await cache_service.get_keys_by_pattern(f"hierarchy:*{path}*")
                )

        # Perform invalidation
        count = await cache_service.delete_many(list(keys_to_invalidate))

        logger.info(
            f"Entity {entity_id} updated: invalidated {count} cache entries"
        )

        return count

    def _get_ancestor_paths(self, ltree_path: str) -> List[str]:
        """
        Get all ancestor paths from an LTREE path.

        Example: 'world.asia.japan' → ['world', 'world.asia', 'world.asia.japan']
        """
        parts = ltree_path.split('.')
        paths = []

        for i in range(1, len(parts) + 1):
            paths.append('.'.join(parts[:i]))

        return paths


class FeatureFlagUpdateRule(InvalidationRule):
    """Invalidate cache when feature flag is updated."""

    async def invalidate(
        self,
        cache_service: 'CacheService',
        flag_key: str
    ) -> int:
        """
        Invalidate feature flag cache and trigger WebSocket notification.
        """
        key = f"flag:{flag_key}"
        count = await cache_service.delete(key)

        logger.info(f"Feature flag {flag_key} updated: invalidated cache")

        return count


class MaterializedViewRefreshRule(InvalidationRule):
    """Invalidate L2 cache when materialized view is refreshed."""

    async def invalidate(
        self,
        cache_service: 'CacheService',
        view_name: str
    ) -> int:
        """
        When materialized view refreshes, invalidate related L2 Redis cache.
        L4 (materialized view) is now fresh, so L2 should be cleared.
        """
        # Hierarchy materialized view refresh → invalidate all hierarchy queries
        if view_name == 'hierarchy_mv':
            keys = await cache_service.get_keys_by_pattern("hierarchy:*")
            count = await cache_service.delete_many(keys)

            logger.info(
                f"Materialized view {view_name} refreshed: "
                f"invalidated {count} L2 cache entries"
            )

            return count

        return 0
```

**Evidence:**
- Maintains 99.2% cache hit rate (current system achievement)
- Addresses observability with invalidation logging
- Clear separation of cache tiers
- Consistent key generation prevents collisions

---

## Observability

### Structured Logging

```python
# PATH: api/services/observability/logging.py (NEW FILE)
"""
Structured logging with correlation ID tracking.
Replaces console.log/warn/error with proper logging.

Addresses:
- F-0010: Production console.warn pollution
- F-0011: No production error monitoring
"""

import logging
import structlog
from typing import Any, Dict, Optional
from contextvars import ContextVar
import orjson

# Context variable for correlation ID (thread-safe in async)
correlation_id_var: ContextVar[Optional[str]] = ContextVar(
    'correlation_id',
    default=None
)

def setup_logging(
    level: str = 'INFO',
    json_logs: bool = True,
    include_timestamp: bool = True
) -> None:
    """
    Setup structured logging for the application.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_logs: If True, output JSON logs (for production)
        include_timestamp: Include ISO timestamp in logs
    """
    structlog.configure(
        processors=[
            # Add correlation ID to every log
            add_correlation_id,
            # Add log level
            structlog.stdlib.add_log_level,
            # Add timestamp
            structlog.processors.TimeStamper(fmt="iso") if include_timestamp else lambda _, __, event_dict: event_dict,
            # Add stack info for errors
            structlog.processors.StackInfoRenderer(),
            # Format exceptions
            structlog.processors.format_exc_info,
            # JSON renderer for production, pretty console for development
            structlog.processors.JSONRenderer(serializer=orjson.dumps) if json_logs else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Set logging level
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, level.upper()),
    )


def add_correlation_id(
    logger: Any,
    method_name: str,
    event_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Add correlation ID to log event if present in context.

    Correlation ID flows through:
    1. HTTP request header: X-Correlation-ID
    2. Set in context variable
    3. Added to all logs in request context
    4. Returned in response header
    5. Included in WebSocket events
    """
    correlation_id = correlation_id_var.get()
    if correlation_id:
        event_dict['correlation_id'] = correlation_id

    return event_dict


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.

    Usage:
        logger = get_logger(__name__)
        logger.info("user_logged_in", user_id=user.id, duration_ms=123)

    Output (JSON):
        {
            "event": "user_logged_in",
            "user_id": "abc-123",
            "duration_ms": 123,
            "level": "info",
            "timestamp": "2025-11-09T05:21:00.123Z",
            "correlation_id": "req-456"
        }
    """
    return structlog.get_logger(name)


# Convenience functions for common patterns
def log_api_request(
    method: str,
    path: str,
    query_params: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None
) -> None:
    """Log incoming API request."""
    logger = get_logger('api.request')
    logger.info(
        "api_request_received",
        method=method,
        path=path,
        query_params=query_params or {},
        user_id=user_id
    )


def log_api_response(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    user_id: Optional[str] = None
) -> None:
    """Log outgoing API response."""
    logger = get_logger('api.response')

    # Use different log levels based on status code
    if status_code >= 500:
        log_func = logger.error
    elif status_code >= 400:
        log_func = logger.warning
    else:
        log_func = logger.info

    log_func(
        "api_response_sent",
        method=method,
        path=path,
        status_code=status_code,
        duration_ms=duration_ms,
        user_id=user_id
    )


def log_database_query(
    query_type: str,
    table: str,
    duration_ms: float,
    rows_affected: Optional[int] = None
) -> None:
    """Log database query performance."""
    logger = get_logger('database')
    logger.debug(
        "database_query",
        query_type=query_type,
        table=table,
        duration_ms=duration_ms,
        rows_affected=rows_affected
    )


def log_cache_operation(
    operation: str,
    cache_tier: str,
    key: str,
    hit: bool,
    duration_ms: Optional[float] = None
) -> None:
    """Log cache operation."""
    logger = get_logger('cache')
    logger.debug(
        "cache_operation",
        operation=operation,
        cache_tier=cache_tier,
        key=key,
        hit=hit,
        duration_ms=duration_ms
    )
```

### Correlation ID Middleware

```python
# PATH: api/middleware/correlation_id.py (NEW FILE)
"""
Correlation ID middleware for request tracing.
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import uuid
from services.observability.logging import correlation_id_var

class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add correlation ID to all requests.

    Flow:
    1. Check for X-Correlation-ID header in request
    2. Generate new UUID if not present
    3. Set in context variable (available to all logs)
    4. Add to response headers
    """

    async def dispatch(self, request: Request, call_next):
        # Get correlation ID from header or generate new one
        correlation_id = request.headers.get('X-Correlation-ID')
        if not correlation_id:
            correlation_id = f"req-{uuid.uuid4().hex[:16]}"

        # Set in context variable
        correlation_id_var.set(correlation_id)

        # Process request
        response = await call_next(request)

        # Add to response headers
        response.headers['X-Correlation-ID'] = correlation_id

        return response
```

**Evidence:**
- Addresses F-0010 (console.warn pollution)
- Addresses F-0011 (no error monitoring)
- Enables distributed tracing
- JSON logs for production parsing

---

## Performance SLOs

### Service Level Objectives

```yaml
# PATH: config/slo.yaml (NEW FILE)
# Service Level Objectives for Forecastin
# All targets based on current system achievements (see 01_INVENTORY.md)

api:
  throughput:
    target: 40000  # requests/second
    threshold: 35000  # alert if below this
    measurement: rolling_1min

  latency:
    p50_ms: 10
    p95_ms: 50
    p99_ms: 100
    measurement: rolling_1min

  availability:
    target_percent: 99.9  # 3 nines
    measurement: rolling_30day

database:
  ancestor_resolution:
    target_ms: 10
    threshold_ms: 20  # alert if above
    measurement: per_query

  materialized_view_refresh:
    target_ms: 1000
    threshold_ms: 2000
    measurement: per_refresh

  connection_pool:
    target_utilization_percent: 70
    max_utilization_percent: 90

cache:
  hit_rate:
    target_percent: 99.0
    threshold_percent: 95.0
    measurement: rolling_5min

  l1_latency_ms: 1
  l2_latency_ms: 5
  l3_latency_ms: 10

websocket:
  serialization:
    target_ms: 1
    threshold_ms: 5
    measurement: per_message

  message_delivery:
    target_ms: 10
    threshold_ms: 50
    measurement: end_to_end

  connection_count:
    max_connections: 10000
    warning_threshold: 8000
```

### Performance Budgets

**Bundle Size Budgets (Frontend):**
```json
{
  "budgets": [
    {
      "path": "frontend/build/static/js/main.*.js",
      "maxSize": "250 kB",
      "warning": "200 kB"
    },
    {
      "path": "frontend/build/static/js/vendor.*.js",
      "maxSize": "500 kB",
      "warning": "400 kB"
    },
    {
      "path": "frontend/build/static/css/*.css",
      "maxSize": "50 kB",
      "warning": "40 kB"
    }
  ],
  "firstContentfulPaint": "1500ms",
  "interactive": "3000ms",
  "totalPageSize": "1 MB"
}
```

**Evidence:**
- Based on measured performance (42,726 RPS, 3.46ms queries)
- 99.2% cache hit rate as target
- All SLOs achievable (proven by current system)

---

## Security Architecture

### Threat Model

```
┌─────────────────────────────────────────────────────────────┐
│                        Threat Surfaces                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. API Endpoints                                            │
│     Threats: SQL injection, XSS, CSRF, injection attacks     │
│     Mitigations: Input validation, parameterized queries,    │
│                  CORS, rate limiting                         │
│                                                               │
│  2. WebSocket Connections                                    │
│     Threats: Message injection, DoS, unauthorized access     │
│     Mitigations: Message schema validation, connection       │
│                  limits, authentication                      │
│                                                               │
│  3. Database                                                 │
│     Threats: SQL injection, privilege escalation             │
│     Mitigations: Parameterized queries, principle of         │
│                  least privilege, connection encryption      │
│                                                               │
│  4. Dependencies                                             │
│     Threats: Known vulnerabilities, supply chain attacks     │
│     Mitigations: Automated scanning (Dependabot, Snyk),      │
│                  lock files, SBOM generation                 │
│                                                               │
│  5. Secrets Management                                       │
│     Threats: Hardcoded credentials, leaked secrets           │
│     Mitigations: Environment variables, secrets scanning,    │
│                  rotation policies                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Input Validation

```python
# PATH: api/utils/validation.py (NEW FILE)
"""
Input validation utilities.
Prevents SQL injection, XSS, and other injection attacks.
"""

import re
from typing import Optional
from pydantic import BaseModel, field_validator, ValidationError

class SafeLTreePath(BaseModel):
    """Validates LTREE path to prevent injection."""

    path: str

    @field_validator('path')
    @classmethod
    def validate_ltree_path(cls, v: str) -> str:
        """
        Validate LTREE path format.

        Rules:
        - Only alphanumeric, underscores, and dots
        - No consecutive dots
        - No leading/trailing dots
        - Max 255 characters
        """
        if not v:
            raise ValueError("LTREE path cannot be empty")

        if len(v) > 255:
            raise ValueError("LTREE path too long (max 255 characters)")

        # Check format: word.word.word (alphanumeric + underscore)
        pattern = r'^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$'
        if not re.match(pattern, v):
            raise ValueError(
                "LTREE path must contain only alphanumeric, underscores, "
                "and dots (no consecutive/leading/trailing dots)"
            )

        return v


def sanitize_sql_identifier(identifier: str) -> str:
    """
    Sanitize SQL identifier (table name, column name).

    DO NOT use for values - use parameterized queries for those!

    Only for cases where identifier must be dynamic (e.g., ORDER BY column).
    """
    # Whitelist: alphanumeric and underscores only
    if not re.match(r'^[a-zA-Z0-9_]+$', identifier):
        raise ValueError(
            f"Invalid SQL identifier: {identifier}. "
            f"Must contain only alphanumeric and underscores."
        )

    return identifier


def validate_uuid(value: str) -> str:
    """Validate UUID format."""
    uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

    if not re.match(uuid_pattern, value.lower()):
        raise ValueError(f"Invalid UUID format: {value}")

    return value.lower()
```

**Evidence:**
- Addresses F-0002 (hardcoded credentials)
- Prevents SQL injection
- Input validation at API boundary

---

## Summary

This target architecture addresses all critical findings and antipatterns:

| Finding/Antipattern | Solution | File |
|---------------------|----------|------|
| F-0001: Missing exports | Improved contract generator | contracts/geometry.py, generated.ts |
| F-0002: Hardcoded credentials | Environment variable enforcement | utils/security.py |
| F-0003: Schema mismatches | Pydantic validation | contracts/events.py |
| F-0004: Type loss | Full Pydantic→TS fidelity | contracts/geometry.py → generated.ts |
| F-0005: Missing properties | Complete response schemas | contracts/responses.py |
| F-0006: Service patterns | BaseService ABC | services/base.py |
| F-0007: Threading | Pure async implementation | services/realtime/websocket.py |
| F-0008: Unused flags | Feature gate HOC | components/FeatureGate/ |
| F-0010, F-0011: Logging | Structured logging + Sentry | observability/logging.py |
| Antipattern 1 | Standard lifecycle | services/base.py |
| Antipattern 2 | Async-only | services/realtime/websocket.py |
| Antipattern 3 | Improved generator | scripts/dev/generate_contracts_v2.py |
| Antipattern 4 | Service registry | services/registry.py |

**Next Steps:** See 05_REBUILD_PLAN.md for phased implementation strategy.
