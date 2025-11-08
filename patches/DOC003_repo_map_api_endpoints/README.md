# DOC003: REPO_MAP API Endpoints Update

## Summary
Add missing RSS ingestion API endpoints to REPO_MAP.md to reflect complete backend API surface.

## Evidence
- **REPO_MAP.md**: Lists 28 routes
- **api/main.py:1832-2003**: Implements 5 RSS endpoints
- **Actual count**: 33 routes (29 HTTP + 4 WebSocket)
- **Impact**: Developers may miss newer RSS endpoints

## Changes

### File: docs/architecture/REPO_MAP.md

**After line 29 (add new section):**
```diff
 | GET | `/api/evidence` | Get evidence data for frontend testing | N/A |
+| POST | `/api/rss/ingest` | Ingest single RSS feed with complete processing pipeline | `rss_ingestion_enabled` |
+| POST | `/api/rss/ingest/batch` | Batch RSS feed ingestion with parallelism | `rss_ingestion_enabled` |
+| GET | `/api/rss/metrics` | Get RSS ingestion service performance metrics | N/A |
+| GET | `/api/rss/health` | RSS ingestion service health check | N/A |
+| GET | `/api/rss/jobs/{job_id}` | Get RSS ingestion job status | N/A |
 | GET | `/api/v3/scenarios/{path:path}/forecasts` | Django-inspired hierarchical forecast endpoint with cursor-based pagination | `ff.prophet_forecasting` |
```

**Update summary statistics:**
```diff
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
-│       └── rss/                       # RSS ingestion service
+│       └── rss/                       # RSS ingestion service (RSSHub-inspired)
+│           ├── rss_ingestion_service.py    # Main RSS service with route processors
+│           ├── anti_crawler/               # Anti-crawler strategies
+│           ├── deduplication/              # Content deduplication (0.8 threshold)
+│           ├── entity_extraction/          # 5-W entity extraction
+│           ├── route_processors/           # CSS selector-based extraction
+│           └── websocket/                  # Real-time RSS notifications
```

## Risk Analysis
- **Risk Level**: Low
- **Breaking Changes**: None
- **Backward Compatibility**: ✅ Yes (documentation only)
- **Testing Required**: None (code-only fix)

## Acceptance Criteria
- [x] All 5 RSS endpoints documented in REPO_MAP.md
- [x] Feature flag dependencies correctly noted
- [x] Folder structure includes RSS service subdirectories
- [x] Route count updated to 33 total

## Related Issues
- Gap Map Item 5.2
- CHANGELOG.md Unreleased: RSS Service Integration

## Review Notes
- Verify endpoint paths match api/main.py:1832-2003 exactly
- Confirm feature flag names match backend implementation
- Check that all endpoints have descriptions
