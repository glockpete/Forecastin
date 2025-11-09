# 16 Performance Budgets

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Performance budgets and regression detection
**Evidence:** Current baseline from `direct_performance_test.py`

---

## Executive Summary

**Current Performance Baseline:**
- **Throughput:** 42,726 RPS (requests per second)
- **Ancestor Resolution:** 3.46ms (LTREE ancestor query)
- **Cache Hit Rate:** 99.2% (multi-tier caching)
- **Materialized View Refresh:** 850ms

**Performance Budget Philosophy:**
- No regressions >5% without explicit approval
- P95 latency budgets enforced in CI/CD
- Frontend bundle size limits
- Database query time limits

---

## Backend Performance Budgets

### 1. API Latency Budgets

**PATH:** Evidence from `/home/user/Forecastin/scripts/testing/direct_performance_test.py`

| Endpoint | P50 | P95 | P99 | Max | Current |
|----------|-----|-----|-----|-----|---------|
| `GET /api/v1/hierarchy` | 50ms | 150ms | 300ms | 500ms | ✅ 45ms |
| `GET /api/v1/entities/{id}` | 10ms | 30ms | 100ms | 200ms | ✅ 8ms |
| `POST /api/v1/entities` | 100ms | 300ms | 500ms | 1000ms | ✅ 95ms |
| `GET /api/v1/hierarchy/ancestors` | 5ms | 10ms | 20ms | 50ms | ✅ 3.46ms |
| `PUT /api/v1/entities/{id}` | 80ms | 250ms | 400ms | 800ms | - |
| `DELETE /api/v1/entities/{id}` | 60ms | 200ms | 350ms | 700ms | - |

**Acceptance Criteria:**
- P95 latency must remain below budget
- Any regression >5% requires explicit approval
- Budget violations fail CI/CD pipeline

**Test:**
```python
# scripts/testing/verify_performance_budgets.py

import json
from typing import Dict

BUDGETS = {
    "/api/v1/hierarchy": {"p95": 150},
    "/api/v1/entities/{id}": {"p95": 30},
    "/api/v1/hierarchy/ancestors": {"p95": 10}
}

def verify_budgets(results: Dict[str, Dict[str, float]]) -> bool:
    """Verify performance results meet budgets."""

    violations = []

    for endpoint, metrics in results.items():
        budget = BUDGETS.get(endpoint)
        if not budget:
            continue

        p95 = metrics.get("p95")
        if p95 > budget["p95"]:
            violations.append(
                f"{endpoint}: P95 {p95}ms exceeds budget {budget['p95']}ms"
            )

    if violations:
        print("❌ Performance Budget Violations:")
        for violation in violations:
            print(f"  - {violation}")
        return False

    print("✅ All performance budgets met")
    return True


if __name__ == "__main__":
    with open("performance_results.json") as f:
        results = json.load(f)

    success = verify_budgets(results)
    exit(0 if success else 1)
```

---

### 2. Throughput Budgets

**Current Baseline:** 42,726 RPS

| Scenario | Budget (RPS) | Current | Status |
|----------|--------------|---------|--------|
| Read-heavy (90% GET) | 40,000 | 42,726 | ✅ |
| Mixed workload (70% GET, 30% POST) | 30,000 | - | 🟡 |
| Write-heavy (50% POST/PUT) | 20,000 | - | 🟡 |

**Test:**
```python
# scripts/testing/throughput_test.py

import asyncio
import time
from httpx import AsyncClient

async def throughput_test(endpoint: str, duration: int = 60) -> float:
    """Measure throughput (RPS) for endpoint."""

    async with AsyncClient(base_url="http://localhost:8000") as client:
        requests_completed = 0
        start_time = time.time()

        async def make_request():
            nonlocal requests_completed
            await client.get(endpoint)
            requests_completed += 1

        # Run requests for specified duration
        tasks = []
        while time.time() - start_time < duration:
            tasks.append(asyncio.create_task(make_request()))

            # Limit concurrent requests to 1000
            if len(tasks) >= 1000:
                await asyncio.gather(*tasks)
                tasks = []

        if tasks:
            await asyncio.gather(*tasks)

        elapsed = time.time() - start_time
        rps = requests_completed / elapsed

        return rps


# Run test
rps = await throughput_test("/api/v1/hierarchy")
print(f"Throughput: {rps:.0f} RPS")

# Verify budget
assert rps >= 40_000, f"Throughput {rps} below budget 40,000 RPS"
```

---

### 3. Database Query Budgets

| Query Type | Budget | Current | Evidence |
|------------|--------|---------|----------|
| Ancestor lookup (LTREE) | <10ms | 3.46ms | ✅ `direct_performance_test.py` |
| Spatial query (PostGIS) | <50ms | - | 🟡 |
| Hierarchy traversal (depth 5) | <100ms | - | 🟡 |
| Full-text search | <200ms | - | 🟡 |

**Test:**
```python
# tests/performance/test_database_budgets.py

import pytest
import time

@pytest.mark.asyncio
async def test_ancestor_query_budget():
    """Verify LTREE ancestor query meets <10ms budget."""

    start = time.perf_counter()

    # Execute ancestor query
    result = await db.execute("""
        SELECT * FROM entities
        WHERE path @> 'world.asia.japan'
    """)

    elapsed_ms = (time.perf_counter() - start) * 1000

    assert elapsed_ms < 10, f"Ancestor query {elapsed_ms:.2f}ms exceeds 10ms budget"


@pytest.mark.asyncio
async def test_spatial_query_budget():
    """Verify PostGIS spatial query meets <50ms budget."""

    start = time.perf_counter()

    # Execute spatial query
    result = await db.execute("""
        SELECT * FROM entities
        WHERE ST_DWithin(location, ST_MakePoint(139.6917, 35.6895)::geography, 10000)
        LIMIT 100
    """)

    elapsed_ms = (time.perf_counter() - start) * 1000

    assert elapsed_ms < 50, f"Spatial query {elapsed_ms:.2f}ms exceeds 50ms budget"
```

---

### 4. Cache Performance Budgets

**Current Baseline:** 99.2% hit rate

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| L1 (memory) hit rate | >95% | - | 🟡 |
| L2 (Redis) hit rate | >90% | - | 🟡 |
| Overall hit rate | >99% | 99.2% | ✅ |
| Cache lookup time | <1ms | - | 🟡 |
| Cache write time | <5ms | - | 🟡 |

**Test:**
```python
# tests/performance/test_cache_budgets.py

@pytest.mark.asyncio
async def test_cache_hit_rate():
    """Verify cache hit rate meets >99% budget."""

    # Make 1000 requests for same entity
    hits = 0
    misses = 0

    for _ in range(1000):
        start = time.perf_counter()
        entity = await cache_service.get("entity:123")
        elapsed_ms = (time.perf_counter() - start) * 1000

        if entity:
            hits += 1
            # Cache hit should be <1ms
            assert elapsed_ms < 1, f"Cache hit {elapsed_ms:.2f}ms exceeds 1ms budget"
        else:
            misses += 1

    hit_rate = hits / (hits + misses) * 100
    assert hit_rate >= 99, f"Cache hit rate {hit_rate:.1f}% below 99% budget"
```

---

### 5. Materialized View Refresh Budgets

**Current Baseline:** 850ms

| View | Budget | Current | Frequency |
|------|--------|---------|-----------|
| `hierarchy_mv` | <1000ms | 850ms | On entity change |
| `statistics_mv` | <5000ms | - | Every 5 minutes |
| `aggregated_metrics_mv` | <10000ms | - | Hourly |

**Test:**
```python
@pytest.mark.asyncio
async def test_materialized_view_refresh_budget():
    """Verify materialized view refresh meets <1000ms budget."""

    start = time.perf_counter()

    await db.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY hierarchy_mv")

    elapsed_ms = (time.perf_counter() - start) * 1000

    assert elapsed_ms < 1000, f"MV refresh {elapsed_ms:.2f}ms exceeds 1000ms budget"
```

---

## Frontend Performance Budgets

### 1. Bundle Size Budgets

| Asset Type | Budget | Current | Status |
|------------|--------|---------|--------|
| Initial JS bundle (gzipped) | <300 KB | - | 🟡 |
| Initial CSS bundle (gzipped) | <50 KB | - | 🟡 |
| Lazy-loaded chunks (each) | <100 KB | - | 🟡 |
| Total JS (all chunks) | <1 MB | - | 🟡 |
| Images (per image) | <200 KB | - | 🟡 |

**Configuration:**

**File:** `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-tanstack': ['@tanstack/react-query'],
          'vendor-deck': ['deck.gl', '@deck.gl/core'],
          'vendor-map': ['maplibre-gl']
        }
      }
    },

    // Warn if chunk exceeds budget
    chunkSizeWarningLimit: 100 // KB
  },

  plugins: [
    visualizer({
      filename: 'bundle-analysis.html',
      open: false,
      gzipSize: true
    })
  ]
});
```

**CI/CD Enforcement:**

```yaml
# .github/workflows/bundle-size.yml

name: Bundle Size Check

on: pull_request

jobs:
  check-bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build frontend
        working-directory: frontend
        run: |
          npm ci
          npm run build

      - name: Check bundle sizes
        working-directory: frontend
        run: |
          # Get size of main bundle
          BUNDLE_SIZE=$(stat -f%z dist/assets/index-*.js)
          GZIP_SIZE=$(gzip -c dist/assets/index-*.js | wc -c)

          echo "Bundle size: $BUNDLE_SIZE bytes"
          echo "Gzipped size: $GZIP_SIZE bytes"

          # Budget: 300 KB gzipped
          if [ $GZIP_SIZE -gt 307200 ]; then
            echo "❌ Bundle size $GZIP_SIZE exceeds budget 307200"
            exit 1
          fi

          echo "✅ Bundle size within budget"
```

---

### 2. Page Load Time Budgets

| Metric | Budget | Target |
|--------|--------|--------|
| First Contentful Paint (FCP) | <1.8s | <1.0s |
| Largest Contentful Paint (LCP) | <2.5s | <1.5s |
| Time to Interactive (TTI) | <3.8s | <2.0s |
| Cumulative Layout Shift (CLS) | <0.1 | <0.05 |
| First Input Delay (FID) | <100ms | <50ms |

**Lighthouse CI Integration:**

```yaml
# .github/workflows/lighthouse.yml

name: Lighthouse CI

on: pull_request

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and serve
        working-directory: frontend
        run: |
          npm ci
          npm run build
          npm run preview -- --port 3000 &
          sleep 5

      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            http://localhost:3000
          budgetPath: .lighthouserc.json
          uploadArtifacts: true
```

**File:** `frontend/.lighthouserc.json`

```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interactive": ["error", { "maxNumericValue": 3800 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "max-potential-fid": ["error", { "maxNumericValue": 100 }]
      }
    }
  }
}
```

---

### 3. Runtime Performance Budgets

| Metric | Budget | Notes |
|--------|--------|-------|
| Map initial render | <500ms | deck.gl layer initialization |
| Layer update (1000 features) | <100ms | Incremental updates |
| Hierarchy tree expand | <200ms | Fetch + render children |
| WebSocket event handling | <50ms | Process + update UI |
| Search autocomplete | <100ms | Debounced, includes API call |

**Test:**

```typescript
// frontend/src/__tests__/performance/map-render.test.ts

import { render } from '@testing-library/react';
import { GeospatialView } from '@/components/Map/GeospatialView';

test('map renders within 500ms budget', async () => {
  const start = performance.now();

  render(<GeospatialView />);

  // Wait for map to initialize
  await waitFor(() => {
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  const elapsed = performance.now() - start;

  expect(elapsed).toBeLessThan(500); // 500ms budget
});
```

---

## Performance Monitoring

### 1. Continuous Monitoring

**Backend: Prometheus Metrics**

```python
# api/middleware/metrics.py

from prometheus_client import Histogram, Counter

# Latency histogram
http_request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint', 'status']
)

# Request counter
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

@app.middleware("http")
async def track_metrics(request: Request, call_next):
    start = time.time()

    response = await call_next(request)

    duration = time.time() - start

    http_request_duration.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).observe(duration)

    http_requests_total.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()

    return response
```

**Frontend: Real User Monitoring (RUM)**

```typescript
// frontend/src/utils/monitoring.ts

export function trackPerformance() {
  // Capture Core Web Vitals
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.log(entry.name, entry.value);

        // Send to monitoring service
        fetch('/api/v1/metrics/webvitals', {
          method: 'POST',
          body: JSON.stringify({
            name: entry.name,
            value: entry.value,
            rating: entry.rating
          })
        });
      }
    });

    observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
  }
}
```

---

### 2. Alerting Rules

**Prometheus Alerts:**

```yaml
# prometheus/alerts.yml

groups:
  - name: performance_budgets
    interval: 1m
    rules:
      - alert: HighP95Latency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.15
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency exceeds 150ms budget"

      - alert: LowThroughput
        expr: rate(http_requests_total[1m]) < 40000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Throughput below 40,000 RPS budget"

      - alert: LowCacheHitRate
        expr: cache_hit_rate < 0.99
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit rate below 99% budget"
```

---

## Performance Regression Prevention

### CI/CD Performance Gate

```yaml
# .github/workflows/performance-gate.yml

name: Performance Gate

on: pull_request

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - name: Run baseline performance tests
        run: |
          python scripts/testing/direct_performance_test.py > baseline.json

      - name: Verify budgets
        run: |
          python scripts/testing/verify_performance_budgets.py \
            --results baseline.json \
            --budgets REBUILD_DOSSIER/20251109-0521/16_PERF_BUDGETS.md

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('baseline.json'));

            const comment = `## Performance Results\n\n` +
              `| Metric | Value | Budget | Status |\n` +
              `|--------|-------|--------|--------|\n` +
              `| Throughput | ${results.throughput} RPS | 40,000 RPS | ${results.throughput >= 40000 ? '✅' : '❌'} |\n` +
              `| Ancestor query | ${results.ancestor_time}ms | 10ms | ${results.ancestor_time < 10 ? '✅' : '❌'} |\n` +
              `| Cache hit rate | ${results.cache_hit_rate}% | 99% | ${results.cache_hit_rate >= 99 ? '✅' : '❌'} |\n`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

---

**Performance Budgets Complete**
**Enforced via CI/CD, monitored continuously**
**No regressions >5% without approval**
