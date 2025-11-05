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

import aioredis
import redis
from redis import Redis
from redis.connection import ConnectionPool


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