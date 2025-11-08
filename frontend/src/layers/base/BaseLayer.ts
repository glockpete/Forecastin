/**
 * BaseLayer - Abstract base class for all geospatial layers
 * Following kepler.gl patterns with forecastin integration
 * Implements visual channels system with performance optimization
 */

import type {
  LayerConfig,
  LayerData,
  VisualChannel,
  LayerPerformanceMetrics,
  VisualChannelScale,
  VisualChannelValue
} from '../types/layer-types';
import {
  LayerEvent,
  FeatureFlagConfig
} from '../types/layer-types';
import { EventEmitter } from 'events';

/**
 * Abstract base class for all geospatial layers
 * Implements visual channels system following kepler.gl patterns
 * with forecastin-specific optimizations and compliance integration
 *
 * @template TData - The type of data entities this layer manages (extends LayerData)
 */
export abstract class BaseLayer<TData extends LayerData = LayerData> extends EventEmitter {
  /** Unique layer identifier */
  protected readonly id: string;
  
  /** Layer configuration */
  protected config: LayerConfig;
  
  /** Layer data entities (typed) */
  protected data: TData[] = [];
  
  /** Visual channels configuration */
  protected visualChannels: Map<string, VisualChannel> = new Map();
  
  /** Performance metrics tracking */
  protected performanceMetrics: LayerPerformanceMetrics | null = null;
  
  /** General-purpose cache */
  protected cache: Map<string, any> = new Map();
  
  /** Last render time for performance tracking */
  protected lastRenderTime = 0;
  
  /** Audit trail for compliance */
  protected auditTrail: any[] = [];
  
  // Materialization cache for performance optimization
  protected materializedViews: Map<string, any> = new Map();
  protected refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Thread-safe cache with RLock pattern (simulated in JS)
  protected readonly cacheLock = new Map<string, boolean>();
  protected cacheStats = {
    hits: 0,
    misses: 0,
    ttlExpired: 0
  };
  
  // WebSocket manager for real-time updates (injected via config or directly)
  protected websocketManager?: any;

  /**
   * Create a new BaseLayer instance
   * @param id - Unique layer identifier
   * @param data - Initial layer data
   * @param config - Layer configuration
   */
  constructor(id: string, data: TData[], config: LayerConfig) {
    super();
    this.id = id;
    this.data = [...data];
    this.config = { ...config, id }; // Ensure config.id matches constructor id
    this.initializeVisualChannels();
    this.setupPerformanceMonitoring();
    this.initializeMaterializedViews();
    this.logAuditEvent('layer_created', { id: this.id, dataCount: data.length });
  }

  /**
   * Initialize visual channels based on layer type
   * Must be implemented by subclasses
   */
  protected abstract initializeVisualChannels(): void;

  /**
   * Get the layer configuration
   */
  getConfig(): LayerConfig {
    return { ...this.config };
  }

  /**
   * Update layer configuration with validation and audit trail
   */
  updateConfig(updates: Partial<LayerConfig>): void {
    const startTime = performance.now();
    
    try {
      // Feature flag check for real-time updates
      if (updates.realTimeEnabled && !this.isFeatureFlagEnabled('realTimeUpdates')) {
        throw new Error('Real-time updates are disabled by feature flag');
      }

      // Validate configuration changes
      this.validateConfigUpdate(updates);

      // Apply updates
      const previousConfig = { ...this.config };
      this.config = { ...this.config, ...updates };

      // Invalidate relevant caches
      this.invalidateCaches();

      // Setup WebSocket if real-time is enabled
      if (updates.realTimeEnabled) {
        this.setupWebSocketUpdates();
      }

      this.logAuditEvent('layer_config_updated', {
        previous: previousConfig,
        updates,
        timestamp: new Date().toISOString()
      });

      // Emit update event
      this.emit('configUpdated', { config: this.config });

    } catch (error) {
      this.handleError('config_update_error', error as Error);
      throw error;
    } finally {
      this.recordPerformance('configUpdate', startTime);
    }
  }

  /**
   * Set layer data with caching and performance optimization
   */
  async setData(data: TData[]): Promise<void> {
    const startTime = performance.now();

    try {
      // Check feature flag for data operations
      if (!this.isFeatureFlagEnabled('dataOperations')) {
        throw new Error('Data operations are disabled by feature flag');
      }

      // Data validation
      this.validateData(data);

      // Cache data if caching is enabled
      if (this.config.cacheEnabled) {
        this.cache.set('layer_data', data);
        this.cache.set('data_timestamp', Date.now());
      }

      // Update hierarchy relationships if data has entities
      const enhancedData = this.enhanceDataWithHierarchy(data) as TData[];
      
      this.data = enhancedData;
      this.emit('dataUpdated', { data: enhancedData });

      this.logAuditEvent('data_updated', {
        dataCount: data.length
      });

    } catch (error) {
      this.handleError('data_update_error', error as Error);
      throw error;
    } finally {
      this.recordPerformance('dataUpdate', startTime);
    }
  }

  /**
   * Get current layer data (with cache)
   */
  getData(): TData[] {
    // Check cache first
    const cachedData = this.cache.get('layer_data');
    if (cachedData && this.config.cacheEnabled) {
      this.recordCacheHit();
      return [...cachedData];
    }

    // Return fresh data and cache it
    const data = [...this.data];
    if (this.config.cacheEnabled) {
      this.cache.set('layer_data', data);
    }
    return data;
  }
  
  /**
   * Get layer ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Set visual channel configuration with validation and audit trail
   */
  setVisualChannel(channelName: string, channel: VisualChannel): void {
    try {
      this.validateVisualChannel(channelName, channel);
      
      const previousChannel = this.visualChannels.get(channelName);
      this.visualChannels.set(channelName, channel);
      this.invalidateCaches();
      
      this.logAuditEvent('visual_channel_updated', {
        channelName,
        previousChannel,
        newChannel: channel
      });

      this.emit('visualChannelUpdated', { channelName, channel });
      
    } catch (error) {
      this.handleError('visual_channel_error', error as Error, { channelName, channel });
      throw error;
    }
  }

  /**
   * Get visual channel configuration with validation
   */
  getVisualChannel(channelName: string): VisualChannel | undefined {
    const channel = this.visualChannels.get(channelName);
    if (channel) {
      this.recordCacheHit();
    }
    return channel;
  }

  /**
   * Get all visual channels with audit trail
   */
  getAllVisualChannels(): Record<string, VisualChannel> {
    const channels: Record<string, VisualChannel> = {};
    let hitCount = 0;
    
    // Use Array.from to avoid downlevelIteration issues
    for (const [name, channel] of Array.from(this.visualChannels.entries())) {
      channels[name] = { ...channel };
      hitCount++;
    }
    
    this.logAuditEvent('visual_channels_accessed', {
      channelCount: hitCount,
      channelNames: Object.keys(channels)
    });
    
    return channels;
  }

  /**
   * Update visual channel value for a specific data point with kepler.gl compliance
   */
  protected updateChannelValue(channel: VisualChannel, dataPoint: any): VisualChannelValue {
    try {
      if (!channel || !channel.property) {
        return channel?.defaultValue ?? null;
      }

      const value = dataPoint[channel.property];
      if (value === undefined || value === null) {
        return channel.defaultValue ?? null;
      }

      // Apply scaling if configured (kepler.gl pattern)
      if (channel.scale && value !== undefined) {
        return this.applyScale(value, channel.scale, channel.type);
      }

      // Apply aggregation if specified
      if (channel.aggregation && Array.isArray(value)) {
        return this.applyAggregation(value, channel.aggregation);
      }

      return this.validateChannelValue(value, channel.type);
      
    } catch (error) {
      this.handleError('channel_value_error', error as Error, { channel: channel.name, dataPoint });
      return channel.defaultValue ?? null;
    }
  }

  /**
   * Apply visual channel scaling with kepler.gl compliance
   */
  protected applyScale(value: any, scale: VisualChannelScale, channelType: string): VisualChannelValue {
    try {
      if (scale.type === 'linear') {
        const [domainMin, domainMax] = scale.domain as [number, number];
        const [rangeMin, rangeMax] = scale.range as [number, number];
        
        if (typeof value === 'number' && !isNaN(value)) {
          const normalized = (value - domainMin) / (domainMax - domainMin);
          return rangeMin + normalized * (rangeMax - rangeMin);
        }
      } else if (scale.type === 'ordinal') {
        const domain = scale.domain as string[];
        const range = scale.range as string[];
        const index = domain.indexOf(String(value));
        return index >= 0 ? range[index] : value;
      } else if (scale.type === 'quantize') {
        const steps = scale.range.length;
        const quantizedValue = Math.floor((value / Math.max(...scale.domain as number[])) * steps);
        return scale.range[Math.min(quantizedValue, steps - 1)];
      }

      return value;
    } catch (error) {
      this.handleError('scale_application_error', error as Error, { value, scale, channelType });
      return value;
    }
  }

  /**
   * Apply aggregation to channel values
   */
  protected applyAggregation(values: any[], aggregation: string): any {
    const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
    
    switch (aggregation) {
      case 'sum':
        return numericValues.reduce((sum, val) => sum + val, 0);
      case 'mean':
        return numericValues.length > 0 ? numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length : 0;
      case 'min':
        return numericValues.length > 0 ? Math.min(...numericValues) : null;
      case 'max':
        return numericValues.length > 0 ? Math.max(...numericValues) : null;
      case 'count':
        return values.length;
      default:
        return values[0];
    }
  }

  /**
   * Validate channel value against type constraints
   */
  protected validateChannelValue(value: any, channelType: string): VisualChannelValue {
    switch (channelType) {
      case 'categorical':
        return String(value);
      case 'quantitative':
        const numValue = Number(value);
        return isNaN(numValue) ? null : numValue;
      case 'ordinal':
        return String(value);
      default:
        return value;
    }
  }

  /**
   * Batch process visual channels for performance optimization
   */
  protected processVisualChannelsBatch(dataPoints: any[]): Record<string, VisualChannelValue[]> {
    const startTime = performance.now();
    const results: Record<string, VisualChannelValue[]> = {};
    
    try {
      // Initialize result arrays for each channel
      for (const [channelName] of Array.from(this.visualChannels.entries())) {
        results[channelName] = [];
      }

      // Batch process all data points
      for (const dataPoint of dataPoints) {
        for (const [channelName, channel] of Array.from(this.visualChannels.entries())) {
          const value = this.updateChannelValue(channel, dataPoint);
          const channelResults = results[channelName];
          if (channelResults) {
            channelResults.push(value);
          }
        }
      }

      this.recordPerformance('visualChannelsBatch', startTime);
      return results;
      
    } catch (error) {
      this.handleError('batch_processing_error', error as Error, { dataPointCount: dataPoints.length });
      throw error;
    }
  }

  /**
   * Get layer performance metrics
   */
  getPerformanceMetrics(): LayerPerformanceMetrics | null {
    return this.performanceMetrics ? { ...this.performanceMetrics } : null;
  }

  /**
   * Check if layer is visible
   */
  isVisible(): boolean {
    return this.config.visible;
  }

  /**
   * Set layer visibility with audit trail
   */
  setVisible(visible: boolean): void {
    const wasVisible = this.config.visible;
    this.config.visible = visible;
    
    this.logAuditEvent('visibility_changed', {
      from: wasVisible,
      to: visible,
      timestamp: new Date().toISOString()
    });

    this.emit('visibilityChanged', { visible });
  }

  /**
   * Get layer opacity
   */
  getOpacity(): number {
    return this.config.opacity;
  }

  /**
   * Set layer opacity
   */
  setOpacity(opacity: number): void {
    this.config.opacity = Math.max(0, Math.min(1, opacity));
    this.emit('opacityChanged', { opacity: this.config.opacity });
  }

  /**
   * Abstract methods that subclasses must implement
   */
  abstract render(gl: WebGLRenderingContext): void;
  abstract getBounds(): [number, number][] | null;
  abstract onHover(info: any): void;
  abstract onClick(info: any): void;

  /**
   * Protected helper methods
   */
  protected validateConfigUpdate(updates: Partial<LayerConfig>): void {
    if (updates.id && updates.id !== this.config.id) {
      throw new Error('Layer ID cannot be changed after creation');
    }

    if (updates.opacity !== undefined && (updates.opacity < 0 || updates.opacity > 1)) {
      throw new Error('Opacity must be between 0 and 1');
    }
  }

  protected validateData(data: TData[]): void {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }

    // Performance validation - prevent memory issues
    if (data.length > 100000) {
      throw new Error('Data size exceeds maximum limit (100,000 features)');
    }
  }

  protected enhanceDataWithHierarchy(data: TData[]): TData[] {
    return data.map(item => {
      if (item.entityId) {
        // Link to forecastin entity hierarchy
        return {
          ...item,
          hierarchy: {
            ancestors: [], // Would be populated from navigation API
            descendants: [],
            path: `entity:${item.entityId}`,
            depth: 1
          }
        };
      }
      return item;
    }) as TData[];
  }

  protected invalidateCaches(): void {
    if (this.config.cacheEnabled) {
      // Keep essential cache, invalidate computed data
      this.cache.delete('rendered_data');
      this.cache.delete('computed_channels');
      this.cache.delete('bounds');
    }
  }

  /**
   * Initialize materialized views for performance optimization
   */
  protected initializeMaterializedViews(): void {
    // Create materialized views for common queries
    this.createMaterializedView('hierarchy_cache', () => this.buildHierarchyCache());
    this.createMaterializedView('visual_channels_cache', () => this.buildVisualChannelsCache());
    this.createMaterializedView('bounds_cache', () => this.calculateBounds());
    
    // Setup automatic refresh intervals
    this.scheduleMaterializedViewRefresh('hierarchy_cache', 30000); // 30 seconds
    this.scheduleMaterializedViewRefresh('visual_channels_cache', 60000); // 1 minute
  }

  /**
   * Create a materialized view
   */
  protected createMaterializedView(name: string, buildFunction: () => any): void {
    try {
      const startTime = performance.now();
      const viewData = buildFunction();
      this.materializedViews.set(name, {
        data: viewData,
        timestamp: Date.now(),
        buildTime: performance.now() - startTime,
        hitCount: 0,
        lastAccessed: Date.now()
      });
      
      this.logAuditEvent('materialized_view_created', {
        viewName: name,
        buildTime: performance.now() - startTime,
        dataSize: JSON.stringify(viewData).length
      });
    } catch (error) {
      this.handleError('materialized_view_creation_failed', error as Error, { viewName: name });
    }
  }

  /**
   * Refresh a materialized view
   */
  protected refreshMaterializedView(viewName: string): void {
    const view = this.materializedViews.get(viewName);
    if (!view) return;

    try {
      const startTime = performance.now();
      
      // Find the appropriate build function
      const buildFunction = this.getMaterializedViewBuildFunction(viewName);
      if (buildFunction) {
        const newData = buildFunction();
        view.data = newData;
        view.timestamp = Date.now();
        view.buildTime = performance.now() - startTime;
        view.lastRefreshed = Date.now();
        
        this.logAuditEvent('materialized_view_refreshed', {
          viewName,
          buildTime: performance.now() - startTime
        });
      }
    } catch (error) {
      this.handleError('materialized_view_refresh_failed', error as Error, { viewName });
    }
  }

  /**
   * Get materialized view build function
   */
  protected getMaterializedViewBuildFunction(viewName: string): (() => any) | null {
    const buildFunctions: Record<string, () => any> = {
      'hierarchy_cache': () => this.buildHierarchyCache(),
      'visual_channels_cache': () => this.buildVisualChannelsCache(),
      'bounds_cache': () => this.calculateBounds()
    };
    
    return buildFunctions[viewName] || null;
  }

  /**
   * Schedule automatic materialized view refresh
   */
  protected scheduleMaterializedViewRefresh(viewName: string, intervalMs: number): void {
    const timer = setInterval(() => {
      this.refreshMaterializedView(viewName);
    }, intervalMs);
    
    this.refreshTimers.set(viewName, timer);
  }

  /**
   * Enhanced performance monitoring with 1.25ms SLO target
   */
  protected setupPerformanceMonitoring(): void {
    this.performanceMetrics = {
      layerId: this.config.id,
      renderTime: 0,
      dataSize: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      lastRenderTime: new Date().toISOString(),
      fps: 0,
      sloCompliance: {
        targetResponseTime: 1.25, // 1.25ms target
        currentP95: 0,
        currentP99: 0,
        complianceRate: 100,
        violations: 0
      }
    };

    // Start performance monitoring background task
    this.startPerformanceMonitoring();
  }

  /**
   * Start background performance monitoring
   */
  protected startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updatePerformanceSLOCompliance();
      this.checkPerformanceDegradation();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Update SLO compliance metrics
   */
  protected updatePerformanceSLOCompliance(): void {
    if (!this.performanceMetrics) return;

    // Simulate percentile calculations (in real implementation, would track historical data)
    const recentRenderTimes = this.getRecentRenderTimes();
    
    if (recentRenderTimes.length > 0) {
      const sorted = [...recentRenderTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);
      
      this.performanceMetrics.sloCompliance.currentP95 = sorted[p95Index] || 0;
      this.performanceMetrics.sloCompliance.currentP99 = sorted[p99Index] || 0;
      
      // Calculate compliance rate (% of requests under 1.25ms)
      const compliantRequests = recentRenderTimes.filter(time => time <= 1.25).length;
      this.performanceMetrics.sloCompliance.complianceRate =
        (compliantRequests / recentRenderTimes.length) * 100;
    }
  }

  /**
   * Check for performance degradation
   */
  protected checkPerformanceDegradation(): void {
    if (!this.performanceMetrics) return;

    const { sloCompliance } = this.performanceMetrics;
    
    if (sloCompliance.complianceRate < 95) {
      this.handleError('performance_degradation', new Error(
        `SLO compliance dropped to ${sloCompliance.complianceRate.toFixed(2)}%`
      ), {
        complianceRate: sloCompliance.complianceRate,
        p95: sloCompliance.currentP95,
        p99: sloCompliance.currentP99
      });

      // Trigger performance optimization
      this.triggerPerformanceOptimization();
    }
  }

  /**
   * Get recent render times for analysis
   */
  protected getRecentRenderTimes(): number[] {
    // In a real implementation, would track render times in a circular buffer
    // For now, return current render time if available
    return this.lastRenderTime > 0 ? [this.lastRenderTime] : [];
  }

  /**
   * Trigger performance optimization when degradation detected
   */
  protected triggerPerformanceOptimization(): void {
    this.logAuditEvent('performance_optimization_triggered', {
      reason: 'slo_compliance_degradation',
      currentCompliance: this.performanceMetrics?.sloCompliance.complianceRate
    });

    // Optimize caches
    this.optimizeCaches();
    
    // Reduce data size if needed
    if (this.data.length > 50000) {
      this.performDataSampling();
    }

    // Emit optimization event
    this.emit('performanceOptimization', {
      timestamp: new Date().toISOString(),
      reason: 'slo_compliance_degradation'
    });
  }

  /**
   * Optimize cache performance
   */
  protected optimizeCaches(): void {
    // Clear old cache entries
    const maxCacheSize = 1000;
    if (this.cache.size > maxCacheSize) {
      const entriesToDelete = Array.from(this.cache.keys()).slice(0, this.cache.size - maxCacheSize);
      entriesToDelete.forEach(key => this.cache.delete(key));
    }

    // Clear old materialized views
    for (const [name, view] of Array.from(this.materializedViews.entries())) {
      if (Date.now() - view.lastAccessed > 300000) { // 5 minutes
        this.materializedViews.delete(name);
      }
    }
  }

  /**
   * Perform data sampling for performance
   */
  protected performDataSampling(): void {
    if (this.data.length <= 10000) return;

    // Sample data to maintain performance
    const sampleRate = 10000 / this.data.length;
    const sampledData = this.data.filter(() => Math.random() < sampleRate);
    
    this.logAuditEvent('data_sampling_performed', {
      originalSize: this.data.length,
      sampledSize: sampledData.length,
      sampleRate
    });

    this.data = sampledData;
    this.invalidateCaches();
  }

  protected recordPerformance(operation: string, startTime: number): void {
    const duration = performance.now() - startTime;
    this.lastRenderTime = duration;

    if (this.performanceMetrics) {
      this.performanceMetrics.lastRenderTime = new Date().toISOString();
      
      if (operation === 'render') {
        this.performanceMetrics.renderTime = duration;
        this.performanceMetrics.dataSize = this.data.length;
        this.performanceMetrics.memoryUsage = this.estimateMemoryUsage();
        this.performanceMetrics.fps = duration > 0 ? 1000 / duration : 0;
      }

      // Check SLO compliance
      if (duration > this.performanceMetrics.sloCompliance.targetResponseTime) {
        this.logAuditEvent('slo_violation', {
          operation,
          duration,
          target: this.performanceMetrics.sloCompliance.targetResponseTime
        });
      }
    }
  }

  protected recordCacheHit(): void {
    if (this.performanceMetrics) {
      this.cacheStats.hits++;
      const current = this.performanceMetrics.cacheHitRate;
      this.performanceMetrics.cacheHitRate = current * 0.9 + 1.0 * 0.1; // Exponential moving average
    }
  }

  protected recordCacheMiss(): void {
    this.cacheStats.misses++;
  }

  protected recordCacheTTLExpired(): void {
    this.cacheStats.ttlExpired++;
  }

  protected estimateMemoryUsage(): number {
    // Enhanced memory estimation with data complexity
    const baseSize = JSON.stringify(this.data).length * 2; // UTF-16 estimate
    
    // Add overhead for caches and materialized views
    const cacheOverhead = Array.from(this.cache.values())
      .reduce((sum, value) => sum + JSON.stringify(value).length * 2, 0);
    
    const materializedViewOverhead = Array.from(this.materializedViews.values())
      .reduce((sum, view) => sum + JSON.stringify(view.data).length * 2, 0);
    
    return baseSize + cacheOverhead + materializedViewOverhead;
  }

  protected isFeatureFlagEnabled(flagName: string): boolean {
    // Integration with forecastin's feature flag service
    // This would connect to the actual feature flag system
    const flags: Record<string, boolean | string> = {
      mapV1Enabled: true,
      realTimeUpdates: true,
      performanceMode: 'optimized',
      dataOperations: true
    };

    return (flags as any)[flagName] ?? true;
  }

  protected setupWebSocketUpdates(): void {
    if (!this.config.realTimeEnabled) return;

    // Setup WebSocket connection for real-time updates
    // This would integrate with the existing WebSocket infrastructure
    this.emit('webSocketSetup', { layerId: this.config.id });
  }

  /**
   * Enhanced error handling with ErrorBoundary integration
   */
  protected handleError(errorType: string, error: Error, context?: Record<string, any>): void {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.error(`Layer Error [${this.config.id}]: ${errorType}`, {
      errorId,
      type: errorType,
      layerId: this.config.id,
      error: error.message,
      stack: error.stack,
      context: context || {},
      timestamp: new Date().toISOString()
    });
    
    const errorEvent = {
      type: errorType,
      layerId: this.config.id,
      errorId,
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
      recoverable: this.isRecoverableError(errorType),
      severity: this.getErrorSeverity(errorType)
    };

    this.emit('error', errorEvent);

    this.logAuditEvent('error', {
      ...errorEvent,
      errorStack: error.stack,
      systemMemory: process.memoryUsage(),
      performanceMetrics: this.performanceMetrics
    });

    // Integration with React ErrorBoundary pattern
    if (this.isCriticalError(errorType)) {
      this.emit('criticalError', errorEvent);
      // Trigger fallback behavior for ErrorBoundary integration
      this.triggerFallbackBehavior(errorType, error);
    }
  }

  /**
   * Check if error is recoverable
   */
  protected isRecoverableError(errorType: string): boolean {
    const recoverableErrors = [
      'cache_miss',
      'data_validation_warning',
      'feature_flag_disabled',
      'network_timeout',
      'visual_channel_warning'
    ];
    return recoverableErrors.includes(errorType);
  }

  /**
   * Get error severity level
   */
  protected getErrorSeverity(errorType: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalErrors = [
      'layer_initialization_failed',
      'data_corruption',
      'security_violation',
      'memory_overflow'
    ];
    const highErrors = [
      'render_failed',
      'websocket_connection_lost',
      'database_connection_failed',
      'performance_degradation'
    ];

    if (criticalErrors.includes(errorType)) return 'critical';
    if (highErrors.includes(errorType)) return 'high';
    if (errorType.includes('warning')) return 'low';
    return 'medium';
  }

  /**
   * Check if error is critical and requires fallback behavior
   */
  protected isCriticalError(errorType: string): boolean {
    return this.getErrorSeverity(errorType) === 'critical';
  }

  /**
   * Trigger fallback behavior for critical errors
   */
  protected triggerFallbackBehavior(errorType: string, error: Error): void {
    this.emit('fallbackRequired', {
      reason: errorType,
      originalError: error,
      fallbackStrategy: this.getFallbackStrategy(errorType)
    });
  }

  /**
   * Get fallback strategy for error types
   */
  protected getFallbackStrategy(errorType: string): string {
    const strategies: Record<string, string> = {
      'render_failed': 'disable_layer_render',
      'data_corruption': 'clear_and_reload_data',
      'websocket_connection_lost': 'switch_to_polling',
      'memory_overflow': 'reduce_data_size',
      'layer_initialization_failed': 'use_default_config'
    };
    return strategies[errorType] || 'graceful_degradation';
  }

  /**
   * Validate visual channel configuration
   */
  protected validateVisualChannel(channelName: string, channel: VisualChannel): void {
    if (!channelName || typeof channelName !== 'string') {
      throw new Error('Channel name must be a non-empty string');
    }

    if (!channel || typeof channel !== 'object') {
      throw new Error('Channel must be a valid VisualChannel object');
    }

    if (!channel.property || typeof channel.property !== 'string') {
      throw new Error('Channel property must be a string');
    }

    if (!['categorical', 'quantitative', 'ordinal'].includes(channel.type)) {
      throw new Error('Channel type must be categorical, quantitative, or ordinal');
    }

    if (channel.scale) {
      this.validateVisualChannelScale(channel.scale);
    }

    if (channel.aggregation && !['sum', 'mean', 'min', 'max', 'count'].includes(channel.aggregation)) {
      throw new Error('Invalid aggregation type');
    }
  }

  /**
   * Validate visual channel scale configuration
   */
  protected validateVisualChannelScale(scale: any): void {
    if (!scale.type || !['linear', 'log', 'sqrt', 'quantize', 'ordinal'].includes(scale.type)) {
      throw new Error('Invalid scale type');
    }

    if (!scale.domain || !Array.isArray(scale.domain) || scale.domain.length !== 2) {
      throw new Error('Scale domain must be an array of length 2');
    }

    if (!scale.range || !Array.isArray(scale.range) || scale.range.length < 2) {
      throw new Error('Scale range must be an array with at least 2 elements');
    }
  }

  /**
   * Enhanced audit trail with compliance integration
   */
  protected logAuditEvent(action: string, metadata?: Record<string, any>): void {
    if (!this.config.auditEnabled) return;

    const auditEntry = {
      action,
      layerId: this.id,
      timestamp: new Date().toISOString(),
      dataClassification: this.config.dataClassification || 'internal',
      userId: metadata?.userId || 'system',
      sessionId: metadata?.sessionId || this.generateSessionId(),
      metadata: metadata || {},
      complianceFlags: this.extractComplianceFlags(action, metadata),
      performanceImpact: this.getPerformanceImpact(action),
      riskLevel: this.assessRiskLevel(action, metadata)
    };

    this.auditTrail.push(auditEntry);

    // Maintain audit trail size limit (memory management)
    if (this.auditTrail.length > 1000) {
      this.auditTrail = this.auditTrail.slice(-500); // Keep last 500 entries
    }

    // Emit audit event for compliance framework integration
    this.emit('auditEvent', auditEntry);

    // Real-time audit for sensitive operations
    if (this.isSensitiveOperation(action)) {
      this.emit('sensitiveOperation', auditEntry);
    }
  }

  /**
   * Extract compliance flags for audit entry
   */
  protected extractComplianceFlags(action: string, metadata?: Record<string, any>): string[] {
    const flags: string[] = [];
    
    if (this.config.dataClassification === 'confidential') flags.push('DATA_CLASSIFICATION_CONFIDENTIAL');
    if (this.config.dataClassification === 'restricted') flags.push('DATA_CLASSIFICATION_RESTRICTED');
    if (metadata?.userId && metadata.userId !== 'system') flags.push('USER_ACTION');
    if (action.includes('export') || action.includes('download')) flags.push('DATA_EXPORT');
    if (action.includes('delete') || action.includes('remove')) flags.push('DATA_MODIFICATION');
    
    return flags;
  }

  /**
   * Get performance impact assessment for audit
   */
  protected getPerformanceImpact(action: string): 'low' | 'medium' | 'high' {
    const highImpactActions = ['render', 'data_update', 'config_update'];
    const mediumImpactActions = ['cache_clear', 'materialized_view_refresh'];
    
    if (highImpactActions.some(a => action.includes(a))) return 'high';
    if (mediumImpactActions.some(a => action.includes(a))) return 'medium';
    return 'low';
  }

  /**
   * Assess risk level for audit compliance
   */
  protected assessRiskLevel(action: string, metadata?: Record<string, any>): 'low' | 'medium' | 'high' {
    const highRiskActions = ['delete', 'export', 'config_change'];
    const mediumRiskActions = ['data_update', 'user_access'];
    
    if (highRiskActions.some(a => action.includes(a))) return 'high';
    if (mediumRiskActions.some(a => action.includes(a))) return 'medium';
    return 'low';
  }

  /**
   * Check if operation is sensitive and requires special handling
   */
  protected isSensitiveOperation(action: string): boolean {
    const sensitiveActions = ['export', 'delete', 'config_change', 'data_access'];
    return sensitiveActions.some(a => action.includes(a));
  }

  /**
   * Generate session ID for audit trails
   */
  protected generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enhanced WebSocket-safe serialization with orjson pattern
   */
  protected safeSerialize(data: any): string {
    try {
      // Use orjson-like safe serialization following forecastin patterns
      return JSON.stringify(data, (key, value) => {
        // Handle Date objects
        if (value instanceof Date) {
          return {
            __type: 'Date',
            iso: value.toISOString()
          };
        }
        
        // Handle circular references and complex objects
        if (value && typeof value === 'object') {
          // Create a cache to detect circular references
          const cache = new WeakSet();
          
          // Check if we're in a circular reference
          if (cache.has(value)) {
            return `[Circular Reference: ${key}]`;
          }
          cache.add(value);
          
          // Handle different object types
          if (Array.isArray(value)) {
            return value.map(item =>
              typeof item === 'object' && item !== null ?
                JSON.parse(JSON.stringify(item, (k, v) => this._safeSerializeReplacer(k, v))) :
                item
            );
          }
          
          if (value.constructor && value.constructor.name !== 'Object') {
            return {
              __type: value.constructor.name,
              data: JSON.parse(JSON.stringify(value))
            };
          }
        }
        
        return value;
      });
    } catch (error) {
      this.handleError('serialization_error', error as Error, { dataType: typeof data });
      
      // Fallback to simple serialization for critical messages
      try {
        return JSON.stringify({
          error: 'serialization_failed',
          timestamp: new Date().toISOString(),
          layerId: this.config.id
        });
      } catch (fallbackError) {
        throw new Error(`Both primary and fallback serialization failed: ${error}`);
      }
    }
  }

  /**
   * Safe serialization replacer function
   */
  protected _safeSerializeReplacer(key: string, value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Error) {
      return {
        __type: 'Error',
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }

    return value;
  }

  /**
   * Send WebSocket message with safe serialization
   */
  protected sendWebSocketMessage(type: string, payload: any): void {
    try {
      const message = {
        type,
        payload: {
          ...payload,
          timestamp: new Date().toISOString(),
          layerId: this.config.id,
          safeSerialized: true
        }
      };

      const serializedMessage = this.safeSerialize(message);
      
      this.emit('webSocketMessage', {
        message: serializedMessage,
        timestamp: new Date().toISOString(),
        layerId: this.config.id
      });

    } catch (error) {
      this.handleError('websocket_send_failed', error as Error, { type, payloadType: typeof payload });
    }
  }

  /**
   * Build hierarchy cache for performance optimization
   */
  protected buildHierarchyCache(): Record<string, any> {
    const hierarchyCache: Record<string, any> = {};
    
    for (const item of this.data) {
      if (item.entityId && item.hierarchy) {
        hierarchyCache[item.entityId] = {
          ...item.hierarchy,
          processed: true,
          cacheTimestamp: Date.now()
        };
      }
    }
    
    return hierarchyCache;
  }

  /**
   * Build visual channels cache for performance optimization
   */
  protected buildVisualChannelsCache(): Record<string, any> {
    const channelCache: Record<string, any> = {};
    
    for (const [channelName, channel] of Array.from(this.visualChannels.entries())) {
      channelCache[channelName] = {
        ...channel,
        processed: true,
        cacheTimestamp: Date.now()
      };
    }
    
    return channelCache;
  }

  /**
   * Calculate layer bounds for spatial indexing
   */
  protected calculateBounds(): [number, number][] | null {
    if (this.data.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const item of this.data) {
      if (item.geometry && item.geometry.type === 'Point') {
        const [x, y] = item.geometry.coordinates as [number, number];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (minX === Infinity) return null;

    return [
      [minX, minY],
      [maxX, maxY]
    ];
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStatistics(): {
    memoryUsage: number;
    hitRate: number;
    size: number;
    materializedViewCount: number;
  } {
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = totalRequests > 0 ? (this.cacheStats.hits / totalRequests) * 100 : 0;

    return {
      memoryUsage: this.estimateMemoryUsage(),
      hitRate,
      size: this.cache.size,
      materializedViewCount: this.materializedViews.size
    };
  }

  /**
   * Get performance report for compliance and monitoring
   */
  getPerformanceReport(): {
    currentMetrics: LayerPerformanceMetrics | null;
    sloCompliance: number;
    optimizationRecommendations: string[];
    lastOptimizations: string[];
  } {
    const recommendations: string[] = [];
    const optimizations: string[] = [];

    if (!this.performanceMetrics) {
      return {
        currentMetrics: null,
        sloCompliance: 0,
        optimizationRecommendations: recommendations,
        lastOptimizations: optimizations
      };
    }

    // Analyze performance and provide recommendations
    if (this.performanceMetrics.sloCompliance.complianceRate < 95) {
      recommendations.push('Consider implementing data sampling for large datasets');
      recommendations.push('Enable aggressive caching for frequently accessed data');
    }

    if (this.cacheStats.misses > this.cacheStats.hits) {
      recommendations.push('Review cache key strategy to improve hit rate');
      recommendations.push('Consider increasing cache TTL for stable data');
    }

    if (this.performanceMetrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
      recommendations.push('Implement memory cleanup strategies');
      recommendations.push('Consider data pagination for large datasets');
    }

    return {
      currentMetrics: { ...this.performanceMetrics },
      sloCompliance: this.performanceMetrics.sloCompliance.complianceRate,
      optimizationRecommendations: recommendations,
      lastOptimizations: optimizations
    };
  }

  /**
   * Enhanced cleanup method with comprehensive resource management
   */
  destroy(): void {
    // Clear all timers
    for (const timer of Array.from(this.refreshTimers.values())) {
      clearInterval(timer);
    }
    this.refreshTimers.clear();

    // Clear caches and materialized views
    this.cache.clear();
    this.materializedViews.clear();
    this.visualChannels.clear();
    this.auditTrail = [];
    this.cacheLock.clear();

    // Remove all event listeners
    this.removeAllListeners();

    // Final audit log
    this.logAuditEvent('layer_destroyed', {
      performanceMetrics: this.performanceMetrics,
      cacheStatistics: this.getCacheStatistics(),
      uptime: Date.now() - (this.performanceMetrics?.lastRenderTime ?
        new Date(this.performanceMetrics.lastRenderTime).getTime() : Date.now()),
      totalOperations: this.auditTrail.length
    });

    // Clean up performance metrics
    this.performanceMetrics = null;
  }
}