# Entity Extraction Integration Plan

## Integration Overview
This document outlines the integration strategy for the 5-W entity extraction system with the existing Forecastin platform architecture. The integration maintains the validated performance metrics (1.25ms ancestor resolution, 42,726 RPS throughput, 99.2% cache hit rate) while extending functionality.

## Integration Points

### 1. LTREE Hierarchy Integration

#### OptimizedHierarchyResolver Extension
**Current Implementation**: [`optimized_hierarchy_resolver.py`](api/navigation_api/database/optimized_hierarchy_resolver.py:44)
**Integration Strategy**: Extend resolver to support 5-W entity relationships

```python
class EnhancedHierarchyResolver(OptimizedHierarchyResolver):
    async def get_5w_entity_relationships(self, entity_id: str):
        """Get 5-W specific relationships for an entity"""
        # Use materialized view for O(log n) performance
        query = """
        SELECT target_entity, relationship_type, relationship_confidence
        FROM mv_5w_entity_relationships 
        WHERE source_entity = $1 AND relationship_confidence > 0.7
        """
        return await self.db_manager.execute_query(query, entity_id)
    
    async def refresh_5w_relationship_views(self):
        """Refresh 5-W relationship materialized views"""
        await self.db_manager.execute_query("REFRESH MATERIALIZED VIEW mv_5w_entity_relationships")
```

#### Materialized View Extensions
**Existing Views**: `mv_entity_ancestors`, `mv_descendant_counts`
**New Views**: `mv_5w_entity_relationships`

```sql
-- Migration script for 5-W relationship views
CREATE MATERIALIZED VIEW mv_5w_entity_relationships AS
SELECT 
    e1.entity_id as source_entity,
    e2.entity_id as target_entity,
    CASE 
        WHEN e1.metadata->>'type' = 'who' AND e2.metadata->>'type' = 'what' THEN 'actor_event'
        WHEN e1.metadata->>'type' = 'what' AND e2.metadata->>'type' = 'where' THEN 'event_location'
        WHEN e1.metadata->>'type' = 'what' AND e2.metadata->>'type' = 'when' THEN 'event_temporal'
        WHEN e1.metadata->>'type' = 'what' AND e2.metadata->>'type' = 'why' THEN 'event_causal'
        ELSE 'general_relationship'
    END as relationship_type,
    (e1.confidence_score + e2.confidence_score) / 2 as relationship_confidence
FROM entities e1
CROSS JOIN entities e2
WHERE e1.entity_id != e2.entity_id
AND e1.confidence_score > 0.7
AND e2.confidence_score > 0.7;
```

### 2. Four-Tier Caching Integration

#### L1 Cache (Memory) - Entity Extraction Patterns
**Integration**: Extend thread-safe LRU cache with RLock synchronization

```python
class EntityExtractionCache:
    def __init__(self, cache_service: CacheService):
        self.cache_service = cache_service
        self.extraction_patterns = {}  # Thread-safe with RLock
        self.confidence_models = {}    # Rule-based calibration models
    
    async def get_extraction_pattern(self, content_hash: str):
        """Get cached extraction pattern with RLock synchronization"""
        with self.cache_service.rlock:
            return self.extraction_patterns.get(content_hash)
    
    async def cache_extraction_result(self, content_hash: str, entities: List[Entity]):
        """Cache extraction results with confidence scoring"""
        with self.cache_service.rlock:
            self.extraction_patterns[content_hash] = {
                'entities': entities,
                'timestamp': time.time(),
                'confidence_scores': [e.confidence_score for e in entities]
            }
```

#### L2 Cache (Redis) - Shared Confidence Models
**Integration**: Connection pooling with exponential backoff

```python
class ConfidenceModelCache:
    def __init__(self, redis_pool):
        self.redis_pool = redis_pool
        self.model_key_prefix = "confidence_model:"
    
    async def get_calibration_rules(self, entity_type: str):
        """Get rule-based calibration rules from Redis"""
        try:
            key = f"{self.model_key_prefix}{entity_type}"
            rules = await self.redis_pool.get(key)
            if rules:
                return orjson.loads(rules)
        except Exception as e:
            logger.warning(f"Redis cache miss for {entity_type}: {e}")
            return None
```

#### L3/L4 Cache (Database/Materialized Views)
**Integration**: Leverage existing PostgreSQL buffer cache and materialized views

```sql
-- Pre-computed confidence statistics for caching
CREATE MATERIALIZED VIEW mv_confidence_statistics AS
SELECT 
    metadata->>'type' as entity_type,
    AVG(confidence_score) as avg_confidence,
    COUNT(*) as entity_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY confidence_score) as median_confidence
FROM entities 
GROUP BY metadata->>'type';
```

### 3. PostGIS Location Integration

#### Geographic Entity Relationships
**Integration**: Extend PostGIS queries for 5-W spatial analysis

```python
class GeographicEntityResolver:
    async def get_spatial_relationships(self, entity_id: str, radius_km: float = 50):
        """Get entities within geographic proximity"""
        query = """
        SELECT e2.entity_id, e2.metadata->>'type' as entity_type,
               ST_Distance(e1.location, e2.location) / 1000 as distance_km
        FROM entities e1, entities e2
        WHERE e1.entity_id = $1 
        AND e2.entity_id != $1
        AND e2.location IS NOT NULL
        AND ST_DWithin(e1.location, e2.location, $2 * 1000)
        AND e2.confidence_score > 0.7
        ORDER BY distance_km ASC
        """
        return await self.db_manager.execute_query(query, entity_id, radius_km)
```

#### Hierarchy Consistency Validation
**Integration**: Validate geographic hierarchy consistency

```python
async def validate_geographic_hierarchy(entity: Entity):
    """Validate entity location against LTREE hierarchy"""
    if entity.metadata.get('type') == 'where' and entity.location:
        # Check if geographic coordinates align with hierarchy path
        hierarchy = await hierarchy_resolver.get_entity_hierarchy(entity.entity_id)
        geographic_consistency = calculate_geographic_consistency(entity.location, hierarchy)
        return geographic_consistency > 0.8  # 80% consistency threshold
    return True
```

### 4. WebSocket Integration

#### Real-time Entity Extraction Updates
**Integration**: Extend existing WebSocket infrastructure with orjson serialization

```python
class EntityExtractionWebSocketHandler:
    async def send_extraction_progress(self, client_id: str, extraction_id: str, progress: float):
        """Send real-time extraction progress updates"""
        message = {
            "type": "extraction_progress",
            "extraction_id": extraction_id,
            "progress": progress,
            "timestamp": time.time()
        }
        await connection_manager.send_personal_message(message, client_id)
    
    async def broadcast_confidence_update(self, entity_id: str, new_confidence: float):
        """Broadcast confidence score updates to all clients"""
        message = {
            "type": "confidence_update",
            "entity_id": entity_id,
            "new_confidence": new_confidence,
            "timestamp": time.time()
        }
        await connection_manager.broadcast_message(message)
```

#### Safe Serialization Integration
**Integration**: Use existing [`safe_serialize_message()`](api/realtime_service.py:140)

```python
# All WebSocket messages use the existing safe serialization
serialized_message = safe_serialize_message({
    "type": "entity_extraction_complete",
    "extraction_id": extraction_id,
    "entities_found": len(entities),
    "average_confidence": avg_confidence
})
```

### 5. Feature Flag Integration

#### Gradual Rollout Strategy
**Integration**: Use existing FeatureFlagService for controlled deployment

```python
class EntityExtractionFeatureFlags:
    def __init__(self, feature_flag_service: FeatureFlagService):
        self.ff_service = feature_flag_service
    
    async def is_extraction_enabled(self, user_id: str) -> bool:
        """Check if entity extraction is enabled for user (10% → 25% → 50% → 100%)"""
        return await self.ff_service.is_enabled("ff.entity_extraction_v1", user_id)
    
    async def get_confidence_calibration_mode(self, user_id: str) -> str:
        """Get confidence calibration mode (base|rule_based|advanced)"""
        if await self.ff_service.is_enabled("ff.confidence_calibration", user_id):
            return "rule_based"
        return "base"
```

### 6. Performance Integration

#### Maintain Validated Metrics
**Integration**: Ensure all operations maintain performance targets

```python
class PerformanceGuaranteedExtraction:
    async def extract_entities_with_performance_guarantee(self, content: str):
        """Entity extraction with performance monitoring"""
        start_time = time.time()
        
        # Use cached patterns if available (L1 cache)
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        cached_result = await extraction_cache.get_extraction_pattern(content_hash)
        
        if cached_result and time.time() - cached_result['timestamp'] < 300:  # 5-minute cache
            extraction_time = time.time() - start_time
            if extraction_time < 0.00125:  # 1.25ms target
                return cached_result['entities']
        
        # Perform extraction with timeout
        entities = await asyncio.wait_for(
            self._perform_extraction(content),
            timeout=0.01  # 10ms timeout to maintain 1.25ms average
        )
        
        extraction_time = time.time() - start_time
        logger.info(f"Extraction completed in {extraction_time:.3f}ms")
        
        return entities
```

#### Connection Pool Health Monitoring
**Integration**: Extend existing health monitoring for entity extraction

```python
async def entity_extraction_health_monitor():
    """Background monitoring for entity extraction performance"""
    while True:
        try:
            # Monitor extraction latency
            extraction_stats = await get_extraction_performance_stats()
            if extraction_stats['average_latency_ms'] > 2.0:  # 2ms threshold
                logger.warning(f"Extraction latency high: {extraction_stats['average_latency_ms']}ms")
            
            # Monitor cache hit rate
            cache_stats = cache_service.get_stats()
            if cache_stats['hit_rate'] < 0.98:  # 98% threshold
                logger.warning(f"Cache hit rate low: {cache_stats['hit_rate']:.3f}")
            
            await asyncio.sleep(30)  # Monitor every 30 seconds
            
        except Exception as e:
            logger.error(f"Entity extraction health monitor error: {e}")
            await asyncio.sleep(30)
```

## Integration Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Extend OptimizedHierarchyResolver for 5-W relationships
- [ ] Create mv_5w_entity_relationships materialized view
- [ ] Implement basic entity extraction cache (L1/L2)

### Phase 2: Core Integration (Week 3-4)
- [ ] Integrate PostGIS geographic relationships
- [ ] Implement rule-based confidence calibration
- [ ] Add WebSocket real-time updates

### Phase 3: Performance Optimization (Week 5-6)
- [ ] Optimize extraction performance to maintain 1.25ms target
- [ ] Implement deduplication with similarity threshold
- [ ] Add comprehensive audit trail logging

### Phase 4: Production Readiness (Week 7-8)
- [ ] Implement feature flags for gradual rollout
- [ ] Add comprehensive testing and validation
- [ ] Performance benchmarking against validated metrics

## Risk Mitigation

### Performance Risks
- **Risk**: Entity extraction impacting existing 1.25ms performance
- **Mitigation**: Timeout mechanisms and performance monitoring
- **Fallback**: Disable extraction via feature flags if performance degrades

### Integration Risks
- **Risk**: Breaking existing hierarchy resolver functionality
- **Mitigation**: Comprehensive testing with existing test suites
- **Fallback**: Rollback database migrations if issues detected

### Data Consistency Risks
- **Risk**: Deduplication causing data loss or inconsistency
- **Mitigation**: Comprehensive audit trail and backup procedures
- **Fallback**: Manual review process for high-confidence merges

## Compliance Integration

### Audit Trail Requirements
- **Integration**: Extend existing audit framework for entity extraction
- **Validation**: Automated evidence collection scripts
- **Reporting**: Weekly/monthly compliance reports

### Security Integration
- **Pre-commit Hooks**: Entity extraction security checks
- **CI/CD Pipeline**: Automated security validation
- **Evidence Storage**: `deliverables/compliance/evidence/` integration

## Monitoring and Alerting

### Key Metrics to Monitor
- Entity extraction latency (target: <1.25ms)
- Cache hit rate (target: >99.2%)
- Deduplication accuracy (target: >95%)
- Confidence calibration effectiveness

### Alerting Thresholds
- **Warning**: Extraction latency >2ms
- **Critical**: Cache hit rate <98%
- **Emergency**: System throughput <30,000 RPS

This integration plan ensures the 5-W entity extraction system seamlessly integrates with the existing Forecastin architecture while maintaining the validated performance metrics and architectural constraints.