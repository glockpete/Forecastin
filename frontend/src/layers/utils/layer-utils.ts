/**
 * Layer Utilities - Multi-tier caching and performance optimization
 * Following forecastin patterns with thread-safe LRU cache and Redis integration
 */

import { LayerConfig, LayerData, LayerPerformanceMetrics, LayerWebSocketMessage } from '../types/layer-types';
import { EventEmitter } from 'events';

// Thread-safe LRU Cache with RLock (following forecastin patterns)
class ThreadSafeLRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxSize: number;
  private accessCount = 0;
  private hitCount = 0;
  private missCount = 0;
  
  // RLock for thread safety (not standard Lock)
  private lock = new EventEmitter();
  private locked = false;
  private queue: (() => void)[] = [];

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  private async acquireLock(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  private releaseLock(): void {
    this.locked = false;
    const next = this.queue.shift();
    if (next) {
      this.locked = true;
      next();
    }
  }

  async get(key: K): Promise<V | undefined> {
    await this.acquireLock();
    try {
      const entry = this.cache.get(key);
      this.accessCount++;
      
      if (entry) {
        this.hitCount++;
        // Update timestamp for LRU
        entry.timestamp = Date.now();
        return entry.value;
      } else {
        this.missCount++;
        return undefined;
      }
    } finally {
      this.releaseLock();
    }
  }

  async set(key: K, value: V): Promise<void> {
    await this.acquireLock();
    try {
      const now = Date.now();
      
      // Evict if at capacity
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        this.evictLRU();
      }
      
      this.cache.set(key, { value, timestamp: now });
    } finally {
      this.releaseLock();
    }
  }

  async delete(key: K): Promise<boolean> {
    await this.acquireLock();
    try {
      return this.cache.delete(key);
    } finally {
      this.releaseLock();
    }
  }

  async clear(): Promise<void> {
    await this.acquireLock();
    try {
      this.cache.clear();
    } finally {
      this.releaseLock();
    }
  }

  private evictLRU(): void {
    let oldestKey: K | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitCount / this.accessCount,
      totalAccesses: this.accessCount,
      hits: this.hitCount,
      misses: this.missCount
    };
  }
}

// Multi-tier Cache Manager
class LayerCacheManager {
  private l1Cache: ThreadSafeLRUCache<string, any>;
  private l2Redis: Map<string, any>; // Placeholder for Redis integration
  private l3Database: Map<string, any>; // Placeholder for database cache
  private l4Materialized: Map<string, any>; // Placeholder for materialized view cache

  constructor() {
    this.l1Cache = new ThreadSafeLRUCache<string, any>(10000); // 10,000 entries as per rules
    this.l2Redis = new Map(); // Would integrate with Redis
    this.l3Database = new Map(); // Would integrate with PostgreSQL buffer cache
    this.l4Materialized = new Map(); // Would integrate with materialized views
  }

  async get(key: string): Promise<any> {
    // L1: Memory LRU Cache (fastest)
    const l1Result = await this.l1Cache.get(key);
    if (l1Result !== undefined) {
      return { value: l1Result, tier: 'L1', latency: 0.1 };
    }

    // L2: Redis Cache (shared across instances)
    const l2Result = this.l2Redis.get(key);
    if (l2Result) {
      await this.l1Cache.set(key, l2Result); // Populate L1
      return { value: l2Result, tier: 'L2', latency: 1.0 };
    }

    // L3: Database Buffer Cache
    const l3Result = this.l3Database.get(key);
    if (l3Result) {
      await this.l1Cache.set(key, l3Result);
      return { value: l3Result, tier: 'L3', latency: 5.0 };
    }

    // L4: Materialized Views (pre-computed)
    const l4Result = this.l4Materialized.get(key);
    if (l4Result) {
      await this.l1Cache.set(key, l4Result);
      return { value: l4Result, tier: 'L4', latency: 0.5 };
    }

    return { value: null, tier: 'MISS', latency: 0 };
  }

  async set(key: string, value: any, tiers: ('L1' | 'L2' | 'L3' | 'L4')[] = ['L1', 'L2']): Promise<void> {
    const promises: Promise<void>[] = [];

    if (tiers.includes('L1')) {
      promises.push(this.l1Cache.set(key, value));
    }
    if (tiers.includes('L2')) {
      // Would use Redis in production
      promises.push(Promise.resolve(this.l2Redis.set(key, value)).then(() => undefined));
    }
    if (tiers.includes('L3')) {
      // Would use PostgreSQL buffer cache in production
      promises.push(Promise.resolve(this.l3Database.set(key, value)).then(() => undefined));
    }
    if (tiers.includes('L4')) {
      // Would use materialized views in production
      promises.push(Promise.resolve(this.l4Materialized.set(key, value)).then(() => undefined));
    }

    await Promise.all(promises);
  }

  async invalidate(key: string): Promise<void> {
    await Promise.all([
      this.l1Cache.delete(key),
      Promise.resolve(this.l2Redis.delete(key)),
      Promise.resolve(this.l3Database.delete(key)),
      Promise.resolve(this.l4Materialized.delete(key))
    ]);
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.l1Cache.clear(),
      Promise.resolve(this.l2Redis.clear()),
      Promise.resolve(this.l3Database.clear()),
      Promise.resolve(this.l4Materialized.clear())
    ]);
  }

  getCacheStats() {
    return {
      L1: this.l1Cache.getStats(),
      L2: { size: this.l2Redis.size, type: 'redis' },
      L3: { size: this.l3Database.size, type: 'database_buffer' },
      L4: { size: this.l4Materialized.size, type: 'materialized_views' }
    };
  }
}

// Global cache manager instance
export const layerCacheManager = new LayerCacheManager();

// Layer Performance Monitor
export class LayerPerformanceMonitor {
  private metrics: Map<string, LayerPerformanceMetrics> = new Map();
  private monitoring = false;
  private intervals: NodeJS.Timeout[] = [];

  startMonitoring(): void {
    if (this.monitoring) return;

    this.monitoring = true;

    // Monitor every 30 seconds as per forecastin patterns
    const interval = setInterval(() => {
      this.collectMetrics();
    }, 30000);
    this.intervals.push(interval);

    // Monitor connection pool health
    const poolInterval = setInterval(() => {
      this.monitorConnectionPool();
    }, 30000);
    this.intervals.push(poolInterval);

    console.log('[LayerPerformanceMonitor] Started monitoring');
  }

  stopMonitoring(): void {
    this.monitoring = false;
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    console.log('[LayerPerformanceMonitor] Stopped monitoring');
  }

  recordMetric(layerId: string, operation: string, duration: number): void {
    const existing = this.metrics.get(layerId);
    
    if (!existing) {
      this.metrics.set(layerId, {
        layerId,
        renderTime: operation === 'render' ? duration : 0,
        dataSize: 0,
        memoryUsage: 0,
        cacheHitRate: 0,
        lastRenderTime: new Date().toISOString(),
        fps: operation === 'render' ? 1000 / duration : 0,
        sloCompliance: {
          targetResponseTime: 1.25,
          currentP95: 0,
          currentP99: 0,
          complianceRate: 100,
          violations: 0
        }
      });
    } else {
      if (operation === 'render') {
        existing.renderTime = duration;
        existing.fps = 1000 / duration;
        existing.lastRenderTime = new Date().toISOString();
      }
    }
  }

  private collectMetrics(): void {
    // This would integrate with the existing performance monitoring
    for (const [layerId, metrics] of this.metrics) {
      // Check if metrics meet SLO requirements
      if (metrics.renderTime > 10) { // Target <10ms
        console.warn(`[LayerPerformanceMonitor] Layer ${layerId} render time ${metrics.renderTime}ms exceeds SLO`);
      }
      if (metrics.cacheHitRate < 0.9) { // Target >90%
        console.warn(`[LayerPerformanceMonitor] Layer ${layerId} cache hit rate ${metrics.cacheHitRate} below target`);
      }
    }
  }

  private monitorConnectionPool(): void {
    // Following forecastin patterns for connection pool monitoring
    const utilization = Math.random() * 100; // Placeholder - would get actual utilization
    if (utilization > 80) {
      console.warn(`[LayerPerformanceMonitor] Connection pool utilization at ${utilization}% - warning threshold reached`);
    }
  }

  getMetrics(): Map<string, LayerPerformanceMetrics> {
    return new Map(this.metrics);
  }
}

// WebSocket Utilities following forecastin patterns
export class LayerWebSocketUtils {
  /**
   * Safe serialization following orjson pattern from forecastin
   */
  static safeSerialize(data: any): string {
    try {
      return JSON.stringify(data, (key, value) => {
        // Handle Date objects
        if (value instanceof Date) {
          return value.toISOString();
        }
        
        // Handle circular references
        if (value && typeof value === 'object') {
          const cache = new Set();
          return JSON.stringify(value, (k, v) => {
            if (typeof v === 'object' && v !== null) {
              if (cache.has(v)) return '[Circular]';
              cache.add(v);
            }
            return v;
          });
        }
        
        return value;
      });
    } catch (error) {
      throw new Error(`WebSocket serialization failed: ${error}`);
    }
  }

  /**
   * Create WebSocket message following forecastin patterns
   */
  static createWebSocketMessage(type: string, payload: any): LayerWebSocketMessage {
    return {
      type: type as any,
      payload: {
        ...payload,
        timestamp: new Date().toISOString()
      },
      safeSerialized: true
    };
  }

  /**
   * Batch multiple small updates into single message
   */
  static batchUpdates(updates: any[]): LayerWebSocketMessage {
    return this.createWebSocketMessage('layer_batch_update', {
      updates: updates,
      count: updates.length
    });
  }
}

// Layer Data Transformation Utilities
export class LayerDataTransform {
  /**
   * Transform raw data to layer format with hierarchy integration
   */
  static async transformToLayerData(
    rawData: any[], 
    options: {
      includeHierarchy?: boolean;
      confidenceThreshold?: number;
      cacheKey?: string;
    } = {}
  ): Promise<LayerData[]> {
    const startTime = performance.now();
    
    try {
      // Check cache first
      if (options.cacheKey) {
        const cached = await layerCacheManager.get(`transform:${options.cacheKey}`);
        if (cached) {
          return cached.value;
        }
      }

      const transformed = rawData.map((item, index) => {
        const layerData: LayerData = {
          id: item.id || `item_${index}`,
          geometry: item.geometry || null,
          properties: { ...item.properties },
          confidence: item.confidence || 0.0,
          source: item.source,
          timestamp: item.timestamp || new Date().toISOString(),
          entityId: item.entityId,
          hierarchy: options.includeHierarchy && item.entityId ? {
            ancestors: [], // Would be populated from navigation API
            descendants: [],
            path: `entity:${item.entityId}`,
            depth: 1
          } : undefined
        };

        return layerData;
      }).filter(item => {
        // Apply confidence threshold filter
        return !options.confidenceThreshold || (item.confidence || 0) >= options.confidenceThreshold;
      });

      // Cache the transformed data
      if (options.cacheKey) {
        await layerCacheManager.set(`transform:${options.cacheKey}`, transformed);
      }

      return transformed;
    } finally {
      // Performance tracking would happen here
      const duration = performance.now() - startTime;
      // Would call layerPerformanceMonitor.recordLayerRender if available
    }
  }

  /**
   * Apply visual channel transformations
   */
  static applyVisualChannel(data: LayerData[], channelConfig: any): LayerData[] {
    return data.map(item => ({
      ...item,
      properties: {
        ...item.properties,
        // Apply visual channel transformations
        [`_${channelConfig.name}`]: this.calculateChannelValue(item, channelConfig)
      }
    }));
  }

  private static calculateChannelValue(item: LayerData, channelConfig: any): any {
    const value = item.properties[channelConfig.property];
    if (value === undefined || value === null) {
      return channelConfig.defaultValue;
    }

    // Apply scaling
    if (channelConfig.scale && typeof value === 'number') {
      const [domainMin, domainMax] = channelConfig.scale.domain;
      const [rangeMin, rangeMax] = channelConfig.scale.range;
      const normalized = (value - domainMin) / (domainMax - domainMin);
      return rangeMin + normalized * (rangeMax - rangeMin);
    }

    return value;
  }
}

// Feature Flag Integration Utilities
export class LayerFeatureFlagUtils {
  private static featureFlags: Map<string, boolean> = new Map();

  static async checkFeatureFlag(flagName: string): Promise<boolean> {
    // Integration with forecastin feature flag service
    // This would call the actual service in production
    return this.featureFlags.get(flagName) ?? true;
  }

  static async checkLayerTypeEnabled(layerType: string): Promise<boolean> {
    const flagName = `ff.layer.${layerType}`;
    return this.checkFeatureFlag(flagName);
  }

  static async checkRolloutPercentage(flagName: string): Promise<boolean> {
    // Implement rollout percentage logic
    const userId = this.getCurrentUserId();
    const hash = this.hashString(userId + flagName);
    const percentage = hash % 100;
    
    // Would get actual rollout percentage from feature flag service
    const rolloutPercentage = 75; // Default for now
    
    return percentage < rolloutPercentage;
  }

  private static getCurrentUserId(): string {
    // Would integrate with forecastin auth system
    return 'anonymous';
  }

  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Point Layer specific utilities
export function createPointLayerConfig(config: any): any {
  return {
    ...config,
    cacheEnabled: config.cacheEnabled !== false,
    cacheTTL: config.cacheTTL || 30000,
    auditEnabled: config.auditEnabled !== false,
    dataClassification: config.dataClassification || 'internal',
    realTimeEnabled: config.realTimeEnabled || false
  };
}

export function validatePointData(entity: any, entityDataMapping: any): boolean {
  try {
    // Check required fields
    const { positionField, colorField, entityIdField } = entityDataMapping;
    
    if (!entity[positionField]) return false;
    if (!entity[colorField]) return false;
    if (!entity[entityIdField]) return false;
    
    // Validate position coordinates
    const position = entity[positionField];
    if (!Array.isArray(position) || position.length < 2) return false;
    if (typeof position[0] !== 'number' || typeof position[1] !== 'number') return false;
    
    return true;
  } catch (error) {
    return false;
  }
}

// Export default utilities
export const layerUtils = {
  cache: layerCacheManager,
  performance: new LayerPerformanceMonitor(),
  websocket: LayerWebSocketUtils,
  transform: LayerDataTransform,
  featureFlags: LayerFeatureFlagUtils,
  pointLayer: {
    createConfig: createPointLayerConfig,
    validateData: validatePointData
  }
};

export default layerUtils;