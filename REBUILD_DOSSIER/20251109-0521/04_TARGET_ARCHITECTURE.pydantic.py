"""
Canonical Pydantic Contract Definitions

These are the definitive Python contracts for Forecastin API.
TypeScript types are auto-generated from these definitions.

Evidence: Addresses F-0004, F-0001, F-0003, F-0005 from 02_FINDINGS.md
Version: 1.0
Status: @experimental (target architecture)

DO NOT modify without updating TypeScript generation and tests.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Union, Literal, Tuple, Annotated, Generic, TypeVar
from pydantic import BaseModel, Field, field_validator, ConfigDict
from enum import Enum

# ============================================================================
# Base Types
# ============================================================================

# Type aliases for coordinate types (fully typed - not 'any'!)
Coordinate2D = Tuple[float, float]
Coordinate3D = Tuple[float, float, float]
Coordinate = Annotated[
    Union[Coordinate2D, Coordinate3D],
    Field(description="[longitude, latitude] or [lon, lat, altitude]")
]

# RGBA color type
Color = Tuple[int, int, int, int]


# ============================================================================
# GeoJSON Geometry Types (Full Type Fidelity)
# ============================================================================

class PointGeometry(BaseModel):
    """
    GeoJSON Point geometry with proper typing.

    Example:
        ```python
        point = PointGeometry(
            type='Point',
            coordinates=(-122.4194, 37.7749)  # San Francisco
        )
        ```
    """

    type: Literal['Point']
    coordinates: Coordinate

    model_config = ConfigDict(extra='forbid')


class LineStringGeometry(BaseModel):
    """
    GeoJSON LineString geometry.
    Minimum 2 points required.
    """

    type: Literal['LineString']
    coordinates: Annotated[List[Coordinate], Field(min_length=2)]

    model_config = ConfigDict(extra='forbid')

    @field_validator('coordinates')
    @classmethod
    def validate_minimum_points(cls, v: List[Coordinate]) -> List[Coordinate]:
        if len(v) < 2:
            raise ValueError('LineString must have at least 2 points')
        return v


class PolygonGeometry(BaseModel):
    """
    GeoJSON Polygon geometry with ring validation.

    coordinates[0] = exterior ring
    coordinates[1..n] = holes (optional)

    Each ring must be closed (first point == last point).
    """

    type: Literal['Polygon']
    coordinates: Annotated[
        List[List[Coordinate]],
        Field(description="Array of rings (first is exterior, rest are holes)")
    ]

    model_config = ConfigDict(extra='forbid')

    @field_validator('coordinates')
    @classmethod
    def validate_rings(cls, v: List[List[Coordinate]]) -> List[List[Coordinate]]:
        for i, ring in enumerate(v):
            if len(ring) < 4:
                raise ValueError(f'Ring {i} must have at least 4 points (closed ring)')

            # Validate ring is closed (first point == last point)
            if ring[0] != ring[-1]:
                raise ValueError(f'Ring {i} must be closed (first point must equal last)')

        return v


class MultiPointGeometry(BaseModel):
    """GeoJSON MultiPoint geometry."""

    type: Literal['MultiPoint']
    coordinates: List[Coordinate]

    model_config = ConfigDict(extra='forbid')


class MultiLineStringGeometry(BaseModel):
    """GeoJSON MultiLineString geometry."""

    type: Literal['MultiLineString']
    coordinates: List[List[Coordinate]]

    model_config = ConfigDict(extra='forbid')


class MultiPolygonGeometry(BaseModel):
    """GeoJSON MultiPolygon geometry."""

    type: Literal['MultiPolygon']
    coordinates: List[List[List[Coordinate]]]

    model_config = ConfigDict(extra='forbid')


# Union type for all geometries (discriminated by 'type')
Geometry = Annotated[
    Union[
        PointGeometry,
        LineStringGeometry,
        PolygonGeometry,
        MultiPointGeometry,
        MultiLineStringGeometry,
        MultiPolygonGeometry,
    ],
    Field(discriminator='type')
]


# ============================================================================
# Request Contracts
# ============================================================================

class HierarchyQueryRequest(BaseModel):
    """
    Request for hierarchical entity query.

    Example:
        ```python
        request = HierarchyQueryRequest(
            parent_path='world.asia.japan',
            entity_types=['city', 'prefecture'],
            max_depth=2,
            offset=0,
            limit=100
        )
        ```
    """

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
        description="Maximum depth to traverse (1-10)"
    )

    bbox: Optional[Geometry] = Field(
        None,
        description="Spatial bounding box filter"
    )

    offset: int = Field(0, ge=0, description="Pagination offset")
    limit: int = Field(100, ge=1, le=1000, description="Pagination limit")

    model_config = ConfigDict(extra='forbid')


class EntityCreateRequest(BaseModel):
    """
    Request to create a new entity.
    """

    name: str = Field(..., min_length=1, max_length=255, description="Entity name")
    entity_type: str = Field(..., min_length=1, description="Entity type")
    description: Optional[str] = Field(None, description="Optional description")
    parent_id: Optional[str] = Field(None, description="Parent entity UUID")
    location: Optional[Geometry] = Field(None, description="Geospatial location")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Flexible metadata")
    confidence_score: float = Field(0.0, ge=0.0, le=1.0, description="Confidence score (0.0-1.0)")

    model_config = ConfigDict(extra='forbid')


# ============================================================================
# Response Contracts (Addresses F-0005: complete schemas)
# ============================================================================

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    """
    Standard paginated response wrapper.
    Generic type for any paginated list.
    """

    items: List[T] = Field(..., description="Array of items")
    total: int = Field(..., ge=0, description="Total count across all pages")
    offset: int = Field(..., ge=0, description="Current offset")
    limit: int = Field(..., ge=1, description="Current limit")
    has_more: bool = Field(..., description="True if more items available")

    model_config = ConfigDict(extra='forbid')


class EntityResponse(BaseModel):
    """
    Single entity response.

    ADDRESSES F-0005: Includes `children_count` property.
    """

    id: str = Field(..., description="Entity UUID")
    name: str = Field(..., description="Entity name")
    entity_type: str = Field(..., description="Entity type")
    description: Optional[str] = Field(None, description="Description")
    path: str = Field(..., description="LTREE path as string")
    path_depth: int = Field(..., description="Pre-computed path depth")
    location: Optional[Dict[str, Any]] = Field(None, description="GeoJSON location")
    confidence_score: float = Field(..., description="Confidence score (0.0-1.0)")

    # ADDED to address F-0005 (missing property causing compilation errors)
    children_count: int = Field(..., description="Number of direct children")

    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = ConfigDict(extra='forbid')


class HierarchyResponse(BaseModel):
    """
    Hierarchical entity query response.

    ADDRESSES F-0005: Includes `entities` array.
    """

    # ADDED to address F-0005 (missing property causing 6 compilation errors)
    entities: List[EntityResponse] = Field(..., description="Array of entities")

    total: int = Field(..., ge=0, description="Total count")
    has_more: bool = Field(..., description="True if more results available")

    # Pagination metadata
    offset: int = Field(..., ge=0)
    limit: int = Field(..., ge=1)

    # Query metadata
    parent_path: Optional[str] = Field(None, description="Parent path queried")
    max_depth_reached: bool = Field(..., description="True if max depth was reached")

    model_config = ConfigDict(extra='forbid')


# ============================================================================
# WebSocket Event Contracts (Versioned)
# ============================================================================

class BaseEvent(BaseModel):
    """
    Base event envelope with versioning.
    All WebSocket events must extend this class.
    """

    version: Literal['1.0'] = '1.0'
    event_id: str = Field(..., description="Unique event ID for idempotency")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")
    correlation_id: Optional[str] = Field(None, description="Correlation ID for request tracing")

    model_config = ConfigDict(extra='forbid')


class LayerUpdateEvent(BaseEvent):
    """
    Event sent when a geospatial layer updates.

    ADDRESSES F-0003: Includes required `layer_id` property
    (missing in test fixtures causing 8 test failures).
    """

    type: Literal['layer_update'] = 'layer_update'

    # REQUIRED - addresses F-0003 (test fixture schema mismatch)
    layer_id: str = Field(..., description="Layer identifier")

    action: Literal['add', 'update', 'remove'] = Field(..., description="Update action")
    features: List[Dict[str, Any]] = Field(..., description="GeoJSON features")
    affected_count: int = Field(..., description="Number of features affected")

    model_config = ConfigDict(extra='forbid')


class FeatureFlagUpdateEvent(BaseEvent):
    """
    Event sent when a feature flag changes.
    """

    type: Literal['feature_flag_update'] = 'feature_flag_update'

    flag_key: str = Field(..., description="Flag key (e.g., 'ff.map_v1')")
    enabled: bool = Field(..., description="Flag enabled status")
    rollout_percentage: int = Field(..., ge=0, le=100, description="Rollout percentage (0-100)")

    model_config = ConfigDict(extra='forbid')


class HierarchyInvalidationEvent(BaseEvent):
    """
    Event sent when hierarchy cache should be invalidated.
    """

    type: Literal['hierarchy_invalidation'] = 'hierarchy_invalidation'

    affected_paths: List[str] = Field(..., description="LTREE paths affected")
    reason: str = Field(..., description="Reason for invalidation")

    model_config = ConfigDict(extra='forbid')


# Union type for all events (discriminated by 'type')
WebSocketEvent = Annotated[
    Union[
        LayerUpdateEvent,
        FeatureFlagUpdateEvent,
        HierarchyInvalidationEvent,
    ],
    Field(discriminator='type')
]


# ============================================================================
# Constants
# ============================================================================

API_VERSION = "1.0"
MAX_LIMIT = 1000
DEFAULT_LIMIT = 100
MAX_HIERARCHY_DEPTH = 10


# ============================================================================
# Utility Functions (for consistency with TypeScript)
# ============================================================================

def get_confidence(entity: EntityResponse) -> float:
    """Get confidence score from entity."""
    return entity.confidence_score


def get_children_count(entity: EntityResponse) -> int:
    """Get children count from entity."""
    return entity.children_count


# ============================================================================
# Validation Examples (for documentation)
# ============================================================================

if __name__ == "__main__":
    # Example 1: Create a valid point geometry
    point = PointGeometry(
        type='Point',
        coordinates=(-122.4194, 37.7749)
    )
    print(f"Point: {point.model_dump_json()}")

    # Example 2: Create a hierarchy query
    query = HierarchyQueryRequest(
        parent_path='world.asia.japan',
        entity_types=['city'],
        max_depth=2,
        offset=0,
        limit=50
    )
    print(f"Query: {query.model_dump_json()}")

    # Example 3: Create a layer update event (with required layer_id)
    event = LayerUpdateEvent(
        event_id='evt-123',
        layer_id='layer-points',  # REQUIRED
        action='add',
        features=[],
        affected_count=0
    )
    print(f"Event: {event.model_dump_json()}")

    # Example 4: Validate polygon (should pass)
    valid_polygon = PolygonGeometry(
        type='Polygon',
        coordinates=[
            # Exterior ring (must be closed)
            [
                (-122.0, 37.0),
                (-121.0, 37.0),
                (-121.0, 38.0),
                (-122.0, 38.0),
                (-122.0, 37.0),  # Closed: same as first point
            ]
        ]
    )
    print(f"Valid polygon: {valid_polygon.model_dump_json()}")

    # Example 5: Try invalid polygon (will raise ValidationError)
    try:
        invalid_polygon = PolygonGeometry(
            type='Polygon',
            coordinates=[
                # Not closed!
                [
                    (-122.0, 37.0),
                    (-121.0, 37.0),
                    (-121.0, 38.0),
                    (-122.0, 38.0),
                    # Missing closing point!
                ]
            ]
        )
    except ValueError as e:
        print(f"Validation error (expected): {e}")

    print("\nAll contract examples validated successfully!")
