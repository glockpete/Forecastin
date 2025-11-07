# LTREE Materialized View Refresh API Implementation

## Overview

This implementation provides a manual refresh mechanism for LTREE materialized views in the Forecastin Geopolitical Intelligence Platform. The system addresses the critical requirement that materialized views do not automatically refresh like regular views and require manual intervention.

## Architecture

### Core Components

1. **OptimizedHierarchyResolver** (`api/navigation_api/database/optimized_hierarchy_resolver.py`)
   - Contains `refresh_materialized_view()` method for individual view refresh
   - Contains `refresh_all_materialized_views()` method for batch refresh
   - Implements thread-safe operations with RLock synchronization
   - Supports concurrent and regular refresh with automatic fallback

2. **FastAPI Application** (`api/main.py`)
   - Provides REST API endpoints for manual refresh operations
   - Integrates with existing WebSocket and orjson serialization patterns
   - Includes comprehensive error handling and logging

## API Endpoints

### POST `/api/entities/refresh`

**Purpose**: Manually trigger refresh of all LTREE materialized views

**Response Format**:
```json
{
  "status": "success|partial_success",
  "message": "All materialized views refreshed successfully",
  "results": {
    "mv_entity_ancestors": true,
    "mv_descendant_counts": true,
    "mv_entity_hierarchy_stats": true
  },
  "duration_ms": 123.45,
  "failed_views": []
}
```

Note: `failed_views` is only present if status is `partial_success`.

**Error Response**:
```json
{
  "detail": "Error description"
}
```

### GET `/api/entities/refresh/status`

**Purpose**: Get status and metrics for materialized view refresh operations

**Response Format**:
```json
{
  "status": "available",
  "last_refresh": 1234567890.123,
  "cache_metrics": {
    "l1_cache": {},
    "l2_cache": {},
    "l3_cache": {},
    "l4_cache": {},
    "overall": {}
  },
  "automated_refresh_status": {
    "enabled": true,
    "last_run": 1234567890.123,
    "next_run": 1234567899.123,
    "interval_seconds": 300,
    "success_count": 42,
    "failure_count": 0
  },
  "message": "LTREE materialized view refresh service is operational"
}
```

---

## Automated Refresh Endpoints

### POST `/api/entities/refresh/automated/start`

**Purpose**: Start the automated materialized view refresh service

**Description**: Initializes a background service that periodically refreshes all LTREE materialized views at a configured interval. The service runs in a separate thread and can be stopped/restarted as needed.

**Request Body**: None

**Response Format**:
```json
{
  "status": "success",
  "message": "Automated refresh service started successfully",
  "config": {
    "interval_seconds": 300,
    "concurrent_refresh": true,
    "views": [
      "mv_entity_ancestors",
      "mv_descendant_counts",
      "mv_entity_hierarchy_stats"
    ]
  }
}
```

**Error Response**:
```json
{
  "detail": "Automated refresh service is already running"
}
```

**Usage Example**:
```bash
curl -X POST http://localhost:9000/api/entities/refresh/automated/start
```

**Behaviour**:
- Starts background thread for periodic refresh
- Default interval: 300 seconds (5 minutes)
- Uses concurrent refresh when available
- Stores metrics in `refresh_metrics` table
- Continues running until explicitly stopped

**Idempotency**: Calling this endpoint multiple times will not start duplicate services. Returns success if already running.

---

### POST `/api/entities/refresh/automated/stop`

**Purpose**: Stop the automated materialized view refresh service

**Description**: Gracefully stops the background refresh service. Completes any in-progress refresh operation before stopping.

**Request Body**: None

**Response Format**:
```json
{
  "status": "success",
  "message": "Automated refresh service stopped successfully",
  "final_metrics": {
    "total_refreshes": 142,
    "successful_refreshes": 142,
    "failed_refreshes": 0,
    "average_duration_ms": 745.3,
    "uptime_seconds": 42600
  }
}
```

**Error Response**:
```json
{
  "detail": "Automated refresh service is not running"
}
```

**Usage Example**:
```bash
curl -X POST http://localhost:9000/api/entities/refresh/automated/stop
```

**Behaviour**:
- Waits for current refresh to complete
- Stops background thread gracefully
- Preserves metrics in database
- Returns final statistics

**Safety**: Safe to call during active refresh - will wait for completion before stopping.

---

### POST `/api/entities/refresh/automated/force`

**Purpose**: Force an immediate refresh regardless of schedule

**Description**: Triggers an immediate refresh of all materialized views, even if the automated service is running on its regular schedule. Does not interfere with the scheduled refresh cycle.

**Request Body**: None

**Response Format**:
```json
{
  "status": "success",
  "result": {
    "duration_ms": 856.4,
    "views_refreshed": 3,
    "success": true,
    "results": {
      "mv_entity_ancestors": true,
      "mv_descendant_counts": true,
      "mv_entity_hierarchy_stats": true
    }
  },
  "message": "Forced refresh completed successfully"
}
```

**Error Response**:
```json
{
  "detail": "Automated refresh service is not running"
}
```

**Usage Example**:
```bash
curl -X POST http://localhost:9000/api/entities/refresh/automated/force
```

**Use Cases**:
- Immediate data consistency required
- After bulk data import
- Testing/debugging
- Manual intervention during incidents

**Performance**: May block briefly while refresh completes. Use concurrent refresh for minimal impact.

---

### GET `/api/entities/refresh/automated/metrics`

**Purpose**: Retrieve historical refresh metrics and performance statistics

**Description**: Returns detailed metrics from the `refresh_metrics` table showing historical refresh performance, success rates, and trends.

**Query Parameters**:
- `limit` (optional, default: 100): Maximum number of metrics to return
- `view_name` (optional): Filter by specific view name
- `since` (optional): Unix timestamp to filter metrics after this time

**Response Format**:
```json
{
  "status": "success",
  "metrics": [
    {
      "id": 1234,
      "view_name": "mv_entity_ancestors",
      "refresh_duration_ms": 856.4,
      "success": true,
      "created_at": "2025-11-07T10:30:00Z",
      "error_message": null
    },
    {
      "id": 1235,
      "view_name": "mv_descendant_counts",
      "refresh_duration_ms": 423.1,
      "success": true,
      "created_at": "2025-11-07T10:35:00Z",
      "error_message": null
    }
  ],
  "summary": {
    "total_count": 142,
    "success_count": 142,
    "failure_count": 0,
    "success_rate": 100.0,
    "average_duration_ms": 745.3,
    "p95_duration_ms": 987.2,
    "p99_duration_ms": 1045.6,
    "min_duration_ms": 423.1,
    "max_duration_ms": 1123.4
  }
}
```

**Usage Examples**:
```bash
# Get last 100 metrics
curl http://localhost:9000/api/entities/refresh/automated/metrics

# Get last 50 metrics
curl http://localhost:9000/api/entities/refresh/automated/metrics?limit=50

# Get metrics for specific view
curl "http://localhost:9000/api/entities/refresh/automated/metrics?view_name=mv_entity_ancestors"

# Get recent metrics (last hour)
curl "http://localhost:9000/api/entities/refresh/automated/metrics?since=$(date -d '1 hour ago' +%s)"
```

**Monitoring Integration**:
- Use for Grafana dashboards
- Set up alerts on failure_count > 0
- Track p95_duration_ms for performance regression
- Monitor success_rate for SLO compliance

---

## Implementation Details

### Materialized View Refresh Strategy

1. **Concurrent Refresh**: Attempts `REFRESH MATERIALIZED VIEW CONCURRENTLY` first
   - Non-blocking operation
   - Allows reads during refresh
   - Preferred method for production

2. **Regular Refresh**: Falls back to `REFRESH MATERIALIZED VIEW` if concurrent fails
   - Blocking operation
   - Ensures data consistency
   - Used when concurrent refresh is not supported

3. **Error Handling**: Comprehensive error handling with detailed reporting
   - Tracks success/failure for each view
   - Provides partial success responses
   - Logs detailed error information

### Performance Considerations

- **Concurrent Refresh**: Minimizes database locking
- **Batch Operations**: Refreshes all views in single operation
- **Timing Metrics**: Measures and reports refresh duration
- **Connection Pool**: Uses existing connection pool with health monitoring

### Integration with Existing Architecture

1. **Four-Tier Cache Coordination**
   - L1: Memory LRU cache (thread-safe with RLock)
   - L2: Redis distributed cache
   - L3: PostgreSQL buffer cache
   - L4: Materialized views (pre-computation cache)

2. **WebSocket Integration**
   - Uses existing `safe_serialize_message()` for orjson serialization
   - Follows established error handling patterns
   - Integrates with connection management

3. **Health Monitoring**
   - Integrated with existing health check system
   - Background monitoring every 30 seconds
   - Performance metrics collection

## Usage Examples

### Manual Refresh

```bash
curl -X POST http://localhost:9000/api/entities/refresh
```

### Check Status

```bash
curl http://localhost:9000/api/entities/refresh/status
```

### Health Check

```bash
curl http://localhost:9000/health
```

## Testing

The implementation includes a comprehensive test script (`test_refresh_endpoint.py`) that:

1. Validates health check functionality
2. Tests refresh status endpoint
3. Performs manual refresh operation
4. Verifies proper error handling
5. Provides detailed API documentation

Run tests with:
```bash
python test_refresh_endpoint.py
```

## Critical Implementation Notes

### LTREE Materialized View Requirements

- **Manual Refresh Required**: Materialized views do not automatically update
- **Trigger-Based Maintenance**: Must call refresh after hierarchy modifications
- **Performance Impact**: Refresh operations can be resource-intensive

### Thread Safety

- **RLock Usage**: Uses `threading.RLock()` instead of standard `Lock`
- **Re-entrant Locking**: Prevents deadlocks in complex query scenarios
- **Connection Pool Safety**: Implements exponential backoff retry mechanism

### Database Configuration

- **TCP Keepalives**: Configured to prevent firewall drops
  - `keepalives_idle: 30`
  - `keepalives_interval: 10`
  - `keepalives_count: 5`

### Performance Targets

The implementation maintains the established performance SLOs:
- Ancestor resolution: <1.25ms (P95: 1.87ms)
- Throughput: >42,726 RPS
- Cache hit rate: >99.2%

## Compliance and Monitoring

- **Audit Trail**: All refresh operations logged for compliance
- **Performance Monitoring**: Continuous monitoring of cache performance metrics
- **Health Checks**: Regular health validation with 80% utilization warnings
- **Error Recovery**: Automatic retry mechanisms with exponential backoff

## Future Enhancements

1. **Scheduled Refresh**: Background job for periodic refresh
2. **Selective Refresh**: Refresh specific materialized views only
3. **Real-time Notifications**: WebSocket updates on refresh completion
4. **Performance Optimization**: Advanced concurrent refresh strategies

## Dependencies

- FastAPI for REST API framework
- orjson for serialization
- psycopg2 for PostgreSQL connectivity
- redis for distributed caching
- Existing Forecastin service architecture

This implementation provides a robust, production-ready solution for managing LTREE materialized view refresh operations while maintaining the high-performance characteristics of the Forecastin platform.