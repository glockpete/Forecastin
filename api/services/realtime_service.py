"""
Real-time service with WebSocket support and safe orjson serialization.

Implements the WebSocket patterns specified in AGENTS.md:
- orjson serialization for WebSocket payloads
- Thread-safe operations with RLock synchronization
- Error resilience with structured error handling
- Message batching for performance optimization
"""

import logging
import threading
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import orjson
from fastapi import WebSocket

from services.cache_service import CacheService

logger = logging.getLogger(__name__)


@dataclass
class WebSocketMessage:
    """WebSocket message structure."""
    type: str
    data: Dict[str, Any]
    timestamp: float = field(default_factory=time.time)
    client_id: Optional[str] = None
    message_id: Optional[str] = None


class ConnectionManager:
    """WebSocket connection manager for real-time updates."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_stats = {
            'total_connections': 0,
            'active_connections': 0,
            'messages_sent': 0,
            'last_activity': None,
            'batched_messages': 0,
            'errors_handled': 0
        }

        # Use RLock for thread safety as specified
        self._lock = threading.RLock()

    async def connect(self, websocket: WebSocket, client_id: str):
        """Connect a new WebSocket client."""
        await websocket.accept()

        with self._lock:
            self.active_connections[client_id] = websocket
            self.connection_stats['total_connections'] += 1
            self.connection_stats['active_connections'] += 1
            self.connection_stats['last_activity'] = time.time()

        logger.info(f"WebSocket client {client_id} connected. Active: {self.connection_stats['active_connections']}")

    def disconnect(self, client_id: str):
        """Disconnect a WebSocket client."""
        with self._lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
                self.connection_stats['active_connections'] -= 1
                self.connection_stats['last_activity'] = time.time()

        logger.info(f"WebSocket client {client_id} disconnected. Active: {self.connection_stats['active_connections']}")

    async def send_personal_message(self, message: Dict[str, Any], client_id: str):
        """Send message to specific client with orjson serialization."""
        if client_id not in self.active_connections:
            return

        websocket = self.active_connections[client_id]
        try:
            serialized_message = safe_serialize_message(message)
            await websocket.send_text(serialized_message)

            with self._lock:
                self.connection_stats['messages_sent'] += 1
                self.connection_stats['last_activity'] = time.time()

        except Exception as e:
            logger.error(f"Failed to send message to client {client_id}: {e}")
            self.connection_stats['errors_handled'] += 1
            self.disconnect(client_id)

    async def broadcast_message(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients with orjson serialization."""
        if not self.active_connections:
            return

        try:
            serialized_message = safe_serialize_message(message)
            disconnected_clients = []

            with self._lock:
                active_clients = list(self.active_connections.items())

            for client_id, websocket in active_clients:
                try:
                    await websocket.send_text(serialized_message)

                    with self._lock:
                        self.connection_stats['messages_sent'] += 1
                except Exception as e:
                    logger.error(f"Failed to broadcast to client {client_id}: {e}")
                    disconnected_clients.append(client_id)

            # Clean up disconnected clients
            for client_id in disconnected_clients:
                self.disconnect(client_id)

                with self._lock:
                    self.connection_stats['errors_handled'] += 1

            with self._lock:
                self.connection_stats['last_activity'] = time.time()

        except Exception as e:
            logger.error(f"Failed to broadcast message: {e}")
            with self._lock:
                self.connection_stats['errors_handled'] += 1

    async def send_batched_message(self, messages: List[Dict[str, Any]], client_id: Optional[str] = None):
        """Send multiple messages as a batch for performance optimization."""
        if not messages:
            return

        batch_message = {
            "type": "batch",
            "data": messages,
            "timestamp": time.time(),
            "batch_size": len(messages)
        }

        if client_id:
            await self.send_personal_message(batch_message, client_id)
        else:
            await self.broadcast_message(batch_message)

            with self._lock:
                self.connection_stats['batched_messages'] += 1

    def get_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        with self._lock:
            return {
                'active_connections': self.connection_stats['active_connections'],
                'total_connections': self.connection_stats['total_connections'],
                'messages_sent': self.connection_stats['messages_sent'],
                'last_activity': self.connection_stats['last_activity'],
                'batched_messages': self.connection_stats['batched_messages'],
                'errors_handled': self.connection_stats['errors_handled']
            }


def safe_serialize_message(message: Dict[str, Any]) -> str:
    """
    CRITICAL: Safe serialization using orjson for WebSocket payloads.

    Handles datetime/dataclass objects that crash standard json.dumps.
    Implements serialization error handling to prevent WebSocket connection crashes.

    Args:
        message: Message dictionary to serialize

    Returns:
        JSON string ready for WebSocket transmission

    Raises:
        Exception: If serialization fails, returns structured error response
    """
    try:
        # Use orjson for efficient and safe serialization
        return orjson.dumps(message, option=orjson.OPT_NON_STR_KEYS).decode('utf-8')
    except Exception as e:
        logger.error(f"Serialization error: {e}")
        # Return structured error message instead of crashing
        error_response = {
            "type": "serialization_error",
            "error": str(e),
            "timestamp": time.time(),
            "original_message_type": message.get("type", "unknown")
        }
        try:
            return orjson.dumps(error_response).decode('utf-8')
        except Exception:
            # If even error serialization fails, return minimal response
            return '{"type": "serialization_error", "error": "Failed to serialize error response"}'


class RealtimeService:
    """
    Real-time service with WebSocket support and caching integration.

    This service implements the real-time notification system for the
    geopolitical intelligence platform, following the patterns specified
    in AGENTS.md for WebSocket resilience and performance optimization.

    Features:
    - WebSocket connection management with orjson serialization
    - Integration with multi-tier cache service
    - Message batching for performance optimization
    - Error resilience with structured error handling
    - Thread-safe operations with RLock synchronization
    - Layer data and GPU filter synchronization
    """

    # Message type constants
    MSG_TYPE_FEATURE_FLAG_CHANGE = "feature_flag_change"
    MSG_TYPE_FEATURE_FLAG_CREATED = "feature_flag_created"
    MSG_TYPE_FEATURE_FLAG_DELETED = "feature_flag_deleted"
    MSG_TYPE_LAYER_DATA_UPDATE = "layer_data_update"
    MSG_TYPE_GPU_FILTER_SYNC = "gpu_filter_sync"
    MSG_TYPE_LAYER_PERFORMANCE_REPORT = "layer_performance_report"

    def __init__(self, cache_service: Optional[CacheService] = None):
        """
        Initialize the real-time service.

        Args:
            cache_service: Optional cache service for data synchronization
        """
        self.cache_service = cache_service
        self.connection_manager = ConnectionManager()
        self.logger = logging.getLogger(__name__)

        # Performance metrics
        self._metrics = {
            'messages_processed': 0,
            'broadcasts_sent': 0,
            'batches_created': 0,
            'errors_encountered': 0,
            'layer_updates_sent': 0,
            'filter_syncs_sent': 0,
            'performance_reports_received': 0
        }

        # Layer performance tracking
        self._layer_performance_history: Dict[str, List[Dict[str, Any]]] = {}

        # Use RLock for thread safety
        self._lock = threading.RLock()

    async def initialize(self) -> None:
        """Initialize the real-time service."""
        self.logger.info("Real-time service initialized")

    async def cleanup(self) -> None:
        """Cleanup the real-time service."""
        # Close all WebSocket connections
        with self._lock:
            client_ids = list(self.connection_manager.active_connections.keys())

        for client_id in client_ids:
            self.connection_manager.disconnect(client_id)

        self.logger.info("Real-time service cleanup completed")

    async def notify_feature_flag_change(
        self,
        flag_name: str,
        old_value: bool,
        new_value: bool,
        rollout_percentage: Optional[int] = None
    ):
        """
        Notify clients of feature flag changes via WebSocket.

        This method sends structured messages for feature flag updates
        to enable real-time UI updates and client-side state management.

        Args:
            flag_name: Name of the changed feature flag
            old_value: Previous enabled state
            new_value: New enabled state
            rollout_percentage: Optional rollout percentage for gradual rollout
        """
        message = {
            "type": "feature_flag_change",
            "data": {
                "flag_name": flag_name,
                "old_value": old_value,
                "new_value": new_value,
                "rollout_percentage": rollout_percentage,
                "changed_at": time.time()
            },
            "timestamp": time.time()
        }

        await self.connection_manager.broadcast_message(message)

        with self._lock:
            self._metrics['messages_processed'] += 1
            self._metrics['broadcasts_sent'] += 1

        self.logger.debug(
            f"Broadcasted feature flag change: {flag_name} "
            f"{old_value} -> {new_value} (rollout: {rollout_percentage}%)"
        )

    async def notify_flag_created(self, flag_data: Dict[str, Any]):
        """Notify clients of new feature flag creation."""
        message = {
            "type": "feature_flag_created",
            "data": flag_data,
            "timestamp": time.time()
        }

        await self.connection_manager.broadcast_message(message)

        with self._lock:
            self._metrics['messages_processed'] += 1
            self._metrics['broadcasts_sent'] += 1

    async def notify_flag_deleted(self, flag_name: str):
        """Notify clients of feature flag deletion."""
        message = {
            "type": "feature_flag_deleted",
            "data": {
                "flag_name": flag_name,
                "deleted_at": time.time()
            },
            "timestamp": time.time()
        }

        await self.connection_manager.broadcast_message(message)

        with self._lock:
            self._metrics['messages_processed'] += 1
            self._metrics['broadcasts_sent'] += 1

    async def send_personal_notification(self, client_id: str, message: Dict[str, Any]):
        """Send a personal notification to a specific client."""
        await self.connection_manager.send_personal_message(message, client_id)

        with self._lock:
            self._metrics['messages_processed'] += 1

    async def get_connection_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics."""
        connection_stats = self.connection_manager.get_stats()

        with self._lock:
            service_metrics = self._metrics.copy()

        return {
            "connection_stats": connection_stats,
            "service_metrics": service_metrics,
            "cache_enabled": self.cache_service is not None
        }

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for monitoring."""
        with self._lock:
            return {
                'messages_processed': self._metrics['messages_processed'],
                'broadcasts_sent': self._metrics['broadcasts_sent'],
                'batches_created': self._metrics['batches_created'],
                'errors_encountered': self._metrics['errors_encountered'],
                'uptime': time.time(),  # Could track service start time
                'performance': 'EXCELLENT' if self._metrics['errors_encountered'] == 0 else 'GOOD'
            }

    async def broadcast_layer_data_update(
        self,
        layer_id: str,
        layer_type: str,
        data: Dict[str, Any],
        bbox: Optional[Dict[str, float]] = None
    ):
        """
        Broadcast geospatial layer data update to all connected clients.

        Args:
            layer_id: Unique identifier for the layer
            layer_type: Type of layer (point, polygon, heatmap, etc.)
            data: Layer data payload (features, metadata, etc.)
            bbox: Optional bounding box {minLat, maxLat, minLng, maxLng}
        """
        message = {
            "type": self.MSG_TYPE_LAYER_DATA_UPDATE,
            "data": {
                "layer_id": layer_id,
                "layer_type": layer_type,
                "layer_data": data,
                "bbox": bbox,
                "changed_at": time.time()
            },
            "timestamp": time.time()
        }

        await self.connection_manager.broadcast_message(message)

        with self._lock:
            self._metrics['messages_processed'] += 1
            self._metrics['broadcasts_sent'] += 1
            self._metrics['layer_updates_sent'] += 1

        self.logger.debug(
            f"Broadcasted layer data update: {layer_id} (type: {layer_type})"
        )

    async def broadcast_gpu_filter_sync(
        self,
        filter_id: str,
        filter_type: str,
        filter_params: Dict[str, Any],
        affected_layers: List[str],
        status: str = "applied"
    ):
        """
        Broadcast GPU filter state synchronization to all connected clients.

        Args:
            filter_id: Unique identifier for the filter
            filter_type: Type of filter (spatial, temporal, attribute, etc.)
            filter_params: Filter parameters and configuration
            affected_layers: List of layer IDs affected by this filter
            status: Filter status (applied, pending, error, cleared)
        """
        message = {
            "type": self.MSG_TYPE_GPU_FILTER_SYNC,
            "data": {
                "filter_id": filter_id,
                "filter_type": filter_type,
                "filter_params": filter_params,
                "affected_layers": affected_layers,
                "status": status,
                "changed_at": time.time()
            },
            "timestamp": time.time()
        }

        await self.connection_manager.broadcast_message(message)

        with self._lock:
            self._metrics['messages_processed'] += 1
            self._metrics['broadcasts_sent'] += 1
            self._metrics['filter_syncs_sent'] += 1

        self.logger.debug(
            f"Broadcasted GPU filter sync: {filter_id} (type: {filter_type}, "
            f"status: {status}, layers: {len(affected_layers)})"
        )

    async def broadcast_layer_features(
        self,
        layer_id: str,
        layer_type: str,
        features: List[Dict[str, Any]],
        bbox: Optional[Dict[str, float]] = None
    ):
        """
        Convenience method to broadcast GeoJSON features for a layer.

        Args:
            layer_id: Unique layer identifier
            layer_type: Layer type (point, polygon, heatmap)
            features: List of GeoJSON features
            bbox: Optional bounding box
        """
        geojson_data = {
            "type": "FeatureCollection",
            "features": features
        }
        await self.broadcast_layer_data_update(layer_id, layer_type, geojson_data, bbox)

    async def broadcast_spatial_filter(
        self,
        filter_id: str,
        bounds: Dict[str, float],
        affected_layers: List[str]
    ):
        """
        Convenience method to broadcast spatial filter application.

        Args:
            filter_id: Unique filter identifier
            bounds: Spatial bounds {minLat, maxLat, minLng, maxLng}
            affected_layers: Layer IDs affected by spatial filter
        """
        filter_params = {
            "bounds": bounds,
            "filter_type": "spatial"
        }
        await self.broadcast_gpu_filter_sync(
            filter_id,
            "spatial",
            filter_params,
            affected_layers,
            "applied"
        )

    async def receive_layer_performance_report(
        self,
        report: Dict[str, Any]
    ):
        """
        Receive and process layer performance report from frontend.

        Implements backend reception of layer performance metrics
        for monitoring, analysis, and feature flag rollback decisions.

        Args:
            report: Performance report from LayerPerformanceMonitor
        """
        try:
            layer_id = report.get('layerId')
            if not layer_id:
                self.logger.error('Layer performance report missing layerId')
                return

            # Store performance history
            if layer_id not in self._layer_performance_history:
                self._layer_performance_history[layer_id] = []

            # Add timestamp if not present
            report['received_at'] = time.time()

            # Store report (keep last 100 reports per layer)
            history = self._layer_performance_history[layer_id]
            history.append(report)
            if len(history) > 100:
                history.pop(0)

            with self._lock:
                self._metrics['performance_reports_received'] += 1

            # Log key metrics
            self.logger.info(
                f"Layer performance report received: {layer_id} - "
                f"P95: {report.get('p95RenderTime', 0):.2f}ms, "
                f"GPU Filter: {report.get('avgGpuFilterTime', 0):.2f}ms, "
                f"Cache Hit: {report.get('cacheStats', {}).get('overallHitRate', 0):.1f}%, "
                f"Compliance: {report.get('sloCompliance', {}).get('overallCompliance', 0):.1f}%"
            )

            # Check for critical degradation warnings
            warnings = report.get('degradationWarnings', [])
            if warnings:
                self.logger.warning(
                    f"Layer {layer_id} performance degradation: {warnings}"
                )

            # Check SLO compliance for feature flag rollback
            slo_compliance = report.get('sloCompliance', {})
            overall_compliance = slo_compliance.get('overallCompliance', 100)

            if overall_compliance < 95:  # Critical threshold
                self.logger.error(
                    f"CRITICAL: Layer {layer_id} SLO compliance at {overall_compliance:.1f}% "
                    f"- Feature flag rollback may be required"
                )

                # FUTURE INTEGRATION: Trigger feature flag rollback via feature flag service
                # This requires integration with:
                # - Feature Flag Service (feature_flag_service.py)
                # - ML A/B Testing Framework
                # - Rollback criteria configuration
                # - Notification system for admins
                #
                # Implementation would call:
                # await self.feature_flag_service.trigger_rollback(
                #     layer_id=layer_id,
                #     reason=f"SLO compliance below threshold: {overall_compliance:.1f}%",
                #     compliance_score=overall_compliance
                # )

            # Optionally broadcast performance report to monitoring clients
            if report.get('broadcastToMonitoring', False):
                await self.broadcast_layer_performance_to_monitors(report)

        except Exception as e:
            self.logger.error(f"Failed to process layer performance report: {e}")
            with self._lock:
                self._metrics['errors_encountered'] += 1

    async def broadcast_layer_performance_to_monitors(
        self,
        report: Dict[str, Any]
    ):
        """
        Broadcast layer performance report to monitoring/admin clients.

        Args:
            report: Performance report to broadcast
        """
        message = {
            "type": self.MSG_TYPE_LAYER_PERFORMANCE_REPORT,
            "data": report,
            "timestamp": time.time()
        }

        # This would broadcast only to clients subscribed to monitoring channel
        await self.connection_manager.broadcast_message(message)

        with self._lock:
            self._metrics['broadcasts_sent'] += 1

    def get_layer_performance_history(
        self,
        layer_id: Optional[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get performance history for layers.

        Args:
            layer_id: Optional specific layer ID to get history for

        Returns:
            Performance history for specified layer or all layers
        """
        if layer_id:
            return {layer_id: self._layer_performance_history.get(layer_id, [])}
        return dict(self._layer_performance_history)

    def get_layer_performance_summary(self) -> Dict[str, Any]:
        """
        Get summary of layer performance across all monitored layers.

        Returns:
            Summary statistics of layer performance
        """
        summary = {
            'total_layers_monitored': len(self._layer_performance_history),
            'total_reports_received': self._metrics['performance_reports_received'],
            'layers': {}
        }

        for layer_id, history in self._layer_performance_history.items():
            if not history:
                continue

            latest_report = history[-1]
            summary['layers'][layer_id] = {
                'latest_p95_render_time': latest_report.get('p95RenderTime', 0),
                'latest_gpu_filter_time': latest_report.get('avgGpuFilterTime', 0),
                'latest_cache_hit_rate': latest_report.get('cacheStats', {}).get('overallHitRate', 0),
                'latest_compliance': latest_report.get('sloCompliance', {}).get('overallCompliance', 0),
                'report_count': len(history),
                'last_received': latest_report.get('received_at', 0)
            }

        return summary

    @asynccontextmanager
    async def batch_messages(self, client_id: Optional[str] = None):
        """
        Context manager for batching multiple messages for efficient delivery.

        This implements the server-side debounce strategy for batching
        small updates into single messages for performance optimization.

        Args:
            client_id: Optional specific client to batch messages for
        """
        batch = []

        try:
            yield batch
        finally:
            if batch:
                await self.connection_manager.send_batched_message(batch, client_id)

                with self._lock:
                    self._metrics['batches_created'] += 1

                self.logger.debug(f"Sent batch of {len(batch)} messages")


# Module-level convenience function for safe serialization
def safe_serialize_for_websocket(data: Dict[str, Any]) -> str:
    """Convenience function for WebSocket serialization."""
    return safe_serialize_message(data)
