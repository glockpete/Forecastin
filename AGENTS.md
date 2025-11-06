# AGENTS.md - Forecastin Project Non-Obvious Patterns

**⚠️ CRITICAL: This document contains ONLY non-obvious patterns, gotchas, and counterintuitive requirements discovered from roadmap analysis. Standard practices and framework defaults are excluded.**

## Database Architecture Gotchas

### LTREE Materialized Views for O(log n) Performance
- **Non-obvious:** Database uses LTREE extension with **materialized views** (`mv_entity_ancestors`, `mv_descendant_counts`) for O(log n) performance instead of traditional recursive queries
- **Gotcha:** Materialized views require manual refresh via [`refresh_materialized_view()`](api/navigation_api/database/optimized_hierarchy_resolver.py:573) function - not automatic
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

### Runtime URL Configuration Fix
- **Non-obvious:** WebSocket URLs must be derived from `window.location` at runtime, not baked into Docker builds
- **Gotcha:** Frontend was built with Docker-internal hostname `ws://api:9000` that's unreachable from browser
- **Solution:** [`frontend/src/config/env.ts`](frontend/src/config/env.ts:1) dynamically constructs URLs from browser location
- **Critical:** HTTPS pages automatically use `wss://` protocol, port-aware (defaults to 9000)

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

### Validated Performance Metrics (Current Status)
- **Ancestor Resolution:** Target <10ms, **Actual: 3.46ms** (P95: 5.20ms) ❌ **SLO regression detected**
- **Descendant Retrieval:** Target <50ms, **Actual: 1.25ms** (P99: 17.29ms) ✅ **PASSED**
- **Throughput:** Target >10,000 RPS, **Actual: 42,726 RPS** ✅ **PASSED**
- **Cache Hit Rate:** Target >90%, **Actual: 99.2%** ✅ **PASSED**
- **Materialized View Refresh:** Target <1000ms, **Actual: 850ms** ✅ **PASSED**
- **WebSocket Serialization:** Target <2ms, **Actual: 0.019ms** ✅ **PASSED**
- **Connection Pool Health:** Target <80%, **Actual: 65%** ✅ **PASSED**

### Geospatial Layer Performance
- **PolygonLayer:** <10ms for 1000 complex polygons (avg 100 vertices) ✅ **Validated**
- **LinestringLayer:** <8ms for 5000 linestrings (avg 50 vertices) ✅ **Validated**
- **GeoJsonLayer:** <15ms for mixed geometry (1000 features) ✅ **Validated**
- **GPU Filter Time:** <100ms for 10k points ✅ **Validated**

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

## TypeScript Strict Mode Compliance

### Zero-Error Achievement
- **Non-obvious:** Codebase achieved **full TypeScript strict mode compliance** with **0 errors** (resolved from 186)
- **Gotcha:** Historical documentation indicated 186 errors, but current compilation shows 0 errors
- **Critical:** [`frontend/tsconfig.json`](frontend/tsconfig.json:1) has `"strict": true` enabled
- **Validation:** Verified via `npx tsc --noEmit` with exit code 0

## Geospatial Layer Implementation Patterns

### BaseLayer Architecture with GPU Optimization
- **Non-obvious:** Geospatial layers use unified [`BaseLayer`](frontend/src/layers/base/BaseLayer.ts:1) architecture with GPU filtering
- **Gotcha:** LayerRegistry requires explicit performance monitoring setup every 30 seconds
- **Critical:** Visual channels must be configured before layer activation to prevent rendering errors

### LayerWebSocketIntegration for Real-Time Updates
- **Non-obvious:** Real-time updates via [`LayerWebSocketIntegration`](frontend/src/integrations/LayerWebSocketIntegration.ts:50) with message queuing
- **Gotcha:** WebSocket integration requires feature flag check (`ff_websocket_layers_enabled`)
- **Critical:** Message types include `layer_data`, `entity_update`, `performance_metrics`, `compliance_event`

## RSS Ingestion Patterns

### RSSHub-Inspired Route System with CSS Selectors
- **Non-obvious:** RSS ingestion uses RSSHub-inspired route system with **CSS selectors** for different sources instead of generic parsing
- **Gotcha:** Route processors require **intelligent fallbacks** when CSS selectors fail - not just error reporting
- **Counterintuitive:** CSS selectors are compiled to **XPath expressions** for better performance and reliability

### Anti-Crawler Strategies with Exponential Backoff
- **Non-obvious:** Anti-crawler system uses **domain-specific exponential backoff** with user agent rotation
- **Gotcha:** Success rate monitoring requires **sliding window analysis** to detect patterns, not just simple counters
- **Critical:** Backoff strategies must be **persistent across service restarts** to maintain domain relationships

### RSS-Specific WebSocket Serialization
- **Non-obvious:** RSS WebSocket messages require **custom RSS message types** (`rss_feed_update`, `rss_entity_extracted`, `rss_deduplication_result`)
- **Gotcha:** RSS entity extraction results must be **batched and throttled** to prevent WebSocket flooding
- **Critical:** RSS WebSocket connections require **feed-specific subscriptions** to avoid unnecessary broadcast

### RSS Entity Extraction with 5-W Framework
- **Non-obvious:** RSS entity extraction extends existing 5-W framework but with **RSS-specific confidence scoring**
- **Gotcha:** RSS content requires **HTML sanitization and text extraction** before 5-W analysis
- **Critical:** RSS entity extraction must handle **multiple languages and character encodings** automatically

### RSS Deduplication with Similarity Threshold
- **Non-obvious:** RSS deduplication uses **0.8 similarity threshold** with **canonical key assignment**
- **Gotcha:** Similarity calculation requires **semantic analysis** not just text matching
- **Critical:** Deduplication audit trail must include **confidence scores and matching criteria**

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
- [`frontend/src/config/env.ts`](frontend/src/config/env.ts:1) - Runtime URL configuration

### Geospatial Layer Files
- [`BaseLayer.ts`](frontend/src/layers/base/BaseLayer.ts:1) - Core layer architecture
- [`LayerRegistry.ts`](frontend/src/layers/registry/LayerRegistry.ts:1) - Layer management and performance monitoring
- [`LayerWebSocketIntegration.ts`](frontend/src/integrations/LayerWebSocketIntegration.ts:1) - Real-time updates

### RSS Ingestion Files
- [`rss_ingestion_service.py`](api/services/rss/rss_ingestion_service.py:1) - Main RSS ingestion service with route processors
- [`manager.py`](api/services/rss/anti_crawler/manager.py:1) - Anti-crawler strategies with exponential backoff
- [`base_processor.py`](api/services/rss/route_processors/base_processor.py:1) - Base RSS route processor with CSS selectors
- [`RSS_INGESTION_SERVICE_ARCHITECTURE.md`](docs/RSS_INGESTION_SERVICE_ARCHITECTURE.md:1) - Complete RSS service architecture specification
- [`RSS_SERVICE_IMPLEMENTATION_GUIDE.md`](docs/RSS_SERVICE_IMPLEMENTATION_GUIDE.md:1) - Detailed RSS service implementation guide

### Compliance Automation
- Security checks run via pre-commit hooks and CI/CD pipeline
- Evidence stored in `deliverables/compliance/evidence/`
- Automated reporting for weekly/monthly/quarterly compliance

## Feature Flag Strategy
- `ff.hierarchy_optimized`, `ff.ws_v1`, `ff.map_v1`, `ff.ab_routing`, `ff.geo.layers_enabled`
- `rss_ingestion_v1`, `rss_route_processing`, `rss_anti_crawler`, `rss_entity_extraction`, `rss_deduplication`, `rss_websocket_notifications`
- Gradual rollout: 10% → 25% → 50% → 100%
- Rollback: Flag off first, then DB migration rollback scripts

---

**Remember:** These patterns represent architectural decisions that would surprise experienced developers. They address specific performance, reliability, and scalability challenges unique to the geopolitical intelligence domain.