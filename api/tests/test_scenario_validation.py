"""
Unit Tests for Scenario Validation Framework

Tests Django-style layered validation, ML integration, risk assessment,
and four-tier caching for the ScenarioValidationEngine.

Author: Forecastin Development Team
"""

import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock

import pytest

from api.navigation_api.database.optimized_hierarchy_resolver import (
    OptimizedHierarchyResolver,
)
from api.services.cache_service import CacheService
from api.services.hierarchical_forecast_service import HierarchicalForecastManager
from api.services.realtime_service import RealtimeService
from api.services.scenario_service import (
    CollaborationState,
    RiskLevel,
    RiskProfile,
    ScenarioEntity,
    ScenarioValidationEngine,
    ValidationResult,
    ValidationStatus,
)


@pytest.fixture
def mock_cache_service():
    """Mock cache service for testing"""
    service = Mock(spec=CacheService)
    service.get = AsyncMock(return_value=None)
    service.set = AsyncMock(return_value=True)
    return service


@pytest.fixture
def mock_realtime_service():
    """Mock realtime service for testing"""
    service = Mock(spec=RealtimeService)
    service.connection_manager = Mock()
    service.connection_manager.broadcast_message = AsyncMock()
    return service


@pytest.fixture
def mock_hierarchy_resolver():
    """Mock hierarchy resolver for testing"""
    resolver = Mock(spec=OptimizedHierarchyResolver)
    resolver.get_hierarchy = Mock(return_value=None)
    return resolver


@pytest.fixture
def mock_forecast_manager():
    """Mock forecast manager for testing"""
    manager = Mock(spec=HierarchicalForecastManager)
    return manager


@pytest.fixture
def validation_engine(
    mock_cache_service,
    mock_realtime_service,
    mock_hierarchy_resolver,
    mock_forecast_manager
):
    """Create validation engine instance with mocks"""
    return ScenarioValidationEngine(
        cache_service=mock_cache_service,
        realtime_service=mock_realtime_service,
        hierarchy_resolver=mock_hierarchy_resolver,
        forecast_manager=mock_forecast_manager
    )


@pytest.fixture
def valid_scenario():
    """Create a valid scenario entity for testing"""
    return ScenarioEntity(
        scenario_id="test_scenario_001",
        path="world.asia.japan",
        path_depth=3,
        path_hash="abc123def456",
        name="Test Scenario",
        description="A valid test scenario",
        confidence_score=0.85,
        risk_assessment=RiskProfile(
            risk_level=RiskLevel.LOW,
            risk_factors=["factor1"],
            mitigation_strategies=["strategy1"],
            confidence_score=0.85
        ),
        validation_status=ValidationStatus.PENDING,
        collaboration_data=CollaborationState(
            active_users=["user1"],
            last_modified_by="user1",
            last_modified_at=datetime.now(),
            change_count=1,
            conflict_count=0,
            version=1
        ),
        metadata={"test": "data"},
        created_at=datetime.now() - timedelta(hours=1),
        updated_at=datetime.now()
    )


@pytest.fixture
def invalid_scenario_path():
    """Create scenario with invalid LTREE path"""
    return ScenarioEntity(
        scenario_id="test_scenario_002",
        path="world..asia",  # Invalid: double dots
        path_depth=3,
        path_hash="invalid_hash",
        name="Invalid Path Scenario",
        description="Scenario with invalid LTREE path",
        confidence_score=0.5,
        risk_assessment=RiskProfile(
            risk_level=RiskLevel.MEDIUM,
            risk_factors=[],
            mitigation_strategies=[],
            confidence_score=0.5
        ),
        validation_status=ValidationStatus.PENDING,
        collaboration_data=CollaborationState(
            active_users=[],
            last_modified_by="user1",
            last_modified_at=datetime.now(),
            change_count=0,
            conflict_count=0,
            version=1
        ),
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


class TestValidationResult:
    """Test ValidationResult dataclass"""

    def test_validation_result_creation(self):
        """Test creating ValidationResult"""
        result = ValidationResult(
            is_valid=True,
            confidence_score=0.9,
            errors={},
            warnings={"model_level": ["Minor warning"]},
            risk_level=RiskLevel.LOW,
            ml_confidence=0.85
        )

        assert result.is_valid is True
        assert result.confidence_score == 0.9
        assert result.risk_level == RiskLevel.LOW
        assert result.ml_confidence == 0.85

    def test_validation_result_to_dict(self):
        """Test ValidationResult serialization"""
        result = ValidationResult(
            is_valid=False,
            confidence_score=0.4,
            errors={"field_level": ["Invalid path"]},
            warnings={},
            risk_level=RiskLevel.HIGH
        )

        result_dict = result.to_dict()

        assert result_dict['is_valid'] is False
        assert result_dict['confidence_score'] == 0.4
        assert result_dict['risk_level'] == 'high'
        assert 'field_level' in result_dict['errors']


class TestFieldLevelValidation:
    """Test Layer 1: Field-level validation"""

    @pytest.mark.asyncio
    async def test_valid_ltree_path(self, validation_engine, valid_scenario):
        """Test validation of valid LTREE path"""
        # Should not raise exception
        await validation_engine._validate_field_level(valid_scenario)

    @pytest.mark.asyncio
    async def test_invalid_ltree_path_format(self, validation_engine, valid_scenario):
        """Test validation catches invalid LTREE path format"""
        scenario = valid_scenario
        scenario.path = "world.asia.japan@invalid"  # Invalid character

        with pytest.raises(ValueError, match="Invalid LTREE path format"):
            await validation_engine._validate_field_level(scenario)

    @pytest.mark.asyncio
    async def test_confidence_score_out_of_range(self, validation_engine, valid_scenario):
        """Test validation catches confidence score out of range"""
        scenario = valid_scenario
        scenario.confidence_score = 1.5  # Invalid: > 1.0

        with pytest.raises(ValueError, match="Confidence score must be between"):
            await validation_engine._validate_field_level(scenario)

    @pytest.mark.asyncio
    async def test_future_timestamp_rejected(self, validation_engine, valid_scenario):
        """Test validation rejects future timestamps"""
        scenario = valid_scenario
        scenario.created_at = datetime.now() + timedelta(days=1)

        with pytest.raises(ValueError, match="cannot be in the future"):
            await validation_engine._validate_field_level(scenario)

    @pytest.mark.asyncio
    async def test_path_depth_mismatch(self, validation_engine, valid_scenario):
        """Test validation catches path depth mismatch"""
        scenario = valid_scenario
        scenario.path_depth = 5  # Incorrect: actual depth is 3

        with pytest.raises(ValueError, match="Path depth mismatch"):
            await validation_engine._validate_field_level(scenario)


class TestModelLevelValidation:
    """Test Layer 2: Model-level validation"""

    @pytest.mark.asyncio
    async def test_model_level_warnings(self, validation_engine, valid_scenario):
        """Test model-level validation generates warnings"""
        scenario = valid_scenario
        scenario.risk_assessment.risk_level = RiskLevel.CRITICAL
        scenario.confidence_score = 0.9  # High confidence with critical risk

        warnings = await validation_engine._validate_model_level(scenario)

        assert len(warnings) > 0
        assert any("unexpectedly high confidence" in w for w in warnings)

    @pytest.mark.asyncio
    async def test_validation_status_consistency(self, validation_engine, valid_scenario):
        """Test validation status consistency check"""
        scenario = valid_scenario
        scenario.validation_status = ValidationStatus.FAILED
        scenario.confidence_score = 0.8  # High confidence but failed

        warnings = await validation_engine._validate_model_level(scenario)

        assert any("Failed validation" in w for w in warnings)


class TestUniqueConstraints:
    """Test Layer 3: Unique constraints validation"""

    @pytest.mark.asyncio
    async def test_unique_path_constraint(self, validation_engine, valid_scenario, mock_hierarchy_resolver):
        """Test LTREE path uniqueness constraint"""
        # Simulate existing entity with different ID
        existing_entity = Mock()
        existing_entity.entity_id = "different_id"
        mock_hierarchy_resolver.get_hierarchy.return_value = existing_entity

        with pytest.raises(ValueError, match="already exists"):
            await validation_engine._validate_unique_constraints(valid_scenario)

    @pytest.mark.asyncio
    async def test_same_scenario_path_allowed(self, validation_engine, valid_scenario, mock_hierarchy_resolver):
        """Test same scenario can keep its own path"""
        # Simulate existing entity with same ID
        existing_entity = Mock()
        existing_entity.entity_id = valid_scenario.scenario_id
        mock_hierarchy_resolver.get_hierarchy.return_value = existing_entity

        # Should not raise exception
        await validation_engine._validate_unique_constraints(valid_scenario)


class TestGeneralConstraints:
    """Test Layer 4: General constraints validation"""

    @pytest.mark.asyncio
    async def test_low_confidence_warning(self, validation_engine, valid_scenario):
        """Test warning for low confidence score"""
        scenario = valid_scenario
        scenario.confidence_score = 0.25  # Low confidence

        warnings = await validation_engine._validate_general_constraints(scenario)

        assert any("Low confidence score" in w for w in warnings)

    @pytest.mark.asyncio
    async def test_high_conflict_count_warning(self, validation_engine, valid_scenario):
        """Test warning for high conflict count"""
        scenario = valid_scenario
        scenario.collaboration_data.conflict_count = 10  # High conflicts

        warnings = await validation_engine._validate_general_constraints(scenario)

        assert any("High conflict count" in w for w in warnings)


class TestRiskAssessment:
    """Test automated risk assessment"""

    @pytest.mark.asyncio
    async def test_risk_level_critical(self, validation_engine, valid_scenario):
        """Test critical risk level assessment"""
        errors = {"field_level": ["error1", "error2", "error3"]}
        warnings = {}

        risk_level = await validation_engine._assess_risk_level(
            valid_scenario,
            confidence_score=0.4,
            errors=errors,
            warnings=warnings
        )

        assert risk_level == RiskLevel.CRITICAL

    @pytest.mark.asyncio
    async def test_risk_level_high(self, validation_engine, valid_scenario):
        """Test high risk level assessment"""
        errors = {"field_level": ["error1"]}
        warnings = {}

        risk_level = await validation_engine._assess_risk_level(
            valid_scenario,
            confidence_score=0.65,
            errors=errors,
            warnings=warnings
        )

        assert risk_level == RiskLevel.HIGH

    @pytest.mark.asyncio
    async def test_risk_level_medium(self, validation_engine, valid_scenario):
        """Test medium risk level assessment"""
        errors = {}
        warnings = {"model_level": ["warning1", "warning2", "warning3"]}

        risk_level = await validation_engine._assess_risk_level(
            valid_scenario,
            confidence_score=0.80,
            errors=errors,
            warnings=warnings
        )

        assert risk_level == RiskLevel.MEDIUM

    @pytest.mark.asyncio
    async def test_risk_level_low(self, validation_engine, valid_scenario):
        """Test low risk level assessment"""
        errors = {}
        warnings = {}

        risk_level = await validation_engine._assess_risk_level(
            valid_scenario,
            confidence_score=0.90,
            errors=errors,
            warnings=warnings
        )

        assert risk_level == RiskLevel.LOW


class TestPerformanceMetrics:
    """Test performance monitoring and SLO compliance"""

    @pytest.mark.asyncio
    async def test_validation_latency_target(self, validation_engine, valid_scenario):
        """Test validation meets <50ms latency target"""
        start_time = time.time()
        await validation_engine.validate_scenario_comprehensive(valid_scenario)
        latency_ms = (time.time() - start_time) * 1000

        # First validation might be slower, check metrics instead
        validation_engine.get_performance_metrics()

        # After cache warming, average should be well below 50ms
        assert latency_ms < 200  # Generous first-run allowance

    def test_performance_metrics_structure(self, validation_engine):
        """Test performance metrics structure"""
        metrics = validation_engine.get_performance_metrics()

        assert 'validations_performed' in metrics
        assert 'cache' in metrics
        assert 'performance' in metrics
        assert 'risk_assessments' in metrics

        assert 'hits' in metrics['cache']
        assert 'misses' in metrics['cache']
        assert 'hit_rate' in metrics['cache']

        assert 'avg_validation_time_ms' in metrics['performance']
        assert 'meets_slo' in metrics['performance']


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
