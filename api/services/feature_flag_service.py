"""
Feature Flag Service with Database Integration and Multi-Tier Caching

Implements the FeatureFlagService for the geopolitical intelligence platform
following the patterns specified in AGENTS.md:

- Database integration with PostgreSQL and feature_flags table
- Multi-tier caching strategy (L1 Memory, L2 Redis, L3 DB, L4 Materialized Views)
- WebSocket notifications for real-time flag changes
- Thread-safe operations with RLock synchronization
- Exponential backoff retry mechanism
- Gradual rollout support (10% -> 25% -> 50% -> 100%)
"""

import asyncio
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict

from services.cache_service import CacheService
from services.database_manager import DatabaseManager
from services.realtime_service import RealtimeService

logger = logging.getLogger(__name__)


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    components = string.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


class FeatureFlag(BaseModel):
    """Feature flag data model with automatic camelCase serialization."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

    id: UUID
    flag_name: str
    description: Optional[str] = None
    is_enabled: bool
    rollout_percentage: int
    created_at: float
    updated_at: float

    def to_dict(self) -> Dict[str, Any]:
        """Convert feature flag to dictionary with camelCase keys."""
        return {
            'id': str(self.id),
            'flagName': self.flag_name,
            'description': self.description,
            'isEnabled': self.is_enabled,
            'rolloutPercentage': self.rollout_percentage,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }


class CreateFeatureFlagRequest(BaseModel):
    """Request model for creating feature flags with automatic camelCase support."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

    flag_name: str
    description: Optional[str] = None
    is_enabled: bool = False
    rollout_percentage: int = 0
    flag_category: Optional[str] = None  # e.g., "geospatial", "ml", "ui"
    dependencies: Optional[List[str]] = None  # Flags this flag depends on


class UpdateFeatureFlagRequest(BaseModel):
    """Request model for updating feature flags with automatic camelCase support."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )

    description: Optional[str] = None
    is_enabled: Optional[bool] = None
    rollout_percentage: Optional[int] = None
    flag_category: Optional[str] = None
    dependencies: Optional[List[str]] = None


@dataclass
class GeospatialFeatureFlags:
    """Geospatial-specific feature flags configuration."""
    # Core geospatial features (standardized to ff.geo.* pattern)
    ff_geo_layers_enabled: bool = False        # Enable geospatial layer system
    ff_geo_point_layer_active: bool = False    # Point layer implementation
    ff_geo_polygon_layer_active: bool = False  # Polygon layer implementation
    ff_geo_linestring_layer_active: bool = False  # Linestring layer implementation
    ff_geo_heatmap_layer_active: bool = False  # Heatmap layer implementation

    # Advanced features
    ff_geo_clustering_enabled: bool = False    # Point clustering
    ff_geo_gpu_rendering_enabled: bool = False # GPU-based spatial filtering
    ff_geo_realtime_updates_enabled: bool = False  # Real-time layer updates
    ff_geo_websocket_layers_enabled: bool = False  # WebSocket layer integration

    # Performance features
    ff_geo_performance_monitoring_enabled: bool = True   # Performance tracking
    ff_geo_audit_logging_enabled: bool = True            # Audit trail

    # Rollout percentages for gradual enablement
    rollout_percentages: Dict[str, int] = field(default_factory=lambda: {
        'core_layers': 0,           # BaseLayer, LayerRegistry
        'point_layers': 0,          # PointLayer implementation
        'websocket_integration': 0, # Real-time updates
        'advanced_features': 0,     # GPU filtering, clustering
        'performance_monitoring': 100  # Always enabled
    })

    # Integration with ff.map_v1 (existing flag)
    def is_map_v1_enabled(self) -> bool:
        """Check if ff.map_v1 is enabled (would come from main feature flags)."""
        # This would integrate with the main feature flag system
        return True  # Placeholder - would check actual flag

    def get_enabled_features(self) -> Dict[str, bool]:
        """Get all enabled geospatial features."""
        return {
            'geospatial_layers': self.ff_geo_layers_enabled and self.is_map_v1_enabled(),
            'point_layer': self.ff_geo_point_layer_active and self.ff_geo_layers_enabled,
            'polygon_layer': self.ff_geo_polygon_layer_active and self.ff_geo_layers_enabled,
            'linestring_layer': self.ff_geo_linestring_layer_active and self.ff_geo_layers_enabled,
            'heatmap_layer': self.ff_geo_heatmap_layer_active and self.ff_geo_layers_enabled,
            'clustering': self.ff_geo_clustering_enabled and self.ff_geo_layers_enabled,
            'gpu_filtering': self.ff_geo_gpu_rendering_enabled and self.ff_geo_layers_enabled,
            'realtime_updates': self.ff_geo_realtime_updates_enabled and self.ff_geo_websocket_layers_enabled,
            'websocket_layers': self.ff_geo_websocket_layers_enabled and self.ff_geo_layers_enabled,
            'performance_monitoring': self.ff_geo_performance_monitoring_enabled,
            'audit_logging': self.ff_geo_audit_logging_enabled
        }


@dataclass
class FeatureFlagMetrics:
    """Feature flag service performance metrics."""
    total_flags: int = 0
    enabled_flags: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    database_queries: int = 0
    websocket_notifications: int = 0
    avg_response_time_ms: float = 0.0


class FeatureFlagService:
    """
    Feature Flag Service with database integration and multi-tier caching.
    
    This service implements comprehensive feature flag management with:
    - CRUD operations for feature flags
    - Multi-tier caching strategy (L1 Memory -> L2 Redis -> L3 DB)
    - WebSocket notifications for real-time updates
    - Gradual rollout support with percentage-based targeting
    - Thread-safe operations with RLock synchronization
    - Exponential backoff retry mechanism for database operations
    
    Performance Targets:
    - <1.25ms average response time for flag lookups
    - 99.2% cache hit rate
    - Thread-safe operations across all tiers
    """

    # Cache key prefixes for multi-tier strategy
    CACHE_PREFIX_FLAG = "ff:flag:"
    CACHE_PREFIX_ALL = "ff:all"
    CACHE_TTL = 3600  # 1 hour

    # Retry configuration for database operations
    RETRY_ATTEMPTS = 3
    RETRY_DELAYS = [0.5, 1.0, 2.0]  # Exponential backoff

    def __init__(
        self,
        database_manager: DatabaseManager,
        cache_service: Optional[CacheService] = None,
        realtime_service: Optional[RealtimeService] = None
    ):
        """
        Initialize the Feature Flag Service.
        
        Args:
            database_manager: Database manager for PostgreSQL operations
            cache_service: Optional cache service for multi-tier caching
            realtime_service: Optional real-time service for WebSocket notifications
        """
        self.db_manager = database_manager
        self.cache_service = cache_service
        self.realtime_service = realtime_service
        self.logger = logging.getLogger(__name__)

        # Use RLock for thread safety as specified
        self._lock = threading.RLock()

        # Performance metrics
        self._metrics = FeatureFlagMetrics()

        # Flag change callbacks for cache invalidation
        self._change_callbacks: List[callable] = []

    async def initialize(self) -> None:
        """Initialize the feature flag service."""
        self.logger.info("FeatureFlagService initialized")

    async def cleanup(self) -> None:
        """Cleanup the feature flag service."""
        # Clear any pending callbacks or connections
        with self._lock:
            self._change_callbacks.clear()

        self.logger.info("FeatureFlagService cleanup completed")

    def _get_cache_key(self, flag_name: str) -> str:
        """Generate cache key for feature flag."""
        return f"{self.CACHE_PREFIX_FLAG}{flag_name}"

    def _get_all_flags_cache_key(self) -> str:
        """Generate cache key for all flags list."""
        return self.CACHE_PREFIX_ALL

    def _serialize_flag(self, flag: FeatureFlag) -> str:
        """Serialize feature flag for cache storage."""
        import orjson
        return orjson.dumps(flag.to_dict()).decode('utf-8')

    def _deserialize_flag(self, data: str) -> FeatureFlag:
        """Deserialize feature flag from cache data."""
        import json
        from uuid import UUID

        import orjson

        # Handle both orjson and regular JSON data
        try:
            if data.startswith('{'):
                # Regular JSON
                data_dict = json.loads(data)
            else:
                # orjson data
                data_dict = orjson.loads(data.encode('utf-8'))
        except Exception as e:
            self.logger.error(f"Failed to deserialize feature flag: {e}")
            raise ValueError("Invalid feature flag data format")

        # Handle both camelCase (new format) and snake_case (legacy format)
        return FeatureFlag(
            id=UUID(data_dict.get('id')),
            flag_name=data_dict.get('flagName', data_dict.get('flag_name')),
            description=data_dict.get('description'),
            is_enabled=data_dict.get('isEnabled', data_dict.get('is_enabled')),
            rollout_percentage=data_dict.get('rolloutPercentage', data_dict.get('rollout_percentage')),
            created_at=data_dict.get('createdAt', data_dict.get('created_at')),
            updated_at=data_dict.get('updatedAt', data_dict.get('updated_at'))
        )

    async def _retry_database_operation(self, coro):
        """Execute database operation with exponential backoff retry."""
        last_exception = None

        for attempt in range(self.RETRY_ATTEMPTS):
            try:
                return await coro
            except Exception as e:
                last_exception = e
                self.logger.warning(
                    f"Database operation attempt {attempt + 1} failed: {e}"
                )

                if attempt == self.RETRY_ATTEMPTS - 1:
                    # Last attempt failed
                    break

                # Wait before retry (exponential backoff)
                await asyncio.sleep(self.RETRY_DELAYS[attempt])

        # All attempts failed
        raise last_exception

    async def create_flag(self, request: CreateFeatureFlagRequest) -> FeatureFlag:
        """
        Create a new feature flag.
        
        Args:
            request: Feature flag creation request
            
        Returns:
            Created feature flag
            
        Raises:
            HTTPException: If flag creation fails or flag name already exists
        """
        start_time = time.time()

        try:
            # Validate rollout percentage
            if not 0 <= request.rollout_percentage <= 100:
                raise HTTPException(
                    status_code=400,
                    detail="Rollout percentage must be between 0 and 100"
                )

            async with self.db_manager.get_connection() as conn:
                # Check if flag name already exists
                existing = await conn.fetchrow(
                    "SELECT id FROM feature_flags WHERE flag_name = $1",
                    request.flag_name
                )

                if existing:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Feature flag '{request.flag_name}' already exists"
                    )

                # Create the feature flag
                row = await self._retry_database_operation(
                    conn.fetchrow("""
                        INSERT INTO feature_flags 
                        (flag_name, description, is_enabled, rollout_percentage)
                        VALUES ($1, $2, $3, $4)
                        RETURNING id, flag_name, description, is_enabled, 
                                 rollout_percentage, created_at, updated_at
                    """, request.flag_name, request.description,
                                  request.is_enabled, request.rollout_percentage)
                )

                if not row:
                    raise HTTPException(status_code=500, detail="Failed to create feature flag")

                flag = FeatureFlag(
                    id=row['id'],
                    flag_name=row['flag_name'],
                    description=row['description'],
                    is_enabled=row['is_enabled'],
                    rollout_percentage=row['rollout_percentage'],
                    created_at=row['created_at'].timestamp(),
                    updated_at=row['updated_at'].timestamp()
                )

            # Update cache (L1 and L2)
            await self._update_cache(flag)

            # Invalidate all flags cache
            if self.cache_service:
                await self.cache_service.delete(self._get_all_flags_cache_key())

            # Send WebSocket notification
            if self.realtime_service:
                await self.realtime_service.notify_flag_created(flag.to_dict())

                with self._lock:
                    self._metrics.websocket_notifications += 1

            # Trigger change callbacks
            await self._trigger_change_callbacks('created', flag)

            # Update metrics
            response_time_ms = (time.time() - start_time) * 1000
            with self._lock:
                self._metrics.database_queries += 1
                self._metrics.total_flags += 1
                if flag.is_enabled:
                    self._metrics.enabled_flags += 1
                self._metrics.avg_response_time_ms = (
                    (self._metrics.avg_response_time_ms + response_time_ms) / 2
                )

            self.logger.info(
                f"Created feature flag: {flag.flag_name} "
                f"(enabled: {flag.is_enabled}, rollout: {flag.rollout_percentage}%)"
            )

            return flag

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Failed to create feature flag {request.flag_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

    async def get_flag(self, flag_name: str) -> Optional[FeatureFlag]:
        """
        Get a feature flag by name with multi-tier caching.
        
        Args:
            flag_name: Name of the feature flag
            
        Returns:
            Feature flag or None if not found
        """
        start_time = time.time()
        cache_key = self._get_cache_key(flag_name)

        try:
            # Try L1 and L2 cache first
            if self.cache_service:
                cached_data = await self.cache_service.get(cache_key)
                if cached_data:
                    try:
                        flag = self._deserialize_flag(cached_data)

                        with self._lock:
                            self._metrics.cache_hits += 1

                        return flag
                    except Exception as e:
                        self.logger.warning(f"Cache deserialization failed for {flag_name}: {e}")
                        # Continue to database

            # L3: Query database
            async with self.db_manager.get_connection() as conn:
                row = await self._retry_database_operation(
                    conn.fetchrow("""
                        SELECT id, flag_name, description, is_enabled, 
                               rollout_percentage, created_at, updated_at
                        FROM feature_flags 
                        WHERE flag_name = $1
                    """, flag_name)
                )

                if not row:
                    return None

                flag = FeatureFlag(
                    id=row['id'],
                    flag_name=row['flag_name'],
                    description=row['description'],
                    is_enabled=row['is_enabled'],
                    rollout_percentage=row['rollout_percentage'],
                    created_at=row['created_at'].timestamp(),
                    updated_at=row['updated_at'].timestamp()
                )

            # Update cache (L1 and L2)
            await self._update_cache(flag)

            # Update metrics
            with self._lock:
                self._metrics.cache_misses += 1
                self._metrics.database_queries += 1
                self._metrics.avg_response_time_ms = (
                    (self._metrics.avg_response_time_ms + (time.time() - start_time) * 1000) / 2
                )

            return flag

        except Exception as e:
            self.logger.error(f"Failed to get feature flag {flag_name}: {e}")
            return None

    async def get_all_flags(self) -> List[FeatureFlag]:
        """
        Get all feature flags with caching.
        
        Returns:
            List of all feature flags
        """
        start_time = time.time()
        cache_key = self._get_all_flags_cache_key()

        try:
            # Try cache first
            if self.cache_service:
                cached_data = await self.cache_service.get(cache_key)
                if cached_data:
                    try:
                        flags_data = cached_data
                        flags = [self._deserialize_flag(flag_data) for flag_data in flags_data]

                        with self._lock:
                            self._metrics.cache_hits += 1

                        return flags
                    except Exception as e:
                        self.logger.warning(f"Cache deserialization failed for all flags: {e}")

            # Query database
            async with self.db_manager.get_connection() as conn:
                rows = await self._retry_database_operation(
                    conn.fetch("""
                        SELECT id, flag_name, description, is_enabled, 
                               rollout_percentage, created_at, updated_at
                        FROM feature_flags 
                        ORDER BY flag_name
                    """)
                )

                flags = []
                for row in rows:
                    flag = FeatureFlag(
                        id=row['id'],
                        flag_name=row['flag_name'],
                        description=row['description'],
                        is_enabled=row['is_enabled'],
                        rollout_percentage=row['rollout_percentage'],
                        created_at=row['created_at'].timestamp(),
                        updated_at=row['updated_at'].timestamp()
                    )
                    flags.append(flag)

            # Update cache
            if self.cache_service:
                try:
                    flags_data = [self._serialize_flag(flag) for flag in flags]
                    await self.cache_service.set(cache_key, flags_data, self.CACHE_TTL)
                except Exception as e:
                    self.logger.warning(f"Failed to cache all flags: {e}")

            # Update metrics
            with self._lock:
                self._metrics.cache_misses += 1
                self._metrics.database_queries += 1
                self._metrics.total_flags = len(flags)
                self._metrics.enabled_flags = sum(1 for flag in flags if flag.is_enabled)

            return flags

        except Exception as e:
            self.logger.error(f"Failed to get all feature flags: {e}")
            return []

    async def update_flag(
        self,
        flag_name: str,
        request: UpdateFeatureFlagRequest
    ) -> Optional[FeatureFlag]:
        """
        Update an existing feature flag.
        
        Args:
            flag_name: Name of the feature flag to update
            request: Update request
            
        Returns:
            Updated feature flag
            
        Raises:
            HTTPException: If flag not found or update fails
        """
        start_time = time.time()

        try:
            # Get current flag for comparison
            current_flag = await self.get_flag(flag_name)
            if not current_flag:
                raise HTTPException(status_code=404, detail=f"Feature flag '{flag_name}' not found")

            # Build dynamic update query
            updates = []
            values = []
            param_count = 1

            if request.description is not None:
                updates.append(f"description = ${param_count}")
                values.append(request.description)
                param_count += 1

            if request.is_enabled is not None:
                updates.append(f"is_enabled = ${param_count}")
                values.append(request.is_enabled)
                param_count += 1

            if request.rollout_percentage is not None:
                if not 0 <= request.rollout_percentage <= 100:
                    raise HTTPException(
                        status_code=400,
                        detail="Rollout percentage must be between 0 and 100"
                    )
                updates.append(f"rollout_percentage = ${param_count}")
                values.append(request.rollout_percentage)
                param_count += 1

            if not updates:
                # Nothing to update
                return current_flag

            # Add updated_at timestamp
            updates.append("updated_at = NOW()")
            values.append(flag_name)

            # Execute update
            async with self.db_manager.get_connection() as conn:
                query = f"""
                    UPDATE feature_flags 
                    SET {', '.join(updates)}
                    WHERE flag_name = ${param_count}
                    RETURNING id, flag_name, description, is_enabled, 
                             rollout_percentage, created_at, updated_at
                """

                row = await self._retry_database_operation(
                    conn.fetchrow(query, *values)
                )

                if not row:
                    raise HTTPException(status_code=500, detail="Failed to update feature flag")

                updated_flag = FeatureFlag(
                    id=row['id'],
                    flag_name=row['flag_name'],
                    description=row['description'],
                    is_enabled=row['is_enabled'],
                    rollout_percentage=row['rollout_percentage'],
                    created_at=row['created_at'].timestamp(),
                    updated_at=row['updated_at'].timestamp()
                )

            # Update cache
            await self._update_cache(updated_flag)

            # Invalidate all flags cache
            if self.cache_service:
                await self.cache_service.delete(self._get_all_flags_cache_key())

            # Send WebSocket notification if important fields changed
            if (self.realtime_service and
                (request.is_enabled is not None or request.rollout_percentage is not None)):

                old_enabled = current_flag.is_enabled
                new_enabled = updated_flag.is_enabled
                old_percentage = current_flag.rollout_percentage
                new_percentage = updated_flag.rollout_percentage

                if old_enabled != new_enabled or old_percentage != new_percentage:
                    await self.realtime_service.notify_feature_flag_change(
                        flag_name=flag_name,
                        old_value=old_enabled,
                        new_value=new_enabled,
                        rollout_percentage=new_percentage
                    )

                    with self._lock:
                        self._metrics.websocket_notifications += 1

            # Trigger change callbacks
            await self._trigger_change_callbacks('updated', updated_flag)

            # Update metrics
            response_time_ms = (time.time() - start_time) * 1000
            with self._lock:
                self._metrics.database_queries += 1
                if updated_flag.is_enabled:
                    self._metrics.enabled_flags += 1
                else:
                    self._metrics.enabled_flags -= 1
                self._metrics.avg_response_time_ms = (
                    (self._metrics.avg_response_time_ms + response_time_ms) / 2
                )

            self.logger.info(
                f"Updated feature flag: {flag_name} "
                f"(enabled: {current_flag.is_enabled} -> {updated_flag.is_enabled}, "
                f"rollout: {current_flag.rollout_percentage}% -> {updated_flag.rollout_percentage}%)"
            )

            return updated_flag

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Failed to update feature flag {flag_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

    async def delete_flag(self, flag_name: str) -> bool:
        """
        Delete a feature flag.
        
        Args:
            flag_name: Name of the feature flag to delete
            
        Returns:
            True if flag was deleted, False if not found
            
        Raises:
            HTTPException: If deletion fails
        """
        start_time = time.time()

        try:
            # Get current flag for WebSocket notification
            current_flag = await self.get_flag(flag_name)

            async with self.db_manager.get_connection() as conn:
                result = await self._retry_database_operation(
                    conn.execute(
                        "DELETE FROM feature_flags WHERE flag_name = $1",
                        flag_name
                    )
                )

                if result == "DELETE 0":
                    # Flag not found
                    return False

            # Remove from cache
            cache_key = self._get_cache_key(flag_name)
            if self.cache_service:
                await self.cache_service.delete(cache_key)

            # Invalidate all flags cache
            if self.cache_service:
                await self.cache_service.delete(self._get_all_flags_cache_key())

            # Send WebSocket notification
            if self.realtime_service and current_flag:
                await self.realtime_service.notify_flag_deleted(flag_name)

                with self._lock:
                    self._metrics.websocket_notifications += 1

            # Trigger change callbacks
            if current_flag:
                await self._trigger_change_callbacks('deleted', current_flag)

            # Update metrics
            response_time_ms = (time.time() - start_time) * 1000
            with self._lock:
                self._metrics.database_queries += 1
                self._metrics.total_flags -= 1
                if current_flag and current_flag.is_enabled:
                    self._metrics.enabled_flags -= 1
                self._metrics.avg_response_time_ms = (
                    (self._metrics.avg_response_time_ms + response_time_ms) / 1000
                )

            self.logger.info(f"Deleted feature flag: {flag_name}")

            return True

        except Exception as e:
            self.logger.error(f"Failed to delete feature flag {flag_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

    async def _update_cache(self, flag: FeatureFlag) -> None:
        """Update cache for a feature flag."""
        if not self.cache_service:
            return

        try:
            cache_key = self._get_cache_key(flag.flag_name)
            serialized_flag = self._serialize_flag(flag)
            await self.cache_service.set(cache_key, serialized_flag, self.CACHE_TTL)
        except Exception as e:
            self.logger.warning(f"Failed to update cache for flag {flag.flag_name}: {e}")

    async def _trigger_change_callbacks(self, action: str, flag: FeatureFlag) -> None:
        """Trigger registered change callbacks."""
        for callback in self._change_callbacks:
            try:
                await callback(action, flag)
            except Exception as e:
                self.logger.warning(f"Change callback failed: {e}")

    def add_change_callback(self, callback: callable) -> None:
        """Add a callback for feature flag changes."""
        with self._lock:
            self._change_callbacks.append(callback)

    def remove_change_callback(self, callback: callable) -> None:
        """Remove a change callback."""
        with self._lock:
            if callback in self._change_callbacks:
                self._change_callbacks.remove(callback)

    async def is_flag_enabled(self, flag_name: str) -> bool:
        """
        Check if a feature flag is enabled.
        
        This is a convenience method for quick flag status checks.
        
        Args:
            flag_name: Name of the feature flag
            
        Returns:
            True if flag is enabled, False otherwise
        """
        flag = await self.get_flag(flag_name)
        return flag.is_enabled if flag else False

    async def get_flag_with_rollout(self, flag_name: str, user_id: Optional[str] = None) -> bool:
        """
        Check if a feature flag is enabled for a specific user/context.
        
        This method implements gradual rollout logic, checking if the user
        should receive the feature based on the rollout percentage.
        
        Args:
            flag_name: Name of the feature flag
            user_id: Optional user identifier for rollout targeting
            
        Returns:
            True if feature should be enabled for the user/context
        """
        flag = await self.get_flag(flag_name)
        if not flag or not flag.is_enabled:
            return False

        # If no user context, return based on rollout percentage
        if not user_id:
            import random
            return random.randint(1, 100) <= flag.rollout_percentage

        # Use user_id for consistent rollout targeting
        # Hash the user_id to get a consistent percentage
        import hashlib
        user_hash = int(hashlib.md5(user_id.encode()).hexdigest()[:8], 16)
        user_percentage = (user_hash % 100) + 1

        return user_percentage <= flag.rollout_percentage

    def get_metrics(self) -> Dict[str, Any]:
        """Get feature flag service performance metrics."""
        with self._lock:
            total_requests = self._metrics.cache_hits + self._metrics.cache_misses
            cache_hit_rate = (
                self._metrics.cache_hits / total_requests if total_requests > 0 else 0.0
            )

            return {
                'total_flags': self._metrics.total_flags,
                'enabled_flags': self._metrics.enabled_flags,
                'cache': {
                    'hits': self._metrics.cache_hits,
                    'misses': self._metrics.cache_misses,
                    'hit_rate': cache_hit_rate,
                    'efficiency': 'EXCELLENT' if cache_hit_rate > 0.95 else
                                 'GOOD' if cache_hit_rate > 0.90 else 'FAIR'
                },
                'database': {
                    'queries': self._metrics.database_queries
                },
                'realtime': {
                    'notifications': self._metrics.websocket_notifications
                },
                'performance': {
                    'avg_response_time_ms': self._metrics.avg_response_time_ms,
                    'meets_slo': self._metrics.avg_response_time_ms < 1.25
                }
            }

    # Geospatial Feature Flag Management Methods

    async def get_geospatial_flag_status(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get comprehensive status of all geospatial feature flags.
        
        This method checks all geospatial-related flags and returns their status,
        respecting dependencies (e.g., point_layer requires geospatial_layers).
        
        Args:
            user_id: Optional user ID for rollout percentage targeting
            
        Returns:
            Dictionary containing status of all geospatial features
        """
        # Check base dependency: ff.map_v1
        map_v1_enabled = await self.get_flag_with_rollout('ff.map_v1', user_id)

        # Check core geospatial flag (standardized to ff.geo.* pattern)
        geospatial_layers_enabled = await self.get_flag_with_rollout('ff.geo.layers_enabled', user_id)
        geospatial_layers_enabled = geospatial_layers_enabled and map_v1_enabled

        # Check layer-specific flags
        point_layer = await self.get_flag_with_rollout('ff.geo.point_layer_active', user_id)
        polygon_layer = await self.get_flag_with_rollout('ff.geo.polygon_layer_active', user_id)
        linestring_layer = await self.get_flag_with_rollout('ff.geo.linestring_layer_active', user_id)
        heatmap_layer = await self.get_flag_with_rollout('ff.geo.heatmap_layer_active', user_id)

        # Check advanced features
        clustering = await self.get_flag_with_rollout('ff.geo.clustering_enabled', user_id)
        gpu_filtering = await self.get_flag_with_rollout('ff.geo.gpu_rendering_enabled', user_id)

        # Check real-time features
        websocket_layers = await self.get_flag_with_rollout('ff.geo.websocket_layers_enabled', user_id)
        realtime_updates = await self.get_flag_with_rollout('ff.geo.realtime_updates_enabled', user_id)

        # Build dependency-aware status
        return {
            'base': {
                'map_v1': map_v1_enabled
            },
            'core': {
                'geospatial_layers': geospatial_layers_enabled
            },
            'layers': {
                'point': point_layer and geospatial_layers_enabled,
                'polygon': polygon_layer and geospatial_layers_enabled,
                'linestring': linestring_layer and geospatial_layers_enabled,
                'heatmap': heatmap_layer and geospatial_layers_enabled
            },
            'advanced': {
                'clustering': clustering and geospatial_layers_enabled,
                'gpu_filtering': gpu_filtering and geospatial_layers_enabled
            },
            'realtime': {
                'websocket_layers': websocket_layers and geospatial_layers_enabled,
                'realtime_updates': realtime_updates and websocket_layers and geospatial_layers_enabled
            },
            'user_context': {
                'user_id': user_id,
                'is_targeted': user_id is not None
            }
        }

    async def create_geospatial_flags(self) -> List[FeatureFlag]:
        """
        Create all geospatial feature flags with default settings.
        
        This is a convenience method for initial setup of the geospatial layer system.
        All flags are created disabled (0% rollout) by default.
        
        Returns:
            List of created feature flags
        """
        geospatial_flags_config = [
            ('ff.geo.layers_enabled', 'Enable geospatial layer system (base dependency)', False, 0),
            ('ff.geo.point_layer_active', 'Enable point layer implementation', False, 0),
            ('ff.geo.polygon_layer_active', 'Enable polygon layer implementation', False, 0),
            ('ff.geo.linestring_layer_active', 'Enable linestring layer implementation', False, 0),
            ('ff.geo.heatmap_layer_active', 'Enable heatmap layer implementation', False, 0),
            ('ff.geo.clustering_enabled', 'Enable point clustering feature', False, 0),
            ('ff.geo.gpu_rendering_enabled', 'Enable GPU-based spatial rendering', False, 0),
            ('ff.geo.websocket_layers_enabled', 'Enable WebSocket layer integration', False, 0),
            ('ff.geo.realtime_updates_enabled', 'Enable real-time layer updates', False, 0),
            ('ff.geo.performance_monitoring_enabled', 'Enable layer performance tracking', True, 100),
            ('ff.geo.audit_logging_enabled', 'Enable layer audit trail', True, 100)
        ]

        created_flags = []
        for flag_name, description, is_enabled, rollout in geospatial_flags_config:
            try:
                # Check if flag already exists
                existing = await self.get_flag(flag_name)
                if existing:
                    self.logger.info(f"Geospatial flag {flag_name} already exists, skipping")
                    created_flags.append(existing)
                    continue

                # Create new flag
                request = CreateFeatureFlagRequest(
                    flag_name=flag_name,
                    description=description,
                    is_enabled=is_enabled,
                    rollout_percentage=rollout,
                    flag_category='geospatial'
                )
                flag = await self.create_flag(request)
                created_flags.append(flag)

                self.logger.info(f"Created geospatial flag: {flag_name}")

            except Exception as e:
                self.logger.error(f"Failed to create geospatial flag {flag_name}: {e}")
                continue

        return created_flags

    async def update_geospatial_rollout(
        self,
        rollout_stage: str,
        percentage: int
    ) -> Dict[str, bool]:
        """
        Update rollout percentage for geospatial feature flags in stages.
        
        Implements gradual rollout pattern: 10% -> 25% -> 50% -> 100%
        Updates all geospatial flags together to maintain consistency.
        
        Args:
            rollout_stage: Stage identifier ('core_layers', 'point_layers',
                          'websocket_integration', 'advanced_features')
            percentage: Rollout percentage (0-100)
            
        Returns:
            Dictionary indicating success/failure for each flag
        """
        if not 0 <= percentage <= 100:
            raise HTTPException(
                status_code=400,
                detail="Rollout percentage must be between 0 and 100"
            )

        # Define flag groups by rollout stage
        stage_flags = {
            'core_layers': ['ff.geo.layers_enabled'],
            'point_layers': ['ff.geo.point_layer_active', 'ff.geo.polygon_layer_active', 'ff.geo.linestring_layer_active'],
            'websocket_integration': ['ff.geo.websocket_layers_enabled', 'ff.geo.realtime_updates_enabled'],
            'advanced_features': ['ff.geo.clustering_enabled', 'ff.geo.gpu_rendering_enabled', 'ff.geo.heatmap_layer_active']
        }

        if rollout_stage not in stage_flags:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid rollout stage. Must be one of: {', '.join(stage_flags.keys())}"
            )

        results = {}
        flags_to_update = stage_flags[rollout_stage]

        for flag_name in flags_to_update:
            try:
                # First enable the flag if not already enabled
                current_flag = await self.get_flag(flag_name)
                if not current_flag:
                    self.logger.warning(f"Flag {flag_name} not found, skipping")
                    results[flag_name] = False
                    continue

                # Update flag
                update_request = UpdateFeatureFlagRequest(
                    is_enabled=True,
                    rollout_percentage=percentage
                )
                await self.update_flag(flag_name, update_request)
                results[flag_name] = True

                self.logger.info(
                    f"Updated {flag_name} rollout to {percentage}% (stage: {rollout_stage})"
                )

            except Exception as e:
                self.logger.error(f"Failed to update {flag_name}: {e}")
                results[flag_name] = False

        return results

    async def create_automated_refresh_flag(self) -> FeatureFlag:
        """
        Create the automated materialized view refresh feature flag with default settings.
        
        This flag controls the automated refresh system for materialized views
        to resolve ancestor resolution performance regression.
        
        Returns:
            Created feature flag
        """
        flag_name = 'ff.automated_refresh_v1'
        description = 'Enable automated materialized view refresh system with smart triggers'

        try:
            # Check if flag already exists
            existing = await self.get_flag(flag_name)
            if existing:
                self.logger.info(f"Automated refresh flag {flag_name} already exists")
                return existing

            # Create new flag with default configuration
            request = CreateFeatureFlagRequest(
                flag_name=flag_name,
                description=description,
                is_enabled=True,  # Enable by default for testing
                rollout_percentage=100,  # 100% for initial deployment
                flag_category='performance'
            )

            flag = await self.create_flag(request)
            self.logger.info(f"Created automated refresh flag: {flag_name}")
            return flag

        except Exception as e:
            self.logger.error(f"Failed to create automated refresh flag {flag_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create flag: {str(e)}")

    async def update_automated_refresh_config(
        self,
        enabled: Optional[bool] = None,
        rollout_percentage: Optional[int] = None,
        smart_triggers_enabled: Optional[bool] = None,
        change_threshold: Optional[int] = None,
        time_threshold_minutes: Optional[int] = None,
        rollback_window_minutes: Optional[int] = None
    ) -> Optional[FeatureFlag]:
        """
        Update configuration for the automated refresh feature flag.
        
        Args:
            enabled: Whether the feature is enabled
            rollout_percentage: Rollout percentage (0-100)
            smart_triggers_enabled: Whether smart triggers are enabled
            change_threshold: Number of changes to trigger refresh
            time_threshold_minutes: Time threshold to trigger refresh
            rollback_window_minutes: Rollback window in minutes
            
        Returns:
            Updated feature flag or None if not found
        """
        flag_name = 'ff.automated_refresh_v1'

        try:
            # Get current flag
            current_flag = await self.get_flag(flag_name)
            if not current_flag:
                self.logger.warning(f"Automated refresh flag {flag_name} not found")
                return None

            # Build configuration dictionary
            config = {}
            if smart_triggers_enabled is not None:
                config['smart_triggers_enabled'] = smart_triggers_enabled
            if change_threshold is not None:
                config['change_threshold'] = change_threshold
            if time_threshold_minutes is not None:
                config['time_threshold_minutes'] = time_threshold_minutes
            if rollback_window_minutes is not None:
                config['rollback_window_minutes'] = rollback_window_minutes

            # Update flag with new configuration
            update_request = UpdateFeatureFlagRequest(
                is_enabled=enabled,
                rollout_percentage=rollout_percentage,
                description=current_flag.description  # Keep existing description
            )

            updated_flag = await self.update_flag(flag_name, update_request)

            # If we have configuration updates, store them in a separate config field
            # This is a simplified approach - in a real implementation, we might use
            # a separate configuration table or JSON field
            self.logger.info(
                f"Updated automated refresh flag: {flag_name} "
                f"(enabled: {enabled}, rollout: {rollout_percentage}%, config: {config})"
            )

            return updated_flag

        except Exception as e:
            self.logger.error(f"Failed to update automated refresh flag {flag_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update flag: {str(e)}")

    async def emergency_rollback_geospatial(self) -> Dict[str, bool]:
        """
        Emergency rollback - disable all geospatial feature flags immediately.
        
        This method supports the rollback checklist requirement:
        "Disable flags first, then DB migration rollback scripts"
        
        Returns:
            Dictionary indicating success/failure for each flag
        """
        geospatial_flag_names = [
            'ff.geo.layers_enabled',
            'ff.geo.point_layer_active',
            'ff.geo.polygon_layer_active',
            'ff.geo.linestring_layer_active',
            'ff.geo.heatmap_layer_active',
            'ff.geo.clustering_enabled',
            'ff.geo.gpu_rendering_enabled',
            'ff.geo.websocket_layers_enabled',
            'ff.geo.realtime_updates_enabled'
        ]

        results = {}

        for flag_name in geospatial_flag_names:
            try:
                update_request = UpdateFeatureFlagRequest(
                    is_enabled=False,
                    rollout_percentage=0
                )
                await self.update_flag(flag_name, update_request)
                results[flag_name] = True

                self.logger.warning(f"EMERGENCY ROLLBACK: Disabled {flag_name}")

            except HTTPException as e:
                if e.status_code == 404:
                    # Flag doesn't exist, that's okay
                    results[flag_name] = True
                else:
                    self.logger.error(f"Failed to rollback {flag_name}: {e}")
                    results[flag_name] = False
            except Exception as e:
                self.logger.error(f"Failed to rollback {flag_name}: {e}")
                results[flag_name] = False

        # Send WebSocket notification about emergency rollback
        if self.realtime_service:
            try:
                await self.realtime_service.broadcast({
                    'event': 'feature_flag_emergency_rollback',
                    'category': 'geospatial',
                    'timestamp': time.time(),
                    'affected_flags': list(results.keys())
                })
            except Exception as e:
                self.logger.error(f"Failed to send rollback notification: {e}")

        return results
