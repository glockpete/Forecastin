"""
Hierarchy Refresh API Routes
Manages automated refresh of LTREE materialized views
"""

import logging
import time

from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/api/entities/refresh",
    tags=["hierarchy-refresh"]
)

logger = logging.getLogger(__name__)


@router.post("")
async def refresh_hierarchy_views():
    """Manually refresh LTREE materialized views (required for LTREE performance)"""
    try:
        from main import hierarchy_resolver
        if not hierarchy_resolver:
            raise HTTPException(status_code=503, detail="Service not initialized")

        # Call the critical refresh_materialized_view() function
        # This method is required for LTREE materialized views which don't auto-refresh
        start_time = time.time()

        # Refresh all hierarchy materialized views
        refresh_results = hierarchy_resolver.refresh_all_materialized_views()

        duration_ms = (time.time() - start_time) * 1000

        # SLO enforcement: documented target is sub-second performance (< 1000ms)
        SLO_REFRESH_TARGET_MS = 1000
        if duration_ms > SLO_REFRESH_TARGET_MS:
            logger.warning(
                f"LTREE refresh SLO violation: {duration_ms:.2f}ms > {SLO_REFRESH_TARGET_MS}ms target. "
                f"Consider optimizing materialized view refresh or increasing infrastructure resources."
            )

        # Check if all views were successfully refreshed
        failed_views = [view for view, success in refresh_results.items() if not success]

        if failed_views:
            logger.warning(f"Some materialized views failed to refresh: {failed_views}")
            return {
                "status": "partial_success",
                "message": "Refresh completed with failures",
                "results": refresh_results,
                "duration_ms": duration_ms,
                "failed_views": failed_views
            }
        else:
            logger.info(f"All materialized views refreshed successfully in {duration_ms:.2f}ms")
            return {
                "status": "success",
                "message": "All materialized views refreshed successfully",
                "results": refresh_results,
                "duration_ms": duration_ms
            }

    except Exception as e:
        logger.error(f"Error refreshing materialized views: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_refresh_status():
    """Get status of materialized view refresh operations"""
    try:
        from main import automated_refresh_service, hierarchy_resolver
        if not hierarchy_resolver:
            raise HTTPException(status_code=503, detail="Service not initialized")

        # Get cache performance metrics including refresh status
        cache_metrics = hierarchy_resolver.get_cache_performance_metrics()
        l4_cache_info = cache_metrics.get('l4_cache', {})

        # Get automated refresh service status if available
        automated_refresh_status = None
        if automated_refresh_service:
            try:
                automated_refresh_status = automated_refresh_service.get_refresh_performance_summary()
            except Exception as e:
                logger.warning(f"Failed to get automated refresh status: {e}")

        return {
            "status": "available",
            "last_refresh": l4_cache_info.get('last_refresh', 0),
            "cache_metrics": cache_metrics,
            "automated_refresh_status": automated_refresh_status,
            "message": "LTREE materialized view refresh service is operational"
        }

    except Exception as e:
        logger.error(f"Error getting refresh status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/automated/start")
async def start_automated_refresh():
    """Start the automated refresh service"""
    try:
        from main import automated_refresh_service
        if not automated_refresh_service:
            raise HTTPException(status_code=503, detail="Automated refresh service not initialized")

        automated_refresh_service.start_service()
        return {"status": "success", "message": "Automated refresh service started"}

    except Exception as e:
        logger.error(f"Error starting automated refresh service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/automated/stop")
async def stop_automated_refresh():
    """Stop the automated refresh service"""
    try:
        from main import automated_refresh_service
        if not automated_refresh_service:
            raise HTTPException(status_code=503, detail="Automated refresh service not initialized")

        automated_refresh_service.stop_service()
        return {"status": "success", "message": "Automated refresh service stopped"}

    except Exception as e:
        logger.error(f"Error stopping automated refresh service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/automated/force")
async def force_automated_refresh():
    """Force a refresh of all materialized views through the automated service"""
    try:
        from main import automated_refresh_service
        if not automated_refresh_service:
            raise HTTPException(status_code=503, detail="Automated refresh service not initialized")

        result = automated_refresh_service.force_refresh_all()
        return {"status": "success", "result": result}

    except Exception as e:
        logger.error(f"Error forcing automated refresh: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/automated/metrics")
async def get_automated_refresh_metrics(limit: int = 20):
    """Get recent automated refresh metrics"""
    try:
        from main import automated_refresh_service
        if not automated_refresh_service:
            raise HTTPException(status_code=503, detail="Automated refresh service not initialized")

        metrics = automated_refresh_service.get_recent_metrics(limit)
        return {"status": "success", "metrics": metrics}

    except Exception as e:
        logger.error(f"Error getting automated refresh metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
