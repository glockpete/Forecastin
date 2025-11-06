# RSS Ingestion Service Architecture - RSSHub-Inspired Patterns

## Overview

**Current Status: Critical Gap Identified** - The RSS pipeline is completely missing from the Forecastin platform, representing a critical gap in the geopolitical intelligence system. This architecture designs a high-performance RSS ingestion service with RSSHub-inspired patterns that integrates seamlessly with the existing infrastructure.

## Current Infrastructure Analysis

### ✅ Validated Performance Metrics (Existing System)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Ancestor Resolution** | <10ms | **1.25ms** (P95: 1.87ms) | ✅ **PASSED** |
| **Descendant Retrieval** | <50ms | **1.25ms** (P99: 17.29ms) | ✅ **PASSED** |
| **Throughput** | >10,000 RPS | **42,726 RPS** | ✅ **PASSED** |
| **Cache Hit Rate** | >90% | **99.2%** | ✅ **PASSED** |
| **WebSocket Serialization** | <2ms | **0.019ms** | ✅ **PASSED** |

### ✅ Existing Database Schema Ready
- [`migrations/004_rss_entity_extraction_schema.sql`](migrations/004_rss_entity_extraction_schema.sql:1) - Complete RSS schema with 5-W entity extraction
- **Tables**: `rss_articles`, `ingestion_jobs`, `entity_extractions`, `feature_flags`, `cache_data`
- **Indexes**: Optimized for performance with proper indexing strategy

### ✅ WebSocket Infrastructure Operational
- [`api/services/realtime_service.py`](api/services/realtime_service.py:1) - Real-time service with orjson serialization
- [`frontend/src/handlers/realtimeHandlers.ts`](frontend/src/handlers/realtimeHandlers.ts:1) - Sophisticated frontend handlers
- **Runtime URL Configuration**: [`frontend/src/config/env.ts`](frontend/src/config/env.ts:1) dynamically constructs WebSocket URLs

## Core Architecture Components

### 1. RSSHub-Inspired Route System

#### Route Configuration Pattern
```python
# RSS Route Configuration with CSS Selectors
RSS_ROUTES = {
    "geopolitical_news": {
        "sources": [
            "https://www.reuters.com/world/",
            "https://www.bbc.com/news/world",
            "https://apnews.com/hub/world-news"
        ],
        "selectors": {
            "title": "h1.article-title, h1.headline",
            "content": "div.article-body, div.story-content",
            "author": ".author-name, .byline",
            "published": "time.published, .timestamp",
            "geographic": ".location, .geo-tag"
        },
        "anti_crawler": {
            "user_agent": "Forecastin-Geopolitical-Bot/1.0",
            "delay": {"min": 2, "max": 5},
            "retry_strategy": "exponential_backoff"
        },
        "confidence_factors": {
            "source_reliability": 0.9,
            "content_structure": 0.8,
            "geographic_context": 0.7
        }
    },
    "diplomatic_reports": {
        "sources": [
            "https://www.state.gov/press-releases/",
            "https://www.un.org/press/en"
        ],
        "selectors": {
            "title": "h1.document-title",
            "content": "div.document-content",
            "author": ".issuing-office, .department",
            "published": "meta[property='article:published_time']",
            "recipients": ".recipient-countries, .target-audience"
        }
    }
}
```

#### Route Processor Architecture
```python
class RSSRouteProcessor:
    """RSSHub-inspired route processor with CSS selector extraction"""
    
    def __init__(self, cache_service: CacheService, realtime_service: RealtimeService):
        self.cache_service = cache_service
        self.realtime_service = realtime_service
        self.anti_crawler = AntiCrawlerManager()
        
    async def process_route(self, route_config: Dict, url: str) -> RSSArticle:
        """Process RSS route with CSS selector extraction"""
        
        # Anti-crawler delay and user agent rotation
        await self.anti_crawler.apply_delay(route_config)
        
        # Fetch content with exponential backoff
        content = await self._fetch_with_retry(url, route_config)
        
        # Extract using CSS selectors
        extracted_data = self._extract_with_selectors(content, route_config["selectors"])
        
        # Apply confidence scoring
        confidence_scores = self._calculate_confidence(extracted_data, route_config)
        
        return RSSArticle(
            url=url,
            title=extracted_data["title"],
            content=extracted_data["content"],
            published_at=extracted_data["published"],
            feed_source=route_config["name"],
            confidence_scores=confidence_scores
        )
```

### 2. Anti-Crawler Strategy with Exponential Backoff

#### Intelligent Crawler Management
```python
class AntiCrawlerManager:
    """Anti-crawler strategy with exponential backoff and user agent rotation"""
    
    def __init__(self):
        self.user_agents = [
            "Mozilla/5.0 (compatible; Forecastin-Bot/1.0; +https://forecastin.com/bot)",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)",
            "Forecastin-Geopolitical-Intelligence/1.0"
        ]
        self.domain_delays = {}  # Track delays per domain
        self.retry_history = {}  # Track retry attempts
        
    async def apply_delay(self, route_config: Dict) -> None:
        """Apply intelligent delay based on domain history"""
        domain = self._extract_domain(route_config["sources"][0])
        current_delay = self.domain_delays.get(domain, route_config["anti_crawler"]["delay"]["min"])
        
        # Exponential backoff based on recent failures
        if domain in self.retry_history and self.retry_history[domain] > 0:
            current_delay *= (2 ** self.retry_history[domain])
            current_delay = min(current_delay, route_config["anti_crawler"]["delay"]["max"])
        
        await asyncio.sleep(current_delay)
        
    def record_failure(self, domain: str) -> None:
        """Record crawling failure for exponential backoff"""
        self.retry_history[domain] = self.retry_history.get(domain, 0) + 1
        
    def record_success(self, domain: str) -> None:
        """Reset retry counter on successful crawl"""
        self.retry_history[domain] = 0
```

### 3. Four-Tier Cache Integration

#### RSS-Specific Cache Strategy
```python
class RSSCacheManager:
    """RSS-specific cache management integrated with existing 4-tier cache"""
    
    def __init__(self, cache_service: CacheService):
        self.cache_service = cache_service
        self.cache_keys = {
            "content_hash": "rss:content_hash:{hash}",
            "source_feed": "rss:source:{source}:latest",
            "entity_extraction": "rss:entity:{article_id}",
            "route_config": "rss:route:{route_name}"
        }
    
    async def cache_article_content(self, article: RSSArticle) -> str:
        """Cache article content with content hash deduplication"""
        content_hash = hashlib.sha256(article.content.encode()).hexdigest()
        cache_key = self.cache_keys["content_hash"].format(hash=content_hash)
        
        # L1/L2 cache with 24-hour TTL for RSS content
        await self.cache_service.set(
            cache_key, 
            article.model_dump(),
            ttl=86400,  # 24 hours
            invalidate_tiers=True
        )
        
        return content_hash
    
    async def get_cached_article(self, content_hash: str) -> Optional[RSSArticle]:
        """Retrieve cached article by content hash"""
        cache_key = self.cache_keys["content_hash"].format(hash=content_hash)
        cached_data = await self.cache_service.get(cache_key)
        
        if cached_data:
            return RSSArticle(**cached_data)
        return None
```

### 4. 5-W Entity Extraction Integration

#### RSS-Specific Entity Extraction
```python
class RSSEntityExtractor:
    """5-W entity extraction specialized for RSS content"""
    
    def __init__(self, hierarchy_resolver: OptimizedHierarchyResolver):
        self.hierarchy_resolver = hierarchy_resolver
        self.confidence_calibrator = ConfidenceCalibrator()
    
    async def extract_entities(self, article: RSSArticle) -> EntityExtraction:
        """Extract 5-W entities from RSS article with confidence scoring"""
        
        extraction_start = time.time()
        
        # Base model extraction
        base_entities = await self._extract_with_base_model(article.content)
        
        # Rule-based confidence calibration
        calibrated_entities = []
        for entity in base_entities:
            calibrated_confidence = self.confidence_calibrator.calibrate(
                entity, 
                article.confidence_scores
            )
            
            calibrated_entity = entity.copy()
            calibrated_entity.confidence_score = calibrated_confidence
            calibrated_entities.append(calibrated_entity)
        
        # Hierarchy integration for geographic entities
        entities_with_hierarchy = await self._integrate_with_hierarchy(calibrated_entities)
        
        extraction_time = time.time() - extraction_start
        
        return EntityExtraction(
            article_id=article.id,
            entities=entities_with_hierarchy,
            extraction_time_ms=int(extraction_time * 1000),
            overall_confidence=self._calculate_overall_confidence(calibrated_entities)
        )
    
    async def _integrate_with_hierarchy(self, entities: List[Entity]) -> List[Entity]:
        """Integrate entities with LTREE hierarchy for O(log n) performance"""
        integrated_entities = []
        
        for entity in entities:
            if entity.type == "where":  # Geographic entities
                hierarchy_node = self.hierarchy_resolver.get_hierarchy(entity.canonical_key)
                if hierarchy_node:
                    entity.metadata["hierarchy_path"] = hierarchy_node.path
                    entity.metadata["path_depth"] = hierarchy_node.path_depth
                    entity.confidence_score *= hierarchy_node.confidence_score
            
            integrated_entities.append(entity)
        
        return integrated_entities
```

### 5. Deduplication System with 0.8 Similarity Threshold

#### RSS-Specific Deduplication
```python
class RSSDeduplicator:
    """Deduplication system with 0.8 similarity threshold for RSS content"""
    
    SIMILARITY_THRESHOLD = 0.8
    
    def __init__(self):
        self.similarity_engine = SimilarityEngine()
        self.audit_trail = AuditTrailLogger()
    
    async def deduplicate_articles(self, articles: List[RSSArticle]) -> List[RSSArticle]:
        """Deduplicate RSS articles using content similarity"""
        unique_articles = []
        processed_hashes = set()
        
        for article in articles:
            content_hash = hashlib.sha256(article.content.encode()).hexdigest()
            
            if content_hash in processed_hashes:
                continue  # Exact duplicate
            
            # Check similarity with existing articles
            is_duplicate = False
            for existing_article in unique_articles:
                similarity = self.similarity_engine.calculate_similarity(
                    article.content, 
                    existing_article.content
                )
                
                if similarity >= self.SIMILARITY_THRESHOLD:
                    is_duplicate = True
                    self.audit_trail.log_deduplication(
                        article.id, 
                        existing_article.id, 
                        similarity
                    )
                    break
            
            if not is_duplicate:
                unique_articles.append(article)
                processed_hashes.add(content_hash)
        
        return unique_articles
    
    async def deduplicate_entities(self, entities: List[Entity]) -> List[Entity]:
        """Deduplicate entities across multiple RSS articles"""
        canonical_entities = {}
        
        for entity in entities:
            canonical_key = entity.canonical_key
            
            if canonical_key in canonical_entities:
                existing_entity = canonical_entities[canonical_key]
                
                # Merge entities, keeping higher confidence version
                if entity.confidence_score > existing_entity.confidence_score:
                    canonical_entities[canonical_key] = entity
                    self.audit_trail.log_entity_merge(existing_entity.id, entity.id)
            else:
                canonical_entities[canonical_key] = entity
        
        return list(canonical_entities.values())
```

### 6. WebSocket Real-Time Integration

#### RSS-Specific WebSocket Messages
```python
class RSSWebSocketIntegration:
    """WebSocket integration for real-time RSS updates"""
    
    def __init__(self, realtime_service: RealtimeService):
        self.realtime_service = realtime_service
    
    async def notify_article_ingestion(self, article: RSSArticle) -> None:
        """Notify clients of new RSS article ingestion"""
        message = {
            "type": "rss_article_ingested",
            "data": {
                "article_id": str(article.id),
                "title": article.title,
                "feed_source": article.feed_source,
                "published_at": article.published_at.isoformat(),
                "confidence_score": article.confidence_scores.overall,
                "entities_extracted": len(article.entities) if hasattr(article, 'entities') else 0
            },
            "timestamp": time.time()
        }
        
        await self.realtime_service.broadcast_message(message)
    
    async def notify_entity_extraction(self, extraction: EntityExtraction) -> None:
        """Notify clients of entity extraction completion"""
        message = {
            "type": "entity_extraction_completed",
            "data": {
                "extraction_id": str(extraction.id),
                "article_id": str(extraction.article_id),
                "entities_count": len(extraction.entities),
                "overall_confidence": extraction.overall_confidence,
                "extraction_time_ms": extraction.extraction_time_ms
            },
            "timestamp": time.time()
        }
        
        await self.realtime_service.broadcast_message(message)
    
    async def notify_ingestion_progress(self, job_id: str, progress: Dict) -> None:
        """Notify clients of ingestion job progress"""
        message = {
            "type": "ingestion_progress",
            "data": {
                "job_id": job_id,
                "progress": progress,
                "timestamp": time.time()
            }
        }
        
        await self.realtime_service.broadcast_message(message)
```

## Service Structure

### Core Service Architecture
```
api/services/rss/
├── rss_ingestion_service.py      # Main RSS ingestion service
├── route_processors/             # RSSHub-inspired route processors
│   ├── base_processor.py         # Base route processor
│   ├── geopolitical_processor.py # Geopolitical news processor
│   └── diplomatic_processor.py   # Diplomatic reports processor
├── anti_crawler/                 # Anti-crawler strategies
│   ├── manager.py                # Crawler management
│   └── strategies.py             # Different anti-crawler strategies
├── entity_extraction/            # 5-W entity extraction
│   ├── extractor.py              # Main extractor
│   ├── confidence_calibrator.py  # Confidence scoring
│   └── hierarchy_integrator.py   # LTREE hierarchy integration
├── deduplication/                # Deduplication system
│   ├── deduplicator.py           # Main deduplicator
│   ├── similarity_engine.py      # Similarity calculations
│   └── audit_trail.py            # Audit trail logging
└── websocket/                    # WebSocket integration
    ├── notifier.py               # Real-time notifications
    └── message_types.py          # RSS-specific message types
```

### Database Schema Extensions

#### Additional Tables for RSS Optimization
```sql
-- RSS Feed Sources Table
CREATE TABLE IF NOT EXISTS rss_feed_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2048) NOT NULL UNIQUE,
    route_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_checked TIMESTAMP WITH TIME ZONE,
    success_rate DECIMAL(5,4) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RSS Route Configurations Table
CREATE TABLE IF NOT EXISTS rss_route_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_name VARCHAR(255) UNIQUE NOT NULL,
    css_selectors JSONB NOT NULL,
    anti_crawler_config JSONB NOT NULL,
    confidence_factors JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Materialized View for RSS Performance
CREATE MATERIALIZED VIEW mv_rss_performance AS
SELECT 
    feed_source,
    COUNT(*) as total_articles,
    AVG(overall_confidence) as avg_confidence,
    AVG(extraction_time_ms) as avg_extraction_time,
    COUNT(DISTINCT entity_count) as unique_entities
FROM rss_articles ra
LEFT JOIN entity_extractions ee ON ra.id = ee.article_id
GROUP BY feed_source;
```

## Integration Points with Existing Infrastructure

### 1. LTREE Materialized Views Integration
```python
class RSSHierarchyIntegrator:
    """Integrate RSS entities with existing LTREE hierarchy"""
    
    def __init__(self, hierarchy_resolver: OptimizedHierarchyResolver):
        self.resolver = hierarchy_resolver
    
    async def integrate_geographic_entities(self, entities: List[Entity]) -> List[Entity]:
        """Integrate geographic entities with LTREE materialized views"""
        integrated_entities = []
        
        for entity in entities:
            if entity.type == "where":
                # Use O(log n) hierarchy resolution
                hierarchy_info = self.resolver.get_hierarchy(entity.canonical_key)
                
                if hierarchy_info:
                    entity.metadata.update({
                        "hierarchy_path": hierarchy_info.path,
                        "path_depth": hierarchy_info.path_depth,
                        "ancestors": hierarchy_info.ancestors,
                        "descendants": hierarchy_info.descendants
                    })
                    
                    # Boost confidence based on hierarchy consistency
                    entity.confidence_score *= hierarchy_info.confidence_score
            
            integrated_entities.append(entity)
        
        return integrated_entities
```

### 2. Four-Tier Cache Strategy Integration
```python
class RSSCacheCoordinator:
    """Coordinate RSS caching across all four tiers"""
    
    def __init__(self, cache_service: CacheService, hierarchy_resolver: OptimizedHierarchyResolver):
        self.cache_service = cache_service
        self.hierarchy_resolver = hierarchy_resolver
    
    async def cache_rss_article(self, article: RSSArticle) -> None:
        """Cache RSS article across L1-L4 tiers"""
        
        # L1: Memory cache with RLock
        memory_key = f"rss:article:{article.id}"
        self.cache_service._memory_cache.set(memory_key, article, ttl=3600)
        
        # L2: Redis cache with connection pooling
        redis_key = f"rss:article:{article.id}"
        await self.cache_service.set(redis_key, article.model_dump(), ttl=86400)
        
        # L3/L4: Database and materialized views (handled by DB layer)
        # These are automatically maintained by the database
```

### 3. WebSocket Serialization Integration
```python
class RSSWebSocketSerializer:
    """RSS-specific WebSocket serialization with orjson"""
    
    @staticmethod
    def serialize_rss_message(message: Dict) -> str:
        """Serialize RSS WebSocket message using orjson"""
        try:
            return orjson.dumps(message, option=orjson.OPT_NON_STR_KEYS).decode('utf-8')
        except Exception as e:
            logger.error(f"RSS WebSocket serialization error: {e}")
            # Fallback to safe serialization
            return safe_serialize_message(message)
```

## Performance Optimization Strategies

### 1. Batch Processing for High-Volume RSS
```python
class RSSBatchProcessor:
    """Batch processing for high-volume RSS ingestion"""
    
    BATCH_SIZE = 50
    PARALLEL_WORKERS = 4
    
    async def process_batch(self, urls: List[str]) -> List[RSSArticle]:
        """Process RSS URLs in parallel batches"""
        semaphore = asyncio.Semaphore(self.PARALLEL_WORKERS)
        
        async def process_single(url: str) -> RSSArticle:
            async with semaphore:
                return await self.process_single_url(url)
        
        # Process in batches to prevent overwhelming sources
        batches = [urls[i:i + self.BATCH_SIZE] for i in range(0, len(urls), self.BATCH_SIZE)]
        
        all_articles = []
        for batch in batches:
            batch_results = await asyncio.gather(
                *[process_single(url) for url in batch],
                return_exceptions=True
            )
            
            # Filter out exceptions
            successful_articles = [
                result for result in batch_results 
                if not isinstance(result, Exception)
            ]
            
            all_articles.extend(successful_articles)
            
            # Anti-crawler delay between batches
            await asyncio.sleep(2)
        
        return all_articles
```

### 2. Incremental RSS Processing
```python
class RSSIncrementalProcessor:
    """Incremental processing to avoid re-processing unchanged content"""
    
    def __init__(self, cache_service: CacheService):
        self.cache_service = cache_service
    
    async def process_incrementally(self, feed_url: str) -> List[RSSArticle]:
        """Process only new or updated RSS content"""
        
        # Get last processed state from cache
        last_state_key = f"rss:last_state:{hashlib.md5(feed_url.encode()).hexdigest()}"
        last_state = await self.cache_service.get(last_state_key)
        
        # Fetch current feed state
        current_state = await self.fetch_feed_state(feed_url)
        
        # Identify new or updated items
        new_items = self.identify_changes(last_state, current_state)
        
        # Process only changed items
        new_articles = await self.process_items(new_items)
        
        # Update last state
        await self.cache_service.set(last_state_key, current_state, ttl=86400)
        
        return new_articles
```

## Deployment and Rollout Plan

### Feature Flags for Gradual Rollout
```sql
-- Additional RSS-specific feature flags
INSERT INTO feature_flags (flag_name, flag_value, fallback_value, description) VALUES
('rss_ingestion_v1', false, false, 'Enable RSS ingestion service V1'),
('rss_route_processing', false, false, 'Enable RSSHub-inspired route processing'),
('rss_anti_crawler', false, false, 'Enable anti-crawler strategies'),
('rss_entity_extraction', false, false, 'Enable 5-W entity extraction from RSS'),
('rss_deduplication', false, false, 'Enable RSS content deduplication'),
('rss_websocket_notifications', false, false, 'Enable real-time RSS notifications')
ON CONFLICT (flag_name) DO NOTHING;
```

### Rollout Strategy
1. **Phase 1 (10%)**: Basic RSS ingestion with simple route processing
2. **Phase 2 (25%)**: Anti-crawler strategies and exponential backoff
3. **Phase 3 (50%)**: 5-W entity extraction with confidence scoring
4. **Phase 4 (75%)**: Deduplication system with 0.8 similarity threshold
5. **Phase 5 (100%)**: Full WebSocket real-time integration

### Rollback Procedure
1. Disable RSS feature flags (`rss_ingestion_v1`, etc.)
2. Clear RSS-specific cache layers
3. Run database migration rollback scripts
4. Validate system stability without RSS ingestion

## Performance Targets

### RSS-Specific SLOs
| Metric | Target | Integration Point |
|--------|--------|-------------------|
| **RSS Ingestion Latency** | <100ms | Anti-crawler delay + processing |
| **Entity Extraction** | <50ms | 5-W framework integration |
| **Deduplication** | <20ms | Similarity threshold optimization |
| **WebSocket Notification** | <5ms | orjson serialization |
| **Cache Hit Rate** | >95% | Four-tier cache integration |

### Validation Against Existing Performance
- **Leverages**: Existing 42,726 RPS throughput capability
- **Maintains**: 99.2% cache hit rate with RSS-specific caching
- **Integrates**: O(log n) hierarchy resolution for geographic entities
- **Utilizes**: 0.019ms WebSocket serialization for real-time updates

## Compliance and Monitoring

### Automated Evidence Collection
```python
# RSS-specific compliance monitoring
class RSSComplianceMonitor:
    """Monitor RSS ingestion for compliance requirements"""
    
    async def collect_evidence(self) -> Dict:
        """Collect RSS ingestion evidence for compliance"""
        return {
            "rss_ingestion_metrics": await self.get_ingestion_metrics(),
            "entity_extraction_quality": await self.get_extraction_quality(),
            "anti_crawler_compliance": await self.get_crawler_compliance(),
            "data_privacy_audit": await self.get_privacy_audit()
        }
```

### Performance Monitoring Integration
- **Existing LayerRegistry**: Extend with RSS-specific metrics
- **WebSocket Performance**: Monitor RSS notification latency
- **Cache Efficiency**: Track RSS-specific cache hit rates
- **Entity Extraction**: Monitor 5-W extraction performance

## Critical Implementation Files

### New Service Files
- [`api/services/rss/rss_ingestion_service.py`](api/services/rss/rss_ingestion_service.py:1) - Main RSS service
- [`api/services/rss/route_processors/base_processor.py`](api/services/rss/route_processors/base_processor.py:1) - Route processor base
- [`api/services/rss/anti_crawler/manager.py`](api/services/rss/anti_crawler/manager.py:1) - Anti-crawler management

### Integration Files
- [`api/services/rss/entity_extraction/extractor.py`](api/services/rss/entity_extraction/extractor.py:1) - 5-W entity extraction
- [`api/services/rss/deduplication/deduplicator.py`](api/services/rss/deduplication/deduplicator.py:1) - Deduplication system
- [`api/services/rss/websocket/notifier.py`](api/services/rss/websocket/notifier.py:1) - WebSocket integration

### Database Migrations
- [`migrations/005_rss_route_configurations.sql`](migrations/005_rss_route_configurations.sql:1) - Route configuration tables
- [`migrations/006_rss_performance_optimization.sql`](migrations/006_rss_performance_optimization.sql:1) - Performance optimizations

## Conclusion

This RSS ingestion service architecture leverages the existing Forecastin infrastructure's validated performance capabilities while introducing RSSHub-inspired patterns for geopolitical intelligence. The design addresses the critical gap in the current system while maintaining the high-performance standards established by the existing LTREE hierarchy, four-tier caching, and WebSocket infrastructure.

The architecture specifically incorporates the non-obvious patterns from AGENTS.md, including RLock synchronization, orjson serialization, materialized view refresh requirements, and the multi-factor confidence scoring system that would surprise experienced developers accustomed to traditional RSS ingestion approaches.