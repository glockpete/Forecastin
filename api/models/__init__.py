"""
Models package for Forecastin API

Contains Pydantic models for request/response validation
"""

from .websocket_schemas import (
    BaseWebSocketMessage,
    # Base types
    BoundingBox,
    EchoMessage,
    ErrorMessage,
    FeatureCollection,
    FilterParams,
    FilterStatus,
    # Filter types
    FilterType,
    # Feature types
    GeoJSONFeature,
    Geometry,
    GPUFilterSyncMessage,
    GPUFilterSyncPayload,
    LayerDataUpdateMessage,
    LayerDataUpdatePayload,
    # Layer types
    LayerType,
    LineStringGeometry,
    MessageMeta,
    # Message types
    MessageType,
    MultiLineStringGeometry,
    MultiPolygonGeometry,
    PingMessage,
    # Geometry types
    PointGeometry,
    PolygonGeometry,
    PongMessage,
    TemporalFilter,
    WebSocketMessage,
    validate_outgoing_message,
    # Validation helpers
    validate_websocket_message,
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
