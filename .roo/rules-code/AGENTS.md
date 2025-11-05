# AGENTS.md - Code Mode Non-Obvious Patterns

**⚠️ CRITICAL: This document contains ONLY non-obvious coding patterns, gotchas, and counterintuitive requirements for developers working on the forecastin project.**

## Database Coding Gotchas

### LTREE Materialized View Maintenance
- **Non-obvious:** Materialized views require **manual refresh** - not automatic like regular views
- **Gotcha:** Always call [`refresh_hierarchy_views()`](api/navigation_api/database/optimized_hierarchy_resolver.py:53) after hierarchy modifications
- **Critical:** Materialized views can become stale - implement trigger-based refresh or scheduled jobs

### Thread-Safe LRU Cache Implementation
- **Non-obvious:** L1 cache uses **RLock** instead of standard Lock for thread safety
- **Gotcha:** Standard threading.Lock can cause deadlocks in complex query scenarios
- **Pattern:** Use `threading.RLock()` for re-entrant locking in cache operations

### Connection Pool Health Monitoring
- **Non-obvious:** Background thread monitors pool every 30 seconds with 80% utilization warning
- **Gotcha:** Connection pool exhaustion can cascade - implement exponential backoff retry mechanism
- **Critical:** TCP keepalives required to prevent firewall drops: `keepalives_idle: 30`, `keepalives_interval: 10`

## WebSocket Serialization Patterns

### orjson vs Standard json
- **Non-obvious:** WebSocket serialization **requires orjson** - standard json.dumps crashes on datetime/dataclass objects
- **Gotcha:** Always use [`safe_serialize_message()`](api/realtime_service.py:140) function for WebSocket payloads
- **Critical:** Wrap serialization in try/except to prevent WebSocket connection crashes

### Message Batching Strategy
- **Non-obvious:** Implement server-side debounce to batch multiple small updates into single messages
- **Gotcha:** High-frequency updates can overwhelm clients - use optimized payloads (MessagePack) for frequent data
- **Pattern:** Send diffs instead of full state: `{"action": "increment", "count": 3}`

## Entity Extraction Coding Patterns

### 5-W Framework Implementation
- **Non-obvious:** Confidence scores are **calibrated by rules**, not just base model confidence
- **Gotcha:** PersonEntity with title+organization gets higher score than name alone
- **Pattern:** Use similarity threshold (0.8) for deduplication with `canonical_key` assignment

### ML Model A/B Testing Registry
- **Non-obvious:** A/B testing requires **persistent Test Registry** (Redis/DB) - in-memory tracking fails
- **Gotcha:** Test state must survive server restarts - implement Redis-based test tracking
- **Critical:** 7 configurable risk conditions trigger automatic rollback to baseline model

## Frontend State Management

### Hybrid State Coordination
- **Non-obvious:** Three distinct state management systems must coordinate:
  - **React Query:** Server state (API data)
  - **Zustand:** Global UI state (theme, navigation)
  - **WebSocket:** Real-time state fed into React Query
- **Gotcha:** WebSocket updates must trigger React Query invalidations
- **Pattern:** Use `useWebSocket.ts` hook to manage live data integration

### Miller's Columns Implementation
- **Non-obvious:** Responsive design collapses to single-column view on mobile with "Back" navigation
- **Gotcha:** Global search must jump to entity within hierarchical context (populate breadcrumbs)
- **Pattern:** Implement lazy loading - only load top-level nodes initially

## Performance Optimization Patterns

### Multi-Tier Cache Coordination
- **Non-obvious:** Four-tier caching strategy requires coordination:
  - L1: Memory LRU (10,000 entries)
  - L2: Redis (shared across instances)
  - L3: PostgreSQL buffer cache
  - L4: Materialized views (pre-computation)
- **Gotcha:** Cache invalidation must propagate across all tiers
- **Pattern:** Implement cache performance monitoring with automatic optimization recommendations

### Database Query Optimization
- **Non-obvious:** Use composite indexes: `idx_entity_hierarchy_depth_path` on (`path_depth`, `path`)
- **Gotcha:** GiST indexes required for LTREE operators (`<@`, `@>`, `~`)
- **Pattern:** Pre-computed `path_depth` enables O(1) depth lookups

## Error Handling Patterns

### WebSocket Resilience
- **Non-obvious:** WebSocket handlers must handle serialization errors gracefully
- **Gotcha:** Send structured `serialization_error` messages instead of crashing connections
- **Pattern:** Implement automatic reconnection with state recovery

### Database Connection Resilience
- **Non-obvious:** Implement exponential backoff retry mechanism for transient failures
- **Gotcha:** 3 total attempts with increasing delays (0.5s, 1s, 2s)
- **Pattern:** Use `pool_pre_ping = True` to test connection health before use

## Testing Patterns

### Performance Testing Requirements
- **Non-obvious:** Validated performance metrics must be maintained:
  - Ancestor resolution: 1.25ms (P95: 1.87ms)
  - Throughput: 42,726 RPS
  - Cache hit rate: 99.2%
- **Gotcha:** Load testing must validate against these SLOs
- **Pattern:** Use tools like locust, k6, or JMeter for performance validation

### Compliance Automation
- **Non-obvious:** Automated evidence collection scripts run via pre-commit hooks
- **Gotcha:** Documentation consistency checking via embedded JSON blocks in markdown
- **Pattern:** Store evidence in `deliverables/compliance/evidence/`

---

**Remember:** These patterns address specific challenges in the geopolitical intelligence domain that would surprise experienced developers working on standard web applications.