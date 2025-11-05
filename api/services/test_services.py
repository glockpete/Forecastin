"""
Comprehensive tests for service classes.

Tests the core functionality of:
- DatabaseManager: Connection pooling and context manager support
- CacheService: Multi-tier caching with Redis and memory LRU
- WebSocketManager: orjson serialization and broadcasting
- safe_serialize_message: Handles datetime/dataclass objects with fallback

Following testing patterns from AGENTS.md.
"""

import asyncio
import json
import logging
import pytest
import threading
import time
from datetime import datetime, timezone
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

# Import our service classes
from .database_manager import DatabaseManager
from .cache_service import CacheService, LRUMemoryCache
from .websocket_manager import WebSocketManager, WebSocketMessage, safe_serialize_message


# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class TestDataClass:
    """Test dataclass for serialization testing."""
    name: str
    value: int
    timestamp: datetime


class TestSafeSerializeMessage:
    """Test safe_serialize_message function."""
    
    def test_dict_serialization(self):
        """Test basic dict serialization."""
        message = {"type": "test", "data": {"key": "value"}}
        result = safe_serialize_message(message)
        
        # Should be valid JSON
        parsed = json.loads(result)
        assert parsed["type"] == "test"
        assert parsed["data"]["key"] == "value"
        assert "timestamp" in parsed  # Should auto-add timestamp
    
    def test_datetime_serialization(self):
        """Test datetime object serialization."""
        dt = datetime(2025, 11, 5, 3, 45, 0, tzinfo=timezone.utc)
        message = {"type": "datetime_test", "datetime": dt}
        
        result = safe_serialize_message(message)
        parsed = json.loads(result)
        
        # Should convert datetime to ISO format
        assert "2025-11-05T03:45:00+00:00" in parsed["datetime"]
    
    def test_dataclass_serialization(self):
        """Test dataclass serialization."""
        test_obj = TestDataClass(
            name="test",
            value=42,
            timestamp=datetime(2025, 11, 5, 3, 45, 0, tzinfo=timezone.utc)
        )
        message = {"type": "dataclass_test", "object": test_obj}
        
        result = safe_serialize_message(message)
        parsed = json.loads(result)
        
        # Should convert dataclass to dict
        obj_dict = parsed["object"]
        assert obj_dict["name"] == "test"
        assert obj_dict["value"] == 42
        assert "timestamp" in obj_dict
    
    def test_websocket_message_serialization(self):
        """Test WebSocketMessage serialization."""
        ws_msg = WebSocketMessage(
            type="test",
            data={"message": "hello"},
            client_id="test_client"
        )
        
        result = safe_serialize_message(ws_msg)
        parsed = json.loads(result)
        
        assert parsed["type"] == "test"
        assert parsed["data"]["message"] == "hello"
        assert parsed["client_id"] == "test_client"
        assert "timestamp" in parsed
    
    def test_circular_reference_handling(self):
        """Test handling of circular references."""
        obj = {"name": "test"}
        obj["self_ref"] = obj  # Create circular reference
        
        message = {"type": "circular_test", "data": obj}
        
        # Should not crash, should handle gracefully
        result = safe_serialize_message(message)
        parsed = json.loads(result)
        
        assert parsed["type"] == "circular_test"
        # The circular reference might become a string representation
    
    def test_fallback_on_serialization_error(self):
        """Test fallback when serialization completely fails."""
        
        class UnserializableClass:
            def __init__(self):
                self.value = "test"
            
            def __getattr__(self, name):
                if name == "__dict__":
                    raise Exception("Cannot serialize")
                raise AttributeError(name)
        
        message = UnserializableClass()
        
        # Should return structured error message instead of crashing
        result = safe_serialize_message(message)
        parsed = json.loads(result)
        
        assert parsed["type"] == "serialization_error"
        assert "fallback" in parsed


class TestLRUMemoryCache:
    """Test LRU memory cache implementation."""
    
    def test_basic_operations(self):
        """Test basic get/set/delete operations."""
        cache = LRUMemoryCache(max_size=5)
        
        # Test set and get
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
        
        # Test delete
        cache.delete("key1")
        assert cache.get("key1") is None
        
        # Test LRU eviction
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")
        cache.set("key4", "value4")
        cache.set("key5", "value5")
        cache.set("key6", "value6")  # Should evict key1 (LRU)
        
        assert cache.get("key1") is None  # Evicted
        assert cache.get("key2") == "value2"
    
    def test_ttl_expiration(self):
        """Test TTL expiration."""
        cache = LRUMemoryCache(max_size=10)
        
        # Set with 1 second TTL
        cache.set("key1", "value1", ttl=1)
        
        # Should be available immediately
        assert cache.get("key1") == "value1"
        
        # Wait for expiration
        time.sleep(1.1)
        
        # Should be expired
        assert cache.get("key1") is None
    
    def test_thread_safety(self):
        """Test thread safety with RLock."""
        cache = LRUMemoryCache(max_size=1000)
        results = []
        
        def worker():
            for i in range(100):
                cache.set(f"key_{threading.current_thread().ident}_{i}", f"value_{i}")
                value = cache.get(f"key_{threading.current_thread().ident}_{i}")
                results.append(value)
        
        # Create multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=worker)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Should have no errors
        assert None not in results
        
        # Check metrics
        metrics = cache.get_metrics()
        assert metrics.hits > 0 or metrics.misses > 0


class TestDatabaseManager:
    """Test DatabaseManager implementation."""
    
    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Test async context manager support."""
        
        # Mock asyncpg
        with patch('api.services.database_manager.asyncpg') as mock_asyncpg:
            mock_pool = AsyncMock()
            mock_asyncpg.create_pool.return_value = mock_pool
            
            db_manager = DatabaseManager(
                database_url="postgresql://test:test@localhost/test",
                min_connections=2,
                max_connections=5
            )
            
            # Test context manager
            async with db_manager as db:
                assert db is db_manager
                assert db_manager._pool is not None
            
            # Should call close on exit
            mock_pool.close.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_connection_pool_initialization(self):
        """Test connection pool initialization with TCP keepalives."""
        
        with patch('api.services.database_manager.asyncpg') as mock_asyncpg:
            mock_pool = AsyncMock()
            mock_asyncpg.create_pool.return_value = mock_pool
            
            db_manager = DatabaseManager(
                database_url="postgresql://test:test@localhost/test"
            )
            
            await db_manager.initialize()
            
            # Should call create_pool with correct settings
            mock_asyncpg.create_pool.assert_called_once()
            call_args = mock_asyncpg.create_pool.call_args
            
            # Check TCP keepalive settings
            assert "keepalives_idle" in call_args.kwargs["server_settings"]
            assert "keepalives_interval" in call_args.kwargs["server_settings"]
            assert "keepalives_count" in call_args.kwargs["server_settings"]
            
            # Check pool_pre_ping
            assert call_args.kwargs["pool_pre_ping"] is True
    
    @pytest.mark.asyncio
    async def test_refresh_hierarchy_views(self):
        """Test materialized view refresh functionality."""
        
        with patch('api.services.database_manager.asyncpg') as mock_asyncpg:
            mock_pool = AsyncMock()
            mock_conn = AsyncMock()
            mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
            mock_asyncpg.create_pool.return_value = mock_pool
            
            db_manager = DatabaseManager(
                database_url="postgresql://test:test@localhost/test"
            )
            await db_manager.initialize()
            
            await db_manager.refresh_hierarchy_views()
            
            # Should execute REFRESH MATERIALIZED VIEW commands
            calls = mock_conn.execute.call_args_list
            assert len(calls) == 2
            
            # Check the refresh calls
            refresh_calls = [call[0][0] for call in calls]
            assert any("mv_entity_ancestors" in call for call in refresh_calls)
            assert any("mv_descendant_counts" in call for call in refresh_calls)


class TestCacheService:
    """Test CacheService implementation."""
    
    @pytest.mark.asyncio
    async def test_multi_tier_caching(self):
        """Test L1 memory and L2 Redis caching."""
        
        # Mock aioredis
        with patch('api.services.cache_service.aioredis') as mock_aioredis:
            mock_redis = AsyncMock()
            mock_redis_pool = AsyncMock()
            mock_redis_pool.from_url.return_value = mock_redis_pool
            mock_redis.connection_pool = mock_redis_pool
            mock_aioredis.Redis.return_value = mock_redis
            mock_aioredis.ConnectionPool.from_url.return_value = mock_redis_pool
            mock_redis.ping.return_value = True
            
            cache_service = CacheService(
                redis_url="redis://localhost:6379/0",
                max_memory_cache_size=10
            )
            
            await cache_service.initialize()
            
            # Test L1 memory cache
            await cache_service.set("memory_test", "memory_value")
            value = await cache_service.get("memory_test")
            assert value == "memory_value"
            
            # Test L2 Redis (mock)
            mock_redis.get.return_value = b'"redis_value"'
            await cache_service.set("redis_test", "redis_value")
            
            # Clear memory cache to test Redis
            cache_service._memory_cache.clear()
            value = await cache_service.get("redis_test")
            assert value == "redis_value"
    
    @pytest.mark.asyncio
    async def test_cache_metrics(self):
        """Test cache performance metrics."""
        
        # Mock Redis to avoid actual connection
        with patch('api.services.cache_service.aioredis'):
            cache_service = CacheService(enable_metrics=True)
            # Don't initialize Redis to test memory-only metrics
            
            # Generate some cache activity
            cache_service._memory_cache.set("key1", "value1")
            cache_service._memory_cache.get("key1")  # Hit
            cache_service._memory_cache.get("nonexistent")  # Miss
            
            metrics = cache_service.get_metrics()
            
            assert metrics["overall"]["total_hits"] > 0
            assert metrics["overall"]["total_misses"] > 0
            assert metrics["overall"]["hit_rate"] > 0


class TestWebSocketManager:
    """Test WebSocketManager implementation."""
    
    @pytest.mark.asyncio
    async def test_connection_management(self):
        """Test WebSocket connection management."""
        
        ws_manager = WebSocketManager(max_connections=100)
        await ws_manager.start()
        
        # Mock WebSocket
        mock_websocket = AsyncMock()
        
        # Test connection
        await ws_manager.connect(mock_websocket, "test_client")
        
        assert "test_client" in ws_manager._clients
        assert "test_client" in ws_manager._client_stats
        
        # Test disconnection
        await ws_manager.disconnect("test_client")
        
        assert "test_client" not in ws_manager._clients
        
        await ws_manager.stop()
    
    @pytest.mark.asyncio
    async def test_message_sending(self):
        """Test message sending with orjson serialization."""
        
        ws_manager = WebSocketManager()
        await ws_manager.start()
        
        # Mock WebSocket
        mock_websocket = AsyncMock()
        mock_websocket.send = AsyncMock()
        
        await ws_manager.connect(mock_websocket, "test_client")
        
        # Test sending different message types
        test_cases = [
            {"type": "dict", "data": {"message": "test"}},
            WebSocketMessage(type="ws_msg", data={"hello": "world"}),
            {"type": "datetime", "datetime": datetime.now()},
            TestDataClass(name="test", value=42, timestamp=datetime.now())
        ]
        
        for message in test_cases:
            success = await ws_manager.send_to_client("test_client", message)
            assert success is True
            
            # Verify send was called
            mock_websocket.send.assert_called()
            mock_websocket.send.reset_mock()
        
        await ws_manager.stop()
    
    @pytest.mark.asyncio
    async def test_broadcasting(self):
        """Test broadcasting to multiple clients."""
        
        ws_manager = WebSocketManager()
        await ws_manager.start()
        
        # Mock multiple WebSockets
        clients = {}
        for i in range(3):
            ws = AsyncMock()
            ws.send = AsyncMock()
            clients[f"client_{i}"] = ws
            
            await ws_manager.connect(ws, f"client_{i}")
        
        # Test broadcast
        message = {"type": "broadcast", "message": "hello all"}
        results = await ws_manager.broadcast(message)
        
        # Should attempt to send to all clients
        assert len(results) == 3
        assert all(success for success in results.values())
        
        await ws_manager.stop()
    
    @pytest.mark.asyncio
    async def test_channel_subscriptions(self):
        """Test broadcast channel subscriptions."""
        
        ws_manager = WebSocketManager()
        await ws_manager.start()
        
        # Mock WebSocket
        mock_websocket = AsyncMock()
        await ws_manager.connect(mock_websocket, "test_client")
        
        # Test channel subscription
        await ws_manager.subscribe_to_channel("test_client", "updates")
        
        assert "test_client" in ws_manager._broadcast_channels["updates"]
        
        # Test channel broadcast
        await ws_manager.broadcast(
            {"type": "update", "message": "test"},
            channel="updates"
        )
        
        # Client should receive the message
        mock_websocket.send.assert_called()
        
        await ws_manager.stop()
    
    def test_websocket_metrics(self):
        """Test WebSocket performance metrics."""
        
        ws_manager = WebSocketManager(enable_metrics=True)
        
        # Generate some activity
        ws_manager._total_messages_sent = 10
        ws_manager._total_messages_received = 5
        ws_manager._total_bytes_sent = 1024
        ws_manager._total_bytes_received = 512
        
        metrics = ws_manager.get_metrics()
        
        assert metrics["messages"]["sent_total"] == 10
        assert metrics["messages"]["received_total"] == 5
        assert metrics["messages"]["bytes_sent"] == 1024
        assert metrics["messages"]["bytes_received"] == 512


def test_performance_targets():
    """Test that implementations meet performance targets from AGENTS.md."""
    
    # Test L1 cache hit rate target: >90%
    cache = LRUMemoryCache(max_size=10000)
    
    # Generate some cache traffic
    for i in range(1000):
        cache.set(f"key_{i}", f"value_{i}")
    
    # Access half of the keys to generate hits
    for i in range(500):
        cache.get(f"key_{i}")
    
    # Access some new keys to generate misses
    for i in range(500, 600):
        cache.get(f"key_{i}")
    
    metrics = cache.get_metrics()
    hit_rate = metrics.hit_rate
    
    print(f"L1 Cache Hit Rate: {hit_rate:.2f}%")
    assert hit_rate >= 90.0, f"Hit rate {hit_rate}% below target 90%"
    
    # Test serialization performance
    message = {
        "type": "performance_test",
        "data": {"large_payload": "x" * 1000},
        "timestamp": datetime.now()
    }
    
    # Should serialize quickly
    start_time = time.time()
    for _ in range(1000):
        result = safe_serialize_message(message)
        json.loads(result)  # Validate it's valid JSON
    end_time = time.time()
    
    serialization_time = end_time - start_time
    print(f"1000 serializations took: {serialization_time:.3f}s")
    
    # Should be able to handle at least 1000 serializations per second
    ops_per_second = 1000 / serialization_time
    assert ops_per_second >= 1000, f"Serialization too slow: {ops_per_second:.0f} ops/sec"


if __name__ == "__main__":
    # Run basic tests if executed directly
    print("Running service class tests...")
    
    # Test serialization
    test_serialize = TestSafeSerializeMessage()
    test_serialize.test_dict_serialization()
    test_serialize.test_datetime_serialization()
    test_serialize.test_dataclass_serialization()
    test_serialize.test_websocket_message_serialization()
    test_serialize.test_circular_reference_handling()
    test_serialize.test_fallback_on_serialization_error()
    
    # Test LRU cache
    test_cache = TestLRUMemoryCache()
    test_cache.test_basic_operations()
    test_cache.test_ttl_expiration()
    test_cache.test_thread_safety()
    
    # Test performance targets
    test_performance_targets()
    
    print("All tests passed!")