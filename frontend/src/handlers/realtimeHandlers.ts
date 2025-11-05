/**
 * Real-time State Update Handlers
 * Handles WebSocket messages and coordinates with React Query and Zustand
 * Implements orjson-safe message processing and error resilience
 * Following forecastin patterns for WebSocket resilience
 */

import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { hierarchyKeys } from '../hooks/useHierarchy';
import { Entity, WebSocketMessage } from '../types';
import { CacheCoordinator, ErrorRecovery, PerformanceMonitor } from '../utils/stateManager';

// Message processor for different WebSocket message types
export class RealtimeMessageProcessor {
  private queryClient: useQueryClient;
  private uiStore: ReturnType<typeof useUIStore>;
  private cacheCoordinator: CacheCoordinator;
  private errorRecovery: ErrorRecovery;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    queryClient: useQueryClient,
    uiStore: ReturnType<typeof useUIStore>,
    cacheCoordinator: CacheCoordinator
  ) {
    this.queryClient = queryClient;
    this.uiStore = uiStore;
    this.cacheCoordinator = cacheCoordinator;
    this.errorRecovery = new ErrorRecovery();
    this.performanceMonitor = new PerformanceMonitor();
  }

  // Process entity update messages
  async processEntityUpdate(message: WebSocketMessage & { data?: Entity }): Promise<void> {
    const startTime = performance.now();
    
    try {
      const { data: entity, entityId } = message;
      
      if (!entity && !entityId) {
        console.warn('Entity update message missing entity data');
        return;
      }

      const targetEntity = entity || await this.getEntityById(entityId!);
      if (!targetEntity) {
        console.warn('Target entity not found:', entityId);
        return;
      }

      // Optimistic update in React Query cache
      const updateResult = this.cacheCoordinator.optimisticUpdate(
        hierarchyKeys.entity(targetEntity.id),
        (current: Entity | undefined) => current ? { ...current, ...targetEntity } : targetEntity
      );

      if (!updateResult.success) {
        throw updateResult.error;
      }

      // Update parent hierarchy cache
      if (targetEntity.path) {
        const parentPath = targetEntity.path.split('/').slice(0, -1).join('/');
        const depth = parentPath.split('/').length;
        
        this.cacheCoordinator.optimisticUpdate(
          hierarchyKeys.children(parentPath, depth),
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
        this.uiStore.getState().setActiveEntity(targetEntity);
      }

      // Preload related queries for better UX
      this.cacheCoordinator.preloadRelatedQueries(targetEntity);

      const duration = performance.now() - startTime;
      this.performanceMonitor.recordMetric('entity_update_processing', duration);
      
      console.log(`Entity update processed in ${duration.toFixed(2)}ms:`, targetEntity.id);
      
    } catch (error) {
      console.error('Error processing entity update:', error);
      
      // Record failure for circuit breaker
      this.errorRecovery.recordFailure(`entity_update_${entityId}`);
      
      // Send structured error instead of crashing
      throw new Error(`Failed to process entity update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Process hierarchy change messages
  async processHierarchyChange(message: WebSocketMessage): Promise<void> {
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
      if (message.data?.preloadRoots) {
        this.cacheCoordinator.warmCache(message.data.preloadRoots);
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
  async processBulkUpdate(message: WebSocketMessage & { data?: { updates: any[] } }): Promise<void> {
    const startTime = performance.now();
    
    try {
      const { updates = [] } = message.data || {};
      
      if (updates.length === 0) {
        console.warn('Bulk update message contains no updates');
        return;
      }

      // Process updates in batches for performance
      const batchSize = 10;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (update) => {
            try {
              if (update.type === 'entity_update') {
                await this.processEntityUpdate(update);
              } else if (update.type === 'hierarchy_change') {
                await this.processHierarchyChange(update);
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
  async processCacheInvalidate(message: WebSocketMessage): Promise<void> {
    try {
      const { queryKeys = [], invalidateAll = false } = message.data || {};
      
      if (invalidateAll) {
        this.queryClient.invalidateQueries({
          queryKey: hierarchyKeys.all
        });
      } else if (queryKeys.length > 0) {
        queryKeys.forEach(key => {
          this.queryClient.invalidateQueries({ queryKey: key });
        });
      }

      console.log('Cache invalidation processed:', { invalidateAll, queryKeysCount: queryKeys.length });
      
    } catch (error) {
      console.error('Error processing cache invalidation:', error);
      this.errorRecovery.recordFailure('cache_invalidate');
    }
  }

  // Process search result updates
  async processSearchUpdate(message: WebSocketMessage & { data?: { query: string; results: Entity[] } }): Promise<void> {
    try {
      const { query, results } = message.data || {};
      
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

  // Get entity by ID (utility method)
  private async getEntityById(entityId: string): Promise<Entity | null> {
    try {
      // Try to get from cache first
      const cached = this.queryClient.getQueryData<Entity>(hierarchyKeys.entity(entityId));
      if (cached) return cached;

      // Fallback to API call
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:9000/api'}/entities/${entityId}`);
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
  const uiStore = useUIStore();
  
  // Get or create cache coordinator instance
  const getCacheCoordinator = () => {
    // This is a simplified approach - in a real app you'd want to manage this more carefully
    return new CacheCoordinator(queryClient);
  };

  const processor = React.useMemo(() => {
    return new RealtimeMessageProcessor(
      queryClient,
      uiStore,
      getCacheCoordinator()
    );
  }, [queryClient, uiStore]);

  return processor;
};

// Message routing utility
export const routeRealtimeMessage = (
  processor: RealtimeMessageProcessor,
  message: WebSocketMessage
): Promise<void> => {
  const startTime = performance.now();
  
  try {
    switch (message.type) {
      case 'entity_update':
        return processor.processEntityUpdate(message);
        
      case 'hierarchy_change':
        return processor.processHierarchyChange(message);
        
      case 'bulk_update':
        return processor.processBulkUpdate(message);
        
      case 'cache_invalidate':
        return processor.processCacheInvalidate(message);
        
      case 'search_update':
        return processor.processSearchUpdate(message);
        
      default:
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