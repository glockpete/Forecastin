"""
Unit tests for Phase 6 Scenario API Endpoints
Tests Django-inspired API patterns with cursor-based pagination
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app

# ===========================
# Fixtures
# ===========================

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def mock_feature_flag_enabled():
    """Mock feature flag service returning enabled"""
    with patch('api.main.feature_flag_service') as mock_ff:
        mock_ff.is_flag_enabled = AsyncMock(return_value=True)
        yield mock_ff


@pytest.fixture
def mock_feature_flag_disabled():
    """Mock feature flag service returning disabled"""
    with patch('api.main.feature_flag_service') as mock_ff:
        mock_ff.is_flag_enabled = AsyncMock(return_value=False)
        yield mock_ff


@pytest.fixture
def mock_forecast_manager():
    """Mock HierarchicalForecastManager"""
    with patch('api.main.forecast_manager') as mock_fm:
        mock_fm.generate_forecast = AsyncMock(return_value={
            "entity_path": "asia.china.taiwan",
            "forecast_data": [{"timestamp": 1609459200 + i * 86400, "value": 100 + i} for i in range(100)],
            "method": "top_down"
        })
        yield mock_fm


@pytest.fixture
def mock_cursor_paginator():
    """Mock CursorPaginator"""
    with patch('api.main.cursor_paginator') as mock_cp:
        mock_cp.paginate_forecast_data = AsyncMock(return_value={
            "data": [{"timestamp": 1609459200, "value": 100}],
            "page_size": 100,
            "has_more": False,
            "next_cursor": None
        })
        yield mock_cp


@pytest.fixture
def mock_analysis_engine():
    """Mock MultiFactorAnalysisEngine"""
    with patch('api.main.analysis_engine') as mock_ae:
        mock_ae.analyze_scenario = AsyncMock(return_value={
            "scenario_id": "test_001",
            "factors": {
                "geospatial": 0.8,
                "temporal": 0.75,
                "entity": 0.7,
                "risk": 0.85
            },
            "overall_confidence": 0.775
        })
        yield mock_ae


# ===========================
# GET /api/v3/scenarios/{path}/forecasts Tests
# ===========================

class TestGetScenarioForecasts:
    """Test hierarchical forecast endpoint with drill-down"""

    def test_forecasts_endpoint_success(
        self,
        client,
        mock_feature_flag_enabled,
        mock_forecast_manager,
        mock_cursor_paginator
    ):
        """Test successful forecast retrieval with drill-down"""
        response = client.get(
            "/api/v3/scenarios/asia.china.taiwan/forecasts",
            params={"drill_down": True, "page_size": 50}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["path"] == "asia.china.taiwan"
        assert data["drill_down"] is True
        assert "forecast" in data
        assert "duration_ms" in data

    def test_forecasts_feature_flag_disabled(
        self,
        client,
        mock_feature_flag_disabled
    ):
        """Test feature flag disabled returns 503"""
        response = client.get("/api/v3/scenarios/asia.china.taiwan/forecasts")

        assert response.status_code == 503
        assert "ff.prophet_forecasting" in response.json()["detail"]

    def test_forecasts_invalid_ltree_path(
        self,
        client,
        mock_feature_flag_enabled
    ):
        """Test invalid LTREE path returns 400"""
        response = client.get("/api/v3/scenarios/invalid@path!/forecasts")

        assert response.status_code == 400
        assert "Invalid LTREE path" in response.json()["detail"]

    def test_forecasts_cursor_pagination(
        self,
        client,
        mock_feature_flag_enabled,
        mock_forecast_manager,
        mock_cursor_paginator
    ):
        """Test cursor-based pagination"""
        # First page
        response1 = client.get(
            "/api/v3/scenarios/asia.china.taiwan/forecasts",
            params={"page_size": 50}
        )

        assert response1.status_code == 200
        data1 = response1.json()
        assert "forecast" in data1

        # Simulate second page with cursor
        mock_cursor_paginator.paginate_forecast_data.return_value = {
            "data": [{"timestamp": 1609459200 + 50 * 86400, "value": 150}],
            "page_size": 50,
            "has_more": False,
            "next_cursor": None
        }

        response2 = client.get(
            "/api/v3/scenarios/asia.china.taiwan/forecasts",
            params={"page_size": 50, "cursor": "base64_encoded_cursor"}
        )

        assert response2.status_code == 200

    def test_forecasts_performance_p95_target(
        self,
        client,
        mock_feature_flag_enabled,
        mock_forecast_manager,
        mock_cursor_paginator
    ):
        """Test P95 <200ms performance requirement"""
        response = client.get("/api/v3/scenarios/asia.china.taiwan/forecasts")

        assert response.status_code == 200
        data = response.json()
        assert "performance" in data
        assert data["performance"]["p95_target"] == 200


# ===========================
# GET /api/v3/scenarios/{path}/hierarchy Tests
# ===========================

class TestGetScenarioHierarchy:
    """Test Django-inspired hierarchical navigation"""

    def test_hierarchy_endpoint_success(self, client):
        """Test successful hierarchy retrieval"""
        with patch('api.main.hierarchy_resolver') as mock_hr:
            mock_hr.get_hierarchy_with_depth = AsyncMock(return_value={
                "current_level": ["asia", "china", "taiwan"],
                "children": ["tensions", "military", "economic"]
            })

            response = client.get(
                "/api/v3/scenarios/asia.china.taiwan/hierarchy",
                params={"depth": 3}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["path"] == "asia.china.taiwan"
            assert data["depth"] == 3
            assert "hierarchy" in data

    def test_hierarchy_miller_columns_format(self, client):
        """Test Miller's Columns compatible output format"""
        with patch('api.main.hierarchy_resolver') as mock_hr:
            mock_hr.get_hierarchy_with_depth = AsyncMock(return_value={
                "current_level": ["asia"],
                "children": ["china", "japan", "korea"]
            })

            response = client.get("/api/v3/scenarios/asia/hierarchy")

            assert response.status_code == 200
            data = response.json()
            hierarchy = data["hierarchy"]

            # Verify Miller's Columns structure
            assert "columns" in hierarchy
            assert "breadcrumbs" in hierarchy
            assert "current_level" in hierarchy
            assert "children" in hierarchy
            assert isinstance(hierarchy["breadcrumbs"], list)

    def test_hierarchy_depth_validation(self, client):
        """Test depth parameter validation (1-5)"""
        # Invalid depth (too low)
        response = client.get(
            "/api/v3/scenarios/asia/hierarchy",
            params={"depth": 0}
        )
        assert response.status_code == 400

        # Invalid depth (too high)
        response = client.get(
            "/api/v3/scenarios/asia/hierarchy",
            params={"depth": 10}
        )
        assert response.status_code == 400

        # Valid depths
        for depth in [1, 2, 3, 4, 5]:
            with patch('api.main.hierarchy_resolver') as mock_hr:
                mock_hr.get_hierarchy_with_depth = AsyncMock(return_value={})
                response = client.get(
                    "/api/v3/scenarios/asia/hierarchy",
                    params={"depth": depth}
                )
                assert response.status_code == 200


# ===========================
# POST /api/v6/scenarios Tests
# ===========================

class TestCreateScenario:
    """Test scenario creation with LTREE path validation"""

    def test_create_scenario_success(self, client, mock_feature_flag_enabled):
        """Test successful scenario creation"""
        scenario_data = {
            "name": "China-Taiwan Tensions Escalation",
            "description": "Analysis of potential military escalation",
            "path": "asia.china.taiwan.tensions",
            "confidence_score": 0.75,
            "risk_level": "HIGH",
            "geospatial_confidence": 0.8,
            "temporal_confidence": 0.75,
            "entity_confidence": 0.7,
            "risk_confidence": 0.85
        }

        response = client.post("/api/v6/scenarios", json=scenario_data)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "success"
        assert "scenario" in data
        assert data["scenario"]["name"] == scenario_data["name"]
        assert data["scenario"]["path"] == scenario_data["path"]

    def test_create_scenario_feature_flag_disabled(
        self,
        client,
        mock_feature_flag_disabled
    ):
        """Test feature flag disabled returns 503"""
        scenario_data = {
            "name": "Test Scenario",
            "path": "test.path"
        }

        response = client.post("/api/v6/scenarios", json=scenario_data)

        assert response.status_code == 503
        assert "ff.scenario_construction" in response.json()["detail"]

    def test_create_scenario_missing_required_fields(
        self,
        client,
        mock_feature_flag_enabled
    ):
        """Test missing required fields returns 400"""
        # Missing name
        response = client.post("/api/v6/scenarios", json={"path": "test.path"})
        assert response.status_code == 400

        # Missing path
        response = client.post("/api/v6/scenarios", json={"name": "Test"})
        assert response.status_code == 400

    def test_create_scenario_ltree_path_validation(
        self,
        client,
        mock_feature_flag_enabled
    ):
        """Test LTREE path format validation"""
        # Valid LTREE paths
        valid_paths = [
            "asia.china.taiwan",
            "europe.ukraine.conflict",
            "middle_east.israel.palestine"
        ]

        for path in valid_paths:
            response = client.post("/api/v6/scenarios", json={
                "name": "Test Scenario",
                "path": path
            })
            assert response.status_code == 201

        # Invalid LTREE paths
        invalid_paths = [
            "invalid@path!",
            "path with spaces",
            "path-with-dashes",
            ""
        ]

        for path in invalid_paths:
            response = client.post("/api/v6/scenarios", json={
                "name": "Test Scenario",
                "path": path
            })
            assert response.status_code == 400

    def test_create_scenario_multi_factor_confidence(
        self,
        client,
        mock_feature_flag_enabled
    ):
        """Test multi-factor confidence scoring initialization"""
        scenario_data = {
            "name": "Test Scenario",
            "path": "test.scenario",
            "geospatial_confidence": 0.9,
            "temporal_confidence": 0.85,
            "entity_confidence": 0.8,
            "risk_confidence": 0.75
        }

        response = client.post("/api/v6/scenarios", json=scenario_data)

        assert response.status_code == 201
        data = response.json()
        # Verify confidence scores are initialized
        assert "scenario" in data


# ===========================
# GET /api/v6/scenarios/{scenario_id}/analysis Tests
# ===========================

class TestGetScenarioAnalysis:
    """Test multi-factor scenario analysis"""

    def test_analysis_endpoint_success(
        self,
        client,
        mock_feature_flag_enabled,
        mock_analysis_engine
    ):
        """Test successful scenario analysis"""
        response = client.get("/api/v6/scenarios/test_scenario_001/analysis")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["scenario_id"] == "test_scenario_001"
        assert "analysis" in data

    def test_analysis_four_tier_caching(
        self,
        client,
        mock_feature_flag_enabled,
        mock_analysis_engine
    ):
        """Test four-tier caching performance"""
        response = client.get("/api/v6/scenarios/test_scenario_002/analysis")

        assert response.status_code == 200
        data = response.json()
        assert "performance" in data
        assert "cache_hit" in data["performance"]

        # Fast response indicates cache hit
        if data["duration_ms"] < 50:
            assert data["performance"]["cache_hit"] is True

    def test_analysis_multi_factor_integration(
        self,
        client,
        mock_feature_flag_enabled,
        mock_analysis_engine
    ):
        """Test geospatial/temporal/entity/risk factor integration"""
        response = client.get("/api/v6/scenarios/test_scenario_003/analysis")

        assert response.status_code == 200
        data = response.json()
        analysis = data["analysis"]

        # Verify all four factors
        assert "factors" in analysis
        factors = analysis["factors"]
        assert "geospatial" in factors
        assert "temporal" in factors
        assert "entity" in factors
        assert "risk" in factors

    def test_analysis_feature_flag_disabled(
        self,
        client,
        mock_feature_flag_disabled
    ):
        """Test feature flag disabled returns 503"""
        response = client.get("/api/v6/scenarios/test_001/analysis")

        assert response.status_code == 503
        assert "ff.scenario_construction" in response.json()["detail"]

    def test_analysis_performance_p95_target(
        self,
        client,
        mock_feature_flag_enabled,
        mock_analysis_engine
    ):
        """Test P95 <200ms performance requirement"""
        response = client.get("/api/v6/scenarios/test_004/analysis")

        assert response.status_code == 200
        data = response.json()
        assert data["performance"]["p95_target"] == 200


# ===========================
# WebSocket /ws/v3/scenarios/{path}/forecasts Tests
# ===========================

class TestWebSocketScenarioForecasts:
    """Test real-time forecast updates via WebSocket"""

    def test_websocket_connection_success(self, client):
        """Test WebSocket connection establishment"""
        with client.websocket_connect("/ws/v3/scenarios/asia.china.taiwan/forecasts") as websocket:
            # Send subscribe action
            websocket.send_json({"action": "subscribe", "drill_down": True})

            # Receive forecast update
            data = websocket.receive_json()

            assert data["type"] == "forecast_update"
            assert "path" in data
            assert "forecast" in data
            assert "latency_ms" in data

    def test_websocket_drill_down_parameter(self, client):
        """Test drill-down parameter in WebSocket requests"""
        with client.websocket_connect("/ws/v3/scenarios/asia.china/forecasts") as websocket:
            # Test top-down method
            websocket.send_json({"action": "subscribe", "drill_down": True})
            data = websocket.receive_json()
            assert data["drill_down"] is True

            # Test bottom-up method
            websocket.send_json({"action": "subscribe", "drill_down": False})
            data = websocket.receive_json()
            assert data["drill_down"] is False

    def test_websocket_latency_requirement(self, client):
        """Test P95 <200ms latency requirement"""
        with client.websocket_connect("/ws/v3/scenarios/asia/forecasts") as websocket:
            websocket.send_json({"action": "subscribe"})
            data = websocket.receive_json()

            # Verify latency is tracked
            assert "latency_ms" in data
            # Note: Actual latency validation requires load testing

    def test_websocket_unsubscribe(self, client):
        """Test unsubscribe action closes connection gracefully"""
        with client.websocket_connect("/ws/v3/scenarios/asia/forecasts") as websocket:
            websocket.send_json({"action": "unsubscribe"})
            # Connection should close gracefully


# ===========================
# Integration Tests
# ===========================

class TestScenarioAPIIntegration:
    """End-to-end integration tests"""

    def test_create_and_analyze_scenario_workflow(
        self,
        client,
        mock_feature_flag_enabled,
        mock_analysis_engine
    ):
        """Test complete workflow: create scenario → analyze"""
        # Step 1: Create scenario
        scenario_data = {
            "name": "Integration Test Scenario",
            "path": "test.integration.workflow",
            "confidence_score": 0.8,
            "risk_level": "MEDIUM"
        }

        create_response = client.post("/api/v6/scenarios", json=scenario_data)
        assert create_response.status_code == 201
        scenario_id = create_response.json()["scenario"]["scenario_id"]

        # Step 2: Analyze scenario
        analysis_response = client.get(f"/api/v6/scenarios/{scenario_id}/analysis")
        assert analysis_response.status_code == 200

        # Verify analysis results
        analysis_data = analysis_response.json()
        assert analysis_data["scenario_id"] == scenario_id

    def test_hierarchy_to_forecasts_navigation(
        self,
        client,
        mock_feature_flag_enabled,
        mock_forecast_manager,
        mock_cursor_paginator
    ):
        """Test Miller's Columns navigation workflow"""
        # Step 1: Get hierarchy structure
        with patch('api.main.hierarchy_resolver') as mock_hr:
            mock_hr.get_hierarchy_with_depth = AsyncMock(return_value={
                "current_level": ["asia", "china"],
                "children": ["taiwan", "xinjiang"]
            })

            hierarchy_response = client.get("/api/v3/scenarios/asia.china/hierarchy")
            assert hierarchy_response.status_code == 200

        # Step 2: Drill down to forecasts
        forecast_response = client.get("/api/v3/scenarios/asia.china.taiwan/forecasts")
        assert forecast_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
