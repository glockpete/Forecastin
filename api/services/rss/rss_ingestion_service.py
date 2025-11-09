"""
RSS Ingestion Service with RSSHub-Inspired Patterns

Main RSS ingestion service that integrates with existing Forecastin infrastructure:
- Four-tier caching strategy with RLock synchronization
- WebSocket real-time notifications with orjson serialization
- 5-W entity extraction with confidence scoring
- Anti-crawler strategies with exponential backoff

Following the patterns specified in AGENTS.md and RSS_INGESTION_SERVICE_ARCHITECTURE.md
"""

import asyncio
import hashlib
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from navigation_api.database.optimized_hierarchy_resolver import (
    OptimizedHierarchyResolver,
)
from services.cache_service import CacheService
from services.realtime_service import RealtimeService

from .anti_crawler.manager import AntiCrawlerManager
from .deduplication.deduplicator import RSSDeduplicator
from .entity_extraction.extractor import RSSEntityExtractor
from .route_processors.base_processor import RSSRouteProcessor
from .websocket.notifier import RSSWebSocketNotifier

logger = logging.getLogger(__name__)


@dataclass
class RSSIngestionConfig:
    """Configuration for RSS ingestion service"""

    # Performance settings
    batch_size: int = 50
    parallel_workers: int = 4
    max_retries: int = 3
    default_ttl: int = 86400  # 24 hours

    # Anti-crawler settings
    min_delay: float = 2.0
    max_delay: float = 10.0
    user_agent_rotation: bool = True

    # Feature flags
    enable_entity_extraction: bool = True
    enable_deduplication: bool = True
    enable_websocket_notifications: bool = True


@dataclass
class RSSIngestionMetrics:
    """Performance metrics for RSS ingestion"""

    articles_processed: int = 0
    entities_extracted: int = 0
    duplicates_removed: int = 0
    total_processing_time: float = 0.0
    cache_hits: int = 0
    cache_misses: int = 0
    websocket_notifications_sent: int = 0

    @property
    def avg_processing_time(self) -> float:
        return self.total_processing_time / max(self.articles_processed, 1)

    @property
    def cache_hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        return self.cache_hits / total if total > 0 else 0.0


class RSSIngestionService:
    """
    Main RSS ingestion service with RSSHub-inspired patterns
    
    This service implements the complete RSS ingestion pipeline:
    1. Route-based content extraction with CSS selectors
    2. Anti-crawler strategies with exponential backoff
    3. Four-tier cache integration
    4. 5-W entity extraction with confidence scoring
    5. Deduplication with 0.8 similarity threshold
    6. WebSocket real-time notifications
    """

    def __init__(
        self,
        cache_service: CacheService,
        realtime_service: RealtimeService,
        hierarchy_resolver: OptimizedHierarchyResolver,
        config: Optional[RSSIngestionConfig] = None
    ):
        """
        Initialize RSS ingestion service
        
        Args:
            cache_service: Existing cache service with four-tier strategy
            realtime_service: WebSocket real-time service
            hierarchy_resolver: LTREE hierarchy resolver for O(log n) performance
            config: Optional configuration override
        """
        self.cache_service = cache_service
        self.realtime_service = realtime_service
        self.hierarchy_resolver = hierarchy_resolver
        self.config = config or RSSIngestionConfig()

        # Initialize component services
        self.route_processor = RSSRouteProcessor(cache_service, realtime_service)
        self.anti_crawler = AntiCrawlerManager()
        self.entity_extractor = RSSEntityExtractor(hierarchy_resolver)
        self.deduplicator = RSSDeduplicator()
        self.websocket_notifier = RSSWebSocketNotifier(realtime_service)

        # Performance metrics
        self.metrics = RSSIngestionMetrics()

        # Ingestion job tracking
        self.active_jobs: Dict[str, Dict] = {}

        logger.info("RSS ingestion service initialized with RSSHub-inspired patterns")

    async def ingest_rss_feed(
        self,
        feed_url: str,
        route_config: Dict,
        job_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Ingest RSS feed with complete processing pipeline
        
        Args:
            feed_url: RSS feed URL to ingest
            route_config: RSSHub-inspired route configuration
            job_id: Optional job ID for tracking
            
        Returns:
            Ingestion results with metrics and extracted entities
        """
        job_id = job_id or str(uuid.uuid4())
        start_time = time.time()

        try:
            # Track job progress
            self.active_jobs[job_id] = {
                "status": "processing",
                "started_at": datetime.utcnow(),
                "feed_url": feed_url
            }

            # Notify start of ingestion
            if self.config.enable_websocket_notifications:
                await self.websocket_notifier.notify_ingestion_start(job_id, feed_url)

            # Step 1: Fetch and parse RSS feed
            logger.info(f"Starting RSS ingestion for {feed_url} (job: {job_id})")
            articles = await self._fetch_rss_feed(feed_url, route_config, job_id)

            if not articles:
                logger.warning(f"No articles found in RSS feed: {feed_url}")
                return await self._complete_job(job_id, {"error": "No articles found"})

            # Step 2: Apply anti-crawler strategies
            articles = await self._apply_anti_crawler(articles, route_config)

            # Step 3: Process articles through route pipeline
            processed_articles = await self._process_articles(articles, route_config, job_id)

            # Step 4: Entity extraction (if enabled)
            entities = []
            if self.config.enable_entity_extraction:
                entities = await self._extract_entities(processed_articles, job_id)

            # Step 5: Deduplication (if enabled)
            if self.config.enable_deduplication:
                processed_articles = await self.deduplicator.deduplicate_articles(processed_articles)
                self.metrics.duplicates_removed = len(articles) - len(processed_articles)

            # Step 6: Cache results
            await self._cache_results(processed_articles, entities)

            # Step 7: Send real-time notifications
            if self.config.enable_websocket_notifications:
                await self._send_notifications(processed_articles, entities, job_id)

            # Calculate metrics
            processing_time = time.time() - start_time
            self.metrics.total_processing_time += processing_time
            self.metrics.articles_processed += len(processed_articles)

            # Complete job
            results = await self._complete_job(job_id, {
                "articles_processed": len(processed_articles),
                "entities_extracted": len(entities),
                "processing_time_seconds": processing_time,
                "cache_hit_rate": self.metrics.cache_hit_rate,
                "articles": [article.model_dump() for article in processed_articles],
                "entities": [entity.model_dump() for entity in entities]
            })

            logger.info(
                f"RSS ingestion completed for {feed_url}: "
                f"{len(processed_articles)} articles, "
                f"{len(entities)} entities, "
                f"{processing_time:.2f}s"
            )

            return results

        except Exception as e:
            logger.error(f"RSS ingestion failed for {feed_url}: {e}")
            await self._fail_job(job_id, str(e))
            raise

    async def ingest_multiple_feeds(
        self,
        feed_configs: List[Dict],
        parallel: bool = True
    ) -> Dict[str, Any]:
        """
        Ingest multiple RSS feeds in parallel or sequentially
        
        Args:
            feed_configs: List of feed configurations
            parallel: Whether to process feeds in parallel
            
        Returns:
            Aggregate results from all feeds
        """
        start_time = time.time()
        job_id = str(uuid.uuid4())

        try:
            # Notify start of batch ingestion
            if self.config.enable_websocket_notifications:
                await self.websocket_notifier.notify_batch_start(job_id, len(feed_configs))

            if parallel:
                # Process feeds in parallel with semaphore
                semaphore = asyncio.Semaphore(self.config.parallel_workers)

                async def process_single_feed(feed_config: Dict) -> Dict:
                    async with semaphore:
                        return await self.ingest_rss_feed(
                            feed_config["url"],
                            feed_config["route_config"],
                            f"{job_id}_{hashlib.md5(feed_config['url'].encode()).hexdigest()[:8]}"
                        )

                # Process all feeds in parallel batches
                tasks = [process_single_feed(config) for config in feed_configs]
                results = await asyncio.gather(*tasks, return_exceptions=True)

            else:
                # Process feeds sequentially
                results = []
                for config in feed_configs:
                    try:
                        result = await self.ingest_rss_feed(
                            config["url"],
                            config["route_config"],
                            f"{job_id}_{hashlib.md5(config['url'].encode()).hexdigest()[:8]}"
                        )
                        results.append(result)
                    except Exception as e:
                        logger.error(f"Failed to process feed {config['url']}: {e}")
                        results.append({"error": str(e)})

            # Aggregate results
            total_articles = sum(r.get("articles_processed", 0) for r in results if isinstance(r, dict))
            total_entities = sum(r.get("entities_extracted", 0) for r in results if isinstance(r, dict))
            total_time = time.time() - start_time

            aggregate_results = {
                "job_id": job_id,
                "total_feeds_processed": len([r for r in results if isinstance(r, dict) and "error" not in r]),
                "total_articles_processed": total_articles,
                "total_entities_extracted": total_entities,
                "total_processing_time_seconds": total_time,
                "feed_results": results
            }

            # Notify completion
            if self.config.enable_websocket_notifications:
                await self.websocket_notifier.notify_batch_complete(job_id, aggregate_results)

            return aggregate_results

        except Exception as e:
            logger.error(f"Batch RSS ingestion failed: {e}")
            await self._fail_job(job_id, str(e))
            raise

    async def _fetch_rss_feed(
        self,
        feed_url: str,
        route_config: Dict,
        job_id: str
    ) -> List[Any]:
        """Fetch and parse RSS feed content"""

        # Check cache first
        cache_key = f"rss:feed:{hashlib.md5(feed_url.encode()).hexdigest()}"
        cached_articles = await self.cache_service.get(cache_key)

        if cached_articles:
            self.metrics.cache_hits += 1
            logger.debug(f"Cache hit for RSS feed: {feed_url}")
            return cached_articles

        self.metrics.cache_misses += 1

        # Fetch from source with retry logic
        for attempt in range(self.config.max_retries):
            try:
                articles = await self.route_processor.process_feed(feed_url, route_config)

                # Cache successful fetch
                await self.cache_service.set(cache_key, articles, ttl=self.config.default_ttl)

                # Update job progress
                await self._update_job_progress(job_id, "fetching", len(articles))

                return articles

            except Exception as e:
                if attempt == self.config.max_retries - 1:
                    raise

                # Exponential backoff
                delay = self.config.min_delay * (2 ** attempt)
                logger.warning(f"RSS fetch failed (attempt {attempt + 1}), retrying in {delay}s: {e}")
                await asyncio.sleep(delay)

    async def _apply_anti_crawler(
        self,
        articles: List[Any],
        route_config: Dict
    ) -> List[Any]:
        """Apply anti-crawler strategies to articles"""

        processed_articles = []

        for article in articles:
            # Apply domain-specific delay
            domain = self._extract_domain(article.url)
            await self.anti_crawler.apply_delay(domain, route_config)

            # Rotate user agent if configured
            if self.config.user_agent_rotation:
                await self.anti_crawler.rotate_user_agent(route_config)

            processed_articles.append(article)

        return processed_articles

    async def _process_articles(
        self,
        articles: List[Any],
        route_config: Dict,
        job_id: str
    ) -> List[Any]:
        """Process articles through route pipeline"""

        processed_articles = []
        batch_size = self.config.batch_size

        # Process in batches to manage memory and performance
        for i in range(0, len(articles), batch_size):
            batch = articles[i:i + batch_size]

            # Process batch in parallel
            batch_tasks = [
                self.route_processor.process_article(article, route_config)
                for article in batch
            ]

            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            # Filter successful results
            for result in batch_results:
                if not isinstance(result, Exception):
                    processed_articles.append(result)

            # Update job progress
            progress = min((i + len(batch)) / len(articles) * 100, 100)
            await self._update_job_progress(job_id, "processing", progress)

            # Anti-crawler delay between batches
            await asyncio.sleep(self.config.min_delay)

        return processed_articles

    async def _extract_entities(
        self,
        articles: List[Any],
        job_id: str
    ) -> List[Any]:
        """Extract 5-W entities from articles"""

        entities = []

        for article in articles:
            try:
                article_entities = await self.entity_extractor.extract_entities(article)
                entities.extend(article_entities)

                # Update job progress for entity extraction
                await self._update_job_progress(
                    job_id,
                    "entity_extraction",
                    f"Extracted {len(article_entities)} entities from {article.title}"
                )

            except Exception as e:
                logger.warning(f"Entity extraction failed for article {article.id}: {e}")
                continue

        self.metrics.entities_extracted = len(entities)
        return entities

    async def _cache_results(
        self,
        articles: List[Any],
        entities: List[Any]
    ) -> None:
        """Cache ingestion results across four tiers"""

        # Cache articles
        for article in articles:
            cache_key = f"rss:article:{article.id}"
            await self.cache_service.set(cache_key, article, ttl=self.config.default_ttl)

        # Cache entities
        for entity in entities:
            cache_key = f"rss:entity:{entity.id}"
            await self.cache_service.set(cache_key, entity, ttl=self.config.default_ttl)

        # Cache aggregate metrics
        metrics_key = "rss:metrics:latest"
        await self.cache_service.set(metrics_key, self.metrics, ttl=3600)  # 1 hour

    async def _send_notifications(
        self,
        articles: List[Any],
        entities: List[Any],
        job_id: str
    ) -> None:
        """Send real-time WebSocket notifications"""

        # Notify for each article
        for article in articles:
            await self.websocket_notifier.notify_article_ingested(article)
            self.metrics.websocket_notifications_sent += 1

        # Notify entity extraction summary
        if entities:
            await self.websocket_notifier.notify_entity_extraction_summary(entities, job_id)
            self.metrics.websocket_notifications_sent += 1

    async def _update_job_progress(
        self,
        job_id: str,
        stage: str,
        progress: Any
    ) -> None:
        """Update job progress and send notification"""

        if job_id in self.active_jobs:
            self.active_jobs[job_id]["current_stage"] = stage
            self.active_jobs[job_id]["progress"] = progress
            self.active_jobs[job_id]["last_updated"] = datetime.utcnow()

        if self.config.enable_websocket_notifications:
            await self.websocket_notifier.notify_ingestion_progress(job_id, stage, progress)

    async def _complete_job(self, job_id: str, results: Dict) -> Dict:
        """Complete ingestion job"""

        if job_id in self.active_jobs:
            self.active_jobs[job_id].update({
                "status": "completed",
                "completed_at": datetime.utcnow(),
                "results": results
            })

        if self.config.enable_websocket_notifications:
            await self.websocket_notifier.notify_ingestion_complete(job_id, results)

        return {
            "job_id": job_id,
            "status": "completed",
            "metrics": {
                "articles_processed": self.metrics.articles_processed,
                "entities_extracted": self.metrics.entities_extracted,
                "duplicates_removed": self.metrics.duplicates_removed,
                "cache_hit_rate": self.metrics.cache_hit_rate,
                "websocket_notifications_sent": self.metrics.websocket_notifications_sent
            },
            **results
        }

    async def _fail_job(self, job_id: str, error: str) -> None:
        """Mark job as failed"""

        if job_id in self.active_jobs:
            self.active_jobs[job_id].update({
                "status": "failed",
                "error": error,
                "failed_at": datetime.utcnow()
            })

        if self.config.enable_websocket_notifications:
            await self.websocket_notifier.notify_ingestion_failed(job_id, error)

    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL for anti-crawler tracking"""
        from urllib.parse import urlparse
        return urlparse(url).netloc

    async def get_metrics(self) -> Dict[str, Any]:
        """Get current service metrics"""

        return {
            "ingestion_metrics": {
                "articles_processed": self.metrics.articles_processed,
                "entities_extracted": self.metrics.entities_extracted,
                "duplicates_removed": self.metrics.duplicates_removed,
                "total_processing_time": self.metrics.total_processing_time,
                "avg_processing_time": self.metrics.avg_processing_time,
                "cache_hit_rate": self.metrics.cache_hit_rate,
                "websocket_notifications_sent": self.metrics.websocket_notifications_sent
            },
            "active_jobs": len(self.active_jobs),
            "component_status": {
                "route_processor": "active",
                "anti_crawler": "active",
                "entity_extractor": "active" if self.config.enable_entity_extraction else "disabled",
                "deduplicator": "active" if self.config.enable_deduplication else "disabled",
                "websocket_notifier": "active" if self.config.enable_websocket_notifications else "disabled"
            }
        }

    async def health_check(self) -> Dict[str, Any]:
        """Perform service health check"""

        health_status = {
            "status": "healthy",
            "components": {},
            "metrics": await self.get_metrics()
        }

        # Check component health
        try:
            # Test cache service
            cache_health = await self.cache_service.health_check()
            health_status["components"]["cache_service"] = cache_health

            # Test realtime service
            realtime_stats = await self.realtime_service.get_connection_stats()
            health_status["components"]["realtime_service"] = {
                "healthy": realtime_stats["connection_stats"]["active_connections"] > 0
            }

        except Exception as e:
            health_status["status"] = "degraded"
            health_status["error"] = str(e)

        return health_status


# Convenience function for quick RSS ingestion
async def create_rss_ingestion_service(
    cache_service: CacheService,
    realtime_service: RealtimeService,
    hierarchy_resolver: OptimizedHierarchyResolver
) -> RSSIngestionService:
    """Create and initialize RSS ingestion service"""

    service = RSSIngestionService(cache_service, realtime_service, hierarchy_resolver)

    # Perform initial health check
    health = await service.health_check()
    if health["status"] != "healthy":
        logger.warning(f"RSS ingestion service health check: {health['status']}")

    return service
