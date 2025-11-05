# AGENTS.md - Architect Mode Non-Obvious Constraints

**⚠️ CRITICAL: This document contains ONLY non-obvious architectural constraints, gotchas, and counterintuitive design requirements that impact system architecture decisions.**

## Database Architecture Constraints

### LTREE Materialized View Constraints
- **Constraint:** Materialized views require **manual refresh** - cannot be automatically updated like regular views
- **Architectural Impact:** Must design trigger-based or scheduled refresh mechanism for [`refresh_hierarchy_views()`](api/navigation_api/database/optimized_hierarchy_resolver.py:53)
- **Non-Negotiable:** Pre-computed `path_depth` and `path_hash` columns required for O(1) lookups

### Multi-Tier Caching Constraints
- **Constraint:** Four-tier caching strategy with distinct synchronization requirements:
  - L1: Thread-safe LRU with **RLock** (not standard Lock)
  - L2: Redis requires connection pooling with exponential backoff
  - L3: PostgreSQL buffer cache + materialized views
  - L4: Materialized views as persistent cache layer
- **Architectural Impact:** Cache invalidation must propagate across all four tiers

### Connection Pool Constraints
- **Constraint:** TCP keepalives required for firewall prevention: `keepalives_idle: 30`, `keepalives_interval: 10`, `keepalives_count: 5`
- **Architectural Impact:** Background health monitoring thread required with 80% utilization warning threshold

## Performance Architecture Constraints

### Validated Performance Targets
- **Constraint:** Architecture must support validated metrics, not just targets:
  - Ancestor resolution: **1.25ms** (P95: 1.87ms) - not <10ms
  - Throughput: **42,726 RPS** - not >10,000
  - Cache hit rate: **99.2%** - not >90%
- **Architectural Impact:** These represent achieved capabilities that must be maintained

### WebSocket Performance Constraints
- **Constraint:** WebSocket latency P95 <200ms with automatic reconnection <5s
- **Architectural Impact:** Requires Redis Pub/Sub for horizontal scaling and message batching

## WebSocket Architecture Constraints

### Serialization Framework Constraints
- **Constraint:** WebSocket serialization **requires orjson** with custom [`safe_serialize_message()`](api/realtime_service.py:140)
- **Non-Negotiable:** Standard `json.dumps` crashes on datetime/dataclass objects
- **Architectural Impact:** All WebSocket handlers must implement try/except serialization wrapping

### Real-time Architecture Constraints
- **Constraint:** Three distinct state management systems must coordinate:
  - React Query: Server state management
  - Zustand: Global UI state
  - WebSocket: Real-time state integration
- **Architectural Impact:** State coordination mechanism required across frontend architecture

## Entity Extraction Architecture Constraints

### 5-W Framework Constraints
- **Constraint:** Confidence scoring uses **rule-based calibration**, not just model confidence
- **Architectural Impact:** Multi-factor scoring system required with similarity threshold (0.8) deduplication

### ML Model Management Constraints
- **Constraint:** A/B testing requires **persistent Test Registry** (Redis/DB) - in-memory tracking fails
- **Architectural Impact:** 7 configurable risk conditions must trigger automatic rollback to baseline model

## Frontend Architecture Constraints

### UI Pattern Constraints
- **Constraint:** Miller's Columns pattern required for hierarchical navigation with mobile adaptation
- **Architectural Impact:** Must support responsive collapse to single-column view with "Back" navigation

### State Management Constraints
- **Constraint:** Hybrid state management with three systems must work seamlessly together
- **Architectural Impact:** WebSocket updates must properly integrate with React Query state management

## Compliance Architecture Constraints

### Automated Evidence Collection
- **Constraint:** Compliance framework requires automated evidence collection scripts:
  - [`gather_metrics.py`](scripts/gather_metrics.py:626)
  - [`check_consistency.py`](scripts/check_consistency.py:633)
  - [`fix_roadmap.py`](scripts/fix_roadmap.py:643)
- **Architectural Impact:** Pre-commit hooks and CI/CD pipeline integration required

### Documentation Consistency
- **Constraint:** Documentation consistency checking via embedded JSON blocks in markdown
- **Architectural Impact:** Automated validation of machine-readable content blocks

## Multi-Agent System Architecture Constraints

### Integration Point Constraints
- **Constraint:** Must extend existing infrastructure for agent coordination:
  - Entity extraction system enhancement
  - Navigation API coordination
  - Caching and geospatial capabilities
- **Architectural Impact:** 12-month phased rollout with specialized GPU instances required

### Communication Constraints
- **Constraint:** Redis Pub/Sub used for real-time agent communication
- **Architectural Impact:** Multimodal processing requires GPU instances for CLIP, Whisper models

## Critical File Path Constraints

### Optimization File Dependencies
- **Constraint:** Core performance depends on specific implementations:
  - [`optimized_hierarchy_resolver.py`](api/navigation_api/database/optimized_hierarchy_resolver.py:44)
  - [`003_optimize_hierarchy_performance.sql`](api/navigation_api/migrations/003_optimize_hierarchy_performance.sql:100)
  - [`WebSocketManager.tsx`](frontend/src/ws/WebSocketManager.tsx:118)
- **Architectural Impact:** These files represent critical optimization points that cannot be altered without performance impact

## Feature Flag Architecture Constraints

### Rollout Strategy Constraints
- **Constraint:** Gradual rollout required: 10% → 25% → 50% → 100%
- **Architectural Impact:** Rollback procedure: flag off first, then DB migration rollback

### Key Feature Flags
- **Constraint:** Critical flags that control system behavior:
  - `ff.hierarchy_optimized`
  - `ff.ws_v1`
  - `ff.map_v1`
  - `ff.ab_routing`
- **Architectural Impact:** Flag management system must support automatic rollback capabilities

## Scalability Architecture Constraints

### Hierarchical Data Constraints
- **Constraint:** Must support 10,000+ geopolitical entities with deep nested relationships
- **Architectural Impact:** O(log n) performance required via materialized views, not traditional recursive queries

### Real-time Update Constraints
- **Constraint:** WebSocket infrastructure must support real-time updates across all connected clients
- **Architectural Impact:** Redis Pub/Sub required for horizontal scaling of WebSocket servers

## Security Architecture Constraints

### Connection Security Constraints
- **Constraint:** Database connections require specific TCP keepalive settings for firewall traversal
- **Architectural Impact:** Connection pooling configuration must include health monitoring

### Compliance Security Constraints
- **Constraint:** Automated security checks via pre-commit hooks and CI/CD pipeline
- **Architectural Impact:** Evidence storage in `deliverables/compliance/evidence/` with automated reporting

---

**Architectural Philosophy:** These constraints represent deliberate design decisions that address specific challenges in the geopolitical intelligence domain. They are not arbitrary limitations but solutions to complex performance, reliability, and scalability requirements.