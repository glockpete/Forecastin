"""
Real-time service with WebSocket support and safe orjson serialization.

Implements the WebSocket patterns specified in AGENTS.md:
- orjson serialization for WebSocket payloads 
- Thread-safe operations with RLock synchronization
- Error resilience with structured error handling
- Message batching for performance optimization
"""

import asyncio
import json
import logging
import threading
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from contextlib import asynccontextmanager

import orjson
from fastapi import WebSocket, WebSocketDisconnect

from api.services.cache_service import CacheService


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
        except Exception as serialize_error:
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
    """
    
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
            'errors_encountered': 0
        }
        
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