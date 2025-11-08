"""
Tests for DatabaseManager

Tests cover:
- Connection pool initialization and cleanup
- Thread-safe connection management with RLock
- Connection retry logic with exponential backoff
- Context manager support
- Query execution methods (execute, fetch, fetchrow, fetchval)
- Materialized view refresh
- Connection pool health monitoring
- Pool utilization tracking
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, Mock
from typing import Optional

from services.database_manager import DatabaseManager


class TestDatabaseManager:
    """Test DatabaseManager functionality"""

    @pytest.fixture
    def db_url(self):
        """Provide test database URL"""
        return "postgresql://test_user@localhost:5432/test_db"

    @pytest.fixture
    def invalid_db_url(self):
        """Provide invalid database URL for testing validation"""
        return "invalid://url"

    @pytest.fixture
    def db_manager(self, db_url):
        """Create DatabaseManager instance for testing"""
        manager = DatabaseManager(
            database_url=db_url,
            min_connections=2,
            max_connections=10,
            command_timeout=30
        )
        return manager

    async def test_initialization_with_valid_url(self, db_url):
        """Test initialization with valid database URL"""
        # Arrange
        manager = DatabaseManager(database_url=db_url)

        # Act & Assert
        assert manager.database_url == db_url
        assert manager.min_connections == 5
        assert manager.max_connections == 20
        assert manager._pool is None

    async def test_initialization_with_invalid_url(self, invalid_db_url):
        """Test initialization fails with invalid URL"""
        # Arrange
        manager = DatabaseManager(database_url=invalid_db_url)

        # Act & Assert - should raise exception on initialize
        with pytest.raises(Exception):  # asyncpg raises ClientConfigurationError
            await manager.initialize()

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_pool_initialization(self, mock_create_pool, db_manager):
        """Test connection pool initialization"""
        # Arrange
        mock_pool = AsyncMock()
        async def create_pool_coro(*args, **kwargs):
            return mock_pool
        mock_create_pool.return_value = create_pool_coro()

        # Act
        await db_manager.initialize()

        # Assert
        assert db_manager._pool is not None
        mock_create_pool.assert_called_once()
        assert db_manager._health_monitor_running is True

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_double_initialization_is_idempotent(self, mock_create_pool, db_manager):
        """Test that calling initialize twice doesn't create multiple pools"""
        # Arrange
        mock_pool = AsyncMock()
        async def create_pool_coro(*args, **kwargs):
            return mock_pool
        mock_create_pool.return_value = create_pool_coro()

        # Act
        await db_manager.initialize()
        await db_manager.initialize()

        # Assert - should only be called once
        assert mock_create_pool.call_count == 1

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_close_pool(self, mock_create_pool, db_manager):
        """Test closing the connection pool"""
        # Arrange
        mock_pool = AsyncMock()
        mock_pool.close = AsyncMock()
        async def create_pool_coro(*args, **kwargs):
            return mock_pool
        mock_create_pool.return_value = create_pool_coro()
        await db_manager.initialize()

        # Act
        await db_manager.close()

        # Assert
        mock_pool.close.assert_called_once()
        assert db_manager._pool is None
        assert db_manager._health_monitor_running is False

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_get_connection(self, mock_create_pool, db_manager):
        """Test getting a connection from the pool"""
        # Arrange
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value="SELECT 1")

        mock_pool = AsyncMock()
        mock_pool.acquire = MagicMock(
            return_value=MockAsyncContextManager(mock_conn)
        )
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act
        async with db_manager.get_connection() as conn:
            result = await conn.execute("SELECT 1")

        # Assert
        assert result == "SELECT 1"
        mock_conn.execute.assert_called()

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_execute_query(self, mock_create_pool, db_manager):
        """Test executing a query"""
        # Arrange
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value="INSERT 1")

        mock_pool = AsyncMock()
        mock_pool.acquire = MagicMock(
            return_value=MockAsyncContextManager(mock_conn)
        )
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act
        result = await db_manager.execute("INSERT INTO test VALUES ($1)", "value")

        # Assert
        assert result == "INSERT 1"
        mock_conn.execute.assert_called_once()

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_fetch_rows(self, mock_create_pool, db_manager):
        """Test fetching multiple rows"""
        # Arrange
        expected_rows = [{"id": 1, "name": "test1"}, {"id": 2, "name": "test2"}]
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value="SELECT 1")
        mock_conn.fetch = AsyncMock(return_value=expected_rows)

        mock_pool = AsyncMock()
        mock_pool.acquire = MagicMock(
            return_value=MockAsyncContextManager(mock_conn)
        )
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act
        rows = await db_manager.fetch("SELECT * FROM test")

        # Assert
        assert rows == expected_rows
        mock_conn.fetch.assert_called_once()

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_fetchrow(self, mock_create_pool, db_manager):
        """Test fetching a single row"""
        # Arrange
        expected_row = {"id": 1, "name": "test"}
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value="SELECT 1")
        mock_conn.fetchrow = AsyncMock(return_value=expected_row)

        mock_pool = AsyncMock()
        mock_pool.acquire = MagicMock(
            return_value=MockAsyncContextManager(mock_conn)
        )
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act
        row = await db_manager.fetchrow("SELECT * FROM test WHERE id = $1", 1)

        # Assert
        assert row == expected_row
        mock_conn.fetchrow.assert_called_once()

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_fetchval(self, mock_create_pool, db_manager):
        """Test fetching a single value"""
        # Arrange
        expected_val = 42
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value="SELECT 1")
        mock_conn.fetchval = AsyncMock(return_value=expected_val)

        mock_pool = AsyncMock()
        mock_pool.acquire = MagicMock(
            return_value=MockAsyncContextManager(mock_conn)
        )
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act
        val = await db_manager.fetchval("SELECT COUNT(*) FROM test")

        # Assert
        assert val == expected_val
        mock_conn.fetchval.assert_called_once()

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_refresh_hierarchy_views(self, mock_create_pool, db_manager):
        """Test refreshing materialized views"""
        # Arrange
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value="REFRESH")

        mock_pool = AsyncMock()
        mock_pool.acquire = MagicMock(
            return_value=MockAsyncContextManager(mock_conn)
        )
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act
        await db_manager.refresh_hierarchy_views()

        # Assert
        # Should execute REFRESH MATERIALIZED VIEW twice (for mv_entity_ancestors and mv_descendant_counts)
        assert mock_conn.execute.call_count >= 3  # SELECT 1 + 2 refreshes

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_connection_retry_on_failure(self, mock_create_pool, db_manager):
        """Test connection retry logic with exponential backoff"""
        # Arrange
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(side_effect=[
            Exception("Connection failed"),
            Exception("Connection failed"),
            "SELECT 1"  # Third attempt succeeds
        ])

        mock_pool = AsyncMock()
        mock_pool.acquire = MagicMock(
            return_value=MockAsyncContextManager(mock_conn)
        )
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act
        async with db_manager.get_connection() as conn:
            result = await conn.execute("SELECT 1")

        # Assert
        assert mock_conn.execute.call_count == 3
        assert result == "SELECT 1"

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_connection_retry_exhaustion(self, mock_create_pool, db_manager):
        """Test connection fails after all retries exhausted"""
        # Arrange
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(side_effect=Exception("Connection failed"))

        mock_pool = AsyncMock()
        mock_pool.acquire = MagicMock(
            return_value=MockAsyncContextManager(mock_conn)
        )
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act & Assert
        with pytest.raises(Exception, match="Connection failed"):
            async with db_manager.get_connection() as conn:
                await conn.execute("SELECT 1")

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_async_context_manager(self, mock_create_pool, db_url):
        """Test DatabaseManager as async context manager"""
        # Arrange
        mock_pool = AsyncMock()
        mock_pool.close = AsyncMock()
        # Make create_pool actually awaitable
        async def create_pool_coro(*args, **kwargs):
            return mock_pool
        mock_create_pool.return_value = create_pool_coro()

        # Act
        async with DatabaseManager(database_url=db_url) as manager:
            assert manager._pool is not None

        # Assert - pool should be closed after context exit
        mock_pool.close.assert_called_once()

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_pool_size_property(self, mock_create_pool, db_manager):
        """Test pool size property"""
        # Arrange
        mock_pool = AsyncMock()
        mock_pool.get_size = Mock(return_value=5)
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act
        size = db_manager.pool_size

        # Assert
        assert size == 5

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_pool_utilization(self, mock_create_pool, db_manager):
        """Test pool utilization calculation"""
        # Arrange
        mock_pool = AsyncMock()
        mock_pool.get_size = Mock(return_value=8)
        mock_pool.get_max_size = Mock(return_value=10)
        mock_create_pool.return_value = mock_pool
        await db_manager.initialize()

        # Act
        utilization = db_manager.pool_utilization

        # Assert
        assert utilization == 0.8  # 8/10 = 80%

    @patch('services.database_manager.asyncpg.create_pool')
    async def test_health_monitoring_starts(self, mock_create_pool, db_manager):
        """Test that health monitoring thread starts on initialization"""
        # Arrange
        mock_pool = AsyncMock()
        mock_create_pool.return_value = mock_pool

        # Act
        await db_manager.initialize()

        # Assert
        assert db_manager._health_monitor_running is True
        assert db_manager._health_monitor_thread is not None
        assert db_manager._health_monitor_thread.is_alive()

        # Cleanup
        await db_manager.close()

    def test_uses_rlock_not_lock(self, db_manager):
        """Test that DatabaseManager uses RLock (not standard Lock)"""
        # Assert
        import threading
        assert isinstance(db_manager._lock, threading.RLock)

    def test_exponential_backoff_delays(self, db_manager):
        """Test exponential backoff delay configuration"""
        # Assert
        assert db_manager._retry_attempts == 3
        assert db_manager._retry_delays == [0.5, 1.0, 2.0]

    def test_pool_utilization_warning_threshold(self, db_manager):
        """Test pool utilization warning threshold is 80%"""
        # Assert
        assert db_manager._pool_utilization_warning_threshold == 0.8


# Helper class for mocking async context manager
class MockAsyncContextManager:
    """Mock async context manager for testing"""

    def __init__(self, return_value):
        self.return_value = return_value

    async def __aenter__(self):
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
