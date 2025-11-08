"""
RSS Ingestion API Routes
Handles RSS feed ingestion, batch processing, and monitoring
"""

import logging
import time
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/api/rss",
    tags=["rss-ingestion"]
)

logger = logging.getLogger(__name__)


async def get_rss_service():
    """Dependency to get RSS ingestion service from app state"""
    # This will be injected via dependency injection
    from main import rss_ingestion_service
    if not rss_ingestion_service:
        raise HTTPException(status_code=503, detail="RSS ingestion service not initialized")
    return rss_ingestion_service


@router.post("/ingest")
async def ingest_rss_feed(feed_data: Dict[str, Any]):
    """
    Ingest RSS feed with complete processing pipeline.

    Includes:
    - Route-based content extraction
    - 5-W entity extraction
    - Deduplication with 0.8 threshold
    - Real-time WebSocket notifications
    """
    try:
        from main import rss_ingestion_service
        if not rss_ingestion_service:
            raise HTTPException(status_code=503, detail="RSS ingestion service not initialized")

        # Validate required fields
        if "feed_url" not in feed_data:
            raise HTTPException(status_code=400, detail="Missing required field: feed_url")

        feed_url = feed_data["feed_url"]
        route_config = feed_data.get("route_config", {})
        job_id = feed_data.get("job_id")

        # Start ingestion
        start_time = time.time()
        result = await rss_ingestion_service.ingest_rss_feed(
            feed_url=feed_url,
            route_config=route_config,
            job_id=job_id
        )

        duration_ms = (time.time() - start_time) * 1000

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "RSS feed ingested successfully",
                "result": result,
                "duration_ms": duration_ms
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ingesting RSS feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/batch")
async def ingest_multiple_rss_feeds(batch_data: Dict[str, Any]):
    """
    Ingest multiple RSS feeds in parallel or sequentially.

    Supports batch processing with configurable parallelism.
    """
    try:
        from main import rss_ingestion_service
        if not rss_ingestion_service:
            raise HTTPException(status_code=503, detail="RSS ingestion service not initialized")

        # Validate required fields
        if "feeds" not in batch_data:
            raise HTTPException(status_code=400, detail="Missing required field: feeds")

        feeds = batch_data["feeds"]
        parallel = batch_data.get("parallel", True)

        # Start batch ingestion
        start_time = time.time()
        result = await rss_ingestion_service.ingest_multiple_feeds(
            feed_configs=feeds,
            parallel=parallel
        )

        duration_ms = (time.time() - start_time) * 1000

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Batch RSS ingestion completed",
                "result": result,
                "duration_ms": duration_ms
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch RSS ingestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_rss_metrics():
    """
    Get RSS ingestion service performance metrics.

    Includes:
    - Articles processed
    - Entities extracted
    - Deduplication statistics
    - Cache hit rates
    - WebSocket notification counts
    """
    try:
        from main import rss_ingestion_service
        if not rss_ingestion_service:
            raise HTTPException(status_code=503, detail="RSS ingestion service not initialized")

        metrics = await rss_ingestion_service.get_metrics()

        return JSONResponse(content={"metrics": metrics})

    except Exception as e:
        logger.error(f"Error getting RSS metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def get_rss_health():
    """
    Perform RSS ingestion service health check.

    Checks:
    - Service initialization status
    - Component health (route processor, entity extractor, deduplicator)
    - Cache service integration
    - WebSocket notification system
    """
    try:
        from main import rss_ingestion_service
        if not rss_ingestion_service:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unavailable",
                    "message": "RSS ingestion service not initialized"
                }
            )

        health = await rss_ingestion_service.health_check()

        return JSONResponse(content=health)

    except Exception as e:
        logger.error(f"Error performing RSS health check: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_id}")
async def get_rss_job_status(job_id: str):
    """
    Get status of an RSS ingestion job.

    Returns job progress, stage, and results.
    """
    try:
        from main import rss_ingestion_service
        if not rss_ingestion_service:
            raise HTTPException(status_code=503, detail="RSS ingestion service not initialized")

        # Get job status from active jobs
        if job_id in rss_ingestion_service.active_jobs:
            job_info = rss_ingestion_service.active_jobs[job_id]
            return JSONResponse(content={"job": job_info})
        else:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting RSS job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
