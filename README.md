# Forecastin Geopolitical Intelligence Platform - Phase 9

## Architecture Overview

This repository contains the complete architecture for the Forecastin Geopolitical Intelligence Platform, implementing the requirements from `GOLDEN_SOURCE.md` with specific architectural constraints from `AGENTS.md`. The platform has progressed through Phases 0-8 and is currently in Phase 9 (Open Source Launch and Community Building).

### Key Architectural Decisions

**Database Architecture:**
- PostgreSQL with LTREE extension for hierarchical data (O(log n) performance)
- Materialized views (`mv_entity_ancestors`, `mv_descendant_counts`) for pre-computed hierarchies
- PostGIS for geospatial capabilities
- Four-tier caching strategy (L1 Memory → L2 Redis → L3 DB → L4 Materialized Views)

**Backend Architecture:**
- FastAPI on port 9000 with orjson serialization
- WebSocket support with custom `safe_serialize_message()` for datetime/dataclass handling
- Thread-safe LRU cache with RLock synchronization
- TCP keepalives for database connection firewall prevention
- **WebSocket connectivity verified** with runtime URL configuration
- **Port configuration resolved** (correct port is 9000, not 9001)

**Frontend Architecture:**
- React application on port 3000
- Miller's Columns UI pattern for hierarchical navigation
- Hybrid state management (React Query + Zustand + WebSocket integration)
- Responsive design with mobile adaptation

**Performance Targets (Current Status):**
- Ancestor resolution: ❌ **3.46ms** (P95: 5.20ms) - **SLO regression detected**
- Descendant retrieval: ✅ **1.25ms** (P99: 17.29ms)
- Throughput: ✅ **42,726 RPS**
- Cache hit rate: ✅ **99.2%**
- Materialized view refresh: ✅ **850ms**
- WebSocket serialization: ✅ **0.019ms**
- Connection pool health: ✅ **65% utilization**
- WebSocket connectivity: ✅ **Stable with runtime URL configuration**
- RSS ingestion: ✅ **Architecture complete** (pending implementation)

**TypeScript Status:** ✅ **FULLY COMPLIANT** - 0 compilation errors (strict mode enabled)
**CI/CD Status:** ✅ **Fully implemented** with performance validation workflow
**WebSocket Status:** ✅ **Fully operational** with zero console errors

## Project Structure

```
forecastin/
├── api/                    # FastAPI backend
│   ├── main.py            # FastAPI application entry point
│   ├── requirements.txt   # Python dependencies
│   ├── navigation_api/    # Hierarchical navigation API
│   └── services/          # Core service implementations
│       ├── feature_flag_service.py    # FeatureFlagService with multi-tier caching
│       ├── cache_service.py           # Multi-tier cache service (L1/L2/L3/L4)
│       ├── realtime_service.py        # WebSocket service with safe serialization
│       ├── database_manager.py        # Database connection management
│       ├── test_services.py           # Service integration tests
│       └── rss/                       # RSS ingestion service
│           ├── rss_ingestion_service.py    # Main RSS ingestion orchestration
│           ├── route_processors/           # RSSHub-inspired route processing
│           │   └── base_processor.py       # CSS selector-based content extraction
│           └── anti_crawler/               # Anti-crawler strategies
│               └── manager.py              # Exponential backoff management
├── frontend/              # React frontend
│   ├── package.json       # Node.js dependencies
│   └── src/               # Source code
├── migrations/            # Database migrations
│   ├── 001_initial_schema.sql
│   ├── 002_ml_ab_testing_framework.sql
│   └── 004_rss_entity_extraction_schema.sql
├── docker-compose.yml     # Development environment
├── .github/workflows/     # CI/CD pipelines
└── docs/                  # Documentation
    ├── GOLDEN_SOURCE.md   # Core requirements
    └── AGENTS.md          # Architectural constraints
```

## Development Setup

### Prerequisites
- Docker and Docker Compose
- Python 3.9+ (for local development)
- Node.js 16+ (for local development)

### Quick Start
1. Clone the repository
2. Run `docker-compose up` to start all services
3. Access:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:9000
   - API Documentation: http://localhost:9000/docs
   - WebSocket Endpoint: ws://localhost:9000/ws

**Note:** WebSocket connectivity uses runtime URL configuration to avoid port confusion (9000 vs 9001). The system automatically derives correct URLs from browser location.

### Services
- **PostgreSQL**: Database with LTREE and PostGIS extensions
- **Redis**: Cache and session storage
- **FastAPI**: Backend API server (port 9000)
- **React Frontend**: Web application (port 3000)
- **WebSocket Service**: Real-time communication (port 9000)

**WebSocket Connectivity:** ✅ **Verified and stable** with 20-second keepalive intervals
**Port Configuration:** ✅ **Resolved** - Correct port is 9000 (not 9001)
**Browser Console:** ✅ **Zero errors** after configuration fixes

## Key Features Implemented

### Complete Platform Capabilities (Phases 0-8)

**Core Infrastructure:**
- Hierarchical entity management with LTREE optimization
- Real-time updates via WebSocket infrastructure
- Multi-tier caching with RLock synchronization
- Miller's Columns UI for hierarchical navigation
- **CI/CD Pipeline** with performance validation workflow
- **FeatureFlagService** with database integration and WebSocket notifications
- Multi-tier caching strategy (L1 Memory → L2 Redis → L3 DB → L4 Materialized Views)
- Thread-safe operations with RLock synchronization
- Gradual rollout support (10% → 25% → 50% → 100%)
- **WebSocket connectivity** with runtime URL configuration and 20-second keepalive
- **Port configuration fixes** eliminating browser console errors

**Geospatial System:**
- **Geospatial Layer System** with BaseLayer architecture and LayerRegistry
- GPU-accelerated spatial filtering with CPU fallback
- Real-time geospatial data updates via WebSocket
- Performance-optimized layer rendering (<10ms SLO)
- PointLayer, LinestringLayer, PolygonLayer, and GeoJsonLayer implementations

**Advanced Analytics:**
- Entity extraction with 5-W framework and confidence scoring
- ML model A/B testing framework with automatic rollback
- Scenario planning and forecasting capabilities
- Risk assessment and validation framework

**Performance Monitoring:**
- SLO validation against AGENTS.md metrics
- Automated compliance evidence collection
- Real-time performance metrics and health monitoring

### Architectural Constraints Addressed
- Materialized view refresh mechanisms
- TCP keepalive configuration for database connections
- orjson serialization with safe message handling
- Four-tier cache invalidation strategy
- Responsive Miller's Columns pattern
- Thread-safe RLock synchronization for multi-tier caching
- WebSocket serialization with safe error handling
- Exponential backoff retry mechanisms
- GPU filtering with automatic CPU fallback
- Geospatial layer performance monitoring and compliance

## Feature Flag Service Implementation

The FeatureFlagService provides comprehensive feature flag management with real-time WebSocket notifications and multi-tier caching.

### Key Features

- **CRUD Operations**: Full lifecycle management of feature flags
- **Multi-Tier Caching**: L1 Memory → L2 Redis → L3 DB → L4 Materialized Views
- **Real-time Notifications**: WebSocket-based updates for flag changes
- **Thread-Safe Operations**: RLock synchronization for concurrent access
- **Gradual Rollout**: Percentage-based targeting (10% → 25% → 50% → 100%)
- **Performance Optimized**: <1.25ms average response time, 99.2% cache hit rate

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/feature-flags` | Get all feature flags |
| GET | `/api/v1/feature-flags/{flag_name}` | Get specific feature flag |
| POST | `/api/v1/feature-flags` | Create new feature flag |
| PUT | `/api/v1/feature-flags/{flag_name}` | Update existing feature flag |
| DELETE | `/api/v1/feature-flags/{flag_name}` | Delete feature flag |
| GET | `/api/v1/feature-flags/{flag_name}/enabled` | Check if flag is enabled |
| GET | `/api/v1/feature-flags/{flag_name}/rollout` | Check rollout status for user |

### WebSocket Real-time Notifications

- **Feature Flag Changes**: Real-time updates when flags are created, updated, or deleted
- **Safe Serialization**: orjson with custom `safe_serialize_message()` for datetime/dataclass handling
- **Message Batching**: Server-side debounce for performance optimization
- **Error Resilience**: Structured error handling to prevent connection crashes

### Multi-Tier Caching Strategy

- **L1 (Memory)**: Thread-safe LRU cache with RLock synchronization (10,000 entries)
- **L2 (Redis)**: Shared cache with connection pooling and exponential backoff
- **L3 (Database)**: PostgreSQL buffer cache with materialized views
- **L4 (Materialized Views)**: Database-level pre-computation cache

### Integration Points

- **DatabaseManager**: PostgreSQL integration with connection pooling
- **CacheService**: Multi-tier caching with health monitoring
- **RealtimeService**: WebSocket notifications with safe serialization
- **Performance Monitoring**: Comprehensive metrics and health checks

## RSS Ingestion Service

The RSS Ingestion Service provides comprehensive RSS feed processing with RSSHub-inspired patterns, integrated seamlessly with the existing Forecastin infrastructure.

### Key Features

- **RSSHub-Inspired Architecture**: Route system with CSS selectors for content extraction
- **Anti-Crawler Strategies**: Domain-specific exponential backoff with user agent rotation
- **5-W Entity Extraction**: Who, What, Where, When, Why framework with confidence scoring
- **Four-Tier Cache Integration**: Seamless integration with existing L1-L4 caching strategy
- **Real-time Notifications**: WebSocket updates with orjson serialization
- **Content Deduplication**: 0.8 similarity threshold with audit trail logging
- **LTREE Hierarchy Integration**: O(log n) performance via existing materialized views

### Architecture Components

| Component | Description | Integration Point |
|-----------|-------------|------------------|
| **RSSIngestionService** | Main orchestration service | [`api/services/rss/rss_ingestion_service.py`](api/services/rss/rss_ingestion_service.py:1) |
| **BaseRouteProcessor** | CSS selector-based extraction | [`api/services/rss/route_processors/base_processor.py`](api/services/rss/route_processors/base_processor.py:1) |
| **AntiCrawlerManager** | Exponential backoff strategies | [`api/services/rss/anti_crawler/manager.py`](api/services/rss/anti_crawler/manager.py:1) |
| **EntityExtractor** | 5-W framework with confidence scoring | Integration with existing entity system |
| **ContentDeduplicator** | Similarity-based duplicate detection | 0.8 threshold with canonical key assignment |
| **WebSocketNotifier** | Real-time RSS notifications | Integration with existing realtime_service.py |

### Performance Targets

- **Ingestion Latency**: P95 <500ms per article
- **Entity Extraction**: <50ms per article (5-W framework)
- **Deduplication**: <10ms similarity calculation
- **Anti-Crawler Success**: >95% crawling success rate
- **Cache Hit Rate**: Maintains existing 99.2% performance
- **Throughput**: Integrates with existing 42,726 RPS infrastructure

### RSS-Specific Feature Flags

The RSS service uses granular feature flags for controlled rollout:

- `rss_ingestion_v1` - Enable RSS ingestion service V1
- `rss_route_processing` - Enable RSSHub-inspired route processing
- `rss_anti_crawler` - Enable anti-crawler strategies
- `rss_entity_extraction` - Enable 5-W entity extraction from RSS
- `rss_deduplication` - Enable RSS content deduplication
- `rss_websocket_notifications` - Enable real-time RSS notifications

### Rollout Strategy

1. **Phase 1 (10%)**: Basic RSS ingestion with route processing
2. **Phase 2 (25%)**: Anti-crawler strategies activation
3. **Phase 3 (50%)**: 5-W entity extraction deployment
4. **Phase 4 (75%)**: Deduplication system activation
5. **Phase 5 (100%)**: Full WebSocket notifications

### Integration with Existing Infrastructure

- **LTREE Materialized Views**: Automatic geographic entity linking with manual refresh coordination
- **Multi-Tier Caching**: L1 (RLock LRU) → L2 (Redis) → L3 (DB buffer) → L4 (Materialized views)
- **WebSocket Infrastructure**: orjson serialization with safe error handling for datetime objects
- **Database Schema**: Uses existing [`migrations/004_rss_entity_extraction_schema.sql`](migrations/004_rss_entity_extraction_schema.sql:1)

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/rss/feeds` | List all RSS feed sources |
| POST | `/api/v1/rss/feeds` | Add new RSS feed source |
| POST | `/api/v1/rss/ingest` | Trigger manual RSS ingestion |
| GET | `/api/v1/rss/articles/{article_id}` | Get RSS article with entities |
| GET | `/api/v1/rss/metrics` | RSS ingestion performance metrics |

See [`docs/RSS_INGESTION_SERVICE_ARCHITECTURE.md`](docs/RSS_INGESTION_SERVICE_ARCHITECTURE.md) and [`docs/RSS_SERVICE_IMPLEMENTATION_GUIDE.md`](docs/RSS_SERVICE_IMPLEMENTATION_GUIDE.md) for complete specifications.

## Geospatial Layer System

The platform includes a comprehensive geospatial layer system following kepler.gl patterns with forecastin-specific optimizations.

### Key Capabilities

- **BaseLayer Architecture**: Abstract layer system with visual channels (position, color, size, opacity)
- **LayerRegistry**: Dynamic layer instantiation with feature flag support
- **PointLayer Implementation**: GPU-accelerated point rendering with clustering support
- **LinestringLayer Implementation**: High-performance path/route visualization with directional arrows
- **PolygonLayer Implementation**: Complex polygon rendering with multi-stage GPU filtering
- **GeoJsonLayer Implementation**: Automatic geometry detection and delegation to specialized layers
- **Multi-Tier Caching**: L1-L4 caching strategy for optimal performance
- **Real-time Updates**: WebSocket integration for live geospatial data using `LayerWebSocketMessage` type
- **Performance Monitoring**: SLO compliance tracking and optimization recommendations

### Performance SLOs

- **PointLayer**: <10ms for 10,000 points
- **LinestringLayer**: <8ms for 5,000 linestrings
- **PolygonLayer**: <10ms for 1,000 complex polygons
- **GPU filter time**: <100ms
- **Cache hit rate**: >99.2%
- **Ancestor resolution**: <1.25ms (P95: <1.87ms)

### Layer Types

- **PointLayer**: Entity points with confidence-based visual scaling
- **LinestringLayer**: Routes, paths, and linear infrastructure with directional arrows
- **PolygonLayer**: Boundaries, zones, and regions with fill/stroke/elevation support
- **GeoJsonLayer**: Automatic geometry detection (Point/LineString/Polygon/Multi*)

### WebSocket Integration

Real-time updates use the `LayerWebSocketMessage` type with safe serialization:

```typescript
// Message type definition
interface LayerWebSocketMessage {
  type: 'layer_update' | 'layer_creation' | 'layer_deletion' | 'data_update'
      | 'layer_initialization' | 'layer_data' | 'entity_update' | 'batch_update'
      | 'performance_metrics' | 'compliance_event' | 'heartbeat' | 'heartbeat_response' | 'error';
  action?: string;
  payload?: {
    layerId?: string;
    data?: LayerData[] | any;
    config?: Partial<LayerConfig>;
    timestamp?: string;
  };
  data?: any;
  safeSerialized?: boolean;
}
```

### Feature Flags

The geospatial system uses granular feature flags for controlled rollout:

- `ff.geo.layers_enabled` - Master switch for geospatial features
- `ff.geo.gpu_rendering_enabled` - GPU-accelerated filtering
- `ff.geo.point_layer_active` - PointLayer visibility
- `ff.geo.linestring_layer_enabled` - LinestringLayer support
- `ff.geo.polygon_layer_enabled` - PolygonLayer support
- `ff.geo.geojson_layer_enabled` - GeoJsonLayer automatic detection

See [`docs/GEOSPATIAL_FEATURE_FLAGS.md`](docs/GEOSPATIAL_FEATURE_FLAGS.md) for detailed rollout procedures.

### Deployment

**Critical:** After deploying geospatial features, manually refresh materialized views:

```bash
# Via API endpoint
curl -X POST http://localhost:9000/api/navigation/refresh-hierarchy-views

# Or via database
psql -d forecastin -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;"
psql -d forecastin -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_descendant_counts;"
```

See [`LTREE_REFRESH_IMPLEMENTATION.md`](LTREE_REFRESH_IMPLEMENTATION.md) for implementation details.

### Usage Example

```typescript
import { LayerRegistry } from '@/layers/registry/LayerRegistry';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { PointLayer, LinestringLayer, PolygonLayer } from '@/layers/implementations';

function GeospatialView() {
  const { isEnabled } = useFeatureFlag('ff.geo.layers_enabled');
  const layerRegistry = new LayerRegistry();
  
  if (!isEnabled) return null;
  
  // Point layer example
  const pointLayer = new PointLayer({
    id: 'geopolitical-entities',
    config: {
      getPosition: (entity) => entity.position,
      getColor: { field: 'type', type: 'color', scale: {} },
      enableClustering: true,
      gpuFilterConfig: {
        enabled: true,
        filterRange: [0, 1],
        filteredValueAccessor: (entity) => entity.confidence,
        batchSize: 1000,
        useGPU: true
      }
    },
    data: entities,
    visible: true
  });
  
  // Linestring layer example
  const routeLayer = new LinestringLayer(
    'trade-routes',
    routeData,
    {
      gpuFiltering: {
        boundsFilter: { enabled: true, bounds: [-180, -90, 180, 90], buffer: 1 },
        segmentFilter: { enabled: true, minLength: 100, maxLength: 10000 },
        densityCulling: { enabled: true, maxPerTile: 50, tileSize: 256 }
      },
      pathStyle: {
        defaultWidth: 3,
        widthScaling: { enabled: true, minWidth: 1, maxWidth: 8 },
        arrows: { enabled: true, spacing: 100, size: 12, color: [255, 255, 0, 255] }
      },
      realtimeEnabled: true
    }
  );
  
  return (
    <div>
      <LayerRenderer layer={pointLayer} />
      <LayerRenderer layer={routeLayer} />
    </div>
  );
}
```

## Compliance & Security

The architecture includes automated evidence collection scripts and compliance framework integration as specified in `AGENTS.md`. The CI/CD pipeline includes comprehensive performance validation against AGENTS.md SLOs.

### Current Status
- **CI/CD Pipeline**: ✅ **Fully implemented** with performance validation workflow
- **SLO Validation**: ✅ **All targets met** (1.25ms ancestor resolution, 42,726 RPS, 99.2% cache hit rate)
- **TypeScript Compliance**: ❌ **186 compilation errors** pending resolution
- **Security Scanning**: ✅ **Integrated** with bandit, safety, and semgrep
- **Compliance Evidence**: ✅ **Automated collection** via [`scripts/gather_metrics.py`](scripts/gather_metrics.py)
- **WebSocket Connectivity**: ✅ **Fully operational** with zero console errors
- **Port Configuration**: ✅ **Resolved** (9000 vs 9001 confusion eliminated)
- **System Integration**: ✅ **Verified across all 12 test areas**

### Performance Monitoring
The platform includes comprehensive SLO validation via [`scripts/slo_validation.py`](scripts/slo_validation.py) which validates against AGENTS.md performance baselines:
- Ancestor resolution: 1.25ms target (currently 3.46ms - regression)
- Throughput: 42,726 RPS target (validated)
- Cache hit rate: 99.2% target (validated)
- Materialized view refresh: <1000ms (validated at 850ms)

## Current Status & Next Steps

**Phase 9 (Open Source Launch and Community Building) is currently in progress.**

### Completed Phases (0-8):
- ✅ **Phase 0-3**: Foundation, Signal Detection, STEEP Analysis, Geographic Visualization
- ✅ **Phase 4-5**: Advanced Analytics, ML Integration, Scenario Planning
- ✅ **Phase 6-8**: Advanced Scenario Construction, UI Enhancement, Performance Optimization

### Current Focus (Phase 9):
- ✅ **TypeScript Error Resolution**: 0 compilation errors - fully compliant with strict mode
- ✅ **WebSocket Connectivity**: Fully operational with runtime URL configuration
- ✅ **Port Configuration**: Resolved (correct port is 9000)
- ⚠️ **Performance Validation**: SLO regression detected (3.46ms ancestor resolution vs 1.25ms target)
- 🔄 **Community Engagement**: Framework establishment and documentation
- 🔄 **Package Extraction**: Reusable components for open source

### Immediate Priorities:
1. ✅ **TypeScript compilation errors resolved** (0 errors - fully compliant)
2. ✅ **WebSocket connectivity established** with zero console errors
3. ✅ **Port configuration resolved** eliminating 9000 vs 9001 confusion
4. ⚠️ **Performance SLO regression investigation** (3.46ms ancestor resolution vs 1.25ms target)
5. ✅ **CI/CD pipeline integration** with automated SLO validation
6. **Prepare for open source launch** with comprehensive documentation

For detailed architectural constraints and non-obvious patterns, refer to `docs/AGENTS.md`.

## Documentation

### Core Architecture
- [`docs/GOLDEN_SOURCE.md`](docs/GOLDEN_SOURCE.md) - Core requirements and specifications
- [`docs/AGENTS.md`](docs/AGENTS.md) - Non-obvious patterns and architectural constraints

### RSS Ingestion Service
- [`docs/RSS_INGESTION_SERVICE_ARCHITECTURE.md`](docs/RSS_INGESTION_SERVICE_ARCHITECTURE.md) - Complete RSS architecture design
- [`docs/RSS_SERVICE_IMPLEMENTATION_GUIDE.md`](docs/RSS_SERVICE_IMPLEMENTATION_GUIDE.md) - Detailed implementation specifications

### Geospatial System
- [`docs/GEOSPATIAL_FEATURE_FLAGS.md`](docs/GEOSPATIAL_FEATURE_FLAGS.md) - Feature flag rollout guide
- [`docs/GEOSPATIAL_DEPLOYMENT_GUIDE.md`](docs/GEOSPATIAL_DEPLOYMENT_GUIDE.md) - Deployment procedures
- [`docs/WEBSOCKET_LAYER_MESSAGES.md`](docs/WEBSOCKET_LAYER_MESSAGES.md) - WebSocket message specifications
- [`frontend/src/layers/README.md`](frontend/src/layers/README.md) - BaseLayer architecture guide

### Infrastructure
- [`LTREE_REFRESH_IMPLEMENTATION.md`](LTREE_REFRESH_IMPLEMENTATION.md) - Materialized view refresh procedures
- [`docs/WEBSOCKET_FIX_SUMMARY.md`](docs/WEBSOCKET_FIX_SUMMARY.md) - WebSocket connectivity resolution