# COMPLETED

BUG-017: Async Mocking Framework Issues and Inconsistent Patterns

**Priority:** High  
**Status:** Open  
**Type:** Testing  
**Affected Components:** Test suite, Async service mocking

## Description

The test suite exhibits inconsistent async mocking patterns, improper AsyncMock usage, and framework-specific issues that affect test reliability and maintainability. Multiple test files show varying approaches to mocking async services.

## Evidence from Codebase

### 1. Inconsistent AsyncMock Usage Patterns

**WebSocketManager Tests** ([`api/tests/test_websocket_manager.py:202`](api/tests/test_websocket_manager.py:202)):
```python
@pytest.fixture
def mock_websocket(self):
    """Create mock WebSocket connection"""
    ws = AsyncMock()
    ws.send = AsyncMock()
    return ws
```

**Scenario Service Tests** ([`api/tests/test_scenario_service.py:32`](api/tests/test_scenario_service.py:32)):
```python
@pytest.fixture
def mock_cache_service():
    """Mock CacheService for testing"""
    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    cache.get_stats = Mock(return_value={"cache_hit_rate": 0.992})
    return cache
```

**FeatureFlag Service Tests** ([`api/tests/test_feature_flag_service.py:33`](api/tests/test_feature_flag_service.py:33)):
```python
@pytest.fixture
def mock_db_manager(self):
    """Mock DatabaseManager for testing"""
    db_manager = AsyncMock()
    db_manager.fetchrow = AsyncMock()
    db_manager.fetch = AsyncMock(return_value=[])
    db_manager.execute = AsyncMock()
    return db_manager
```

### 2. Mixed Mock/AsyncMock Patterns

**ScenarioValidationEngine Tests** ([`api/tests/test_scenario_validation.py:34`](api/tests/test_scenario_validation.py:34)):
```python
@pytest.fixture
def mock_cache_service():
    """Mock cache service for testing"""
    service = Mock(spec=CacheService)  # Using Mock instead of AsyncMock
    service.get = AsyncMock(return_value=None)
    service.set = AsyncMock(return_value=True)
    return service
```

### 3. Complex Mock Setup Issues

**DatabaseManager Tests** ([`api/tests/test_database_manager.py:126`](api/tests/test_database_manager.py:126)):
```python
mock_pool = AsyncMock()
mock_pool.acquire = MagicMock(
    return_value=MockAsyncContextManager(mock_conn)
)
```

**Scenario API Tests** ([`api/tests/test_scenario_api.py:30`](api/tests/test_scenario_api.py:30)):
```python
@pytest.fixture
def mock_feature_flag_enabled():
    """Mock feature flag service returning enabled"""
    with patch('api.main.feature_flag_service') as mock_ff:
        mock_ff.is_flag_enabled = AsyncMock(return_value=True)
        yield mock_ff
```

### 4. Async Function Mocking Problems

**RSS Deduplicator Tests** ([`api/tests/test_rss_deduplicator.py:248`](api/tests/test_rss_deduplicator.py:248)):
```python
# Mock the similarity calculation to return exactly 0.8
original_calc = deduplicator._calculate_similarity
async def mock_calc(c1, c2):
    if c1 != c2:  # Not identical
        return 0.8
    return 1.0  # Identical

deduplicator._calculate_similarity = mock_calc
```

## Issues Identified

1. **Inconsistent Mock Base Classes**: Mixing `Mock` and `AsyncMock` for the same service types
2. **Complex Mock Setup**: Overly complex mock configurations that are hard to maintain
3. **Missing Async Specifications**: Using `Mock` instead of `AsyncMock` for async services
4. **Manual Async Function Replacement**: Directly replacing async methods instead of proper mocking
5. **Inconsistent Return Value Patterns**: Some mocks return values, others return AsyncMock objects

## Impact

- **Test Reliability**: Inconsistent mocking can lead to false positives/negatives
- **Maintenance Burden**: Complex mock setups are difficult to understand and modify
- **Performance**: Overly complex mocks can slow down test execution
- **Framework Compatibility**: Mixed patterns may not work consistently across Python versions

## Recommended Solution / Possible Solutions

1. **Standardize AsyncMock Usage**: Use `AsyncMock` consistently for all async services
2. **Create Mock Factory Functions**: Centralize common mock patterns
3. **Use Proper Patch Decorators**: Replace manual method replacement with `patch` decorators
4. **Add Type Safety**: Ensure mocks match the interface they're replacing
5. **Document Mocking Patterns**: Create guidelines for consistent async mocking

## Example Improved Pattern

```python
@pytest.fixture
def standardized_async_mock():
    """Standardized async mock pattern"""
    mock = AsyncMock(spec=TargetService)
    mock.async_method = AsyncMock(return_value=expected_result)
    mock.sync_method = Mock(return_value=sync_result)
    return mock
```

## Related Files

- `api/tests/test_websocket_manager.py`
- `api/tests/test_scenario_service.py`
- `api/tests/test_feature_flag_service.py`
- `api/tests/test_scenario_validation.py`
- `api/tests/test_database_manager.py`
- `api/tests/test_scenario_api.py`
- `api/tests/test_rss_deduplicator.py`




Committed and Pushed
Branch: claude/again-plea-011CUwdFRVeR3DCypFPYPtZW Commit: b989ba7 - "feat: Complete BUG-017 async mocking framework solution"

Files Added (8 files, 3,833 lines):

✅ BUG-017-INDEX.md - Master navigation document
✅ BUG-017-QUICK-START.md - Quick start guide
✅ BUG-017-IMPLEMENTATION-SUMMARY.md - Implementation plan
✅ SOLUTIONS_BUG-017.md - Complete solutions (25KB)
✅ api/tests/mock_helpers.py - Factory functions
✅ docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md - Developer reference
✅ docs/testing/MIGRATION_EXAMPLE.md - Migration examples
✅ scripts/detect_async_mock_issues.py - Detection tool (executable)