"""
Standardized async mock utilities for consistent testing patterns.

This module provides factory functions and utilities to create properly
configured async mocks that are:
- Type-safe with proper specs
- Consistent across the test suite
- Easy to maintain and understand

Usage:
    from api.tests.mock_helpers import create_cache_service_mock

    @pytest.fixture
    def mock_cache():
        return create_cache_service_mock()

Author: Forecastin Testing Infrastructure Team
Created: 2025-11-09
"""

from typing import Any, Callable, Dict, List, Optional, Type, TypeVar
from unittest.mock import AsyncMock, Mock

T = TypeVar('T')


# ============================================================================
# Factory Functions for Common Service Mocks
# ============================================================================

def create_async_service_mock(
    service_class: Type[T],
    method_return_values: Optional[Dict[str, Any]] = None,
    async_methods: Optional[List[str]] = None,
    sync_methods: Optional[List[str]] = None
) -> T:
    """
    Create a properly configured async service mock.

    Args:
        service_class: The service class to mock (used for spec)
        method_return_values: Dict of method_name -> return_value
        async_methods: List of method names that should be AsyncMock
        sync_methods: List of method names that should be regular Mock

    Returns:
        Properly configured mock with AsyncMock for async methods

    Example:
        >>> mock_cache = create_async_service_mock(
        ...     CacheService,
        ...     method_return_values={
        ...         'get': None,
        ...         'set': True,
        ...         'get_stats': {'hit_rate': 0.99}
        ...     },
        ...     async_methods=['get', 'set', 'delete'],
        ...     sync_methods=['get_stats']
        ... )
    """
    mock = AsyncMock(spec=service_class)

    method_return_values = method_return_values or {}
    async_methods = async_methods or []
    sync_methods = sync_methods or []

    # Configure async methods
    for method_name in async_methods:
        return_value = method_return_values.get(method_name)
        setattr(mock, method_name, AsyncMock(return_value=return_value))

    # Configure sync methods
    for method_name in sync_methods:
        return_value = method_return_values.get(method_name)
        setattr(mock, method_name, Mock(return_value=return_value))

    return mock


def create_cache_service_mock(
    get_value: Any = None,
    set_result: bool = True,
    delete_result: bool = True,
    clear_pattern_result: bool = True,
    stats: Optional[Dict[str, float]] = None
) -> AsyncMock:
    """
    Create a standardized CacheService mock.

    Args:
        get_value: Value returned by cache.get()
        set_result: Boolean returned by cache.set()
        delete_result: Boolean returned by cache.delete()
        clear_pattern_result: Boolean returned by cache.clear_pattern()
        stats: Dict returned by cache.get_stats() (sync method)

    Returns:
        Properly configured CacheService mock

    Example:
        >>> mock_cache = create_cache_service_mock(
        ...     get_value={"cached": "data"},
        ...     stats={"cache_hit_rate": 0.992}
        ... )
        >>> result = await mock_cache.get("key")
        >>> assert result == {"cached": "data"}
    """
    if stats is None:
        stats = {"cache_hit_rate": 0.992}

    return create_async_service_mock(
        type('CacheService', (), {}),
        method_return_values={
            'get': get_value,
            'set': set_result,
            'delete': delete_result,
            'clear_pattern': clear_pattern_result,
            'get_stats': stats
        },
        async_methods=['get', 'set', 'delete', 'clear_pattern'],
        sync_methods=['get_stats']
    )


def create_realtime_service_mock(
    broadcast_result: bool = True,
    send_result: bool = True
) -> AsyncMock:
    """
    Create a standardized RealtimeService mock.

    Args:
        broadcast_result: Boolean returned by broadcast_update()
        send_result: Boolean returned by send_to_user()

    Returns:
        Properly configured RealtimeService mock

    Example:
        >>> mock_realtime = create_realtime_service_mock()
        >>> result = await mock_realtime.broadcast_update({"type": "update"})
        >>> assert result is True
    """
    mock = create_async_service_mock(
        type('RealtimeService', (), {}),
        method_return_values={
            'broadcast_update': broadcast_result,
            'send_to_user': send_result
        },
        async_methods=['broadcast_update', 'send_to_user']
    )

    # Add connection_manager for API tests
    mock.connection_manager = Mock()
    mock.connection_manager.broadcast_message = AsyncMock()

    return mock


def create_database_manager_mock(
    fetchrow_result: Optional[Dict[str, Any]] = None,
    fetch_result: Optional[List[Dict[str, Any]]] = None,
    execute_result: str = "SELECT 1",
    fetchval_result: Any = None
) -> AsyncMock:
    """
    Create a standardized DatabaseManager mock.

    Args:
        fetchrow_result: Dict returned by fetchrow()
        fetch_result: List of dicts returned by fetch()
        execute_result: String returned by execute()
        fetchval_result: Value returned by fetchval()

    Returns:
        Properly configured DatabaseManager mock

    Example:
        >>> mock_db = create_database_manager_mock(
        ...     fetchrow_result={"id": 1, "name": "test"}
        ... )
        >>> row = await mock_db.fetchrow("SELECT * FROM table")
        >>> assert row["name"] == "test"
    """
    return create_async_service_mock(
        type('DatabaseManager', (), {}),
        method_return_values={
            'fetchrow': fetchrow_result,
            'fetch': fetch_result or [],
            'execute': execute_result,
            'fetchval': fetchval_result
        },
        async_methods=['fetchrow', 'fetch', 'execute', 'fetchval']
    )


# ============================================================================
# Async Context Manager Utilities
# ============================================================================

class AsyncContextManagerMock:
    """
    Reusable async context manager mock for database connections, etc.

    This properly implements __aenter__ and __aexit__ for async with statements.

    Example:
        >>> mock_conn = AsyncMock()
        >>> mock_pool.acquire.return_value = AsyncContextManagerMock(mock_conn)
        >>> async with mock_pool.acquire() as conn:
        ...     await conn.execute("SELECT 1")
    """

    def __init__(self, return_value: Any):
        """
        Initialize the async context manager.

        Args:
            return_value: The value to return from __aenter__
        """
        self.return_value = return_value

    async def __aenter__(self):
        """Enter the async context, returning the wrapped value."""
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit the async context."""
        return None


def create_async_pool_mock(connection_mock: Optional[AsyncMock] = None) -> AsyncMock:
    """
    Create a database pool mock with proper async context manager support.

    Args:
        connection_mock: The connection mock to return from acquire()

    Returns:
        Pool mock with acquire() returning an async context manager

    Example:
        >>> mock_conn = AsyncMock()
        >>> mock_conn.execute = AsyncMock(return_value="INSERT 1")
        >>> mock_pool = create_async_pool_mock(mock_conn)
        >>>
        >>> async with mock_pool.acquire() as conn:
        ...     result = await conn.execute("INSERT INTO ...")
        >>> assert result == "INSERT 1"
    """
    if connection_mock is None:
        connection_mock = AsyncMock()
        connection_mock.execute = AsyncMock(return_value="SELECT 1")
        connection_mock.fetch = AsyncMock(return_value=[])
        connection_mock.fetchrow = AsyncMock(return_value=None)
        connection_mock.fetchval = AsyncMock(return_value=None)

    mock_pool = AsyncMock()
    mock_pool.acquire.return_value = AsyncContextManagerMock(connection_mock)
    mock_pool.close = AsyncMock()

    return mock_pool


# ============================================================================
# Async Method Patching Utilities
# ============================================================================

def patch_async_method(
    obj: Any,
    method_name: str,
    return_value: Any = None,
    side_effect: Optional[Callable] = None
) -> AsyncMock:
    """
    Properly patch an async method on an object.

    Use this instead of manually replacing methods.

    Args:
        obj: Object containing the method to patch
        method_name: Name of the method to patch
        return_value: Value the mock should return
        side_effect: Callable for custom behavior

    Returns:
        The AsyncMock that was attached

    Example:
        >>> # Instead of:
        >>> # original = obj._calculate_similarity
        >>> # async def mock_calc(c1, c2):
        >>> #     return 0.8
        >>> # obj._calculate_similarity = mock_calc
        >>>
        >>> # Use:
        >>> async def custom_calc(c1, c2):
        ...     return 0.8
        >>> patch_async_method(obj, '_calculate_similarity', side_effect=custom_calc)
    """
    mock_method = AsyncMock(return_value=return_value, side_effect=side_effect)
    setattr(obj, method_name, mock_method)
    return mock_method


# ============================================================================
# WebSocket Mock Utilities
# ============================================================================

def create_websocket_mock(
    send_side_effect: Optional[Callable] = None,
    receive_return_value: Optional[Dict[str, Any]] = None
) -> AsyncMock:
    """
    Create a WebSocket connection mock.

    Args:
        send_side_effect: Optional callable for custom send behavior
        receive_return_value: Optional value for receive() to return

    Returns:
        Properly configured WebSocket mock

    Example:
        >>> ws = create_websocket_mock()
        >>> await ws.send('{"type": "test"}')
        >>> ws.send.assert_called_once()
    """
    ws = AsyncMock()
    ws.send = AsyncMock(side_effect=send_side_effect)
    ws.receive = AsyncMock(return_value=receive_return_value)
    ws.close = AsyncMock()
    ws.accept = AsyncMock()

    return ws


# ============================================================================
# Hierarchy/Navigation Mock Utilities
# ============================================================================

def create_hierarchy_resolver_mock(
    get_hierarchy_return: Optional[Any] = None
) -> Mock:
    """
    Create a mock OptimizedHierarchyResolver.

    Args:
        get_hierarchy_return: Value returned by get_hierarchy()

    Returns:
        Properly configured hierarchy resolver mock

    Example:
        >>> mock_resolver = create_hierarchy_resolver_mock(
        ...     get_hierarchy_return={"entity_id": "test_001"}
        ... )
        >>> result = mock_resolver.get_hierarchy("path")
        >>> assert result["entity_id"] == "test_001"
    """
    resolver = Mock()
    resolver.get_hierarchy = Mock(return_value=get_hierarchy_return)
    return resolver


def create_forecast_manager_mock(
    generate_forecast_return: Optional[Dict[str, Any]] = None
) -> AsyncMock:
    """
    Create a mock HierarchicalForecastManager.

    Args:
        generate_forecast_return: Value returned by generate_forecast()

    Returns:
        Properly configured forecast manager mock

    Example:
        >>> mock_manager = create_forecast_manager_mock(
        ...     generate_forecast_return={
        ...         "entity_path": "asia.china",
        ...         "forecast_data": [{"timestamp": 123, "value": 100}]
        ...     }
        ... )
    """
    if generate_forecast_return is None:
        generate_forecast_return = {
            "entity_path": "world",
            "forecast_data": [],
            "method": "top_down"
        }

    manager = AsyncMock()
    manager.generate_forecast = AsyncMock(return_value=generate_forecast_return)

    return manager


# ============================================================================
# Validation and Testing Utilities
# ============================================================================

def assert_async_mock_called_with_await(mock: AsyncMock, *args, **kwargs):
    """
    Assert that an AsyncMock was called and awaited.

    Args:
        mock: The AsyncMock to check
        *args, **kwargs: Expected call arguments

    Raises:
        AssertionError: If the mock was not called correctly

    Example:
        >>> mock_service.get = AsyncMock(return_value="data")
        >>> result = await mock_service.get("key")
        >>> assert_async_mock_called_with_await(mock_service.get, "key")
    """
    mock.assert_called_with(*args, **kwargs)
    # Verify it's actually an AsyncMock
    assert isinstance(mock, AsyncMock), f"Expected AsyncMock but got {type(mock)}"


def verify_mock_setup(mock: Any, expected_async_methods: List[str], expected_sync_methods: List[str] = None):
    """
    Verify that a mock has the correct method types.

    Args:
        mock: The mock to verify
        expected_async_methods: List of method names that should be AsyncMock
        expected_sync_methods: List of method names that should be Mock

    Raises:
        AssertionError: If any methods are the wrong type

    Example:
        >>> mock_cache = create_cache_service_mock()
        >>> verify_mock_setup(
        ...     mock_cache,
        ...     expected_async_methods=['get', 'set'],
        ...     expected_sync_methods=['get_stats']
        ... )
    """
    expected_sync_methods = expected_sync_methods or []

    for method_name in expected_async_methods:
        if not hasattr(mock, method_name):
            raise AssertionError(f"Mock missing async method: {method_name}")
        method = getattr(mock, method_name)
        if not isinstance(method, AsyncMock):
            raise AssertionError(f"Method {method_name} should be AsyncMock but is {type(method)}")

    for method_name in expected_sync_methods:
        if not hasattr(mock, method_name):
            raise AssertionError(f"Mock missing sync method: {method_name}")
        method = getattr(mock, method_name)
        if isinstance(method, AsyncMock):
            raise AssertionError(f"Method {method_name} should be Mock but is AsyncMock")
