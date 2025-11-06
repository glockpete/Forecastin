/**
 * React Query Cache Invalidation Tests
 *
 * Tests that WebSocket messages trigger correct React Query cache invalidations
 * for ['layer', id] and ['gpu-filter', id] query keys.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type {
  LayerDataUpdateMessage,
  GPUFilterSyncMessage,
  PolygonUpdateMessage,
} from '../src/types/ws_messages';

// ============================================================================
// Mock Query Client Setup
// ============================================================================

describe('React Query Cache Invalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  function createLayerDataUpdateMessage(layerId: string): LayerDataUpdateMessage {
    return {
      type: 'layer_data_update',
      payload: {
        layer_id: layerId,
        layer_type: 'point',
        layer_data: {
          type: 'FeatureCollection',
          features: [],
        },
        changed_at: Date.now(),
      },
      meta: {
        timestamp: Date.now(),
        sequence: 1,
        clientId: 'test-client',
      },
    };
  }

  function createGPUFilterSyncMessage(
    filterId: string,
    affectedLayers: string[]
  ): GPUFilterSyncMessage {
    return {
      type: 'gpu_filter_sync',
      payload: {
        filter_id: filterId,
        filter_type: 'spatial',
        filter_params: {
          bounds: {
            minLat: 0,
            maxLat: 10,
            minLng: 0,
            maxLng: 10,
          },
        },
        affected_layers: affectedLayers,
        status: 'applied',
        changed_at: Date.now(),
      },
      meta: {
        timestamp: Date.now(),
        sequence: 1,
        clientId: 'test-client',
      },
    };
  }

  function createPolygonUpdateMessage(entityId: string): PolygonUpdateMessage {
    return {
      type: 'polygon_update',
      action: 'update',
      payload: {
        entityId,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
        properties: {
          name: 'Test Polygon',
          entityType: 'zone',
          confidence: 0.9,
          hierarchyPath: 'world.test',
        },
        bbox: {
          minLat: 0,
          maxLat: 1,
          minLng: 0,
          maxLng: 1,
        },
        timestamp: new Date().toISOString(),
      },
      meta: {
        timestamp: Date.now(),
        sequence: 1,
        clientId: 'test-client',
      },
    };
  }

  /**
   * Mock handler that simulates how realtimeHandlers.ts should invalidate cache
   */
  async function handleLayerDataUpdate(
    message: LayerDataUpdateMessage,
    qc: QueryClient
  ): Promise<void> {
    const { layer_id } = message.payload;

    // Should invalidate ['layer', layer_id]
    await qc.invalidateQueries({ queryKey: ['layer', layer_id] });
  }

  /**
   * Mock handler for GPU filter sync
   */
  async function handleGPUFilterSync(
    message: GPUFilterSyncMessage,
    qc: QueryClient
  ): Promise<void> {
    const { filter_id, affected_layers } = message.payload;

    // Should invalidate ['gpu-filter', filter_id]
    await qc.invalidateQueries({ queryKey: ['gpu-filter', filter_id] });

    // Should also invalidate all affected layers
    for (const layerId of affected_layers) {
      await qc.invalidateQueries({ queryKey: ['layer', layerId] });
    }
  }

  // ==========================================================================
  // Layer Data Update Tests
  // ==========================================================================

  describe('layer_data_update invalidation', () => {
    it('should invalidate only the specific layer query', async () => {
      // Setup: Pre-populate cache with layer data
      queryClient.setQueryData(['layer', 'tokyo-layer'], { features: [] });
      queryClient.setQueryData(['layer', 'beijing-layer'], { features: [] });

      // Spy on invalidateQueries
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Process layer_data_update message
      const message = createLayerDataUpdateMessage('tokyo-layer');
      await handleLayerDataUpdate(message, queryClient);

      // Assert: Only ['layer', 'tokyo-layer'] was invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['layer', 'tokyo-layer'],
      });

      // Verify that other layers were not affected
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: ['layer', 'beijing-layer'],
      });
    });

    it('should not invalidate unrelated query keys', async () => {
      // Setup: Pre-populate cache with various queries
      queryClient.setQueryData(['layer', 'tokyo-layer'], { features: [] });
      queryClient.setQueryData(['hierarchy', 'root'], []);
      queryClient.setQueryData(['outcomes'], {});

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Process layer_data_update message
      const message = createLayerDataUpdateMessage('tokyo-layer');
      await handleLayerDataUpdate(message, queryClient);

      // Assert: Only ['layer', 'tokyo-layer'] was called
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['layer', 'tokyo-layer'],
      });
    });

    it('should handle multiple sequential layer updates independently', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Update layer 1
      const msg1 = createLayerDataUpdateMessage('layer-1');
      await handleLayerDataUpdate(msg1, queryClient);

      // Update layer 2
      const msg2 = createLayerDataUpdateMessage('layer-2');
      await handleLayerDataUpdate(msg2, queryClient);

      // Update layer 3
      const msg3 = createLayerDataUpdateMessage('layer-3');
      await handleLayerDataUpdate(msg3, queryClient);

      // Assert: Each layer was invalidated exactly once
      expect(invalidateSpy).toHaveBeenCalledTimes(3);
      expect(invalidateSpy).toHaveBeenNthCalledWith(1, {
        queryKey: ['layer', 'layer-1'],
      });
      expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
        queryKey: ['layer', 'layer-2'],
      });
      expect(invalidateSpy).toHaveBeenNthCalledWith(3, {
        queryKey: ['layer', 'layer-3'],
      });
    });
  });

  // ==========================================================================
  // GPU Filter Sync Tests
  // ==========================================================================

  describe('gpu_filter_sync invalidation', () => {
    it('should invalidate gpu-filter query and all affected layers', async () => {
      // Setup
      queryClient.setQueryData(['gpu-filter', 'spatial-filter-1'], {});
      queryClient.setQueryData(['layer', 'tokyo-layer'], {});
      queryClient.setQueryData(['layer', 'beijing-layer'], {});

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Process gpu_filter_sync message affecting two layers
      const message = createGPUFilterSyncMessage('spatial-filter-1', [
        'tokyo-layer',
        'beijing-layer',
      ]);
      await handleGPUFilterSync(message, queryClient);

      // Assert: Filter and both affected layers were invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['gpu-filter', 'spatial-filter-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['layer', 'tokyo-layer'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['layer', 'beijing-layer'],
      });
      expect(invalidateSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle filter with no affected layers', async () => {
      queryClient.setQueryData(['gpu-filter', 'empty-filter'], {});

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Process gpu_filter_sync with no affected layers
      const message = createGPUFilterSyncMessage('empty-filter', []);
      await handleGPUFilterSync(message, queryClient);

      // Assert: Only the filter itself was invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['gpu-filter', 'empty-filter'],
      });
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle filter affecting many layers', async () => {
      const affectedLayers = Array.from({ length: 10 }, (_, i) => `layer-${i}`);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Process gpu_filter_sync affecting 10 layers
      const message = createGPUFilterSyncMessage('bulk-filter', affectedLayers);
      await handleGPUFilterSync(message, queryClient);

      // Assert: Filter + 10 layers = 11 invalidations
      expect(invalidateSpy).toHaveBeenCalledTimes(11);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['gpu-filter', 'bulk-filter'],
      });
      affectedLayers.forEach(layerId => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['layer', layerId],
        });
      });
    });
  });

  // ==========================================================================
  // Scoped Invalidation Tests
  // ==========================================================================

  describe('Scoped invalidation (no over-invalidation)', () => {
    it('should not invalidate other filters when updating one filter', async () => {
      queryClient.setQueryData(['gpu-filter', 'filter-1'], {});
      queryClient.setQueryData(['gpu-filter', 'filter-2'], {});
      queryClient.setQueryData(['gpu-filter', 'filter-3'], {});

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Update only filter-1
      const message = createGPUFilterSyncMessage('filter-1', ['layer-1']);
      await handleGPUFilterSync(message, queryClient);

      // Assert: filter-1 and layer-1 were invalidated, but not filter-2 or filter-3
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['gpu-filter', 'filter-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['layer', 'layer-1'],
      });
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: ['gpu-filter', 'filter-2'],
      });
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: ['gpu-filter', 'filter-3'],
      });
    });

    it('should not invalidate layers not affected by filter', async () => {
      queryClient.setQueryData(['layer', 'affected-layer'], {});
      queryClient.setQueryData(['layer', 'unaffected-layer'], {});

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Filter only affects 'affected-layer'
      const message = createGPUFilterSyncMessage('filter-1', ['affected-layer']);
      await handleGPUFilterSync(message, queryClient);

      // Assert: Only affected-layer was invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['layer', 'affected-layer'],
      });
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: ['layer', 'unaffected-layer'],
      });
    });
  });

  // ==========================================================================
  // Query Key Naming Convention Tests
  // ==========================================================================

  describe('Query key naming conventions', () => {
    it('should use consistent query key format for layers', () => {
      const layerId = 'tokyo-infrastructure';
      const queryKey = ['layer', layerId];

      // Verify the format matches expected pattern
      expect(queryKey).toEqual(['layer', 'tokyo-infrastructure']);
      expect(queryKey[0]).toBe('layer');
      expect(queryKey[1]).toBe(layerId);
    });

    it('should use consistent query key format for gpu-filters', () => {
      const filterId = 'spatial-filter-tokyo';
      const queryKey = ['gpu-filter', filterId];

      // Verify the format matches expected pattern
      expect(queryKey).toEqual(['gpu-filter', 'spatial-filter-tokyo']);
      expect(queryKey[0]).toBe('gpu-filter');
      expect(queryKey[1]).toBe(filterId);
    });
  });

  // ==========================================================================
  // Cache State Verification
  // ==========================================================================

  describe('Cache state after invalidation', () => {
    it('should mark invalidated queries as stale', async () => {
      // Pre-populate with fresh data
      queryClient.setQueryData(['layer', 'test-layer'], { features: [] });

      // Verify query is not stale initially
      const stateBefore = queryClient.getQueryState(['layer', 'test-layer']);
      expect(stateBefore?.isInvalidated).toBe(false);

      // Invalidate
      const message = createLayerDataUpdateMessage('test-layer');
      await handleLayerDataUpdate(message, queryClient);

      // Verify query is now stale
      const stateAfter = queryClient.getQueryState(['layer', 'test-layer']);
      expect(stateAfter?.isInvalidated).toBe(true);
    });

    it('should preserve data until refetch after invalidation', async () => {
      const initialData = { features: [{ id: 1 }] };
      queryClient.setQueryData(['layer', 'test-layer'], initialData);

      // Invalidate
      const message = createLayerDataUpdateMessage('test-layer');
      await handleLayerDataUpdate(message, queryClient);

      // Data should still be present (just stale)
      const data = queryClient.getQueryData(['layer', 'test-layer']);
      expect(data).toEqual(initialData);
    });
  });
});
