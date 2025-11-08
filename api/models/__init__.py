"""
Models package for Forecastin API

Contains Pydantic models for request/response validation
"""

from .websocket_schemas import (
    # Base types
    BoundingBox,
    MessageMeta,

    # Geometry types
    PointGeometry,
    LineStringGeometry,
    PolygonGeometry,
    MultiPolygonGeometry,
    MultiLineStringGeometry,
    Geometry,

    # Feature types
    GeoJSONFeature,
    FeatureCollection,

    # Layer types
    LayerType,
    LayerDataUpdatePayload,

    # Filter types
    FilterType,
    FilterStatus,
    TemporalFilter,
    FilterParams,
    GPUFilterSyncPayload,

    # Message types
    MessageType,
    BaseWebSocketMessage,
    PingMessage,
    PongMessage,
    LayerDataUpdateMessage,
    GPUFilterSyncMessage,
    ErrorMessage,
    EchoMessage,
    WebSocketMessage,

    # Validation helpers
    validate_websocket_message,
    validate_outgoing_message,
)

__all__ = [
    # Base types
    'BoundingBox',
    'MessageMeta',

    # Geometry types
    'PointGeometry',
    'LineStringGeometry',
    'PolygonGeometry',
    'MultiPolygonGeometry',
    'MultiLineStringGeometry',
    'Geometry',

    # Feature types
    'GeoJSONFeature',
    'FeatureCollection',

    # Layer types
    'LayerType',
    'LayerDataUpdatePayload',

    # Filter types
    'FilterType',
    'FilterStatus',
    'TemporalFilter',
    'FilterParams',
    'GPUFilterSyncPayload',

    # Message types
    'MessageType',
    'BaseWebSocketMessage',
    'PingMessage',
    'PongMessage',
    'LayerDataUpdateMessage',
    'GPUFilterSyncMessage',
    'ErrorMessage',
    'EchoMessage',
    'WebSocketMessage',

    # Validation helpers
    'validate_websocket_message',
    'validate_outgoing_message',
]
