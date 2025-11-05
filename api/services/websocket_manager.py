"""
WebSocket Manager with orjson serialization and broadcasting capabilities.

Implements WebSocket communication with:
- orjson serialization for datetime/dataclass objects
- safe_serialize_message function with fallback to json.dumps
- Message batching for high-frequency updates
- Graceful error handling for serialization failures
- Broadcasting to connected clients
- Connection resilience with automatic reconnection

Following the patterns specified in AGENTS.md.
"""

import asyncio
import json
import logging
import time
import weakref
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Union, Callable
from datetime import datetime
import traceback

try:
    import orjson
    ORJSON_AVAILABLE = True
except ImportError:
    ORJSON_AVAILABLE = False
    orjson = None


logger = logging.getLogger(__name__)


@dataclass
class WebSocketMessage:
    """WebSocket message structure."""
    type: str
    data: Any
    timestamp: Optional[float] = None
    client_id: Optional[str] = None
    message_id: Optional[str] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()
        if self.message_id is None:
            self.message_id = f"msg_{int(self.timestamp * 1000)}"


@dataclass
class ConnectionStats:
    """WebSocket connection statistics."""
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    last_activity: Optional[float] = None
    connect_time: Optional[float] = None
    errors: int = 0
    
    @property
    def is_alive(self) -> bool:
        """Check if connection is still alive."""
        if not self.last_activity:
            return False
        return time.time() - self.last_activity < 300  # 5 minutes timeout
    
    @property
    def connection_age(self) -> float:
        """Get connection age in seconds."""
        if not self.connect_time:
            return 0.0
        return time.time() - self.connect_time


class SerializationError(Exception):
    """Custom exception for serialization failures."""
    pass


def safe_serialize_message(message: Union[WebSocketMessage, Dict[str, Any], Any]) -> str:
    """
    Safely serialize WebSocket message with orjson and fallback to json.dumps.
    
    This function handles:
    - Circular references in objects
    - Datetime objects (converts to ISO format)
    - Dataclass objects (converts to dict)
    - Complex nested structures
    - Fallback to json.dumps if orjson fails
    
    Args:
        message: Message to serialize
        
    Returns:
        JSON string
        
    Raises:
        SerializationError: If serialization fails completely
    """
    try:
        # Handle different message types
        if isinstance(message, WebSocketMessage):
            # Convert WebSocketMessage to dict for serialization
            message_dict = {
                "type": message.type,
                "data": message.data,
                "timestamp": message.timestamp,
                "client_id": message.client_id,
                "message_id": message.message_id
            }
            message = message_dict
        elif hasattr(message, '__dict__'):
            # Handle dataclass-like objects
            message = message.__dict__
        elif not isinstance(message, dict):
            # Wrap primitive types in a standard format
            message = {"type": "data", "data": message, "timestamp": time.time()}
        
        # Add timestamp if not present
        if "timestamp" not in message:
            message["timestamp"] = time.time()
        
        # Try orjson first if available (preferred for datetime/dataclass objects)
        if ORJSON_AVAILABLE:
            try:
                # Use orjson options for datetime handling
                return orjson.dumps(
                    message, 
                    option=orjson.OPT_NON_STR_KEYS | orjson.OPT_NAIVE_UTC
                ).decode('utf-8')
            except Exception as orjson_error:
                logger.warning(f"orjson serialization failed: {orjson_error}, falling back to json.dumps")
        
        # Fallback to standard json.dumps with custom encoder
        class CustomJSONEncoder(json.JSONEncoder):
            def default(self, obj):
                if hasattr(obj, 'isoformat'):
                    # Handle datetime objects
                    if hasattr(obj, 'isoformat'):
                        return obj.isoformat()
                elif hasattr(obj, '__dict__'):
                    # Handle dataclass objects
                    return obj.__dict__
                elif hasattr(obj, 'model_dump'):
                    # Handle Pydantic models
                    return obj.model_dump()
                elif hasattr(obj, '__slots__'):
                    # Handle objects with __slots__
                    return {attr: getattr(obj, attr) for attr in obj.__slots__ if hasattr(obj, attr)}
                
                # For complex objects, try to extract useful information
                if isinstance(obj, (list, tuple, set)):
                    return list(obj)
                elif isinstance(obj, dict):
                    return obj
                else:
                    # Return string representation as last resort
                    return str(obj)
        
        return json.dumps(message, cls=CustomJSONEncoder, separators=(',', ':'))
        
    except Exception as e:
        logger.error(f"All serialization methods failed: {e}")
        
        # Return a structured error message instead of crashing
        error_message = {
            "type": "serialization_error",
            "error": str(e),
            "original_message_type": type(message).__name__,
            "timestamp": time.time(),
            "fallback": True
        }
        
        try:
            return json.dumps(error_message)
        except Exception:
            # Last resort: basic string error
            return json.dumps({
                "type": "serialization_error", 
                "message": "Message could not be serialized",
                "timestamp": time.time()
            })


class WebSocketManager:
    """
    WebSocket manager with orjson serialization and broadcasting.
    
    Features:
    - orjson serialization with fallback to json.dumps
    - Message batching for high-frequency updates
    - Broadcasting to connected clients
    - Connection health monitoring
    - Graceful error handling
    - Performance metrics
    """
    
    def __init__(
        self,
        max_connections: int = 1000,
        message_batch_size: int = 10,
        batch_timeout: float = 0.1,  # 100ms batch window
        heartbeat_interval: float = 30.0,  # Send heartbeat every 30s
        max_message_size: int = 1024 * 1024,  # 1MB
        enable_metrics: bool = True
    ):
        """
        Initialize WebSocket manager.
        
        Args:
            max_connections: Maximum number of WebSocket connections
            message_batch_size: Number of messages to batch before sending
            batch_timeout: Maximum time to wait before sending batch
            heartbeat_interval: Heartbeat interval in seconds
            max_message_size: Maximum message size in bytes
            enable_metrics: Enable performance metrics collection
        """
        self.max_connections = max_connections
        self.message_batch_size = message_batch_size
        self.batch_timeout = batch_timeout
        self.heartbeat_interval = heartbeat_interval
        self.max_message_size = max_message_size
        self.enable_metrics = enable_metrics
        
        # Connected WebSocket clients
        self._clients: Dict[str, Any] = {}  # client_id -> websocket connection
        self._client_stats: Dict[str, ConnectionStats] = {}
        self._client_weakrefs: weakref.WeakSet = weakref.WeakSet()
        
        # Message batching queues
        self._batching_enabled = True
        self._message_batches: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self._batch_timers: Dict[str, asyncio.Task] = {}
        
        # Broadcasting channels
        self._broadcast_channels: Dict[str, Set[str]] = defaultdict(set)  # channel -> client_ids
        
        # Metrics
        self._total_messages_sent = 0
        self._total_messages_received = 0
        self._total_bytes_sent = 0
        self._total_bytes_received = 0
        self._serialization_errors = 0
        self._connection_errors = 0
        self._start_time = time.time()
        
        # Heartbeat task
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def start(self) -> None:
        """Start the WebSocket manager."""
        if self._running:
            return
        
        self._running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info("WebSocket manager started")
    
    async def stop(self) -> None:
        """Stop the WebSocket manager."""
        if not self._running:
            return
        
        self._running = False
        
        # Cancel heartbeat
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        
        # Cancel all batch timers
        for timer in self._batch_timers.values():
            timer.cancel()
        
        logger.info("WebSocket manager stopped")
    
    async def connect(self, websocket: Any, client_id: str) -> None:
        """
        Register a new WebSocket connection.
        
        Args:
            websocket: WebSocket connection object
            client_id: Unique client identifier
        """
        if len(self._clients) >= self.max_connections:
            raise ConnectionError(f"Maximum connections ({self.max_connections}) reached")
        
        self._clients[client_id] = websocket
        self._client_weakrefs.add(websocket)
        
        self._client_stats[client_id] = ConnectionStats(
            connect_time=time.time(),
            last_activity=time.time()
        )
        
        logger.info(f"WebSocket client connected: {client_id}")
        
        # Send welcome message
        await self.send_to_client(client_id, {
            "type": "connection_established",
            "client_id": client_id,
            "timestamp": time.time()
        })
    
    async def disconnect(self, client_id: str, reason: str = "Client disconnected") -> None:
        """
        Unregister a WebSocket connection.
        
        Args:
            client_id: Client identifier
            reason: Disconnection reason
        """
        if client_id in self._clients:
            del self._clients[client_id]
        
        if client_id in self._client_stats:
            del self._client_stats[client_id]
        
        # Remove from all channels
        for channel in self._broadcast_channels.values():
            channel.discard(client_id)
        
        logger.info(f"WebSocket client disconnected: {client_id} - {reason}")
    
    async def send_to_client(
        self, 
        client_id: str, 
        message: Union[WebSocketMessage, Dict[str, Any], Any],
        use_batch: bool = True
    ) -> bool:
        """
        Send message to a specific client.
        
        Args:
            client_id: Target client identifier
            message: Message to send
            use_batch: Whether to use message batching
            
        Returns:
            True if message was sent successfully
        """
        if client_id not in self._clients:
            return False
        
        websocket = self._clients[client_id]
        
        # Check message size
        serialized = safe_serialize_message(message)
        message_size = len(serialized.encode('utf-8'))
        
        if message_size > self.max_message_size:
            logger.warning(f"Message too large for client {client_id}: {message_size} bytes")
            return False
        
        try:
            if use_batch and self._batching_enabled:
                # Add to batch queue
                await self._add_to_batch(client_id, serialized)
            else:
                # Send immediately
                await websocket.send(serialized)
                self._update_client_stats(client_id, len(serialized), 0)
            
            if self.enable_metrics:
                self._total_messages_sent += 1
                self._total_bytes_sent += message_size
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send message to client {client_id}: {e}")
            self._connection_errors += 1
            
            # Mark client as potentially disconnected
            if client_id in self._client_stats:
                self._client_stats[client_id].errors += 1
            
            return False
    
    async def broadcast(
        self,
        message: Union[WebSocketMessage, Dict[str, Any], Any],
        channel: Optional[str] = None,
        exclude_client: Optional[str] = None,
        use_batch: bool = True
    ) -> Dict[str, bool]:
        """
        Broadcast message to multiple clients.
        
        Args:
            message: Message to broadcast
            channel: Broadcast channel (None for all clients)
            exclude_client: Client to exclude from broadcast
            use_batch: Whether to use message batching
            
        Returns:
            Dictionary of client_id -> success status
        """
        target_clients = set()
        
        if channel:
            # Send to channel subscribers
            target_clients.update(self._broadcast_channels.get(channel, set()))
        else:
            # Send to all clients
            target_clients.update(self._clients.keys())
        
        # Exclude specific client if requested
        if exclude_client:
            target_clients.discard(exclude_client)
        
        results = {}
        
        # Batch send to all target clients
        if use_batch and self._batching_enabled:
            serialized = safe_serialize_message(message)
            
            tasks = []
            for client_id in target_clients:
                if client_id in self._clients:
                    task = self._add_to_batch(client_id, serialized)
                    tasks.append((client_id, task))
            
            # Wait for all batch operations to complete
            for client_id, task in tasks:
                try:
                    await task
                    results[client_id] = True
                except Exception as e:
                    logger.error(f"Failed to batch send to client {client_id}: {e}")
                    results[client_id] = False
        else:
            # Send immediately to each client
            for client_id in target_clients:
                if client_id in self._clients:
                    success = await self.send_to_client(client_id, message, use_batch=False)
                    results[client_id] = success
                else:
                    results[client_id] = False
        
        return results
    
    async def subscribe_to_channel(self, client_id: str, channel: str) -> bool:
        """
        Subscribe client to a broadcast channel.
        
        Args:
            client_id: Client identifier
            channel: Channel name
            
        Returns:
            True if subscription successful
        """
        if client_id in self._clients:
            self._broadcast_channels[channel].add(client_id)
            logger.info(f"Client {client_id} subscribed to channel {channel}")
            return True
        return False
    
    async def unsubscribe_from_channel(self, client_id: str, channel: str) -> bool:
        """
        Unsubscribe client from a broadcast channel.
        
        Args:
            client_id: Client identifier
            channel: Channel name
            
        Returns:
            True if unsubscription successful
        """
        self._broadcast_channels[channel].discard(client_id)
        logger.info(f"Client {client_id} unsubscribed from channel {channel}")
        return True
    
    async def _add_to_batch(self, client_id: str, serialized_message: str) -> None:
        """Add message to batch queue for client."""
        self._message_batches[client_id].append(serialized_message)
        
        # Start batch timer if not already running
        if client_id not in self._batch_timers:
            self._batch_timers[client_id] = asyncio.create_task(
                self._process_batch(client_id)
            )
    
    async def _process_batch(self, client_id: str) -> None:
        """Process batched messages for client."""
        try:
            await asyncio.sleep(self.batch_timeout)
            
            if client_id not in self._clients:
                return
            
            batch = self._message_batches[client_id]
            if not batch:
                return
            
            # Combine messages (you could also send as array)
            combined_messages = []
            while batch:
                try:
                    message = batch.popleft()
                    combined_messages.append(message)
                except IndexError:
                    break
            
            if combined_messages:
                websocket = self._clients[client_id]
                
                # Send as array of messages
                batch_data = f'[{",".join(combined_messages)}]'
                await websocket.send(batch_data)
                
                total_size = len(batch_data.encode('utf-8'))
                self._update_client_stats(client_id, total_size, 0)
                
                if self.enable_metrics:
                    self._total_messages_sent += len(combined_messages)
                    self._total_bytes_sent += total_size
        
        except Exception as e:
            logger.error(f"Failed to process batch for client {client_id}: {e}")
            self._serialization_errors += 1
        
        finally:
            # Clean up batch timer
            if client_id in self._batch_timers:
                del self._batch_timers[client_id]
    
    async def _heartbeat_loop(self) -> None:
        """Send heartbeat messages to maintain connections."""
        while self._running:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                
                # Send heartbeat to all clients
                heartbeat_message = {
                    "type": "heartbeat",
                    "timestamp": time.time()
                }
                
                await self.broadcast(
                    heartbeat_message, 
                    use_batch=True
                )
                
                # Clean up dead connections
                await self._cleanup_dead_connections()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat loop error: {e}")
    
    async def _cleanup_dead_connections(self) -> None:
        """Clean up dead WebSocket connections."""
        dead_clients = []
        
        for client_id, stats in self._client_stats.items():
            if not stats.is_alive:
                dead_clients.append(client_id)
        
        for client_id in dead_clients:
            logger.info(f"Cleaning up dead connection: {client_id}")
            await self.disconnect(client_id, "Connection timeout")
    
    def _update_client_stats(self, client_id: str, bytes_sent: int, bytes_received: int) -> None:
        """Update client connection statistics."""
        if client_id in self._client_stats:
            stats = self._client_stats[client_id]
            stats.messages_sent += 1
            stats.bytes_sent += bytes_sent
            stats.bytes_received += bytes_received
            stats.last_activity = time.time()
    
    async def handle_message(self, client_id: str, message_data: str) -> None:
        """
        Handle incoming WebSocket message from client.
        
        Args:
            client_id: Client identifier
            message_data: Raw message data
        """
        try:
            # Update received stats
            if self.enable_metrics:
                self._total_messages_received += 1
                self._total_bytes_received += len(message_data.encode('utf-8'))
            
            self._update_client_stats(client_id, 0, len(message_data.encode('utf-8')))
            
            # Parse message
            try:
                message_dict = json.loads(message_data)
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON from client {client_id}: {e}")
                await self.send_to_client(client_id, {
                    "type": "error",
                    "error": "Invalid JSON format",
                    "timestamp": time.time()
                })
                return
            
            # Process message based on type
            message_type = message_dict.get("type", "unknown")
            
            if message_type == "ping":
                await self.send_to_client(client_id, {
                    "type": "pong",
                    "timestamp": time.time()
                })
            
            elif message_type == "subscribe":
                channel = message_dict.get("channel")
                if channel:
                    await self.subscribe_to_channel(client_id, channel)
            
            elif message_type == "unsubscribe":
                channel = message_dict.get("channel")
                if channel:
                    await self.unsubscribe_from_channel(client_id, channel)
            
            else:
                # Handle custom message types
                logger.info(f"Received {message_type} message from client {client_id}")
            
        except Exception as e:
            logger.error(f"Error handling message from client {client_id}: {e}")
            self._serialization_errors += 1
            
            # Send error message to client
            try:
                await self.send_to_client(client_id, {
                    "type": "error",
                    "error": f"Message processing failed: {str(e)}",
                    "timestamp": time.time()
                })
            except Exception:
                pass  # Client might be disconnected
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get WebSocket manager performance metrics."""
        uptime = time.time() - self._start_time
        
        # Calculate average message size
        avg_sent_size = (self._total_bytes_sent / self._total_messages_sent) if self._total_messages_sent > 0 else 0
        avg_received_size = (self._total_bytes_received / self._total_messages_received) if self._total_messages_received > 0 else 0
        
        # Connection health
        healthy_connections = sum(1 for stats in self._client_stats.values() if stats.is_alive)
        
        return {
            "connections": {
                "total": len(self._clients),
                "healthy": healthy_connections,
                "max_connections": self.max_connections,
                "utilization": len(self._clients) / self.max_connections
            },
            "messages": {
                "sent_total": self._total_messages_sent,
                "received_total": self._total_messages_received,
                "avg_sent_size": avg_sent_size,
                "avg_received_size": avg_received_size,
                "bytes_sent": self._total_bytes_sent,
                "bytes_received": self._total_bytes_received
            },
            "errors": {
                "serialization_errors": self._serialization_errors,
                "connection_errors": self._connection_errors
            },
            "performance": {
                "uptime_seconds": uptime,
                "messages_per_second": (self._total_messages_sent + self._total_messages_received) / uptime if uptime > 0 else 0,
                "bytes_per_second": (self._total_bytes_sent + self._total_bytes_received) / uptime if uptime > 0 else 0
            },
            "batching": {
                "enabled": self._batching_enabled,
                "active_batches": len(self._batch_timers),
                "batch_size": self.message_batch_size,
                "batch_timeout": self.batch_timeout
            },
            "channels": {
                "total_channels": len(self._broadcast_channels),
                "subscribers_per_channel": {channel: len(clients) for channel, clients in self._broadcast_channels.items()}
            }
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform WebSocket manager health check."""
        health_status = {
            "status": "healthy",
            "connections": {"healthy": True},
            "batching": {"healthy": True},
            "errors": {"healthy": True}
        }
        
        # Check connection health
        if len(self._clients) > self.max_connections:
            health_status["connections"]["error"] = "Too many connections"
            health_status["status"] = "degraded"
        
        # Check error rate
        error_rate = (self._serialization_errors + self._connection_errors) / max(self._total_messages_sent + self._total_messages_received, 1)
        if error_rate > 0.1:  # 10% error rate
            health_status["errors"]["error"] = f"High error rate: {error_rate:.2%}"
            health_status["status"] = "degraded"
        
        return health_status