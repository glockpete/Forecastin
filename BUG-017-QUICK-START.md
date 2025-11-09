# BUG-017: Async Mocking Issues - Quick Start

> **TL;DR:** Standardized async mocking utilities are ready. Use factory functions from `mock_helpers.py` instead of manual mock creation.

---

## 🎯 What's Been Created

### ✅ Core Files

| File | Purpose | Status |
|------|---------|--------|
| `api/tests/mock_helpers.py` | Factory functions for creating mocks | ✅ Ready |
| `scripts/detect_async_mock_issues.py` | Find problematic patterns | ✅ Ready |
| `SOLUTIONS_BUG-017.md` | Detailed solutions | ✅ Ready |
| `docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md` | Developer guide | ✅ Ready |
| `docs/testing/MIGRATION_EXAMPLE.md` | Migration examples | ✅ Ready |

---

## 🚀 Quick Usage

### Before (Old Pattern) ❌

```python
@pytest.fixture
def mock_cache_service():
    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.get_stats = Mock(return_value={"cache_hit_rate": 0.992})
    return cache
```

### After (New Pattern) ✅

```python
from api.tests.mock_helpers import create_cache_service_mock

@pytest.fixture
def mock_cache_service():
    return create_cache_service_mock()
```

**Benefits:** 5 lines → 1 line, consistent, type-safe, maintainable

---

## 🔍 Find Issues in Your Tests

```bash
# Scan all test files
python scripts/detect_async_mock_issues.py api/tests/

# Scan specific file
python scripts/detect_async_mock_issues.py api/tests/test_your_file.py
```

**Output shows:**
- 🔴 Critical issues (must fix)
- ⚠️ Warnings (should fix)
- ℹ️ Info (nice to fix)

---

## 📚 Available Factory Functions

### CacheService Mock
```python
from api.tests.mock_helpers import create_cache_service_mock

mock_cache = create_cache_service_mock(
    get_value={"key": "value"},
    stats={"cache_hit_rate": 0.99}
)
```

### RealtimeService Mock
```python
from api.tests.mock_helpers import create_realtime_service_mock

mock_realtime = create_realtime_service_mock()
```

### DatabaseManager Mock
```python
from api.tests.mock_helpers import create_database_manager_mock

mock_db = create_database_manager_mock(
    fetchrow_result={"id": 1, "name": "test"}
)
```

### WebSocket Mock
```python
from api.tests.mock_helpers import create_websocket_mock

ws = create_websocket_mock()
```

### Database Pool Mock
```python
from api.tests.mock_helpers import create_async_pool_mock

mock_pool = create_async_pool_mock(connection_mock)
```

---

## 🐛 Current Issues Found

**Critical (Must Fix):**
- 🔴 1 file using `Mock(spec=AsyncService)` instead of `AsyncMock`

**Warnings (Should Fix):**
- ⚠️ 20+ redundant `AsyncMock()` assignments
- ⚠️ Several mixed sync/async patterns
- ⚠️ Manual method replacements

**Info (Nice to Have):**
- ℹ️ 7+ files missing `mock_helpers` imports

---

## 📖 Documentation

### Start Here
1. **[Quick Reference](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md)** - Common patterns
2. **[Migration Examples](docs/testing/MIGRATION_EXAMPLE.md)** - Before/after
3. **[Full Solutions](SOLUTIONS_BUG-017.md)** - Complete details

### For Implementation
1. Check detection script output
2. Review Migration Examples for your use case
3. Update test file
4. Run tests
5. Re-run detection script to verify

---

## ✅ Migration Checklist

When updating a test file:

- [ ] Run detection script on file
- [ ] Import from `mock_helpers`
- [ ] Replace manual mocks with factory functions
- [ ] Run tests (`pytest api/tests/test_your_file.py -v`)
- [ ] Verify with detection script
- [ ] Commit changes

---

## 🎓 Common Patterns

### Pattern 1: Basic Service Mock
```python
# Import
from api.tests.mock_helpers import create_cache_service_mock

# Use in fixture
@pytest.fixture
def mock_cache():
    return create_cache_service_mock()

# Use in test
@pytest.mark.asyncio
async def test_something(mock_cache):
    result = await mock_cache.get("key")
    mock_cache.get.assert_called_once_with("key")
```

### Pattern 2: Custom Return Values
```python
@pytest.fixture
def mock_cache_with_data():
    return create_cache_service_mock(
        get_value={"user_id": 123, "name": "test"}
    )
```

### Pattern 3: WebSocket Testing
```python
from api.tests.mock_helpers import create_websocket_mock

@pytest.mark.asyncio
async def test_websocket(manager):
    ws = create_websocket_mock()
    await manager.connect(ws, "client_1")
    await manager.broadcast({"type": "update"})
    ws.send.assert_called_once()
```

---

## 🚨 Top 3 Mistakes to Avoid

### 1. Using Mock for Async Services ❌
```python
# WRONG
service = Mock(spec=CacheService)
service.get = AsyncMock()

# RIGHT
from api.tests.mock_helpers import create_cache_service_mock
service = create_cache_service_mock()
```

### 2. Redundant AsyncMock Assignments ❌
```python
# WRONG
ws = AsyncMock()
ws.send = AsyncMock()

# RIGHT
from api.tests.mock_helpers import create_websocket_mock
ws = create_websocket_mock()
```

### 3. Manual Method Replacement ❌
```python
# WRONG
original = obj.method
obj.method = async_mock_function

# RIGHT
from api.tests.mock_helpers import patch_async_method
patch_async_method(obj, 'method', return_value="result")
```

---

## 📊 Expected Impact

**Code Reduction:** 76% fewer lines of mock setup code
**Consistency:** 100% standardized patterns
**Issues Fixed:** 30+ anti-patterns eliminated
**Maintainability:** Centralized in one file

---

## 💡 Need Help?

1. **Examples:** See `docs/testing/MIGRATION_EXAMPLE.md`
2. **Reference:** See `docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md`
3. **Implementation:** Check `api/tests/mock_helpers.py` source
4. **Issues:** Run detection script for guidance

---

## 🎯 Next Actions

### Immediate
1. ✅ Review this document
2. ✅ Run detection script: `python scripts/detect_async_mock_issues.py api/tests/`
3. [ ] Fix critical issue in `test_scenario_validation.py`
4. [ ] Pick one test file to migrate as practice

### This Week
1. [ ] Migrate high-priority test files
2. [ ] Team review/discussion
3. [ ] Update team guidelines

---

**Quick Links:**
- [Implementation Summary](BUG-017-IMPLEMENTATION-SUMMARY.md)
- [Full Solutions](SOLUTIONS_BUG-017.md)
- [Quick Reference](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md)
- [Migration Examples](docs/testing/MIGRATION_EXAMPLE.md)

**Status:** ✅ Ready for implementation
**Last Updated:** 2025-11-09
