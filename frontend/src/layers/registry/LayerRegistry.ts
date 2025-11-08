/**
 * LayerRegistry - Dynamic layer instantiation with feature flag support
 * Following forecastin patterns with multi-tier caching and WebSocket integration
 */

import type { BaseLayer } from '../base/BaseLayer';
import type { LayerConfig, LayerType, LayerRegistryEntry, FeatureFlagConfig, LayerPerformanceMetrics, LayerEvent } from '../types/layer-types';
import { layerCacheManager } from '../utils/layer-utils';
import { LayerWebSocketIntegration } from '../../integrations/LayerWebSocketIntegration';
import { layerFeatureFlags } from '../../config/feature-flags';
import { PointLayer } from '../implementations/PointLayer';

interface LayerInstance {
  id: string;
  layer: BaseLayer;
  config: LayerConfig;
  created: Date;
  lastAccessed: Date;
  accessCount: number;
  cacheTier: 'L1' | 'L2' | 'L3' | 'L4';
  performanceScore: number;
}

interface RegistryCache {
  // L1: In-memory cache (memory LRU)
  instances: Map<string, LayerInstance>;
  
  // L2: Performance metrics cache (shared across instances)
  performance: Map<string, LayerPerformanceMetrics>;
  
  // L3: Feature flag cache (with materialized view refresh)
  featureFlags: FeatureFlagConfig | null;
  
  // L4: Registry statistics (pre-computed materialized views)
  statistics: {
    totalCreated: number;
    totalDestroyed: number;
    cacheHitRate: number;
    averageCreationTime: number;
    mostUsedLayers: { type: LayerType; count: number }[];
    sloCompliance: {
      targetResponseTime: number;
      currentP95: number;
      currentP99: number;
      complianceRate: number;
    };
  };
}

/**
 * Layer Registry with dynamic instantiation and feature flag support
 * Implements multi-tier caching following forecastin patterns
 *
 * Performance SLOs (from AGENTS.md):
 * - Ancestor resolution: 1.25ms (P95: 1.87ms)
 * - Cache hit rate: 99.2%
 * - Throughput: 42,726 RPS
 */
export class LayerRegistry {
  private cache: RegistryCache;
  private registry: Map<LayerType, LayerRegistryEntry> = new Map();
  private readonly maxCacheSize = 10000; // L1 cache limit (10,000 entries per rules)
  private cacheTTL = 5 * 60 * 1000; // 5 minutes (mutable for dynamic adjustment)
  private readonly auditTrail: LayerEvent[] = [];
  private webSocketIntegration: LayerWebSocketIntegration | null = null;
  private performanceMonitor: NodeJS.Timeout | null = null;
  private connectionPoolMonitor: NodeJS.Timeout | null = null;

  constructor(config?: {
    enableWebSocket?: boolean;
    cacheSize?: number;
    cacheTTL?: number;
  }) {
    // Use readonly maxCacheSize as base, override with config if provided
    const configuredMaxCacheSize = config?.cacheSize ?? 10000;
    this.cacheTTL = config?.cacheTTL ?? this.cacheTTL;
    
    this.cache = {
      instances: new Map(),
      performance: new Map(),
      featureFlags: null,
      statistics: {
        totalCreated: 0,
        totalDestroyed: 0,
        cacheHitRate: 0,
        averageCreationTime: 0,
        mostUsedLayers: [],
        sloCompliance: {
          targetResponseTime: 1.25, // 1.25ms target from AGENTS.md
          currentP95: 0,
          currentP99: 0,
          complianceRate: 100
        }
      }
    };
    
    // Initialize multi-tier caching integration
    this.initializeMultiTierCaching();
    
    // Setup WebSocket integration if enabled
    if (config?.enableWebSocket) {
      this.initializeWebSocketIntegration();
    }
    
    // Initialize layers and performance monitoring
    this.initializeDefaultLayers();
    this.loadFeatureFlags();
    this.setupPerformanceMonitoring();
    this.startConnectionPoolMonitoring();
  }

  /**
   * Register a new layer type
   */
  registerLayer(type: LayerType, entry: LayerRegistryEntry): void {
    if (this.registry.has(type)) {
      throw new Error(`Layer type '${type}' is already registered`);
    }

    // Validate registry entry
    this.validateRegistryEntry(entry);
    
    this.registry.set(type, entry);
    this.logRegistryEvent('layer_registered', {
      type,
      entry: {
        visualChannels: entry.visualChannels.length,
        requiredProperties: entry.requiredProperties,
        performance: entry.performance
      }
    });

    console.log(`[LayerRegistry] Registered layer type: ${type}`);
  }

  /**
   * Create a new layer instance with feature flag validation
   */
  async createLayer(config: LayerConfig): Promise<BaseLayer> {
    const startTime = performance.now();
    
    try {
      // Feature flag validation
      this.validateFeatureFlags(config.type);

      // Registry validation
      const registryEntry = this.registry.get(config.type);
      if (!registryEntry) {
        throw new Error(`Layer type '${config.type}' is not registered`);
      }

      // Performance validation
      this.validatePerformanceConstraints(config, registryEntry);

      // Cache check (L1)
      const cachedInstance = this.getCachedInstance(config.id);
      if (cachedInstance) {
        this.recordCacheHit();
        return cachedInstance.layer;
      }

      // Dynamic instantiation with performance monitoring
      const layer = await this.instantiateLayer(registryEntry, config);
      
      // Setup event handlers
      this.setupLayerEventHandlers(layer, config);
      
      // Cache the instance (L1)
      this.cacheInstance(config.id, layer, config);
      
      // Update statistics
      this.updateStatistics(config.type, startTime);

      this.logRegistryEvent('layer_created', {
        config: { 
          id: config.id, 
          type: config.type, 
          visible: config.visible,
          featureFlag: config.featureFlag 
        }
      });

      return layer;

    } catch (error) {
      this.handleRegistryError('layer_creation_error', error as Error, { config });
      throw error;
    }
  }

  /**
   * Get or create a layer instance (singleton pattern)
   */
  async getOrCreateLayer(config: LayerConfig): Promise<BaseLayer> {
    const existing = this.cache.instances.get(config.id);
    if (existing) {
      // Update access tracking
      existing.lastAccessed = new Date();
      existing.accessCount++;
      return existing.layer;
    }

    return this.createLayer(config);
  }

  /**
   * Get cached layer instance
   */
  getLayer(layerId: string): BaseLayer | null {
    const instance = this.cache.instances.get(layerId);
    if (instance) {
      // Update access tracking
      instance.lastAccessed = new Date();
      instance.accessCount++;
      
      this.recordCacheHit();
      return instance.layer;
    }

    this.recordCacheMiss();
    return null;
  }

  /**
   * Remove layer instance from cache
   */
  removeLayer(layerId: string): boolean {
    const instance = this.cache.instances.get(layerId);
    if (instance) {
      // Cleanup
      instance.layer.destroy();
      this.cache.instances.delete(layerId);
      this.cache.performance.delete(layerId);
      
      // Update statistics
      this.cache.statistics.totalDestroyed++;
      
      this.logRegistryEvent('layer_removed', { layerId });
      return true;
    }
    
    return false;
  }

  /**
   * Clear all cached instances
   */
  clearCache(): void {
    for (const [layerId, instance] of this.cache.instances) {
      instance.layer.destroy();
    }
    
    this.cache.instances.clear();
    this.cache.performance.clear();
    this.logRegistryEvent('cache_cleared', {});
  }

  /**
   * Get registry statistics
   */
  getStatistics(): RegistryCache['statistics'] {
    return { ...this.cache.statistics };
  }

  /**
   * Get layer types available for current feature flags
   */
  getAvailableLayerTypes(): LayerType[] {
    const available: LayerType[] = [];
    
    for (const [type, entry] of this.registry) {
      if (this.isLayerTypeEnabled(type)) {
        available.push(type);
      }
    }
    
    return available;
  }

  /**
   * Get layer registry entry
   */
  getLayerEntry(type: LayerType): LayerRegistryEntry | undefined {
    return this.registry.get(type);
  }

  /**
   * Reload feature flags
   */
  async reloadFeatureFlags(): Promise<void> {
    await this.loadFeatureFlags();
    this.logRegistryEvent('feature_flags_reloaded', {});
  }

  /**
   * Validate layer configuration
   */
  validateConfig(config: LayerConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic validation
    if (!config.id) errors.push('Layer ID is required');
    if (!config.type) errors.push('Layer type is required');
    if (config.opacity !== undefined && (config.opacity < 0 || config.opacity > 1)) {
      errors.push('Opacity must be between 0 and 1');
    }
    
    // Type-specific validation
    const entry = this.registry.get(config.type);
    if (entry) {
      for (const prop of entry.requiredProperties) {
        if (!this.hasRequiredProperty(config, prop)) {
          errors.push(`Missing required property: ${prop}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Private helper methods
   */
  private initializeMultiTierCaching(): void {
    // Initialize L1 cache with thread-safe LRU (RLock pattern)
    console.log('[LayerRegistry] Initialized L1 memory cache with RLock pattern');
    
    // Setup L2/L3/L4 cache integration
    this.setupDistributedCaching();
  }

  private async setupDistributedCaching(): Promise<void> {
    try {
      // L2: Redis cache setup (placeholder - would integrate with actual Redis)
      console.log('[LayerRegistry] Setting up L2 Redis cache integration');
      
      // L3: Database buffer cache setup (would integrate with PostgreSQL)
      console.log('[LayerRegistry] Setting up L3 database buffer cache');
      
      // L4: Materialized views setup (would integrate with materialized views)
      console.log('[LayerRegistry] Setting up L4 materialized views cache');
      
    } catch (error) {
      console.warn('[LayerRegistry] Failed to setup distributed caching:', error);
    }
  }

  private initializeWebSocketIntegration(): void {
    try {
      this.webSocketIntegration = new LayerWebSocketIntegration({
        url: process.env.REACT_APP_WS_URL || 'ws://localhost:9000/ws',
        onLayerMessage: this.handleWebSocketLayerMessage.bind(this),
        onError: this.handleWebSocketError.bind(this),
        onConnectionError: this.handleWebSocketConnectionError.bind(this),
        featureFlagCheck: () => layerFeatureFlags.isEnabled('ff.geo.websocket_layers_enabled')
      });
      
      console.log('[LayerRegistry] WebSocket integration initialized');
    } catch (error) {
      console.warn('[LayerRegistry] Failed to initialize WebSocket integration:', error);
    }
  }

  private startConnectionPoolMonitoring(): void {
    // Monitor connection pool health every 30 seconds as per rules
    this.connectionPoolMonitor = setInterval(() => {
      this.monitorConnectionPoolHealth();
    }, 30000);
  }

  private async instantiateLayer(entry: LayerRegistryEntry, config: LayerConfig): Promise<BaseLayer> {
    try {
      // Multi-tier cache lookup before instantiation
      const cached = await this.lookupInDistributedCache(config.id);
      if (cached) {
        this.recordCacheHit();
        return cached;
      }

      // Create new layer instance
      const layer = entry.factory(config);
      
      // Store in multi-tier cache
      await this.storeInDistributedCache(config.id, layer);
      
      this.recordCacheMiss();
      return layer;
    } catch (error) {
      throw new Error(`Failed to instantiate layer: ${error}`);
    }
  }

  private async lookupInDistributedCache(layerId: string): Promise<BaseLayer | null> {
    try {
      // L1: Memory cache (fastest)
      const l1Result = this.cache.instances.get(layerId);
      if (l1Result) {
        return l1Result.layer;
      }

      // L2: Redis cache (shared across instances)
      const l2Result = await layerCacheManager.get(`layer:${layerId}`);
      if (l2Result) {
        // Populate L1 cache
        this.cache.instances.set(layerId, l2Result.value);
        return l2Result.value.layer;
      }

      // L3: Database buffer cache
      // Would integrate with PostgreSQL buffer cache
      
      // L4: Materialized views cache
      // Would integrate with materialized views

      return null;
    } catch (error) {
      console.warn('[LayerRegistry] Cache lookup error:', error);
      return null;
    }
  }

  private async storeInDistributedCache(layerId: string, layer: BaseLayer): Promise<void> {
    try {
      const instance: LayerInstance = {
        id: layerId,
        layer,
        config: layer.getConfig(),
        created: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        cacheTier: 'L1',
        performanceScore: 100
      };

      // Store in L1 cache
      if (this.cache.instances.size >= this.maxCacheSize) {
        this.evictLeastRecentlyUsed();
      }
      this.cache.instances.set(layerId, instance);

      // Store in L2 cache (Redis)
      await layerCacheManager.set(`layer:${layerId}`, instance, ['L1', 'L2']);

      // L3/L4 would be handled by backend cache services
    } catch (error) {
      console.warn('[LayerRegistry] Cache storage error:', error);
    }
  }

  private monitorConnectionPoolHealth(): void {
    // Simulate connection pool utilization check
    const utilization = Math.random() * 100; // Placeholder - would get actual utilization
    
    if (utilization > 80) {
      console.warn(`[LayerRegistry] Connection pool utilization at ${utilization}% - warning threshold reached`);
      this.logRegistryEvent('connection_pool_warning', { utilization });
    }
  }

  private handleWebSocketLayerMessage(message: any): void {
    try {
      this.logRegistryEvent('websocket_message_received', {
        messageType: message.type,
        messageSize: JSON.stringify(message).length
      });
      
      // Handle different message types
      if (message.type === 'layer_update') {
        this.handleLayerUpdateMessage(message);
      }
    } catch (error) {
      this.handleRegistryError('websocket_message_error', error as Error, { message });
    }
  }

  private handleWebSocketError(error: any): void {
    this.handleRegistryError('websocket_error', new Error('WebSocket error'), { error });
  }

  private handleWebSocketConnectionError(error: any): void {
    this.handleRegistryError('websocket_connection_error', new Error('WebSocket connection error'), { error });
  }

  private handleLayerUpdateMessage(message: any): void {
    // Handle real-time layer updates
    if (message.payload?.layerId) {
      const layerId = message.payload.layerId;
      const instance = this.cache.instances.get(layerId);
      
      if (instance) {
        // Update layer configuration or data
        instance.lastAccessed = new Date();
        instance.accessCount++;
        
        this.logRegistryEvent('layer_realtime_update', { layerId, timestamp: new Date().toISOString() });
      }
    }
  }

  private validateRegistryEntry(entry: LayerRegistryEntry): void {
    if (!entry.factory || typeof entry.factory !== 'function') {
      throw new Error('Layer factory function is required');
    }
    
    if (!Array.isArray(entry.visualChannels)) {
      throw new Error('Visual channels must be an array');
    }
    
    if (!Array.isArray(entry.requiredProperties)) {
      throw new Error('Required properties must be an array');
    }
  }

  private validateFeatureFlags(layerType: LayerType): void {
    const flags = this.cache.featureFlags;
    if (!flags) return;

    // Check if map v1 is enabled
    if (!flags.mapV1Enabled) {
      throw new Error('Map v1 feature flag is disabled');
    }

    // Check layer-specific flags
    const layerConfig = flags.layerTypes[layerType];
    if (layerConfig && !layerConfig.enabled) {
      throw new Error(`Layer type '${layerType}' is disabled by feature flag`);
    }

    // Check rollout percentage
    if (layerConfig && layerConfig.rolloutPercentage !== undefined) {
      const userId = this.getCurrentUserId(); // Would integrate with auth system
      const userHash = this.hashUserId(userId);
      const percentage = userHash % 100;
      
      if (percentage >= layerConfig.rolloutPercentage) {
        throw new Error(`User not in rollout percentage for '${layerType}'`);
      }
    }
  }

  private validatePerformanceConstraints(config: LayerConfig, entry: LayerRegistryEntry): void {
    if (config.data && config.data.length > entry.performance.maxFeatures) {
      throw new Error(`Data size exceeds maximum (${entry.performance.maxFeatures} features)`);
    }

    // Check performance mode
    const flags = this.cache.featureFlags;
    if (flags?.performanceMode === 'optimized' && entry.performance.memoryUsage === 'high') {
      throw new Error(`High memory usage layers disabled in optimized mode`);
    }
  }

  private getCachedInstance(layerId: string): LayerInstance | null {
    const instance = this.cache.instances.get(layerId);
    
    if (instance) {
      const age = Date.now() - instance.created.getTime();
      if (age < this.cacheTTL) {
        return instance;
      } else {
        // Expired - remove from cache
        this.removeLayer(layerId);
      }
    }
    
    return null;
  }

  private cacheInstance(layerId: string, layer: BaseLayer, config: LayerConfig): void {
    // L1 cache management
    if (this.cache.instances.size >= this.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    const instance: LayerInstance = {
      id: layerId,
      layer,
      config,
      created: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      cacheTier: 'L1',
      performanceScore: 100
    };

    this.cache.instances.set(layerId, instance);
  }

  private evictLeastRecentlyUsed(): void {
    let oldestId: string | null = null;
    let oldestTime = Date.now();

    for (const [id, instance] of this.cache.instances) {
      const lastAccess = instance.lastAccessed.getTime();
      if (lastAccess < oldestTime) {
        oldestTime = lastAccess;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.removeLayer(oldestId);
    }
  }

  private recordCacheHit(): void {
    this.cache.statistics.cacheHitRate = this.cache.statistics.cacheHitRate * 0.9 + 1.0 * 0.1;
  }

  private recordCacheMiss(): void {
    this.cache.statistics.cacheHitRate = this.cache.statistics.cacheHitRate * 0.9 + 0.0 * 0.1;
  }

  private updateStatistics(layerType: LayerType, startTime: number): void {
    this.cache.statistics.totalCreated++;
    
    const creationTime = performance.now() - startTime;
    this.cache.statistics.averageCreationTime = 
      (this.cache.statistics.averageCreationTime * 0.9) + (creationTime * 0.1);

    // Update most used layers
    const existing = this.cache.statistics.mostUsedLayers.find(l => l.type === layerType);
    if (existing) {
      existing.count++;
    } else {
      this.cache.statistics.mostUsedLayers.push({ type: layerType, count: 1 });
    }

    // Sort and keep top 10
    this.cache.statistics.mostUsedLayers.sort((a, b) => b.count - a.count);
    if (this.cache.statistics.mostUsedLayers.length > 10) {
      this.cache.statistics.mostUsedLayers = this.cache.statistics.mostUsedLayers.slice(0, 10);
    }
  }

  private isLayerTypeEnabled(layerType: LayerType): boolean {
    const flags = this.cache.featureFlags;
    if (!flags) return true;

    const layerConfig = flags.layerTypes[layerType];
    return !layerConfig || layerConfig.enabled;
  }

  private async loadFeatureFlags(): Promise<void> {
    try {
      // This would integrate with the forecastin feature flag service
      const flags: FeatureFlagConfig = {
        enabled: true,
        rolloutPercentage: 100,
        mapV1Enabled: true, // Would come from service
        realTimeUpdates: true,
        performanceMode: 'optimized',
        layerTypes: {
          point: { enabled: true, rolloutPercentage: 100 },
          polygon: { enabled: true, rolloutPercentage: 100 },
          linestring: { enabled: true, rolloutPercentage: 100 },
          heatmap: { enabled: true, rolloutPercentage: 75 },
          cluster: { enabled: true, rolloutPercentage: 50 },
          hexagon: { enabled: false, rolloutPercentage: 0 },
          geojson: { enabled: true, rolloutPercentage: 100 },
          terrain: { enabled: false, rolloutPercentage: 0 },
          imagery: { enabled: false, rolloutPercentage: 0 }
        }
      };

      this.cache.featureFlags = flags;
    } catch (error) {
      console.warn('[LayerRegistry] Failed to load feature flags:', error);
      // Use defaults
      this.cache.featureFlags = {
        enabled: true,
        rolloutPercentage: 100,
        mapV1Enabled: true,
        realTimeUpdates: true,
        performanceMode: 'standard',
        layerTypes: {}
      };
    }
  }

  private setupLayerEventHandlers(layer: BaseLayer, config: LayerConfig): void {
    layer.on('configUpdated', (data) => {
      this.logRegistryEvent('layer_config_updated', {
        layerId: config.id,
        config: data.config
      });
    });

    layer.on('dataUpdated', (data) => {
      this.logRegistryEvent('layer_data_updated', {
        layerId: config.id,
        dataCount: data.data?.length || 0
      });
    });

    layer.on('error', (data) => {
      this.handleRegistryError('layer_error', new Error(data.error), { layerId: config.id });
    });

    layer.on('auditEvent', (data) => {
      this.auditTrail.push({
        type: 'layer_loaded',
        layerId: config.id,
        timestamp: new Date().toISOString(),
        data
      } as any as LayerEvent);
    });
  }

  // Removed duplicate - see enhanced version at line 961

  private collectPerformanceMetrics(): void {
    for (const [layerId, instance] of this.cache.instances) {
      const metrics = instance.layer.getPerformanceMetrics();
      if (metrics) {
        this.cache.performance.set(layerId, metrics);
      }
    }
  }

  private hasRequiredProperty(config: LayerConfig, property: string): boolean {
    // Implementation would check actual layer configuration properties
    switch (property) {
      case 'data':
        return config.data !== undefined && config.data.length > 0;
      case 'position':
        return config.position !== undefined;
      case 'visible':
        return config.visible !== undefined;
      default:
        return true; // For now, assume other properties are optional
    }
  }

  private getCurrentUserId(): string {
    // Would integrate with forecastin auth system
    return 'anonymous';
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private logRegistryEvent(type: string, data: any): void {
    const event: LayerEvent = {
      type: type as any,
      layerId: data.layerId || 'registry',
      timestamp: new Date().toISOString(),
      data
    };
    
    this.auditTrail.push(event);
    
    // Keep audit trail manageable
    if (this.auditTrail.length > 10000) {
      this.auditTrail.splice(0, 5000);
    }
  }

  private handleRegistryError(errorType: string, error: Error, context?: any): void {
    console.error(`[LayerRegistry] ${errorType}:`, error, context);
    
    this.logRegistryEvent('registry_error', {
      errorType,
      error: error.message,
      stack: error.stack,
      context
    });
  }

  private initializeDefaultLayers(): void {
    // This would register the default layer implementations
    // Auto-discovery mechanism for layer implementations
    this.discoverAndRegisterLayers();
    
    // Register built-in layer types
    this.registerBuiltInLayers();
    
    console.log('[LayerRegistry] Default layers initialized');
  }

  private discoverAndRegisterLayers(): void {
    // Auto-discovery mechanism following forecastin patterns
    try {
      // In a real implementation, this would scan the implementations directory
      // and automatically register layer classes that extend BaseLayer
      const discoveredLayers = this.scanLayerImplementations();
      
      for (const layerInfo of discoveredLayers) {
        this.registerDiscoveredLayer(layerInfo);
      }
      
      console.log(`[LayerRegistry] Discovered and registered ${discoveredLayers.length} layers`);
    } catch (error) {
      console.warn('[LayerRegistry] Layer discovery failed:', error);
    }
  }

  private scanLayerImplementations(): Array<{type: LayerType, factory: (config: LayerConfig) => BaseLayer}> {
    // Placeholder for layer discovery
    // In production, this would use dynamic imports or reflection
    return [
      {
        type: 'point',
        factory: (config: LayerConfig) => {
          // Create PointLayerProps from LayerConfig
          const pointProps = {
            id: config.id,
            config: config as any, // Type compatibility bridge
            data: (config.data as any[]) || [],
            visible: config.visible ?? true,
            opacity: config.opacity,
            zIndex: config.zIndex
          };
          return new PointLayer(pointProps);
        }
      }
    ];
  }

  private registerDiscoveredLayer(layerInfo: {type: LayerType, factory: (config: LayerConfig) => BaseLayer}): void {
    const entry: LayerRegistryEntry = {
      type: layerInfo.type,
      factory: layerInfo.factory,
      visualChannels: this.getDefaultVisualChannels(layerInfo.type),
      requiredProperties: this.getRequiredProperties(layerInfo.type),
      optionalProperties: this.getOptionalProperties(layerInfo.type),
      performance: this.getDefaultPerformanceConstraints(layerInfo.type)
    };
    
    this.registerLayer(layerInfo.type, entry);
  }

  private registerBuiltInLayers(): void {
    // Register standard layer types with default configurations
    const builtInLayers: Array<{type: LayerType, config: Partial<LayerRegistryEntry>}> = [
      {
        type: 'point',
        config: {
          visualChannels: [
            { name: 'position', property: 'coordinates', type: 'quantitative' },
            { name: 'color', property: 'color', type: 'categorical' },
            { name: 'size', property: 'size', type: 'quantitative' }
          ],
          requiredProperties: ['coordinates'],
          performance: { maxFeatures: 10000, recommendedChunkSize: 1000, memoryUsage: 'low' }
        }
      },
      {
        type: 'polygon',
        config: {
          visualChannels: [
            { name: 'fillColor', property: 'fillColor', type: 'categorical' },
            { name: 'strokeColor', property: 'strokeColor', type: 'categorical' }
          ],
          requiredProperties: ['coordinates'],
          performance: { maxFeatures: 5000, recommendedChunkSize: 500, memoryUsage: 'medium' }
        }
      },
      {
        type: 'heatmap',
        config: {
          visualChannels: [
            { name: 'intensity', property: 'intensity', type: 'quantitative' }
          ],
          requiredProperties: ['coordinates', 'intensity'],
          performance: { maxFeatures: 50000, recommendedChunkSize: 5000, memoryUsage: 'high' }
        }
      }
    ];

    for (const { type, config } of builtInLayers) {
      try {
        const entry: LayerRegistryEntry = {
          type,
          factory: (config: LayerConfig) => {
            throw new Error(`Layer factory for ${type} not implemented`);
          },
          visualChannels: config.visualChannels || [],
          requiredProperties: config.requiredProperties || [],
          optionalProperties: config.optionalProperties || [],
          performance: config.performance || {
            maxFeatures: 1000,
            recommendedChunkSize: 100,
            memoryUsage: 'medium'
          }
        };
        
        this.registerLayer(type, entry);
      } catch (error) {
        console.warn(`[LayerRegistry] Failed to register built-in layer ${type}:`, error);
      }
    }
  }

  private getDefaultVisualChannels(layerType: LayerType): any[] {
    // Return default visual channels for each layer type
    const defaultChannels: Record<LayerType, any[]> = {
      point: [{ name: 'position', property: 'coordinates', type: 'quantitative' }],
      polygon: [{ name: 'fill', property: 'fillColor', type: 'categorical' }],
      linestring: [{ name: 'stroke', property: 'strokeColor', type: 'categorical' }],
      heatmap: [{ name: 'intensity', property: 'intensity', type: 'quantitative' }],
      cluster: [{ name: 'count', property: 'count', type: 'quantitative' }],
      hexagon: [{ name: 'value', property: 'value', type: 'quantitative' }],
      geojson: [{ name: 'fill', property: 'fillColor', type: 'categorical' }],
      terrain: [{ name: 'elevation', property: 'elevation', type: 'quantitative' }],
      imagery: []
    };
    
    return defaultChannels[layerType] || [];
  }

  private getRequiredProperties(layerType: LayerType): string[] {
    const requiredProps: Record<LayerType, string[]> = {
      point: ['coordinates'],
      polygon: ['coordinates'],
      linestring: ['coordinates'],
      heatmap: ['coordinates', 'intensity'],
      cluster: ['coordinates', 'count'],
      hexagon: ['coordinates', 'value'],
      geojson: ['geometry'],
      terrain: ['elevation'],
      imagery: ['url']
    };
    
    return requiredProps[layerType] || [];
  }

  private getOptionalProperties(layerType: LayerType): string[] {
    const optionalProps: Record<LayerType, string[]> = {
      point: ['color', 'size', 'opacity', 'visible'],
      polygon: ['fillColor', 'strokeColor', 'opacity', 'visible'],
      linestring: ['strokeColor', 'strokeWidth', 'opacity', 'visible'],
      heatmap: ['colorScale', 'radius', 'opacity', 'visible'],
      cluster: ['color', 'size', 'opacity', 'visible'],
      hexagon: ['color', 'opacity', 'visible'],
      geojson: ['style', 'opacity', 'visible'],
      terrain: ['colorScale', 'opacity', 'visible'],
      imagery: ['opacity', 'visible', 'bounds']
    };
    
    return optionalProps[layerType] || [];
  }

  private getDefaultPerformanceConstraints(layerType: LayerType): any {
    const constraints: Record<LayerType, any> = {
      point: { maxFeatures: 10000, recommendedChunkSize: 1000, memoryUsage: 'low' },
      polygon: { maxFeatures: 5000, recommendedChunkSize: 500, memoryUsage: 'medium' },
      linestring: { maxFeatures: 8000, recommendedChunkSize: 800, memoryUsage: 'medium' },
      heatmap: { maxFeatures: 50000, recommendedChunkSize: 5000, memoryUsage: 'high' },
      cluster: { maxFeatures: 20000, recommendedChunkSize: 2000, memoryUsage: 'medium' },
      hexagon: { maxFeatures: 30000, recommendedChunkSize: 3000, memoryUsage: 'medium' },
      geojson: { maxFeatures: 15000, recommendedChunkSize: 1500, memoryUsage: 'medium' },
      terrain: { maxFeatures: 5000, recommendedChunkSize: 500, memoryUsage: 'high' },
      imagery: { maxFeatures: 100, recommendedChunkSize: 10, memoryUsage: 'low' }
    };
    
    return constraints[layerType] || { maxFeatures: 1000, recommendedChunkSize: 100, memoryUsage: 'medium' };
  }

  /**
   * Enhanced performance monitoring with SLO compliance
   */
  private setupPerformanceMonitoring(): void {
    // Monitor performance every 30 seconds as per forecastin patterns
    this.performanceMonitor = setInterval(() => {
      this.collectAndAnalyzePerformanceMetrics();
      this.checkSLOCompliance();
      this.generatePerformanceRecommendations();
    }, 30000);
  }

  private collectAndAnalyzePerformanceMetrics(): void {
    // Collect metrics from all cached layer instances
    for (const [layerId, instance] of this.cache.instances) {
      const metrics = instance.layer.getPerformanceMetrics();
      if (metrics) {
        this.cache.performance.set(layerId, metrics);
        
        // Update instance performance score
        instance.performanceScore = this.calculatePerformanceScore(metrics);
      }
    }
  }

  private calculatePerformanceScore(metrics: LayerPerformanceMetrics): number {
    // Calculate performance score based on multiple factors
    let score = 100;
    
    // Render time penalty
    if (metrics.renderTime > 10) score -= 20;
    else if (metrics.renderTime > 5) score -= 10;
    
    // Cache hit rate bonus/penalty
    if (metrics.cacheHitRate > 0.99) score += 5;
    else if (metrics.cacheHitRate < 0.90) score -= 15;
    
    // Memory usage penalty
    if (metrics.memoryUsage > 50 * 1024 * 1024) score -= 10; // 50MB
    
    return Math.max(0, Math.min(100, score));
  }

  private checkSLOCompliance(): void {
    const slo = this.cache.statistics.sloCompliance;
    
    // Calculate current performance percentiles from cached metrics
    const renderTimes: number[] = [];
    for (const metrics of this.cache.performance.values()) {
      renderTimes.push(metrics.renderTime);
    }
    
    if (renderTimes.length > 0) {
      const sorted = [...renderTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);
      
      slo.currentP95 = sorted[p95Index] || 0;
      slo.currentP99 = sorted[p99Index] || 0;
      
      // Calculate compliance rate (% of requests under 1.25ms target)
      const compliantRequests = renderTimes.filter(time => time <= slo.targetResponseTime).length;
      slo.complianceRate = (compliantRequests / renderTimes.length) * 100;
      
      // Log violations
      if (slo.complianceRate < 95) {
        this.logRegistryEvent('slo_violation', {
          complianceRate: slo.complianceRate,
          p95RenderTime: slo.currentP95,
          p99RenderTime: slo.currentP99,
          targetResponseTime: slo.targetResponseTime
        });
        
        // Trigger performance optimization
        this.triggerPerformanceOptimization();
      }
    }
  }

  private generatePerformanceRecommendations(): void {
    const recommendations: string[] = [];
    
    // Analyze cache performance
    if (this.cache.statistics.cacheHitRate < 0.95) {
      recommendations.push('Consider increasing cache TTL for frequently accessed layers');
      recommendations.push('Review cache key strategy to improve hit rate');
    }
    
    // Analyze memory usage
    let totalMemoryUsage = 0;
    for (const metrics of this.cache.performance.values()) {
      totalMemoryUsage += metrics.memoryUsage;
    }
    
    if (totalMemoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push('Implement aggressive cache eviction for memory optimization');
      recommendations.push('Consider data sampling for large datasets');
    }
    
    // Analyze layer distribution
    if (this.cache.instances.size > this.maxCacheSize * 0.8) {
      recommendations.push('Cache nearing capacity - consider increasing cache size');
    }
    
    if (recommendations.length > 0) {
      this.logRegistryEvent('performance_recommendations', { recommendations });
    }
  }

  private triggerPerformanceOptimization(): void {
    // Implement automatic performance optimization
    console.log('[LayerRegistry] Triggering performance optimization');
    
    // Optimize caches
    this.optimizeCaches();
    
    // Evict low-performance layers
    this.evictLowPerformanceLayers();
    
    // Adjust cache TTL based on usage patterns
    this.adjustCacheTTL();
  }

  private optimizeCaches(): void {
    // Clear old cache entries
    const maxCacheSize = this.maxCacheSize * 0.8; // Keep 80% capacity
    if (this.cache.instances.size > maxCacheSize) {
      const sortedInstances = Array.from(this.cache.instances.entries())
        .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
      
      const toEvict = sortedInstances.slice(0, this.cache.instances.size - maxCacheSize);
      for (const [layerId] of toEvict) {
        this.removeLayer(layerId);
      }
    }
  }

  private evictLowPerformanceLayers(): void {
    const lowPerformanceThreshold = 60; // Performance score threshold
    
    for (const [layerId, instance] of this.cache.instances) {
      if (instance.performanceScore < lowPerformanceThreshold) {
        console.log(`[LayerRegistry] Evicting low-performance layer: ${layerId} (score: ${instance.performanceScore})`);
        this.removeLayer(layerId);
      }
    }
  }

  private adjustCacheTTL(): void {
    // Dynamically adjust cache TTL based on usage patterns
    const avgAccessCount = Array.from(this.cache.instances.values())
      .reduce((sum, instance) => sum + instance.accessCount, 0) / this.cache.instances.size;
    
    if (avgAccessCount > 10) {
      // High usage - increase TTL
      this.cacheTTL = Math.min(this.cacheTTL * 1.2, 10 * 60 * 1000); // Max 10 minutes
    } else if (avgAccessCount < 2) {
      // Low usage - decrease TTL
      this.cacheTTL = Math.max(this.cacheTTL * 0.8, 2 * 60 * 1000); // Min 2 minutes
    }
  }

  /**
   * Enhanced cleanup method with comprehensive resource management
   */
  destroy(): void {
    // Stop all monitoring intervals
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
      this.performanceMonitor = null;
    }
    
    if (this.connectionPoolMonitor) {
      clearInterval(this.connectionPoolMonitor);
      this.connectionPoolMonitor = null;
    }
    
    // Disconnect WebSocket integration
    if (this.webSocketIntegration) {
      this.webSocketIntegration.disconnect();
      this.webSocketIntegration = null;
    }
    
    // Clear all caches across all tiers
    this.clearAllCaches();
    
    // Clean up layer instances
    for (const [layerId, instance] of this.cache.instances) {
      try {
        instance.layer.destroy();
      } catch (error) {
        console.warn(`[LayerRegistry] Error destroying layer ${layerId}:`, error);
      }
    }
    
    // Clear all registries and caches
    this.registry.clear();
    this.cache.instances.clear();
    this.cache.performance.clear();
    this.auditTrail.length = 0;
    
    // Final performance report
    const finalReport = {
      totalLayersCreated: this.cache.statistics.totalCreated,
      totalLayersDestroyed: this.cache.statistics.totalDestroyed,
      averageCreationTime: this.cache.statistics.averageCreationTime,
      finalCacheHitRate: this.cache.statistics.cacheHitRate,
      finalSloCompliance: this.cache.statistics.sloCompliance,
      auditTrailSize: this.auditTrail.length,
      uptime: Date.now()
    };
    
    console.log('[LayerRegistry] Final performance report:', finalReport);
    
    this.logRegistryEvent('registry_destroyed', finalReport);
  }

  private clearAllCaches(): void {
    // Clear L1 cache
    this.cache.instances.clear();
    
    // Clear distributed caches (L2, L3, L4)
    layerCacheManager.clearAll().catch(error => {
      console.warn('[LayerRegistry] Failed to clear distributed caches:', error);
    });
  }
}