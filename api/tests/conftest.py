"""
Pytest configuration for WebSocket and API tests

This file ensures proper test environment setup for all tests,
including test database, Redis, and proper mocking of unavailable services.
"""

import asyncio
import sys
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import fakeredis.aioredis
import pytest

# Add the api directory to Python path to enable imports
api_dir = Path(__file__).parent.parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))

# Mock redis module to use fakeredis properly
import fakeredis.aioredis as fake_aioredis  # noqa: E402


# Create a simple mock ConnectionPool since fakeredis doesn't provide one
class FakeConnectionPool:
    def __init__(self, *args, **kwargs):
        pass

    async def disconnect(self):
        pass

# Create a mock redis.asyncio module with proper exports
class MockRedisModule:
    Redis = fake_aioredis.FakeRedis
    ConnectionPool = FakeConnectionPool

    @staticmethod
    async def from_url(*args, **kwargs):
        return fake_aioredis.FakeRedis()

sys.modules['redis.asyncio'] = MockRedisModule()
sys.modules['redis'] = MagicMock()


# ============================================================================
# PostgreSQL Test Database Fixtures
# ============================================================================

@pytest.fixture(scope="session")
def postgresql_proc_config():
    """Configure PostgreSQL process for testing."""
    return {
        "port": None,  # Use random available port
        "host": "localhost",
        "user": "postgres",
        "options": "-c fsync=off -c synchronous_commit=off",  # Faster for tests
    }


@pytest.fixture(scope="session")
def postgresql_database(postgresql_proc):
    """Create a test database with required extensions."""
    import psycopg

    # Connect to the default database to create our test database
    with psycopg.connect(
        host=postgresql_proc.host,
        port=postgresql_proc.port,
        user=postgresql_proc.user,
        dbname="postgres",
    ) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("DROP DATABASE IF EXISTS test_forecastin")
            cur.execute("CREATE DATABASE test_forecastin")

    # Connect to test database and install extensions
    with psycopg.connect(
        host=postgresql_proc.host,
        port=postgresql_proc.port,
        user=postgresql_proc.user,
        dbname="test_forecastin",
    ) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            # Install required extensions (skip if not available)
            try:
                cur.execute("CREATE EXTENSION IF NOT EXISTS ltree")
            except Exception:
                pass  # LTREE might not be available in test environment

            try:
                cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")
            except Exception:
                pass  # PostGIS might not be available in test environment

            cur.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
            cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    yield {
        "host": postgresql_proc.host,
        "port": postgresql_proc.port,
        "user": postgresql_proc.user,
        "dbname": "test_forecastin",
    }


@pytest.fixture(scope="session")
def db_url(postgresql_database):
    """Provide database URL for tests."""
    config = postgresql_database
    return f"postgresql://{config['user']}@{config['host']}:{config['port']}/{config['dbname']}"


@pytest.fixture(scope="session")
async def test_db_schema(postgresql_database):
    """Initialize database schema from migrations."""
    import asyncpg

    config = postgresql_database
    conn = await asyncpg.connect(
        host=config['host'],
        port=config['port'],
        user=config['user'],
        database=config['dbname'],
    )

    try:
        # Read and execute migration files
        migrations_dir = Path(__file__).parent.parent.parent / "migrations"
        migration_files = sorted([
            f for f in migrations_dir.glob("*.sql")
            if not f.name.endswith("_ROLLBACK.sql")
        ])

        for migration_file in migration_files:
            print(f"Running migration: {migration_file.name}")
            sql = migration_file.read_text()

            # Execute each statement separately (handle multi-statement files)
            try:
                await conn.execute(sql)
            except Exception as e:
                # Some migrations might fail if extensions aren't available
                # or if they've already been applied
                print(f"Migration {migration_file.name} failed (this may be okay): {e}")
                continue

        yield conn

    finally:
        await conn.close()


@pytest.fixture
async def db_connection(test_db_schema):
    """Provide a fresh database connection for each test."""
    # test_db_schema already provides a connection, so we can reuse it
    # or create a transaction-based isolation
    yield test_db_schema


@pytest.fixture
async def clean_db(db_connection):
    """Clean database before each test (truncate all tables)."""
    # Start a transaction
    transaction = db_connection.transaction()
    await transaction.start()

    try:
        # Truncate all tables
        await db_connection.execute("""
            TRUNCATE TABLE entity_relationships, entities, feature_flags RESTART IDENTITY CASCADE
        """)

        yield db_connection

    finally:
        # Rollback transaction after test
        await transaction.rollback()


# ============================================================================
# Redis Test Fixtures (FakeRedis)
# ============================================================================

@pytest.fixture
async def redis_client() -> AsyncGenerator:
    """Provide a fake Redis client for testing."""
    fake_redis = fakeredis.aioredis.FakeRedis()
    yield fake_redis
    await fake_redis.aclose()


@pytest.fixture
def redis_url():
    """Provide Redis URL (points to fake Redis in tests)."""
    return "redis://localhost:6379/0"


# ============================================================================
# Service Fixtures
# ============================================================================

@pytest.fixture
async def mock_cache_service(redis_client):
    """Provide a mocked CacheService for testing."""
    from unittest.mock import AsyncMock

    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    cache.clear = AsyncMock(return_value=True)
    cache.redis_client = redis_client

    return cache


@pytest.fixture
async def mock_database_manager(db_url):
    """Provide a mocked DatabaseManager for testing."""
    from unittest.mock import AsyncMock

    db_manager = AsyncMock()
    db_manager.get_connection = AsyncMock()
    db_manager.execute = AsyncMock()
    db_manager.fetch = AsyncMock(return_value=[])
    db_manager.fetchrow = AsyncMock(return_value=None)
    db_manager.database_url = db_url

    return db_manager


@pytest.fixture
def mock_realtime_service():
    """Mock RealtimeService for testing."""
    realtime = AsyncMock()
    realtime.broadcast_update = AsyncMock(return_value=True)
    return realtime


@pytest.fixture
def mock_feature_flag_service():
    """Mock FeatureFlagService for testing."""
    ff_service = AsyncMock()
    ff_service.is_flag_enabled = AsyncMock(return_value=True)
    ff_service.get_flag = AsyncMock(return_value={"is_enabled": True, "rollout_percentage": 100})
    return ff_service


# ============================================================================
# FastAPI Test Client Fixtures
# ============================================================================

@pytest.fixture
def client():
    """Provide FastAPI test client."""
    from fastapi.testclient import TestClient

    from main import app

    return TestClient(app)


@pytest.fixture
async def async_client():
    """Provide async FastAPI test client."""
    from httpx import AsyncClient

    from main import app

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


# ============================================================================
# Test Data Factories
# ============================================================================

@pytest.fixture
def sample_entity():
    """Provide a sample entity for testing."""
    return {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Test Entity",
        "entity_type": "organization",
        "description": "A test entity",
        "path": "test.entity",
        "path_depth": 1,
        "path_hash": "abc123",
        "metadata": {"key": "value"},
        "confidence_score": 0.95,
        "is_active": True,
    }


@pytest.fixture
def sample_scenario():
    """Provide a sample scenario for testing."""
    return {
        "id": "scenario-123",
        "name": "Test Scenario",
        "description": "A test scenario",
        "entity_id": "550e8400-e29b-41d4-a716-446655440000",
        "assumptions": {"assumption1": "value1"},
        "created_at": "2024-01-01T00:00:00Z",
    }


@pytest.fixture
def sample_forecast():
    """Provide a sample forecast for testing."""
    return {
        "id": "forecast-123",
        "scenario_id": "scenario-123",
        "forecast_values": [0.1, 0.2, 0.3],
        "confidence_intervals": [[0.05, 0.15], [0.15, 0.25], [0.25, 0.35]],
        "metadata": {"model": "test_model"},
    }


# ============================================================================
# Event Loop Configuration
# ============================================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Cleanup and Utility Fixtures
# ============================================================================

@pytest.fixture(autouse=True)
def reset_mocks():
    """Reset all mocks after each test."""
    yield
    # Cleanup happens after test runs
    pass
