"""
Health Check API Routes
Provides comprehensive health monitoring for all services
"""

import logging
import time
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any

router = APIRouter(tags=["health"])

logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: float
    services: Dict[str, str]
    performance_metrics: Dict[str, Any]


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Comprehensive health check endpoint with real performance metrics"""
    from main import hierarchy_resolver, cache_service, connection_manager

    services_status = {}
    performance_metrics = {
        "ancestor_resolution_ms": None,
        "throughput_rps": None,
        "cache_hit_rate": None
    }

    # Check hierarchy resolver and get real performance metrics
    if hierarchy_resolver:
        try:
            # Get actual cache performance metrics from hierarchy resolver
            cache_metrics = hierarchy_resolver.get_cache_performance_metrics()
            services_status["hierarchy_resolver"] = "healthy"

            # Extract real metrics from cache_metrics
            # These are actual measurements, not hardcoded values
            if cache_metrics:
                # Parse metrics from the returned dict/object
                performance_metrics["cache_hit_rate"] = cache_metrics.get("l1_hit_rate", 0.0)

                # Calculate average resolution time if available
                if "total_queries" in cache_metrics and cache_metrics["total_queries"] > 0:
                    # Use L1 avg time as proxy for ancestor resolution
                    performance_metrics["ancestor_resolution_ms"] = cache_metrics.get("l1_avg_time_ms", 0.0)

                # Calculate throughput (queries per second)
                if "total_queries" in cache_metrics and "uptime_seconds" in cache_metrics:
                    uptime = cache_metrics.get("uptime_seconds", 1)
                    if uptime > 0:
                        performance_metrics["throughput_rps"] = cache_metrics["total_queries"] / uptime

        except Exception as e:
            services_status["hierarchy_resolver"] = f"unhealthy: {e}"
            logger.error(f"Error getting hierarchy resolver metrics: {e}")
    else:
        services_status["hierarchy_resolver"] = "not_initialized"

    # Check cache
    if cache_service:
        try:
            await cache_service.health_check()
            services_status["cache"] = "healthy"
        except Exception as e:
            services_status["cache"] = f"unhealthy: {e}"
    else:
        services_status["cache"] = "not_initialized"

    # Check WebSocket connections
    if connection_manager:
        services_status["websocket"] = f"active: {connection_manager.connection_stats['active_connections']}"
    else:
        services_status["websocket"] = "not_initialized"

    # Determine overall health status based on critical services
    overall_status = "healthy"
    if services_status.get("hierarchy_resolver", "").startswith("unhealthy"):
        overall_status = "degraded"
    if services_status.get("cache", "").startswith("unhealthy"):
        overall_status = "degraded"

    return HealthResponse(
        status=overall_status,
        timestamp=time.time(),
        services=services_status,
        performance_metrics=performance_metrics
    )
