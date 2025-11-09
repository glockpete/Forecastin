"""
Forecastin Geopolitical Intelligence Platform - Phase 0 FastAPI Application
Implements core requirements from GOLDEN_SOURCE.md with architectural constraints from AGENTS.md
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn

# Import custom modules (absolute imports)
from config_validation import (
    ConfigValidationError,
    print_config_summary,
    validate_environment_variables,
)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from navigation_api.database.optimized_hierarchy_resolver import (
    OptimizedHierarchyResolver,
)

# Import routers
from routers import (
    entities,
    feature_flags,
    health,
    hierarchy_refresh,
    rss_ingestion,
    scenarios,
    test_data,
    websocket,
)
from services.automated_refresh_service import (
    AutomatedRefreshService,
    initialize_automated_refresh_service,
)
from services.background_services import start_background_services
from services.cache_service import CacheService
from services.database_manager import DatabaseManager
from services.feature_flag_service import FeatureFlagService
from services.hierarchical_forecast_service import HierarchicalForecastManager
from services.realtime_service import RealtimeService
from services.rss.rss_ingestion_service import RSSIngestionConfig, RSSIngestionService
from services.scenario_service import (
    CursorPaginator,
    MultiFactorAnalysisEngine,
    ScenarioCollaborationService,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS and Origin Configuration
ALLOWED_ORIGINS = os.getenv(
    'ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080'
).split(',')

logger.info(f"[CORS_CONFIG] Configured CORS for origins: {ALLOWED_ORIGINS}")

# Re-export WebSocket configuration and classes for backward compatibility with tests

# Global instances
hierarchy_resolver: Optional[OptimizedHierarchyResolver] = None
cache_service: Optional[CacheService] = None
database_manager: Optional[DatabaseManager] = None
realtime_service: Optional[RealtimeService] = None
feature_flag_service: Optional[FeatureFlagService] = None
forecast_manager: Optional[HierarchicalForecastManager] = None
scenario_collaboration_service: Optional[ScenarioCollaborationService] = None
analysis_engine: Optional[MultiFactorAnalysisEngine] = None
cursor_paginator: Optional[CursorPaginator] = None
automated_refresh_service: Optional[AutomatedRefreshService] = None
rss_ingestion_service: Optional[RSSIngestionService] = None
connection_manager = None  # Will be set by websocket router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global hierarchy_resolver, cache_service, database_manager, realtime_service, feature_flag_service
    global forecast_manager, scenario_collaboration_service, analysis_engine, cursor_paginator, rss_ingestion_service
    global connection_manager

    # Startup
    logger.info("Starting Forecastin API - Phase 0 initialization")

    try:
        # STEP 1: Validate environment variables (fail fast if misconfigured)
        try:
            config = validate_environment_variables(strict=False)
            print_config_summary(config, mask_secrets=True)
        except ConfigValidationError as e:
            logger.error(f"Configuration validation failed: {e}")
            logger.error("Fix your environment variables and restart the application")
            raise

        # STEP 2: Initialize database manager with validated configuration
        database_url = config['DATABASE_URL']

        # Try to initialize database manager with graceful degradation
        try:
            database_manager = DatabaseManager(database_url)
            await database_manager.initialize()
            logger.info("Database connection established successfully")
        except Exception as db_error:
            logger.warning(f"Database connection failed: {db_error}")
            logger.warning("API will start in degraded mode without database connectivity")
            logger.warning("To fix: Start Docker Desktop and run 'docker-compose up -d postgres'")
            database_manager = None

        # Initialize hierarchy resolver (critical for O(log n) performance)
        hierarchy_resolver = OptimizedHierarchyResolver()

        # Initialize cache service (L1 Memory -> L2 Redis -> L3 DB -> L4 Materialized Views)
        redis_url = os.getenv('REDIS_URL')
        if not redis_url:
            redis_host = os.getenv('REDIS_HOST', 'localhost')
            redis_url = f"redis://{redis_host}:6379/0"

        try:
            cache_service = CacheService(redis_url=redis_url)
            await cache_service.initialize()
            logger.info("Redis cache connection established successfully")
        except Exception as redis_error:
            logger.warning(f"Redis connection failed: {redis_error}")
            logger.warning("API will continue with in-memory caching only")
            cache_service = None

        # Initialize real-time service (works without Redis for local development)
        realtime_service = RealtimeService(cache_service)
        await realtime_service.initialize()

        # Initialize feature flag service with database and caching integration
        if database_manager and cache_service:
            feature_flag_service = FeatureFlagService(
                database_manager=database_manager,
                cache_service=cache_service,
                realtime_service=realtime_service
            )
            await feature_flag_service.initialize()
        else:
            logger.warning("Feature flag service not initialized due to missing dependencies")
            feature_flag_service = None

        # Initialize Phase 6 services
        forecast_manager = HierarchicalForecastManager(
            cache_service=cache_service,
            realtime_service=realtime_service,
            hierarchy_resolver=hierarchy_resolver
        )

        scenario_collaboration_service = ScenarioCollaborationService(
            realtime_service=realtime_service
        )

        analysis_engine = MultiFactorAnalysisEngine(
            cache_service=cache_service,
            realtime_service=realtime_service,
            hierarchy_resolver=hierarchy_resolver
        )

        cursor_paginator = CursorPaginator()

        # Initialize automated refresh service
        if database_manager and cache_service and feature_flag_service:
            automated_refresh_service = initialize_automated_refresh_service(
                database_manager, cache_service, feature_flag_service
            )
            # Create the feature flag for automated refresh
            try:
                await feature_flag_service.create_automated_refresh_flag()
            except Exception as e:
                logger.warning(f"Failed to create automated refresh feature flag: {e}")
        else:
            logger.warning("Automated refresh service not initialized due to missing dependencies")
            automated_refresh_service = None

        # Initialize RSS ingestion service
        if cache_service and realtime_service and hierarchy_resolver:
            try:
                rss_config = RSSIngestionConfig(
                    batch_size=50,
                    parallel_workers=4,
                    enable_entity_extraction=True,
                    enable_deduplication=True,
                    enable_websocket_notifications=True
                )
                rss_ingestion_service = RSSIngestionService(
                    cache_service=cache_service,
                    realtime_service=realtime_service,
                    hierarchy_resolver=hierarchy_resolver,
                    config=rss_config
                )
                logger.info("RSS ingestion service initialized successfully")
            except Exception as e:
                logger.warning(f"RSS ingestion service initialization failed: {e}")
                rss_ingestion_service = None
        else:
            logger.warning("RSS ingestion service not initialized due to missing dependencies")
            rss_ingestion_service = None

        # Get connection manager from websocket router
        from routers.websocket import connection_manager as ws_manager
        connection_manager = ws_manager

        # Start background services
        await start_background_services(hierarchy_resolver, cache_service)

        # Start automated refresh service if available
        if automated_refresh_service:
            automated_refresh_service.start_service()
            logger.info("Automated refresh service started")

        logger.info("Forecastin API Phase 0 + Phase 6 initialization completed successfully")

    except Exception as e:
        logger.error(f"Failed to initialize API: {e}")
        raise

    yield

    # Shutdown
    logger.info("Shutting down Forecastin API")

    # Cleanup connections in reverse order
    if automated_refresh_service:
        automated_refresh_service.stop_service()
    if rss_ingestion_service:
        logger.info("Shutting down RSS ingestion service")
    if analysis_engine:
        await analysis_engine.cleanup()
    if scenario_collaboration_service:
        await scenario_collaboration_service.cleanup()
    if forecast_manager:
        await forecast_manager.cleanup()
    if feature_flag_service:
        await feature_flag_service.cleanup()
    if realtime_service:
        await realtime_service.cleanup()
    if cache_service:
        await cache_service.close()
    if database_manager:
        await database_manager.close()


# Initialize FastAPI application with lifespan management
app = FastAPI(
    title="Forecastin Geopolitical Intelligence Platform API",
    description="Phase 0 - Foundational architecture for geopolitical intelligence platform",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS with environment-configurable origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(entities.router)
app.include_router(hierarchy_refresh.router)
app.include_router(feature_flags.router)
app.include_router(test_data.router)
app.include_router(scenarios.router)
app.include_router(rss_ingestion.router)
app.include_router(websocket.router)

logger.info("[STARTUP] All routers included successfully")


if __name__ == "__main__":
    # Configure uvicorn with performance optimizations
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=9000,
        reload=True,
        log_level="info",
        access_log=True
    )
