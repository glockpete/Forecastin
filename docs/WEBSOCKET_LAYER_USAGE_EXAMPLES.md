# WebSocket Layer & GPU Filter Usage Examples

## Overview

This document provides comprehensive usage examples for the WebSocket layer data updates and GPU filter synchronization in the Forecastin platform.

## Backend Usage Examples

### Example 1: Broadcasting Layer Data Update

```python
from api.services.realtime_service import RealtimeService

# Initialize service
realtime_service = RealtimeService()

# Example: Update a geospatial infrastructure layer
await realtime_service.broadcast_layer_data_update(
    layer_id="tokyo-infrastructure-2024",
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
                "properties": {
                    "name": "Tokyo Metropolitan Area",
                    "type": "infrastructure",
                    "population": 13960000,
                    "confidence": 0.95
                }
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
```

### Example 2: Broadcasting Point Layer Features

```python
# Convenience method for point layers with GeoJSON features
await realtime_service.broadcast_layer_features(
    layer_id="military-bases-asia",
    layer_type="point",
    features=[
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [139.6917, 35.6895]},
            "properties": {
                "name": "Tokyo Military Base",
                "status": "active",
                "classification": "restricted"
            }
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [126.9780, 37.5665]},
            "properties": {
                "name": "Seoul Command Center",
                "status": "active",
                "classification": "top-secret"
            }
        }
    ],
    bbox={"minLat": 35.0, "maxLat": 38.0, "minLng": 126.0, "maxLng": 140.0}
)
```

### Example 3: Broadcasting GPU Filter Application

```python
# Apply spatial filter to multiple layers
await realtime_service.broadcast_gpu_filter_sync(
    filter_id="asia-pacific-region-filter",
    filter_type="spatial",
    filter_params={
        "bounds": {
            "minLat": 20.0,
            "maxLat": 50.0,
            "minLng": 100.0,
            "maxLng": 150.0
        },
        "filterMode": "inclusive"
    },
    affected_layers=[
        "military-bases-asia",
        "infrastructure-critical",
        "political-boundaries"
    ],
    status="applied"
)
```

### Example 4: Broadcasting Spatial Filter (Convenience Method)

```python
# Simplified spatial filter broadcast
await realtime_service.broadcast_spatial_filter(
    filter_id="tokyo-region-focus",
    bounds={
        "minLat": 35.5,
        "maxLat": 36.0,
        "minLng": 139.5,
        "maxLng": 140.0
    },
    affected_layers=["all-tokyo-layers"]
)
```

### Example 5: Clearing GPU Filter

```python
# Clear an existing filter
await realtime_service.broadcast_gpu_filter_sync(
    filter_id="asia-pacific-region-filter",
    filter_type="spatial",
    filter_params={},
    affected_layers=["military-bases-asia", "infrastructure-critical"],
    status="cleared"
)
```

## Frontend Usage Examples

### Example 1: Listening for Layer Updates via useWebSocket

```typescript
import { useWebSocket } from '../hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { LayerWebSocketMessage } from '../layers/types/layer-types';

function LayerComponent() {
  const queryClient = useQueryClient();
  
  const { isConnected, lastMessage } = useWebSocket({
    channels: ['layer_updates'],
    onMessage: (message: LayerWebSocketMessage) => {
      if (message.type === 'layer_data_update') {
        const { layer_id, layer_data } = message.data;
        console.log(`Layer ${layer_id} updated:`, layer_data);
        
        // React Query will automatically update via realtimeHandlers
      }
    }
  });
  
  return (
    <div>
      <p>WebSocket Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
    </div>
  );
}
```

### Example 2: Custom Event Listener for Layer Updates

```typescript
import { useEffect } from 'react';

function MapLayer({ layerId }: { layerId: string }) {
  useEffect(() => {
    const handleLayerUpdate = (event: Event) => {
      const { layerId: updatedLayerId, data, bbox } = (event as CustomEvent).detail;
      
      if (updatedLayerId === layerId) {
        console.log('Layer data updated:', data);
        console.log('Bounding box:', bbox);
        
        // Update map visualization
        updateMapLayer(updatedLayerId, data, bbox);
      }
    };
    
    window.addEventListener('layer-data-update', handleLayerUpdate);
    
    return () => {
      window.removeEventListener('layer-data-update', handleLayerUpdate);
    };
  }, [layerId]);
  
  return <div id={`layer-${layerId}`} />;
}
```

### Example 3: GPU Filter Synchronization Handler

```typescript
import { useEffect } from 'react';

function FilteredMapView() {
  useEffect(() => {
    const handleFilterSync = (event: Event) => {
      const { filterId, filterType, filterParams, affectedLayers, status } = 
        (event as CustomEvent).detail;
      
      console.log(`Filter ${filterId} ${status}:`, filterParams);
      
      if (status === 'applied') {
        // Apply filter to GPU-accelerated map layers
        affectedLayers.forEach((layerId: string) => {
          applyGPUFilter(layerId, filterParams);
        });
      } else if (status === 'cleared') {
        // Remove filter from layers
        affectedLayers.forEach((layerId: string) => {
          clearGPUFilter(layerId, filterId);
        });
      }
    };
    
    window.addEventListener('gpu-filter-sync', handleFilterSync);
    
    return () => {
      window.removeEventListener('gpu-filter-sync', handleFilterSync);
    };
  }, []);
  
  return <div className="map-container" />;
}
```

### Example 4: React Query Integration

```typescript
import { useQuery } from '@tanstack/react-query';

function LayerDataComponent({ layerId }: { layerId: string }) {
  // React Query automatically updates when WebSocket messages are processed
  const { data: layerData, isLoading } = useQuery(
    ['layer', layerId],
    () => fetchLayerData(layerId),
    {
      staleTime: 5000,
      // WebSocket updates will trigger automatic refetch
    }
  );
  
  if (isLoading) return <div>Loading layer...</div>;
  
  return (
    <div>
      <h3>Layer: {layerData?.name}</h3>
      <p>Features: {layerData?.features?.length || 0}</p>
      <p>Last Updated: {layerData?.lastUpdated}</p>
    </div>
  );
}
```

### Example 5: useRealtimeMessageProcessor Integration

```typescript
import { useRealtimeMessageProcessor, routeRealtimeMessage } from '../handlers/realtimeHandlers';
import { LayerWebSocketMessage } from '../layers/types/layer-types';

function RealtimeLayerManager() {
  const processor = useRealtimeMessageProcessor();
  
  const handleWebSocketMessage = async (message: LayerWebSocketMessage) => {
    try {
      await routeRealtimeMessage(processor, message);
      console.log('Message processed successfully');
    } catch (error) {
      console.error('Failed to process message:', error);
    }
  };
  
  return <div>Real-time Layer Manager</div>;
}
```

## Integration with Hybrid State Management

### Example: Coordinating React Query + Zustand + WebSocket

```typescript
import { useHybridState } from '../hooks/useHybridState';

function GeospatialDashboard() {
  const {
    isConnected,
    lastSync,
    invalidateEntity,
    getSyncStatus
  } = useHybridState({
    channels: ['layer_updates', 'gpu_filter_sync'],
    autoInvalidate: true,
    optimisticUpdates: true
  });
  
  const syncStatus = getSyncStatus();
  
  return (
    <div>
      <h2>Dashboard Status</h2>
      <p>Connection: {syncStatus.connected ? 'Active' : 'Inactive'}</p>
      <p>Health: {syncStatus.health}</p>
      <p>Pending Updates: {syncStatus.pending}</p>
      <p>Last Sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}</p>
    </div>
  );
}
```

## Performance Optimization

### Example: Batching Layer Updates

```python
# Backend: Use batch_messages context manager for multiple updates
from api.services.realtime_service import RealtimeService

async def update_multiple_layers(layer_updates: list):
    realtime_service = RealtimeService()
    
    async with realtime_service.batch_messages():
        for layer_update in layer_updates:
            await realtime_service.broadcast_layer_data_update(
                layer_id=layer_update['id'],
                layer_type=layer_update['type'],
                data=layer_update['data'],
                bbox=layer_update.get('bbox')
            )
```

## Error Handling

### Example: Robust Error Handling

```typescript
import { handleRealtimeError } from '../handlers/realtimeHandlers';
import { LayerWebSocketMessage } from '../layers/types/layer-types';

function LayerUpdateHandler() {
  const handleMessage = async (message: LayerWebSocketMessage) => {
    try {
      await processLayerUpdate(message);
    } catch (error) {
      // Structured error handling with automatic retry
      handleRealtimeError(
        error as Error,
        message,
        (retryMessage) => {
          console.log('Retrying message processing...');
          handleMessage(retryMessage);
        }
      );
    }
  };
  
  return <div>Layer Update Handler</div>;
}
```

## Testing Examples

### Backend Test Example

```python
import pytest
from api.services.realtime_service import RealtimeService

@pytest.mark.asyncio
async def test_layer_data_update_broadcast():
    service = RealtimeService()
    
    # Broadcast layer update
    await service.broadcast_layer_data_update(
        layer_id="test-layer",
        layer_type="point",
        data={"type": "FeatureCollection", "features": []},
        bbox={"minLat": 0, "maxLat": 1, "minLng": 0, "maxLng": 1}
    )
    
    # Verify metrics
    metrics = service.get_performance_metrics()
    assert metrics['layer_updates_sent'] > 0
```

### Frontend Test Example

```typescript
import { render, waitFor } from '@testing-library/react';
import { RealtimeMessageProcessor } from '../handlers/realtimeHandlers';
import { LayerWebSocketMessage } from '../layers/types/layer-types';

test('processes layer data update message', async () => {
  const processor = new RealtimeMessageProcessor(queryClient, uiStore, cacheCoordinator);
  
  const message: LayerWebSocketMessage = {
    type: 'layer_data_update',
    data: {
      layer_id: 'test-layer',
      layer_type: 'point',
      layer_data: { type: 'FeatureCollection', features: [] }
    },
    timestamp: Date.now()
  };
  
  await processor.processLayerDataUpdate(message);
  
  // Verify cache update
  const cachedData = queryClient.getQueryData(['layer', 'test-layer']);
  expect(cachedData).toBeDefined();
});
```

## Advanced Use Cases

### Example: Multi-Layer Coordination

```python
async def synchronize_related_layers(base_layer_id: str):
    """Update multiple related layers when one changes"""
    service = RealtimeService()
    
    # Get related layer IDs
    related_layers = get_related_layers(base_layer_id)
    
    # Update all related layers
    for layer_id in related_layers:
        layer_data = fetch_layer_data(layer_id)
        await service.broadcast_layer_data_update(
            layer_id=layer_id,
            layer_type=layer_data['type'],
            data=layer_data['features'],
            bbox=calculate_bbox(layer_data)
        )
```

### Example: Conditional Filter Application

```typescript
function ConditionalFilterManager() {
  useEffect(() => {
    const handleFilterSync = (event: Event) => {
      const { filterType, filterParams, status } = (event as CustomEvent).detail;
      
      // Only apply certain filter types in specific conditions
      if (filterType === 'spatial' && status === 'applied') {
        const { bounds } = filterParams;
        
        // Check if filter overlaps with current viewport
        if (isInViewport(bounds)) {
          applyFilterToVisibleLayers(filterParams);
        } else {
          console.log('Filter outside viewport, deferring application');
        }
      }
    };
    
    window.addEventListener('gpu-filter-sync', handleFilterSync);
    return () => window.removeEventListener('gpu-filter-sync', handleFilterSync);
  }, []);
  
  return null;
}
```

## Related Documentation

- [WebSocket Layer Messages Specification](./WEBSOCKET_LAYER_MESSAGES.md)
- [Realtime Service Implementation](../api/services/realtime_service.py)
- [Frontend Realtime Handlers](../frontend/src/handlers/realtimeHandlers.ts)
- [Hybrid State Management](../frontend/src/hooks/useHybridState.ts)
- [Layer Type Definitions](../frontend/src/layers/types/layer-types.ts)

## Performance Targets

- **Latency:** <50ms from backend broadcast to frontend processing
- **Throughput:** >1000 concurrent clients
- **Message Rate:** 100+ messages/second per client
- **Serialization:** <5ms for typical layer update (1000 features)