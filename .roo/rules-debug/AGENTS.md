# AGENTS.md - Debug Mode Non-Obvious Patterns

**⚠️ CRITICAL: This document contains ONLY non-obvious debugging patterns, gotchas, and counterintuitive troubleshooting requirements for the forecastin project.**

## Database Debugging Gotchas

### Materialized View Staleness Detection
- **Non-obvious:** Materialized views can become stale without obvious errors - queries return outdated data
- **Debug Pattern:** Check `mv_entity_ancestors` timestamp vs. entity modification times
- **Gotcha:** Manual refresh required - call [`refresh_hierarchy_views()`](api/navigation_api/database/optimized_hierarchy_resolver.py:53) to fix

### LTREE Query Performance Issues
- **Non-obvious:** Slow hierarchy queries may indicate missing GiST indexes
- **Debug Pattern:** Verify GiST indexes exist for LTREE `path` column
- **Gotcha:** Composite indexes (`path_depth`, `path`) required for optimal performance

### Connection Pool Exhaustion Symptoms
- **Non-obvious:** Connection pool issues manifest as random timeouts, not consistent failures
- **Debug Pattern:** Monitor pool utilization via background thread logs (80% warning threshold)
- **Gotcha:** TCP keepalive settings critical for firewall environments

## WebSocket Debugging Patterns

### Serialization Crash Investigation
- **Non-obvious:** WebSocket crashes often caused by datetime/dataclass serialization failures
- **Debug Pattern:** Check if [`safe_serialize_message()`](api/realtime_service.py:140) is used
- **Gotcha:** Standard `json.dumps` will crash connections on non-serializable objects

### Message Delivery Issues
- **Non-obvious:** WebSocket messages may be delivered but not processed due to state management issues
- **Debug Pattern:** Verify WebSocket updates trigger React Query invalidations
- **Gotcha:** Three-state management systems (React Query, Zustand, WebSocket) must coordinate

### Redis Pub/Sub Debugging
- **Non-obvious:** WebSocket scaling issues may indicate Redis Pub/Sub configuration problems
- **Debug Pattern:** Check Redis connection status and Pub/Sub channel subscriptions
- **Gotcha:** Messages not broadcasting across server instances indicate Pub/Sub failure

## Entity Extraction Debugging

### Confidence Score Anomalies
- **Non-obvious:** Confidence scores that seem too high/low may indicate calibration rule failures
- **Debug Pattern:** Check if multi-factor confidence scoring rules are applying correctly
- **Gotcha:** PersonEntity with title+organization should have higher score than name alone

### Deduplication Failures
- **Non-obvious:** Duplicate entities may indicate similarity threshold (0.8) not being applied
- **Debug Pattern:** Verify `canonical_key` assignment and `audit_trail` logging
- **Gotcha:** Deduplication engine requires proper similarity comparison configuration

### ML Model A/B Testing Issues
- **Non-obvious:** A/B test routing failures may indicate persistent Test Registry problems
- **Debug Pattern:** Check if test state survives server restarts (Redis/DB persistence)
- **Gotcha:** In-memory test tracking fails on lookup - requires persistent storage

## Performance Debugging Patterns

### Cache Hit Rate Investigation
- **Non-obvious:** Low cache hit rates may indicate improper cache invalidation across tiers
- **Debug Pattern:** Monitor L1/L2/L3/L4 cache performance separately
- **Gotcha:** Four-tier caching requires coordinated invalidation

### Ancestor Resolution Slowdown
- **Non-obvious:** Slow ancestor resolution may indicate materialized view staleness
- **Debug Pattern:** Compare current performance against validated metrics (1.25ms target)
- **Gotcha:** O(log n) performance depends on properly maintained materialized views

### Throughput Degradation
- **Non-obvious:** Throughput drops below 42,726 RPS may indicate connection pool issues
- **Debug Pattern:** Check database connection pool utilization and health monitoring
- **Gotcha:** Exponential backoff retry mechanism may be failing

## Frontend Debugging Patterns

### State Management Coordination Issues
- **Non-obvious:** UI inconsistencies may indicate React Query/Zustand/WebSocket coordination failures
- **Debug Pattern:** Verify WebSocket data properly integrates with React Query state
- **Gotcha:** Three distinct state management systems must work together seamlessly

### Miller's Columns Responsive Issues
- **Non-obvious:** Mobile navigation problems may indicate improper single-column adaptation
- **Debug Pattern:** Test "Back" navigation functionality in mobile view
- **Gotcha:** Global search must properly populate hierarchical context

### Progressive Loading Failures
- **Non-obvious:** Performance issues may indicate improper lazy loading implementation
- **Debug Pattern:** Verify only top-level nodes load initially, children load on expand
- **Gotcha:** Virtualization required for long lists to maintain performance

## Compliance Debugging Patterns

### Automated Evidence Collection Failures
- **Non-obvious:** Compliance issues may indicate script failures in pre-commit hooks
- **Debug Pattern:** Check `deliverables/compliance/evidence/` for missing reports
- **Gotcha:** Documentation consistency checking relies on embedded JSON blocks

### Performance SLO Validation
- **Non-obvious:** SLO violations may indicate underlying architecture problems
- **Debug Pattern:** Compare current metrics against validated targets:
  - Ancestor resolution: 1.25ms (P95: 1.87ms)
  - Throughput: 42,726 RPS
  - Cache hit rate: 99.2%
- **Gotcha:** These metrics represent architectural capabilities, not aspirational goals

## Multi-Agent System Debugging

### Agent Communication Failures
- **Non-obvious:** Agent coordination issues may indicate Redis Pub/Sub configuration problems
- **Debug Pattern:** Verify agent communication uses existing WebSocket infrastructure
- **Gotcha:** Real-time agent coordination extends WebSocket capabilities

### GPU Instance Performance
- **Non-obvious:** Multimodal agent performance issues may indicate GPU resource constraints
- **Debug Pattern:** Monitor GPU utilization for CLIP, Whisper, and vision/audio models
- **Gotcha:** Phase 2 requires 4-6 GPU instances for multimodal processing

## Feature Flag Debugging

### Rollback Procedure Failures
- **Non-obvious:** Feature flag issues may indicate improper rollback sequencing
- **Debug Pattern:** Verify flag off happens before DB migration rollback
- **Gotcha:** Gradual rollout (10% → 25% → 50% → 100%) must be properly implemented

### A/B Test Lifecycle Issues
- **Non-obvious:** Test failures may indicate risk condition monitoring problems
- **Debug Pattern:** Check if 7 configurable risk conditions are properly monitored
- **Gotcha:** Automatic rollback to baseline model should trigger on risk condition breaches

---

**Remember:** These debugging patterns address challenges unique to the geopolitical intelligence platform's complex architecture. Standard web application debugging approaches may not apply.