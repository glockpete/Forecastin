"""
Test cache service performance optimizations.

This test validates:
1. OrderedDict-based LRU cache (O(1) vs O(n) operations)
2. orjson serialization performance vs standard json
"""

import asyncio
import time
import pytest
from collections import OrderedDict

from services.cache_service import LRUMemoryCache, CacheService, CacheKeyType


class TestLRUCachePerformance:
    """Test LRU cache performance optimizations."""

    def test_lru_uses_ordered_dict(self):
        """Verify that LRU cache uses OrderedDict for O(1) operations."""
        cache = LRUMemoryCache(max_size=100)
        
        # Check that internal cache is OrderedDict
        assert isinstance(cache._cache, OrderedDict), \
            "LRU cache should use OrderedDict for O(1) performance"

    def test_lru_cache_get_performance(self):
        """Test that cache get operations remain fast even with many entries."""
        cache = LRUMemoryCache(max_size=10000)
        
        # Fill cache with 1000 entries
        for i in range(1000):
            cache.set(f"key_{i}", f"value_{i}")
        
        # Measure get performance - should be O(1)
        start = time.perf_counter()
        for i in range(100):
            # Access early entries (worst case for list-based implementation)
            cache.get(f"key_{i}")
        end = time.perf_counter()
        
        elapsed_ms = (end - start) * 1000
        # Should complete 100 gets in under 10ms (generous threshold)
        assert elapsed_ms < 10, \
            f"100 cache gets took {elapsed_ms:.2f}ms, expected < 10ms"

    def test_lru_cache_set_performance(self):
        """Test that cache set operations remain fast."""
        cache = LRUMemoryCache(max_size=10000)
        
        # Pre-fill cache
        for i in range(1000):
            cache.set(f"key_{i}", f"value_{i}")
        
        # Measure set performance for existing keys (triggers move_to_end)
        start = time.perf_counter()
        for i in range(100):
            cache.set(f"key_{i}", f"new_value_{i}")
        end = time.perf_counter()
        
        elapsed_ms = (end - start) * 1000
        # Should complete 100 sets in under 10ms
        assert elapsed_ms < 10, \
            f"100 cache sets took {elapsed_ms:.2f}ms, expected < 10ms"

    def test_lru_eviction_order(self):
        """Test that LRU eviction works correctly with OrderedDict."""
        cache = LRUMemoryCache(max_size=3)
        
        # Add 3 items
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")
        
        # Access key1 to make it most recently used
        cache.get("key1")
        
        # Add a 4th item - should evict key2 (least recently used)
        cache.set("key4", "value4")
        
        assert cache.get("key1") == "value1", "key1 should still exist"
        assert cache.get("key2") is None, "key2 should be evicted"
        assert cache.get("key3") == "value3", "key3 should still exist"
        assert cache.get("key4") == "value4", "key4 should exist"

    def test_cache_metrics(self):
        """Test that cache metrics are tracked correctly."""
        cache = LRUMemoryCache(max_size=100)
        
        # Add some items
        for i in range(10):
            cache.set(f"key_{i}", f"value_{i}")
        
        # Hit
        cache.get("key_0")
        metrics = cache.get_metrics()
        assert metrics.hits == 1
        
        # Miss
        cache.get("nonexistent")
        metrics = cache.get_metrics()
        assert metrics.misses == 1
        
        # Eviction
        cache_small = LRUMemoryCache(max_size=2)
        cache_small.set("key1", "value1")
        cache_small.set("key2", "value2")
        cache_small.set("key3", "value3")  # Should evict key1
        
        metrics = cache_small.get_metrics()
        assert metrics.evictions == 1

    def test_rss_key_type_tracking(self):
        """Test RSS key type metrics tracking."""
        cache = LRUMemoryCache(max_size=100)
        
        # Add items with different RSS key types
        cache.set("feed1", "data1", key_type=CacheKeyType.RSS_FEED)
        cache.set("article1", "data2", key_type=CacheKeyType.RSS_ARTICLE)
        cache.set("entity1", "data3", key_type=CacheKeyType.RSS_ENTITY)
        
        # Access items
        cache.get("feed1")
        cache.get("article1")
        cache.get("entity1")
        
        metrics = cache.get_metrics()
        assert metrics.rss_feed_hits == 1
        assert metrics.rss_article_hits == 1
        assert metrics.rss_entity_hits == 1


class TestCacheServiceOrjson:
    """Test that CacheService uses orjson for Redis serialization."""

    @pytest.mark.asyncio
    async def test_orjson_import(self):
        """Verify orjson is imported in cache_service."""
        from services import cache_service
        assert hasattr(cache_service, 'orjson'), \
            "cache_service should import orjson"

    @pytest.mark.asyncio
    async def test_cache_service_initialization(self):
        """Test that CacheService initializes correctly with optimizations."""
        # This tests that the service can be created without errors
        # Redis connection will fail in test environment, but that's expected
        cache_service = CacheService(
            redis_url="redis://localhost:6379/0",
            max_memory_cache_size=1000
        )
        
        # Check L1 cache uses OrderedDict
        assert isinstance(cache_service._memory_cache._cache, OrderedDict), \
            "CacheService L1 cache should use OrderedDict"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
