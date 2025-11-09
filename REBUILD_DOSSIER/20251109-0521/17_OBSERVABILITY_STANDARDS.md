# 17 Observability Standards

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Logging, monitoring, and observability standards
**Evidence:** F-0010, F-0011 (missing structured logging, no error monitoring)

---

## Executive Summary

**Current Issues:**
- **F-0010**: No correlation IDs for request tracing
- **F-0011**: No structured logging (plain text logs)
- **F-0011**: No error monitoring integration (Sentry)

**Target State:**
- Structured JSON logging in production
- Correlation IDs for distributed tracing
- Sentry integration for error monitoring
- Prometheus metrics for performance monitoring
- Grafana dashboards for visualization

**Timeline:** Phase 4 (T-0401, T-0402) - 10 hours

---

## Logging Standards

### 1. Structured Logging

**Problem (F-0011):** Plain text logs are difficult to parse and query

**Current (Unstructured):**
```python
# api/main.py
import logging

logger = logging.getLogger(__name__)

logger.info("User created entity")  # No context!
```

**Target (Structured JSON):**
```python
# api/services/observability/logging.py

import logging
import json
import sys
from datetime import datetime
from typing import Any, Dict

class JSONFormatter(logging.Formatter):
    """Format logs as JSON for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }

        # Add correlation_id if present
        if hasattr(record, 'correlation_id'):
            log_data['correlation_id'] = record.correlation_id

        # Add user_id if present
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id

        # Add extra fields
        if hasattr(record, 'extra'):
            log_data.update(record.extra)

        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def setup_logging(environment: str = "development"):
    """Configure structured logging."""

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)

    # Use JSON formatter in production
    if environment == "production":
        handler.setFormatter(JSONFormatter())
    else:
        # Human-readable format in development
        handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))

    root_logger.addHandler(handler)


# Usage
from api.services.observability.logging import setup_logging

setup_logging(environment=os.getenv("ENVIRONMENT", "development"))

logger = logging.getLogger(__name__)
logger.info("User created entity", extra={
    "user_id": "123",
    "entity_id": "456",
    "entity_type": "city"
})
```

**Output (Production):**
```json
{
  "timestamp": "2025-11-09T05:21:00.123Z",
  "level": "INFO",
  "logger": "api.services.entity_service",
  "message": "User created entity",
  "module": "entity_service",
  "function": "create",
  "line": 42,
  "correlation_id": "req_abc123",
  "user_id": "123",
  "entity_id": "456",
  "entity_type": "city"
}
```

**Benefits:**
- Easy to parse and query in log aggregation tools
- Correlation IDs link related logs
- Structured fields enable filtering
- Machine-readable for automated analysis

---

### 2. Correlation IDs (F-0010)

**Purpose:** Trace requests across distributed systems

**Implementation:**

**File:** `api/middleware/correlation_id.py`

```python
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import contextvars

# Context variable to store correlation ID
correlation_id_var = contextvars.ContextVar('correlation_id', default=None)


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Add correlation ID to requests and responses."""

    async def dispatch(self, request: Request, call_next):
        # Get correlation ID from header or generate new one
        correlation_id = request.headers.get('X-Correlation-ID') or f"req_{uuid.uuid4().hex[:12]}"

        # Store in context
        correlation_id_var.set(correlation_id)

        # Add to response headers
        response = await call_next(request)
        response.headers['X-Correlation-ID'] = correlation_id

        return response


# Usage in logging
class CorrelationIDFilter(logging.Filter):
    """Add correlation ID to log records."""

    def filter(self, record):
        correlation_id = correlation_id_var.get()
        record.correlation_id = correlation_id or "none"
        return True


# Add filter to all handlers
handler.addFilter(CorrelationIDFilter())
```

**Usage:**
```python
logger.info("Processing entity creation")
# Output includes: "correlation_id": "req_abc123"

# All logs for this request will have same correlation ID
logger.info("Validating entity data")
logger.info("Saving to database")
logger.info("Entity created successfully")
```

**Query logs by correlation ID:**
```bash
# CloudWatch Logs Insights
fields @timestamp, level, message
| filter correlation_id = "req_abc123"
| sort @timestamp asc
```

---

### 3. Log Levels

**Usage Guidelines:**

| Level | When to Use | Example |
|-------|-------------|---------|
| `DEBUG` | Development debugging only | `logger.debug("Cache key: %s", cache_key)` |
| `INFO` | Normal operations | `logger.info("Entity created", extra={"entity_id": id})` |
| `WARNING` | Recoverable issues | `logger.warning("Cache miss, fetching from DB")` |
| `ERROR` | Errors that don't crash the app | `logger.error("Failed to send email", exc_info=True)` |
| `CRITICAL` | System-wide failures | `logger.critical("Database connection lost")` |

**Configuration:**

```python
# api/config/logging.py

LOG_LEVELS = {
    "development": logging.DEBUG,
    "staging": logging.INFO,
    "production": logging.INFO
}

logging.basicConfig(level=LOG_LEVELS[environment])

# Set third-party libraries to WARNING
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
```

---

### 4. Sensitive Data Redaction

**Never log:**
- Passwords
- API keys
- Database credentials
- Credit card numbers
- Personal identifiable information (PII)

**Redaction Filter:**

```python
import re

class SensitiveDataFilter(logging.Filter):
    """Redact sensitive data from logs."""

    PATTERNS = [
        (re.compile(r'password["\']?\s*[:=]\s*["\']?([^"\'\s]+)', re.I), 'password=***REDACTED***'),
        (re.compile(r'api[_-]?key["\']?\s*[:=]\s*["\']?([^"\'\s]+)', re.I), 'api_key=***REDACTED***'),
        (re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'), '****-****-****-****'),  # Credit cards
    ]

    def filter(self, record):
        message = record.getMessage()

        for pattern, replacement in self.PATTERNS:
            message = pattern.sub(replacement, message)

        record.msg = message
        return True


handler.addFilter(SensitiveDataFilter())
```

---

## Error Monitoring

### 1. Sentry Integration (T-0402)

**File:** `api/main.py`

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("ENVIRONMENT", "development"),
    traces_sample_rate=0.1,  # 10% of requests traced
    integrations=[
        FastApiIntegration(),
        SqlalchemyIntegration()
    ],
    before_send=before_send_sentry_event,  # Custom filtering
    release=os.getenv("GIT_COMMIT_SHA")  # Track which version
)


def before_send_sentry_event(event, hint):
    """Filter Sentry events before sending."""

    # Don't send 404 errors
    if event.get('exception'):
        exc_type = event['exception']['values'][0]['type']
        if exc_type == 'HTTPException' and event.get('status_code') == 404:
            return None

    # Add custom context
    event.setdefault('tags', {})
    event['tags']['correlation_id'] = correlation_id_var.get()

    return event


# Usage - automatic error capture
@router.get("/entities/{id}")
async def get_entity(id: str):
    entity = await entity_service.get(id)

    if not entity:
        # This 404 won't be sent to Sentry (filtered above)
        raise HTTPException(404, detail="Entity not found")

    # Any unhandled exception here will be sent to Sentry
    return entity
```

**Frontend Integration:**

**File:** `frontend/src/utils/sentry.ts`

```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 0.1,
  beforeSend(event, hint) {
    // Don't send network errors (likely user's internet)
    if (event.exception?.values?.[0]?.type === 'NetworkError') {
      return null;
    }

    return event;
  }
});

// Usage
export function reportError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context
  });
}
```

---

### 2. Error Context

**Enrich errors with context:**

```python
# api/services/entity_service.py

try:
    entity = await db.fetch_one(query)
except Exception as e:
    # Add context to error
    sentry_sdk.set_context("entity_query", {
        "entity_id": entity_id,
        "query": str(query),
        "user_id": current_user.id
    })

    sentry_sdk.capture_exception(e)

    logger.error(
        "Failed to fetch entity",
        exc_info=True,
        extra={
            "entity_id": entity_id,
            "user_id": current_user.id
        }
    )

    raise
```

---

## Metrics and Monitoring

### 1. Prometheus Metrics

**File:** `api/middleware/metrics.py`

```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from prometheus_client import CONTENT_TYPE_LATEST

# Counters
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

entity_operations_total = Counter(
    'entity_operations_total',
    'Total entity operations',
    ['operation', 'entity_type']
)

# Histograms
http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

database_query_duration_seconds = Histogram(
    'database_query_duration_seconds',
    'Database query latency',
    ['query_type']
)

# Gauges
active_websocket_connections = Gauge(
    'active_websocket_connections',
    'Number of active WebSocket connections'
)

cache_hit_rate = Gauge(
    'cache_hit_rate',
    'Cache hit rate percentage'
)


# Expose metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


# Usage
@app.middleware("http")
async def track_request_metrics(request: Request, call_next):
    start = time.time()

    response = await call_next(request)

    duration = time.time() - start

    http_requests_total.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()

    http_request_duration_seconds.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)

    return response
```

---

### 2. Custom Metrics

```python
# Track business metrics
entity_operations_total.labels(
    operation='create',
    entity_type='city'
).inc()

# Track cache performance
with database_query_duration_seconds.labels(query_type='hierarchy').time():
    entities = await db.execute(hierarchy_query)

# Update gauge
active_websocket_connections.set(len(websocket_manager.connections))
```

---

### 3. Grafana Dashboards

**Dashboard JSON:**

```json
{
  "dashboard": {
    "title": "Forecastin API Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[1m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "P95 Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds)",
            "legendFormat": "{{endpoint}}"
          }
        ],
        "type": "graph",
        "alert": {
          "conditions": [
            {
              "evaluator": {
                "params": [0.15],
                "type": "gt"
              },
              "query": {
                "params": ["A", "5m", "now"]
              },
              "reducer": {
                "type": "avg"
              },
              "type": "query"
            }
          ],
          "message": "P95 latency exceeds 150ms budget",
          "name": "High P95 Latency"
        }
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "cache_hit_rate",
            "legendFormat": "Hit Rate"
          }
        ],
        "type": "gauge",
        "thresholds": [
          { "value": 99, "color": "green" },
          { "value": 95, "color": "yellow" },
          { "value": 0, "color": "red" }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[1m])",
            "legendFormat": "5xx errors"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

## Distributed Tracing

### OpenTelemetry Integration

**File:** `api/middleware/tracing.py`

```python
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Set up tracer
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

# Export to Jaeger/Tempo
otlp_exporter = OTLPSpanExporter(endpoint="http://localhost:4317")
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Auto-instrument FastAPI
FastAPIInstrumentor.instrument_app(app)


# Manual tracing
@router.get("/entities/{id}")
async def get_entity(id: str):
    with tracer.start_as_current_span("get_entity") as span:
        span.set_attribute("entity.id", id)

        # Nested span
        with tracer.start_as_current_span("check_cache"):
            cached = await cache.get(f"entity:{id}")

        if not cached:
            with tracer.start_as_current_span("fetch_from_db"):
                entity = await db.fetch_one(query)

        return entity
```

---

## Alerting

### Alert Rules

**File:** `prometheus/alerts.yml`

```yaml
groups:
  - name: api_alerts
    interval: 1m
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High 5xx error rate: {{ $value }}"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: HighP95Latency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.15
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency exceeds budget"

      - alert: LowCacheHitRate
        expr: cache_hit_rate < 0.99
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit rate below 99%"

      - alert: DatabaseConnectionPoolExhausted
        expr: db_connection_pool_available == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool exhausted"

  - name: websocket_alerts
    interval: 1m
    rules:
      - alert: HighWebSocketDropRate
        expr: rate(websocket_connections_dropped[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High WebSocket connection drop rate"
```

---

## Health Checks

**Endpoint Implementation:**

```python
# api/routers/health.py

from fastapi import APIRouter, Response
from api.services.database import DatabaseManager
from api.services.cache import CacheService
from api.services.websocket_manager import WebSocketManager

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check - return 200 if alive."""
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness_check():
    """Readiness check - return 200 if ready to accept traffic."""

    checks = {
        "database": await check_database(),
        "redis": await check_redis(),
        "websocket": check_websocket()
    }

    all_healthy = all(checks.values())

    if not all_healthy:
        return Response(
            content=json.dumps({"status": "degraded", "checks": checks}),
            status_code=503
        )

    return {"status": "ready", "checks": checks}


async def check_database() -> bool:
    """Check database connectivity."""
    try:
        await db.execute("SELECT 1")
        return True
    except Exception as e:
        logger.error("Database health check failed", exc_info=True)
        return False


async def check_redis() -> bool:
    """Check Redis connectivity."""
    try:
        await redis.ping()
        return True
    except Exception as e:
        logger.error("Redis health check failed", exc_info=True)
        return False


def check_websocket() -> bool:
    """Check WebSocket service."""
    return websocket_manager.is_running
```

**Kubernetes Probes:**

```yaml
# k8s/deployment.yml

apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: api
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10

          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 5
```

---

## Observability Checklist

### Implementation (T-0401, T-0402)

**Phase 4:**
- [ ] T-0401: Implement structured logging (6 hours)
  - [ ] Create JSONFormatter
  - [ ] Add correlation ID middleware
  - [ ] Add sensitive data redaction
  - [ ] Configure log levels per environment

- [ ] T-0402: Integrate Sentry (4 hours)
  - [ ] Backend Sentry integration
  - [ ] Frontend Sentry integration
  - [ ] Configure error filtering
  - [ ] Test error capture

### Monitoring
- [ ] Set up Prometheus
- [ ] Create Grafana dashboards
- [ ] Configure alerts
- [ ] Enable distributed tracing (optional)

### Validation
- [ ] All logs output as JSON in production
- [ ] Correlation IDs in all log entries
- [ ] Errors sent to Sentry
- [ ] Metrics exposed at `/metrics`
- [ ] Health checks return correct status

---

**Observability Standards Complete**
**Addresses F-0010, F-0011**
**Full request tracing, error monitoring, performance metrics**
