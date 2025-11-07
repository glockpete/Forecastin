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
  "message": "LTREE materialized view refresh service is operational"
}
```

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