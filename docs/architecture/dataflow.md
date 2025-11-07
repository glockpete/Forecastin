# Forecastin Data Flow Diagrams

## RSS Ingestion to UI Flow

This sequence diagram illustrates the complete data flow from RSS ingestion through to the user interface.

```mermaid
sequenceDiagram
    participant RSS as RSS Sources
    participant RSSS as RSS Ingestion Service
    participant RP as Route Processors
    participant AC as Anti-Crawler Manager
    participant EE as Entity Extractor
    participant D as Deduplicator
    participant API as API Service
    participant DB as Database
    participant WS as WebSocket Service
    participant UI as Frontend UI
    
    title RSS Ingestion to UI Data Flow
    
    RSS->>RSSS: New content available
    RSSS->>AC: Apply anti-crawler delays
    RSSS->>RP: Process with CSS selectors
    RP->>RSS: Fetch content
    RSS-->>RP: Return RSS content
    RP->>RP: Extract with selectors
    RP-->>RSSS: Parsed content
    
    RSSS->>EE: Extract entities (5-W Framework)
    EE->>EE: Base model extraction
    EE->>EE: Rule-based confidence calibration
    EE-->>RSSS: Extracted entities
    
    RSSS->>D: Deduplicate entities
    D->>D: Calculate similarity (0.8 threshold)
    D->>D: Assign canonical keys
    D-->>RSSS: Unique entities
    
    RSSS->>API: Store processed data
    API->>DB: Update database
    DB-->>API: Confirmation
    
    API->>WS: Notify real-time service
    WS->>WS: Prepare WebSocket messages
    WS->>UI: Broadcast updates
    
    UI->>UI: Update state (React Query + Zustand)
    UI-->>User: Display new content
```

## LTREE Materialized View Refresh Flow

This sequence diagram shows the process of refreshing LTREE materialized views to maintain hierarchical data performance.

```mermaid
sequenceDiagram
    participant User as User/Operator
    participant API as API Service
    participant OHR as OptimizedHierarchyResolver
    participant DB as Database
    participant MV1 as MV Entity Ancestors
    participant MV2 as MV Descendant Counts
    participant MV3 as MV Hierarchy Stats
    participant Cache as Cache Layers
    
    title LTREE Materialized View Refresh Flow
    
    User->>API: POST /api/entities/refresh
    API->>OHR: refresh_all_materialized_views()
    
    OHR->>OHR: Attempt concurrent refresh first
    OHR->>DB: REFRESH MATERIALIZED VIEW CONCURRENTLY
    DB->>MV1: Refresh view
    MV1-->>DB: Success
    DB->>MV2: Refresh view
    MV2-->>DB: Success
    DB->>MV3: Refresh view
    MV3-->>DB: Success
    
    OHR-->>API: Refresh results
    
    API->>Cache: Invalidate cache layers
    Cache->>Cache: Clear L1-L4 caches
    Cache-->>API: Cache cleared
    
    API-->>User: {"status": "success", "duration_ms": 850}
    
    Note over DB,MV3: Concurrent refresh allows reads during update
    Note over Cache: Four-tier cache invalidation (L1-L4)
```

## WebSocket Real-time Updates Flow

This sequence diagram details how real-time updates are propagated from the backend to the frontend through WebSocket connections.

```mermaid
sequenceDiagram
    participant BE as Backend Services
    participant WS as WebSocket Service
    participant OR as OptimizedHierarchyResolver
    participant Cache as Cache Service
    participant Client as WebSocket Client
    participant UI as Frontend UI
    
    title WebSocket Real-time Updates Flow
    
    BE->>WS: broadcast_message()
    WS->>WS: safe_serialize_message() with orjson
    WS->>Client: Send serialized message
    
    Client->>Client: Receive WebSocket message
    Client->>UI: Dispatch to real-time handlers
    UI->>UI: Update React Query cache
    UI->>UI: Update Zustand store
    UI->>UI: Trigger re-render
    
    Note over WS: Uses orjson serialization to prevent crashes
    Note over UI: Hybrid state management (React Query + Zustand)
```

## Geospatial Layer Update Flow

This sequence diagram shows how geospatial data updates are processed and displayed in the UI.

```mermaid
sequenceDiagram
    participant Data as Data Sources
    participant BE as Backend Services
    participant WS as WebSocket Service
    participant LWI as LayerWebSocketIntegration
    participant BL as BaseLayer
    participant LR as LayerRegistry
    participant UI as Frontend UI
    
    title Geospatial Layer Update Flow
    
    Data->>BE: New geospatial data
    BE->>WS: Send layer_data message
    WS->>LWI: Handle WebSocket message
    LWI->>LWI: Validate message type
    LWI->>BL: Update layer data
    BL->>LR: Register performance metrics
    LR->>LR: Monitor 30-second intervals
    
    LWI->>UI: Trigger UI update
    UI->>UI: GPU-accelerated rendering
    UI-->>User: Updated map visualization
    
    Note over BL: GPU filtering optimization
    Note over LR: Performance monitoring every 30 seconds
```

## Feature Flag Evaluation Flow

This sequence diagram illustrates how feature flags are evaluated and applied in the system.

```mermaid
sequenceDiagram
    participant Request as API Request
    participant FFS as FeatureFlagService
    participant Cache as Cache Service
    participant DB as Database
    participant BE as Backend Services
    
    title Feature Flag Evaluation Flow
    
    Request->>FFS: is_flag_enabled("ff.ws_v1")
    FFS->>Cache: Check L2 cache
    Cache-->>FFS: Cache hit/miss
    alt Cache Miss
        FFS->>DB: Query feature_flags table
        DB-->>FFS: Return flag data
        FFS->>Cache: Store in L2 cache
    end
    
    FFS->>FFS: Evaluate flag conditions
    FFS-->>BE: Return boolean result
    BE->>BE: Conditional execution based on flag
    BE-->>Request: Feature-specific response
    
    Note over FFS: Four-tier caching strategy (L1-L4)
    Note over BE: Gradual rollout (10% → 25% → 50% → 100%)
```

## Key Data Flow Patterns

### 1. Four-Tier Caching Strategy
All data access follows a four-tier caching approach:
1. **L1 (Memory)**: Thread-safe LRU with RLock synchronization
2. **L2 (Redis)**: Distributed cache with connection pooling
3. **L3 (Database)**: PostgreSQL buffer cache
4. **L4 (Materialized Views)**: Pre-computed data for O(1) lookups

### 2. WebSocket Serialization Safety
All WebSocket messages use `orjson` serialization with try/except wrapping to prevent connection crashes when handling datetime/dataclass objects.

### 3. Real-time State Coordination
The frontend coordinates three distinct state management systems:
- **React Query**: Server state with stale-while-revalidate
- **Zustand**: Global UI state
- **WebSocket**: Real-time state integration

### 4. RSS Processing Pipeline
The RSS ingestion follows a specific pipeline:
1. Route processing with CSS selectors
2. Anti-crawler strategies with exponential backoff
3. 5-W entity extraction with rule-based confidence scoring
4. Deduplication with 0.8 similarity threshold
5. WebSocket notification with feed-specific subscriptions

### 5. LTREE Performance Optimization
Hierarchical data queries are optimized through:
1. LTREE extension for PostgreSQL
2. Materialized views for pre-computed paths
3. Manual refresh mechanism for data consistency
4. Four-tier caching for performance