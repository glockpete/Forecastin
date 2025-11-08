"""
Feature Flags API Routes
Handles feature flag management and queries
"""

import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from services.feature_flag_service import CreateFeatureFlagRequest, UpdateFeatureFlagRequest

router = APIRouter(
    prefix="/api/feature-flags",
    tags=["feature-flags"]
)

logger = logging.getLogger(__name__)


@router.get("")
async def get_feature_flags():
    """Get current feature flags status"""
    try:
        from main import feature_flag_service
        if not feature_flag_service:
            raise HTTPException(status_code=503, detail="Service not initialized")

        flags = await feature_flag_service.get_all_flags()
        return JSONResponse(content={"feature_flags": [flag.to_dict() for flag in flags]})

    except Exception as e:
        logger.error(f"Error getting feature flags: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_feature_flag(flag_data: CreateFeatureFlagRequest):
    """Create a new feature flag"""
    try:
        from main import feature_flag_service
        if not feature_flag_service:
            raise HTTPException(status_code=503, detail="Service not initialized")

        flag = await feature_flag_service.create_flag(flag_data)
        return JSONResponse(
            status_code=201,
            content={"feature_flag": flag.to_dict(), "message": "Feature flag created successfully"}
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error creating feature flag: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{flag_name}")
async def update_feature_flag(flag_name: str, flag_data: UpdateFeatureFlagRequest):
    """Update an existing feature flag"""
    try:
        from main import feature_flag_service
        if not feature_flag_service:
            raise HTTPException(status_code=503, detail="Service not initialized")

        flag = await feature_flag_service.update_flag(flag_name, flag_data)
        if not flag:
            raise HTTPException(status_code=404, detail=f"Feature flag '{flag_name}' not found")

        return JSONResponse(
            content={"feature_flag": flag.to_dict(), "message": "Feature flag updated successfully"}
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error updating feature flag {flag_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{flag_name}")
async def delete_feature_flag(flag_name: str):
    """Delete a feature flag"""
    try:
        from main import feature_flag_service
        if not feature_flag_service:
            raise HTTPException(status_code=503, detail="Service not initialized")

        deleted = await feature_flag_service.delete_flag(flag_name)
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Feature flag '{flag_name}' not found")

        return JSONResponse(
            content={"message": f"Feature flag '{flag_name}' deleted successfully"}
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error deleting feature flag {flag_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{flag_name}")
async def get_feature_flag(flag_name: str):
    """Get a specific feature flag by name"""
    try:
        from main import feature_flag_service
        if not feature_flag_service:
            raise HTTPException(status_code=503, detail="Service not initialized")

        flag = await feature_flag_service.get_flag(flag_name)
        if not flag:
            raise HTTPException(status_code=404, detail=f"Feature flag '{flag_name}' not found")

        return JSONResponse(content={"feature_flag": flag.to_dict()})

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error getting feature flag {flag_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{flag_name}/enabled")
async def check_feature_flag_enabled(flag_name: str):
    """Check if a feature flag is enabled"""
    try:
        from main import feature_flag_service
        if not feature_flag_service:
            raise HTTPException(status_code=503, detail="Service not initialized")

        is_enabled = await feature_flag_service.is_flag_enabled(flag_name)
        return JSONResponse(
            content={
                "flag_name": flag_name,
                "is_enabled": is_enabled
            }
        )

    except Exception as e:
        logger.error(f"Error checking feature flag {flag_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feature-metrics")
async def get_feature_flag_metrics():
    """Get feature flag service performance metrics"""
    try:
        from main import feature_flag_service
        if not feature_flag_service:
            raise HTTPException(status_code=503, detail="Service not initialized")

        metrics = feature_flag_service.get_metrics()
        return JSONResponse(content={"metrics": metrics})

    except Exception as e:
        logger.error(f"Error getting feature flag metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/cache")
async def get_cache_metrics():
    """Get cache service metrics for feature flags"""
    try:
        from main import cache_service
        if not cache_service:
            raise HTTPException(status_code=503, detail="Cache service not initialized")

        metrics = cache_service.get_metrics()
        return JSONResponse(content={"cache_metrics": metrics})

    except Exception as e:
        logger.error(f"Error getting cache metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
