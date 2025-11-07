# RSS Ingestion API Endpoints Documentation

**Version**: 1.0
**Last Updated**: 2025-11-07
**Base URL**: `http://localhost:9000/api/rss`

## Overview

The RSS Ingestion API provides endpoints for processing RSS feeds with comprehensive features including:

- **5-W Entity Extraction**: Automatically extract Who, What, Where, When, Why from articles
- **Content Deduplication**: 0.8 similarity threshold with audit trail
- **Real-time Notifications**: WebSocket updates during processing
- **Anti-crawler Strategies**: Exponential backoff and rate limiting
- **Batch Processing**: Process multiple feeds in parallel or sequentially
- **Job Tracking**: Monitor ingestion progress and results

## Authentication

Currently, the API does not require authentication. This may change in future versions for production deployments.

## Endpoints

### 1. Ingest Single RSS Feed

Process a single RSS feed through the complete ingestion pipeline.

**Endpoint**: `POST /api/rss/ingest`

**Request Body**:
```json
{
  "feed_url": "https://example.com/rss",
  "route_config": {
    "name": "Example News Feed",
    "selectors": {
      "title": "h1.article-title",
      "content": "div.article-body",
      "author": ".author-name",
      "published": "time.published",
      "geographic": ".location"
    },
    "confidence_factors": {
      "title": 1.0,
      "content": 0.9,
      "author": 0.8,
      "published": 1.0
    }
  },
  "job_id": "optional-custom-job-id"
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feed_url` | string | Yes | URL of the RSS feed to ingest |
| `route_config` | object | Yes | Configuration for content extraction |
| `route_config.name` | string | Yes | Human-readable name for the feed |
| `route_config.selectors` | object | Yes | CSS selectors for content extraction |
| `route_config.confidence_factors` | object | No | Confidence score multipliers (0.0-1.0) |
| `job_id` | string | No | Custom job ID for tracking (auto-generated if not provided) |

**CSS Selectors**:

| Field | Description | Example |
|-------|-------------|---------|
| `title` | Article title selector | `"h1.article-title"` |
| `content` | Main article content | `"div.article-body"` |
| `author` | Author name | `".author-name"` |
| `published` | Publication date/time | `"time.published"` |
| `geographic` | Geographic location | `".location"` |

**Response**: `200 OK`

```json
{
  "status": "success",
  "message": "RSS feed ingested successfully",
  "result": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "metrics": {
      "articles_processed": 25,
      "entities_extracted": 150,
      "duplicates_removed": 3,
      "cache_hit_rate": 0.992,
      "websocket_notifications_sent": 28
    },
    "articles_processed": 25,
    "entities_extracted": 150,
    "processing_time_seconds": 12.5
  },
  "duration_ms": 12543.2
}
```

**Error Responses**:

- `400 Bad Request`: Missing required fields or invalid parameters
- `500 Internal Server Error`: Processing failed
- `503 Service Unavailable`: RSS ingestion service not initialized

**Example cURL Request**:

```bash
curl -X POST http://localhost:9000/api/rss/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "feed_url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "route_config": {
      "name": "NY Times World News",
      "selectors": {
        "title": "h1",
        "content": "article",
        "author": ".byline",
        "published": "time"
      }
    }
  }'
```

---

### 2. Batch Ingestion

Process multiple RSS feeds in parallel or sequentially.

**Endpoint**: `POST /api/rss/ingest/batch`

**Request Body**:
```json
{
  "feeds": [
    {
      "url": "https://example.com/rss1",
      "route_config": {
        "name": "Feed 1",
        "selectors": { "title": "h1", "content": "article" }
      }
    },
    {
      "url": "https://example.com/rss2",
      "route_config": {
        "name": "Feed 2",
        "selectors": { "title": "h1", "content": ".body" }
      }
    }
  ],
  "parallel": true
}
```

**Request Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feeds` | array | Yes | Array of feed configurations |
| `feeds[].url` | string | Yes | RSS feed URL |
| `feeds[].route_config` | object | Yes | Route configuration for this feed |
| `parallel` | boolean | No | Process feeds in parallel (default: true) |

**Response**: `200 OK`

```json
{
  "status": "success",
  "message": "Batch RSS ingestion completed",
  "result": {
    "job_id": "batch-550e8400-e29b-41d4-a716-446655440000",
    "total_feeds_processed": 2,
    "total_articles_processed": 50,
    "total_entities_extracted": 300,
    "total_processing_time_seconds": 25.3,
    "feed_results": [
      {
        "job_id": "batch-550e8400_abc123",
        "status": "completed",
        "articles_processed": 25,
        "entities_extracted": 150
      },
      {
        "job_id": "batch-550e8400_def456",
        "status": "completed",
        "articles_processed": 25,
        "entities_extracted": 150
      }
    ]
  },
  "duration_ms": 25387.6
}
```

**Example cURL Request**:

```bash
curl -X POST http://localhost:9000/api/rss/ingest/batch \
  -H "Content-Type: application/json" \
  -d '{
    "feeds": [
      {
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "route_config": {
          "name": "NY Times World",
          "selectors": {"title": "h1", "content": "article"}
        }
      },
      {
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "route_config": {
          "name": "BBC World News",
          "selectors": {"title": "h1", "content": ".story-body"}
        }
      }
    ],
    "parallel": true
  }'
```

---

### 3. Get RSS Metrics

Retrieve RSS ingestion service performance metrics.

**Endpoint**: `GET /api/rss/metrics`

**Request**: No request body required

**Response**: `200 OK`

```json
{
  "metrics": {
    "ingestion_metrics": {
      "articles_processed": 1250,
      "entities_extracted": 7500,
      "duplicates_removed": 125,
      "total_processing_time": 3600.5,
      "avg_processing_time": 2.88,
      "cache_hit_rate": 0.992,
      "websocket_notifications_sent": 1375
    },
    "active_jobs": 2,
    "component_status": {
      "route_processor": "active",
      "anti_crawler": "active",
      "entity_extractor": "active",
      "deduplicator": "active",
      "websocket_notifier": "active"
    }
  }
}
```

**Metrics Explained**:

| Metric | Description |
|--------|-------------|
| `articles_processed` | Total number of articles processed since service start |
| `entities_extracted` | Total entities extracted (Who, What, Where, When, Why) |
| `duplicates_removed` | Articles removed due to 0.8 similarity threshold |
| `avg_processing_time` | Average processing time per article (seconds) |
| `cache_hit_rate` | Cache hit rate (0.0-1.0), target: 0.992 |
| `websocket_notifications_sent` | Total WebSocket notifications sent |

**Example cURL Request**:

```bash
curl http://localhost:9000/api/rss/metrics
```

---

### 4. Health Check

Perform comprehensive health check of RSS ingestion service.

**Endpoint**: `GET /api/rss/health`

**Request**: No request body required

**Response**: `200 OK`

```json
{
  "status": "healthy",
  "components": {
    "cache_service": {
      "healthy": true,
      "cache_hit_rate": 0.992
    },
    "realtime_service": {
      "healthy": true
    }
  },
  "metrics": {
    "ingestion_metrics": {
      "articles_processed": 1250,
      "entities_extracted": 7500
    },
    "active_jobs": 2,
    "component_status": {
      "route_processor": "active",
      "anti_crawler": "active",
      "entity_extractor": "active",
      "deduplicator": "active",
      "websocket_notifier": "active"
    }
  }
}
```

**Response**: `503 Service Unavailable` (if service not initialized)

```json
{
  "status": "unavailable",
  "message": "RSS ingestion service not initialized"
}
```

**Health Status Values**:

| Status | Description |
|--------|-------------|
| `healthy` | All components operational |
| `degraded` | Some components have issues but service is functional |
| `unavailable` | Service not initialized or critical failure |

**Example cURL Request**:

```bash
curl http://localhost:9000/api/rss/health
```

---

### 5. Get Job Status

Get the status of a specific RSS ingestion job.

**Endpoint**: `GET /api/rss/jobs/{job_id}`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | Job ID to query |

**Response**: `200 OK`

```json
{
  "job": {
    "status": "processing",
    "started_at": "2025-11-07T12:00:00.000Z",
    "feed_url": "https://example.com/rss",
    "current_stage": "entity_extraction",
    "progress": 65.5,
    "last_updated": "2025-11-07T12:01:30.000Z"
  }
}
```

**Job Status Values**:

| Status | Description |
|--------|-------------|
| `processing` | Job is currently running |
| `completed` | Job finished successfully |
| `failed` | Job encountered an error |

**Processing Stages**:

| Stage | Description |
|-------|-------------|
| `fetching` | Fetching RSS feed content |
| `processing` | Processing articles |
| `entity_extraction` | Extracting 5-W entities |
| `deduplication` | Removing duplicates |
| `caching` | Caching results |

**Response**: `404 Not Found` (if job not found)

```json
{
  "detail": "Job abc123 not found"
}
```

**Example cURL Request**:

```bash
curl http://localhost:9000/api/rss/jobs/550e8400-e29b-41d4-a716-446655440000
```

---

## WebSocket Notifications

The RSS ingestion service sends real-time WebSocket notifications during processing. Subscribe to `/ws` to receive updates.

### Message Types

#### 1. `rss_ingestion_start`

Sent when ingestion begins.

```json
{
  "type": "rss_ingestion_start",
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "feed_url": "https://example.com/rss",
    "started_at": "2025-11-07T12:00:00.000Z"
  },
  "timestamp": 1699363200.0
}
```

#### 2. `rss_ingestion_progress`

Sent periodically during processing.

```json
{
  "type": "rss_ingestion_progress",
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "progress": 65.5,
    "stage": "entity_extraction",
    "updated_at": "2025-11-07T12:01:30.000Z"
  },
  "timestamp": 1699363290.0
}
```

#### 3. `rss_ingestion_complete`

Sent when ingestion completes.

```json
{
  "type": "rss_ingestion_complete",
  "data": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "articles_processed": 25,
    "entities_extracted": 150,
    "processing_time": 12.5,
    "completed_at": "2025-11-07T12:01:45.000Z"
  },
  "timestamp": 1699363305.0
}
```

#### 4. `rss_feed_update`

Sent when a feed is updated.

```json
{
  "type": "rss_feed_update",
  "data": {
    "feed_id": "example-feed",
    "articles_count": 25,
    "new_articles": 3,
    "updated_at": "2025-11-07T12:00:00.000Z"
  },
  "timestamp": 1699363200.0
}
```

#### 5. `rss_entity_extracted`

Sent when entities are extracted from an article.

```json
{
  "type": "rss_entity_extracted",
  "data": {
    "article_id": "article-123",
    "entities_count": 6,
    "entity_summary": {
      "who": 2,
      "what": 1,
      "where": 2,
      "when": 1,
      "why": 0
    },
    "extracted_at": "2025-11-07T12:01:30.000Z"
  },
  "timestamp": 1699363290.0
}
```

#### 6. `rss_deduplication_result`

Sent after deduplication completes.

```json
{
  "type": "rss_deduplication_result",
  "data": {
    "feed_id": "example-feed",
    "original_count": 28,
    "deduplicated_count": 25,
    "duplicates_removed": 3,
    "processed_at": "2025-11-07T12:01:40.000Z"
  },
  "timestamp": 1699363300.0
}
```

---

## Rate Limiting

Currently, there are no hard rate limits. However, the anti-crawler manager implements exponential backoff to prevent overwhelming target sites:

- **Minimum delay**: 2 seconds between requests
- **Maximum delay**: 60 seconds (after multiple failures)
- **Backoff factor**: 2.0 (doubles delay on each failure)
- **Max consecutive failures**: 5 (then temporary blacklist)

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "detail": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes**:

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad Request - Invalid parameters |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error - Processing failed |
| `503` | Service Unavailable - Service not initialized |

---

## Configuration

The RSS ingestion service can be configured via environment variables or service initialization:

**Service Configuration** (in `main.py`):

```python
rss_config = RSSIngestionConfig(
    batch_size=50,                          # Articles per batch
    parallel_workers=4,                     # Concurrent workers
    max_retries=3,                          # Retry attempts
    default_ttl=86400,                      # Cache TTL (24 hours)
    min_delay=2.0,                          # Min delay between requests (seconds)
    max_delay=10.0,                         # Max delay (seconds)
    user_agent_rotation=True,               # Rotate user agents
    enable_entity_extraction=True,          # Enable 5-W extraction
    enable_deduplication=True,              # Enable deduplication
    enable_websocket_notifications=True     # Enable WebSocket updates
)
```

---

## Performance Considerations

### Optimization Tips

1. **Batch Processing**: Use `/api/rss/ingest/batch` with `parallel: true` for multiple feeds
2. **Caching**: The service maintains 99.2% cache hit rate - repeated requests are fast
3. **WebSocket**: Subscribe to WebSocket for real-time updates instead of polling job status
4. **Route Config**: Optimize CSS selectors for faster extraction
5. **Deduplication**: Enabled by default with 0.8 similarity threshold

### Performance Metrics

| Metric | Target | Typical |
|--------|--------|---------|
| Article processing | <5s | 2.88s |
| Entity extraction | <100 entities/s | ~150 entities/s |
| Cache hit rate | >99% | 99.2% |
| WebSocket latency | <200ms | <50ms |
| Deduplication check | <100ms | <50ms |

---

## Security Considerations

### Current Implementation

- No authentication required (development mode)
- CORS enabled for `http://localhost:3000`
- WebSocket origin validation
- Input validation on all endpoints

### Production Recommendations

1. **Authentication**: Implement API key or OAuth2
2. **Rate Limiting**: Add per-client rate limits
3. **HTTPS**: Use HTTPS for all API calls
4. **WSS**: Use secure WebSocket (wss://)
5. **Input Sanitization**: Additional validation for user-provided URLs
6. **CORS**: Restrict to production domains

---

## Examples

### Complete Workflow Example

```bash
# 1. Start ingestion
JOB_ID=$(curl -s -X POST http://localhost:9000/api/rss/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "feed_url": "https://example.com/rss",
    "route_config": {
      "name": "Example Feed",
      "selectors": {"title": "h1", "content": "article"}
    }
  }' | jq -r '.result.job_id')

echo "Job ID: $JOB_ID"

# 2. Check job status
curl http://localhost:9000/api/rss/jobs/$JOB_ID

# 3. Get metrics
curl http://localhost:9000/api/rss/metrics

# 4. Health check
curl http://localhost:9000/api/rss/health
```

### WebSocket Subscription Example

```javascript
const ws = new WebSocket('ws://localhost:9000/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'rss_ingestion_start':
      console.log('Ingestion started:', message.data.job_id);
      break;
    case 'rss_ingestion_progress':
      console.log('Progress:', message.data.progress + '%');
      break;
    case 'rss_ingestion_complete':
      console.log('Complete! Articles:', message.data.articles_processed);
      break;
  }
};
```

---

## Troubleshooting

### Common Issues

**Issue**: `503 Service Unavailable`
- **Cause**: RSS ingestion service not initialized
- **Solution**: Check that cache_service, realtime_service, and hierarchy_resolver are available

**Issue**: Slow processing
- **Cause**: Anti-crawler delays or network issues
- **Solution**: Check anti-crawler metrics, reduce `min_delay` in config

**Issue**: No WebSocket notifications
- **Cause**: WebSocket not connected or notifications disabled
- **Solution**: Verify WebSocket connection to `/ws`, check service config

**Issue**: High duplicate rate
- **Cause**: Similarity threshold too low
- **Solution**: Adjust deduplication threshold (default: 0.8)

---

## Support & Further Reading

- **Integration Summary**: [RSS_INTEGRATION_SUMMARY.md](../RSS_INTEGRATION_SUMMARY.md)
- **Architecture Guide**: [RSS_INGESTION_SERVICE_ARCHITECTURE.md](RSS_INGESTION_SERVICE_ARCHITECTURE.md)
- **Implementation Guide**: [RSS_SERVICE_IMPLEMENTATION_GUIDE.md](RSS_SERVICE_IMPLEMENTATION_GUIDE.md)
- **WebSocket Documentation**: [WEBSOCKET_LAYER_MESSAGES.md](WEBSOCKET_LAYER_MESSAGES.md)

---

**Last Updated**: 2025-11-07
**API Version**: 1.0
**Service Status**: Active
