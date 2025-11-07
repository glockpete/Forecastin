/**
 * State Management Utilities
 * Centralized utilities for hybrid state coordination
 * Implements cache coordination, optimistic updates, and error recovery
 * Following forecastin patterns for performance and reliability
 */

import type { QueryClient } from '@tanstack/react-query';
import type { Entity } from '../types';
import { hierarchyKeys } from '../hooks/useHierarchy';

// Cache coordination utilities
export class CacheCoordinator {
  private queryClient: QueryClient;
  private cacheMetrics: Map<string, { hits: number; misses: number; lastAccess: number }> = new Map();
  private performanceTargets = {
    cacheHitRate: 0.90, // 90% cache hit rate target
    queryResponseTime: 100, // 100ms response time target
    invalidationLatency: 50, // 50ms invalidation latency target
  };

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.initializeMetrics();
  }

  private initializeMetrics() {
    // Initialize metrics for all hierarchy query keys
    const allKeys = [
      ...hierarchyKeys.all,
      hierarchyKeys.root(),
      hierarchyKeys.node(''),
      hierarchyKeys.children('', 0),
      hierarchyKeys.breadcrumbs(''),
      hierarchyKeys.search(''),
      hierarchyKeys.entity('')
    ];

    allKeys.forEach(key => {
      this.cacheMetrics.set(JSON.stringify(key), {
        hits: 0,
        misses: 0,
        lastAccess: Date.now()
      });
    });
  }

  // Optimistic cache update with rollback capability
  optimisticUpdate<T>(
    queryKey: string[],
    updateFn: (currentData: T | undefined) => T,
    rollbackFn?: () => void
  ): { success: boolean; error?: Error } {
    try {
      // Track cache access for metrics
      this.trackCacheAccess(queryKey, true);
      
      const currentData = this.queryClient.getQueryData<T>(queryKey);
      const optimisticData = updateFn(currentData);
      
      // Apply optimistic update
      this.queryClient.setQueryData(queryKey, optimisticData);
      
      console.log('Optimistic update applied for:', queryKey);
      return { success: true };
      
    } catch (error) {
      console.error('Optimistic update failed:', error);
      
      // Rollback if function provided
      if (rollbackFn) {
        try {
          rollbackFn();
          console.log('Rollback completed for:', queryKey);
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      };
    }
  }

  // Smart cache invalidation based on entity changes
  invalidateEntityCache(entity: Entity, relatedEntities: Entity[] = []) {
    const invalidationKeys: readonly string[][] = [];
    
    // Primary entity cache
    const keys: string[][] = [...invalidationKeys];
    keys.push([...hierarchyKeys.entity(entity.id)]);
    
    // Parent hierarchy cache
    if (entity.path) {
      const pathParts = entity.path.split('/');
      const parentPath = pathParts.slice(0, -1).join('/');
      const depth = pathParts.length - 1;
      
      keys.push([...hierarchyKeys.children(parentPath, depth)] as string[]);
      keys.push([...hierarchyKeys.breadcrumbs(entity.path)] as string[]);
      
      // Ancestor caches
      for (let i = 0; i < pathParts.length - 1; i++) {
        const ancestorPath = pathParts.slice(0, i + 1).join('/');
        keys.push([...hierarchyKeys.children(ancestorPath, i)] as string[]);
      }
    }
    
    // Related entities cache
    relatedEntities.forEach(related => {
      keys.push([...hierarchyKeys.entity(related.id)]);
    });

    // Batch invalidation for performance
    this.batchInvalidate(keys);
  }

  // Batch cache invalidation with debouncing
  batchInvalidate(queryKeys: string[][], debounceMs = 100) {
    setTimeout(() => {
      queryKeys.forEach(key => {
        this.queryClient.invalidateQueries({ queryKey: key });
        this.trackCacheAccess(key, false); // Track invalidation
      });
      
      console.log(`Batch invalidated ${queryKeys.length} cache entries`);
    }, debounceMs);
  }

  // Cache performance monitoring
  trackCacheAccess(queryKey: string[], isHit: boolean) {
    const key = JSON.stringify(queryKey);
    const metrics = this.cacheMetrics.get(key) || { hits: 0, misses: 0, lastAccess: 0 };
    
    if (isHit) {
      metrics.hits++;
    } else {
      metrics.misses++;
    }
    
    metrics.lastAccess = Date.now();
    this.cacheMetrics.set(key, metrics);
  }

  // Get cache performance metrics
  getCacheMetrics() {
    const totalHits = Array.from(this.cacheMetrics.values()).reduce((sum, m) => sum + m.hits, 0);
    const totalMisses = Array.from(this.cacheMetrics.values()).reduce((sum, m) => sum + m.misses, 0);
    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;
    
    return {
      hitRate,
      totalHits,
      totalMisses,
      totalRequests: totalHits + totalMisses,
      isHealthy: hitRate >= this.performanceTargets.cacheHitRate,
      targetHitRate: this.performanceTargets.cacheHitRate
    };
  }

  // Preload related queries for better performance
  preloadRelatedQueries(entity: Entity) {
    const preloadKeys: string[][] = [];
    
    // Preload siblings if they exist
    if (entity.parentId) {
      // This would require additional API calls to get sibling data
      console.log('Preloading siblings for entity:', entity.id);
    }
    
    // Preload children if entity has children
    if (entity.hasChildren) {
      preloadKeys.push([...hierarchyKeys.children(entity.path, entity.pathDepth)] as string[]);
    }
    
    preloadKeys.forEach(key => {
      this.queryClient.prefetchQuery({
        queryKey: key,
        queryFn: () => Promise.resolve(null), // Placeholder - actual fetch would happen on demand
        staleTime: 2 * 60 * 1000, // 2 minutes
      });
    });
  }

  // Cache warming for critical paths
  warmCache(entities: Entity[]) {
    entities.forEach(entity => {
      // Warm entity cache
      this.queryClient.prefetchQuery({
        queryKey: [...hierarchyKeys.entity(entity.id)],
        queryFn: () => Promise.resolve(entity),
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
      
      // Warm breadcrumb cache
      if (entity.path) {
        this.queryClient.prefetchQuery({
          queryKey: [...hierarchyKeys.breadcrumbs(entity.path)],
          queryFn: () => Promise.resolve([]), // Placeholder
          staleTime: 10 * 60 * 1000, // 10 minutes
        });
      }
    });
    
    console.log(`Warmed cache for ${entities.length} entities`);
  }
}

// State synchronization utilities
export class StateSynchronizer {
  private updateQueue: Map<string, { timestamp: number; data: any }> = new Map();
  private maxQueueSize = 100;
  private processingDelay = 50; // ms

  // Queue state updates for batch processing
  queueUpdate(key: string, data: any) {
    this.updateQueue.set(key, {
      timestamp: Date.now(),
      data
    });

    // Limit queue size
    if (this.updateQueue.size > this.maxQueueSize) {
      const oldestKey = Array.from(this.updateQueue.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0][0];
      this.updateQueue.delete(oldestKey);
    }
  }

  // Process queued updates in batches
  async processQueue(processor: (updates: Map<string, any>) => Promise<void>) {
    if (this.updateQueue.size === 0) return;

    const updates = new Map(this.updateQueue);
    this.updateQueue.clear();

    try {
      await processor(updates);
      console.log(`Processed ${updates.size} queued updates`);
    } catch (error) {
      console.error('Error processing queued updates:', error);
      // Re-queue failed updates
      updates.forEach((value, key) => {
        this.updateQueue.set(key, value);
      });
    }
  }

  // Merge overlapping updates
  mergeUpdates(updates: Map<string, any>): Map<string, any> {
    const merged = new Map<string, any>();
    
    updates.forEach((update, key) => {
      if (merged.has(key)) {
        const existing = merged.get(key);
        merged.set(key, { ...existing, ...update });
      } else {
        merged.set(key, update);
      }
    });
    
    return merged;
  }
}

// Error recovery utilities
export class ErrorRecovery {
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second

  // Retry failed operations with exponential backoff
  async retryOperation<T>(
    operation: () => Promise<T>,
    key: string,
    context?: any
  ): Promise<T | null> {
    const attempts = this.retryAttempts.get(key) || 0;
    
    if (attempts >= this.maxRetries) {
      console.warn(`Max retries exceeded for operation: ${key}`);
      this.retryAttempts.delete(key);
      return null;
    }

    try {
      const result = await operation();
      this.retryAttempts.delete(key); // Success - clear retry count
      return result;
    } catch (error) {
      this.retryAttempts.set(key, attempts + 1);
      
      const delay = this.baseDelay * Math.pow(2, attempts);
      console.log(`Retry ${attempts + 1}/${this.maxRetries} for ${key} in ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryOperation(operation, key, context);
    }
  }

  // Circuit breaker for failing operations
  private circuitBreakers = new Map<string, { 
    failures: number; 
    lastFailure: number; 
    state: 'closed' | 'open' | 'half-open' 
  }>();

  checkCircuitBreaker(operationKey: string): boolean {
    const breaker = this.circuitBreakers.get(operationKey) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed'
    };

    const now = Date.now();
    const timeout = 60000; // 1 minute

    if (breaker.state === 'open') {
      if (now - breaker.lastFailure > timeout) {
        breaker.state = 'half-open';
        this.circuitBreakers.set(operationKey, breaker);
        return true; // Allow one trial request
      }
      return false; // Block requests
    }

    return true; // Allow requests in closed/half-open states
  }

  recordSuccess(operationKey: string) {
    const breaker = this.circuitBreakers.get(operationKey);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
      this.circuitBreakers.set(operationKey, breaker);
    }
  }

  recordFailure(operationKey: string) {
    const breaker = this.circuitBreakers.get(operationKey) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed'
    };

    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= 5) { // Open circuit after 5 failures
      breaker.state = 'open';
    }

    this.circuitBreakers.set(operationKey, breaker);
  }

  // Reset circuit breaker (for testing/debugging)
  resetCircuitBreaker(operationKey: string) {
    this.circuitBreakers.delete(operationKey);
  }
}

// State persistence utilities
export class StatePersistence {
  private readonly PREFIX = 'forecastin_state_';
  private readonly MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  // Save state to localStorage with TTL
  saveState(key: string, data: any) {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      localStorage.setItem(this.PREFIX + key, JSON.stringify(item));
      console.log('State saved:', key);
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  // Load state from localStorage with validation
  loadState<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(this.PREFIX + key);
      if (!item) return defaultValue;

      const parsed = JSON.parse(item);
      const now = Date.now();

      // Check expiration
      if (now - parsed.timestamp > this.MAX_AGE) {
        this.removeState(key);
        return defaultValue;
      }

      // Validate data structure
      if (parsed.data && typeof parsed.data === 'object') {
        return parsed.data as T;
      }

      return defaultValue;
    } catch (error) {
      console.error('Failed to load state:', error);
      this.removeState(key);
      return defaultValue;
    }
  }

  // Remove state from localStorage
  removeState(key: string) {
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch (error) {
      console.error('Failed to remove state:', error);
    }
  }

  // Clear all application state
  clearAllState() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log('All application state cleared');
    } catch (error) {
      console.error('Failed to clear state:', error);
    }
  }

  // Get state age for cache invalidation
  getStateAge(key: string): number {
    try {
      const item = localStorage.getItem(this.PREFIX + key);
      if (!item) return Infinity;

      const parsed = JSON.parse(item);
      return Date.now() - parsed.timestamp;
    } catch (error) {
      return Infinity;
    }
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  // Record performance metric
  recordMetric(name: string, value: number) {
    const values = this.metrics.get(name) || [];
    values.push(value);
    
    // Keep only recent values (last 100 measurements)
    if (values.length > 100) {
      values.shift();
    }
    
    this.metrics.set(name, values);
  }

  // Get performance statistics
  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  // Check if performance meets targets
  checkPerformance(name: string, target: number, tolerance = 0.1): boolean {
    const stats = this.getStats(name);
    if (!stats) return false;
    
    return stats.avg <= target * (1 + tolerance);
  }

  // Log performance summary
  logPerformanceSummary() {
    console.group('Performance Summary');
    
    this.metrics.forEach((values, name) => {
      const stats = this.getStats(name);
      if (stats) {
        console.log(`${name}:`, {
          avg: `${stats.avg.toFixed(2)}ms`,
          p95: `${stats.p95.toFixed(2)}ms`,
          p99: `${stats.p99.toFixed(2)}ms`,
          count: stats.count
        });
      }
    });
    
    console.groupEnd();
  }
}

// Utility functions
export const stateUtils = {
  // Generate cache key for entity path
  generateEntityPathKey(path: string): string {
    return `entity_${path.replace(/\//g, '_')}`;
  },

  // Check if data is stale based on timestamp
  isStale(timestamp: number, staleTime: number = 5 * 60 * 1000): boolean {
    return Date.now() - timestamp > staleTime;
  },

  // Deep merge objects
  deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    
    Object.keys(source).forEach((key: string) => {
      const sourceValue = source[key as keyof T];
      const targetValue = target[key as keyof T];
      
      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue) &&
          targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        (result as any)[key] = stateUtils.deepMerge(targetValue as Record<string, any>, sourceValue as Partial<Record<string, any>>);
      } else {
        (result as any)[key] = sourceValue;
      }
    });
    
    return result;
  },

  // Debounce function
  debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    let timeoutId: NodeJS.Timeout;
    
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    }) as T;
  },

  // Throttle function
  throttle<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    let lastCall = 0;
    
    return ((...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    }) as T;
  }
};

// Realtime performance monitoring (alias for backward compatibility)
export class RealtimePerformanceMonitor extends PerformanceMonitor {
  constructor() {
    super();
  }
}