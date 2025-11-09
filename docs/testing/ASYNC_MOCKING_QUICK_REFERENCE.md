# Async Mocking Quick Reference Guide

## 🎯 Common Issues & Fixes

### Issue 1: Using Mock for Async Services ❌

**Problem:**
```python
# WRONG: Mock doesn't properly handle async methods
service = Mock(spec=CacheService)
service.get = AsyncMock(return_value=None)
```

**Solution:**
```python
# RIGHT: Use AsyncMock as the base
from api.tests.mock_helpers import create_cache_service_mock

service = create_cache_service_mock(get_value=None)
```

---

### Issue 2: Redundant AsyncMock Assignments ❌

**Problem:**
```python
# WRONG: AsyncMock already makes all methods async
ws = AsyncMock()
ws.send = AsyncMock()  # Redundant!
ws.receive = AsyncMock()  # Redundant!
```

**Solution:**
```python
# RIGHT: Use helper factory
from api.tests.mock_helpers import create_websocket_mock

ws = create_websocket_mock()
# send, receive, close are already AsyncMock
```

---

### Issue 3: Manual Method Replacement ❌

**Problem:**
```python
# WRONG: Manual replacement is error-prone
original = obj.async_method

async def mock_method(arg):
    return "result"

obj.async_method = mock_method
```

**Solution:**
```python
# RIGHT: Use patch_async_method
from api.tests.mock_helpers import patch_async_method

async def custom_behavior(arg):
    return "result"

patch_async_method(obj, 'async_method', side_effect=custom_behavior)
```

---

### Issue 4: Complex Context Manager Mocking ❌

**Problem:**
```python
# WRONG: Creating custom context manager wrapper
class CustomAsyncContextManager:
    def __init__(self, value):
        self.value = value
    async def __aenter__(self):
        return self.value
    async def __aexit__(self, *args):
        pass

mock_pool.acquire.return_value = CustomAsyncContextManager(mock_conn)
```

**Solution:**
```python
# RIGHT: Use AsyncContextManagerMock
from api.tests.mock_helpers import create_async_pool_mock

mock_conn = AsyncMock()
mock_pool = create_async_pool_mock(mock_conn)
```

---

### Issue 5: Mixing Sync and Async Incorrectly ❌

**Problem:**
```python
# WRONG: Sync method using AsyncMock
cache = AsyncMock()
cache.get = AsyncMock(return_value=None)  # OK - async
cache.get_stats = AsyncMock(return_value={"hit_rate": 0.99})  # WRONG - sync method!
```

**Solution:**
```python
# RIGHT: Specify which methods are sync vs async
from api.tests.mock_helpers import create_cache_service_mock

cache = create_cache_service_mock(
    get_value=None,
    stats={"hit_rate": 0.99}
)
# get/set/delete are AsyncMock
# get_stats is Mock (sync)
```

---

## 📚 Factory Functions Reference

### CacheService Mock

```python
from api.tests.mock_helpers import create_cache_service_mock

mock_cache = create_cache_service_mock(
    get_value={"key": "value"},      # What get() returns
    set_result=True,                  # What set() returns
    delete_result=True,               # What delete() returns
    stats={"cache_hit_rate": 0.992}   # What get_stats() returns (sync)
)

# Usage
result = await mock_cache.get("key")
await mock_cache.set("key", "value")
stats = mock_cache.get_stats()  # No await - sync method
```

---

### RealtimeService Mock

```python
from api.tests.mock_helpers import create_realtime_service_mock

mock_realtime = create_realtime_service_mock(
    broadcast_result=True,
    send_result=True
)

# Usage
await mock_realtime.broadcast_update({"type": "update"})
await mock_realtime.send_to_user("user_123", {"data": "value"})
```

---

### DatabaseManager Mock

```python
from api.tests.mock_helpers import create_database_manager_mock

mock_db = create_database_manager_mock(
    fetchrow_result={"id": 1, "name": "test"},
    fetch_result=[{"id": 1}, {"id": 2}],
    execute_result="INSERT 1"
)

# Usage
row = await mock_db.fetchrow("SELECT * FROM table")
rows = await mock_db.fetch("SELECT * FROM table")
result = await mock_db.execute("INSERT INTO table VALUES (...)")
```

---

### WebSocket Mock

```python
from api.tests.mock_helpers import create_websocket_mock

ws = create_websocket_mock()

# Usage
await ws.send('{"type": "test"}')
message = await ws.receive()
await ws.close()

# Assertions
ws.send.assert_called_once()
```

---

### Database Pool Mock

```python
from api.tests.mock_helpers import create_async_pool_mock

mock_conn = AsyncMock()
mock_conn.execute = AsyncMock(return_value="SELECT 1")
mock_pool = create_async_pool_mock(mock_conn)

# Usage
async with mock_pool.acquire() as conn:
    result = await conn.execute("SELECT 1")
```

---

## 🔧 Advanced Patterns

### Custom Async Service Mock

```python
from api.tests.mock_helpers import create_async_service_mock

mock_custom = create_async_service_mock(
    MyCustomService,
    method_return_values={
        'fetch_data': {"result": "data"},
        'save_data': True,
        'get_count': 42  # sync method
    },
    async_methods=['fetch_data', 'save_data'],
    sync_methods=['get_count']
)
```

---

### Side Effects for Complex Behavior

```python
from api.tests.mock_helpers import patch_async_method

async def custom_logic(arg1, arg2):
    if arg1 == "special":
        return "special_result"
    return f"normal_{arg2}"

mock = patch_async_method(
    service,
    'process_data',
    side_effect=custom_logic
)

# Now calls to service.process_data() use custom_logic
```

---

## 🧪 Testing Patterns

### Pattern 1: Testing Async Service Interactions

```python
import pytest
from api.tests.mock_helpers import create_cache_service_mock

@pytest.fixture
def mock_cache():
    return create_cache_service_mock()

@pytest.mark.asyncio
async def test_service_uses_cache(mock_cache):
    # Arrange
    service = MyService(cache=mock_cache)

    # Act
    await service.do_something()

    # Assert
    mock_cache.get.assert_called_once_with("expected_key")
```

---

### Pattern 2: Testing WebSocket Broadcasts

```python
import pytest
from api.tests.mock_helpers import create_websocket_mock

@pytest.mark.asyncio
async def test_websocket_broadcast(manager):
    # Arrange
    ws1 = create_websocket_mock()
    ws2 = create_websocket_mock()

    await manager.connect(ws1, "client_1")
    await manager.connect(ws2, "client_2")

    # Act
    await manager.broadcast({"type": "update"})

    # Assert
    ws1.send.assert_called_once()
    ws2.send.assert_called_once()
```

---

### Pattern 3: Testing Database Operations

```python
import pytest
from api.tests.mock_helpers import create_database_manager_mock

@pytest.fixture
def mock_db():
    return create_database_manager_mock(
        fetchrow_result={"id": 1, "name": "test"}
    )

@pytest.mark.asyncio
async def test_database_query(mock_db):
    # Arrange
    service = MyService(db=mock_db)

    # Act
    result = await service.get_user_by_id(1)

    # Assert
    assert result["name"] == "test"
    mock_db.fetchrow.assert_called_once()
```

---

## 📋 Migration Checklist

When updating a test file:

- [ ] Import from `api.tests.mock_helpers`
- [ ] Replace `Mock(spec=AsyncClass)` with `AsyncMock(spec=AsyncClass)` or factory
- [ ] Remove redundant `mock.method = AsyncMock()` assignments
- [ ] Use `create_cache_service_mock()` instead of manual cache mocks
- [ ] Use `create_websocket_mock()` instead of manual WebSocket mocks
- [ ] Use `create_async_pool_mock()` for database pools
- [ ] Replace manual method replacement with `patch_async_method()`
- [ ] Verify sync methods use `Mock`, async methods use `AsyncMock`
- [ ] Run tests to ensure no breakage
- [ ] Update fixture docstrings to reference helpers

---

## 🚨 Common Mistakes to Avoid

### Mistake 1: Awaiting Sync Methods
```python
# WRONG
stats = await mock_cache.get_stats()  # get_stats is sync!

# RIGHT
stats = mock_cache.get_stats()  # No await
```

### Mistake 2: Not Awaiting Async Methods
```python
# WRONG
result = mock_cache.get("key")  # Returns coroutine, not value

# RIGHT
result = await mock_cache.get("key")
```

### Mistake 3: Using return_value Instead of side_effect for Functions
```python
# WRONG - won't work for callables
mock.method = AsyncMock(return_value=lambda x: x * 2)

# RIGHT
async def double(x):
    return x * 2
mock.method = AsyncMock(side_effect=double)
```

---

## 📚 Further Reading

- [Python unittest.mock documentation](https://docs.python.org/3/library/unittest.mock.html)
- [AsyncMock documentation](https://docs.python.org/3/library/unittest.mock.html#unittest.mock.AsyncMock)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [`api/tests/mock_helpers.py`](/api/tests/mock_helpers.py) - Implementation source

---

## 💬 Questions?

1. Check examples in `api/tests/mock_helpers.py`
2. Review existing migrated test files
3. Ask in #testing Slack channel
4. Create issue with `testing` label

---

**Last Updated:** 2025-11-09
**Maintained By:** Testing Infrastructure Team
