/**
 * Real-time State Update Handlers
 * Handles WebSocket messages and coordinates with React Query and Zustand
 * Implements orjson-safe message processing and error resilience
 * Following forecastin patterns for WebSocket resilience
 *
 * SECURITY: All incoming WebSocket messages are validated against Zod schemas
 * to prevent malformed data from corrupting application state.
 */

import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { hierarchyKeys } from '../hooks/useHierarchy';
import type { Entity, WebSocketMessage } from '../types';
import { CacheCoordinator, ErrorRecovery, PerformanceMonitor } from '../utils/stateManager';
import {
  parseRealtimeMessage,
  validateRealtimeMessage,
  type RealtimeMessage,
  type EntityUpdateMessage,
  type HierarchyChangeMessage,
  type BulkUpdateMessage,
  type CacheInvalidateMessage,
  type SearchUpdateMessage,
  isEntityUpdate,
  isHierarchyChange,
  isBulkUpdate,
  isCacheInvalidate,
  isSearchUpdate,
} from '../types/ws_messages';

// Message processor for different WebSocket message types
export class RealtimeMessageProcessor {
  private queryClient: QueryClient;
  private uiStore: typeof useUIStore;
  private cacheCoordinator: CacheCoordinator;
  private errorRecovery: ErrorRecovery;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    queryClient: QueryClient,
    uiStore: typeof useUIStore,
    cacheCoordinator: CacheCoordinator
  ) {
    this.queryClient = queryClient;
    this.uiStore = uiStore;
    this.cacheCoordinator = cacheCoordinator;
    this.errorRecovery = new ErrorRecovery();
    this.performanceMonitor = new PerformanceMonitor();
  }

  // Process entity update messages
  async processEntityUpdate(message: EntityUpdateMessage): Promise<void> {
    const startTime = performance.now();

    try {
      // Extract validated data
      const { entityId, entity } = message.data;

      if (!entity && !entityId) {
        console.warn('Entity update message missing entity data');
        return;
      }

      const targetEntity = entity || await this.getEntityById(entityId);
      if (!targetEntity) {
        console.warn('Target entity not found:', entityId);
        return;
      }

      // Optimistic update in React Query cache
      const updateResult = this.cacheCoordinator.optimisticUpdate(
        [...hierarchyKeys.entity(targetEntity.id)],
        (current: Entity | undefined) => (current ? { ...current, ...targetEntity } : targetEntity) as Entity
      );

      if (!updateResult.success) {
        throw updateResult.error;
      }

      // Update parent hierarchy cache
      if (targetEntity.path) {
        const parentPath = targetEntity.path.split('/').slice(0, -1).join('/');
        const depth = parentPath.split('/').length;
        
        this.cacheCoordinator.optimisticUpdate(
          [...hierarchyKeys.children(parentPath, depth)].map(String),
          (current: any) => {
            if (!current?.entities) return current;
            
            const updatedEntities = current.entities.map((e: Entity) =>
              e.id === targetEntity.id ? { ...e, ...targetEntity } : e
            );
            
            return { ...current, entities: updatedEntities };
          }
        );
      }

      // Update UI state if this is the active entity
      const activeEntity = this.uiStore.getState().activeEntity;
      if (activeEntity?.id === targetEntity.id) {
        this.uiStore.getState().setActiveEntity(targetEntity as Entity);
      }

      // Preload related queries for better UX
      this.cacheCoordinator.preloadRelatedQueries(targetEntity as Entity);

      const duration = performance.now() - startTime;
      this.performanceMonitor.recordMetric('entity_update_processing', duration);
      
      console.log(`Entity update processed in ${duration.toFixed(2)}ms:`, targetEntity.id);
      
    } catch (error) {
      console.error('Error processing entity update:', error);
      
      // Record failure for circuit breaker
      this.errorRecovery.recordFailure(`entity_update_${message.data?.entityId || message.data?.entity?.id || 'unknown'}`);
      
      // Send structured error instead of crashing
      throw new Error(`Failed to process entity update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Process hierarchy change messages
  async processHierarchyChange(message: HierarchyChangeMessage): Promise<void> {
    const startTime = performance.now();

    try {
      // Invalidate all hierarchy-related queries
      this.queryClient.invalidateQueries({
        queryKey: hierarchyKeys.all,
        exact: false
      });

      // Clear navigation state to prevent stale data
      this.uiStore.getState().resetNavigation();

      // Optionally preload critical hierarchy data
      if ((message.data as any)?.preloadRoots) {
        this.cacheCoordinator.warmCache((message.data as any).preloadRoots);
      }

      const duration = performance.now() - startTime;
      this.performanceMonitor.recordMetric('hierarchy_change_processing', duration);
      
      console.log(`Hierarchy change processed in ${duration.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('Error processing hierarchy change:', error);
      this.errorRecovery.recordFailure('hierarchy_change');
      throw error;
    }
  }

  // Process bulk update messages (batched updates)
  async processBulkUpdate(message: BulkUpdateMessage): Promise<void> {
    const startTime = performance.now();

    try {
      const updates = (message.data as any).updates || [];

      if (updates.length === 0) {
        console.warn('Bulk update message contains no updates');
        return;
      }

      // Process updates in batches for performance
      const batchSize = 10;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (update: WebSocketMessage) => {
            try {
              if (update.type === 'entity_update') {
                await this.processEntityUpdate(update as unknown as EntityUpdateMessage);
              } else if (update.type === 'hierarchy_change') {
                await this.processHierarchyChange(update as unknown as HierarchyChangeMessage);
              }
            } catch (error) {
              console.error('Error processing batch update:', error);
              // Continue with other updates even if one fails
            }
          })
        );
        
        // Small delay between batches to prevent UI blocking
        if (i + batchSize < updates.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      const duration = performance.now() - startTime;
      this.performanceMonitor.recordMetric('bulk_update_processing', duration);
      
      console.log(`Bulk update processed ${updates.length} items in ${duration.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('Error processing bulk update:', error);
      this.errorRecovery.recordFailure('bulk_update');
      throw error;
    }
  }

  // Process cache invalidation messages
  async processCacheInvalidate(message: CacheInvalidateMessage): Promise<void> {
    try {
      const queryKeys = message.data.keys || [];
      const strategy = message.data.strategy;
      const invalidateAll = strategy === 'immediate';

      if (invalidateAll) {
        this.queryClient.invalidateQueries({
          queryKey: hierarchyKeys.all
        });
      } else if (queryKeys.length > 0) {
        queryKeys.forEach((key: any) => {
          this.queryClient.invalidateQueries({ queryKey: key });
        });
      }

      console.log('Cache invalidation processed:', { strategy, queryKeysCount: queryKeys.length });

    } catch (error) {
      console.error('Error processing cache invalidation:', error);
      this.errorRecovery.recordFailure('cache_invalidate');
    }
  }

  // Process search result updates
  async processSearchUpdate(message: SearchUpdateMessage): Promise<void> {
    try {
      const query = (message as any).payload?.query;
      const results = (message as any).payload?.results;

      if (!query || !results) {
        console.warn('Search update message missing query or results');
        return;
      }

      // Update search results cache
      this.queryClient.setQueryData(
        hierarchyKeys.search(query),
        {
          entities: results,
          totalCount: results.length,
          query,
          hasMore: false
        }
      );

      console.log(`Search results updated for query "${query}": ${results.length} results`);

    } catch (error) {
      console.error('Error processing search update:', error);
      this.errorRecovery.recordFailure('search_update');
    }
  }

  // Process layer data update messages
  async processLayerDataUpdate(message: WebSocketMessage & {
    data?: {
      layer_id: string;
      layer_type: string;
      layer_data: any;
      bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    }
  }): Promise<void> {
    const startTime = performance.now();
    
    try {
      const { layer_id, layer_type, layer_data, bbox } = message.data || {};
      
      if (!layer_id || !layer_type || !layer_data) {
        console.warn('Layer data update message missing required fields');
        return;
      }

      // Update layer data in React Query cache
      this.queryClient.setQueryData(
        ['layer', layer_id],
        (oldData: any) => ({
          ...oldData,
          ...layer_data,
          layerType: layer_type,
          bbox,
          lastUpdated: message.timestamp || new Date().toISOString(),
        })
      );

      // Invalidate related queries to trigger re-render
      this.queryClient.invalidateQueries({ queryKey: ['layer', layer_id] });
      this.queryClient.invalidateQueries({ queryKey: ['layers', layer_type] });

      // Dispatch custom event for layer registry
      window.dispatchEvent(new CustomEvent('layer-data-update', {
        detail: {
          layerId: layer_id,
          layerType: layer_type,
          data: layer_data,
          bbox,
          timestamp: message.timestamp,
        }
      }));

      const duration = performance.now() - startTime;
      this.performanceMonitor.recordMetric('layer_data_update_processing', duration);
      
      console.log(`Layer data update processed in ${duration.toFixed(2)}ms:`, layer_id);
      
    } catch (error) {
      console.error('Error processing layer data update:', error);
      this.errorRecovery.recordFailure(`layer_data_update_${message.data?.layer_id}`);
      throw error;
    }
  }

  // Process GPU filter sync messages
  async processGPUFilterSync(message: WebSocketMessage & {
    data?: {
      filter_id: string;
      filter_type: string;
      filter_params: Record<string, any>;
      affected_layers: string[];
      status: 'applied' | 'pending' | 'error' | 'cleared';
    }
  }): Promise<void> {
    const startTime = performance.now();
    
    try {
      const { filter_id, filter_type, filter_params, affected_layers, status } = message.data || {};
      
      if (!filter_id || !filter_type || !affected_layers) {
        console.warn('GPU filter sync message missing required fields');
        return;
      }

      // Update GPU filter state in React Query
      this.queryClient.setQueryData(
        ['gpu-filter', filter_id],
        {
          filterType: filter_type,
          params: filter_params,
          affectedLayers: affected_layers,
          status,
          timestamp: message.timestamp || new Date().toISOString(),
        }
      );

      // Invalidate affected layer queries
      affected_layers.forEach((layerId: string) => {
        this.queryClient.invalidateQueries({ queryKey: ['layer', layerId] });
      });

      // Dispatch custom event for GPU filter coordination
      window.dispatchEvent(new CustomEvent('gpu-filter-sync', {
        detail: {
          filterId: filter_id,
          filterType: filter_type,
          filterParams: filter_params,
          affectedLayers: affected_layers,
          status,
          timestamp: message.timestamp,
        }
      }));

      const duration = performance.now() - startTime;
      this.performanceMonitor.recordMetric('gpu_filter_sync_processing', duration);
      
      console.log(`GPU filter sync processed in ${duration.toFixed(2)}ms:`, filter_id, `(status: ${status})`);
      
    } catch (error) {
      console.error('Error processing GPU filter sync:', error);
      this.errorRecovery.recordFailure(`gpu_filter_sync_${message.data?.filter_id}`);
      throw error;
    }
  }

  // Get entity by ID (utility method)
  private async getEntityById(entityId: string): Promise<Entity | null> {
    try {
      // Try to get from cache first
      const cached = this.queryClient.getQueryData<Entity>(hierarchyKeys.entity(entityId));
      if (cached) return cached;

      // Fallback to API call
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:9000/api'}/entities/${entityId}`);
      if (!response.ok) return null;
      
      const entity = await response.json();
      
      // Cache the result
      this.queryClient.setQueryData(hierarchyKeys.entity(entityId), entity);
      
      return entity;
    } catch (error) {
      console.error('Error fetching entity:', error);
      return null;
    }
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      entityUpdate: this.performanceMonitor.getStats('entity_update_processing'),
      hierarchyChange: this.performanceMonitor.getStats('hierarchy_change_processing'),
      bulkUpdate: this.performanceMonitor.getStats('bulk_update_processing')
    };
  }

  // Reset performance metrics
  resetMetrics() {
    // PerformanceMonitor doesn't have a reset method, so we'll just create a new instance
    this.performanceMonitor = new PerformanceMonitor();
  }
}

// Hook for using the message processor
export const useRealtimeMessageProcessor = () => {
  const queryClient = useQueryClient();
  
  // Get or create cache coordinator instance
  const getCacheCoordinator = () => {
    // This is a simplified approach - in a real app you'd want to manage this more carefully
    return new CacheCoordinator(queryClient);
  };

  const processor = React.useMemo(() => {
    return new RealtimeMessageProcessor(
      queryClient,
      useUIStore,
      getCacheCoordinator()
    );
  }, [queryClient]);

  return processor;
};

// Message routing utility with validation
export const routeRealtimeMessage = (
  processor: RealtimeMessageProcessor,
  rawMessage: unknown
): Promise<void> => {
  const startTime = performance.now();

  try {
    // SECURITY: Validate message against Zod schema before processing
    const validationResult = validateRealtimeMessage(rawMessage);

    if (!validationResult.valid) {
      // Log validation errors but don't crash
      console.error('WebSocket message validation failed:', {
        errors: validationResult.errors,
        rawMessage,
        timestamp: new Date().toISOString(),
      });

      // Track validation failure for monitoring
      if (typeof rawMessage === 'object' && rawMessage !== null) {
        const type = (rawMessage as any).type || 'unknown';
        console.error(`Invalid message type: ${type}`, validationResult.errors);
      }

      // Reject invalid messages gracefully
      return Promise.resolve();
    }

    // Message is validated - safe to process
    const message = validationResult.message!;

    // Route to appropriate handler using type guards
    if (isEntityUpdate(message)) {
      return processor.processEntityUpdate(message);
    } else if (isHierarchyChange(message)) {
      return processor.processHierarchyChange(message);
    } else if (isBulkUpdate(message)) {
      return processor.processBulkUpdate(message);
    } else if (isCacheInvalidate(message)) {
      return processor.processCacheInvalidate(message);
    } else if (isSearchUpdate(message)) {
      return processor.processSearchUpdate(message);
    } else {
      console.warn('Unknown message type:', message.type);
      return Promise.resolve();
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`Error routing message (${duration.toFixed(2)}ms):`, error);
    throw error;
  }
};

// Error handler for WebSocket messages
export const handleRealtimeError = (
  error: Error,
  originalMessage: WebSocketMessage,
  retryHandler?: (message: WebSocketMessage) => void
) => {
  console.error('Realtime message processing error:', {
    error: error.message,
    messageType: originalMessage.type,
    timestamp: new Date().toISOString()
  });

  // Attempt recovery for certain error types
  if (retryHandler && ['entity_update', 'hierarchy_change'].includes(originalMessage.type)) {
    // Retry after a delay
    setTimeout(() => {
      try {
        retryHandler(originalMessage);
      } catch (retryError) {
        console.error('Retry also failed:', retryError);
      }
    }, 2000);
  }

  // Send structured error response if appropriate
  return {
    type: 'processing_error',
    error: error.message,
    originalMessage,
    timestamp: Date.now()
  };
};

// Performance monitoring for real-time updates
export class RealtimePerformanceMonitor {
  private metrics = {
    messagesReceived: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0
  };

  recordMessageReceived() {
    this.metrics.messagesReceived++;
  }

  recordMessageProcessed(processingTime: number) {
    this.metrics.messagesProcessed++;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.messagesProcessed;
  }

  recordMessageFailed() {
    this.metrics.messagesFailed++;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getHealthStatus() {
    const failureRate = this.metrics.messagesReceived > 0 
      ? this.metrics.messagesFailed / this.metrics.messagesReceived 
      : 0;
    
    const isHealthy = failureRate < 0.05 && this.metrics.averageProcessingTime < 100; // 5% failure rate, 100ms processing time
    
    return {
      isHealthy,
      failureRate,
      averageProcessingTime: this.metrics.averageProcessingTime,
      messagesPerSecond: this.metrics.messagesReceived / 60 // Assuming 1-minute window
    };
  }

  reset() {
    this.metrics = {
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesFailed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0
    };
  }
}

import React from 'react';