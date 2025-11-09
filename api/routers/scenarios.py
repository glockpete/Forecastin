"""
Scenarios API Routes
Handles scenario analysis, forecasting, and hierarchical navigation
"""

import logging
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from services.scenario_service import RiskLevel, ScenarioEntity

router = APIRouter(
    prefix="/api",  # Routes include versioned paths: /v3/scenarios/..., /v6/scenarios/...
    tags=["scenarios"]
)

logger = logging.getLogger(__name__)


@router.get("/v3/scenarios/{path:path}/forecasts")
async def get_scenario_forecasts(
    path: str,
    drill_down: bool = False,
    cursor: Optional[str] = None,
    page_size: int = 100
):
    """
    Django-inspired hierarchical forecast endpoint with cursor-based pagination
    Supports drill-down navigation through LTREE hierarchy
    Feature flag: ff.ml.prophet_forecasting
    """
    try:
        from main import cursor_paginator, feature_flag_service, forecast_manager

        # Check feature flag
        if not await feature_flag_service.is_flag_enabled("ff.ml.prophet_forecasting"):
            raise HTTPException(
                status_code=503,
                detail="Prophet forecasting is currently disabled. Feature flag: ff.ml.prophet_forecasting"
            )

        if not forecast_manager or not cursor_paginator:
            raise HTTPException(status_code=503, detail="Forecast service not initialized")

        # Validate LTREE path format
        if not path or not path.replace(".", "").replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail="Invalid LTREE path format")

        # Generate forecast using HierarchicalForecastManager
        start_time = time.time()
        forecast = await forecast_manager.generate_forecast(
            entity_path=path,
            forecast_horizon=365,
            method="top_down" if drill_down else "bottom_up"
        )

        # Apply cursor-based pagination
        paginated_result = await cursor_paginator.paginate_forecast_data(
            forecast=forecast,
            cursor=cursor,
            page_size=page_size
        )

        duration_ms = (time.time() - start_time) * 1000

        return JSONResponse(content={
            "status": "success",
            "path": path,
            "drill_down": drill_down,
            "forecast": paginated_result,
            "duration_ms": duration_ms,
            "performance": {
                "p95_target": 200,
                "actual_ms": duration_ms
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating forecast for path {path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v3/scenarios/{path:path}/hierarchy")
async def get_scenario_hierarchy(
    path: str,
    depth: int = 3
):
    """
    Django-inspired hierarchical navigation structure (date_hierarchy adaptation)
    Returns Miller's Columns compatible hierarchy data
    Supports depth parameter (1-5) for controlling hierarchy levels
    """
    try:
        from main import hierarchy_resolver

        if not hierarchy_resolver:
            raise HTTPException(status_code=503, detail="Hierarchy service not initialized")

        # Validate depth parameter
        if not 1 <= depth <= 5:
            raise HTTPException(status_code=400, detail="Depth must be between 1 and 5")

        # Validate LTREE path format
        if not path or not path.replace(".", "").replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail="Invalid LTREE path format")

        start_time = time.time()

        # Get hierarchical structure using OptimizedHierarchyResolver
        hierarchy_data = await hierarchy_resolver.get_hierarchy_with_depth(
            entity_path=path,
            max_depth=depth
        )

        duration_ms = (time.time() - start_time) * 1000

        # Format for Miller's Columns UI
        miller_columns_format = {
            "columns": [],
            "breadcrumbs": path.split("."),
            "current_level": hierarchy_data.get("current_level", []),
            "children": hierarchy_data.get("children", [])
        }

        return JSONResponse(content={
            "status": "success",
            "path": path,
            "depth": depth,
            "hierarchy": miller_columns_format,
            "duration_ms": duration_ms,
            "performance": {
                "p95_target": 10,
                "actual_ms": duration_ms
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting hierarchy for path {path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v6/scenarios")
async def create_scenario(scenario_data: Dict[str, Any]):
    """
    Create new scenario with LTREE path validation
    Multi-factor confidence scoring initialization
    Feature flag: ff.scenario.construction
    """
    try:
        from main import feature_flag_service

        # Check feature flag
        if not await feature_flag_service.is_flag_enabled("ff.scenario.construction"):
            raise HTTPException(
                status_code=503,
                detail="Scenario construction is currently disabled. Feature flag: ff.scenario.construction"
            )

        # Validate required fields
        if "name" not in scenario_data or "path" not in scenario_data:
            raise HTTPException(status_code=400, detail="Missing required fields: name, path")

        # Validate LTREE path format
        path = scenario_data["path"]
        if not path or not path.replace(".", "").replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail="Invalid LTREE path format")

        # Create ScenarioEntity with confidence scoring
        scenario = ScenarioEntity(
            scenario_id=f"scenario_{int(time.time())}",
            name=scenario_data["name"],
            description=scenario_data.get("description", ""),
            path=path,
            confidence_score=scenario_data.get("confidence_score", 0.7),
            risk_level=RiskLevel[scenario_data.get("risk_level", "MEDIUM")],
            created_at=time.time(),
            updated_at=time.time()
        )

        # Store scenario (would integrate with database in production)
        logger.info(f"Created scenario: {scenario.scenario_id} with path: {scenario.path}")

        return JSONResponse(
            status_code=201,
            content={
                "status": "success",
                "scenario": {
                    "scenario_id": scenario.scenario_id,
                    "name": scenario.name,
                    "path": scenario.path,
                    "confidence_score": scenario.confidence_score,
                    "risk_level": scenario.risk_level.value,
                    "created_at": scenario.created_at
                },
                "message": "Scenario created successfully"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating scenario: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v6/scenarios/{scenario_id}/analysis")
async def get_scenario_analysis(scenario_id: str):
    """
    Multi-factor scenario analysis with four-tier caching
    Leverages geospatial/temporal/entity factor integration
    Feature flag: ff.scenario.construction
    """
    try:
        from main import analysis_engine, feature_flag_service

        # Check feature flag
        if not await feature_flag_service.is_flag_enabled("ff.scenario.construction"):
            raise HTTPException(
                status_code=503,
                detail="Scenario construction is currently disabled. Feature flag: ff.scenario.construction"
            )

        if not analysis_engine:
            raise HTTPException(status_code=503, detail="Analysis engine not initialized")

        start_time = time.time()

        # Perform multi-factor analysis with four-tier caching
        analysis_result = await analysis_engine.analyze_scenario(scenario_id)

        duration_ms = (time.time() - start_time) * 1000

        return JSONResponse(content={
            "status": "success",
            "scenario_id": scenario_id,
            "analysis": analysis_result,
            "duration_ms": duration_ms,
            "performance": {
                "p95_target": 200,
                "actual_ms": duration_ms,
                "cache_hit": duration_ms < 50  # L1/L2 cache hit indicator
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing scenario {scenario_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
