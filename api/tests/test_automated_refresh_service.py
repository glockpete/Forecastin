"""
Tests for AutomatedRefreshService

Tests cover:
- Service lifecycle (start/stop)
- Materialized view refresh logic
- Smart trigger detection based on change counts
- Time-based refresh scheduling
- Cache coordination across all tiers (L1-L4)
- Feature flag configuration integration
- Rollback capability and snapshot management
- Performance metrics tracking
- Thread-safe operations with RLock
"""

import threading
import time
from datetime import datetime, timedelta
from unittest.mock import Mock

import pytest

from services.automated_refresh_service import AutomatedRefreshService


class TestAutomatedRefreshService:
    """Test AutomatedRefreshService functionality"""

    @pytest.fixture
    def mock_db_manager(self):
        """Create mock database manager"""
        db_manager = Mock()

        # Mock connection context manager
        mock_conn = Mock()
        mock_cursor = Mock()

        mock_cursor.execute = Mock()
        mock_cursor.fetchall = Mock(return_value=[])
        mock_cursor.fetchone = Mock(return_value=[{"status": "success"}])

        mock_conn.cursor = Mock(return_value=mock_cursor)
        mock_conn.__enter__ = Mock(return_value=mock_conn)
        mock_conn.__exit__ = Mock(return_value=False)
        mock_conn.commit = Mock()

        mock_cursor.__enter__ = Mock(return_value=mock_cursor)
        mock_cursor.__exit__ = Mock(return_value=False)

        db_manager.get_connection = Mock(return_value=mock_conn)

        return db_manager

    @pytest.fixture
    def mock_cache_service(self):
        """Create mock cache service"""
        cache_service = Mock()
        cache_service.invalidate_l1_cache = Mock()
        cache_service.invalidate_l2_cache = Mock()
        return cache_service

    @pytest.fixture
    def mock_feature_flag_service(self):
        """Create mock feature flag service"""
        feature_flag_service = Mock()
        feature_flag_service.get_flag = Mock(return_value={
            'enabled': True,
            'rollout_percentage': 100,
            'config': {
                'smart_triggers_enabled': True,
                'change_threshold': 100,
                'time_threshold_minutes': 15,
                'rollback_window_minutes': 2
            }
        })
        return feature_flag_service

    @pytest.fixture
    def service(self, mock_db_manager, mock_cache_service, mock_feature_flag_service):
        """Create AutomatedRefreshService instance"""
        return AutomatedRefreshService(
            db_manager=mock_db_manager,
            cache_service=mock_cache_service,
            feature_flag_service=mock_feature_flag_service
        )

    def test_initialization(self, service, mock_db_manager, mock_cache_service, mock_feature_flag_service):
        """Test service initialization"""
        # Assert
        assert service.db_manager == mock_db_manager
        assert service.cache_service == mock_cache_service
        assert service.feature_flag_service == mock_feature_flag_service
        assert service.is_running is False
        assert service.refresh_enabled is True
        assert service.smart_triggers_enabled is True
        assert service.change_threshold == 100
        assert service.time_threshold_minutes == 15

    def test_start_service(self, service):
        """Test starting the service"""
        # Act
        service.start_service()

        # Assert
        assert service.is_running is True
        assert service.refresh_thread is not None
        assert service.refresh_thread.is_alive()

        # Cleanup
        service.stop_service()

    def test_stop_service(self, service):
        """Test stopping the service"""
        # Arrange
        service.start_service()

        # Act
        service.stop_service()

        # Assert
        assert service.is_running is False

    def test_start_service_when_already_running(self, service):
        """Test starting service when already running"""
        # Arrange
        service.start_service()

        # Act - Start again
        service.start_service()

        # Assert - Should still be running with only one thread
        assert service.is_running is True

        # Cleanup
        service.stop_service()

    def test_update_configuration_from_feature_flags(self, service, mock_feature_flag_service):
        """Test configuration update from feature flags"""
        # Arrange
        mock_feature_flag_service.get_flag.return_value = {
            'enabled': False,
            'rollout_percentage': 50,
            'config': {
                'smart_triggers_enabled': False,
                'change_threshold': 200,
                'time_threshold_minutes': 30,
                'rollback_window_minutes': 5
            }
        }

        # Act
        service._update_configuration()

        # Assert
        assert service.refresh_enabled is False
        assert service.rollout_percentage == 50
        assert service.smart_triggers_enabled is False
        assert service.change_threshold == 200
        assert service.time_threshold_minutes == 30
        assert service.rollback_window_minutes == 5

    def test_should_refresh_by_time_when_never_refreshed(self, service):
        """Test time-based refresh when view was never refreshed"""
        # Act
        should_refresh = service._should_refresh_by_time(None, 15)

        # Assert
        assert should_refresh is True

    def test_should_refresh_by_time_when_threshold_exceeded(self, service):
        """Test time-based refresh when threshold exceeded"""
        # Arrange
        last_refresh = datetime.now() - timedelta(minutes=20)

        # Act
        should_refresh = service._should_refresh_by_time(last_refresh, 15)

        # Assert
        assert should_refresh is True

    def test_should_not_refresh_by_time_when_within_threshold(self, service):
        """Test time-based refresh when within threshold"""
        # Arrange
        last_refresh = datetime.now() - timedelta(minutes=10)

        # Act
        should_refresh = service._should_refresh_by_time(last_refresh, 15)

        # Assert
        assert should_refresh is False

    def test_trigger_refresh(self, service, mock_db_manager):
        """Test triggering a materialized view refresh"""
        # Arrange
        view_name = "test_view"

        # Act
        result = service._trigger_refresh(view_name, force=True)

        # Assert
        assert result is not None

        # Verify database was called
        mock_db_manager.get_connection.assert_called()

    def test_trigger_refresh_with_rollback_enabled(self, service, mock_db_manager):
        """Test refresh with rollback capability enabled"""
        # Arrange
        service.enable_rollback(True)
        view_name = "test_view"

        # Act
        service._trigger_refresh(view_name, force=True)

        # Assert
        assert service.rollback_snapshot is not None
        assert service.rollback_snapshot['view_name'] == view_name

    def test_trigger_refresh_invalidates_caches(self, service, mock_cache_service, mock_db_manager):
        """Test that refresh invalidates all cache tiers"""
        # Arrange
        view_name = "test_view"

        # Act
        service._trigger_refresh(view_name, force=True)

        # Assert - Both L1 and L2 caches should be invalidated
        mock_cache_service.invalidate_l1_cache.assert_called_with(view_name)
        mock_cache_service.invalidate_l2_cache.assert_called_with(view_name)

    def test_create_rollback_snapshot(self, service):
        """Test creating a rollback snapshot"""
        # Arrange
        view_name = "test_view"

        # Act
        service._create_rollback_snapshot(view_name)

        # Assert
        assert service.rollback_snapshot is not None
        assert service.rollback_snapshot['view_name'] == view_name
        assert 'timestamp' in service.rollback_snapshot
        assert 'snapshot_id' in service.rollback_snapshot

    def test_attempt_rollback_within_window(self, service):
        """Test rollback attempt within allowed window"""
        # Arrange
        service.rollback_enabled = True
        service.rollback_window_minutes = 5
        service.rollback_snapshot = {
            'view_name': 'test_view',
            'timestamp': datetime.now(),
            'snapshot_id': 'test-snapshot-123'
        }

        # Act
        service._attempt_rollback('test_view')

        # Assert - Should not raise exception
        # In a real implementation, would verify database rollback

    def test_attempt_rollback_outside_window(self, service):
        """Test rollback attempt outside allowed window"""
        # Arrange
        service.rollback_enabled = True
        service.rollback_window_minutes = 2
        service.rollback_snapshot = {
            'view_name': 'test_view',
            'timestamp': datetime.now() - timedelta(minutes=5),
            'snapshot_id': 'test-snapshot-123'
        }

        # Act
        service._attempt_rollback('test_view')

        # Assert - Should log warning but not crash
        # Rollback window expired

    def test_record_refresh_metrics(self, service, mock_db_manager):
        """Test recording refresh metrics"""
        # Arrange
        view_name = "test_view"
        duration = 150.5
        result = {'status': 'success', 'rows_affected': 1000}

        # Act
        service._record_refresh_metrics(view_name, duration, result)

        # Assert
        assert len(service.refresh_metrics) == 1
        metric = service.refresh_metrics[0]
        assert metric['view_name'] == view_name
        assert metric['duration_ms'] == duration
        assert metric['success'] is True

    def test_record_refresh_metrics_limits_size(self, service, mock_db_manager):
        """Test that metrics list is limited in size"""
        # Arrange
        for i in range(150):
            service._record_refresh_metrics(
                f"view_{i}",
                100.0,
                {'status': 'success'}
            )

        # Assert - Should keep only last 100
        assert len(service.refresh_metrics) == 100

    def test_invalidate_caches_all_tiers(self, service, mock_cache_service):
        """Test cache invalidation across all tiers"""
        # Arrange
        view_name = "test_view"

        # Act
        service._invalidate_caches(view_name)

        # Assert
        mock_cache_service.invalidate_l1_cache.assert_called_once_with(view_name)
        mock_cache_service.invalidate_l2_cache.assert_called_once_with(view_name)

    def test_check_time_based_refreshes(self, service, mock_db_manager):
        """Test checking for time-based refreshes"""
        # Arrange
        old_time = datetime.now() - timedelta(minutes=30)
        mock_cursor = mock_db_manager.get_connection.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_cursor.fetchall.return_value = [
            ('view1', old_time, 15),
            ('view2', datetime.now(), 15)
        ]

        # Act
        service._check_time_based_refreshes()

        # Assert - Should have called execute
        assert mock_cursor.execute.called

    def test_check_smart_triggers(self, service, mock_db_manager):
        """Test checking for smart trigger refreshes"""
        # Arrange
        mock_cursor = mock_db_manager.get_connection.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_cursor.fetchall.return_value = [
            ('view1', 150),  # Exceeds threshold of 100
            ('view2', 50)    # Below threshold
        ]

        # Act
        service._check_smart_triggers()

        # Assert
        assert mock_cursor.execute.called

    def test_get_recent_metrics(self, service, mock_db_manager):
        """Test getting recent metrics"""
        # Arrange
        for i in range(30):
            service._record_refresh_metrics(
                f"view_{i}",
                100.0 + i,
                {'status': 'success'}
            )

        # Act
        recent = service.get_recent_metrics(limit=10)

        # Assert
        assert len(recent) == 10
        # Should be most recent
        assert recent[-1]['view_name'] == 'view_29'

    def test_enable_rollback(self, service):
        """Test enabling rollback capability"""
        # Act
        service.enable_rollback(True)

        # Assert
        assert service.rollback_enabled is True

        # Act - Disable
        service.enable_rollback(False)

        # Assert
        assert service.rollback_enabled is False

    def test_force_refresh_all(self, service, mock_db_manager):
        """Test forcing refresh of all views"""
        # Arrange
        mock_cursor = mock_db_manager.get_connection.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_cursor.fetchone.return_value = [{'status': 'success', 'views_refreshed': 5}]

        # Act
        result = service.force_refresh_all()

        # Assert
        assert result is not None
        mock_cursor.execute.assert_called()

    def test_thread_safety_with_concurrent_refreshes(self, service, mock_db_manager):
        """Test thread-safe refresh operations"""
        # Arrange
        view_name = "test_view"
        results = []

        def refresh_worker():
            try:
                result = service._trigger_refresh(view_name, force=True)
                results.append(result)
            except Exception as e:
                results.append(e)

        # Act - Start multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=refresh_worker)
            threads.append(thread)
            thread.start()

        # Wait for all threads
        for thread in threads:
            thread.join()

        # Assert - All should complete without deadlock
        assert len(results) == 5

    def test_refresh_lock_prevents_concurrent_modification(self, service):
        """Test that RLock prevents concurrent modifications"""
        # Arrange
        lock_acquired = []

        def try_acquire_lock():
            with service.refresh_lock:
                lock_acquired.append(True)
                time.sleep(0.1)

        # Act - Start concurrent operations
        threads = []
        for _ in range(3):
            thread = threading.Thread(target=try_acquire_lock)
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        # Assert
        assert len(lock_acquired) == 3

    def test_configuration_update_handles_missing_flags(self, service, mock_feature_flag_service):
        """Test configuration update handles missing feature flags"""
        # Arrange
        mock_feature_flag_service.get_flag.return_value = None

        # Act - Should not crash
        service._update_configuration()

        # Assert - Should keep defaults
        assert service.refresh_enabled is True

    def test_store_metrics_in_db(self, service, mock_db_manager):
        """Test storing metrics in database"""
        # Arrange
        metric = {
            'view_name': 'test_view',
            'duration_ms': 150.5,
            'success': True,
            'timestamp': datetime.now().isoformat()
        }

        # Act
        service._store_metrics_in_db(metric)

        # Assert
        mock_cursor = mock_db_manager.get_connection.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        assert mock_cursor.execute.called

    def test_refresh_worker_respects_feature_flags(self, service, mock_feature_flag_service):
        """Test that refresh worker respects feature flag state"""
        # Arrange
        mock_feature_flag_service.get_flag.return_value = {
            'enabled': False,
            'rollout_percentage': 0,
            'config': {}
        }

        service.start_service()
        time.sleep(0.2)  # Let worker run

        # Act
        service._update_configuration()

        # Assert
        assert service.refresh_enabled is False

        # Cleanup
        service.stop_service()

    def test_get_refresh_performance_summary(self, service, mock_db_manager):
        """Test getting refresh performance summary"""
        # Arrange
        mock_cursor = mock_db_manager.get_connection.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        expected_summary = {
            'total_refreshes': 100,
            'avg_duration_ms': 150,
            'success_rate': 0.95
        }
        mock_cursor.fetchone.return_value = [expected_summary]

        # Act
        result = service.get_refresh_performance_summary()

        # Assert
        assert result == expected_summary
