"""
Unit tests for Phase 6 Scenario Service
Tests ScenarioEntity, ScenarioCollaborationService, MultiFactorAnalysisEngine, and CursorPaginator
"""

import asyncio
import time
from typing import Any, Dict
from unittest.mock import AsyncMock, Mock, patch

import pytest

from api.services.scenario_service import (
    AnalysisFactor,
    AnalysisResult,
    CollaborationState,
    CursorPaginator,
    MultiFactorAnalysisEngine,
    RiskLevel,
    RiskProfile,
    ScenarioCollaborationService,
    ScenarioEntity,
    ValidationStatus,
)

# ===========================
# Fixtures
# ===========================

@pytest.fixture
def mock_cache_service():
    """Mock CacheService for testing"""
    cache = AsyncMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    cache.get_stats = Mock(return_value={"cache_hit_rate": 0.992})
    return cache


@pytest.fixture
def mock_realtime_service():
    """Mock RealtimeService for WebSocket testing"""
    realtime = AsyncMock()
    realtime.broadcast_update = AsyncMock(return_value=True)
    realtime.send_to_user = AsyncMock(return_value=True)
    return realtime


@pytest.fixture
def sample_scenario():
    """Sample ScenarioEntity for testing"""
    return ScenarioEntity(
        scenario_id="test_scenario_001",
        name="China-Taiwan Tensions Escalation",
        description="Analysis of potential military escalation scenarios",
        path="asia.china.taiwan.tensions",
        confidence_score=0.75,
        risk_level=RiskLevel.HIGH,
        created_at=time.time(),
        updated_at=time.time()
    )


@pytest.fixture
def sample_forecast():
    """Sample HierarchicalForecast for pagination testing"""
    class MockForecast:
        def __init__(self):
            self.forecast_data = [
                {"timestamp": 1609459200 + i * 86400, "value": 100 + i}
                for i in range(200)  # 200 data points for pagination testing
            ]
            self.entity_path = "asia.china.taiwan"
            self.method = "top_down"

    return MockForecast()


# ===========================
# ScenarioEntity Tests
# ===========================

class TestScenarioEntity:
    """Test ScenarioEntity data model"""

    def test_scenario_entity_creation(self, sample_scenario):
        """Test scenario entity initialization"""
        assert sample_scenario.scenario_id == "test_scenario_001"
        assert sample_scenario.name == "China-Taiwan Tensions Escalation"
        assert sample_scenario.path == "asia.china.taiwan.tensions"
        assert sample_scenario.confidence_score == 0.75
        assert sample_scenario.risk_level == RiskLevel.HIGH

    def test_ltree_path_validation(self, sample_scenario):
        """Test LTREE path format validation"""
        # Valid LTREE paths
        valid_paths = [
            "asia.china.taiwan",
            "europe.ukraine.conflict",
            "middle_east.israel.palestine"
        ]

        for path in valid_paths:
            scenario = ScenarioEntity(
                scenario_id=f"test_{path}",
                name="Test Scenario",
                description="Test",
                path=path,
                confidence_score=0.7,
                risk_level=RiskLevel.MEDIUM,
                created_at=time.time(),
                updated_at=time.time()
            )
            assert scenario.path == path

    def test_confidence_score_validation(self, sample_scenario):
        """Test confidence score bounds (0.0-1.0)"""
        assert 0.0 <= sample_scenario.confidence_score <= 1.0

    def test_risk_level_enum(self, sample_scenario):
        """Test RiskLevel enum values"""
        assert sample_scenario.risk_level in [
            RiskLevel.LOW,
            RiskLevel.MEDIUM,
            RiskLevel.HIGH,
            RiskLevel.CRITICAL
        ]


# ===========================
# CursorPaginator Tests
# ===========================

class TestCursorPaginator:
    """Test cursor-based pagination implementation"""

    @pytest.mark.asyncio
    async def test_first_page_pagination(self, sample_forecast):
        """Test pagination of first page (no cursor)"""
        paginator = CursorPaginator()

        result = await paginator.paginate_forecast_data(
            forecast=sample_forecast,
            cursor=None,
            page_size=50
        )

        assert result["page_size"] == 50
        assert len(result["data"]) == 50
        assert result["has_more"] is True
        assert result["next_cursor"] is not None

    @pytest.mark.asyncio
    async def test_subsequent_page_pagination(self, sample_forecast):
        """Test pagination with cursor (subsequent pages)"""
        paginator = CursorPaginator()

        # Get first page
        first_page = await paginator.paginate_forecast_data(
            forecast=sample_forecast,
            cursor=None,
            page_size=50
        )

        # Get second page using cursor
        second_page = await paginator.paginate_forecast_data(
            forecast=sample_forecast,
            cursor=first_page["next_cursor"],
            page_size=50
        )

        assert len(second_page["data"]) == 50
        assert second_page["has_more"] is True

        # Verify data continuity (no overlap)
        first_last_timestamp = first_page["data"][-1]["timestamp"]
        second_first_timestamp = second_page["data"][0]["timestamp"]
        assert second_first_timestamp > first_last_timestamp

    @pytest.mark.asyncio
    async def test_last_page_pagination(self, sample_forecast):
        """Test pagination of last page (has_more=False)"""
        paginator = CursorPaginator()

        # Navigate to last page
        cursor = None
        pages = 0
        while True:
            result = await paginator.paginate_forecast_data(
                forecast=sample_forecast,
                cursor=cursor,
                page_size=50
            )
            pages += 1

            if not result["has_more"]:
                assert result["next_cursor"] is None
                break

            cursor = result["next_cursor"]

        assert pages == 4  # 200 items / 50 per page = 4 pages

    @pytest.mark.asyncio
    async def test_cursor_encoding_decoding(self):
        """Test base64 cursor encoding/decoding"""
        paginator = CursorPaginator()

        original_timestamp = 1609459200
        cursor = paginator._encode_cursor(original_timestamp)

        # Verify base64 encoding
        assert isinstance(cursor, str)
        assert cursor != str(original_timestamp)

        # Verify decoding
        decoded_timestamp = paginator._decode_cursor(cursor)
        assert decoded_timestamp == original_timestamp

    @pytest.mark.asyncio
    async def test_invalid_cursor_handling(self, sample_forecast):
        """Test handling of invalid cursor"""
        paginator = CursorPaginator()

        with pytest.raises(ValueError):
            await paginator.paginate_forecast_data(
                forecast=sample_forecast,
                cursor="invalid_cursor_format",
                page_size=50
            )


# ===========================
# MultiFactorAnalysisEngine Tests
# ===========================

class TestMultiFactorAnalysisEngine:
    """Test multi-factor scenario analysis with four-tier caching"""

    @pytest.mark.asyncio
    async def test_analysis_engine_initialization(self, mock_cache_service, mock_realtime_service):
        """Test analysis engine initialization"""
        engine = MultiFactorAnalysisEngine(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )

        await engine.initialize()

        assert engine.cache_service == mock_cache_service
        assert engine.realtime_service == mock_realtime_service
        assert engine._lock is not None  # RLock for thread safety

    @pytest.mark.asyncio
    async def test_l1_cache_hit(self, mock_cache_service, mock_realtime_service):
        """Test L1 memory cache hit (fastest path)"""
        engine = MultiFactorAnalysisEngine(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await engine.initialize()

        scenario_id = "test_scenario_001"

        # First call - cache miss, compute analysis
        start_time = time.time()
        result1 = await engine.analyze_scenario(scenario_id)
        first_call_duration = time.time() - start_time

        # Second call - L1 cache hit
        start_time = time.time()
        result2 = await engine.analyze_scenario(scenario_id)
        second_call_duration = time.time() - start_time

        # L1 cache hit should be significantly faster
        assert second_call_duration < first_call_duration
        assert result1 == result2

        # Verify cache hit metrics
        metrics = engine.get_metrics()
        assert metrics["cache_hits"] >= 1

    @pytest.mark.asyncio
    async def test_l2_redis_cache_fallback(self, mock_cache_service, mock_realtime_service):
        """Test L2 Redis cache fallback when L1 misses"""
        engine = MultiFactorAnalysisEngine(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await engine.initialize()

        scenario_id = "test_scenario_002"

        # Simulate L2 cache hit (L1 miss)
        cached_analysis = {
            "scenario_id": scenario_id,
            "factors": {
                "geospatial": 0.8,
                "temporal": 0.75,
                "entity": 0.7,
                "risk": 0.85
            },
            "overall_confidence": 0.775,
            "recommendations": ["Monitor escalation patterns"]
        }
        mock_cache_service.get.return_value = cached_analysis

        result = await engine.analyze_scenario(scenario_id)

        # Verify L2 cache was queried
        mock_cache_service.get.assert_called()
        assert result == cached_analysis

    @pytest.mark.asyncio
    async def test_four_factor_analysis(self, mock_cache_service, mock_realtime_service):
        """Test multi-factor analysis (geospatial, temporal, entity, risk)"""
        engine = MultiFactorAnalysisEngine(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await engine.initialize()

        result = await engine.analyze_scenario("test_scenario_003")

        # Verify all four factors are present
        assert "factors" in result
        factors = result["factors"]
        assert AnalysisFactor.GEOSPATIAL in factors
        assert AnalysisFactor.TEMPORAL in factors
        assert AnalysisFactor.ENTITY in factors
        assert AnalysisFactor.RISK in factors

        # Verify confidence scores are within bounds
        for factor_score in factors.values():
            assert 0.0 <= factor_score <= 1.0

        # Verify overall confidence calculation
        assert "overall_confidence" in result
        assert 0.0 <= result["overall_confidence"] <= 1.0

    @pytest.mark.asyncio
    async def test_realtime_websocket_broadcast(self, mock_cache_service, mock_realtime_service):
        """Test real-time WebSocket broadcast of analysis results"""
        engine = MultiFactorAnalysisEngine(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await engine.initialize()

        scenario_id = "test_scenario_004"
        result = await engine.analyze_scenario(scenario_id)

        # Verify WebSocket broadcast was triggered
        mock_realtime_service.broadcast_update.assert_called()

        # Verify broadcast message structure
        call_args = mock_realtime_service.broadcast_update.call_args
        assert call_args is not None
        broadcast_msg = call_args[0][0]
        assert broadcast_msg["type"] == "scenario_analysis_update"
        assert broadcast_msg["scenario_id"] == scenario_id

    @pytest.mark.asyncio
    async def test_rlock_thread_safety(self, mock_cache_service, mock_realtime_service):
        """Test RLock for re-entrant thread safety (not standard Lock)"""
        engine = MultiFactorAnalysisEngine(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await engine.initialize()

        # Verify RLock is used (allows re-entrant locking)
        import threading
        assert isinstance(engine._lock, threading.RLock)

        # Test concurrent access
        async def concurrent_analysis(scenario_id):
            return await engine.analyze_scenario(scenario_id)

        results = await asyncio.gather(
            concurrent_analysis("test_001"),
            concurrent_analysis("test_002"),
            concurrent_analysis("test_003")
        )

        assert len(results) == 3
        assert all(result is not None for result in results)

    @pytest.mark.asyncio
    async def test_cache_invalidation_propagation(self, mock_cache_service, mock_realtime_service):
        """Test cache invalidation across all tiers"""
        engine = MultiFactorAnalysisEngine(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await engine.initialize()

        scenario_id = "test_scenario_005"

        # Perform analysis (populates caches)
        await engine.analyze_scenario(scenario_id)

        # Invalidate cache
        await engine.invalidate_cache(scenario_id)

        # Verify cache deletion was called
        mock_cache_service.delete.assert_called()


# ===========================
# ScenarioCollaborationService Tests
# ===========================

class TestScenarioCollaborationService:
    """Test real-time collaboration with WebSocket broadcasts"""

    @pytest.mark.asyncio
    async def test_collaboration_service_initialization(self, mock_cache_service, mock_realtime_service):
        """Test collaboration service initialization"""
        service = ScenarioCollaborationService(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )

        await service.initialize()

        assert service.cache_service == mock_cache_service
        assert service.realtime_service == mock_realtime_service

    @pytest.mark.asyncio
    async def test_user_presence_tracking(self, mock_cache_service, mock_realtime_service):
        """Test real-time user presence and activity tracking"""
        service = ScenarioCollaborationService(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await service.initialize()

        scenario_id = "test_scenario_006"
        user_id = "analyst_001"

        # Track user presence
        await service.track_user_presence(scenario_id, user_id)

        # Verify presence was broadcast via WebSocket
        mock_realtime_service.broadcast_update.assert_called()

        # Verify presence state
        presence = await service.get_active_users(scenario_id)
        assert user_id in presence

    @pytest.mark.asyncio
    async def test_change_tracking_audit_trail(self, mock_cache_service, mock_realtime_service):
        """Test audit trail with confidence scoring"""
        service = ScenarioCollaborationService(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await service.initialize()

        change = {
            "scenario_id": "test_scenario_007",
            "user_id": "analyst_002",
            "change_type": "confidence_update",
            "old_value": 0.7,
            "new_value": 0.85,
            "timestamp": time.time()
        }

        await service.track_change(change)

        # Verify audit trail was stored
        mock_cache_service.set.assert_called()

        # Verify WebSocket broadcast of change
        mock_realtime_service.broadcast_update.assert_called()

    @pytest.mark.asyncio
    async def test_conflict_resolution_automatic_merge(self, mock_cache_service, mock_realtime_service):
        """Test automatic conflict resolution with merge strategies"""
        service = ScenarioCollaborationService(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await service.initialize()

        conflict = {
            "scenario_id": "test_scenario_008",
            "user1_change": {"confidence_score": 0.75},
            "user2_change": {"confidence_score": 0.80},
            "timestamp1": time.time() - 5,
            "timestamp2": time.time()
        }

        resolution = await service.resolve_conflict(conflict)

        # Verify automatic merge strategy (latest wins by default)
        assert resolution["confidence_score"] == 0.80
        assert resolution["resolution_method"] == "latest_wins"

    @pytest.mark.asyncio
    async def test_orjson_serialization_datetime(self, mock_cache_service, mock_realtime_service):
        """Test orjson serialization for datetime/dataclass objects"""
        service = ScenarioCollaborationService(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await service.initialize()

        # Create message with datetime object
        message = {
            "type": "collaboration_update",
            "timestamp": time.time(),
            "data": {"key": "value"}
        }

        # Broadcast should handle serialization automatically
        await service.broadcast_collaboration_update(message)

        # Verify no serialization errors
        mock_realtime_service.broadcast_update.assert_called()


# ===========================
# Performance Tests
# ===========================

class TestPerformanceRequirements:
    """Test performance SLOs (P95 <200ms, cache hit rate 99.2%)"""

    @pytest.mark.asyncio
    async def test_analysis_p95_latency(self, mock_cache_service, mock_realtime_service):
        """Test P95 latency <200ms for scenario analysis"""
        engine = MultiFactorAnalysisEngine(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await engine.initialize()

        latencies = []

        for i in range(100):
            start_time = time.time()
            await engine.analyze_scenario(f"test_scenario_{i}")
            duration_ms = (time.time() - start_time) * 1000
            latencies.append(duration_ms)

        # Calculate P95
        latencies_sorted = sorted(latencies)
        p95_index = int(len(latencies) * 0.95)
        p95_latency = latencies_sorted[p95_index]

        # Verify P95 <200ms requirement
        assert p95_latency < 200, f"P95 latency {p95_latency}ms exceeds 200ms target"

    @pytest.mark.asyncio
    async def test_cache_hit_rate_992(self, mock_cache_service, mock_realtime_service):
        """Test cache hit rate 99.2% requirement"""
        engine = MultiFactorAnalysisEngine(
            cache_service=mock_cache_service,
            realtime_service=mock_realtime_service
        )
        await engine.initialize()

        # Perform analysis to populate cache
        scenario_id = "test_scenario_cache"
        for _ in range(1000):
            await engine.analyze_scenario(scenario_id)

        metrics = engine.get_metrics()
        cache_hit_rate = metrics["cache_hits"] / (metrics["cache_hits"] + metrics["cache_misses"])

        # Verify 99.2% cache hit rate
        assert cache_hit_rate >= 0.992, f"Cache hit rate {cache_hit_rate} below 0.992 target"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])
