# Stack-Level Fixes Cheat Sheet

Quick reference for implementing RSS pipeline, materialized view refresh, and RSSHub integration.

---

## #5: RSS Pipeline Completion

### Current State
- ✅ Service implemented: `api/services/rss/rss_ingestion_service.py` (592 lines)
- ✅ Entity extraction: `api/services/rss/entity_extraction/extractor.py` (179 lines)
- ✅ Database schema: `migrations/004_rss_entity_extraction_schema.sql`
- ❌ No API routes exposed
- ❌ Service never instantiated in `main.py`

### Decision Required
Choose ONE approach:

| Approach | When to Use | Pros | Cons |
|----------|------------|------|------|
| **REST API** | User-triggered ingestion | Full control, testable | Requires auth, rate limiting |
| **Background Cron** | Automated periodic ingestion | No user action needed | Harder to debug, needs scheduler |
| **Admin-Only** | Internal/restricted use | Simple, secure | Limited accessibility |
| **Hybrid** (Recommended) | Production systems | Best of all worlds | More initial setup |

### Implementation Steps

#### Option 1: REST API Endpoints

**1. Add routes to `api/main.py`:**

```python
from api.services.rss.rss_ingestion_service import RSSIngestionService
from api.routes import rss_routes

# In create_app() startup event
@app.on_event("startup")
async def startup():
    # ... existing services ...
    app.state.rss_service = RSSIngestionService(
        cache_service=app.state.cache_service,
        realtime_service=app.state.realtime_service,
        hierarchy_resolver=app.state.hierarchy_resolver
    )

# Register routes
app.include_router(rss_routes.router, prefix="/api/rss", tags=["rss"])
```

**2. Create `api/routes/rss_routes.py`:**

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from typing import List
from api.dependencies import get_rss_service, require_admin

router = APIRouter()

class RSSFeedRequest(BaseModel):
    url: HttpUrl
    category: str | None = None
    priority: int = 5

class IngestResponse(BaseModel):
    job_id: str
    status: str
    articles_processed: int | None = None

# User-triggered ingestion (requires auth)
@router.post("/ingest", response_model=IngestResponse)
async def ingest_feed(
    request: RSSFeedRequest,
    background_tasks: BackgroundTasks,
    rss_service: RSSIngestionService = Depends(get_rss_service),
    user = Depends(require_admin)  # Add your auth dependency
):
    """Ingest a single RSS feed (admin only)."""
    job_id = await rss_service.create_ingestion_job(str(request.url))

    # Run in background to avoid timeout
    background_tasks.add_task(
        rss_service.ingest_rss_feed,
        feed_config={
            "url": str(request.url),
            "category": request.category,
            "priority": request.priority
        },
        job_id=job_id
    )

    return IngestResponse(job_id=job_id, status="queued")

# Check job status
@router.get("/jobs/{job_id}", response_model=IngestResponse)
async def get_job_status(
    job_id: str,
    rss_service: RSSIngestionService = Depends(get_rss_service)
):
    """Get status of an ingestion job."""
    job = await rss_service.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return IngestResponse(**job)

# List configured feeds
@router.get("/feeds")
async def list_feeds(
    rss_service: RSSIngestionService = Depends(get_rss_service)
):
    """List all configured RSS feeds."""
    return await rss_service.list_feeds()
```

**3. Add dependency in `api/dependencies.py`:**

```python
from fastapi import Request

def get_rss_service(request: Request):
    """Dependency to get RSS service from app state."""
    return request.app.state.rss_service
```

**4. Add database methods to `RSSIngestionService`:**

```python
# In api/services/rss/rss_ingestion_service.py

async def create_ingestion_job(self, feed_url: str) -> str:
    """Create a new ingestion job and return job_id."""
    async with self.db_manager.pool.acquire() as conn:
        job_id = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO ingestion_jobs (job_id, feed_url, status, started_at)
            VALUES ($1, $2, 'queued', NOW())
        """, job_id, feed_url)
        return job_id

async def get_job_status(self, job_id: str) -> dict | None:
    """Get job status by ID."""
    async with self.db_manager.pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT job_id, status, articles_processed, completed_at
            FROM ingestion_jobs WHERE job_id = $1
        """, job_id)
        return dict(row) if row else None

async def list_feeds(self) -> List[dict]:
    """List all configured feeds from database."""
    async with self.db_manager.pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT DISTINCT feed_url, category, last_ingested_at
            FROM rss_articles
            ORDER BY last_ingested_at DESC NULLS LAST
        """)
        return [dict(row) for row in rows]
```

---

#### Option 2: Background Cron Job

**1. Create scheduled task in `api/tasks/rss_scheduler.py`:**

```python
import asyncio
from datetime import datetime, timedelta
from api.services.rss.rss_ingestion_service import RSSIngestionService

class RSSScheduler:
    def __init__(self, rss_service: RSSIngestionService, interval_minutes: int = 30):
        self.rss_service = rss_service
        self.interval = timedelta(minutes=interval_minutes)
        self.task = None

    async def start(self):
        """Start the background scheduler."""
        self.task = asyncio.create_task(self._run_loop())

    async def stop(self):
        """Stop the scheduler."""
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

    async def _run_loop(self):
        """Main scheduler loop."""
        while True:
            try:
                await self._ingest_all_feeds()
                await asyncio.sleep(self.interval.total_seconds())
            except asyncio.CancelledError:
                break
            except Exception as e:
                # Log error but keep running
                print(f"RSS scheduler error: {e}")
                await asyncio.sleep(60)  # Wait 1 min on error

    async def _ingest_all_feeds(self):
        """Ingest all configured feeds."""
        feeds = await self._get_configured_feeds()
        for feed in feeds:
            try:
                await self.rss_service.ingest_rss_feed(feed)
            except Exception as e:
                print(f"Failed to ingest {feed['url']}: {e}")

    async def _get_configured_feeds(self) -> List[dict]:
        """Get feed URLs from config or database."""
        # Option A: From environment variable
        import os
        feed_urls = os.getenv("RSS_FEED_URLS", "").split(",")
        return [{"url": url.strip()} for url in feed_urls if url.strip()]

        # Option B: From database table
        # async with self.rss_service.db_manager.pool.acquire() as conn:
        #     rows = await conn.fetch("SELECT url, category FROM rss_feed_config WHERE enabled = true")
        #     return [dict(row) for row in rows]
```

**2. Wire up in `api/main.py`:**

```python
from api.tasks.rss_scheduler import RSSScheduler

@app.on_event("startup")
async def startup():
    # ... create rss_service ...
    app.state.rss_scheduler = RSSScheduler(
        rss_service=app.state.rss_service,
        interval_minutes=30  # Ingest every 30 minutes
    )
    await app.state.rss_scheduler.start()

@app.on_event("shutdown")
async def shutdown():
    await app.state.rss_scheduler.stop()
```

**3. Configure feeds via environment variable:**

```bash
# .env
RSS_FEED_URLS="https://example.com/feed1.xml,https://example.com/feed2.xml"
```

---

#### Option 3: Hybrid (Recommended for Production)

Combine both approaches:
- **Background cron** for regular ingestion
- **REST API** for manual triggers and status checks

```python
# api/main.py
@app.on_event("startup")
async def startup():
    # Create services
    app.state.rss_service = RSSIngestionService(...)

    # Start background scheduler
    app.state.rss_scheduler = RSSScheduler(app.state.rss_service)
    await app.state.rss_scheduler.start()

    # Also expose API routes for manual control
    app.include_router(rss_routes.router, prefix="/api/rss", tags=["rss"])
```

---

### Testing Checklist

```bash
# 1. Test service instantiation
curl http://localhost:8000/api/rss/feeds

# 2. Trigger manual ingestion
curl -X POST http://localhost:8000/api/rss/ingest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hnrss.org/newest", "category": "tech"}'

# 3. Check job status
curl http://localhost:8000/api/rss/jobs/{job_id}

# 4. Verify database records
psql -d forecastin -c "SELECT * FROM rss_articles ORDER BY created_at DESC LIMIT 5;"

# 5. Check WebSocket broadcast
# Open browser console and connect to ws://localhost:8000/ws
# Should receive messages of type "entity_created" when articles are ingested
```

---

## #6: Auto-Refresh Materialized Views

### Current State
- ✅ Views exist: `mv_entity_ancestors`, `mv_descendant_counts`
- ✅ Manual refresh method: `database_manager.refresh_hierarchy_views()`
- ❌ Not called automatically on writes
- ❌ No performance benchmarks

### Decision Required

Choose refresh strategy based on your write patterns:

| Strategy | When to Use | Latency | Consistency | Complexity |
|----------|------------|---------|-------------|------------|
| **On Write** | Low write volume (<100/min) | High (blocks write) | Strong | Low |
| **Async After Write** | Medium volume (<1000/min) | Low (background) | Eventual | Medium |
| **Scheduled** | High volume or batch writes | None | Eventual | Low |
| **Hybrid** | Variable workload | Mixed | Tunable | High |

### Implementation Steps

#### Option 1: Refresh on Write (Immediate Consistency)

**Use when:** Hierarchy changes are rare, queries must be real-time.

```python
# In api/services/database_manager.py

async def insert_entity(self, entity_data: dict) -> str:
    """Insert entity and refresh hierarchy views."""
    async with self.pool.acquire() as conn:
        async with conn.transaction():
            # Insert entity
            entity_id = await conn.fetchval("""
                INSERT INTO entities (name, type, parent_id, properties)
                VALUES ($1, $2, $3, $4)
                RETURNING entity_id
            """, entity_data['name'], entity_data['type'],
                entity_data.get('parent_id'), entity_data.get('properties'))

            # Refresh views synchronously (blocks until complete)
            await self.refresh_hierarchy_views()

            return entity_id

async def update_entity_parent(self, entity_id: str, new_parent_id: str) -> None:
    """Update entity parent and refresh hierarchy."""
    async with self.pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("""
                UPDATE entities SET parent_id = $1 WHERE entity_id = $2
            """, new_parent_id, entity_id)

            # Refresh immediately
            await self.refresh_hierarchy_views()
```

**Performance Impact:**
```sql
-- Benchmark refresh time (run in psql)
EXPLAIN ANALYZE REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;
-- Expected: 50-500ms for <10k entities, 1-5s for <100k entities
```

---

#### Option 2: Async Background Refresh (Low Latency)

**Use when:** Can tolerate 1-5 second staleness, high write throughput.

```python
# In api/services/database_manager.py

from asyncio import Queue, create_task
from datetime import datetime, timedelta

class DatabaseManager:
    def __init__(self):
        self.refresh_queue = Queue()
        self.last_refresh = datetime.min
        self.refresh_cooldown = timedelta(seconds=5)  # Min 5 sec between refreshes
        self.refresh_task = None

    async def start_refresh_worker(self):
        """Start background worker for view refreshes."""
        self.refresh_task = create_task(self._refresh_worker())

    async def stop_refresh_worker(self):
        """Stop background worker."""
        if self.refresh_task:
            self.refresh_task.cancel()
            await self.refresh_task

    async def _refresh_worker(self):
        """Background worker that batches refresh requests."""
        while True:
            try:
                # Wait for refresh signal
                await self.refresh_queue.get()

                # Debounce: skip if recently refreshed
                now = datetime.now()
                if now - self.last_refresh < self.refresh_cooldown:
                    continue

                # Refresh views
                await self.refresh_hierarchy_views()
                self.last_refresh = now

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Refresh worker error: {e}")

    async def schedule_view_refresh(self):
        """Queue a view refresh (non-blocking)."""
        await self.refresh_queue.put(True)

    async def insert_entity(self, entity_data: dict) -> str:
        """Insert entity and schedule async refresh."""
        async with self.pool.acquire() as conn:
            entity_id = await conn.fetchval("""
                INSERT INTO entities (name, type, parent_id, properties)
                VALUES ($1, $2, $3, $4)
                RETURNING entity_id
            """, entity_data['name'], entity_data['type'],
                entity_data.get('parent_id'), entity_data.get('properties'))

            # Schedule refresh in background (non-blocking)
            await self.schedule_view_refresh()

            return entity_id
```

**Wire up in `main.py`:**

```python
@app.on_event("startup")
async def startup():
    app.state.db_manager = DatabaseManager()
    await app.state.db_manager.start_refresh_worker()

@app.on_event("shutdown")
async def shutdown():
    await app.state.db_manager.stop_refresh_worker()
```

---

#### Option 3: Scheduled Refresh (Best for Batch Writes)

**Use when:** Writes come in bursts, queries can tolerate 1-5 minute staleness.

```python
# In api/tasks/view_refresh_scheduler.py

import asyncio
from datetime import timedelta

class ViewRefreshScheduler:
    def __init__(self, db_manager, interval_seconds: int = 60):
        self.db_manager = db_manager
        self.interval = timedelta(seconds=interval_seconds)
        self.task = None

    async def start(self):
        self.task = asyncio.create_task(self._run_loop())

    async def stop(self):
        if self.task:
            self.task.cancel()
            await self.task

    async def _run_loop(self):
        while True:
            try:
                await asyncio.sleep(self.interval.total_seconds())
                await self.db_manager.refresh_hierarchy_views()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"View refresh error: {e}")
```

**Enable in `main.py`:**

```python
from api.tasks.view_refresh_scheduler import ViewRefreshScheduler

@app.on_event("startup")
async def startup():
    app.state.view_scheduler = ViewRefreshScheduler(
        db_manager=app.state.db_manager,
        interval_seconds=60  # Refresh every 60 seconds
    )
    await app.state.view_scheduler.start()
```

---

### Performance Testing

```python
# tests/performance/test_view_refresh.py

import pytest
import time
from api.services.database_manager import DatabaseManager

@pytest.mark.asyncio
async def test_refresh_performance(db_manager: DatabaseManager):
    """Measure materialized view refresh time."""

    # Insert test entities
    start = time.time()
    for i in range(1000):
        await db_manager.insert_entity({
            "name": f"test_entity_{i}",
            "type": "test",
            "parent_id": None
        })
    insert_time = time.time() - start

    # Measure refresh time
    start = time.time()
    await db_manager.refresh_hierarchy_views()
    refresh_time = time.time() - start

    print(f"Insert 1000 entities: {insert_time:.2f}s")
    print(f"Refresh views: {refresh_time:.2f}s")

    # Assert acceptable performance
    assert refresh_time < 5.0, "View refresh took longer than 5 seconds"
```

**Run benchmark:**

```bash
# Run performance test
pytest tests/performance/test_view_refresh.py -v

# Profile in production
# Add to api/services/database_manager.py:
import time

async def refresh_hierarchy_views(self) -> None:
    start = time.time()
    # ... existing refresh code ...
    duration = time.time() - start
    if duration > 2.0:
        print(f"SLOW VIEW REFRESH: {duration:.2f}s")
```

---

### Monitoring & Alerting

```python
# Add metrics to database_manager.py

from prometheus_client import Histogram

view_refresh_duration = Histogram(
    'view_refresh_duration_seconds',
    'Time spent refreshing materialized views'
)

async def refresh_hierarchy_views(self) -> None:
    with view_refresh_duration.time():
        async with self.pool.acquire() as conn:
            # Refresh with timing
            await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors")
            await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_descendant_counts")
```

---

## #10: RSSHub Anti-Crawler Integration

### Current State
- ✅ Retry logic exists in `rss_ingestion_service.py`
- ✅ Exponential backoff implemented
- ❌ Cannot test without live RSSHub instance
- ❌ Anti-crawler patterns not validated

### Testing Requirements

This fix **requires a live environment**—you cannot fully test anti-crawler logic with static code analysis.

### Setup Live RSSHub Instance

**Option 1: Docker (Fastest)**

```bash
# 1. Clone RSSHub
git clone https://github.com/DIYgod/RSSHub.git
cd RSSHub

# 2. Start with Docker Compose
docker-compose up -d

# 3. Verify running
curl http://localhost:1200/github/trending/daily
# Should return RSS feed XML

# 4. Configure Forecastin to use local RSSHub
export RSSHUB_BASE_URL="http://localhost:1200"
```

**Option 2: Cloud Deploy (Production)**

```bash
# Deploy to Railway, Vercel, or Cloudflare Workers
# See: https://docs.rsshub.app/en/install/

# Example: Railway
railway up

# Get deployed URL
railway domain
# Output: https://rsshub-xxx.up.railway.app
```

---

### Test Anti-Crawler Patterns

**1. Create test script `tests/integration/test_rsshub_crawler.py`:**

```python
import pytest
import httpx
from api.services.rss.rss_ingestion_service import RSSIngestionService

@pytest.mark.integration
@pytest.mark.asyncio
async def test_rsshub_rate_limit_handling(rss_service: RSSIngestionService):
    """Test retry logic when RSSHub returns 429 Too Many Requests."""

    # Rapid-fire requests to trigger rate limit
    feed_url = "http://localhost:1200/github/trending/daily"

    results = []
    for i in range(20):  # Send 20 requests rapidly
        try:
            result = await rss_service.ingest_rss_feed({"url": feed_url})
            results.append(result)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                print(f"Request {i}: Rate limited (expected)")
                results.append("rate_limited")
            else:
                raise

    # Verify retry logic kicked in
    assert "rate_limited" in results, "Never hit rate limit"
    assert any(r != "rate_limited" for r in results), "All requests failed"

@pytest.mark.integration
@pytest.mark.asyncio
async def test_rsshub_cloudflare_challenge(rss_service: RSSIngestionService):
    """Test handling of Cloudflare anti-bot challenges."""

    # Some RSSHub instances use Cloudflare protection
    feed_url = "http://localhost:1200/github/trending/daily"

    # Configure service with User-Agent rotation
    rss_service.http_client.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; ForecastinBot/1.0)"
    })

    result = await rss_service.ingest_rss_feed({"url": feed_url})

    assert result is not None, "Failed to bypass Cloudflare"
    assert result.get("articles_processed", 0) > 0

@pytest.mark.integration
@pytest.mark.asyncio
async def test_exponential_backoff_on_errors(rss_service: RSSIngestionService):
    """Verify exponential backoff timing on repeated failures."""

    import time

    # Mock feed that always fails
    invalid_feed = "http://localhost:1200/invalid-route"

    start = time.time()
    try:
        await rss_service.ingest_rss_feed({"url": invalid_feed})
    except Exception:
        pass

    duration = time.time() - start

    # With exponential backoff (1s, 2s, 4s), should take ~7s total
    assert 6 < duration < 10, f"Backoff timing incorrect: {duration}s"
```

**2. Run integration tests:**

```bash
# Start local RSSHub
docker-compose -f tests/fixtures/docker-compose.rsshub.yml up -d

# Run tests with integration mark
pytest tests/integration/test_rsshub_crawler.py -v -m integration

# Check retry behavior
pytest tests/integration/test_rsshub_crawler.py::test_exponential_backoff_on_errors -v -s
```

---

### Validate Anti-Crawler Patterns in Production

**Common patterns to handle:**

| Pattern | Detection | Solution |
|---------|-----------|----------|
| **Rate Limiting** | HTTP 429 | Exponential backoff + queue |
| **Cloudflare Challenge** | HTTP 403 + `cf-ray` header | Rotate User-Agents, use `cloudscraper` |
| **IP Blocking** | HTTP 403 + timeout | Proxy rotation, residential IPs |
| **CAPTCHA** | HTML with `recaptcha` | Human-in-loop, CAPTCHA solver API |

**Implement in `api/services/rss/rss_ingestion_service.py`:**

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

class RSSIngestionService:
    def __init__(self):
        # Use cloudscraper for Cloudflare bypass
        self.http_client = httpx.AsyncClient(
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            timeout=30.0,
            follow_redirects=True
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    async def _fetch_feed(self, url: str) -> str:
        """Fetch RSS feed with retry and anti-crawler handling."""
        try:
            response = await self.http_client.get(url)

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", "60"))
                print(f"Rate limited, waiting {retry_after}s")
                await asyncio.sleep(retry_after)
                raise httpx.HTTPStatusError(f"Rate limited", request=None, response=response)

            # Handle Cloudflare challenge
            if response.status_code == 403 and "cf-ray" in response.headers:
                print("Cloudflare challenge detected, rotating User-Agent")
                self._rotate_user_agent()
                raise httpx.HTTPStatusError(f"Cloudflare block", request=None, response=response)

            response.raise_for_status()
            return response.text

        except httpx.TimeoutException:
            print(f"Timeout fetching {url}, retrying...")
            raise

    def _rotate_user_agent(self):
        """Rotate User-Agent to avoid detection."""
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        ]
        import random
        self.http_client.headers["User-Agent"] = random.choice(user_agents)
```

---

### Production Monitoring

**Add logging to track crawler patterns:**

```python
import structlog

logger = structlog.get_logger()

async def _fetch_feed(self, url: str) -> str:
    try:
        response = await self.http_client.get(url)

        # Log crawler detection
        logger.info(
            "rss_fetch",
            url=url,
            status=response.status_code,
            cf_ray=response.headers.get("cf-ray"),
            rate_limit_remaining=response.headers.get("X-RateLimit-Remaining")
        )

        # Detect patterns
        if "cf-ray" in response.headers:
            logger.warning("cloudflare_detected", url=url)

        if int(response.headers.get("X-RateLimit-Remaining", "999")) < 10:
            logger.warning("rate_limit_low", url=url, remaining=response.headers["X-RateLimit-Remaining"])

        return response.text
    except Exception as e:
        logger.error("rss_fetch_failed", url=url, error=str(e))
        raise
```

---

### Cannot Test Without Stack

**Why code-only is insufficient:**

1. **Network behavior is non-deterministic** – mocking won't catch real anti-crawler patterns
2. **Cloudflare/rate-limits change dynamically** – static tests won't reflect production
3. **Timing-based backoff requires real delays** – can't fast-forward time in unit tests
4. **User-Agent rotation effectiveness varies** – need real responses to validate

**Minimum viable test environment:**

```yaml
# docker-compose.test.yml
services:
  rsshub:
    image: diygod/rsshub
    ports:
      - "1200:1200"
    environment:
      - CACHE_TYPE=memory

  nginx-ratelimit:  # Simulate rate limiting
    image: nginx
    volumes:
      - ./tests/fixtures/nginx-ratelimit.conf:/etc/nginx/nginx.conf
    ports:
      - "1201:80"
```

**Run full integration tests:**

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
pytest tests/integration/ -v --integration

# Tear down
docker-compose -f docker-compose.test.yml down
```

---

## Summary Decision Matrix

| Fix | Can Mock? | Requires Live Stack? | Minimum Test Env |
|-----|-----------|---------------------|------------------|
| **#5 RSS API** | ❌ No | ✅ Yes | Local FastAPI + RSSHub |
| **#6 View Refresh** | ❌ No | ✅ Yes | PostgreSQL with data |
| **#10 Anti-Crawler** | ❌ No | ✅ Yes | RSSHub + rate limiter |

**All three fixes require:**
1. Running backend (FastAPI + uvicorn)
2. Database with schema applied
3. External service (RSSHub for #10)
4. Real data or traffic to validate performance

**Recommendation:** Set up a staging environment with Docker Compose that includes all dependencies. Run tests there before deploying to production.
