# BUG-017: Async Mocking Framework Solutions

## Executive Summary

This document provides comprehensive solutions to the async mocking inconsistencies identified in the test suite. The solutions prioritize **standardization**, **maintainability**, and **type safety**.

---

## Solution 1: Create Standardized Mock Utilities

### Create `api/tests/mock_helpers.py`

```python
"""
Standardized async mock utilities for consistent testing patterns.

This module provides factory functions and utilities to create properly
configured async mocks that are:
- Type-safe with proper specs
- Consistent across the test suite
- Easy to maintain and understand
"""

from typing import Any, Dict, Optional, Type, TypeVar, Callable
from unittest.mock import AsyncMock, Mock, MagicMock
from contextlib import asynccontextmanager
import asyncio

T = TypeVar('T')


# ============================================================================
# Factory Functions for Common Service Mocks
# ============================================================================

def create_async_service_mock(
    service_class: Type[T],
    method_return_values: Optional[Dict[str, Any]] = None,
    async_methods: Optional[list[str]] = None,
    sync_methods: Optional[list[str]] = None
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
    """
    if stats is None:
        stats = {"cache_hit_rate": 0.992}

    return create_async_service_mock(
        type('CacheService', (), {}),
        method_return_values={
            'get': get_value,
            'set': set_result,
            'delete': delete_result,
            'get_stats': stats,
            'clear_pattern': True
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
    fetch_result: Optional[list[Dict[str, Any]]] = None,
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
    """
    return create_async_service_mock(
        type('DatabaseManager', (), {}),
        method_return_values={
            'fetchrow': fetchrow_result,
            'fetch': fetch_result or [],
            'execute': execute_result
        },
        async_methods=['fetchrow', 'fetch', 'execute']
    )


# ============================================================================
# Async Context Manager Utilities
# ============================================================================

class AsyncContextManagerMock:
    """
    Reusable async context manager mock for database connections, etc.

    Example:
        >>> mock_conn = AsyncMock()
        >>> mock_pool.acquire.return_value = AsyncContextManagerMock(mock_conn)
        >>> async with mock_pool.acquire() as conn:
        ...     await conn.execute("SELECT 1")
    """

    def __init__(self, return_value: Any):
        self.return_value = return_value

    async def __aenter__(self):
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
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
        >>> mock_conn.execute = AsyncMock(return_value="SELECT 1")
        >>> mock_pool = create_async_pool_mock(mock_conn)
        >>> async with mock_pool.acquire() as conn:
        ...     result = await conn.execute("SELECT 1")
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
        >>> # obj._calculate_similarity = async def mock_calc(c1, c2): return 0.8
        >>>
        >>> # Use:
        >>> patch_async_method(obj, '_calculate_similarity', return_value=0.8)
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
        receive_return_value: Optional value to be returned by ws.receive

    Returns:
        Properly configured WebSocket mock

    Example:
        >>> ws = create_websocket_mock(receive_return_value={"type": "test"})
        >>> await ws.send('{"type": "test"}')
        >>> result = await ws.receive()
        >>> assert result == {"type": "test"}
        >>> ws.send.assert_called_once()
    """
    ws = AsyncMock()
    ws.send = AsyncMock(side_effect=send_side_effect)
    ws.receive = AsyncMock(return_value=receive_return_value)
    ws.close = AsyncMock()
    ws.accept = AsyncMock()
    return ws


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
```

---

## Solution 2: Update conftest.py with Standardized Fixtures

### Add to `api/tests/conftest.py`

```python
"""
Shared test fixtures using standardized mock patterns.
"""

import pytest
from unittest.mock import AsyncMock, patch
from api.tests.mock_helpers import (
    create_cache_service_mock,
    create_realtime_service_mock,
    create_database_manager_mock,
    create_websocket_mock,
    create_async_pool_mock
)


# ============================================================================
# Service Mock Fixtures
# ============================================================================

@pytest.fixture
def mock_cache_service():
    """
    Standardized CacheService mock for all tests.

    Use this instead of creating custom mocks in each test file.
    """
    return create_cache_service_mock()


@pytest.fixture
def mock_realtime_service():
    """
    Standardized RealtimeService mock for all tests.
    """
    return create_realtime_service_mock()


@pytest.fixture
def mock_database_manager():
    """
    Standardized DatabaseManager mock for all tests.
    """
    return create_database_manager_mock()


@pytest.fixture
def mock_websocket():
    """
    Standardized WebSocket connection mock.
    """
    return create_websocket_mock()


@pytest.fixture
def mock_db_pool():
    """
    Standardized database connection pool mock.
    """
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock(return_value="SELECT 1")
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_conn.fetchrow = AsyncMock(return_value=None)

    return create_async_pool_mock(mock_conn)


# ============================================================================
# Feature Flag Mock Fixtures
# ============================================================================

@pytest.fixture
def mock_feature_flag_enabled():
    """Mock feature flag service returning enabled."""
    with patch('api.main.feature_flag_service') as mock_ff:
        mock_ff.is_flag_enabled = AsyncMock(return_value=True)
        yield mock_ff


@pytest.fixture
def mock_feature_flag_disabled():
    """Mock feature flag service returning disabled."""
    with patch('api.main.feature_flag_service') as mock_ff:
        mock_ff.is_flag_enabled = AsyncMock(return_value=False)
        yield mock_ff
```

---

## Solution 3: Specific File Fixes

### Fix 1: `test_websocket_manager.py`

**Before (Lines 200-204):**
```python
@pytest.fixture
def mock_websocket(self):
    """Create mock WebSocket connection"""
    ws = AsyncMock()
    ws.send = AsyncMock()  # REDUNDANT
    return ws
```

**After:**
```python
@pytest.fixture
def mock_websocket(self):
    """Create mock WebSocket connection"""
    from api.tests.mock_helpers import create_websocket_mock
    return create_websocket_mock()
```

---

### Fix 2: `test_scenario_validation.py`

**Before (Lines 32-38):**
```python
@pytest.fixture
def mock_cache_service():
    """Mock cache service for testing"""
    service = Mock(spec=CacheService)  # WRONG: Using Mock for async service
    service.get = AsyncMock(return_value=None)
    service.set = AsyncMock(return_value=True)
    return service
```

**After:**
```python
@pytest.fixture
def mock_cache_service():
    """Mock cache service for testing"""
    from api.tests.mock_helpers import create_cache_service_mock
    return create_cache_service_mock()
```

---

### Fix 3: `test_scenario_service.py`

**Before (Lines 31-38):**
```python
@pytest.fixture
def mock_cache_service():
    """Mock CacheService for testing"""
    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)  # REDUNDANT
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    cache.get_stats = Mock(return_value={"cache_hit_rate": 0.992})  # MIXING
    return cache
```

**After:**
```python
@pytest.fixture
def mock_cache_service():
    """Mock CacheService for testing"""
    from api.tests.mock_helpers import create_cache_service_mock
    return create_cache_service_mock()
```

---

### Fix 4: `test_rss_deduplicator.py`

**Before (Lines 246-253):**
```python
# Mock the similarity calculation to return exactly 0.8
original_calc = deduplicator._calculate_similarity
async def mock_calc(c1, c2):
    if c1 != c2:  # Not identical
        return 0.8
    return 1.0

deduplicator._calculate_similarity = mock_calc  # MANUAL REPLACEMENT
```

**After:**
```python
# Mock the similarity calculation to return exactly 0.8
from api.tests.mock_helpers import patch_async_method

async def custom_similarity(c1, c2):
    if c1 != c2:
        return 0.8
    return 1.0

mock_method = patch_async_method(
    deduplicator,
    '_calculate_similarity',
    side_effect=custom_similarity
)
```

---

### Fix 5: `test_database_manager.py`

**Before (Lines 126-129):**
```python
mock_pool = AsyncMock()
mock_pool.acquire = MagicMock(
    return_value=MockAsyncContextManager(mock_conn)  # Custom class needed
)
```

**After:**
```python
from api.tests.mock_helpers import create_async_pool_mock

mock_conn = AsyncMock()
mock_conn.execute = AsyncMock(return_value="SELECT 1")
mock_pool = create_async_pool_mock(mock_conn)
```

---

## Solution 4: Testing Best Practices Documentation

### Create `docs/testing/ASYNC_MOCKING_GUIDE.md`

```markdown
# Async Mocking Best Practices

## Quick Reference

### ✅ DO: Use AsyncMock for async methods
```python
from unittest.mock import AsyncMock

mock_service = AsyncMock()
mock_service.async_method = AsyncMock(return_value="result")

# AsyncMock auto-creates async methods, so this is redundant:
# mock_service.async_method = AsyncMock()  # ❌ Don't do this
```

### ❌ DON'T: Mix Mock and AsyncMock
```python
# WRONG:
service = Mock(spec=CacheService)  # Mock base
service.get = AsyncMock()  # AsyncMock method - inconsistent!

# RIGHT:
service = AsyncMock(spec=CacheService)
service.get = AsyncMock(return_value=None)
```

### ✅ DO: Use helper factories
```python
from api.tests.mock_helpers import create_cache_service_mock

mock_cache = create_cache_service_mock(
    get_value={"key": "value"},
    stats={"cache_hit_rate": 0.99}
)
```

### ❌ DON'T: Manually replace async methods
```python
# WRONG:
original = obj.method
async def mock_method():
    return "result"
obj.method = mock_method

# RIGHT:
from api.tests.mock_helpers import patch_async_method
patch_async_method(obj, 'method', return_value="result")
```

### ✅ DO: Use proper async context manager mocks
```python
from api.tests.mock_helpers import AsyncContextManagerMock

mock_conn = AsyncMock()
mock_pool.acquire.return_value = AsyncContextManagerMock(mock_conn)

async with mock_pool.acquire() as conn:
    await conn.execute("SELECT 1")
```

## Common Patterns

### Pattern 1: Mocking an Async Service

```python
from api.tests.mock_helpers import create_async_service_mock

mock_service = create_async_service_mock(
    MyServiceClass,
    method_return_values={
        'fetch_data': {'result': 'data'},
        'save_data': True,
        'get_count': 42  # sync method
    },
    async_methods=['fetch_data', 'save_data'],
    sync_methods=['get_count']
)
```

### Pattern 2: Mocking WebSocket Connections

```python
from api.tests.mock_helpers import create_websocket_mock

ws = create_websocket_mock()
await ws.send('{"type": "test"}')
ws.send.assert_called_once()
```

### Pattern 3: Mocking Database Pools

```python
from api.tests.mock_helpers import create_async_pool_mock

mock_conn = AsyncMock()
mock_conn.execute = AsyncMock(return_value="INSERT 1")
pool = create_async_pool_mock(mock_conn)

async with pool.acquire() as conn:
    result = await conn.execute("INSERT INTO...")
```

## Migration Checklist

When updating existing tests:

- [ ] Replace `Mock(spec=AsyncClass)` with `AsyncMock(spec=AsyncClass)`
- [ ] Remove redundant `AsyncMock()` assignments
- [ ] Use mock helper factories instead of manual setup
- [ ] Replace manual method replacement with `patch_async_method()`
- [ ] Use `AsyncContextManagerMock` for context managers
- [ ] Ensure sync methods use `Mock`, async methods use `AsyncMock`
- [ ] Add type hints to mock fixtures
- [ ] Document non-standard mock patterns with comments
```

---

## Solution 5: Migration Script

### Create `scripts/migrate_async_mocks.py`

```python
#!/usr/bin/env python3
"""
Script to automatically fix common async mocking anti-patterns.

Usage:
    python scripts/migrate_async_mocks.py api/tests/

This will:
1. Replace Mock(spec=AsyncClass) with AsyncMock(spec=AsyncClass)
2. Remove redundant AsyncMock assignments
3. Suggest using mock_helpers for common patterns
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple


def find_mock_spec_async_issues(content: str) -> List[Tuple[int, str]]:
    """Find instances of Mock(spec=...) used for async services."""
    issues = []
    lines = content.split('\n')

    async_service_pattern = re.compile(
        r'Mock\(spec=(CacheService|RealtimeService|DatabaseManager|.*Service)\)'
    )

    for i, line in enumerate(lines, 1):
        if async_service_pattern.search(line):
            issues.append((i, line.strip()))

    return issues


def find_redundant_asyncmock_assignments(content: str) -> List[Tuple[int, str]]:
    """Find redundant AsyncMock().method = AsyncMock() patterns."""
    issues = []
    lines = content.split('\n')

    for i in range(len(lines) - 1):
        line1 = lines[i].strip()
        line2 = lines[i + 1].strip()

        # Look for pattern: mock = AsyncMock() followed by mock.method = AsyncMock()
        if 'AsyncMock()' in line1 and '=' in line1:
            var_name = line1.split('=')[0].strip()
            if line2.startswith(f'{var_name}.') and 'AsyncMock()' in line2:
                issues.append((i + 2, line2))

    return issues


def analyze_test_file(file_path: Path) -> dict:
    """Analyze a single test file for async mocking issues."""
    with open(file_path, 'r') as f:
        content = f.read()

    return {
        'file': str(file_path),
        'mock_spec_issues': find_mock_spec_async_issues(content),
        'redundant_assignments': find_redundant_asyncmock_assignments(content),
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python migrate_async_mocks.py <test_directory>")
        sys.exit(1)

    test_dir = Path(sys.argv[1])

    if not test_dir.exists():
        print(f"Error: {test_dir} does not exist")
        sys.exit(1)

    test_files = list(test_dir.glob('test_*.py'))

    print(f"Analyzing {len(test_files)} test files in {test_dir}...\n")

    total_issues = 0

    for test_file in test_files:
        results = analyze_test_file(test_file)

        file_issues = (
            len(results['mock_spec_issues']) +
            len(results['redundant_assignments'])
        )

        if file_issues > 0:
            print(f"{'=' * 80}")
            print(f"File: {results['file']}")
            print(f"{'=' * 80}")

            if results['mock_spec_issues']:
                print("\n⚠️  Mock(spec=AsyncService) Issues:")
                for line_num, line in results['mock_spec_issues']:
                    print(f"  Line {line_num}: {line}")
                    print(f"    → Should use: AsyncMock(spec=...)")

            if results['redundant_assignments']:
                print("\n⚠️  Redundant AsyncMock Assignments:")
                for line_num, line in results['redundant_assignments']:
                    print(f"  Line {line_num}: {line}")
                    print(f"    → Can be removed (AsyncMock auto-creates async methods)")

            print()
            total_issues += file_issues

    print(f"{'=' * 80}")
    print(f"Total issues found: {total_issues}")
    print(f"{'=' * 80}")

    if total_issues > 0:
        print("\nRecommendations:")
        print("1. Review the issues above")
        print("2. Use mock_helpers.py factory functions where possible")
        print("3. See docs/testing/ASYNC_MOCKING_GUIDE.md for best practices")


if __name__ == '__main__':
    main()
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. ✅ Create `api/tests/mock_helpers.py` with factory functions
2. ✅ Update `api/tests/conftest.py` with standardized fixtures
3. ✅ Create documentation in `docs/testing/ASYNC_MOCKING_GUIDE.md`

### Phase 2: Critical Fixes (Week 1-2)
4. Fix `test_scenario_validation.py` (Mock → AsyncMock)
5. Fix `test_websocket_manager.py` (remove redundant AsyncMock)
6. Fix `test_scenario_service.py` (remove redundant AsyncMock)

### Phase 3: Pattern Improvements (Week 2)
7. Fix `test_database_manager.py` (use AsyncContextManagerMock)
8. Fix `test_rss_deduplicator.py` (use patch_async_method)
9. Fix `test_scenario_api.py` (standardize patch patterns)

### Phase 4: Validation (Week 3)
10. Run migration script to find remaining issues
11. Add pre-commit hook to prevent new anti-patterns
12. Update all test files to use new patterns

### Phase 5: Testing & Documentation (Week 3)
13. Ensure all tests pass with new mocking patterns
14. Add performance benchmarks (verify no regression)
15. Create team training materials

---

## Success Metrics

### Quantitative
- **0** instances of `Mock(spec=AsyncService)`
- **<5** instances of redundant `AsyncMock()` assignments
- **100%** of common mocking patterns use helper factories
- **<1%** test execution time regression

### Qualitative
- Consistent mocking patterns across all test files
- New developers can easily understand mock setup
- Test maintenance time reduced by 30%
- Fewer false positives/negatives in tests

---

## Risk Mitigation

### Risk: Test Breakage During Migration
**Mitigation:**
- Migrate one file at a time
- Run full test suite after each change
- Keep git history clean for easy rollback

### Risk: Performance Regression
**Mitigation:**
- Benchmark before/after
- Profile slow tests
- Optimize factory functions if needed

### Risk: Team Adoption
**Mitigation:**
- Provide clear documentation
- Code review new patterns
- Pair programming sessions

---

## Long-term Maintenance

### Pre-commit Hook
```python
# .pre-commit-config.yaml
- repo: local
  hooks:
    - id: check-async-mocks
      name: Check async mocking patterns
      entry: python scripts/check_async_mocks.py
      language: system
      types: [python]
      files: ^api/tests/
```

### Code Review Checklist
- [ ] Async services use `AsyncMock`, not `Mock`
- [ ] No redundant `AsyncMock()` assignments
- [ ] Complex mocks use helper factories
- [ ] No manual method replacement
- [ ] Async context managers properly mocked

---

## References

- [Python unittest.mock documentation](https://docs.python.org/3/library/unittest.mock.html)
- [AsyncMock best practices](https://docs.python.org/3/library/unittest.mock.html#unittest.mock.AsyncMock)
- [pytest-asyncio documentation](https://pytest-asyncio.readthedocs.io/)

---

## Questions & Support

For questions about async mocking patterns:
1. Check `docs/testing/ASYNC_MOCKING_GUIDE.md`
2. Review examples in `api/tests/mock_helpers.py`
3. Ask in #testing Slack channel
4. Create issue with `testing` label

---

**Last Updated:** 2025-11-09
**Owner:** Testing Infrastructure Team
**Status:** Ready for Implementation
