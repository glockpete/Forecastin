/**
 * GeospatialView Component - React wrapper for Deck.gl geospatial layers
 * 
 * Integrates with forecastin's hybrid state management system:
 * - React Query for server data
 * - Zustand for UI state  
 * - WebSocket for real-time updates
 * 
 * Follows non-obvious patterns from AGENTS.md:
 * - Multi-tier caching coordination (L1-L4)
 * - WebSocket resilience with safe serialization
 * - Performance monitoring with SLO compliance
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle, MapPin, Layers } from 'lucide-react';

import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useHybridState } from '../../hooks/useHybridState';
import { useUIStore } from '../../store/uiStore';
import { LayerRegistry } from '../../layers/registry/LayerRegistry';
import { BaseLayer } from '../../layers/base/BaseLayer';
import { LayerWebSocketIntegration } from '../../integrations/LayerWebSocketIntegration';
import { cn } from '../../utils/cn';
import { ErrorBoundary } from '../UI/ErrorBoundary';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import type { LayerConfig, EntityDataPoint, LayerWebSocketMessage } from '../../layers/types/layer-types';

export interface GeospatialViewProps {
  className?: string;
  onLayerClick?: (layerId: string, feature: any) => void;
  onViewStateChange?: (viewState: any) => void;
}

/**
 * GeospatialView - Main component for rendering geospatial layers
 * 
 * Lifecycle management:
 * 1. Initialize LayerRegistry on mount
 * 2. Subscribe to WebSocket layer updates
 * 3. Manage layer instances via registry
 * 4. Cleanup on unmount to prevent memory leaks
 * 
 * Performance: Wrapped with React.memo to prevent unnecessary re-renders
 * when parent components update but props remain the same.
 */
export const GeospatialView: React.FC<GeospatialViewProps> = React.memo(({
  className,
  onLayerClick,
  onViewStateChange
}) => {
  const queryClient = useQueryClient();
  
  // Feature flag integration
  const { isEnabled: mapV1Enabled, isLoading: flagLoading } = useFeatureFlag('ff.map_v1', {
    checkRollout: true,
    fallbackEnabled: false
  });

  // Hybrid state coordination
  const hybridState = useHybridState({
    enabled: mapV1Enabled,
    channels: ['layer_updates', 'geospatial_data'],
    autoInvalidate: true,
    optimisticUpdates: true,
    retryFailedSync: true,
    batchUpdates: true,
    debounceMs: 50
  });

  /**
   * Handle WebSocket layer messages
   * Uses safe serialization patterns from AGENTS.md
   * Wrapped in useCallback to prevent infinite reconnection loop
   * Defined before useWebSocket to avoid forward reference
   */
  const handleWebSocketMessage = useCallback((message: any) => {
    try {
      // Validate message structure
      if (!message || typeof message !== 'object') {
        console.warn('[GeospatialView] Invalid WebSocket message:', message);
        return;
      }

      // Note: useHybridState hook automatically handles WebSocket messages internally
      // through its subscription to the channels specified in config
      console.log('[GeospatialView] WebSocket message received:', message.type);
    } catch (error) {
      console.error('[GeospatialView] Error handling WebSocket message:', error);
    }
  }, []);

  // WebSocket for real-time layer updates
  const { isConnected, sendMessage, subscribe } = useWebSocket({
    channels: ['layer_updates', 'geospatial_data'],
    onMessage: handleWebSocketMessage
  });

  // Component state
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeLayers, setActiveLayers] = useState<Map<string, BaseLayer>>(new Map());
  const [performanceMetrics, setPerformanceMetrics] = useState({
    renderTime: 0,
    layerCount: 0,
    cacheHitRate: 0
  });

  // Refs for lifecycle management
  const layerRegistryRef = useRef<LayerRegistry | null>(null);
  const wsIntegrationRef = useRef<LayerWebSocketIntegration | null>(null);
  const deckGLContainerRef = useRef<HTMLDivElement>(null);
  const performanceMonitorRef = useRef<NodeJS.Timeout | null>(null);
  const activeLayersRef = useRef<Map<string, BaseLayer>>(new Map());

  /**
   * Initialize LayerRegistry with WebSocket integration
   * Following multi-tier caching patterns from AGENTS.md
   */
  const initializeRegistry = useCallback(async () => {
    try {
      const startTime = performance.now();

      // Create LayerRegistry with WebSocket enabled
      const registry = new LayerRegistry({
        enableWebSocket: true,
        cacheSize: 10000, // L1 cache limit from AGENTS.md
        cacheTTL: 5 * 60 * 1000 // 5 minutes
      });

      layerRegistryRef.current = registry;

      // Initialize WebSocket integration
      wsIntegrationRef.current = new LayerWebSocketIntegration({
        url: process.env.REACT_APP_WS_URL || 'ws://localhost:9000/ws',
        onLayerMessage: handleLayerMessage,
        onEntityUpdate: handleEntityUpdate,
        onBatchUpdate: handleBatchUpdate,
        onPerformanceMetrics: handlePerformanceMetrics,
        onError: handleWebSocketError,
        onConnectionError: handleConnectionError,
        featureFlagCheck: () => mapV1Enabled
      });

      // Connect to WebSocket
      await wsIntegrationRef.current.connect();

      const initTime = performance.now() - startTime;
      console.log(`[GeospatialView] Registry initialized in ${initTime.toFixed(2)}ms`);

      setIsInitialized(true);
      setError(null);

    } catch (err) {
      console.error('[GeospatialView] Failed to initialize registry:', err);
      setError(err as Error);
      setIsInitialized(false);
    }
  }, [mapV1Enabled]);

  /**
   * Create layer from configuration
   */
  const createLayerFromConfig = useCallback(async (config: LayerConfig) => {
    if (!layerRegistryRef.current) return;

    try {
      const layer = await layerRegistryRef.current.createLayer(config);

      setActiveLayers(prev => {
        const updated = new Map(prev);
        updated.set(config.id, layer);
        activeLayersRef.current = updated;
        return updated;
      });

      console.log(`[GeospatialView] Layer created: ${config.id}`);
    } catch (error) {
      console.error('[GeospatialView] Failed to create layer:', error);
      setError(error as Error);
    }
  }, []);

  /**
   * Remove layer and cleanup
   */
  const removeLayer = useCallback((layerId: string) => {
    if (!layerRegistryRef.current) return;

    try {
      layerRegistryRef.current.removeLayer(layerId);

      setActiveLayers(prev => {
        const updated = new Map(prev);
        updated.delete(layerId);
        activeLayersRef.current = updated;
        return updated;
      });

      console.log(`[GeospatialView] Layer removed: ${layerId}`);
    } catch (error) {
      console.error('[GeospatialView] Failed to remove layer:', error);
    }
  }, []);

  /**
   * Handle layer-specific WebSocket messages
   */
  const handleLayerMessage = useCallback(async (message: LayerWebSocketMessage) => {
    if (!layerRegistryRef.current) return;

    try {
      const { type, payload } = message;

      // Check if payload exists before accessing properties
      if (!payload) {
        console.warn('[GeospatialView] Message received without payload:', type);
        return;
      }

      switch (type) {
        case 'data_update':
          // Update layer data via registry
          if (payload.layerId && payload.data) {
            const layer = layerRegistryRef.current.getLayer(payload.layerId);
            if (layer) {
              // Use setData instead of updateData (inherited from BaseLayer)
              await layer.setData(payload.data);

              // Trigger React Query invalidation
              queryClient.invalidateQueries({ queryKey: ['layers', payload.layerId] });
            }
          }
          break;

        case 'layer_creation':
          // Create new layer instance
          if (payload.config && payload.config.id) {
            createLayerFromConfig(payload.config as LayerConfig);
          }
          break;

        case 'layer_deletion':
          // Remove layer instance
          if (payload.layerId) {
            removeLayer(payload.layerId);
          }
          break;

        default:
          console.log('[GeospatialView] Unhandled layer message type:', type);
      }
    } catch (error) {
      console.error('[GeospatialView] Error handling layer message:', error);
    }
  }, [queryClient, createLayerFromConfig, removeLayer]);

  /**
   * Handle entity update messages
   */
  const handleEntityUpdate = useCallback(async (entity: EntityDataPoint) => {
    console.log('[GeospatialView] Entity update received:', entity.id);
    
    // Update active layers that reference this entity
    for (const layer of Array.from(activeLayers.values())) {
      const config = layer.getConfig();
      if (config.data?.some((d: any) => d.id === entity.id)) {
        // Update layer with new entity data
        const updatedData = config.data.map((d: any) =>
          d.id === entity.id ? { ...d, ...entity } : d
        );
        await layer.setData(updatedData);
      }
    }
  }, [activeLayers]);

  /**
   * Handle batch entity updates
   * Implements batching strategy from AGENTS.md
   */
  const handleBatchUpdate = useCallback(async (entities: EntityDataPoint[]) => {
    console.log('[GeospatialView] Batch update received:', entities.length, 'entities');

    // Batch update all affected layers
    const updatePromises: Promise<void>[] = [];

    activeLayers.forEach((layer) => {
      const config = layer.getConfig();
      const entityIds = new Set(entities.map(e => e.id));

      if (config.data?.some((d: any) => entityIds.has(d.id))) {
        const entityMap = new Map(entities.map(e => [e.id, e]));
        const updatedData = config.data.map((d: any) =>
          entityMap.has(d.id) ? { ...d, ...entityMap.get(d.id) } : d
        );
        updatePromises.push(layer.setData(updatedData));
      }
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);
  }, [activeLayers]);

  /**
   * Handle performance metrics updates
   * Monitors against SLO targets from AGENTS.md
   */
  const handlePerformanceMetrics = useCallback((metrics: any) => {
    setPerformanceMetrics({
      renderTime: metrics.renderTime || 0,
      layerCount: activeLayers.size,
      cacheHitRate: metrics.cacheHitRate || 0
    });

    // Check SLO compliance (1.25ms target from AGENTS.md)
    if (metrics.renderTime > 1.25) {
      console.warn(`[GeospatialView] Render time ${metrics.renderTime}ms exceeds 1.25ms target`);
    }

    // Check cache hit rate (99.2% target from AGENTS.md)
    if (metrics.cacheHitRate < 0.992) {
      console.warn(`[GeospatialView] Cache hit rate ${(metrics.cacheHitRate * 100).toFixed(1)}% below 99.2% target`);
    }
  }, [activeLayers.size]);

  /**
   * Handle WebSocket errors with resilience patterns
   */
  const handleWebSocketError = useCallback((error: any) => {
    console.error('[GeospatialView] WebSocket error:', error);
    setError(new Error('WebSocket connection error'));
  }, []);

  /**
   * Handle connection errors with automatic reconnection
   */
  const handleConnectionError = useCallback((error: any) => {
    console.error('[GeospatialView] Connection error:', error);
    // WebSocket integration handles automatic reconnection
  }, []);

  /**
   * Setup performance monitoring
   * Monitors every 30 seconds as per AGENTS.md patterns
   */
  useEffect(() => {
    performanceMonitorRef.current = setInterval(() => {
      if (layerRegistryRef.current) {
        const stats = layerRegistryRef.current.getStatistics();
        console.log('[GeospatialView] Performance stats:', stats);
        
        handlePerformanceMetrics({
          renderTime: stats.averageCreationTime,
          cacheHitRate: stats.cacheHitRate
        });
      }
    }, 30000);

    return () => {
      if (performanceMonitorRef.current) {
        clearInterval(performanceMonitorRef.current);
      }
    };
  }, [handlePerformanceMetrics]);

  /**
   * Initialize on mount when feature flag is enabled
   */
  useEffect(() => {
    if (mapV1Enabled && !isInitialized) {
      initializeRegistry();
    }
  }, [mapV1Enabled, isInitialized, initializeRegistry]);

  /**
   * Cleanup on unmount - critical for preventing memory leaks
   */
  useEffect(() => {
    return () => {
      console.log('[GeospatialView] Cleaning up resources...');

      // Disconnect WebSocket integration
      if (wsIntegrationRef.current) {
        wsIntegrationRef.current.disconnect();
        wsIntegrationRef.current = null;
      }

      // Destroy all active layers using ref to get latest state at unmount
      activeLayersRef.current.forEach((layer, layerId) => {
        try {
          layer.destroy();
          console.log(`[GeospatialView] Destroyed layer: ${layerId}`);
        } catch (error) {
          console.warn(`[GeospatialView] Error destroying layer ${layerId}:`, error);
        }
      });

      // Destroy registry
      if (layerRegistryRef.current) {
        layerRegistryRef.current.destroy();
        layerRegistryRef.current = null;
      }

      // Clear performance monitor
      if (performanceMonitorRef.current) {
        clearInterval(performanceMonitorRef.current);
        performanceMonitorRef.current = null;
      }

      console.log('[GeospatialView] Cleanup complete');
    };
  }, []); // Empty dependency array - only run on unmount

  /**
   * Monitor hybrid state sync status
   */
  useEffect(() => {
    const syncStatus = hybridState.getSyncStatus();
    
    if (!syncStatus.connected) {
      console.log('[GeospatialView] Hybrid state disconnected');
    } else if (syncStatus.pending > 0) {
      console.log(`[GeospatialView] ${syncStatus.pending} pending updates`);
    }
  }, [hybridState]);

  // Loading state
  if (flagLoading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
          Loading geospatial features...
        </span>
      </div>
    );
  }

  // Feature flag disabled
  if (!mapV1Enabled) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-8', className)}>
        <MapPin className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Geospatial Features Not Available
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
          The map visualization feature is currently disabled. Contact your administrator to enable this feature.
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full p-8', className)}>
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Failed to Initialize Map
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-4">
          {error.message}
        </p>
        <button
          onClick={() => {
            setError(null);
            initializeRegistry();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Initializing state
  if (!isInitialized) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
          Initializing map layers...
        </span>
      </div>
    );
  }

  // Main render
  return (
    <ErrorBoundary>
      <div className={cn('relative h-full w-full', className)}>
        {/* Deck.gl container */}
        <div 
          ref={deckGLContainerRef}
          className="absolute inset-0 bg-gray-100 dark:bg-gray-800"
        >
          {/* Placeholder for Deck.gl canvas */}
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Layers className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deck.gl integration pending
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {activeLayers.size} layer{activeLayers.size !== 1 ? 's' : ''} active
              </p>
            </div>
          </div>
        </div>

        {/* Performance overlay (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-xs">
            <div className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Performance</div>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div>Render: {performanceMetrics.renderTime.toFixed(2)}ms</div>
              <div>Layers: {performanceMetrics.layerCount}</div>
              <div>Cache: {(performanceMetrics.cacheHitRate * 100).toFixed(1)}%</div>
              <div className={cn(
                isConnected ? 'text-green-600' : 'text-red-600'
              )}>
                WS: {isConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
});

// Add displayName for better debugging with React DevTools
GeospatialView.displayName = 'GeospatialView';

export default GeospatialView;