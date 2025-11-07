# Forecastin Repository Map

## Backend Routes

| Method | Endpoint | Description | Feature Flags |
|--------|----------|-------------|---------------|
| GET | `/health` | Comprehensive health check endpoint | N/A |
| GET | `/api/entities` | Get all active entities with hierarchy optimization | N/A |
| GET | `/api/entities/{entity_id}/hierarchy` | Get entity hierarchy with optimized performance | N/A |
| POST | `/api/entities/refresh` | Manually refresh LTREE materialized views | N/A |
| GET | `/api/entities/refresh/status` | Get status of materialized view refresh operations | N/A |
| POST | `/api/entities/refresh/automated/start` | Start the automated refresh service | N/A |
| POST | `/api/entities/refresh/automated/stop` | Stop the automated refresh service | N/A |
| POST | `/api/entities/refresh/automated/force` | Force a refresh of all materialized views | N/A |
| GET | `/api/entities/refresh/automated/metrics` | Get recent automated refresh metrics | N/A |
| GET | `/api/feature-flags` | Get current feature flags status | N/A |
| POST | `/api/feature-flags` | Create a new feature flag | N/A |
| PUT | `/api/feature-flags/{flag_name}` | Update an existing feature flag | N/A |
| DELETE | `/api/feature-flags/{flag_name}` | Delete a feature flag | N/A |
| GET | `/api/feature-flags/{flag_name}` | Get a specific feature flag by name | N/A |
| GET | `/api/feature-flags/{flag_name}/enabled` | Check if a feature flag is enabled | N/A |
| GET | `/api/feature-flags/metrics` | Get feature flag service performance metrics | N/A |
| GET | `/api/feature-flags/metrics/cache` | Get cache service metrics for feature flags | N/A |
| GET | `/api/opportunities` | Get opportunities data for frontend testing | N/A |
| GET | `/api/actions` | Get actions data for frontend testing | N/A |
| GET | `/api/stakeholders` | Get stakeholders data for frontend testing | N/A |
| GET | `/api/evidence` | Get evidence data for frontend testing | N/A |
| GET | `/api/v3/scenarios/{path:path}/forecasts` | Django-inspired hierarchical forecast endpoint with cursor-based pagination | `ff.prophet_forecasting` |
| GET | `/api/v3/scenarios/{path:path}/hierarchy` | Django-inspired hierarchical navigation structure | N/A |
| POST | `/api/v6/scenarios` | Create new scenario with LTREE path validation | `ff.scenario_construction` |
| GET | `/api/v6/scenarios/{scenario_id}/analysis` | Multi-factor scenario analysis with four-tier caching | `ff.scenario_construction` |
| GET | `/ws` | WebSocket endpoint for real-time updates with orjson serialization | N/A |
| GET | `/ws/echo` | Dedicated WebSocket echo endpoint for testing and diagnostics | N/A |
| GET | `/ws/health` | WebSocket health check endpoint for monitoring connection stability | N/A |
| GET | `/ws/v3/scenarios/{path:path}/forecasts` | Real-time forecast updates via WebSocket | `ff.prophet_forecasting` |

## WebSocket Message Schemas

| Message Type | Payload Schema | Description |
|--------------|----------------|-------------|
| `layer_data_update` | `LayerDataUpdatePayloadSchema` | Updates to geospatial layer data |
| `gpu_filter_sync` | `GPUFilterSyncPayloadSchema` | Synchronization of GPU filter parameters |
| `polygon_update` | `PolygonUpdatePayloadSchema` | Updates to polygon geometries with action |
| `linestring_update` | `LinestringUpdatePayloadSchema` | Updates to linestring geometries with action |
| `geometry_batch_update` | `GeometryBatchUpdatePayloadSchema` | Batch updates to multiple geometries |
| `entity_update` | `EntityUpdatePayloadSchema` | Updates to entity data |
| `hierarchy_change` | `HierarchyChangePayloadSchema` | Changes to hierarchical navigation structure |
| `bulk_update` | `BulkUpdatePayloadSchema` | Bulk updates to multiple entities |
| `cache_invalidate` | `CacheInvalidatePayloadSchema` | Cache invalidation messages |
| `search_update` | `SearchUpdatePayloadSchema` | Search result updates |
| `heartbeat` | `MessageMetaSchema` | Periodic heartbeat for connection health |
| `error` | `ErrorPayloadSchema` | Error messages with details |

## Feature Flags

| Flag Name | Default Value | Rollout Strategy | Description |
|-----------|---------------|------------------|-------------|
| `ff.hierarchy_optimized` | `true` | 100% | Enable LTREE optimized hierarchy performance |
| `ff.ws_v1` | `true` | 100% | Enable WebSocket v1 real-time features |
| `ff.map_v1` | `true` | 100% | Enable PostGIS geospatial mapping |
| `ff.ab_routing` | `false` | 0% | Enable A/B testing routing |
| `ff.prophet_forecasting` | `false` | 0% | Enable Prophet forecasting models |
| `ff.scenario_construction` | `false` | 0% | Enable scenario construction features |
| `ff_geospatial_enabled` | `false` | 0% | Enable core geospatial features |
| `ff_point_layer_enabled` | `false` | 0% | Enable point layer rendering |
| `ff_clustering_enabled` | `false` | 0% | Enable clustering of geospatial points |
| `ff_websocket_layers_enabled` | `false` | 0% | Enable WebSocket integration for layers |
| `ff_layer_performance_monitoring` | `true` | 100% | Enable layer performance monitoring |
| `ff_layer_audit_logging` | `true` | 100% | Enable layer audit logging |
| `rss_ingestion_enabled` | `true` | 100% | Enable RSS ingestion service |
| `entity_extraction_enabled` | `true` | 100% | Enable 5-W entity extraction |
| `geospatial_layers_enabled` | `false` | 0% | Enable geospatial features |
| `hierarchy_optimized` | `false` | 0% | Optimized hierarchy queries |
| `ws_v1` | `false` | 0% | Version 1 of WebSocket service |
| `ab_routing` | `false` | 0% | A/B test routing for ML models |

## Database Migrations

| Migration File | Purpose |
|----------------|---------|
| [`001_initial_schema.sql`](migrations/001_initial_schema.sql) | Phase 0 Initial Schema with LTREE and PostGIS extensions for optimized hierarchy performance |
| [`002_ml_ab_testing_framework.sql`](migrations/002_ml_ab_testing_framework.sql) | ML Model A/B Testing Framework with persistent Test Registry and automatic rollback capabilities |
| [`004_automated_materialized_view_refresh.sql`](migrations/004_automated_materialized_view_refresh.sql) | Automated Materialized View Refresh System with smart triggers and scheduler |
| [`004_rss_entity_extraction_schema.sql`](migrations/004_rss_entity_extraction_schema.sql) | RSS Entity Extraction Schema for storing articles and 5-W entity extraction results |

## Important Folder Structure

```
forecastin/
├── api/                    # FastAPI backend services
│   ├── main.py            # FastAPI application entry point and core routes
│   ├── navigation_api/    # Hierarchical navigation API with LTREE optimization
│   └── services/          # Core service implementations
│       ├── feature_flag_service.py    # FeatureFlagService with multi-tier caching
│       ├── cache_service.py           # Multi-tier cache service (L1/L2/L3/L4)
│       ├── realtime_service.py        # WebSocket service with safe serialization
│       └── rss/                       # RSS ingestion service
├── frontend/              # React + TypeScript frontend
│   ├── src/               # Source code
│   │   ├── components/    # React components organized by feature
│   │   ├── layers/        # Geospatial layer implementations
│   │   ├── config/        # Configuration files including feature flags
│   │   └── types/         # TypeScript type definitions
│   └── mocks/             # Mock data for testing
├── migrations/            # Database migration scripts
├── docs/                  # Documentation files
└── scripts/               # Utility and automation scripts