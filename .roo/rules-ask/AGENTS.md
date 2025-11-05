# AGENTS.md - Ask Mode Documentation Context

**⚠️ CRITICAL: This document contains ONLY non-obvious documentation patterns, gotchas, and counterintuitive requirements for understanding the forecastin project architecture.**

## Architecture Documentation Context

### Hierarchical Database Design
- **Non-obvious:** LTREE materialized views provide O(log n) performance instead of traditional recursive queries
- **Documentation Focus:** Emphasize manual refresh requirement for materialized views via [`refresh_hierarchy_views()`](api/navigation_api/database/optimized_hierarchy_resolver.py:53)
- **Key Concept:** Pre-computed `path_depth` and `path_hash` columns enable O(1) lookups

### Multi-Tier Caching Architecture
- **Non-obvious:** Four-tier caching strategy with distinct purposes:
  - L1: Thread-safe LRU cache with RLock synchronization
  - L2: Redis for shared instance caching
  - L3: PostgreSQL buffer cache
  - L4: Materialized views as pre-computation cache
- **Documentation Focus:** Cache coordination and invalidation patterns across tiers

## Performance Documentation Context

### Validated Performance Metrics
- **Non-obvious:** Performance exceeds typical expectations:
  - Ancestor resolution: 1.25ms (P95: 1.87ms) vs. <10ms target
  - Throughput: 42,726 RPS vs. >10,000 target
  - Cache hit rate: 99.2% vs. >90% target
- **Documentation Focus:** These represent architectural capabilities, not aspirational goals

### Connection Management Patterns
- **Non-obvious:** TCP keepalives required for firewall prevention:
  - `keepalives_idle: 30`, `keepalives_interval: 10`, `keepalives_count: 5`
- **Documentation Focus:** Background health monitoring with 80% utilization warnings

## WebSocket Documentation Context

### Serialization Requirements
- **Non-obvious:** WebSocket serialization requires `orjson` with custom [`safe_serialize_message()`](api/realtime_service.py:140)
- **Documentation Focus:** Standard `json.dumps` crashes on datetime/dataclass objects
- **Key Concept:** Try/except wrapping required to prevent connection crashes

### Real-time Architecture
- **Non-obvious:** Redis Pub/Sub extends WebSocket infrastructure for agent communication
- **Documentation Focus:** Message batching, optimized payloads, and partial updates

## Entity Extraction Documentation Context

### 5-W Framework Implementation
- **Non-obvious:** Confidence scoring uses rule-based calibration, not just model confidence
- **Documentation Focus:** Multi-factor scoring with similarity threshold (0.8) deduplication
- **Key Concept:** `canonical_key` assignment and `audit_trail` logging

### ML Model Management
- **Non-obvious:** A/B testing framework with automatic rollback capabilities
- **Documentation Focus:** Persistent Test Registry requirement (Redis/DB) vs. in-memory tracking
- **Key Concept:** 7 configurable risk conditions trigger rollback

## Frontend Documentation Context

### State Management Architecture
- **Non-obvious:** Hybrid state management with three distinct systems:
  - React Query: Server state management
  - Zustand: Global UI state
  - WebSocket: Real-time state integration
- **Documentation Focus:** Coordination requirements between systems

### UI Pattern Implementation
- **Non-obvious:** Miller's Columns for hierarchical navigation with mobile adaptation
- **Documentation Focus:** Context preservation and global search integration
- **Key Concept:** Progressive loading and virtualization requirements

## Compliance Documentation Context

### Automated Evidence Collection
- **Non-obvious:** Compliance framework includes automated scripts:
  - [`gather_metrics.py`](scripts/gather_metrics.py:626)
  - [`check_consistency.py`](scripts/check_consistency.py:633)
  - [`fix_roadmap.py`](scripts/fix_roadmap.py:643)
- **Documentation Focus:** Embedded JSON blocks for documentation consistency checking

### Evidence Storage Structure
- **Non-obvious:** Evidence stored in `deliverables/compliance/evidence/`
- **Documentation Focus:** Automated reporting for weekly/monthly/quarterly compliance

## Multi-Agent System Documentation Context

### Integration Points
- **Non-obvious:** Extends existing infrastructure for agent coordination:
  - Entity extraction system enhancement
  - Navigation API coordination
  - Caching and geospatial capabilities
- **Documentation Focus:** 12-month phased rollout with GPU instances

### Communication Patterns
- **Non-obvious:** Redis Pub/Sub used for real-time agent communication
- **Documentation Focus:** Multimodal processing requirements (CLIP, Whisper models)

## Critical Implementation Files

### Core Optimization Files
- [`optimized_hierarchy_resolver.py`](api/navigation_api/database/optimized_hierarchy_resolver.py:44) - Database performance
- [`003_optimize_hierarchy_performance.sql`](api/navigation_api/migrations/003_optimize_hierarchy_performance.sql:100) - Migration optimizations
- [`WebSocketManager.tsx`](frontend/src/ws/WebSocketManager.tsx:118) - Client-side management

### Compliance Automation
- **Non-obvious:** Pre-commit hooks and CI/CD pipeline integration
- **Documentation Focus:** Security checks and quality gates

## Feature Flag Strategy Documentation

### Rollout Patterns
- **Non-obvious:** Gradual rollout: 10% → 25% → 50% → 100%
- **Documentation Focus:** Rollback procedure: flag off first, then DB migration rollback
- **Key Flags:** `ff.hierarchy_optimized`, `ff.ws_v1`, `ff.map_v1`, `ff.ab_routing`

## Documentation Consistency Patterns

### Automated Maintenance
- **Non-obvious:** Scripts automate documentation consistency checking
- **Documentation Focus:** Real-time metrics gathering vs. hardcoded values
- **Key Concept:** Machine-readable JSON blocks embedded in markdown

---

**Documentation Philosophy:** Focus on explaining why these non-obvious patterns exist - they address specific performance, reliability, and scalability challenges in the geopolitical intelligence domain that standard web application patterns don't encounter.