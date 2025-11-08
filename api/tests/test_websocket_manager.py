"""
Tests for WebSocketManager

Tests cover:
- WebSocket connection lifecycle (connect/disconnect)
- Message serialization with orjson and json fallback
- Message batching for high-frequency updates
- Broadcasting to connected clients
- Channel subscription/unsubscription
- Heartbeat mechanism
- Connection health monitoring
- Performance metrics tracking
- Error handling and graceful degradation
"""

import pytest
import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch, Mock
from datetime import datetime
from typing import Dict, Any

from services.websocket_manager import (
    WebSocketManager,
    WebSocketMessage,
    ConnectionStats,
    safe_serialize_message,
    SerializationError
)


class TestWebSocketMessage:
    """Test WebSocketMessage dataclass"""

    def test_message_initialization(self):
        """Test message initialization with automatic timestamp"""
        # Act
        message = WebSocketMessage(type="test", data={"key": "value"})

        # Assert
        assert message.type == "test"
        assert message.data == {"key": "value"}
        assert message.timestamp is not None
        assert message.message_id is not None
        assert message.message_id.startswith("msg_")

    def test_message_with_custom_timestamp(self):
        """Test message initialization with custom timestamp"""
        # Arrange
        custom_timestamp = time.time()

        # Act
        message = WebSocketMessage(
            type="custom",
            data="test",
            timestamp=custom_timestamp
        )

        # Assert
        assert message.timestamp == custom_timestamp


class TestConnectionStats:
    """Test ConnectionStats dataclass"""

    def test_is_alive_with_recent_activity(self):
        """Test connection is alive with recent activity"""
        # Arrange
        stats = ConnectionStats(
            last_activity=time.time(),
            connect_time=time.time()
        )

        # Act & Assert
        assert stats.is_alive is True

    def test_is_alive_with_stale_activity(self):
        """Test connection is not alive with stale activity"""
        # Arrange
        stale_time = time.time() - 400  # > 5 minutes
        stats = ConnectionStats(
            last_activity=stale_time,
            connect_time=time.time()
        )

        # Act & Assert
        assert stats.is_alive is False

    def test_connection_age(self):
        """Test connection age calculation"""
        # Arrange
        connect_time = time.time() - 100  # 100 seconds ago
        stats = ConnectionStats(connect_time=connect_time)

        # Act
        age = stats.connection_age

        # Assert
        assert age >= 99  # Allow small variance
        assert age <= 101


class TestSafeSerializeMessage:
    """Test safe_serialize_message function"""

    def test_serialize_websocket_message(self):
        """Test serialization of WebSocketMessage"""
        # Arrange
        message = WebSocketMessage(
            type="test",
            data={"key": "value"}
        )

        # Act
        result = safe_serialize_message(message)

        # Assert
        assert isinstance(result, str)
        parsed = json.loads(result)
        assert parsed["type"] == "test"
        assert parsed["data"] == {"key": "value"}

    def test_serialize_dict_message(self):
        """Test serialization of dictionary"""
        # Arrange
        message = {"type": "test", "data": "value"}

        # Act
        result = safe_serialize_message(message)

        # Assert
        assert isinstance(result, str)
        parsed = json.loads(result)
        assert parsed["type"] == "test"
        assert parsed["data"] == "value"

    def test_serialize_primitive_message(self):
        """Test serialization of primitive type"""
        # Arrange
        message = "simple string"

        # Act
        result = safe_serialize_message(message)

        # Assert
        assert isinstance(result, str)
        parsed = json.loads(result)
        assert parsed["type"] == "data"
        assert parsed["data"] == "simple string"
        assert "timestamp" in parsed

    def test_serialize_datetime_object(self):
        """Test serialization with datetime objects"""
        # Arrange
        message = {
            "type": "test",
            "timestamp": datetime(2024, 1, 1, 12, 0, 0)
        }

        # Act
        result = safe_serialize_message(message)

        # Assert
        assert isinstance(result, str)
        parsed = json.loads(result)
        assert "2024" in str(parsed["timestamp"])

    def test_serialize_with_fallback(self):
        """Test serialization fallback on complex objects"""
        # Arrange
        class CustomObject:
            def __str__(self):
                return "custom_object"

        message = {"type": "test", "obj": CustomObject()}

        # Act
        result = safe_serialize_message(message)

        # Assert - should not raise exception
        assert isinstance(result, str)


class TestWebSocketManager:
    """Test WebSocketManager core functionality"""

    @pytest.fixture
    def manager(self):
        """Create WebSocketManager instance"""
        return WebSocketManager(
            max_connections=10,
            message_batch_size=5,
            batch_timeout=0.1,
            heartbeat_interval=30.0,
            enable_metrics=True
        )

    @pytest.fixture
    def mock_websocket(self):
        """Create mock WebSocket connection"""
        ws = AsyncMock()
        ws.send = AsyncMock()
        return ws

    async def test_manager_initialization(self, manager):
        """Test WebSocketManager initialization"""
        # Assert
        assert manager.max_connections == 10
        assert manager.message_batch_size == 5
        assert manager.batch_timeout == 0.1
        assert manager.heartbeat_interval == 30.0
        assert manager.enable_metrics is True
        assert manager._running is False
        assert len(manager._clients) == 0

    async def test_start_and_stop(self, manager):
        """Test starting and stopping the manager"""
        # Act - Start
        await manager.start()

        # Assert
        assert manager._running is True
        assert manager._heartbeat_task is not None

        # Act - Stop
        await manager.stop()

        # Assert
        assert manager._running is False

    async def test_connect_client(self, manager, mock_websocket):
        """Test connecting a WebSocket client"""
        # Disable batching for this test to ensure immediate sends
        manager._batching_enabled = False

        # Act
        await manager.connect(mock_websocket, "client_1")

        # Assert
        assert "client_1" in manager._clients
        assert manager._clients["client_1"] == mock_websocket
        assert "client_1" in manager._client_stats
        assert manager._client_stats["client_1"].connect_time is not None

        # Should send welcome message
        mock_websocket.send.assert_called_once()
        call_args = mock_websocket.send.call_args[0][0]
        parsed = json.loads(call_args)
        assert parsed["type"] == "connection_established"
        assert parsed["client_id"] == "client_1"

    async def test_connect_exceeds_max_connections(self, manager, mock_websocket):
        """Test connecting when max connections is reached"""
        # Arrange - Fill up connections
        for i in range(manager.max_connections):
            ws = AsyncMock()
            ws.send = AsyncMock()
            await manager.connect(ws, f"client_{i}")

        # Act & Assert
        with pytest.raises(ConnectionError) as exc_info:
            await manager.connect(mock_websocket, "client_overflow")

        assert "Maximum connections" in str(exc_info.value)

    async def test_disconnect_client(self, manager, mock_websocket):
        """Test disconnecting a WebSocket client"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")
        await manager.subscribe_to_channel("client_1", "test_channel")

        # Act
        await manager.disconnect("client_1", "Test disconnect")

        # Assert
        assert "client_1" not in manager._clients
        assert "client_1" not in manager._client_stats
        assert "client_1" not in manager._broadcast_channels["test_channel"]

    async def test_send_to_client_no_batch(self, manager, mock_websocket):
        """Test sending message to client without batching"""
        # Arrange
        manager._batching_enabled = False
        await manager.connect(mock_websocket, "client_1")
        message = {"type": "test", "data": "hello"}

        # Act
        success = await manager.send_to_client("client_1", message, use_batch=False)

        # Assert
        assert success is True
        assert mock_websocket.send.call_count == 2  # Welcome + test message

        # Check the test message (second call)
        call_args = mock_websocket.send.call_args_list[1][0][0]
        parsed = json.loads(call_args)
        assert parsed["type"] == "test"
        assert parsed["data"] == "hello"

    async def test_send_to_nonexistent_client(self, manager):
        """Test sending message to non-existent client"""
        # Act
        success = await manager.send_to_client("nonexistent", {"test": "data"})

        # Assert
        assert success is False

    async def test_send_oversized_message(self, manager, mock_websocket):
        """Test sending message exceeding max size"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")
        large_data = "x" * (manager.max_message_size + 1000)
        message = {"type": "test", "data": large_data}

        # Act
        success = await manager.send_to_client("client_1", message, use_batch=False)

        # Assert
        assert success is False

    async def test_broadcast_to_all_clients(self, manager):
        """Test broadcasting message to all clients"""
        # Arrange
        manager._batching_enabled = False
        clients = []
        for i in range(3):
            ws = AsyncMock()
            ws.send = AsyncMock()
            await manager.connect(ws, f"client_{i}")
            clients.append(ws)

        message = {"type": "broadcast", "data": "test"}

        # Act
        results = await manager.broadcast(message, use_batch=False)

        # Assert
        assert len(results) == 3
        assert all(results.values())  # All should be True

        # Each client should receive the message (plus welcome)
        for ws in clients:
            assert ws.send.call_count == 2

    async def test_broadcast_to_channel(self, manager):
        """Test broadcasting to specific channel"""
        # Arrange
        ws1 = AsyncMock()
        ws1.send = AsyncMock()
        ws2 = AsyncMock()
        ws2.send = AsyncMock()
        ws3 = AsyncMock()
        ws3.send = AsyncMock()

        await manager.connect(ws1, "client_1")
        await manager.connect(ws2, "client_2")
        await manager.connect(ws3, "client_3")

        await manager.subscribe_to_channel("client_1", "premium")
        await manager.subscribe_to_channel("client_2", "premium")

        message = {"type": "premium_update", "data": "exclusive"}

        # Act
        results = await manager.broadcast(message, channel="premium", use_batch=False)

        # Assert
        assert len(results) == 2  # Only subscribed clients
        assert "client_1" in results
        assert "client_2" in results
        assert "client_3" not in results

    async def test_broadcast_exclude_client(self, manager):
        """Test broadcasting with client exclusion"""
        # Arrange
        ws1 = AsyncMock()
        ws1.send = AsyncMock()
        ws2 = AsyncMock()
        ws2.send = AsyncMock()

        await manager.connect(ws1, "client_1")
        await manager.connect(ws2, "client_2")

        message = {"type": "update", "data": "test"}

        # Act
        results = await manager.broadcast(
            message,
            exclude_client="client_1",
            use_batch=False
        )

        # Assert
        assert "client_1" not in results
        assert "client_2" in results

    async def test_subscribe_to_channel(self, manager, mock_websocket):
        """Test subscribing client to channel"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")

        # Act
        success = await manager.subscribe_to_channel("client_1", "news")

        # Assert
        assert success is True
        assert "client_1" in manager._broadcast_channels["news"]

    async def test_unsubscribe_from_channel(self, manager, mock_websocket):
        """Test unsubscribing client from channel"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")
        await manager.subscribe_to_channel("client_1", "news")

        # Act
        success = await manager.unsubscribe_from_channel("client_1", "news")

        # Assert
        assert success is True
        assert "client_1" not in manager._broadcast_channels["news"]

    async def test_handle_ping_message(self, manager, mock_websocket):
        """Test handling ping message from client"""
        # Arrange
        manager._batching_enabled = False
        await manager.connect(mock_websocket, "client_1")
        ping_message = json.dumps({"type": "ping"})

        # Act
        await manager.handle_message("client_1", ping_message)

        # Assert - Should send pong (welcome + pong = 2 calls)
        assert mock_websocket.send.call_count == 2
        pong_call = mock_websocket.send.call_args_list[1][0][0]
        parsed = json.loads(pong_call)
        assert parsed["type"] == "pong"

    async def test_handle_subscribe_message(self, manager, mock_websocket):
        """Test handling subscribe message from client"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")
        subscribe_message = json.dumps({"type": "subscribe", "channel": "updates"})

        # Act
        await manager.handle_message("client_1", subscribe_message)

        # Assert
        assert "client_1" in manager._broadcast_channels["updates"]

    async def test_handle_invalid_json(self, manager, mock_websocket):
        """Test handling invalid JSON from client"""
        # Arrange
        manager._batching_enabled = False
        await manager.connect(mock_websocket, "client_1")
        invalid_json = "this is not json"

        # Act
        await manager.handle_message("client_1", invalid_json)

        # Assert - Should send error message
        assert mock_websocket.send.call_count == 2  # Welcome + error
        error_call = mock_websocket.send.call_args_list[1][0][0]
        parsed = json.loads(error_call)
        assert parsed["type"] == "error"

    async def test_message_batching(self, manager, mock_websocket):
        """Test message batching functionality"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")

        # Act - Send multiple messages with batching
        for i in range(3):
            await manager.send_to_client(
                "client_1",
                {"type": "batch_test", "index": i},
                use_batch=True
            )

        # Wait for batch timeout
        await asyncio.sleep(0.2)

        # Assert - Should batch messages together
        assert mock_websocket.send.call_count >= 1

    async def test_get_metrics(self, manager, mock_websocket):
        """Test getting performance metrics"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")
        await manager.send_to_client("client_1", {"type": "test"}, use_batch=False)

        # Act
        metrics = manager.get_metrics()

        # Assert
        assert "connections" in metrics
        assert metrics["connections"]["total"] == 1
        assert "messages" in metrics
        assert metrics["messages"]["sent_total"] >= 1
        assert "errors" in metrics
        assert "performance" in metrics
        assert "batching" in metrics
        assert "channels" in metrics

    async def test_health_check(self, manager, mock_websocket):
        """Test health check functionality"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")

        # Act
        health = await manager.health_check()

        # Assert
        assert "status" in health
        assert health["status"] == "healthy"
        assert "connections" in health
        assert "batching" in health
        assert "errors" in health

    async def test_connection_stats_update(self, manager, mock_websocket):
        """Test that connection stats are updated"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")

        # Act
        await manager.send_to_client("client_1", {"type": "test"}, use_batch=False)

        # Assert
        stats = manager._client_stats["client_1"]
        assert stats.messages_sent > 0
        assert stats.bytes_sent > 0
        assert stats.last_activity is not None

    async def test_cleanup_dead_connections(self, manager, mock_websocket):
        """Test cleanup of dead connections"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")

        # Manually set last_activity to old time
        manager._client_stats["client_1"].last_activity = time.time() - 400

        # Act
        await manager._cleanup_dead_connections()

        # Assert
        assert "client_1" not in manager._clients

    async def test_metrics_tracking(self, manager, mock_websocket):
        """Test that metrics are properly tracked"""
        # Arrange
        await manager.connect(mock_websocket, "client_1")

        # Act
        await manager.send_to_client("client_1", {"type": "test"}, use_batch=False)
        await manager.handle_message("client_1", json.dumps({"type": "ping"}))

        # Assert
        assert manager._total_messages_sent >= 1
        assert manager._total_messages_received >= 1
        assert manager._total_bytes_sent > 0
        assert manager._total_bytes_received > 0
