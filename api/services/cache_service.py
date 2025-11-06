"""
Cache Service with Redis connection handling and L1 memory cache.

Implements the multi-tier caching strategy:
- L1: Memory LRU (10,000 entries) with RLock synchronization  
- L2: Redis (shared across instances) with connection pooling and exponential backoff
- L3: Database PostgreSQL buffer cache (handled by DB layer)
- L4: Materialized views (handled by DB layer)

Following the patterns specified in AGENTS.md.
"""

import asyncio
import json
import logging
import threading
import time
from typing import Any, Dict, List, Optional, Set, Union
from dataclasses import dataclass, field

import redis.asyncio as aioredis
from redis.asyncio import Redis, ConnectionPool


logger = logging.getLogger(__name__)


@dataclass
class CacheMetrics:
    """Cache performance metrics."""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    redis_operations: int = 0
    memory_operations: int = 0
    last_hit_time: float = 0.0
    last_miss_time: float = 0.0
    total_response_time: float = 0.0
    
    @property
    def hit_rate(self) -> float:
        """Calculate hit rate percentage."""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0
    
    @property
    def avg_response_time(self) -> float:
        """Calculate average response time."""
        total_ops = self.hits + self.misses
        return self.total_response_time / total_ops if total_ops > 0 else 0.0


@dataclass 
class LRUCacheEntry:
    """LRU cache entry with metadata."""
    value: Any
    timestamp: float
    access_count: int = 0
    ttl: Optional[int] = None  # Time to live in seconds
    

class LRUMemoryCache:
    """
    Thread-safe LRU memory cache with RLock synchronization.
    
    Uses RLock instead of standard Lock for re-entrant locking
    to prevent deadlocks in complex query scenarios.
    """
    
    def __init__(self, max_size: int = 10000):
        """
        Initialize LRU memory cache.
        
        Args:
            max_size: Maximum number of entries in cache
        """
        self.max_size = max_size
        self._cache: Dict[str, LRUCacheEntry] = {}
        self._access_order: List[str] = []  # LRU order (least recently used at end)
        
        # Use RLock instead of standard Lock for thread safety
        self._lock = threading.RLock()
        
        # Metrics
        self._metrics = CacheMetrics()
        
        # Cache invalidation hooks for multi-tier coordination
        self._invalidation_hooks: List[callable] = []
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache with LRU tracking."""
        with self._lock:
            if key not in self._cache:
                self._metrics.misses += 1
                self._metrics.last_miss_time = time.time()
                return None
            
            entry = self._cache[key]
            
            # Check TTL expiration
            if entry.ttl is not None:
                age = time.time() - entry.timestamp
                if age > entry.ttl:
                    self._delete(key)
                    self._metrics.misses += 1
                    self._metrics.last_miss_time = time.time()
                    return None
            
            # Update access order and count
            self._access_order.remove(key)
            self._access_order.append(key)
            entry.access_count += 1
            
            self._metrics.hits += 1
            self._metrics.last_hit_time = time.time()
            
            return entry.value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with LRU eviction."""
        with self._lock:
            current_time = time.time()
            
            if key in self._cache:
                # Update existing entry
                entry = self._cache[key]
                entry.value = value
                entry.timestamp = current_time
                entry.ttl = ttl
                
                # Update access order
                if key in self._access_order:
                    self._access_order.remove(key)
                self._access_order.append(key)
            else:
                # Check if we need to evict
                if len(self._cache) >= self.max_size:
                    self._evict_lru()
                
                # Add new entry
                self._cache[key] = LRUCacheEntry(
                    value=value,
                    timestamp=current_time,
                    ttl=ttl
                )
                self._access_order.append(key)
            
            # Trigger invalidation hooks for multi-tier coordination
            self._trigger_invalidation_hooks(key, value)
    
    def delete(self, key: str) -> bool:
        """Delete value from cache."""
        with self._lock:
            return self._delete(key)
    
    def _delete(self, key: str) -> bool:
        """Internal delete method (assumes lock is held)."""
        if key in self._cache:
            del self._cache[key]
            if key in self._access_order:
                self._access_order.remove(key)
            return True
        return False
    
    def _evict_lru(self) -> None:
        """Evict least recently used entry."""
        if self._access_order:
            lru_key = self._access_order[0]
            self._delete(lru_key)
            self._metrics.evictions += 1
    
    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
            self._access_order.clear()
            self._metrics.evictions += len(self._cache)
    
    def get_metrics(self) -> CacheMetrics:
        """Get cache performance metrics."""
        with self._lock:
            return CacheMetrics(
                hits=self._metrics.hits,
                misses=self._metrics.misses,
                evictions=self._metrics.evictions,
                redis_operations=self._metrics.redis_operations,
                memory_operations=self._metrics.memory_operations,
                last_hit_time=self._metrics.last_hit_time,
                last_miss_time=self._metrics.last_miss_time,
                total_response_time=self._metrics.total_response_time
            )
    
    def add_invalidation_hook(self, hook: callable) -> None:
        """Add cache invalidation hook for multi-tier coordination."""
        self._invalidation_hooks.append(hook)
    
    def _trigger_invalidation_hooks(self, key: str, value: Any) -> None:
        """Trigger all invalidation hooks."""
        for hook in self._invalidation_hooks:
            try:
                hook(key, value)
            except Exception as e:
                logger.warning(f"Cache invalidation hook failed: {e}")
    
    def get_keys(self) -> Set[str]:
        """Get all cache keys."""
        with self._lock:
            return set(self._cache.keys())
    
    def get_size(self) -> int:
        """Get current cache size."""
        with self._lock:
            return len(self._cache)


class CacheService:
    """
    Multi-tier cache service with Redis and memory LRU cache.
    
    Implements the caching strategy:
    - L1: Memory LRU cache (thread-safe with RLock)
    - L2: Redis cache (shared across instances)
    - L3: Database PostgreSQL buffer cache (handled by DB layer)
    - L4: Materialized views (handled by DB layer)
    """
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        max_memory_cache_size: int = 10000,
        redis_pool_size: int = 10,
        default_ttl: int = 3600,  # 1 hour
        enable_metrics: bool = True
    ):
        """
        Initialize cache service.
        
        Args:
            redis_url: Redis connection URL
            max_memory_cache_size: Maximum entries in L1 memory cache
            redis_pool_size: Redis connection pool size
            default_ttl: Default time-to-live in seconds
            enable_metrics: Enable cache performance metrics
        """
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self.enable_metrics = enable_metrics
        
        # L1: Memory LRU cache with RLock synchronization
        self._memory_cache = LRUMemoryCache(max_size=max_memory_cache_size)
        
        # L2: Redis connection pool with exponential backoff
        self._redis_pool: Optional[ConnectionPool] = None
        self._redis: Optional[Redis] = None
        self._redis_pool_size = redis_pool_size
        self._redis_connected = False
        
        # Retry configuration for Redis operations
        self._redis_retry_attempts = 3
        self._redis_retry_delays = [0.5, 1.0, 2.0]
        
        # Performance metrics
        self._metrics = CacheMetrics()
    
    async def initialize(self) -> None:
        """Initialize Redis connection pool."""
        try:
            # Create Redis connection pool
            self._redis_pool = aioredis.ConnectionPool.from_url(
                self.redis_url,
                max_connections=self._redis_pool_size,
                retry_on_timeout=True,
                health_check_interval=30,
                socket_keepalive=True,
                socket_keepalive_options={}
            )
            
            # Test connection
            self._redis = aioredis.Redis(connection_pool=self._redis_pool)
            await self._redis.ping()
            
            self._redis_connected = True
            logger.info("Cache service Redis connection initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis connection: {e}")
            self._redis_connected = False
            raise
    
    async def close(self) -> None:
        """Close Redis connections."""
        if self._redis:
            await self._redis.close()
        if self._redis_pool:
            await self._redis_pool.disconnect()
        
        self._redis_connected = False
        logger.info("Cache service Redis connections closed")
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache (L1 memory first, then L2 Redis).
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None
        """
        start_time = time.time()
        
        # L1: Try memory cache first
        value = self._memory_cache.get(key)
        self._metrics.memory_operations += 1
        
        if value is not None:
            if self.enable_metrics:
                self._metrics.hits += 1
                self._metrics.total_response_time += time.time() - start_time
            return value
        
        # L2: Try Redis cache
        if self._redis_connected and self._redis:
            try:
                redis_value = await self._retry_redis_operation(
                    self._redis.get(key)
                )
                
                if redis_value is not None:
                    # Deserialize and store in L1 for next time
                    try:
                        value = json.loads(redis_value.decode('utf-8'))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        value = redis_value  # Store as bytes
                    
                    # Store in memory cache for faster subsequent access
                    self._memory_cache.set(key, value, self.default_ttl)
                    
                    self._metrics.redis_operations += 1
                    if self.enable_metrics:
                        self._metrics.hits += 1
                        self._metrics.total_response_time += time.time() - start_time
                    
                    return value
                    
            except Exception as e:
                logger.warning(f"Redis get failed for key {key}: {e}")
        
        # Cache miss
        if self.enable_metrics:
            self._metrics.misses += 1
            self._metrics.total_response_time += time.time() - start_time
        
        return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None,
        invalidate_tiers: bool = True
    ) -> None:
        """
        Set value in cache (L1 memory and L2 Redis).
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds
            invalidate_tiers: Invalidate other cache tiers
        """
        ttl = ttl or self.default_ttl
        
        # L1: Store in memory cache
        self._memory_cache.set(key, value, ttl)
        self._metrics.memory_operations += 1
        
        # L2: Store in Redis
        if self._redis_connected and self._redis:
            try:
                # Serialize value for Redis
                try:
                    redis_value = json.dumps(value, default=str)
                except (TypeError, ValueError):
                    redis_value = value  # Store as-is if serialization fails
                
                await self._retry_redis_operation(
                    self._redis.setex(key, ttl, redis_value)
                )
                
                self._metrics.redis_operations += 1
                
            except Exception as e:
                logger.warning(f"Redis set failed for key {key}: {e}")
        
        # Trigger invalidation in other tiers if requested
        if invalidate_tiers:
            await self._invalidate_higher_tiers(key, value)
    
    async def delete(self, key: str) -> bool:
        """
        Delete value from cache (L1 and L2).
        
        Args:
            key: Cache key
            
        Returns:
            True if key was deleted, False otherwise
        """
        deleted = False
        
        # L1: Delete from memory cache
        if self._memory_cache.delete(key):
            deleted = True
        self._metrics.memory_operations += 1
        
        # L2: Delete from Redis
        if self._redis_connected and self._redis:
            try:
                result = await self._retry_redis_operation(
                    self._redis.delete(key)
                )
                if result > 0:
                    deleted = True
                self._metrics.redis_operations += 1
            except Exception as e:
                logger.warning(f"Redis delete failed for key {key}: {e}")
        
        return deleted
    
    async def clear(self) -> None:
        """Clear all cache entries (L1 and L2)."""
        # L1: Clear memory cache
        self._memory_cache.clear()
        self._metrics.memory_operations += 1
        
        # L2: Clear Redis cache (be careful in production!)
        if self._redis_connected and self._redis:
            try:
                await self._retry_redis_operation(self._redis.flushdb())
                self._metrics.redis_operations += 1
            except Exception as e:
                logger.warning(f"Redis clear failed: {e}")
    
    async def exists(self, key: str) -> bool:
        """
        Check if key exists in cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if key exists, False otherwise
        """
        # Check L1 first
        if self._memory_cache.get(key) is not None:
            return True
        
        # Check L2 Redis
        if self._redis_connected and self._redis:
            try:
                result = await self._retry_redis_operation(
                    self._redis.exists(key)
                )
                return result > 0
            except Exception as e:
                logger.warning(f"Redis exists check failed for key {key}: {e}")
        
        return False
    
    async def _retry_redis_operation(self, coro):
        """
        Execute Redis operation with exponential backoff retry.
        
        Args:
            coro: Coroutine to execute
            
        Returns:
            Operation result
        """
        last_exception = None
        
        for attempt in range(self._redis_retry_attempts):
            try:
                return await coro
            except Exception as e:
                last_exception = e
                logger.warning(
                    f"Redis operation attempt {attempt + 1} failed: {e}"
                )
                
                if attempt == self._redis_retry_attempts - 1:
                    # Last attempt failed
                    break
                
                # Wait before retry (exponential backoff)
                await asyncio.sleep(self._redis_retry_delays[attempt])
        
        # All attempts failed
        raise last_exception
    
    async def _invalidate_higher_tiers(self, key: str, value: Any) -> None:
        """
        Invalidate higher-tier caches (L3 Database, L4 Materialized Views).
        This is called through database manager integration.
        """
        # Trigger L1 memory cache invalidation hooks
        self._memory_cache._trigger_invalidation_hooks(key, value)
        
        # TODO: Add hooks for L3/L4 invalidation when database layer is integrated
        # This would involve calling database_manager.invalidate_cache(key)
    
    def add_invalidation_hook(self, hook: callable) -> None:
        """Add cache invalidation hook for multi-tier coordination."""
        self._memory_cache.add_invalidation_hook(hook)
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get comprehensive cache performance metrics."""
        memory_metrics = self._memory_cache.get_metrics()
        
        return {
            "memory_cache": {
                "size": self._memory_cache.get_size(),
                "max_size": self._memory_cache.max_size,
                "hit_rate": memory_metrics.hit_rate,
                "hits": memory_metrics.hits,
                "misses": memory_metrics.misses,
                "evictions": memory_metrics.evictions,
                "avg_response_time_ms": memory_metrics.avg_response_time * 1000
            },
            "redis_cache": {
                "connected": self._redis_connected,
                "operations": self._metrics.redis_operations,
                "memory_operations": self._metrics.memory_operations
            },
            "overall": {
                "total_hits": self._metrics.hits,
                "total_misses": self._metrics.misses,
                "hit_rate": self._metrics.hit_rate,
                "avg_response_time_ms": self._metrics.avg_response_time * 1000
            }
        }
    
    def invalidate_l1_cache(self, key_pattern: str = None) -> None:
        """
        Invalidate L1 cache entries, optionally matching a pattern.
        
        Args:
            key_pattern: Optional pattern to match keys for selective invalidation
        """
        if key_pattern:
            # Remove entries matching pattern
            keys_to_remove = [
                k for k in self._memory_cache.get_keys()
                if key_pattern in k
            ]
            for key in keys_to_remove:
                self._memory_cache.delete(key)
        else:
            # Clear entire cache
            self._memory_cache.clear()
        
        logger.info(f"L1 cache invalidated {'partially' if key_pattern else 'fully'}")
    
    async def invalidate_l2_cache(self, key_pattern: str = None) -> None:
        """
        Invalidate L2 (Redis) cache entries, optionally matching a pattern.
        
        Args:
            key_pattern: Optional pattern to match keys for selective invalidation
        """
        try:
            if key_pattern:
                # Find and delete keys matching pattern
                pattern = f"*{key_pattern}*"
                keys = await self._redis.keys(pattern)
                if keys:
                    await self._redis.delete(*keys)
            else:
                # Clear all cache entries
                await self._redis.flushdb()
            
            logger.info(f"L2 cache invalidated {'partially' if key_pattern else 'fully'}")
        except Exception as e:
            logger.warning(f"Error invalidating L2 cache: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform cache service health check."""
        health_status = {
            "status": "healthy",
            "memory_cache": {"healthy": True},
            "redis_cache": {"healthy": False, "error": None}
        }

        # Check Redis connection
        if self._redis_connected and self._redis:
            try:
                await self._redis.ping()
                health_status["redis_cache"]["healthy"] = True
            except Exception as e:
                health_status["redis_cache"]["error"] = str(e)
                health_status["status"] = "degraded"

        return health_status


class RSSCacheKeyStrategy:
    """
    RSS-specific cache key strategies for efficient namespace management.

    Implements specialized cache key patterns for:
    - RSS feeds
    - RSS articles
    - RSS entities
    - RSS entity hierarchies
    """

    @staticmethod
    def feed_key(feed_url: str, ttl_bucket: Optional[str] = None) -> str:
        """
        Generate cache key for RSS feed.

        Args:
            feed_url: URL of the RSS feed
            ttl_bucket: Optional TTL bucket for key rotation (e.g., hourly, daily)

        Returns:
            Cache key string
        """
        import hashlib
        url_hash = hashlib.md5(feed_url.encode()).hexdigest()[:12]
        bucket_suffix = f":{ttl_bucket}" if ttl_bucket else ""
        return f"rss:feed:{url_hash}{bucket_suffix}"

    @staticmethod
    def article_key(article_id: str) -> str:
        """Generate cache key for RSS article."""
        return f"rss:article:{article_id}"

    @staticmethod
    def article_entities_key(article_id: str) -> str:
        """Generate cache key for RSS article entities."""
        return f"rss:article_entities:{article_id}"

    @staticmethod
    def entity_key(entity_id: str) -> str:
        """Generate cache key for RSS entity."""
        return f"rss:entity:{entity_id}"

    @staticmethod
    def entity_hierarchy_key(entity_id: str) -> str:
        """Generate cache key for RSS entity hierarchy."""
        return f"rss:entity_hierarchy:{entity_id}"

    @staticmethod
    def entity_location_key(entity_id: str) -> str:
        """Generate cache key for RSS entity geospatial location."""
        return f"rss:entity_location:{entity_id}"

    @staticmethod
    def entity_confidence_key(entity_id: str) -> str:
        """Generate cache key for RSS entity confidence score."""
        return f"rss:entity_confidence:{entity_id}"

    @staticmethod
    def get_namespace_pattern(namespace: str) -> str:
        """
        Get Redis pattern for cache invalidation by namespace.

        Args:
            namespace: Cache namespace (feed, article, entity, etc.)

        Returns:
            Redis key pattern
        """
        return f"rss:{namespace}:*"


@dataclass
class CacheInvalidationMetrics:
    """Metrics for cache invalidation operations."""
    l1_invalidations: int = 0
    l2_invalidations: int = 0
    l3_invalidations: int = 0
    l4_invalidations: int = 0
    cascade_invalidations: int = 0
    selective_invalidations: int = 0
    total_keys_invalidated: int = 0
    last_invalidation_time: float = 0.0
    materialized_view_refreshes: int = 0


class CacheInvalidationCoordinator:
    """
    Coordinates cache invalidation across four tiers with RSS-specific strategies.

    Implements:
    - Four-tier invalidation propagation (L1→L2→L3→L4)
    - RSS-specific cache key strategies
    - Cascade, selective, and lazy invalidation
    - Materialized view coordination
    - Performance monitoring
    """

    def __init__(
        self,
        cache_service: CacheService,
        database_manager: Optional[Any] = None
    ):
        """
        Initialize cache invalidation coordinator.

        Args:
            cache_service: Cache service instance
            database_manager: Optional database manager for L4 coordination
        """
        self.cache_service = cache_service
        self.database_manager = database_manager
        self.key_strategy = RSSCacheKeyStrategy()
        self.metrics = CacheInvalidationMetrics()

        # Invalidation hooks for custom logic
        self._pre_invalidation_hooks: List[callable] = []
        self._post_invalidation_hooks: List[callable] = []

    async def invalidate_cascade(
        self,
        entity_id: str,
        entity_type: str = "entity",
        refresh_materialized_views: bool = True
    ) -> Dict[str, Any]:
        """
        Cascade invalidation across all four tiers.

        This is the most aggressive invalidation strategy, ensuring complete
        consistency across all cache layers and database materialized views.

        Args:
            entity_id: Entity ID to invalidate
            entity_type: Type of entity (feed, article, entity)
            refresh_materialized_views: Whether to refresh materialized views (L4)

        Returns:
            Invalidation results with metrics
        """
        start_time = time.time()
        keys_invalidated = 0

        try:
            # Run pre-invalidation hooks
            await self._run_hooks(self._pre_invalidation_hooks, entity_id, entity_type)

            # L1: Invalidate memory cache
            l1_keys = await self._invalidate_l1(entity_id, entity_type)
            keys_invalidated += l1_keys
            self.metrics.l1_invalidations += 1

            # L2: Invalidate Redis cache
            l2_keys = await self._invalidate_l2(entity_id, entity_type)
            keys_invalidated += l2_keys
            self.metrics.l2_invalidations += 1

            # L3: Invalidate database query cache (connection pool reset)
            await self._invalidate_l3(entity_id, entity_type)
            self.metrics.l3_invalidations += 1

            # L4: Refresh materialized views
            if refresh_materialized_views and self.database_manager:
                await self._invalidate_l4()
                self.metrics.l4_invalidations += 1
                self.metrics.materialized_view_refreshes += 1

            # Update metrics
            self.metrics.cascade_invalidations += 1
            self.metrics.total_keys_invalidated += keys_invalidated
            self.metrics.last_invalidation_time = time.time()

            # Run post-invalidation hooks
            await self._run_hooks(self._post_invalidation_hooks, entity_id, entity_type)

            invalidation_time = time.time() - start_time

            logger.info(
                f"Cascade invalidation completed for {entity_type}:{entity_id} - "
                f"{keys_invalidated} keys invalidated in {invalidation_time:.3f}s"
            )

            return {
                "success": True,
                "entity_id": entity_id,
                "entity_type": entity_type,
                "keys_invalidated": keys_invalidated,
                "tiers_invalidated": ["L1", "L2", "L3", "L4"] if refresh_materialized_views else ["L1", "L2", "L3"],
                "invalidation_time_ms": invalidation_time * 1000
            }

        except Exception as e:
            logger.error(f"Cascade invalidation failed for {entity_type}:{entity_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "entity_id": entity_id,
                "entity_type": entity_type
            }

    async def invalidate_selective(
        self,
        keys: List[str],
        tiers: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Selective invalidation of specific cache keys and tiers.

        More efficient than cascade for targeted invalidation.

        Args:
            keys: List of cache keys to invalidate
            tiers: List of tiers to invalidate (L1, L2, L3, L4), default all

        Returns:
            Invalidation results
        """
        start_time = time.time()
        tiers = tiers or ["L1", "L2"]
        keys_invalidated = 0

        try:
            if "L1" in tiers:
                for key in keys:
                    self.cache_service._memory_cache.delete(key)
                    keys_invalidated += 1
                self.metrics.l1_invalidations += 1

            if "L2" in tiers and self.cache_service._redis:
                deleted = await self.cache_service._redis.delete(*keys)
                keys_invalidated += deleted
                self.metrics.l2_invalidations += 1

            if "L3" in tiers:
                await self._invalidate_l3(None, None)
                self.metrics.l3_invalidations += 1

            if "L4" in tiers and self.database_manager:
                await self._invalidate_l4()
                self.metrics.l4_invalidations += 1

            self.metrics.selective_invalidations += 1
            self.metrics.total_keys_invalidated += keys_invalidated
            self.metrics.last_invalidation_time = time.time()

            invalidation_time = time.time() - start_time

            logger.info(
                f"Selective invalidation completed - "
                f"{keys_invalidated} keys across {len(tiers)} tiers in {invalidation_time:.3f}s"
            )

            return {
                "success": True,
                "keys_invalidated": keys_invalidated,
                "tiers_invalidated": tiers,
                "invalidation_time_ms": invalidation_time * 1000
            }

        except Exception as e:
            logger.error(f"Selective invalidation failed: {e}")
            return {"success": False, "error": str(e)}

    async def invalidate_rss_namespace(
        self,
        namespace: str,
        refresh_materialized_views: bool = False
    ) -> Dict[str, Any]:
        """
        Invalidate entire RSS namespace (feed, article, entity).

        Args:
            namespace: RSS namespace (feed, article, entity, etc.)
            refresh_materialized_views: Whether to refresh materialized views

        Returns:
            Invalidation results
        """
        start_time = time.time()
        keys_invalidated = 0

        try:
            # Get namespace pattern
            pattern = self.key_strategy.get_namespace_pattern(namespace)

            # L1: Clear matching memory cache keys
            l1_keys = [
                k for k in self.cache_service._memory_cache.get_keys()
                if k.startswith(f"rss:{namespace}:")
            ]
            for key in l1_keys:
                self.cache_service._memory_cache.delete(key)
            keys_invalidated += len(l1_keys)
            self.metrics.l1_invalidations += 1

            # L2: Clear matching Redis keys
            if self.cache_service._redis:
                redis_keys = await self.cache_service._redis.keys(pattern)
                if redis_keys:
                    deleted = await self.cache_service._redis.delete(*redis_keys)
                    keys_invalidated += deleted
                self.metrics.l2_invalidations += 1

            # L4: Refresh materialized views if requested
            if refresh_materialized_views and self.database_manager:
                await self._invalidate_l4()
                self.metrics.l4_invalidations += 1

            self.metrics.total_keys_invalidated += keys_invalidated
            self.metrics.last_invalidation_time = time.time()

            invalidation_time = time.time() - start_time

            logger.info(
                f"Namespace invalidation completed for rss:{namespace} - "
                f"{keys_invalidated} keys in {invalidation_time:.3f}s"
            )

            return {
                "success": True,
                "namespace": namespace,
                "keys_invalidated": keys_invalidated,
                "invalidation_time_ms": invalidation_time * 1000
            }

        except Exception as e:
            logger.error(f"Namespace invalidation failed for {namespace}: {e}")
            return {"success": False, "error": str(e), "namespace": namespace}

    async def _invalidate_l1(self, entity_id: str, entity_type: str) -> int:
        """Invalidate L1 memory cache for entity."""
        keys_deleted = 0

        # Generate all possible cache keys for this entity
        if entity_type == "feed":
            keys_to_delete = [self.key_strategy.feed_key(entity_id)]
        elif entity_type == "article":
            keys_to_delete = [
                self.key_strategy.article_key(entity_id),
                self.key_strategy.article_entities_key(entity_id)
            ]
        elif entity_type == "entity":
            keys_to_delete = [
                self.key_strategy.entity_key(entity_id),
                self.key_strategy.entity_hierarchy_key(entity_id),
                self.key_strategy.entity_location_key(entity_id),
                self.key_strategy.entity_confidence_key(entity_id)
            ]
        else:
            keys_to_delete = []

        # Delete from L1 cache
        for key in keys_to_delete:
            if self.cache_service._memory_cache.delete(key):
                keys_deleted += 1

        return keys_deleted

    async def _invalidate_l2(self, entity_id: str, entity_type: str) -> int:
        """Invalidate L2 Redis cache for entity."""
        if not self.cache_service._redis:
            return 0

        keys_deleted = 0

        # Generate all possible cache keys for this entity
        if entity_type == "feed":
            keys_to_delete = [self.key_strategy.feed_key(entity_id)]
        elif entity_type == "article":
            keys_to_delete = [
                self.key_strategy.article_key(entity_id),
                self.key_strategy.article_entities_key(entity_id)
            ]
        elif entity_type == "entity":
            keys_to_delete = [
                self.key_strategy.entity_key(entity_id),
                self.key_strategy.entity_hierarchy_key(entity_id),
                self.key_strategy.entity_location_key(entity_id),
                self.key_strategy.entity_confidence_key(entity_id)
            ]
        else:
            keys_to_delete = []

        # Delete from Redis
        if keys_to_delete:
            keys_deleted = await self.cache_service._redis.delete(*keys_to_delete)

        return keys_deleted

    async def _invalidate_l3(self, entity_id: Optional[str], entity_type: Optional[str]) -> None:
        """
        Invalidate L3 database query cache.

        Note: PostgreSQL query cache is managed by the database itself.
        This is a placeholder for future integration with database cache control.
        """
        # L3 invalidation would involve clearing PostgreSQL buffer cache
        # This is typically handled by the database and doesn't require explicit action
        # However, we can log it for monitoring purposes
        logger.debug(f"L3 cache invalidation triggered for {entity_type}:{entity_id}")

    async def _invalidate_l4(self) -> None:
        """Invalidate L4 materialized views by refreshing them."""
        if not self.database_manager:
            logger.warning("Database manager not available for L4 invalidation")
            return

        try:
            # Refresh hierarchy materialized views
            await self.database_manager.refresh_hierarchy_views()
            logger.info("L4 materialized views refreshed successfully")

        except Exception as e:
            logger.error(f"Failed to refresh L4 materialized views: {e}")
            raise

    async def _run_hooks(self, hooks: List[callable], *args, **kwargs) -> None:
        """Run invalidation hooks."""
        for hook in hooks:
            try:
                if asyncio.iscoroutinefunction(hook):
                    await hook(*args, **kwargs)
                else:
                    hook(*args, **kwargs)
            except Exception as e:
                logger.warning(f"Invalidation hook failed: {e}")

    def add_pre_invalidation_hook(self, hook: callable) -> None:
        """Add hook to run before invalidation."""
        self._pre_invalidation_hooks.append(hook)

    def add_post_invalidation_hook(self, hook: callable) -> None:
        """Add hook to run after invalidation."""
        self._post_invalidation_hooks.append(hook)

    def get_metrics(self) -> Dict[str, Any]:
        """Get cache invalidation metrics."""
        return {
            "l1_invalidations": self.metrics.l1_invalidations,
            "l2_invalidations": self.metrics.l2_invalidations,
            "l3_invalidations": self.metrics.l3_invalidations,
            "l4_invalidations": self.metrics.l4_invalidations,
            "cascade_invalidations": self.metrics.cascade_invalidations,
            "selective_invalidations": self.metrics.selective_invalidations,
            "total_keys_invalidated": self.metrics.total_keys_invalidated,
            "last_invalidation_time": self.metrics.last_invalidation_time,
            "materialized_view_refreshes": self.metrics.materialized_view_refreshes
        }