# Forecastin Evidence Index

Comprehensive index of key components identified during the two-pass analysis of the Forecastin repository. Each entry includes direct links to source code lines for easy reference.

## Backend Routes

| Route | Method | Description | Source Lines |
|-------|--------|-------------|--------------|
| `/health` | GET | Comprehensive health check endpoint | [`api/main.py:401-439`](api/main.py:401-439) |
| `/api/entities` | GET | Get all active entities with hierarchy optimization | [`api/main.py:442-455`](api/main.py:442-455) |
| `/api/entities/{entity_id}/hierarchy` | GET | Get entity hierarchy with optimized performance | [`api/main.py:458-471`](api/main.py:458-471) |
| `/api/entities/refresh` | POST | Manually refresh LTREE materialized views | [`api/main.py:474-521`](api/main.py:474-521) |
| `/api/entities/refresh/status` | GET | Get status of materialized view refresh operations | [`api/main.py:524-553`](api/main.py:524-553) |
| `/api/entities/refresh/automated/start` | POST | Start automated refresh service | [`api/main.py:556-568`](api/main.py:556-568) |
| `/api/entities/refresh/automated/stop` | POST | Stop automated refresh service | [`api/main.py:571-583`](api/main.py:571-583) |
| `/api/entities/refresh/automated/force` | POST | Force refresh of all materialized views | [`api/main.py:586-598`](api/main.py:586-598) |
| `/api/entities/refresh/automated/metrics` | GET | Get recent automated refresh metrics | [`api/main.py:601-613`](api/main.py:601-613) |
| `/ws` | WebSocket | Main WebSocket endpoint for real-time updates | [`api/main.py:616-749`](api/main.py:616-749) |
| `/ws/echo` | WebSocket | Dedicated WebSocket echo endpoint for testing | [`api/main.py:751-881`](api/main.py:751-881) |
| `/ws/health` | WebSocket | WebSocket health check endpoint | [`api/main.py:883-1015`](api/main.py:883-1015) |
| `/api/feature-flags` | GET | Get current feature flags status | [`api/main.py:1018-1030`](api/main.py:1018-1030) |
| `/api/feature-flags` | POST | Create a new feature flag | [`api/main.py:1033-1050`](api/main.py:1033-1050) |
| `/api/feature-flags/{flag_name}` | PUT | Update an existing feature flag | [`api/main.py:1053-1072`](api/main.py:1053-1072) |
| `/api/feature-flags/{flag_name}` | DELETE | Delete a feature flag | [`api/main.py:1075-1094`](api/main.py:1075-1094) |
| `/api/feature-flags/{flag_name}` | GET | Get a specific feature flag by name | [`api/main.py:1097-1114`](api/main.py:1097-1114) |
| `/api/feature-flags/{flag_name}/enabled` | GET | Check if a feature flag is enabled | [`api/main.py:1117-1134`](api/main.py:1117-1134) |
| `/api/feature-flags/metrics` | GET | Get feature flag service performance metrics | [`api/main.py:1137-1149`](api/main.py:1137-1149) |
| `/api/feature-flags/metrics/cache` | GET | Get cache service metrics for feature flags | [`api/main.py:1152-1164`](api/main.py:1152-1164) |
| `/api/opportunities` | GET | Get opportunities data for frontend testing | [`api/main.py:1171-1235`](api/main.py:1171-1235) |
| `/api/actions` | GET | Get actions data for frontend testing | [`api/main.py:1238-1315`](api/main.py:1238-1315) |
| `/api/stakeholders` | GET | Get stakeholders data for frontend testing | [`api/main.py:1318-1420`](api/main.py:1318-1420) |
| `/api/evidence` | GET | Get evidence data for frontend testing | [`api/main.py:1423-1525`](api/main.py:1423-1525) |
| `/api/v3/scenarios/{path:path}/forecasts` | GET | Django-inspired hierarchical forecast endpoint | [`api/main.py:1532-1592`](api/main.py:1532-1592) |
| `/api/v3/scenarios/{path:path}/hierarchy` | GET | Django-inspired hierarchical navigation structure | [`api/main.py:1595-1651`](api/main.py:1595-1651) |
| `/ws/v3/scenarios/{path:path}/forecasts` | WebSocket | Real-time forecast updates via WebSocket | [`api/main.py:1654-1712`](api/main.py:1654-1712) |
| `/api/v6/scenarios` | POST | Create new scenario with LTREE path validation | [`api/main.py:1714-1781`](api/main.py:1714-1781) |
| `/api/v6/scenarios/{scenario_id}/analysis` | GET | Multi-factor scenario analysis with caching | [`api/main.py:1784-1825`](api/main.py:1784-1825) |
| `/api/rss/ingest` | POST | Ingest RSS feed with complete processing pipeline | [`api/main.py:1832-1879`](api/main.py:1832-1879) |
| `/api/rss/ingest/batch` | POST | Ingest multiple RSS feeds in parallel | [`api/main.py:1882-1923`](api/main.py:1882-1923) |
| `/api/rss/metrics` | GET | Get RSS ingestion service performance metrics | [`api/main.py:1926-1948`](api/main.py:1926-1948) |
| `/api/rss/health` | GET | Perform RSS ingestion service health check | [`api/main.py:1951-1978`](api/main.py:1951-1978) |
| `/api/rss/jobs/{job_id}` | GET | Get status of an RSS ingestion job | [`api/main.py:1981-2003`](api/main.py:1981-2003) |

## WebSocket Message Types

| Message Type | Description | Source Lines |
|--------------|-------------|--------------|
| `entity_update` | Entity data updates | [`frontend/src/types/ws_messages.ts:43-52`](frontend/src/types/ws_messages.ts:43-52) |
| `hierarchy_change` | Hierarchy structure changes | [`frontend/src/types/ws_messages.ts:54-64`](frontend/src/types/ws_messages.ts:54-64) |
| `bulk_update` | Bulk entity updates | [`frontend/src/types/ws_messages.ts:66-75`](frontend/src/types/ws_messages.ts:66-75) |
| `layer_data_update` | Geospatial layer updates | [`frontend/src/types/ws_messages.ts:95-106`](frontend/src/types/ws_messages.ts:95-106) |
| `gpu_filter_sync` | GPU filter synchronization | [`frontend/src/types/ws_messages.ts:114-124`](frontend/src/types/ws_messages.ts:114-124) |
| `feature_flag_change` | Feature flag status changes | [`frontend/src/types/ws_messages.ts:130-141`](frontend/src/types/ws_messages.ts:130-141) |
| `feature_flag_created` | New feature flag creation | [`frontend/src/types/ws_messages.ts:143-158`](frontend/src/types/ws_messages.ts:143-158) |
| `feature_flag_deleted` | Feature flag deletion | [`frontend/src/types/ws_messages.ts:160-168`](frontend/src/types/ws_messages.ts:160-168) |
| `forecast_update` | Forecast data updates | [`frontend/src/types/ws_messages.ts:182-192`](frontend/src/types/ws_messages.ts:182-192) |
| `hierarchical_forecast_update` | Hierarchical forecast updates | [`frontend/src/types/ws_messages.ts:204-214`](frontend/src/types/ws_messages.ts:204-214) |
| `scenario_analysis_update` | Scenario analysis updates | [`frontend/src/types/ws_messages.ts:223-236`](frontend/src/types/ws_messages.ts:223-236) |
| `scenario_validation_update` | Scenario validation updates | [`frontend/src/types/ws_messages.ts:238-249`](frontend/src/types/ws_messages.ts:238-249) |
| `collaboration_update` | Collaboration status updates | [`frontend/src/types/ws_messages.ts:251-264`](frontend/src/types/ws_messages.ts:251-264) |
| `opportunity_update` | Opportunity data updates | [`frontend/src/types/ws_messages.ts:284-292`](frontend/src/types/ws_messages.ts:284-292) |
| `action_update` | Action status updates | [`frontend/src/types/ws_messages.ts:294-304`](frontend/src/types/ws_messages.ts:294-304) |
| `stakeholder_update` | Stakeholder data updates | [`frontend/src/types/ws_messages.ts:306-316`](frontend/src/types/ws_messages.ts:306-316) |
| `evidence_update` | Evidence data updates | [`frontend/src/types/ws_messages.ts:318-328`](frontend/src/types/ws_messages.ts:318-328) |
| `ping` | WebSocket ping message | [`frontend/src/types/ws_messages.ts:334-339`](frontend/src/types/ws_messages.ts:334-339) |
| `pong` | WebSocket pong response | [`frontend/src/types/ws_messages.ts:341-349`](frontend/src/types/ws_messages.ts:341-349) |
| `serialization_error` | Message serialization errors | [`frontend/src/types/ws_messages.ts:351-357`](frontend/src/types/ws_messages.ts:351-357) |
| `connection_established` | Connection establishment | [`frontend/src/types/ws_messages.ts:359-367`](frontend/src/types/ws_messages.ts:359-367) |
| `error` | General error messages | [`frontend/src/types/ws_messages.ts:369-376`](frontend/src/types/ws_messages.ts:369-376) |
| `heartbeat` | Heartbeat messages | [`frontend/src/types/ws_messages.ts:378-385`](frontend/src/types/ws_messages.ts:378-385) |
| `echo` | Echo response messages | [`frontend/src/types/ws_messages.ts:387-394`](frontend/src/types/ws_messages.ts:387-394) |
| `subscribe` | Channel subscription | [`frontend/src/types/ws_messages.ts:396-400`](frontend/src/types/ws_messages.ts:396-400) |
| `unsubscribe` | Channel unsubscription | [`frontend/src/types/ws_messages.ts:402-406`](frontend/src/types/ws_messages.ts:402-406) |
| `cache_invalidate` | Cache invalidation messages | [`frontend/src/types/ws_messages.ts:408-416`](frontend/src/types/ws_messages.ts:408-416) |
| `batch` | Batch message processing | [`frontend/src/types/ws_messages.ts:418-425`](frontend/src/types/ws_messages.ts:418-425) |

## Feature Flags

| Flag Name | Description | Source Lines |
|-----------|-------------|--------------|
| `ff.hierarchy_optimized` | Enable LTREE optimized hierarchy performance | [`migrations/001_initial_schema.sql:54`](migrations/001_initial_schema.sql:54) |
| `ff.ws_v1` | Enable WebSocket v1 real-time features | [`migrations/001_initial_schema.sql:55`](migrations/001_initial_schema.sql:55) |
| `ff.map_v1` | Enable PostGIS geospatial mapping | [`migrations/001_initial_schema.sql:56`](migrations/001_initial_schema.sql:56) |
| `ff.ab_routing` | Enable A/B testing routing | [`migrations/001_initial_schema.sql:57`](migrations/001_initial_schema.sql:57) |
| `ff.geospatial_layers` | Enable geospatial layer system | [`api/services/feature_flag_service.py:103`](api/services/feature_flag_service.py:103) |
| `ff.point_layer` | Point layer implementation | [`api/services/feature_flag_service.py:104`](api/services/feature_flag_service.py:104) |
| `ff.polygon_layer` | Polygon layer implementation | [`api/services/feature_flag_service.py:105`](api/services/feature_flag_service.py:105) |
| `ff.linestring_layer` | Linestring layer implementation | [`api/services/feature_flag_service.py:106`](api/services/feature_flag_service.py:106) |
| `ff.heatmap_layer` | Heatmap layer implementation | [`api/services/feature_flag_service.py:107`](api/services/feature_flag_service.py:107) |
| `ff.clustering_enabled` | Point clustering feature | [`api/services/feature_flag_service.py:110`](api/services/feature_flag_service.py:110) |
| `ff.gpu_filtering` | GPU-based spatial filtering | [`api/services/feature_flag_service.py:111`](api/services/feature_flag_service.py:111) |
| `ff.realtime_updates` | Real-time layer updates | [`api/services/feature_flag_service.py:112`](api/services/feature_flag_service.py:112) |
| `ff.websocket_layers` | WebSocket layer integration | [`api/services/feature_flag_service.py:113`](api/services/feature_flag_service.py:113) |
| `ff.layer_performance_monitoring` | Layer performance tracking | [`api/services/feature_flag_service.py:116`](api/services/feature_flag_service.py:116) |
| `ff.layer_audit_logging` | Layer audit trail | [`api/services/feature_flag_service.py:117`](api/services/feature_flag_service.py:117) |
| `ff.automated_refresh_v1` | Automated materialized view refresh system | [`api/services/feature_flag_service.py:1053`](api/services/feature_flag_service.py:1053) |
| `ff.prophet_forecasting` | Prophet forecasting feature | [`api/main.py:1546`](api/main.py:1546) |
| `ff.scenario_construction` | Scenario construction feature | [`api/main.py:1723`](api/main.py:1723) |

## Database Migrations

| Migration File | Description | Key Components | Source Lines |
|----------------|-------------|----------------|--------------|
| `001_initial_schema.sql` | Phase 0 initial schema with LTREE and PostGIS | Entities table, feature_flags, materialized views | [`migrations/001_initial_schema.sql:1-215`](migrations/001_initial_schema.sql:1-215) |
| `002_ml_ab_testing_framework.sql` | ML Model A/B Testing Framework | Model variants, test registry, risk conditions | [`migrations/002_ml_ab_testing_framework.sql:1-538`](migrations/002_ml_ab_testing_framework.sql:1-538) |
| `004_automated_materialized_view_refresh.sql` | Automated refresh system for LTREE optimization | Refresh scheduling, smart triggers, performance monitoring | [`migrations/004_automated_materialized_view_refresh.sql:1-375`](migrations/004_automated_materialized_view_refresh.sql:1-375) |

## Frontend Components

| Component | Description | Source Lines |
|-----------|-------------|--------------|
| `App.tsx` | Main application component with routing setup | [`frontend/src/App.tsx:1-86`](frontend/src/App.tsx:1-86) |
| `uiStore.ts` | UI state management with Zustand | [`frontend/src/store/uiStore.ts:1-201`](frontend/src/store/uiStore.ts:1-201) |
| `OutcomesDashboard.tsx` | Main dashboard with four horizon lanes | [`frontend/src/components/Outcomes/OutcomesDashboard.tsx:1-278`](frontend/src/components/Outcomes/OutcomesDashboard.tsx:1-278) |

## Key Service Implementations

| Service | Description | Source Lines |
|---------|-------------|--------------|
| `FeatureFlagService` | Feature flag management with multi-tier caching | [`api/services/feature_flag_service.py:163-1204`](api/services/feature_flag_service.py:163-1204) |
| `WebSocketMessageSchema` | Unified WebSocket message schemas with Zod validation | [`frontend/src/types/ws_messages.ts:431-471`](frontend/src/types/ws_messages.ts:431-471) |

## Performance Metrics

| Metric | Target | Actual | Source |
|--------|--------|--------|--------|
| Ancestor Resolution | <2ms | ~1.25ms | [`api/main.py:435`](api/main.py:435) |
| Throughput RPS | >10,000 | 42,726 | [`api/main.py:436`](api/main.py:436) |
| Cache Hit Rate | >95% | 99.2% | [`api/main.py:437`](api/main.py:437) |

## Summary

This evidence index provides comprehensive coverage of the Forecastin repository's key components, linking directly to source code lines for easy reference during development, testing, and code review processes. The tables organize backend routes, WebSocket message types, feature flags, database migrations, and frontend components with precise line references to facilitate efficient navigation and understanding of the codebase architecture.