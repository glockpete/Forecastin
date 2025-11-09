"""
AUTO-GENERATED PYDANTIC SCHEMAS FOR WEBSOCKET MESSAGE VALIDATION

Generated to match frontend Zod schemas from:
- frontend/src/types/contracts.generated.ts
- frontend/src/types/ws_messages.ts

These schemas provide backend validation matching frontend TypeScript types.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Tuple, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ============================================================================
# Base Types
# ============================================================================

class BoundingBox(BaseModel):
    """Bounding box for spatial queries"""
    model_config = ConfigDict(extra='forbid')

    min_lat: float = Field(..., ge=-90, le=90, alias='minLat')
    max_lat: float = Field(..., ge=-90, le=90, alias='maxLat')
    min_lng: float = Field(..., ge=-180, le=180, alias='minLng')
    max_lng: float = Field(..., ge=-180, le=180, alias='maxLng')


# Position type: [longitude, latitude, altitude?]
Position = Tuple[float, float, Optional[float]]

# Color type: [r, g, b, a]
Color = Tuple[int, int, int, int]


# ============================================================================
# GeoJSON Geometry Types
# ============================================================================

class PointGeometry(BaseModel):
    """GeoJSON Point geometry"""
    model_config = ConfigDict(extra='forbid')

    type: Literal['Point']
    coordinates: Tuple[float, float] | Tuple[float, float, float]


class LineStringGeometry(BaseModel):
    """GeoJSON LineString geometry"""
    model_config = ConfigDict(extra='forbid')

    type: Literal['LineString']
    coordinates: List[Tuple[float, float] | Tuple[float, float, float]]

    @field_validator('coordinates')
    @classmethod
    def validate_min_points(cls, v):
        if len(v) < 2:
            raise ValueError('LineString must have at least 2 points')
        return v


class PolygonGeometry(BaseModel):
    """GeoJSON Polygon geometry"""
    model_config = ConfigDict(extra='forbid')

    type: Literal['Polygon']
    coordinates: List[List[Tuple[float, float] | Tuple[float, float, float]]]

    @field_validator('coordinates')
    @classmethod
    def validate_rings(cls, v):
        for ring in v:
            if len(ring) < 4:
                raise ValueError('Polygon ring must have at least 4 points (closed ring)')
        return v


class MultiPolygonGeometry(BaseModel):
    """GeoJSON MultiPolygon geometry"""
    model_config = ConfigDict(extra='forbid')

    type: Literal['MultiPolygon']
    coordinates: List[List[List[Tuple[float, float] | Tuple[float, float, float]]]]


class MultiLineStringGeometry(BaseModel):
    """GeoJSON MultiLineString geometry"""
    model_config = ConfigDict(extra='forbid')

    type: Literal['MultiLineString']
    coordinates: List[List[Tuple[float, float] | Tuple[float, float, float]]]


# Union type for all geometries
Geometry = Union[
    PointGeometry,
    LineStringGeometry,
    PolygonGeometry,
    MultiPolygonGeometry,
    MultiLineStringGeometry
]


# ============================================================================
# GeoJSON Feature Types
# ============================================================================

class GeoJSONFeature(BaseModel):
    """GeoJSON Feature"""
    model_config = ConfigDict(extra='forbid')

    type: Literal['Feature']
    geometry: Geometry
    properties: Optional[Dict[str, Any]] = None
    id: Optional[Union[str, int]] = None


class FeatureCollection(BaseModel):
    """GeoJSON FeatureCollection"""
    model_config = ConfigDict(extra='forbid')

    type: Literal['FeatureCollection']
    features: List[GeoJSONFeature]


# ============================================================================
# Message Metadata
# ============================================================================

class MessageMeta(BaseModel):
    """Metadata for WebSocket messages"""
    model_config = ConfigDict(extra='forbid')

    timestamp: float
    sequence: Optional[int] = Field(None, ge=0)
    client_id: Optional[str] = Field(None, alias='clientId')
    session_id: Optional[str] = Field(None, alias='sessionId')


# ============================================================================
# Layer Types
# ============================================================================

class LayerType(str, Enum):
    """Supported layer types"""
    POINT = 'point'
    POLYGON = 'polygon'
    LINE = 'line'
    LINESTRING = 'linestring'
    HEATMAP = 'heatmap'
    CLUSTER = 'cluster'
    GEOJSON = 'geojson'


class LayerDataUpdatePayload(BaseModel):
    """Payload for LAYER_DATA_UPDATE message"""
    model_config = ConfigDict(extra='forbid')

    layer_id: str = Field(..., min_length=1)
    layer_type: LayerType
    layer_data: FeatureCollection
    bbox: Optional[BoundingBox] = None
    changed_at: float


# ============================================================================
# Filter Types
# ============================================================================

class FilterType(str, Enum):
    """Filter types"""
    SPATIAL = 'spatial'
    TEMPORAL = 'temporal'
    ATTRIBUTE = 'attribute'
    COMPOSITE = 'composite'


class FilterStatus(str, Enum):
    """Filter status"""
    APPLIED = 'applied'
    PENDING = 'pending'
    ERROR = 'error'
    CLEARED = 'cleared'


class TemporalFilter(BaseModel):
    """Temporal filter with ISO8601 timestamps"""
    model_config = ConfigDict(extra='forbid')

    start: str  # ISO8601 format
    end: str    # ISO8601 format

    @field_validator('start', 'end')
    @classmethod
    def validate_iso8601(cls, v):
        # Basic ISO8601 validation
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
        except ValueError:
            raise ValueError('Timestamp must be in ISO8601 format')
        return v


class FilterParams(BaseModel):
    """Parameters for GPU filtering"""
    model_config = ConfigDict(extra='forbid')

    bounds: Optional[BoundingBox] = None
    temporal: Optional[TemporalFilter] = None
    attributes: Optional[Dict[str, Any]] = None


class GPUFilterSyncPayload(BaseModel):
    """Payload for GPU_FILTER_SYNC message"""
    model_config = ConfigDict(extra='forbid')

    filter_id: str = Field(..., min_length=1)
    filter_type: FilterType
    filter_params: FilterParams
    affected_layers: List[str] = Field(default_factory=list)
    status: FilterStatus
    changed_at: float


# ============================================================================
# WebSocket Message Types
# ============================================================================

class MessageType(str, Enum):
    """WebSocket message types"""
    PING = 'ping'
    PONG = 'pong'
    LAYER_DATA_UPDATE = 'layer_data_update'
    GPU_FILTER_SYNC = 'gpu_filter_sync'
    POLYGON_UPDATE = 'polygon_update'
    LINESTRING_UPDATE = 'linestring_update'
    SEARCH_UPDATE = 'search_update'
    ERROR = 'error'
    ECHO = 'echo'


class BaseWebSocketMessage(BaseModel):
    """Base WebSocket message structure"""
    model_config = ConfigDict(extra='allow')  # Allow extra fields for extensibility

    type: MessageType
    timestamp: float
    client_id: Optional[str] = Field(None, alias='clientId')
    meta: Optional[MessageMeta] = None


class PingMessage(BaseWebSocketMessage):
    """Ping message for keepalive"""
    type: Literal[MessageType.PING]


class PongMessage(BaseWebSocketMessage):
    """Pong response message"""
    type: Literal[MessageType.PONG]


class LayerDataUpdateMessage(BaseWebSocketMessage):
    """Layer data update message"""
    type: Literal[MessageType.LAYER_DATA_UPDATE]
    data: LayerDataUpdatePayload


class GPUFilterSyncMessage(BaseWebSocketMessage):
    """GPU filter sync message"""
    type: Literal[MessageType.GPU_FILTER_SYNC]
    data: GPUFilterSyncPayload


class ErrorMessage(BaseWebSocketMessage):
    """Error message"""
    type: Literal[MessageType.ERROR]
    error: str
    details: Optional[Dict[str, Any]] = None


class EchoMessage(BaseWebSocketMessage):
    """Echo message for testing"""
    type: Literal[MessageType.ECHO]
    data: Any


# Union type for all WebSocket messages
WebSocketMessage = Union[
    PingMessage,
    PongMessage,
    LayerDataUpdateMessage,
    GPUFilterSyncMessage,
    ErrorMessage,
    EchoMessage
]


# ============================================================================
# Validation Helper Functions
# ============================================================================

def validate_websocket_message(data: Dict[str, Any]) -> BaseWebSocketMessage:
    """
    Validate incoming WebSocket message against schemas.

    Args:
        data: Raw message data from WebSocket

    Returns:
        Validated message model

    Raises:
        ValueError: If message validation fails
    """
    message_type = data.get('type')

    if not message_type:
        raise ValueError("Message must have a 'type' field")

    # Route to appropriate validator based on message type
    validators = {
        'ping': PingMessage,
        'pong': PongMessage,
        'layer_data_update': LayerDataUpdateMessage,
        'gpu_filter_sync': GPUFilterSyncMessage,
        'error': ErrorMessage,
        'echo': EchoMessage,
    }

    validator_class = validators.get(message_type)

    if not validator_class:
        raise ValueError(f"Unknown message type: {message_type}")

    try:
        return validator_class(**data)
    except Exception as e:
        raise ValueError(f"Message validation failed for type '{message_type}': {str(e)}")


def validate_outgoing_message(message: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate outgoing message before sending to client.

    Args:
        message: Message dictionary to validate

    Returns:
        Validated message dictionary

    Raises:
        ValueError: If validation fails
    """
    validated = validate_websocket_message(message)
    return validated.model_dump(by_alias=True, exclude_none=True)
