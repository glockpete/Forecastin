# ADR-0004: Observability Standards

**Status:** Accepted
**Date:** 2025-11-09
**Deciders:** Engineering Team
**Evidence:** F-0010, F-0011

---

## Context

**Current Issues:**
- **F-0010:** No correlation IDs for request tracing
- **F-0011:** Plain text logging (not structured)
- **F-0011:** No error monitoring (Sentry/Rollbar)

**Impact:**
- Cannot trace requests across services
- Logs difficult to parse and query
- Production errors go unnoticed
- No alerting on failures

**PATH Evidence:**
- `/home/user/Forecastin/api/main.py:1-100` - No structured logging setup
- No Sentry integration anywhere

---

## Decision

We will implement a **three-pillar observability stack**:

### 1. Structured Logging (JSON)

**Production logs MUST be JSON:**

```json
{
  "timestamp": "2025-11-09T05:21:00.123Z",
  "level": "INFO",
  "logger": "api.services.entity_service",
  "message": "Entity created",
  "correlation_id": "req_abc123",
  "user_id": "user_456",
  "entity_id": "entity_789",
  "duration_ms": 42.3
}
```

**Implementation:**
- Custom `JSONFormatter` for logging
- Context variables for correlation IDs
- Sensitive data redaction filter
- Log levels: DEBUG (dev), INFO (prod)

### 2. Correlation IDs

**Every request gets a unique ID:**

```
Client Request
  ↓
  X-Correlation-ID: req_abc123
  ↓
FastAPI Middleware
  ↓
  Store in context variable
  ↓
All logs include correlation_id
  ↓
Response Header: X-Correlation-ID: req_abc123
```

**Benefits:**
- Trace request across logs
- Link frontend → backend → database logs
- Debug issues in production

### 3. Error Monitoring (Sentry)

**Backend:**
```python
import sentry_sdk

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("ENVIRONMENT"),
    traces_sample_rate=0.1
)
```

**Frontend:**
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT
});
```

**Automatic error capture:**
- All unhandled exceptions → Sentry
- Context attached (user, correlation ID, breadcrumbs)
- Alerts on error rate spike

---

## Consequences

**Positive:**
- Production debugging 10x easier
- Error detection automated
- Performance issues visible
- Compliance (audit logs)

**Negative:**
- Sentry costs ($10-50/month)
- Extra dependencies
- Log volume increases (storage cost)

**Migration:**
- T-0401: Structured logging (6 hours)
- T-0402: Sentry integration (4 hours)
- Total: 10 hours

---

## Standards

### Log Levels

| Level | When to Use |
|-------|-------------|
| DEBUG | Development only |
| INFO | Normal operations |
| WARNING | Recoverable issues |
| ERROR | Errors (non-fatal) |
| CRITICAL | System failures |

### Sensitive Data

**NEVER log:**
- Passwords
- API keys
- Credit cards
- Personal data (unless hashed)

**Redaction filter required.**

### Metrics

**Track via Prometheus:**
- Request rate (RPS)
- Latency (P50, P95, P99)
- Error rate
- Cache hit rate

---

## Alternatives Considered

### Alternative 1: ELK Stack (Elasticsearch, Logstash, Kibana)

**Pros:** Powerful search and visualization

**Cons:**
- Complex to set up and maintain
- High infrastructure cost
- Overkill for current scale

**Rejected because:** CloudWatch Logs Insights is simpler

### Alternative 2: DataDog/New Relic

**Pros:** All-in-one monitoring solution

**Cons:**
- Very expensive ($$$)
- Vendor lock-in

**Rejected because:** Sentry + Prometheus + CloudWatch is cheaper

---

## Related

- **Addresses:** F-0010, F-0011
- **Tasks:** T-0401, T-0402
- **Files:** `api/middleware/correlation_id.py`, `api/services/observability/logging.py`
