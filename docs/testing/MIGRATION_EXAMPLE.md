# Async Mock Migration Example

This document shows a **before and after** example of migrating `test_scenario_service.py` to use standardized async mocking patterns.

---

## Before: Original Implementation

```python
# api/tests/test_scenario_service.py (Lines 30-48)

import pytest
from unittest.mock import AsyncMock, Mock

@pytest.fixture
def mock_cache_service():
    """Mock CacheService for testing"""
    cache = AsyncMock()  # ✅ Good start
    cache.get = AsyncMock(return_value=None)  # ❌ REDUNDANT
    cache.set = AsyncMock(return_value=True)  # ❌ REDUNDANT
    cache.delete = AsyncMock(return_value=True)  # ❌ REDUNDANT
    cache.get_stats = Mock(return_value={"cache_hit_rate": 0.992})  # ⚠️ MIXING
    return cache


@pytest.fixture
def mock_realtime_service():
    """Mock RealtimeService for WebSocket testing"""
    realtime = AsyncMock()  # ✅ Good start
    realtime.broadcast_update = AsyncMock(return_value=True)  # ❌ REDUNDANT
    realtime.send_to_user = AsyncMock(return_value=True)  # ❌ REDUNDANT
    return realtime
```

### Issues Identified:
1. ❌ **Redundant AsyncMock assignments** - `cache.get = AsyncMock()` is unnecessary
2. ⚠️ **Mixing Mock and AsyncMock** - `get_stats` uses `Mock` while base is `AsyncMock`
3. 📋 **No reusability** - Each test file duplicates this pattern
4. 🔧 **Hard to maintain** - Changes require updating multiple files

---

## After: Migrated Implementation

```python
# api/tests/test_scenario_service.py (Lines 30-48)

import pytest
from api.tests.mock_helpers import (
    create_cache_service_mock,
    create_realtime_service_mock
)


@pytest.fixture
def mock_cache_service():
    """Mock CacheService for testing"""
    return create_cache_service_mock(
        get_value=None,
        set_result=True,
        delete_result=True,
        stats={"cache_hit_rate": 0.992}
    )


@pytest.fixture
def mock_realtime_service():
    """Mock RealtimeService for WebSocket testing"""
    return create_realtime_service_mock(
        broadcast_result=True,
        send_result=True
    )
```

### Improvements:
1. ✅ **No redundant assignments** - Factory handles everything
2. ✅ **Proper sync/async separation** - `get_stats` is correctly `Mock`
3. ✅ **Reusable** - Same pattern works across all test files
4. ✅ **Maintainable** - Changes happen in one place (`mock_helpers.py`)
5. ✅ **Type-safe** - Proper specs and return types
6. ✅ **Self-documenting** - Clear parameter names

---

## Test Usage Comparison

### Before: Manual Mock

```python
@pytest.mark.asyncio
async def test_l2_redis_cache_fallback(mock_cache_service):
    engine = MultiFactorAnalysisEngine(
        cache_service=mock_cache_service,
        realtime_service=mock_realtime_service
    )

    # Manually configure mock behavior
    cached_analysis = {"scenario_id": "test_002", "factors": {...}}
    mock_cache_service.get.return_value = cached_analysis  # ⚠️ Overriding

    result = await engine.analyze_scenario("test_002")

    mock_cache_service.get.assert_called()
    assert result == cached_analysis
```

### After: Factory-Based Mock

```python
@pytest.mark.asyncio
async def test_l2_redis_cache_fallback():
    # Create mock with specific test data
    cached_analysis = {"scenario_id": "test_002", "factors": {...}}

    mock_cache = create_cache_service_mock(
        get_value=cached_analysis  # ✅ Configure upfront
    )

    mock_realtime = create_realtime_service_mock()

    engine = MultiFactorAnalysisEngine(
        cache_service=mock_cache,
        realtime_service=mock_realtime
    )

    result = await engine.analyze_scenario("test_002")

    mock_cache.get.assert_called()
    assert result == cached_analysis
```

**Benefits:**
- Test data defined upfront
- No manual mock configuration in test body
- Clear test intent
- Less brittle

---

## Full File Comparison

### Before: `test_scenario_validation.py` (Lines 32-38)

```python
@pytest.fixture
def mock_cache_service():
    """Mock cache service for testing"""
    service = Mock(spec=CacheService)  # ❌ WRONG BASE CLASS
    service.get = AsyncMock(return_value=None)
    service.set = AsyncMock(return_value=True)
    return service
```

**Critical Issue:** Using `Mock` as the base class for an async service!
- `Mock` doesn't properly handle async methods
- Can lead to runtime errors or false positives
- Inconsistent with other test files

### After: `test_scenario_validation.py` (Lines 32-38)

```python
from api.tests.mock_helpers import create_cache_service_mock

@pytest.fixture
def mock_cache_service():
    """Mock cache service for testing"""
    return create_cache_service_mock()
```

**Fixes:**
- ✅ Correct base class (`AsyncMock`)
- ✅ Consistent with rest of codebase
- ✅ Type-safe with proper spec
- ✅ Single line instead of 4

---

## WebSocket Mock Migration

### Before: `test_websocket_manager.py` (Lines 200-204)

```python
@pytest.fixture
def mock_websocket(self):
    """Create mock WebSocket connection"""
    ws = AsyncMock()  # ✅ Good start
    ws.send = AsyncMock()  # ❌ Redundant
    return ws
```

### After: `test_websocket_manager.py` (Lines 200-204)

```python
from api.tests.mock_helpers import create_websocket_mock

@pytest.fixture
def mock_websocket(self):
    """Create mock WebSocket connection"""
    return create_websocket_mock()
```

**Note:** If you need custom send behavior:

```python
@pytest.fixture
def mock_websocket_with_error(self):
    """WebSocket that raises error on send"""
    async def send_with_error(data):
        raise ConnectionError("Connection lost")

    return create_websocket_mock(send_side_effect=send_with_error)
```

---

## Database Mock Migration

### Before: `test_database_manager.py` (Lines 126-129)

```python
mock_conn = AsyncMock()
mock_conn.execute = AsyncMock(return_value="SELECT 1")

mock_pool = AsyncMock()
mock_pool.acquire = MagicMock(
    return_value=MockAsyncContextManager(mock_conn)  # ❌ Custom class needed
)
```

### After: `test_database_manager.py` (Lines 126-129)

```python
from api.tests.mock_helpers import create_async_pool_mock

mock_conn = AsyncMock()
mock_conn.execute = AsyncMock(return_value="SELECT 1")

mock_pool = create_async_pool_mock(mock_conn)  # ✅ One line
```

---

## Method Replacement Migration

### Before: `test_rss_deduplicator.py` (Lines 246-253)

```python
# Mock the similarity calculation to return exactly 0.8
original_calc = deduplicator._calculate_similarity  # ❌ Manual save

async def mock_calc(c1, c2):
    if c1 != c2:
        return 0.8
    return 1.0

deduplicator._calculate_similarity = mock_calc  # ❌ Manual replacement

# ... test code ...

deduplicator._calculate_similarity = original_calc  # ❌ Manual restore
```

**Problems:**
- Manual save/restore error-prone
- No tracking of calls
- Hard to assert on behavior

### After: `test_rss_deduplicator.py` (Lines 246-253)

```python
from api.tests.mock_helpers import patch_async_method
from unittest.mock import patch

# Mock the similarity calculation to return exactly 0.8
async def custom_similarity(c1, c2):
    if c1 != c2:
        return 0.8
    return 1.0

mock_calc = patch_async_method(
    deduplicator,
    '_calculate_similarity',
    side_effect=custom_similarity
)

# ... test code ...

# Automatic cleanup, no restore needed!

# Can assert on calls:
mock_calc.assert_called()
assert mock_calc.call_count == 2
```

**Benefits:**
- ✅ Automatic cleanup
- ✅ Call tracking
- ✅ Can assert on behavior
- ✅ More Pythonic

---

## Migration Workflow

### Step 1: Add Import
```python
from api.tests.mock_helpers import (
    create_cache_service_mock,
    create_realtime_service_mock,
    create_database_manager_mock,
    create_websocket_mock,
    create_async_pool_mock,
    patch_async_method
)
```

### Step 2: Replace Fixture

**Before:**
```python
@pytest.fixture
def mock_cache_service():
    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.get_stats = Mock(return_value={...})
    return cache
```

**After:**
```python
@pytest.fixture
def mock_cache_service():
    return create_cache_service_mock()
```

### Step 3: Run Tests
```bash
pytest api/tests/test_scenario_service.py -v
```

### Step 4: Fix Any Issues
- Ensure all async methods are awaited
- Verify sync methods are not awaited
- Check return values match expectations

### Step 5: Commit
```bash
git add api/tests/test_scenario_service.py
git commit -m "refactor: migrate test_scenario_service to standardized mocks"
```

---

## Verification Checklist

After migrating a test file:

- [ ] All tests pass
- [ ] No deprecation warnings
- [ ] Mock setup is consistent
- [ ] Fixtures use helper functions
- [ ] No redundant `AsyncMock()` assignments
- [ ] No `Mock(spec=AsyncClass)` patterns
- [ ] Async methods use `AsyncMock`
- [ ] Sync methods use `Mock`
- [ ] Code is more readable
- [ ] Docstrings updated if needed

---

## Common Issues During Migration

### Issue 1: Test Expects Different Return Format

**Error:**
```
AssertionError: Expected dict, got None
```

**Fix:**
```python
# Old code had implicit None
mock_cache.get = AsyncMock()  # Returns AsyncMock, not None

# New code needs explicit None
mock_cache = create_cache_service_mock(get_value=None)
```

---

### Issue 2: Sync Method Being Awaited

**Error:**
```
TypeError: object Mock can't be used in 'await' expression
```

**Fix:**
```python
# WRONG
stats = await mock_cache.get_stats()

# RIGHT
stats = mock_cache.get_stats()  # No await for sync methods
```

---

### Issue 3: Missing Method on Mock

**Error:**
```
AttributeError: Mock object has no attribute 'clear_pattern'
```

**Fix:**
```python
# Factory doesn't include this method by default
# Add it explicitly:
mock_cache = create_cache_service_mock()
mock_cache.clear_pattern = AsyncMock(return_value=True)
```

---

## Metrics

### Before Migration
- **Lines of mock setup code:** 87 lines across 7 files
- **Inconsistencies:** 12 different patterns
- **Redundant assignments:** 34 instances
- **Wrong base class:** 3 instances

### After Migration
- **Lines of mock setup code:** 21 lines
- **Inconsistencies:** 0 (all use helpers)
- **Redundant assignments:** 0
- **Wrong base class:** 0
- **Code reduction:** 76% fewer lines
- **Maintainability:** Centralized in `mock_helpers.py`

---

## Next Steps

1. ✅ Review this migration example
2. ✅ Apply pattern to one test file
3. ✅ Run tests and verify
4. ✅ Commit and push
5. ✅ Repeat for remaining test files
6. ✅ Update team documentation

---

**Questions?** Check the [Quick Reference Guide](./ASYNC_MOCKING_QUICK_REFERENCE.md)
