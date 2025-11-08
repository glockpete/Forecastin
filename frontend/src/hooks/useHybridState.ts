/**
 * Hybrid State Management Hook
 * Coordinates React Query (Server State) + Zustand (UI State) + WebSocket (Real-time)
 * Implements proper cache invalidation and state synchronization
 * Following forecastin patterns for WebSocket resilience and orjson handling
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import { useUIStore } from '../store/uiStore';
import { hierarchyKeys } from './useHierarchy';
import type { Entity } from '../types';
import { globalErrorRecovery } from '../utils/errorRecovery';
import { PerformanceMonitor } from '../utils/stateManager';

// Message types for WebSocket-React Query coordination
export interface StateSyncMessage {
  type: 'entity_update' | 'hierarchy_change' | 'bulk_update' | 'cache_invalidate';
  data?: any;
  queryKeys?: string[];
  entityId?: string;
  entityPath?: string;
  timestamp: number;
  source: 'websocket' | 'mutation' | 'user_action';
}

// Cache coordination strategies
export interface CacheCoordinationOptions {
  invalidateAll: boolean;
  selectiveKeys: readonly unknown[][];
  updateExisting: boolean;
  mergeStrategy: 'replace' | 'merge' | 'append';
}

// State coordination configuration
export interface StateSyncConfig {
  enabled: boolean;
  channels: string[];
  autoInvalidate: boolean;
  optimisticUpdates: boolean;
  retryFailedSync: boolean;
  batchUpdates: boolean;
  debounceMs: number;
}

// Default configuration
const DEFAULT_CONFIG: StateSyncConfig = {
  enabled: true,
  channels: ['hierarchy_updates', 'entity_changes', 'cache_sync'],
  autoInvalidate: true,
  optimisticUpdates: true,
  retryFailedSync: true,
  batchUpdates: true,
  debounceMs: 100,
};

export interface UseHybridStateReturn {
  // Connection status
  isConnected: boolean;
  lastSync: number | null;
  pendingUpdates: number;
  
  // Sync operations
  syncEntity: (entity: Entity) => void;
  invalidateHierarchy: (paths?: string[]) => void;
  invalidateEntity: (entityId: string) => void;
  updateCacheOptimistically: (key: string[], data: any) => void;
  
  // WebSocket operations
  sendSyncMessage: (message: StateSyncMessage) => void;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  
  // Utility functions
  clearPendingUpdates: () => void;
  getSyncStatus: () => {
    connected: boolean;
    pending: number;
    lastSync: number | null;
    health: 'healthy' | 'degraded' | 'error';
  };
  
  // Error recovery and monitoring
  getErrorState: () => {
    lastError: Error | null;
    errorCount: number;
    retryCount: number;
    circuitBreakerStates: Record<string, any>;
  };
  getPerformanceMetrics: () => any;
  resetErrorState: () => void;
  resetCircuitBreakers: () => void;
  getSystemHealth: () => Promise<any>;
}

export const useHybridState = (
  config: Partial<StateSyncConfig> = {}
): UseHybridStateReturn => {
  const queryClient = useQueryClient();
  const { 
    isConnected, 
    lastMessage, 
    sendMessage,
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe
  } = useWebSocket();

  // Merge configuration
  const stateConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Initialize error recovery system
  React.useEffect(() => {
    // Register circuit breakers for different operations
    globalErrorRecovery.registerCircuitBreaker('cache_coordination', {
      failureThreshold: 3,
      timeout: 30000,
      expectedErrors: [TypeError, ReferenceError]
    });
    
    globalErrorRecovery.registerCircuitBreaker('websocket_processing', {
      failureThreshold: 5,
      timeout: 60000,
      expectedErrors: [TypeError]
    });
    
    globalErrorRecovery.registerCircuitBreaker('entity_sync', {
      failureThreshold: 3,
      timeout: 45000
    });
  }, []);
  
  // State tracking
  const [lastSync, setLastSync] = React.useState<number | null>(null);
  const [pendingUpdates, setPendingUpdates] = React.useState(0);
  const [errorState, setErrorState] = React.useState<{
    lastError: Error | null;
    errorCount: number;
    retryCount: number;
    circuitBreakerStates: Record<string, any>;
  }>({ lastError: null, errorCount: 0, retryCount: 0, circuitBreakerStates: {} });
  
  // Enhanced error tracking and performance monitoring
  const performanceMonitor = React.useRef(new PerformanceMonitor());
  
  // Refs for batch processing
  const pendingUpdatesRef = useRef<Map<string, StateSyncMessage>>(new Map());
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Enhanced cache coordination with error recovery
  const coordinateCacheUpdate = useCallback(async (
    message: StateSyncMessage,
    options: CacheCoordinationOptions = {
      invalidateAll: false,
      selectiveKeys: [],
      updateExisting: true,
      mergeStrategy: 'replace'
    }
  ) => {
    const startTime = performance.now();
    const operationKey = `cache_coordination_${message.type}`;
    
    try {
      // Use error recovery system for robust error handling
      const result = await globalErrorRecovery.executeWithRecovery(
        operationKey,
        async () => {
          const { selectiveKeys: queryKeys = [], invalidateAll = false, updateExisting = true, mergeStrategy = 'replace' } = options;
          
          if (invalidateAll) {
            // Invalidate all hierarchy queries
            queryClient.invalidateQueries({ queryKey: hierarchyKeys.all });
          } else if (queryKeys.length > 0) {
            // Invalidate specific query keys
            queryKeys.forEach(key => {
              queryClient.invalidateQueries({ queryKey: key });
            });
          }
          
          // Handle optimistic updates for specific entity changes
          if (updateExisting && message.type === 'entity_update' && message.data) {
            const { entityId, entityPath } = message;
            
            // Update specific entity cache
            if (entityId) {
              queryClient.setQueryData(
                hierarchyKeys.entity(entityId),
                (old: Entity | undefined) => old ? { ...old, ...message.data } : message.data
              );
            }
            
            // Update hierarchy cache if path is available
            if (entityPath) {
              const parentPath = entityPath.split('/').slice(0, -1).join('/');
              const depth = parentPath.split('/').length;
              
              // Update parent children query
              queryClient.setQueryData(
                hierarchyKeys.children(parentPath, depth),
                (old: any) => {
                  if (!old?.entities) return old;
                  
                  const updatedEntities = old.entities.map((entity: Entity) =>
                    entity.id === entityId
                      ? { ...entity, ...message.data, updatedAt: new Date().toISOString() }
                      : entity
                  );
                  
                  return { ...old, entities: updatedEntities };
                }
              );
            }
          }
          
          return true;
        },
        {
          circuitBreaker: true,
          retry: true,
          fallback: () => {
            console.warn('Cache coordination fallback activated for:', message.type);
            return false;
          }
        }
      );
      
      const duration = performance.now() - startTime;
      performanceMonitor.current.recordMetric('cache_coordination', duration);
      
      if (result) {
        setLastSync(Date.now());
        console.log(`Cache coordinated for message: ${message.type} (${duration.toFixed(2)}ms)`,
                   message.data?.id || message.entityId);
      } else {
        throw new Error('Cache coordination failed');
      }
      
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.current.recordMetric('cache_coordination_error', duration);
      
      // Update error state
      setErrorState(prev => ({
        ...prev,
        lastError: error as Error,
        errorCount: prev.errorCount + 1,
        circuitBreakerStates: globalErrorRecovery.getCircuitBreakerStates()
      }));
      
      console.error(`Cache coordination error (${duration.toFixed(2)}ms):`, error);
      
      // Implement fallback retry mechanism with exponential backoff
      scheduleRetry(message);
    }
  }, [queryClient]);

  // Batch processing for high-frequency updates
  const processBatchUpdate = useCallback(() => {
    if (pendingUpdatesRef.current.size === 0) return;
    
    const messages = Array.from(pendingUpdatesRef.current.values());
    pendingUpdatesRef.current.clear();
    setPendingUpdates(0);
    
    // Process messages in batch
    messages.forEach(message => {
      coordinateCacheUpdate(message);
    });
    
    console.log(`Processed ${messages.length} batched updates`);
  }, [coordinateCacheUpdate]);

  // Debounced batch processing
  const scheduleBatchUpdate = useCallback(() => {
    if (!stateConfig.batchUpdates) {
      processBatchUpdate();
      return;
    }
    
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    syncTimeoutRef.current = setTimeout(() => {
      processBatchUpdate();
    }, stateConfig.debounceMs);
  }, [processBatchUpdate, stateConfig.batchUpdates, stateConfig.debounceMs]);

  // Enhanced retry mechanism with exponential backoff and circuit breaker integration
  const scheduleRetry = useCallback(async (message: StateSyncMessage) => {
    if (!stateConfig.retryFailedSync) return;
    
    const retryKey = `${message.type}_${message.entityId || message.entityPath}`;
    const operationKey = `entity_sync_${retryKey}`;
    
    try {
      // Update retry count in error state
      setErrorState(prev => ({
        ...prev,
        retryCount: prev.retryCount + 1
      }));
      
      // Use global error recovery system for enhanced retry logic
      const result = await globalErrorRecovery.executeWithRecovery(
        operationKey,
        async () => {
          console.log(`Retrying failed sync for: ${retryKey}`);
          await coordinateCacheUpdate(message);
          return true;
        },
        {
          circuitBreaker: true,
          retry: true,
          fallback: () => {
            console.warn(`Retry failed for ${retryKey}, giving up`);
            return false;
          }
        }
      );
      
      if (result) {
        console.log(`Retry successful for: ${retryKey}`);
      }
      
    } catch (error) {
      console.error(`Retry failed for ${retryKey}:`, error);
      
      // Record retry failure in error state
      setErrorState(prev => ({
        ...prev,
        lastError: error as Error,
        errorCount: prev.errorCount + 1,
        circuitBreakerStates: globalErrorRecovery.getCircuitBreakerStates()
      }));
    }
  }, [stateConfig.retryFailedSync, coordinateCacheUpdate]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    try {
      // Convert WebSocket message to StateSyncMessage format
      const syncMessage: StateSyncMessage = {
        ...message,
        timestamp: Date.now(),
        source: 'websocket'
      };
      
      // Track pending updates
      const updateKey = `${syncMessage.type}_${syncMessage.entityId || syncMessage.entityPath || Date.now()}`;
      pendingUpdatesRef.current.set(updateKey, syncMessage);
      setPendingUpdates(pendingUpdatesRef.current.size);
      
      // Process based on message type
      if (syncMessage.type === 'entity_update') {
        const queryKeys = [
          [...hierarchyKeys.entity(syncMessage.entityId || '')],
          ...(syncMessage.entityPath ? [
            [...hierarchyKeys.children(syncMessage.entityPath.split('/').slice(0, -1).join('/'),
                                  syncMessage.entityPath.split('/').length - 1)]
          ] : [])
        ];
        
        coordinateCacheUpdate(syncMessage, {
          invalidateAll: false,
          selectiveKeys: queryKeys,
          updateExisting: true,
          mergeStrategy: 'replace'
        });
        
      } else if (syncMessage.type === 'hierarchy_change') {
        coordinateCacheUpdate(syncMessage, {
          invalidateAll: true,
          selectiveKeys: [],
          updateExisting: false,
          mergeStrategy: 'replace'
        });
        
      } else if (syncMessage.type === 'bulk_update') {
        scheduleBatchUpdate();
        
      } else if (syncMessage.type === 'cache_invalidate') {
        coordinateCacheUpdate(syncMessage, {
          invalidateAll: syncMessage.data?.invalidateAll || false,
          selectiveKeys: syncMessage.data?.queryKeys || [],
          updateExisting: false,
          mergeStrategy: 'replace'
        });
      }
      
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      // Send structured error message instead of crashing
      sendMessage({
        type: 'serialization_error',
        error: 'Failed to process WebSocket message',
        originalMessageType: message.type
      });
    }
  }, [coordinateCacheUpdate, scheduleBatchUpdate, sendMessage]);

  // Public API methods
  const syncEntity = useCallback((entity: Entity) => {
    const message: StateSyncMessage = {
      type: 'entity_update',
      data: entity,
      entityId: entity.id,
      entityPath: entity.path,
      timestamp: Date.now(),
      source: 'user_action'
    };
    
    coordinateCacheUpdate(message, {
      invalidateAll: false,
      selectiveKeys: [[...hierarchyKeys.entity(entity.id)]],
      updateExisting: true,
      mergeStrategy: 'replace'
    });
  }, [coordinateCacheUpdate]);

  const invalidateHierarchy = useCallback((paths?: string[]) => {
    const message: StateSyncMessage = {
      type: 'hierarchy_change',
      data: { paths },
      timestamp: Date.now(),
      source: 'user_action'
    };
    
    coordinateCacheUpdate(message, {
      invalidateAll: true,
      selectiveKeys: paths ? paths.map(path => [...hierarchyKeys.node(path)]) : [],
      updateExisting: false,
      mergeStrategy: 'replace'
    });
  }, [coordinateCacheUpdate]);

  const invalidateEntity = useCallback((entityId: string) => {
    const message: StateSyncMessage = {
      type: 'entity_update',
      entityId,
      timestamp: Date.now(),
      source: 'user_action'
    };
    
    coordinateCacheUpdate(message, {
      invalidateAll: false,
      selectiveKeys: [[...hierarchyKeys.entity(entityId)]],
      updateExisting: false,
      mergeStrategy: 'replace'
    });
  }, [coordinateCacheUpdate]);

  const updateCacheOptimistically = useCallback((key: string[], data: any) => {
    queryClient.setQueryData(key, (old: any) => {
      if (Array.isArray(old)) {
        return [...old, data];
      } else if (typeof old === 'object' && old !== null) {
        return { ...old, ...data };
      }
      return data;
    });
  }, [queryClient]);

  const sendSyncMessage = useCallback((message: StateSyncMessage) => {
    // Convert StateSyncMessage to WebSocketMessage format
    // StateSyncMessage uses number timestamp, WebSocketMessage uses string timestamp
    const wsMessage = {
      ...message,
      timestamp: new Date(message.timestamp).toISOString()
    };
    sendMessage(wsMessage as any);
  }, [sendMessage]);

  const subscribe = useCallback((channels: string[]) => {
    wsSubscribe(channels);
  }, [wsSubscribe]);

  const unsubscribe = useCallback((channels: string[]) => {
    wsUnsubscribe(channels);
  }, [wsUnsubscribe]);

  const clearPendingUpdates = useCallback(() => {
    pendingUpdatesRef.current.clear();
    setPendingUpdates(0);
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
  }, []);

  const getSyncStatus = useCallback(() => {
    const connected = isConnected;
    const pending = pendingUpdates;
    const lastSyncTime = lastSync;
    
    let health: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (!connected) {
      health = 'error';
    } else if (pending > 5 || (lastSyncTime && Date.now() - lastSyncTime > 30000)) {
      health = 'degraded';
    }
    
    return {
      connected,
      pending,
      lastSync: lastSyncTime,
      health
    };
  }, [isConnected, pendingUpdates, lastSync]);

  // Error recovery and monitoring utilities
  const getErrorState = useCallback(() => {
    return {
      ...errorState,
      circuitBreakerStates: globalErrorRecovery.getCircuitBreakerStates()
    };
  }, [errorState]);

  const getPerformanceMetrics = useCallback(() => {
    return {
      performance: performanceMonitor.current.getStats('cache_coordination'),
      error: performanceMonitor.current.getStats('cache_coordination_error'),
      circuitBreaker: performanceMonitor.current.getStats('circuit_breaker_metrics'),
      syncHealth: getSyncStatus()
    };
  }, [getSyncStatus]);

  const resetErrorState = useCallback(() => {
    setErrorState({
      lastError: null,
      errorCount: 0,
      retryCount: 0,
      circuitBreakerStates: {}
    });
    performanceMonitor.current = new PerformanceMonitor();
  }, []);

  const resetCircuitBreakers = useCallback(() => {
    globalErrorRecovery.resetCircuitBreakers();
    setErrorState(prev => ({
      ...prev,
      circuitBreakerStates: globalErrorRecovery.getCircuitBreakerStates()
    }));
  }, []);

  const getSystemHealth = useCallback(async () => {
    try {
      const health = await globalErrorRecovery.getHealthStatus();
      const errorStats = globalErrorRecovery.getErrorStats();
      
      return {
        ...health,
        errorStats,
        performance: getPerformanceMetrics(),
        syncStatus: getSyncStatus()
      };
    } catch (error) {
      console.error('Failed to get system health:', error);
      return {
        overall: 'unhealthy',
        checks: {},
        error: (error as Error).message,
        syncStatus: getSyncStatus()
      };
    }
  }, [getPerformanceMetrics, getSyncStatus]);

  // WebSocket message handling setup
  useEffect(() => {
    if (!stateConfig.enabled) return;
    
    // Subscribe to sync channels
    subscribe(stateConfig.channels);
    
    // Handle messages from useWebSocket hook
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
    
    return () => {
      unsubscribe(stateConfig.channels);
    };
  }, [lastMessage, stateConfig.enabled, subscribe, unsubscribe, handleWebSocketMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPendingUpdates();
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [clearPendingUpdates]);

  return {
    // Connection status
    isConnected,
    lastSync,
    pendingUpdates,
    
    // Sync operations
    syncEntity,
    invalidateHierarchy,
    invalidateEntity,
    updateCacheOptimistically,
    
    // WebSocket operations
    sendSyncMessage,
    subscribe,
    unsubscribe,
    
    // Utility functions
    clearPendingUpdates,
    getSyncStatus,
    
    // Error recovery and monitoring
    getErrorState,
    getPerformanceMetrics,
    resetErrorState,
    resetCircuitBreakers,
    getSystemHealth,
  };
};