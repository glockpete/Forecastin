"""
Phase 6 Feature Flag Initialization Script
Initializes three new feature flags for Advanced Scenario Construction:
- ff.prophet_forecasting: Prophet-based hierarchical forecasting
- ff.scenario_construction: Scenario creation and management
- ff.cursor_pagination: Efficient cursor-based pagination

Usage:
    python -m api.services.init_phase6_flags
"""

import asyncio
import logging
from typing import List, Dict, Any

from api.services.feature_flag_service import (
    FeatureFlagService,
    CreateFeatureFlagRequest,
    FeatureFlagType
)
from api.services.database_manager import DatabaseManager
from api.services.cache_service import CacheService
from api.services.realtime_service import RealtimeService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Phase 6 Feature Flag Definitions
PHASE6_FLAGS: List[Dict[str, Any]] = [
    {
        "name": "ff.ml.prophet_forecasting",
        "description": "Enable Prophet-based hierarchical forecasting with top-down/bottom-up methods",
        "flag_type": FeatureFlagType.GRADUAL_ROLLOUT,
        "is_enabled": False,  # Start disabled for gradual rollout
        "rollout_percentage": 0,  # Start at 0%, will increase: 10% → 25% → 50% → 100%
        "metadata": {
            "phase": "Phase 6",
            "feature": "Advanced Scenario Construction",
            "endpoints": [
                "GET /api/v3/scenarios/{path:path}/forecasts",
                "WebSocket /ws/v3/scenarios/{path:path}/forecasts"
            ],
            "performance_targets": {
                "forecast_generation": {
                    "top_down": "< 500ms",
                    "bottom_up": "< 1000ms"
                },
                "websocket_latency": "P95 < 200ms"
            },
            "rollout_plan": {
                "stage_1": {"percentage": 10, "duration_days": 7, "description": "Initial rollout to 10% of users"},
                "stage_2": {"percentage": 25, "duration_days": 7, "description": "Expand to 25% after validation"},
                "stage_3": {"percentage": 50, "duration_days": 7, "description": "Expand to 50% with monitoring"},
                "stage_4": {"percentage": 100, "duration_days": 0, "description": "Full deployment"}
            },
            "rollback_criteria": [
                "P95 latency > 300ms",
                "Cache hit rate < 90%",
                "Error rate > 1%",
                "User complaints > 5"
            ]
        }
    },
    {
        "name": "ff.scenario.construction",
        "description": "Enable scenario creation, management, and multi-factor analysis",
        "flag_type": FeatureFlagType.GRADUAL_ROLLOUT,
        "is_enabled": False,
        "rollout_percentage": 0,
        "metadata": {
            "phase": "Phase 6",
            "feature": "Advanced Scenario Construction",
            "endpoints": [
                "POST /api/v6/scenarios",
                "GET /api/v6/scenarios/{scenario_id}/analysis"
            ],
            "components": [
                "ScenarioEntity (LTREE path validation)",
                "ScenarioCollaborationService (real-time collaboration)",
                "MultiFactorAnalysisEngine (four-tier caching)"
            ],
            "performance_targets": {
                "analysis_p95": "< 200ms",
                "cache_hit_rate": ">= 99.2%",
                "collaboration_latency": "< 150ms"
            },
            "rollout_plan": {
                "stage_1": {"percentage": 10, "duration_days": 7, "description": "Pilot with analyst team"},
                "stage_2": {"percentage": 25, "duration_days": 7, "description": "Regional expansion"},
                "stage_3": {"percentage": 50, "duration_days": 7, "description": "Majority rollout"},
                "stage_4": {"percentage": 100, "duration_days": 0, "description": "Global deployment"}
            },
            "dependencies": [
                "ff.hierarchy.optimized",
                "ff.ws.realtime"
            ]
        }
    },
    {
        "name": "ff.data.cursor_pagination",
        "description": "Enable efficient cursor-based pagination for time series data (more efficient than offset)",
        "flag_type": FeatureFlagType.BOOLEAN,
        "is_enabled": True,  # Safe to enable immediately (no breaking changes)
        "rollout_percentage": 100,
        "metadata": {
            "phase": "Phase 6",
            "feature": "Cursor-Based Pagination",
            "advantages": [
                "More efficient than offset pagination for large datasets",
                "Consistent results during data changes",
                "Better performance with time series data",
                "No offset calculation overhead"
            ],
            "endpoints": [
                "GET /api/v3/scenarios/{path:path}/forecasts (cursor parameter)"
            ],
            "implementation": {
                "encoding": "Base64-encoded timestamps",
                "page_size": "Default 100, configurable",
                "has_more": "Boolean flag for pagination state",
                "next_cursor": "Token for next page"
            },
            "performance_benefits": {
                "query_time": "O(1) vs O(n) for offset",
                "consistency": "No duplicate/missing rows during pagination"
            }
        }
    }
]


async def initialize_phase6_feature_flags():
    """
    Initialize Phase 6 feature flags with gradual rollout configuration
    """
    logger.info("=" * 80)
    logger.info("Phase 6 Feature Flag Initialization")
    logger.info("=" * 80)
    
    # Initialize services
    database_url = "postgresql://forecastin_user:forecastin_password@localhost:5432/forecastin"
    database_manager = DatabaseManager(database_url)
    await database_manager.initialize()
    
    cache_service = CacheService()
    await cache_service.initialize()
    
    realtime_service = RealtimeService(cache_service)
    await realtime_service.initialize()
    
    feature_flag_service = FeatureFlagService(
        database_manager=database_manager,
        cache_service=cache_service,
        realtime_service=realtime_service
    )
    await feature_flag_service.initialize()
    
    logger.info("Services initialized successfully")
    logger.info("")
    
    # Create Phase 6 feature flags
    created_flags = []
    existing_flags = []
    failed_flags = []
    
    for flag_config in PHASE6_FLAGS:
        flag_name = flag_config["name"]
        logger.info(f"Processing flag: {flag_name}")
        
        try:
            # Check if flag already exists
            existing_flag = await feature_flag_service.get_flag(flag_name)
            
            if existing_flag:
                logger.warning(f"  ⚠️  Flag '{flag_name}' already exists (skipping)")
                existing_flags.append(flag_name)
                continue
            
            # Create new flag
            flag_request = CreateFeatureFlagRequest(
                name=flag_config["name"],
                description=flag_config["description"],
                flag_type=flag_config["flag_type"],
                is_enabled=flag_config["is_enabled"],
                rollout_percentage=flag_config["rollout_percentage"],
                metadata=flag_config["metadata"]
            )
            
            created_flag = await feature_flag_service.create_flag(flag_request)
            logger.info(f"  ✅ Created: {flag_name}")
            logger.info(f"     - Type: {created_flag.flag_type}")
            logger.info(f"     - Enabled: {created_flag.is_enabled}")
            logger.info(f"     - Rollout: {created_flag.rollout_percentage}%")
            created_flags.append(flag_name)
            
        except Exception as e:
            logger.error(f"  ❌ Failed to create '{flag_name}': {e}")
            failed_flags.append(flag_name)
    
    # Summary
    logger.info("")
    logger.info("=" * 80)
    logger.info("Initialization Summary")
    logger.info("=" * 80)
    logger.info(f"✅ Created: {len(created_flags)} flags")
    for flag_name in created_flags:
        logger.info(f"   - {flag_name}")
    
    if existing_flags:
        logger.info(f"⚠️  Existing: {len(existing_flags)} flags (skipped)")
        for flag_name in existing_flags:
            logger.info(f"   - {flag_name}")
    
    if failed_flags:
        logger.info(f"❌ Failed: {len(failed_flags)} flags")
        for flag_name in failed_flags:
            logger.info(f"   - {flag_name}")
    
    logger.info("")
    logger.info("=" * 80)
    logger.info("Gradual Rollout Instructions")
    logger.info("=" * 80)
    logger.info("")
    logger.info("Phase 6 flags are initialized with 0% rollout for safe deployment.")
    logger.info("Follow this gradual rollout schedule:")
    logger.info("")
    logger.info("Week 1: 10% rollout")
    logger.info("  - Update ff.prophet_forecasting to 10%")
    logger.info("  - Update ff.scenario_construction to 10%")
    logger.info("  - Monitor metrics: P95 latency, cache hit rate, error rate")
    logger.info("")
    logger.info("Week 2: 25% rollout (if Week 1 metrics pass)")
    logger.info("  - Update both flags to 25%")
    logger.info("  - Continue monitoring")
    logger.info("")
    logger.info("Week 3: 50% rollout (if Week 2 metrics pass)")
    logger.info("  - Update both flags to 50%")
    logger.info("  - Intensive monitoring")
    logger.info("")
    logger.info("Week 4: 100% rollout (if Week 3 metrics pass)")
    logger.info("  - Full deployment")
    logger.info("  - Set is_enabled=true")
    logger.info("")
    logger.info("Rollback Procedure (if metrics fail):")
    logger.info("  1. Set rollout_percentage back to previous stage")
    logger.info("  2. Or set is_enabled=false for immediate rollback")
    logger.info("  3. Run database migration rollback if needed")
    logger.info("")
    logger.info("Update flags via API:")
    logger.info("  PUT /api/feature-flags/ff.prophet_forecasting")
    logger.info("  PUT /api/feature-flags/ff.scenario_construction")
    logger.info("")
    
    # Cleanup
    await feature_flag_service.cleanup()
    await realtime_service.cleanup()
    await cache_service.close()
    await database_manager.close()
    
    logger.info("Phase 6 feature flag initialization complete")
    logger.info("=" * 80)


async def verify_phase6_flags():
    """
    Verify Phase 6 feature flags are initialized correctly
    """
    logger.info("Verifying Phase 6 feature flags...")
    
    # Initialize services
    database_url = "postgresql://forecastin_user:forecastin_password@localhost:5432/forecastin"
    database_manager = DatabaseManager(database_url)
    await database_manager.initialize()
    
    cache_service = CacheService()
    await cache_service.initialize()
    
    realtime_service = RealtimeService(cache_service)
    await realtime_service.initialize()
    
    feature_flag_service = FeatureFlagService(
        database_manager=database_manager,
        cache_service=cache_service,
        realtime_service=realtime_service
    )
    await feature_flag_service.initialize()
    
    # Verify each flag
    verification_results = []
    for flag_config in PHASE6_FLAGS:
        flag_name = flag_config["name"]
        flag = await feature_flag_service.get_flag(flag_name)
        
        if flag:
            verification_results.append({
                "name": flag_name,
                "exists": True,
                "enabled": flag.is_enabled,
                "rollout": flag.rollout_percentage
            })
        else:
            verification_results.append({
                "name": flag_name,
                "exists": False
            })
    
    # Print verification results
    logger.info("")
    logger.info("Verification Results:")
    logger.info("-" * 80)
    for result in verification_results:
        if result["exists"]:
            logger.info(f"✅ {result['name']}")
            logger.info(f"   - Enabled: {result['enabled']}")
            logger.info(f"   - Rollout: {result['rollout']}%")
        else:
            logger.info(f"❌ {result['name']} - NOT FOUND")
    logger.info("-" * 80)
    
    # Cleanup
    await feature_flag_service.cleanup()
    await realtime_service.cleanup()
    await cache_service.close()
    await database_manager.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        asyncio.run(verify_phase6_flags())
    else:
        asyncio.run(initialize_phase6_feature_flags())