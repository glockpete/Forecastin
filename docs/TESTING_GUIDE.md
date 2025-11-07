# Testing Guide

Comprehensive guide to testing in the Forecastin project.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Categories](#test-categories)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [Performance Testing](#performance-testing)
- [WebSocket Testing](#websocket-testing)
- [Integration Testing](#integration-testing)
- [Coverage Requirements](#coverage-requirements)
- [Continuous Integration](#continuous-integration)
- [Best Practices](#best-practices)

## Testing Philosophy

Forecastin follows a pragmatic testing approach:

1. **High-value tests first**: Focus on critical user paths and complex logic
2. **Test behaviour, not implementation**: Test what the code does, not how it does it
3. **Fast feedback loops**: Unit tests should be fast, integration tests thorough
4. **Performance as a feature**: Performance tests are first-class citizens
5. **Fail fast**: Tests should catch issues early in development

## Test Categories

### Unit Tests

Test individual functions and classes in isolation.

**Location**:
- Backend: `api/tests/test_*.py`
- Frontend: `frontend/src/**/*.test.ts(x)`

**When to write**: For every new function, class, or component

### Integration Tests

Test interactions between components and external services.

**Location**:
- Backend: `api/tests/test_*_integration.py`
- Frontend: `frontend/tests/*Integration*.test.ts`

**When to write**: For API endpoints, database operations, WebSocket flows

### Performance Tests

Validate performance against SLOs defined in AGENTS.md.

**Location**: `api/tests/test_performance.py`

**When to write**: For optimizations, database queries, caching logic

### End-to-End Tests

Test complete user workflows (future implementation).

**Location**: `e2e/` (planned)

**When to write**: For critical user journeys

## Backend Testing

### Setup

```bash
cd api

# Install test dependencies
pip install pytest pytest-cov pytest-asyncio pytest-benchmark

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html
```

### Test Structure

```python
"""
tests/test_hierarchy_resolver.py

Test the OptimizedHierarchyResolver for LTREE operations.
"""

import pytest
from navigation_api.database.optimized_hierarchy_resolver import OptimizedHierarchyResolver


class TestHierarchyResolver:
    """Tests for hierarchy resolution operations."""

    @pytest.fixture
    def resolver(self, db_manager):
        """Create a resolver instance for testing."""
        return OptimizedHierarchyResolver(db_manager)

    @pytest.mark.asyncio
    async def test_get_ancestors(self, resolver):
        """Test ancestor retrieval returns correct hierarchy."""
        # Arrange
        path = "world.asia.japan.tokyo"

        # Act
        ancestors = await resolver.get_ancestors(path)

        # Assert
        assert len(ancestors) == 4
        assert ancestors[0]['name'] == 'World'
        assert ancestors[-1]['name'] == 'Tokyo'

    @pytest.mark.asyncio
    async def test_get_ancestors_performance(self, resolver, benchmark):
        """Test ancestor resolution meets <10ms SLO."""
        path = "world.asia.japan.tokyo"

        result = benchmark(lambda: resolver.get_ancestors_sync(path))

        assert result.stats.mean < 0.010  # 10ms SLO
```

### Running Backend Tests

```bash
# All tests
pytest tests/ -v

# Specific test file
pytest tests/test_hierarchy_resolver.py -v

# Specific test method
pytest tests/test_hierarchy_resolver.py::TestHierarchyResolver::test_get_ancestors -v

# Skip slow tests
pytest tests/ -v -m "not slow"

# Run only integration tests
pytest tests/ -v -m integration

# Run with coverage
pytest tests/ --cov=. --cov-report=html

# View coverage report
open htmlcov/index.html
```

### Backend Test Fixtures

Common fixtures in `api/tests/conftest.py`:

```python
import pytest
from services.database_manager import DatabaseManager
from services.cache_service import CacheService


@pytest.fixture
async def db_manager():
    """Provide database manager for testing."""
    manager = DatabaseManager()
    await manager.connect()
    yield manager
    await manager.close()


@pytest.fixture
def cache_service():
    """Provide cache service for testing."""
    return CacheService(redis_url="redis://localhost:6379/1")  # Use test DB


@pytest.fixture
async def clean_database(db_manager):
    """Clean database before and after test."""
    await db_manager.execute("TRUNCATE entities CASCADE;")
    yield
    await db_manager.execute("TRUNCATE entities CASCADE;")
```

### Mocking External Services

```python
from unittest.mock import AsyncMock, patch
import pytest


@pytest.mark.asyncio
async def test_rss_ingestion_with_mock():
    """Test RSS ingestion with mocked HTTP requests."""
    mock_response = AsyncMock()
    mock_response.text = "<rss>...</rss>"
    mock_response.status = 200

    with patch('aiohttp.ClientSession.get', return_value=mock_response):
        service = RSSIngestionService()
        result = await service.ingest_feed("http://example.com/feed")

        assert result['status'] == 'success'
```

### Database Testing

```python
@pytest.mark.asyncio
async def test_ltree_query_performance(db_manager):
    """Test LTREE query meets performance SLO."""
    # Insert test data
    await db_manager.execute("""
        INSERT INTO entities (name, path, entity_type)
        VALUES ('Japan', 'world.asia.japan', 'country');
    """)

    # Query and measure
    import time
    start = time.perf_counter()

    result = await db_manager.fetch_one("""
        SELECT * FROM entities WHERE path <@ 'world.asia';
    """)

    duration = (time.perf_counter() - start) * 1000  # Convert to ms

    assert result is not None
    assert duration < 10  # 10ms SLO
```

## Frontend Testing

### Setup

```bash
cd frontend

# Tests use Vitest (configured in package.json)
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

### Component Testing

```typescript
/**
 * tests/MillerColumns.test.tsx
 *
 * Test the MillerColumns navigation component.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MillerColumns } from '../components/MillerColumns/MillerColumns';

describe('MillerColumns', () => {
  const queryClient = new QueryClient();

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('renders initial column', () => {
    render(<MillerColumns initialPath="world" />, { wrapper });

    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('navigates on column click', async () => {
    render(<MillerColumns initialPath="world" />, { wrapper });

    const asiaItem = await screen.findByText('Asia');
    fireEvent.click(asiaItem);

    expect(await screen.findByText('Japan')).toBeInTheDocument();
  });

  it('displays breadcrumb navigation', async () => {
    render(<MillerColumns initialPath="world.asia.japan" />, { wrapper });

    expect(screen.getByText('World')).toBeInTheDocument();
    expect(screen.getByText('Asia')).toBeInTheDocument();
    expect(screen.getByText('Japan')).toBeInTheDocument();
  });
});
```

### Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEntityHierarchy } from '../hooks/useEntityHierarchy';

describe('useEntityHierarchy', () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('fetches entity hierarchy', async () => {
    const { result } = renderHook(
      () => useEntityHierarchy('world.asia.japan'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.path).toBe('world.asia.japan');
  });

  it('handles error states', async () => {
    // Mock API to return error
    const { result } = renderHook(
      () => useEntityHierarchy('invalid.path'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});
```

### State Management Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useNavigationStore } from '../store/navigationStore';

describe('navigationStore', () => {
  it('updates current path', () => {
    const { result } = renderHook(() => useNavigationStore());

    act(() => {
      result.current.setCurrentPath('world.asia.japan');
    });

    expect(result.current.currentPath).toBe('world.asia.japan');
  });

  it('maintains breadcrumb history', () => {
    const { result } = renderHook(() => useNavigationStore());

    act(() => {
      result.current.setCurrentPath('world');
      result.current.setCurrentPath('world.asia');
      result.current.setCurrentPath('world.asia.japan');
    });

    expect(result.current.breadcrumbs).toHaveLength(3);
  });
});
```

### Mocking API Calls

Using Mock Service Worker (MSW):

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/entities', (req, res, ctx) => {
    return res(
      ctx.json([
        { id: '1', name: 'World', path: 'world' },
        { id: '2', name: 'Asia', path: 'world.asia' },
      ])
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('fetches entities from API', async () => {
  // Test implementation
});
```

## Performance Testing

### Backend Performance Tests

Performance tests validate against SLOs defined in AGENTS.md:

```python
"""
tests/test_performance.py

Validate performance against AGENTS.md SLOs.
"""

import pytest
import time
from navigation_api.database.optimized_hierarchy_resolver import OptimizedHierarchyResolver


class TestPerformanceSLOs:
    """Validate performance SLOs from AGENTS.md."""

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_ancestor_resolution_slo(self, resolver):
        """
        SLO: Ancestor resolution < 10ms (target: 1.25ms)
        Reference: AGENTS.md line 59
        """
        path = "world.asia.japan.tokyo.shibuya"
        iterations = 100
        times = []

        for _ in range(iterations):
            start = time.perf_counter()
            await resolver.get_ancestors(path)
            duration = (time.perf_counter() - start) * 1000  # ms
            times.append(duration)

        p95 = sorted(times)[int(len(times) * 0.95)]
        mean = sum(times) / len(times)

        assert mean < 10.0, f"Mean: {mean:.2f}ms exceeds 10ms SLO"
        assert p95 < 15.0, f"P95: {p95:.2f}ms exceeds acceptable threshold"

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_cache_hit_rate_slo(self, cache_service):
        """
        SLO: Cache hit rate > 90% (target: 99.2%)
        Reference: AGENTS.md line 62
        """
        # Warm cache
        for i in range(100):
            await cache_service.set(f"key_{i}", f"value_{i}")

        # Measure hits
        hits = 0
        total = 100

        for i in range(total):
            result = await cache_service.get(f"key_{i}")
            if result is not None:
                hits += 1

        hit_rate = (hits / total) * 100

        assert hit_rate >= 90.0, f"Hit rate {hit_rate:.1f}% below 90% SLO"

    @pytest.mark.benchmark
    def test_throughput_benchmark(self, benchmark, resolver):
        """
        SLO: Throughput > 10,000 RPS (target: 42,726 RPS)
        Reference: AGENTS.md line 61
        """
        result = benchmark(lambda: resolver.get_ancestors_sync("world.asia"))

        # Calculate RPS from benchmark stats
        rps = 1 / result.stats.mean

        assert rps > 10000, f"Throughput {rps:.0f} RPS below 10,000 SLO"
```

### Load Testing

Use `locust` for load testing:

```python
"""
tests/locustfile.py

Load testing configuration.
"""

from locust import HttpUser, task, between


class ForecastinUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def get_entities(self):
        self.client.get("/api/entities")

    @task(2)
    def get_hierarchy(self):
        self.client.get("/api/entities/some-id/hierarchy")

    @task(1)
    def health_check(self):
        self.client.get("/health")
```

Run load tests:

```bash
# Install locust
pip install locust

# Run load test
locust -f tests/locustfile.py --host=http://localhost:9000

# Open web UI at http://localhost:8089
```

## WebSocket Testing

### Backend WebSocket Tests

```python
"""
tests/test_ws_health.py

Test WebSocket health endpoint.
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from main import app


def test_websocket_health_connection():
    """Test WebSocket health endpoint accepts connections."""
    client = TestClient(app)

    with client.websocket_connect("/ws/health") as websocket:
        # Should receive heartbeat within 30 seconds
        data = websocket.receive_json(timeout=35)

        assert data['type'] == 'heartbeat'
        assert 'ping_number' in data
        assert 'timestamp' in data


def test_websocket_echo():
    """Test WebSocket echo functionality."""
    client = TestClient(app)

    with client.websocket_connect("/ws/echo") as websocket:
        # Send test message
        websocket.send_json({"type": "test", "data": "hello"})

        # Receive echo
        response = websocket.receive_json()

        assert response['type'] == 'echo'
        assert response['original']['data'] == 'hello'
```

### Frontend WebSocket Tests

```typescript
/**
 * tests/WebSocketManager.test.ts
 *
 * Test WebSocket connection management.
 */

import { WebSocketManager } from '../ws/WebSocketManager';

describe('WebSocketManager', () => {
  let wsManager: WebSocketManager;

  beforeEach(() => {
    wsManager = new WebSocketManager('ws://localhost:9000/ws');
  });

  afterEach(() => {
    wsManager.disconnect();
  });

  it('connects to WebSocket server', (done) => {
    wsManager.on('connected', () => {
      expect(wsManager.isConnected()).toBe(true);
      done();
    });

    wsManager.connect();
  });

  it('handles incoming messages', (done) => {
    wsManager.on('message', (data) => {
      expect(data.type).toBe('entity_update');
      done();
    });

    wsManager.connect();
  });

  it('reconnects on disconnect', (done) => {
    let reconnectCount = 0;

    wsManager.on('reconnecting', () => {
      reconnectCount++;
      if (reconnectCount === 1) {
        done();
      }
    });

    wsManager.connect();
    // Simulate disconnect
    wsManager['ws']?.close();
  });
});
```

## Integration Testing

### API Integration Tests

```python
"""
tests/test_api_integration.py

Integration tests for API endpoints.
"""

import pytest
from httpx import AsyncClient
from main import app


@pytest.mark.asyncio
async def test_entity_hierarchy_flow():
    """Test complete entity hierarchy retrieval flow."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # 1. Get all entities
        response = await client.get("/api/entities")
        assert response.status_code == 200
        entities = response.json()

        # 2. Get hierarchy for first entity
        if entities:
            entity_id = entities[0]['id']
            response = await client.get(f"/api/entities/{entity_id}/hierarchy")
            assert response.status_code == 200
            hierarchy = response.json()
            assert 'ancestors' in hierarchy

        # 3. Refresh materialized views
        response = await client.post("/api/entities/refresh")
        assert response.status_code == 200
        assert response.json()['status'] == 'success'
```

### Database Integration Tests

```python
@pytest.mark.integration
@pytest.mark.asyncio
async def test_ltree_hierarchy_operations(db_manager):
    """Test LTREE operations work correctly."""
    # Insert test hierarchy
    await db_manager.execute("""
        INSERT INTO entities (name, path, entity_type)
        VALUES
            ('World', 'world', 'region'),
            ('Asia', 'world.asia', 'region'),
            ('Japan', 'world.asia.japan', 'country');
    """)

    # Query descendants
    descendants = await db_manager.fetch_all("""
        SELECT * FROM entities WHERE path <@ 'world.asia';
    """)

    assert len(descendants) >= 2  # Asia and Japan

    # Query ancestors
    ancestors = await db_manager.fetch_all("""
        SELECT * FROM entities WHERE 'world.asia.japan' ~ path;
    """)

    assert len(ancestors) == 3  # World, Asia, Japan
```

## Coverage Requirements

### Coverage Targets

| Component | Target | Current |
|-----------|--------|---------|
| Backend Core | 80% | - |
| Backend Services | 85% | - |
| Frontend Components | 70% | - |
| Frontend Hooks | 80% | - |
| Integration Tests | 60% | - |

### Generating Coverage Reports

```bash
# Backend coverage
cd api
pytest tests/ --cov=. --cov-report=html --cov-report=term

# Frontend coverage
cd frontend
npm run test:coverage

# View reports
open api/htmlcov/index.html
open frontend/coverage/lcov-report/index.html
```

### Coverage Exclusions

Exclude from coverage:

- Generated code
- Type definitions
- Migration scripts
- Configuration files
- Test utilities

## Continuous Integration

### GitHub Actions Workflow

Tests run automatically on:
- Push to `main` branch
- Pull request creation
- Pull request updates

### CI Test Matrix

```yaml
# .github/workflows/test.yml
strategy:
  matrix:
    python-version: [3.9, 3.10, 3.11]
    node-version: [18.x, 20.x]
```

### Pre-commit Hooks

Install pre-commit hooks:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

## Best Practices

### DO ✅

- Write tests before fixing bugs (TDD for bug fixes)
- Test edge cases and error conditions
- Use descriptive test names
- Keep tests independent and isolated
- Mock external services
- Clean up test data
- Use fixtures for common setup
- Test performance-critical code paths
- Document complex test scenarios

### DON'T ❌

- Test implementation details
- Write overly complex tests
- Share state between tests
- Commit failing tests
- Skip tests in CI
- Test framework code
- Write tests that depend on execution order
- Ignore flaky tests
- Skip error handling tests

### Test Naming Convention

```python
# Backend
def test_<function>_<scenario>_<expected_result>():
    """Test description."""

# Examples:
def test_get_ancestors_with_valid_path_returns_hierarchy():
def test_cache_set_with_expired_key_overwrites_value():
def test_websocket_connect_with_invalid_origin_rejects_connection():
```

```typescript
// Frontend
describe('ComponentName', () => {
  it('does something when condition', () => {
    // Test
  });
});

// Examples:
it('renders loading state when data is fetching')
it('calls onSelect handler when item is clicked')
it('displays error message when fetch fails')
```

## Troubleshooting Tests

### Tests Fail Locally But Pass in CI

- Check environment variables
- Check database state
- Check for timing issues
- Verify dependencies versions

### Flaky Tests

- Add explicit waits for async operations
- Use `waitFor` in frontend tests
- Check for race conditions
- Isolate test data

### Slow Tests

- Use `pytest -m "not slow"` to skip slow tests
- Optimize database queries in tests
- Use connection pooling
- Mock expensive operations

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [React Testing Library](https://testing-library.com/react)
- [Vitest Documentation](https://vitest.dev/)
- [MSW (Mock Service Worker)](https://mswjs.io/)

---

**Remember**: Tests are documentation. Write tests that future developers (including yourself) will thank you for.
