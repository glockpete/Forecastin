# WebSocket Layer Data & GPU Filter Messages

## Overview

This document describes the WebSocket message types for real-time geospatial layer data synchronization and GPU filter coordination in the Forecastin platform.

## Message Types

### LAYER_DATA_UPDATE

Broadcasts geospatial layer data updates to all connected clients.

**Backend Usage:**

```python
from api.services.realtime_service import RealtimeService

service = RealtimeService()

# Method 1: Direct layer data update
await service.broadcast_layer_data_update(
    layer_id="tokyo-infrastructure",
    layer_type="polygon",
    data={
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[139.0, 35.0], [140.0, 35.0], [140.0, 36.0], [139.0, 36.0], [139.0, 35.0]]]
                },
                "properties": {"name": "Tokyo Metro", "type": "infrastructure"}
            }
        ]
    },
    bbox={
        "minLat": 35.0,
        "maxLat": 36.0,
        "minLng": 139.0,
        "maxLng": 140.0
    }
)

# Method 2: Convenience method for GeoJSON features
await service.broadcast_layer_features(
    layer_id="cities",
    layer_type="point",
    features=[
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [139.6917, 35.6895]},
            "properties": {"name": "Tokyo", "population": 13960000}
        }
    ],
    bbox={"minLat": 35.0, "maxLat": 36.0, "minLng": 139.0, "maxLng": 140.0}
)
```

**Message Schema:**

```json
{
  "type": "layer_data_update",
  "data": {
    "layer_id": "string",
    "layer_type": "point|polygon|line|heatmap|cluster",
    "layer_data": {
      "type": "FeatureCollection",
      "features": []
    },
    "bbox": {
      "minLat": 35.0,
      "maxLat": 36.0,
      "minLng": 139.0,
      "maxLng": 140.0
    },
    "changed_at": 1234567890.123
  },
  "timestamp": 1234567890.123
}
```

**Frontend Handling:**

The message is automatically processed by [`realtimeHandlers.ts:240`](../frontend/src/handlers/realtimeHandlers.ts:240):

1. Updates React Query cache for `['layer', layer_id]`
2. Invalidates related queries to trigger re-render
3. Dispatches custom `layer-data-update` event for layer registry
4. Updates bounding box if provided

**TypeScript Interface:**

```typescript
interface LayerDataUpdateMessage extends LayerWebSocketMessage {
  type: 'layer_data_update';
  data: {
    layer_id: string;
    layer_type: 'point' | 'polygon' | 'line' | 'heatmap' | 'cluster';
    layer_data: {
      type: 'FeatureCollection';
      features: any[];
    };
    bbox: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };
    changed_at: number;
  };
  timestamp: number;
}
```

### GPU_FILTER_SYNC

Synchronizes GPU filter state across all connected clients.

**Backend Usage:**

```python
# Method 1: Direct GPU filter sync
await service.broadcast_gpu_filter_sync(
    filter_id="spatial-filter-1",
    filter_type="spatial",
    filter_params={
        "bounds": {
            "minLat": 35.0,
            "maxLat": 36.0,
            "minLng": 139.0,
            "maxLng": 140.0
        }
    },
    affected_layers=["cities-layer", "infrastructure-layer"],
    status="applied"
)

# Method 2: Convenience method for spatial filters
await service.broadcast_spatial_filter(
    filter_id="bbox-filter",
    bounds={"minLat": 35.0, "maxLat": 36.0, "minLng": 139.0, "maxLng": 140.0},
    affected_layers=["layer-1", "layer-2"]
)

# Clear a filter
await service.broadcast_gpu_filter_sync(
    filter_id="spatial-filter-1",
    filter_type="spatial",
    filter_params={},
    affected_layers=["cities-layer"],
    status="cleared"
)
```

**Message Schema:**

```json
{
  "type": "gpu_filter_sync",
  "data": {
    "filter_id": "string",
    "filter_type": "spatial|temporal|attribute|composite",
    "filter_params": {
      "bounds": {"minLat": 35.0, "maxLat": 36.0, "minLng": 139.0, "maxLng": 140.0},
      "temporal": {"start": "ISO8601", "end": "ISO8601"},
      "attributes": {}
    },
    "affected_layers": ["layer-id-1", "layer-id-2"],
    "status": "applied|pending|error|cleared",
    "changed_at": 1234567890.123
  },
  "timestamp": 1234567890.123
}
```

**Frontend Handling:**

The message is processed by [`realtimeHandlers.ts:298`](../frontend/src/handlers/realtimeHandlers.ts:298):

1. Updates React Query cache for `['gpu-filter', filter_id]`
2. Invalidates all affected layer queries
3. Dispatches custom `gpu-filter-sync` event
4. Applies/clears filter on affected layers via layer registry

**TypeScript Interface:**

```typescript
interface GPUFilterSyncMessage extends LayerWebSocketMessage {
  type: 'gpu_filter_sync';
  data: {
    filter_id: string;
    filter_type: 'spatial' | 'temporal' | 'attribute' | 'composite';
    filter_params: {
      bounds: {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
      };
      temporal?: {
        start: string; // ISO8601
        end: string;   // ISO8601
      };
      attributes?: Record<string, any>;
    };
    affected_layers: string[];
    status: 'applied' | 'pending' | 'error' | 'cleared';
    changed_at: number;
  };
  timestamp: number;
}
```

**Filter Status States:**

- `applied`: Filter is active and applied to layers
- `pending`: Filter is being processed (GPU computation in progress)
- `error`: Filter application failed
- `cleared`: Filter has been removed from layers

## Serialization Requirements

**Critical:** All WebSocket messages use the [`safe_serialize_message()`](../api/services/realtime_service.py:167) function from [`api/services/realtime_service.py`](../api/services/realtime_service.py:167) to ensure proper handling of datetime and other non-JSON-serializable objects using orjson.

## Integration with Hybrid State Management

The WebSocket layer messages integrate seamlessly with the hybrid state system:

1. **React Query:** Manages server state (layer data, filter states)
2. **Zustand:** Manages UI state (layer visibility, map zoom)
3. **WebSocket:** Real-time updates fed into React Query cache

```typescript
// React Query automatically re-renders components when WebSocket updates cache
const { data: layerData } = useQuery(['layer', layerId]);

// Zustand manages layer visibility (UI state)
const { visibleLayers } = useUIStore();
```

## Performance Considerations

### Message Batching

For high-frequency updates (>10 messages/second), the backend automatically uses the existing batch message infrastructure.

### Target Performance Metrics

- **Latency:** <50ms from backend broadcast to frontend processing
- **Throughput:** Support >1000 concurrent clients
- **Message rate:** Handle 100+ messages/second per client
- **Serialization:** <5ms for typical layer update (1000 features)

## Custom Event Integration

Both message types dispatch custom events that can be listened to directly:

```typescript
// Listen for layer data updates
window.addEventListener('layer-data-update', (event: Event) => {
  const { layerId, layerType, data, bbox } = (event as CustomEvent).detail;
  // Handle layer update
});

// Listen for GPU filter sync
window.addEventListener('gpu-filter-sync', (event: Event) => {
  const { filterId, filterType, filterParams, affectedLayers, status } = (event as CustomEvent).detail;
  // Handle filter sync
});
```

## Related Documentation

- [Realtime Service Implementation](../api/services/realtime_service.py)
- [Frontend Realtime Handlers](../frontend/src/handlers/realtimeHandlers.ts)
- [Layer WebSocket Integration](../frontend/src/integrations/LayerWebSocketIntegration.ts)
- [Layer Types](../frontend/src/layers/types/layer-types.ts)

## TypeScript Integration

The WebSocket layer messages are fully typed using the `LayerWebSocketMessage` interface:

```typescript
// Core message type used throughout the system
export interface LayerWebSocketMessage {
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

// Backward compatibility alias
export type WebSocketLayerMessage = LayerWebSocketMessage;
```

**Safe Serialization Pattern:**

All messages use the `safe_serialize_message()` function from the backend to handle complex types:

```typescript
// Frontend safe deserialization
function safeDeserializeMessage(message: string): LayerWebSocketMessage {
  try {
    const parsed = JSON.parse(message);
    // Handle orjson serialization patterns
    if (parsed.__type === 'datetime') {
      return new Date(parsed.iso);
    }
    return parsed;
  } catch (error) {
    console.error('Failed to deserialize WebSocket message:', error);
    throw error;
  }
}
```

## Examples

### Broadcasting Layer Update from Backend

```python
# In your layer update handler
async def on_layer_data_change(layer_id: str, new_data: dict):
    realtime_service = RealtimeService()
    await realtime_service.broadcast_layer_data_update(
        layer_id=layer_id,
        layer_type="point",
        data=new_data,
        bbox=calculate_bbox(new_data)
    )
```

### Processing Layer Update in Frontend

```typescript
// Automatically handled by RealtimeMessageProcessor
// Custom processing can be added via event listeners
window.addEventListener('layer-data-update', (event: Event) => {
  const detail = (event as CustomEvent).detail;
  console.log(`Layer ${detail.layerId} updated with ${detail.data.features.length} features`);
});
```

## Error Handling

Both message types include comprehensive error handling:

- Backend: Wrapped in try/except with structured error messages
- Frontend: Error recovery with automatic retry for transient failures
- Performance monitoring: Tracks processing time for each message type

## Testing

Backend tests validate:
- Message serialization with complex types
- Broadcast to multiple clients
- Performance under load

Frontend tests validate:
- Message parsing and processing
- React Query cache updates
- Custom event dispatching
- Integration with LayerWebSocketIntegration

See implementation tests in:
- Backend: Would be added to `api/tests/test_realtime_service.py`
- Frontend: Would be added to `frontend/src/tests/`