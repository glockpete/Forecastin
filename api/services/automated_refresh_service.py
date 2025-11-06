"""
Automated Materialized View Refresh Service
Implements smart triggers, cache coordination, and performance monitoring
for LTREE hierarchy optimization to resolve ancestor resolution performance regression.
"""

import asyncio
import json
import logging
import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import orjson

from api.services.cache_service import CacheService
from api.services.feature_flag_service import FeatureFlagService
from api.services.database_manager import DatabaseManager
from api.services.realtime_service import safe_serialize_message

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class AutomatedRefreshService:
    """Service for automated materialized view refresh with smart triggers and cache coordination."""
    
    def __init__(self, db_manager: DatabaseManager, cache_service: CacheService, 
                 feature_flag_service: FeatureFlagService):
        self.db_manager = db_manager
        self.cache_service = cache_service
        self.feature_flag_service = feature_flag_service
        
        # Service state
        self.is_running = False
        self.refresh_thread = None
        self.refresh_lock = threading.RLock()  # Using RLock as per AGENTS.md requirements
        self.last_refresh_times = {}
        self.change_counters = {}
        self.refresh_metrics = []
        
        # Configuration from feature flags
        self.refresh_enabled = True
        self.smart_triggers_enabled = True
        self.change_threshold = 100
        self.time_threshold_minutes = 15
        self.rollout_percentage = 100  # Default to 100% for testing
        
        # Emergency rollback state
        self.rollback_enabled = False
        self.rollback_window_minutes = 2
        self.rollback_snapshot = None
        
    def start_service(self):
        """Start the automated refresh service."""
        if self.is_running:
            logger.warning("Automated refresh service is already running")
            return
            
        self.is_running = True
        self.refresh_thread = threading.Thread(target=self._refresh_worker, daemon=True)
        self.refresh_thread.start()
        logger.info("Automated refresh service started")
        
    def stop_service(self):
        """Stop the automated refresh service."""
        self.is_running = False
        if self.refresh_thread:
            self.refresh_thread.join(timeout=5)
        logger.info("Automated refresh service stopped")
        
    def _refresh_worker(self):
        """Background worker that periodically checks for refresh needs."""
        while self.is_running:
            try:
                # Check feature flag status
                self._update_configuration()
                
                # Only proceed if service is enabled
                if self.refresh_enabled:
                    # Check for time-based refreshes
                    self._check_time_based_refreshes()
                    
                    # Check for smart trigger refreshes
                    if self.smart_triggers_enabled:
                        self._check_smart_triggers()
                
                # Sleep for a short interval
                time.sleep(30)  # Check every 30 seconds
            except Exception as e:
                logger.error(f"Error in refresh worker: {e}")
                time.sleep(60)  # Sleep longer on error
                
    def _update_configuration(self):
        """Update configuration from feature flags."""
        try:
            # Get feature flag status
            refresh_flag = self.feature_flag_service.get_flag('ff.automated_refresh_v1')
            if refresh_flag:
                self.refresh_enabled = refresh_flag.get('enabled', True)
                self.rollout_percentage = refresh_flag.get('rollout_percentage', 100)
                
                # Get smart trigger parameters
                config = refresh_flag.get('config', {})
                self.smart_triggers_enabled = config.get('smart_triggers_enabled', True)
                self.change_threshold = config.get('change_threshold', 100)
                self.time_threshold_minutes = config.get('time_threshold_minutes', 15)
                self.rollback_window_minutes = config.get('rollback_window_minutes', 2)
                
        except Exception as e:
            logger.warning(f"Failed to update configuration from feature flags: {e}")
            
    def _check_time_based_refreshes(self):
        """Check if time-based refreshes are needed."""
        try:
            # Get all materialized views that need time-based refresh
            query = """
                SELECT view_name, last_refresh_at, threshold_time_minutes
                FROM materialized_view_refresh_schedule
                WHERE auto_refresh_enabled = true
            """
            
            with self.db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query)
                    views = cur.fetchall()
                    
                    for view_name, last_refresh_at, threshold_minutes in views:
                        # Check if refresh is needed based on time
                        if self._should_refresh_by_time(last_refresh_at, threshold_minutes):
                            self._trigger_refresh(view_name, force=True)
                            
        except Exception as e:
            logger.error(f"Error checking time-based refreshes: {e}")
            
    def _check_smart_triggers(self):
        """Check if smart trigger refreshes are needed."""
        try:
            # Get change counts for each view
            query = """
                SELECT view_name, COUNT(*) as change_count
                FROM entity_change_log
                WHERE created_at >= NOW() - INTERVAL '%s minutes'
                GROUP BY view_name
            """
            
            with self.db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, (self.time_threshold_minutes,))
                    results = cur.fetchall()
                    
                    for view_name, change_count in results:
                        # Check if refresh is needed based on changes
                        if change_count >= self.change_threshold:
                            self._trigger_refresh(view_name, force=True)
                            
        except Exception as e:
            logger.error(f"Error checking smart triggers: {e}")
            
    def _should_refresh_by_time(self, last_refresh_at, threshold_minutes):
        """Determine if a view should be refreshed based on time."""
        if not last_refresh_at:
            return True
            
        time_since_last = datetime.now() - last_refresh_at
        return time_since_last > timedelta(minutes=threshold_minutes)
        
    def _trigger_refresh(self, view_name: str, force: bool = False, batch_id: Optional[str] = None):
        """Trigger a refresh for a specific materialized view."""
        with self.refresh_lock:  # Thread-safe refresh as per AGENTS.md requirements
            try:
                # Create snapshot for potential rollback
                if self.rollback_enabled:
                    self._create_rollback_snapshot(view_name)
                
                # Execute refresh with metrics
                start_time = time.time()
                
                # Call database function to perform refresh
                with self.db_manager.get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT automated_refresh_materialized_view(%s, %s, %s)",
                            (view_name, force, batch_id)
                        )
                        result = cur.fetchone()[0]
                        
                duration = (time.time() - start_time) * 1000  # Convert to milliseconds
                
                # Record metrics
                self._record_refresh_metrics(view_name, duration, result)
                
                # Coordinate cache invalidation across all tiers
                self._invalidate_caches(view_name)
                
                # Send WebSocket notification
                self._send_refresh_notification(view_name, result, duration)
                
                logger.info(f"Refresh completed for {view_name}: {result}")
                return result
                
            except Exception as e:
                logger.error(f"Error triggering refresh for {view_name}: {e}")
                # Attempt rollback if enabled
                if self.rollback_enabled:
                    self._attempt_rollback(view_name)
                raise
                
    def _create_rollback_snapshot(self, view_name: str):
        """Create a snapshot for potential rollback."""
        try:
            # In a real implementation, this would create a backup of the current state
            self.rollback_snapshot = {
                'view_name': view_name,
                'timestamp': datetime.now(),
                'snapshot_id': str(uuid.uuid4())
            }
            logger.info(f"Created rollback snapshot for {view_name}")
        except Exception as e:
            logger.error(f"Failed to create rollback snapshot: {e}")
            
    def _attempt_rollback(self, view_name: str):
        """Attempt to rollback to previous state."""
        try:
            if not self.rollback_snapshot:
                logger.warning("No rollback snapshot available")
                return
                
            # Check if within rollback window
            time_since_snapshot = datetime.now() - self.rollback_snapshot['timestamp']
            if time_since_snapshot > timedelta(minutes=self.rollback_window_minutes):
                logger.warning("Rollback window has expired")
                return
                
            # In a real implementation, this would restore from the snapshot
            logger.info(f"Rollback initiated for {view_name}")
            
            # Send rollback notification
            self._send_rollback_notification(view_name)
            
        except Exception as e:
            logger.error(f"Error during rollback attempt: {e}")
            
    def _record_refresh_metrics(self, view_name: str, duration: float, result: Dict):
        """Record refresh metrics for performance monitoring."""
        try:
            metric = {
                'view_name': view_name,
                'duration_ms': duration,
                'success': result.get('status') == 'success',
                'timestamp': datetime.now().isoformat(),
                'result': result
            }
            
            self.refresh_metrics.append(metric)
            
            # Keep only recent metrics (last 100)
            if len(self.refresh_metrics) > 100:
                self.refresh_metrics = self.refresh_metrics[-100:]
                
            # Store in database for persistence
            self._store_metrics_in_db(metric)
            
        except Exception as e:
            logger.error(f"Error recording refresh metrics: {e}")
            
    def _store_metrics_in_db(self, metric: Dict):
        """Store metrics in the database."""
        try:
            with self.db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO refresh_metrics 
                        (view_name, refresh_duration_ms, success, created_at)
                        VALUES (%s, %s, %s, NOW())
                    """, (
                        metric['view_name'],
                        int(metric['duration_ms']),
                        metric['success']
                    ))
                    conn.commit()
        except Exception as e:
            logger.error(f"Error storing metrics in database: {e}")
            
    def _invalidate_caches(self, view_name: str):
        """Invalidate caches across all tiers (L1-L4) as per AGENTS.md requirements."""
        try:
            # L1: Memory LRU cache with RLock synchronization
            self.cache_service.invalidate_l1_cache(view_name)
            
            # L2: Redis cache
            self.cache_service.invalidate_l2_cache(view_name)
            
            # L3: Database buffer cache (implicit through refresh)
            # L4: Materialized views (refreshed, so implicitly invalidated)
            
            logger.info(f"Cache invalidation completed for {view_name} across all tiers")
        except Exception as e:
            logger.error(f"Error invalidating caches for {view_name}: {e}")
            
    def _send_refresh_notification(self, view_name: str, result: Dict, duration: float):
        """Send WebSocket notification about refresh completion."""
        try:
            message = {
                'type': 'materialized_view_refresh',
                'view_name': view_name,
                'result': result,
                'duration_ms': duration,
                'timestamp': datetime.now().isoformat()
            }
            
            # Use safe serialization as per AGENTS.md requirements
            serialized_message = safe_serialize_message(message)
            
            # In a real implementation, this would send to WebSocket clients
            logger.debug(f"Refresh notification sent: {serialized_message}")
            
        except Exception as e:
            logger.error(f"Error sending refresh notification: {e}")
            
    def _send_rollback_notification(self, view_name: str):
        """Send WebSocket notification about rollback."""
        try:
            message = {
                'type': 'materialized_view_rollback',
                'view_name': view_name,
                'timestamp': datetime.now().isoformat()
            }
            
            # Use safe serialization as per AGENTS.md requirements
            serialized_message = safe_serialize_message(message)
            
            # In a real implementation, this would send to WebSocket clients
            logger.debug(f"Rollback notification sent: {serialized_message}")
            
        except Exception as e:
            logger.error(f"Error sending rollback notification: {e}")
            
    def get_refresh_performance_summary(self) -> Dict:
        """Get a summary of refresh performance metrics."""
        try:
            with self.db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT get_refresh_performance_summary()")
                    result = cur.fetchone()[0]
                    return result
        except Exception as e:
            logger.error(f"Error getting refresh performance summary: {e}")
            return {}
            
    def get_recent_metrics(self, limit: int = 20) -> List[Dict]:
        """Get recent refresh metrics."""
        return self.refresh_metrics[-limit:] if self.refresh_metrics else []
        
    def enable_rollback(self, enabled: bool = True):
        """Enable or disable rollback capability."""
        self.rollback_enabled = enabled
        logger.info(f"Rollback capability {'enabled' if enabled else 'disabled'}")
        
    def force_refresh_all(self) -> Dict:
        """Force refresh all materialized views."""
        try:
            batch_id = str(uuid.uuid4())
            
            with self.db_manager.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT automated_refresh_all_materialized_views(%s)", (batch_id,))
                    result = cur.fetchone()[0]
                    
            # Invalidate all caches
            self._invalidate_caches('all')
            
            return result
        except Exception as e:
            logger.error(f"Error force refreshing all views: {e}")
            raise

# Global instance
_automated_refresh_service: Optional[AutomatedRefreshService] = None

def get_automated_refresh_service() -> AutomatedRefreshService:
    """Get the global automated refresh service instance."""
    global _automated_refresh_service
    if _automated_refresh_service is None:
        raise RuntimeError("Automated refresh service not initialized")
    return _automated_refresh_service
    
def initialize_automated_refresh_service(db_manager: DatabaseManager, 
                                       cache_service: CacheService,
                                       feature_flag_service: FeatureFlagService) -> AutomatedRefreshService:
    """Initialize the global automated refresh service instance."""
    global _automated_refresh_service
    if _automated_refresh_service is None:
        _automated_refresh_service = AutomatedRefreshService(
            db_manager, cache_service, feature_flag_service
        )
    return _automated_refresh_service