"""
WebSocket API Routes
Handles real-time WebSocket connections for updates, echo server, and health monitoring
"""

import asyncio
import logging
import time
from typing import Dict, Any

import orjson
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from models.websocket_schemas import validate_websocket_message, validate_outgoing_message

router = APIRouter(tags=["websocket"])

logger = logging.getLogger(__name__)

# WebSocket Configuration from Environment Variables
import os

# WebSocket heartbeat/ping configuration
WS_PING_INTERVAL = float(os.getenv('WS_PING_INTERVAL', '30'))  # seconds
WS_PING_TIMEOUT = float(os.getenv('WS_PING_TIMEOUT', '10'))    # seconds

# CORS and Origin Configuration
ALLOWED_ORIGINS = os.getenv(
    'ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080'
).split(',')

# Public URL configuration for frontend WebSocket connections
PUBLIC_BASE_URL = os.getenv('PUBLIC_BASE_URL', 'http://localhost:9000')
WS_PUBLIC_URL = os.getenv('WS_PUBLIC_URL', 'ws://localhost:9000/ws')

logger.info(f"[WS_CONFIG] Ping interval: {WS_PING_INTERVAL}s, Timeout: {WS_PING_TIMEOUT}s")
logger.info(f"[WS_CONFIG] Allowed origins: {ALLOWED_ORIGINS}")
logger.info(f"[WS_CONFIG] Public URLs - Base: {PUBLIC_BASE_URL}, WebSocket: {WS_PUBLIC_URL}")


class ConnectionManager:
    """WebSocket connection manager for real-time updates"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_stats = {
            'total_connections': 0,
            'active_connections': 0,
            'messages_sent': 0,
            'last_activity': None
        }

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_stats['total_connections'] += 1
        self.connection_stats['active_connections'] += 1
        self.connection_stats['last_activity'] = time.time()
        logger.info(f"WebSocket client {client_id} connected. Active: {self.connection_stats['active_connections']}")

    def disconnect(self, client_id: str):
        # Use pop() to atomically remove and avoid race condition (TOCTOU)
        connection = self.active_connections.pop(client_id, None)
        if connection is not None:
            self.connection_stats['active_connections'] -= 1
            self.connection_stats['last_activity'] = time.time()
            logger.info(f"WebSocket client {client_id} disconnected. Active: {self.connection_stats['active_connections']}")
        else:
            logger.debug(f"Client {client_id} was already disconnected.")

    async def send_personal_message(self, message: Dict[str, Any], client_id: str):
        """Send message to specific client with orjson serialization"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                from models.serializers import safe_serialize_message
                serialized_message = safe_serialize_message(message)
                await websocket.send_text(serialized_message)
                self.connection_stats['messages_sent'] += 1
                self.connection_stats['last_activity'] = time.time()
            except Exception as e:
                logger.error(f"Failed to send message to client {client_id}: {e}")
                self.disconnect(client_id)

    async def broadcast_message(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients with orjson serialization"""
        if not self.active_connections:
            return

        try:
            from models.serializers import safe_serialize_message
            serialized_message = safe_serialize_message(message)
            disconnected_clients = []

            for client_id, websocket in self.active_connections.items():
                try:
                    await websocket.send_text(serialized_message)
                    self.connection_stats['messages_sent'] += 1
                except Exception as e:
                    logger.error(f"Failed to send broadcast to client {client_id}: {e}")
                    disconnected_clients.append(client_id)

            # Clean up disconnected clients
            for client_id in disconnected_clients:
                self.disconnect(client_id)

            self.connection_stats['last_activity'] = time.time()

        except Exception as e:
            logger.error(f"Failed to broadcast message: {e}")


# Global connection manager
connection_manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates with orjson serialization

    CRITICAL CHANGES:
    - Accepts connections at clean /ws endpoint (no client_id parameter)
    - Automatically generates unique client_id server-side
    - Implements ping/pong response handling
    - Enhanced error handling and diagnostics
    """

    from models.serializers import safe_serialize_message

    # Generate unique client_id server-side
    client_id = f"ws_client_{int(time.time() * 1000)}_{id(websocket)}"

    # Comprehensive diagnostic logging
    connection_start_time = time.time()
    client_ip = getattr(websocket.client, 'host', 'unknown') if websocket.client else 'unknown'
    client_port = getattr(websocket.client, 'port', 'unknown') if websocket.client else 'unknown'

    # Capture all available request headers and origin information
    headers = dict(websocket.headers) if websocket.headers else {}
    origin = headers.get('origin', headers.get('referer', 'no_origin'))
    user_agent = headers.get('user-agent', 'no_user_agent')

    # Enhanced proxy diagnostics - capture X-Forwarded-* headers
    x_forwarded_for = headers.get('x-forwarded-for', 'none')
    x_forwarded_proto = headers.get('x-forwarded-proto', 'none')
    x_forwarded_host = headers.get('x-forwarded-host', 'none')
    x_real_ip = headers.get('x-real-ip', 'none')

    # Detect connection scheme (ws vs wss)
    connection_scheme = 'wss' if x_forwarded_proto == 'https' else 'ws'

    logger.info(f"[WS_DIAGNOSTICS] ===== CONNECTION ATTEMPT START =====")
    logger.info(f"[WS_DIAGNOSTICS] URL path: /ws")
    logger.info(f"[WS_DIAGNOSTICS] Generated client_id: '{client_id}'")
    logger.info(f"[WS_DIAGNOSTICS] Client address: {client_ip}:{client_port}")
    logger.info(f"[WS_DIAGNOSTICS] Origin: {origin}")
    logger.info(f"[WS_DIAGNOSTICS] User-Agent: {user_agent}")
    logger.info(f"[WS_DIAGNOSTICS] Scheme: {connection_scheme}")
    logger.info(f"[WS_DIAGNOSTICS] X-Forwarded-For: {x_forwarded_for}")
    logger.info(f"[WS_DIAGNOSTICS] X-Forwarded-Proto: {x_forwarded_proto}")
    logger.info(f"[WS_DIAGNOSTICS] X-Forwarded-Host: {x_forwarded_host}")
    logger.info(f"[WS_DIAGNOSTICS] X-Real-IP: {x_real_ip}")
    logger.info(f"[WS_DIAGNOSTICS] All headers: {headers}")
    logger.info(f"[WS_DIAGNOSTICS] Connection attempt at: {connection_start_time}")

    # Check origin against CORS policy using configurable ALLOWED_ORIGINS
    if origin != "no_origin" and origin not in ALLOWED_ORIGINS and "chrome-extension://" not in origin:
        reason = f"Origin not in allowed list: {origin}"
        logger.error(f"[WS_DIAGNOSTICS] 403 FORBIDDEN: {reason}")
        await websocket.close(code=1008, reason=reason)
        return

    try:
        # Connect to connection manager (which will accept the websocket)
        await connection_manager.connect(websocket, client_id)
        logger.info(f"[WS_DIAGNOSTICS] Connection ACCEPTED - client_id='{client_id}', duration_ms={(time.time() - connection_start_time)*1000:.2f}")
        logger.info(f"[WS_DIAGNOSTICS] Active connections after connect: {connection_manager.connection_stats['active_connections']}")

        try:
            while True:
                # Enhanced message receive logging
                receive_start_time = time.time()
                data = await websocket.receive_text()
                receive_duration_ms = (time.time() - receive_start_time) * 1000

                logger.info(f"[WS_DIAGNOSTICS] Message received from {client_id}: length={len(data)}, latency_ms={receive_duration_ms:.2f}")
                logger.debug(f"[WS_DIAGNOSTICS] Message content preview: {data[:100]}{'...' if len(data) > 100 else ''}")

                # Parse and validate message
                try:
                    raw_message = orjson.loads(data)

                    # Validate incoming message with Pydantic schemas
                    try:
                        validated_message = validate_websocket_message(raw_message)
                        message_type = validated_message.type
                        logger.debug(f"[WS_VALIDATION] Message validated successfully: type={message_type}")
                    except (ValueError, ValidationError) as validation_error:
                        logger.error(f"[WS_VALIDATION] Message validation failed from {client_id}: {validation_error}")
                        response = {
                            "type": "error",
                            "error": "Message validation failed",
                            "details": {"validation_error": str(validation_error)},
                            "timestamp": time.time()
                        }
                        await connection_manager.send_personal_message(response, client_id)
                        continue

                    # Handle ping/pong keepalive
                    if message_type == 'ping':
                        pong_response = {
                            "type": "pong",
                            "timestamp": time.time(),
                            "client_id": client_id
                        }
                        # Validate outgoing message
                        pong_response = validate_outgoing_message(pong_response)
                        await connection_manager.send_personal_message(pong_response, client_id)
                        logger.debug(f"[WS_DIAGNOSTICS] Sent validated pong response to {client_id}")
                        continue

                    # Handle other message types (echo for testing)
                    response = {
                        "type": "echo",
                        "data": raw_message,
                        "timestamp": time.time(),
                        "client_id": client_id,
                        "server_processing_ms": (time.time() - receive_start_time) * 1000
                    }

                except Exception as e:
                    logger.error(f"[WS_DIAGNOSTICS] Failed to parse message from {client_id}: {e}")
                    response = {
                        "type": "error",
                        "error": "Failed to parse message",
                        "timestamp": time.time()
                    }

                send_start_time = time.time()
                await connection_manager.send_personal_message(response, client_id)
                send_duration_ms = (time.time() - send_start_time) * 1000

                logger.info(f"[WS_DIAGNOSTICS] Response sent to {client_id}: latency_ms={send_duration_ms:.2f}")

        except WebSocketDisconnect as disconnect_exc:
            disconnect_time = time.time()
            close_code = getattr(disconnect_exc, 'code', 1000)
            close_reason = getattr(disconnect_exc, 'reason', 'Normal closure')
            logger.info(f"[WS_DIAGNOSTICS] WebSocketDisconnect - client_id='{client_id}', close_code={close_code}, reason='{close_reason}', total_duration_ms={(disconnect_time - connection_start_time)*1000:.2f}")
            connection_manager.disconnect(client_id)

        except Exception as e:
            error_time = time.time()
            logger.error(f"[WS_DIAGNOSTICS] WebSocket error for client {client_id}: {e}")
            logger.error(f"[WS_DIAGNOSTICS] Error details - type: {type(e).__name__}, duration_ms={(error_time - connection_start_time)*1000:.2f}")
            logger.error(f"[WS_DIAGNOSTICS] Client info - ID: '{client_id}', IP: {client_ip}, Origin: {origin}")
            connection_manager.disconnect(client_id)

    except Exception as e:
        error_time = time.time()
        logger.error(f"[WS_DIAGNOSTICS] Failed to accept WebSocket connection: {e}")
        logger.error(f"[WS_DIAGNOSTICS] Failed connection details - error_type: {type(e).__name__}, duration_ms={(error_time - connection_start_time)*1000:.2f}")
        logger.info(f"[WS_DIAGNOSTICS] ===== CONNECTION ATTEMPT END (FAILED) =====")

    finally:
        final_time = time.time()
        logger.info(f"[WS_DIAGNOSTICS] ===== CONNECTION END ===== Total duration: {(final_time - connection_start_time)*1000:.2f}ms")


@router.websocket("/ws/echo")
async def websocket_echo_endpoint(websocket: WebSocket):
    """
    Dedicated WebSocket echo endpoint for testing and diagnostics.

    Features:
    - Simple echo server that returns all messages back to client
    - Server-side ping/pong with configurable intervals
    - Minimal overhead for latency testing
    - Comprehensive connection diagnostics
    - Origin validation

    Use this endpoint to test:
    - WebSocket connectivity
    - Round-trip latency
    - Message serialization
    - Connection stability
    """
    from models.serializers import safe_serialize_message

    client_id = f"echo_client_{int(time.time() * 1000)}_{id(websocket)}"
    connection_start_time = time.time()

    # Diagnostics logging
    client_ip = getattr(websocket.client, 'host', 'unknown') if websocket.client else 'unknown'
    headers = dict(websocket.headers) if websocket.headers else {}
    origin = headers.get('origin', headers.get('referer', 'no_origin'))
    x_forwarded_for = headers.get('x-forwarded-for', 'none')
    x_forwarded_proto = headers.get('x-forwarded-proto', 'none')

    logger.info(f"[WS_ECHO] Connection from {client_ip}, origin={origin}, x-forwarded-for={x_forwarded_for}, x-forwarded-proto={x_forwarded_proto}")

    # Origin validation
    if origin != "no_origin" and origin not in ALLOWED_ORIGINS and "chrome-extension://" not in origin:
        reason = f"Origin not allowed: {origin}"
        logger.warning(f"[WS_ECHO] Rejecting connection - {reason}")
        await websocket.close(code=1008, reason=reason)
        return

    try:
        await websocket.accept()
        logger.info(f"[WS_ECHO] {client_id} connected")

        # Send welcome message
        welcome = {
            "type": "welcome",
            "endpoint": "/ws/echo",
            "client_id": client_id,
            "server_time": time.time(),
            "config": {
                "ping_interval": WS_PING_INTERVAL,
                "ping_timeout": WS_PING_TIMEOUT
            }
        }
        await websocket.send_text(safe_serialize_message(welcome))

        # Track last ping time for configurable heartbeat
        last_ping_time = time.time()

        while True:
            # Check if we need to send a ping
            current_time = time.time()
            if current_time - last_ping_time >= WS_PING_INTERVAL:
                ping_message = {
                    "type": "server_ping",
                    "timestamp": current_time,
                    "client_id": client_id
                }
                await websocket.send_text(safe_serialize_message(ping_message))
                last_ping_time = current_time
                logger.debug(f"[WS_ECHO] Sent server ping to {client_id}")

            # Receive message with timeout
            try:
                # Use asyncio.wait_for to enable periodic pings even when idle
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=min(WS_PING_INTERVAL / 2, 5.0)  # Check twice per ping interval
                )

                receive_time = time.time()
                logger.debug(f"[WS_ECHO] Received from {client_id}: {len(data)} bytes")

                # Parse and echo back
                try:
                    message = orjson.loads(data)

                    # Handle client pong response
                    if message.get('type') == 'pong':
                        logger.debug(f"[WS_ECHO] Received pong from {client_id}")
                        continue

                    # Echo message back with metadata
                    echo_response = {
                        "type": "echo",
                        "original": message,
                        "server_timestamp": receive_time,
                        "client_id": client_id,
                        "latency_info": {
                            "received_at": receive_time,
                            "connection_age_ms": (receive_time - connection_start_time) * 1000
                        }
                    }
                    await websocket.send_text(safe_serialize_message(echo_response))

                except Exception as parse_error:
                    # Echo back raw data if JSON parsing fails
                    logger.warning(f"[WS_ECHO] JSON parse error for {client_id}: {parse_error}")
                    echo_response = {
                        "type": "echo_raw",
                        "data": data,
                        "server_timestamp": receive_time,
                        "client_id": client_id
                    }
                    await websocket.send_text(safe_serialize_message(echo_response))

            except asyncio.TimeoutError:
                # Timeout is expected - allows us to send periodic pings
                continue

    except WebSocketDisconnect as disconnect_exc:
        close_code = getattr(disconnect_exc, 'code', 1000)
        close_reason = getattr(disconnect_exc, 'reason', 'Normal closure')
        duration = (time.time() - connection_start_time) * 1000
        logger.info(f"[WS_ECHO] {client_id} disconnected - code={close_code}, reason='{close_reason}', duration={duration:.2f}ms")

    except Exception as e:
        logger.error(f"[WS_ECHO] Error for {client_id}: {type(e).__name__}: {e}")

    finally:
        duration = (time.time() - connection_start_time) * 1000
        logger.info(f"[WS_ECHO] {client_id} connection ended - total_duration={duration:.2f}ms")


@router.websocket("/ws/health")
async def websocket_health_endpoint(websocket: WebSocket):
    """
    WebSocket health check endpoint for monitoring connection stability.

    Features:
    - Maintains connection with periodic heartbeats
    - Tests sustained connection over time (default: keep alive >30s)
    - Provides connection health metrics
    - Validates server-side ping/pong implementation
    - Reports connection quality statistics

    Use this endpoint to:
    - Verify WebSocket server stability
    - Test load balancer/proxy timeout settings
    - Monitor connection health in production
    - Validate heartbeat configuration
    """
    from models.serializers import safe_serialize_message

    client_id = f"health_client_{int(time.time() * 1000)}_{id(websocket)}"
    connection_start_time = time.time()

    # Diagnostics
    client_ip = getattr(websocket.client, 'host', 'unknown') if websocket.client else 'unknown'
    headers = dict(websocket.headers) if websocket.headers else {}
    origin = headers.get('origin', headers.get('referer', 'no_origin'))

    logger.info(f"[WS_HEALTH] Health check connection from {client_ip}, origin={origin}")

    # Origin validation
    if origin != "no_origin" and origin not in ALLOWED_ORIGINS and "chrome-extension://" not in origin:
        reason = f"Origin not allowed: {origin}"
        logger.warning(f"[WS_HEALTH] Rejecting connection - {reason}")
        await websocket.close(code=1008, reason=reason)
        return

    try:
        await websocket.accept()
        logger.info(f"[WS_HEALTH] {client_id} connected")

        # Send initial health status
        health_status = {
            "type": "health_status",
            "status": "connected",
            "client_id": client_id,
            "server_time": time.time(),
            "config": {
                "ping_interval": WS_PING_INTERVAL,
                "ping_timeout": WS_PING_TIMEOUT,
                "expected_min_connection_duration": 30  # seconds
            },
            "environment": {
                "allowed_origins": ALLOWED_ORIGINS,
                "public_base_url": PUBLIC_BASE_URL,
                "ws_public_url": WS_PUBLIC_URL
            }
        }
        await websocket.send_text(safe_serialize_message(health_status))

        # Health check metrics
        ping_count = 0
        pong_count = 0
        last_ping_time = time.time()

        # Keep connection alive for at least 30 seconds with heartbeats
        while True:
            current_time = time.time()
            connection_age = current_time - connection_start_time

            # Send periodic heartbeat
            if current_time - last_ping_time >= WS_PING_INTERVAL:
                ping_count += 1
                heartbeat = {
                    "type": "heartbeat",
                    "ping_number": ping_count,
                    "timestamp": current_time,
                    "connection_age_seconds": connection_age,
                    "client_id": client_id
                }
                await websocket.send_text(safe_serialize_message(heartbeat))
                last_ping_time = current_time
                logger.debug(f"[WS_HEALTH] Sent heartbeat #{ping_count} to {client_id} (age: {connection_age:.1f}s)")

            # Receive messages with timeout
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=min(WS_PING_INTERVAL / 2, 5.0)
                )

                try:
                    message = orjson.loads(data)
                    message_type = message.get('type', 'unknown')

                    if message_type == 'pong':
                        pong_count += 1
                        logger.debug(f"[WS_HEALTH] Received pong #{pong_count} from {client_id}")

                    elif message_type == 'get_status':
                        # Client requested current health status
                        # Recalculate connection age for accurate response
                        current_response_time = time.time()
                        response_connection_age = current_response_time - connection_start_time
                        status_response = {
                            "type": "health_status",
                            "status": "healthy",
                            "connection_age_seconds": response_connection_age,
                            "ping_count": ping_count,
                            "pong_count": pong_count,
                            "timestamp": current_response_time,
                            "client_id": client_id
                        }
                        await websocket.send_text(safe_serialize_message(status_response))
                        logger.debug(f"[WS_HEALTH] Sent status to {client_id}")

                except Exception as parse_error:
                    logger.warning(f"[WS_HEALTH] Parse error for {client_id}: {parse_error}")

            except asyncio.TimeoutError:
                # Expected - allows periodic heartbeats
                continue

    except WebSocketDisconnect as disconnect_exc:
        close_code = getattr(disconnect_exc, 'code', 1000)
        close_reason = getattr(disconnect_exc, 'reason', 'Normal closure')
        duration = (time.time() - connection_start_time) * 1000
        logger.info(f"[WS_HEALTH] {client_id} disconnected - code={close_code}, reason='{close_reason}', duration={duration:.2f}ms, pings={ping_count}, pongs={pong_count}")

    except Exception as e:
        logger.error(f"[WS_HEALTH] Error for {client_id}: {type(e).__name__}: {e}")

    finally:
        duration = (time.time() - connection_start_time) * 1000
        logger.info(f"[WS_HEALTH] {client_id} connection ended - duration={duration:.2f}ms, pings_sent={ping_count}, pongs_received={pong_count}")


@router.websocket("/ws/v3/scenarios/{path:path}/forecasts")
async def websocket_scenario_forecasts(websocket: WebSocket, path: str):
    """
    Real-time forecast updates via WebSocket
    Uses orjson serialization for datetime/dataclass objects
    P95 <200ms latency requirement
    """
    from models.serializers import safe_serialize_message

    client_id = f"scenario_{path}_{time.time()}"
    await connection_manager.connect(websocket, client_id)

    try:
        # Check feature flag - will be injected via dependency
        # For now, we'll skip the check since we need service injection

        while True:
            # Receive drill-down request from client
            data = await websocket.receive_json()

            action = data.get("action", "subscribe")
            drill_down = data.get("drill_down", False)

            if action == "subscribe":
                # Generate and stream forecast updates
                # This would use the forecast_manager service
                start_time = time.time()

                # Placeholder response - real implementation would call forecast_manager
                forecast = {
                    "status": "generated",
                    "path": path,
                    "drill_down": drill_down,
                    "data": []
                }

                duration_ms = (time.time() - start_time) * 1000

                response = {
                    "type": "forecast_update",
                    "path": path,
                    "drill_down": drill_down,
                    "forecast": forecast,
                    "timestamp": time.time(),
                    "latency_ms": duration_ms
                }

                await connection_manager.send_personal_message(response, client_id)

            elif action == "unsubscribe":
                break

    except WebSocketDisconnect:
        connection_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for scenario {path}: {e}")
        connection_manager.disconnect(client_id)
