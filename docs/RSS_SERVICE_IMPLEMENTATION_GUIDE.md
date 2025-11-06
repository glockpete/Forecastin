# RSS Service Implementation Guide - Complete Component Specifications

## Overview

This document provides detailed specifications for implementing the remaining RSS ingestion service components that integrate with the existing Forecastin infrastructure. All components follow the AGENTS.md patterns for performance, reliability, and non-obvious architectural requirements.

## Component Architecture Summary

### ✅ Completed Components
1. **Main Service**: [`api/services/rss/rss_ingestion_service.py`](api/services/rss/rss_ingestion_service.py:1) - Core orchestration
2. **Route Processor**: [`api/services/rss/route_processors/base_processor.py`](api/services/rss/route_processors/base_processor.py:1) - RSSHub-inspired CSS extraction
3. **Anti-Crawler Manager**: [`api/services/rss/anti_crawler/manager.py`](api/services/rss/anti_crawler/manager.py:1) - Exponential backoff strategies

### 🔄 Remaining Implementation Components

## 1. Entity Extraction Component - 5-W Framework Integration

### File: `api/services/rss/entity_extraction/extractor.py`

#### Core Architecture
```python
class RSSEntityExtractor:
    """
    5-W entity extraction specialized for RSS content with LTREE integration
    
    Critical AGENTS.md patterns:
    - Rule-based confidence calibration (not just model confidence)
    - 0.8 similarity threshold with canonical_key assignment
    - O(log n) hierarchy integration via materialized views
    """
    
    def __init__(self, hierarchy_resolver: OptimizedHierarchyResolver):
        self.hierarchy_resolver = hierarchy_resolver  # Use existing LTREE resolver
        self.confidence_calibrator = ConfidenceCalibrator()
        self.entity_cache = {}  # L1 cache with RLock
        
    async def extract_entities(self, article: RSSArticle) -> EntityExtraction:
        """Extract 5-W entities with multi-factor confidence scoring"""
        
        # Base model extraction (simplified for architecture)
        base_entities = await self._extract_with_base_model(article.content)
        
        # CRITICAL: Rule-based confidence calibration (not just model confidence)
        calibrated_entities = []
        for entity in base_entities:
            calibrated_confidence = self.confidence_calibrator.calibrate(
                entity, 
                article.confidence_scores
            )
            entity.confidence_score = calibrated_confidence
            calibrated_entities.append(entity)
        
        # Integrate with LTREE hierarchy for O(log n) performance
        entities_with_hierarchy = await self._integrate_with_hierarchy(calibrated_entities)
        
        return EntityExtraction(
            article_id=article.id,
            entities=entities_with_hierarchy,
            overall_confidence=self._calculate_overall_confidence(calibrated_entities)
        )
```

#### Integration with Existing Infrastructure

##### LTREE Hierarchy Integration
```python
async def _integrate_with_hierarchy(self, entities: List[Entity]) -> List[Entity]:
    """
    CRITICAL: Use existing optimized_hierarchy_resolver for O(log n) performance
    Must manually refresh materialized views when needed
    """
    for entity in entities:
        if entity.type == "where":  # Geographic entities
            # Use existing LTREE resolver - maintains 1.25ms performance
            hierarchy_node = self.hierarchy_resolver.get_hierarchy(entity.canonical_key)
            
            if hierarchy_node:
                entity.metadata.update({
                    "hierarchy_path": hierarchy_node.path,
                    "path_depth": hierarchy_node.path_depth,
                    "ancestors": hierarchy_node.ancestors,
                    "descendants": hierarchy_node.descendants
                })
                
                # Boost confidence based on hierarchy consistency
                entity.confidence_score *= hierarchy_node.confidence_score
                
                # GOTCHA: Must trigger materialized view refresh if new entities
                if entity.is_new_geographic_entity:
                    await self._schedule_hierarchy_refresh()
    
    return entities

async def _schedule_hierarchy_refresh(self):
    """CRITICAL: Materialized views require manual refresh"""
    # Schedule refresh of hierarchy materialized views
    asyncio.create_task(
        self.hierarchy_resolver.refresh_materialized_view("mv_entity_ancestors")
    )
```

## 2. Deduplication System - 0.8 Similarity Threshold

### File: `api/services/rss/deduplication/deduplicator.py`

#### Core Deduplication Logic
```python
class RSSDeduplicator:
    """
    Deduplication system following AGENTS.md patterns:
    - 0.8 similarity threshold (non-negotiable)
    - canonical_key assignment with SHA-256
    - audit_trail logging for all merges
    """
    
    SIMILARITY_THRESHOLD = 0.8  # From AGENTS.md requirements
    
    async def deduplicate_articles(self, articles: List[RSSArticle]) -> List[RSSArticle]:
        """Deduplicate using 0.8 similarity threshold"""
        
        unique_articles = []
        processed_hashes = set()
        
        for article in articles:
            # CRITICAL: Use content hash for exact duplicate detection
            content_hash = hashlib.sha256(article.content.encode()).hexdigest()
            
            if content_hash in processed_hashes:
                continue  # Exact duplicate
            
            # Check similarity with existing articles (0.8 threshold)
            is_duplicate = False
            for existing_article in unique_articles:
                similarity = await self._calculate_similarity(
                    article.content, 
                    existing_article.content
                )
                
                if similarity >= self.SIMILARITY_THRESHOLD:
                    is_duplicate = True
                    
                    # CRITICAL: Log to audit_trail as specified in AGENTS.md
                    await self._log_deduplication(article.id, existing_article.id, similarity)
                    break
            
            if not is_duplicate:
                unique_articles.append(article)
                processed_hashes.add(content_hash)
        
        return unique_articles
    
    async def _calculate_similarity(self, content1: str, content2: str) -> float:
        """Calculate content similarity using cosine similarity"""
        # Implementation would use TF-IDF or sentence embeddings
        # This is architectural specification
        pass
    
    async def _log_deduplication(self, duplicate_id: str, canonical_id: str, similarity: float):
        """CRITICAL: Audit trail logging as required by AGENTS.md"""
        audit_entry = {
            "event_type": "deduplication",
            "duplicate_article_id": duplicate_id,
            "canonical_article_id": canonical_id,
            "similarity_score": similarity,
            "threshold_used": self.SIMILARITY_THRESHOLD,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Store in audit_trail table/cache
        await self._store_audit_entry(audit_entry)
```

## 3. WebSocket Integration - Real-Time Notifications

### File: `api/services/rss/websocket/notifier.py`

#### WebSocket Integration with orjson Serialization
```python
class RSSWebSocketNotifier:
    """
    CRITICAL: Must use orjson serialization patterns from AGENTS.md
    Standard json.dumps crashes on datetime/dataclass objects
    """
    
    def __init__(self, realtime_service: RealtimeService):
        self.realtime_service = realtime_service
    
    async def notify_article_ingested(self, article: RSSArticle):
        """Notify clients of new RSS article with safe serialization"""
        
        message = {
            "type": "rss_article_ingested",
            "data": {
                "article_id": str(article.id),
                "title": article.title,
                "feed_source": article.feed_source,
                "published_at": article.published_at,  # datetime object
                "confidence_score": article.confidence_scores.get("overall", 0.0),
                "entities_extracted": len(article.entities) if hasattr(article, 'entities') else 0
            },
            "timestamp": time.time()
        }
        
        # CRITICAL: Use safe_serialize_message to prevent WebSocket crashes
        try:
            serialized = safe_serialize_message(message)
            await self.realtime_service.broadcast_message(message)
        except Exception as e:
            logger.error(f"RSS WebSocket serialization failed: {e}")
            # Send fallback message without problematic fields
            fallback_message = {
                "type": "rss_notification_error",
                "error": "Serialization failed",
                "article_id": str(article.id)
            }
            await self.realtime_service.broadcast_message(fallback_message)
    
    async def notify_entity_extraction_summary(self, entities: List[Entity], job_id: str):
        """Notify entity extraction completion"""
        
        # Group entities by 5-W type
        entity_summary = {
            "who": len([e for e in entities if e.type == "who"]),
            "what": len([e for e in entities if e.type == "what"]),
            "where": len([e for e in entities if e.type == "where"]),
            "when": len([e for e in entities if e.type == "when"]),
            "why": len([e for e in entities if e.type == "why"])
        }
        
        message = {
            "type": "entity_extraction_summary",
            "data": {
                "job_id": job_id,
                "entity_summary": entity_summary,
                "total_entities": len(entities),
                "avg_confidence": sum(e.confidence_score for e in entities) / len(entities) if entities else 0.0
            },
            "timestamp": time.time()
        }
        
        await self.realtime_service.broadcast_message(message)
```

## 4. Four-Tier Cache Integration

### Cache Strategy Implementation
```python
class RSSCacheCoordinator:
    """
    CRITICAL: Must follow AGENTS.md four-tier caching patterns:
    - L1: Thread-safe LRU with RLock (not standard Lock)
    - L2: Redis with connection pooling and exponential backoff
    - L3: PostgreSQL buffer cache + materialized views
    - L4: Materialized views as persistent cache layer
    """
    
    def __init__(self, cache_service: CacheService, hierarchy_resolver: OptimizedHierarchyResolver):
        self.cache_service = cache_service  # Already implements L1/L2
        self.hierarchy_resolver = hierarchy_resolver  # Handles L3/L4
    
    async def cache_rss_article(self, article: RSSArticle):
        """Cache across all four tiers"""
        
        # L1: Memory cache with RLock (handled by cache_service)
        memory_key = f"rss:article:{article.id}"
        await self.cache_service.set(memory_key, article.model_dump(), ttl=3600)
        
        # L2: Redis cache with connection pooling (handled by cache_service)
        # Exponential backoff retry already implemented
        
        # L3/L4: Database and materialized views
        # GOTCHA: Materialized views need manual refresh after entity changes
        if article.entities and any(e.type == "where" for e in article.entities):
            # Schedule materialized view refresh for geographic entities
            asyncio.create_task(
                self.hierarchy_resolver.refresh_materialized_view("mv_entity_ancestors")
            )
    
    async def invalidate_rss_cache(self, article_id: str):
        """Invalidate across all cache tiers"""
        
        # L1/L2: Use existing cache invalidation
        await self.cache_service.delete(f"rss:article:{article_id}")
        
        # L3/L4: Clear database cache (handled by connection pool)
        # Materialized view refresh will update L4
```

## 5. Performance Optimization Strategies

### Batch Processing Implementation
```python
class RSSBatchProcessor:
    """
    Maintains existing performance targets:
    - Throughput: 42,726 RPS (must not degrade)
    - Cache hit rate: 99.2% (must maintain)
    - Ancestor resolution: 1.25ms (use existing LTREE)
    """
    
    BATCH_SIZE = 50  # Optimal for current infrastructure
    PARALLEL_WORKERS = 4  # Matches existing connection pools
    
    async def process_batch(self, urls: List[str]) -> List[RSSArticle]:
        """Process with semaphore to prevent overwhelming existing infrastructure"""
        
        # CRITICAL: Use semaphore to respect existing connection pool limits
        semaphore = asyncio.Semaphore(self.PARALLEL_WORKERS)
        
        async def process_single(url: str) -> RSSArticle:
            async with semaphore:
                # Leverage existing 99.2% cache hit rate
                return await self.process_single_url(url)
        
        # Process in batches to maintain performance targets
        batches = [urls[i:i + self.BATCH_SIZE] for i in range(0, len(urls), self.BATCH_SIZE)]
        
        all_articles = []
        for batch in batches:
            batch_results = await asyncio.gather(
                *[process_single(url) for url in batch],
                return_exceptions=True
            )
            
            # Filter successful results
            successful_articles = [
                result for result in batch_results 
                if not isinstance(result, Exception)
            ]
            
            all_articles.extend(successful_articles)
            
            # Maintain anti-crawler delays
            await asyncio.sleep(2)
        
        return all_articles
```

## 6. Feature Flag Rollout Strategy

### Gradual Rollout Implementation
```sql
-- Additional RSS-specific feature flags following AGENTS.md patterns
INSERT INTO feature_flags (flag_name, flag_value, fallback_value, description) VALUES
('rss_ingestion_v1', false, false, 'Enable RSS ingestion service V1'),
('rss_route_processing', false, false, 'Enable RSSHub-inspired route processing'),
('rss_anti_crawler', false, false, 'Enable anti-crawler strategies'),
('rss_entity_extraction', false, false, 'Enable 5-W entity extraction from RSS'),
('rss_deduplication', false, false, 'Enable RSS content deduplication'),
('rss_websocket_notifications', false, false, 'Enable real-time RSS notifications')
ON CONFLICT (flag_name) DO NOTHING;
```

### Rollout Phases
1. **Phase 1 (10%)**: Basic RSS ingestion with route processing
   - Enable: `rss_ingestion_v1`, `rss_route_processing`
   - Monitor: Basic ingestion performance, cache integration

2. **Phase 2 (25%)**: Add anti-crawler strategies
   - Enable: `rss_anti_crawler`
   - Monitor: Crawling success rates, domain blacklist rates

3. **Phase 3 (50%)**: Enable entity extraction
   - Enable: `rss_entity_extraction`
   - Monitor: 5-W extraction performance, hierarchy integration

4. **Phase 4 (75%)**: Add deduplication
   - Enable: `rss_deduplication`
   - Monitor: Similarity threshold effectiveness, duplicate detection

5. **Phase 5 (100%)**: Full WebSocket integration
   - Enable: `rss_websocket_notifications`
   - Monitor: Real-time notification latency, orjson serialization

### Rollback Procedure (AGENTS.md Pattern)
```python
async def rollback_rss_service():
    """Rollback procedure following AGENTS.md: flag off first, then DB rollback"""
    
    # 1. Disable feature flags first
    await disable_feature_flags([
        'rss_ingestion_v1',
        'rss_route_processing',
        'rss_anti_crawler',
        'rss_entity_extraction',
        'rss_deduplication',
        'rss_websocket_notifications'
    ])
    
    # 2. Clear RSS-specific cache layers
    await cache_service.clear_pattern('rss:*')
    
    # 3. Run database migration rollback scripts
    await run_migration_rollback('005_rss_route_configurations')
    
    # 4. Validate system stability
    health_status = await perform_system_health_check()
    
    return health_status['status'] == 'healthy'
```

## 7. Monitoring and Compliance Integration

### Performance Monitoring
```python
class RSSPerformanceMonitor:
    """
    Integration with existing compliance framework
    Following AGENTS.md automated evidence collection patterns
    """
    
    async def collect_rss_evidence(self) -> Dict:
        """Automated evidence collection for compliance"""
        
        return {
            "rss_performance_metrics": {
                "ingestion_latency_p95": await self.measure_ingestion_latency(),
                "entity_extraction_latency": await self.measure_entity_extraction(),
                "cache_hit_rate": await self.get_rss_cache_metrics(),
                "websocket_notification_latency": await self.measure_notification_latency()
            },
            "rss_quality_metrics": {
                "deduplication_effectiveness": await self.measure_deduplication_rate(),
                "entity_confidence_distribution": await self.get_confidence_stats(),
                "anti_crawler_success_rate": await self.get_crawler_stats()
            },
            "rss_integration_health": {
                "ltree_hierarchy_integration": await self.verify_hierarchy_integration(),
                "four_tier_cache_coordination": await self.verify_cache_coordination(),
                "websocket_serialization_health": await self.verify_websocket_health()
            }
        }
```

## 8. Critical Integration Points

### Database Schema Extensions
```sql
-- RSS Performance Materialized View (L4 Cache)
CREATE MATERIALIZED VIEW mv_rss_performance AS
SELECT 
    feed_source,
    COUNT(*) as total_articles,
    AVG(overall_confidence) as avg_confidence,
    AVG(extraction_time_ms) as avg_extraction_time,
    COUNT(DISTINCT entity_count) as unique_entities,
    -- Integration with existing LTREE hierarchy
    COUNT(DISTINCT e.path) as geographic_entities_count
FROM rss_articles ra
LEFT JOIN entity_extractions ee ON ra.id = ee.article_id
LEFT JOIN entities e ON ee.entity_id = e.entity_id
WHERE e.metadata->>'type' = 'where'
GROUP BY feed_source;

-- CRITICAL: Manual refresh trigger
CREATE OR REPLACE FUNCTION refresh_rss_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rss_performance;
    -- Coordinate with existing hierarchy refresh
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;
END;
$$ LANGUAGE plpgsql;
```

### WebSocket Message Types Integration
```typescript
// Frontend integration with existing realtimeHandlers.ts
interface RSSWebSocketMessage {
    type: 'rss_article_ingested' | 'entity_extraction_summary' | 'rss_notification_error';
    data: {
        article_id: string;
        title?: string;
        feed_source?: string;
        published_at?: string;  // ISO string to avoid datetime serialization issues
        confidence_score?: number;
        entities_extracted?: number;
        entity_summary?: Record<string, number>;
    };
    timestamp: number;
}

// Integration with existing message routing
export const routeRSSMessage = async (
    processor: RealtimeMessageProcessor,
    message: RSSWebSocketMessage
): Promise<void> => {
    switch (message.type) {
        case 'rss_article_ingested':
            await processor.processRSSArticleUpdate(message);
            break;
        case 'entity_extraction_summary':
            await processor.processEntityExtractionSummary(message);
            break;
        // ... other cases
    }
};
```

## Conclusion

This RSS ingestion service architecture fully integrates with the existing Forecastin infrastructure while implementing RSSHub-inspired patterns. The design specifically addresses the non-obvious patterns from AGENTS.md that would surprise experienced developers:

1. **Thread-safe LRU cache with RLock** (not standard Lock)
2. **Manual materialized view refresh** requirement
3. **orjson serialization** for WebSocket datetime handling
4. **Rule-based confidence calibration** beyond model confidence
5. **0.8 similarity threshold** with audit trail logging
6. **O(log n) hierarchy performance** via existing LTREE resolver

The phased rollout strategy ensures gradual integration while maintaining the validated performance metrics of 42,726 RPS throughput and 99.2% cache hit rate.