# AGENTS.md - Forecastin Project Non-Obvious Patterns

**⚠️ CRITICAL: This document contains ONLY non-obvious patterns, gotchas, and counterintuitive requirements discovered from roadmap analysis. Standard practices and framework defaults are excluded.**

## Database Architecture Gotchas

### LTREE Materialized Views for O(log n) Performance
- **Non-obvious:** Database uses LTREE extension with **materialized views** (`mv_entity_ancestors`, `mv_descendant_counts`) for O(log n) performance instead of traditional recursive queries
- **Gotcha:** Materialized views require manual refresh via [`refresh_hierarchy_views()`](api/navigation_api/database/optimized_hierarchy_resolver.py:53) function - not automatic
- **Counterintuitive:** Pre-computed `path_depth` and `path_hash` columns enable O(1) lookups but require trigger-based maintenance

### Multi-Tier Caching Strategy
- **L1 (Memory):** Thread-safe LRU cache with **RLock synchronization** - not standard threading.Lock
- **L2 (Redis):** Shared across instances but requires connection pooling with exponential backoff
- **L3 (Database):** PostgreSQL buffer cache + materialized views as persistent cache layer
- **L4 (Materialized Views):** Acts as database-level pre-computation cache

## WebSocket Serialization Gotchas

### orjson with Custom Safe Serialization
- **Non-obvious:** WebSocket serialization requires [`orjson`](api/realtime_service.py:113) with custom [`safe_serialize_message()`](api/realtime_service.py:140) function
- **Gotcha:** Standard `json.dumps` crashes on datetime/dataclass objects - requires recursive pre-serialization
- **Critical:** WebSocket handlers must wrap serialization in try/except to prevent connection crashes

## Entity Extraction Counterintuitive Patterns

### 5-W Framework with Confidence Scoring
- **Non-obvious:** Entity extraction uses 5-W framework (Who, What, Where, When, Why) with **multi-factor confidence scoring**
- **Gotcha:** Confidence scores are "calibrated" by rules, not just base model confidence
- **Deduplication:** Uses similarity threshold (0.8) with `canonical_key` assignment and `audit_trail` logging

### ML Model A/B Testing Framework
- **Non-obvious:** A/B testing framework for ML model variants with **automatic rollback** capabilities
- **Gotcha:** Requires persistent **Test Registry** (Redis/DB) - in-memory tracking fails on lookup
- **Risk Conditions:** 7 configurable conditions trigger automatic rollback to baseline model

## UI/UX Non-Obvious Patterns

### Miller's Columns for Hierarchical Navigation
- **Non-obvious:** Uses Miller's Columns UI pattern instead of traditional tree views
- **Mobile Adaptation:** Responsively collapses to single-column view with "Back" navigation
- **Context Preservation:** Global search must jump to entity within hierarchical context

### Hybrid State Management
- **React Query:** Server state (API data) with stale-while-revalidate
- **Zustand:** Global UI state (theme, navigation panels)
- **WebSocket:** Real-time state fed into React Query
- **Gotcha:** Three distinct state management systems must coordinate seamlessly

## Performance SLOs That Defy Expectations

### Validated Performance Metrics
- **Ancestor Resolution:** Target <10ms, **Actual: 1.25ms** (P95: 1.87ms)
- **Descendant Retrieval:** Target <50ms, **Actual: 1.25ms** (P99: 17.29ms)
- **Throughput:** Target >10,000 RPS, **Actual: 42,726 RPS**
- **Cache Hit Rate:** Target >90%, **Actual: 99.2%**

## Connection Management Gotchas

### TCP Keepalives for Firewall Prevention
- **Non-obvious:** Database connections use TCP keepalives to prevent firewall drops
- **Settings:** `keepalives_idle: 30`, `keepalives_interval: 10`, `keepalives_count: 5`
- **Health Monitoring:** Background thread monitors pool every 30 seconds with 80% utilization warning

## Compliance Framework Automation

### Automated Evidence Collection
- **Non-obvious:** Compliance framework includes automated evidence collection scripts
- **Scripts:** [`gather_metrics.py`](scripts/gather_metrics.py:626), [`check_consistency.py`](scripts/check_consistency.py:633), [`fix_roadmap.py`](scripts/fix_roadmap.py:643)
- **Gotcha:** Documentation consistency checking via embedded JSON blocks in markdown

## Multi-Agent System Integration Points

### Redis Pub/Sub for Agent Communication
- **Non-obvious:** Extends existing WebSocket infrastructure for real-time agent coordination
- **Integration Points:** Entity extraction, navigation API, caching, geospatial capabilities
- **Phased Rollout:** 12-month plan with specialized GPU instances for multimodal processing

## Critical File Paths That Matter

### Optimization Files
- [`optimized_hierarchy_resolver.py`](api/navigation_api/database/optimized_hierarchy_resolver.py:44) - Core performance optimization
- [`003_optimize_hierarchy_performance.sql`](api/navigation_api/migrations/003_optimize_hierarchy_performance.sql:100) - Database optimizations
- [`WebSocketManager.tsx`](frontend/src/ws/WebSocketManager.tsx:118) - Client-side WS management

### Compliance Automation
- Security checks run via pre-commit hooks and CI/CD pipeline
- Evidence stored in `deliverables/compliance/evidence/`
- Automated reporting for weekly/monthly/quarterly compliance

## Feature Flag Strategy
- `ff.hierarchy_optimized`, `ff.ws_v1`, `ff.map_v1`, `ff.ab_routing`
- Gradual rollout: 10% → 25% → 50% → 100%
- Rollback: Flag off first, then DB migration rollback scripts

---

**Remember:** These patterns represent architectural decisions that would surprise experienced developers. They address specific performance, reliability, and scalability challenges unique to the geopolitical intelligence domain.