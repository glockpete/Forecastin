/**
 * PointLayer - Enhanced geospatial point visualization with GPU filtering integration
 *
 * Extends BaseLayer to provide point-specific visual channels, integrates with Deck.gl ScatterplotLayer
 * and implements GPU filtering for high-performance rendering of 10k+ points with <100ms constraints.
 * Follows forecastin's WebSocket infrastructure and entity hierarchy system patterns.
 */

import type {
  BaseLayerConfig,
  VisualChannel,
  EntityDataPoint,
  LayerData,
  VisualChannelConfig,
  LayerPerformanceMetrics,
  LayerFilter,
  LayerWebSocketMessage,
  ComplianceAuditEntry,
  EntityData
} from '../types/layer-types';
import { BaseLayer } from '../base/BaseLayer';
import { createPointLayerConfig, validatePointData, LayerWebSocketUtils } from '../utils/layer-utils';
import { safe_serialize_message } from '../utils/layer-ws-utilities';

// Import Deck.gl types (would be available when deck.gl is installed)
export interface ScatterplotLayerConfig {
  data: EntityDataPoint[];
  getPosition: (entity: EntityDataPoint) => [number, number, number?];
  getFillColor: (entity: EntityDataPoint) => [number, number, number, number?];
  getRadius: (entity: EntityDataPoint) => number;
  radiusUnits: 'meters' | 'pixels';
  stroked: boolean;
  filled: boolean;
  getLineColor?: (entity: EntityDataPoint) => [number, number, number, number?];
  lineWidthUnits?: 'meters' | 'pixels';
  lineWidthMinPixels?: number;
  opacity: number;
  pickable: boolean;
  onClick?: (info: any) => void;
  onHover?: (info: any) => void;
  updateTriggers?: Record<string, any>;
  transitions?: Record<string, number>;
  parameters?: Record<string, any>;
}

// GPU Filter interface for performance optimization
export interface GPUFilterConfig {
  enabled: boolean;
  filterRange: [number, number]; // min/max values for filtering
  filteredValueAccessor: (entity: EntityDataPoint) => number;
  getFilterValue: (entities: EntityDataPoint[]) => Float32Array; // GPU buffer
  getFiltered: (filteredIndices: Uint8Array, originalData: EntityDataPoint[]) => EntityDataPoint[]; // CPU fallback
  batchSize: number; // number of entities to process in each batch
  useGPU: boolean; // enable GPU acceleration
}

export interface PointLayerConfig extends BaseLayerConfig {
  // Point-specific visual channels following kepler.gl patterns
  getPosition: (entity: EntityDataPoint) => [number, number, number?]; // lng, lat, altitude?
  getColor: VisualChannelConfig;
  getSize: VisualChannelConfig;
  getOpacity: VisualChannelConfig;
  
  // ScatterplotLayer specific configuration
  scatterplotConfig?: Partial<ScatterplotLayerConfig>;
  
  // Point clustering and interaction
  enableClustering: boolean;
  clusterRadius: number;
  maxZoomLevel: number;
  minZoomLevel: number;
  
  // GPU Filtering for performance optimization
  gpuFilterConfig?: GPUFilterConfig;
  
  // Entity-specific data processing
  entityDataMapping: {
    positionField: string;
    colorField: string;
    sizeField?: string;
    entityIdField: string;
    confidenceField: string;
  };
  
  // Performance constraints
  performanceTarget: number; // milliseconds target for 10k points
  maxRenderTime: number; // hard limit for performance
}

export interface PointLayerProps {
  id: string;
  config: PointLayerConfig;
  data: EntityDataPoint[];
  visible: boolean;
  opacity?: number;
  zIndex?: number;
}

export class PointLayer extends BaseLayer<EntityDataPoint> {
  // Make startPerformanceMonitoring protected to match BaseLayer visibility
  protected startPerformanceMonitoring(): void {
    setInterval(() => {
      this.checkPerformanceHealth();
    }, 30000);
  }
  
  private readonly pointConfig: PointLayerConfig;
  private readonly entityCache = new Map<string, EntityDataPoint>();
  private clusterConfig: any = null;
  private scatterplotLayer: any = null; // Deck.gl ScatterplotLayer instance
  private gpuFilterBuffer: Float32Array | null = null;
  private filteredIndices: Uint8Array | null = null;
  private performanceTarget = 100; // ms for 10k points
  private updateTriggers = new Map<string, any>();
  
  // Additional class properties
  protected scaledOpacity = 1.0;
  private renderTimeout: NodeJS.Timeout | null = null;
  protected onDataChange: ((data: EntityDataPoint[]) => void) | null = null;

  // Required BaseLayer method implementations
  protected initializeVisualChannels(): void {
    // Setup visual channels following kepler.gl patterns
    this.setVisualChannel('position', {
      name: 'position',
      property: 'coordinates',
      type: 'quantitative',
      defaultValue: [0, 0] as any
    });
    
    this.setVisualChannel('color', this.pointConfig.getColor);
    this.setVisualChannel('size', this.pointConfig.getSize);
    this.setVisualChannel('opacity', this.pointConfig.getOpacity);
  }

  render(gl: WebGLRenderingContext): void {
    const startTime = performance.now();
    
    try {
      // Generate GPU filter values for performance optimization
      const gpuFilteredData = this.applyGPUFiltering();
      
      // Create or update ScatterplotLayer configuration
      const layerConfig = this.createScatterplotLayerConfig(gpuFilteredData);
      
      // Performance validation
      const renderTime = performance.now() - startTime;
      this.validatePerformanceConstraint(renderTime);
      
      // Update performance metrics
      this.updatePerformanceMetrics(renderTime, gpuFilteredData.length);
      
      // Log render event for audit trail
      this.logAuditEvent('layer_rendered', {
        renderTime,
        entityCount: gpuFilteredData.length,
        gpuFilteringEnabled: this.pointConfig.gpuFilterConfig?.enabled || false,
        performanceTarget: this.performanceTarget
      });
      
    } catch (error) {
      this.handleError('layer_render_failed', error as Error);
      throw new Error(`PointLayer render failed: ${error}`);
    }
  }

  getBounds(): [number, number][] | null {
    if (this.data.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const entity of this.data) {
      const position = this.pointConfig.getPosition(entity);
      const [lng, lat] = position;
      
      if (typeof lng === 'number' && typeof lat === 'number') {
        minX = Math.min(minX, lng);
        minY = Math.min(minY, lat);
        maxX = Math.max(maxX, lng);
        maxY = Math.max(maxY, lat);
      }
    }

    if (minX === Infinity) return null;

    return [
      [minX, minY],
      [maxX, maxY]
    ];
  }

  onHover(info: any): void {
    if (info.object) {
      const entity = info.object as EntityDataPoint;
      this.emit('entityHover', {
        entity,
        position: info.coordinate,
        confidence: entity.confidence || 0.5
      });
      
      this.logAuditEvent('entity_hover', {
        entityId: entity.id,
        position: info.coordinate,
        confidence: entity.confidence
      });
    }
  }

  onClick(info: any): void {
    if (info.object) {
      const entity = info.object as EntityDataPoint;
      this.emit('entityClick', {
        entity,
        position: info.coordinate,
        confidence: entity.confidence
      });
      
      this.logAuditEvent('entity_click', {
        entityId: entity.id,
        position: info.coordinate,
        confidence: entity.confidence
      });
    }
  }

  constructor(props: PointLayerProps) {
    const fullConfig = createPointLayerConfig(props.config);
    super(props.id, props.data, fullConfig);
    
    this.pointConfig = props.config;
    this.performanceTarget = props.config.performanceTarget || 100;
    this.initializeLayer();
  }

  /**
   * Initialize point layer with clustering, GPU filtering, and performance monitoring
   */
  private initializeLayer(): void {
    // Initialize entity cache for O(1) lookups
    this.setupEntityCache();
    
    // Setup clustering if enabled
    if (this.pointConfig.enableClustering) {
      this.setupClustering();
    }
    
    // Initialize GPU filtering if configured
    if (this.pointConfig.gpuFilterConfig?.enabled) {
      this.initializeGPUFiltering();
    }
    
    // Initialize performance monitoring
    this.startPerformanceMonitoring();
    
    // Log initialization for compliance audit
    this.logAuditEvent('layer_initialized', {
      layerId: this.id,
      layerType: 'point',
      entityCount: this.data.length,
      clusteringEnabled: this.pointConfig.enableClustering,
      gpuFilteringEnabled: this.pointConfig.gpuFilterConfig?.enabled || false,
      performanceTarget: this.performanceTarget,
      maxRenderTime: this.pointConfig.maxRenderTime || 100
    });
  }

  /**
   * Process raw entity data into visual data for rendering
   * @param rawData - Raw entity data from navigation API or WebSocket
   */
  protected processVisualData(rawData: EntityDataPoint[]): LayerData {
    const startTime = performance.now();
    
    try {
      const processedEntities = rawData
        .filter(entity => validatePointData(entity, this.pointConfig.entityDataMapping))
        .map(entity => this.processEntity(entity));
      
      // Cache processed entities for rapid lookups
      processedEntities.forEach(entity => {
        this.entityCache.set(entity.id, entity);
      });

      const endTime = performance.now();
      
      // Return first processed entity as LayerData format (matches LayerData<Geometry> interface)
      const firstEntity = processedEntities[0];
      if (!firstEntity) {
        throw new Error('No valid entities to process');
      }
      
      return {
        id: firstEntity.id,
        geometry: firstEntity.geometry || null,
        properties: {
          entities: processedEntities,
          metadata: {
            totalEntities: processedEntities.length,
            visibleEntities: processedEntities.length,
            processingTime: endTime - startTime,
            cacheHitRate: this.calculateCacheHitRate(),
            confidenceScore: this.calculateAverageConfidence(processedEntities),
            entityHierarchy: this.extractEntityHierarchy(processedEntities)
          }
        },
        confidence: firstEntity.confidence,
        entityId: firstEntity.id
      };
    } catch (error) {
      this.handleError('visual_data_processing_failed', error as Error);
      throw new Error(`PointLayer visual data processing failed: ${error}`);
    }
  }

  /**
   * Process individual entity with confidence scoring and hierarchy linking
   */
  private processEntity(entity: EntityDataPoint): EntityDataPoint {
    // Get position coordinates from entity data
    const position = this.pointConfig.getPosition(entity);
    
    // Apply confidence scoring (calibrated by rules)
    const confidenceScore = this.calculateEntityConfidence(entity);
    
    // Extract hierarchy relationships for navigation integration
    const hierarchyData = this.extractHierarchyData(entity);
    
    return {
      ...entity,
      position,
      confidence: confidenceScore,
      hierarchy: hierarchyData,
      // Apply visual channels with confidence-weighted scaling
      visualProperties: {
        color: this.applyVisualChannel(this.pointConfig.getColor, entity, confidenceScore),
        size: this.applyVisualChannel(this.pointConfig.getSize, entity, confidenceScore),
        opacity: this.applyVisualChannel(this.pointConfig.getOpacity, entity, confidenceScore)
      }
    };
  }

  /**
   * Calculate entity confidence using 5-W framework calibration
   */
  private calculateEntityConfidence(entity: EntityDataPoint): number {
    const { confidenceField } = this.pointConfig.entityDataMapping;
    let baseConfidence = (entity as any)[confidenceField] || 0.5;
    
    // Calibration rules from AGENTS.md - PersonEntity with title+organization gets higher score
    const title = (entity as any).title;
    const organization = (entity as any).organization;
    const location = (entity as any).location;
    
    if (title && organization) {
      baseConfidence = Math.min(baseConfidence * 1.2, 1.0); // Boost for title+organization
    }
    
    if (location) {
      baseConfidence = Math.min(baseConfidence * 1.1, 1.0); // Boost for location data
    }
    
    return Math.max(baseConfidence, 0.1); // Minimum confidence threshold
  }

  /**
   * Extract hierarchy data for navigation API integration
   */
  private extractHierarchyData(entity: EntityDataPoint): any {
    const { entityIdField } = this.pointConfig.entityDataMapping;
    const entityId = (entity as any)[entityIdField];
    
    // This integrates with the existing LTREE system
    return {
      entityId,
      path: (entity as any).path || null,
      pathDepth: (entity as any).pathDepth || 0,
      ancestors: (entity as any).ancestors || [],
      descendants: (entity as any).descendants || []
    };
  }

  /**
   * Apply visual channel scaling based on entity properties and confidence
   */
  private applyVisualChannel(
    channel: VisualChannelConfig,
    entity: EntityDataPoint,
    confidenceScore: number
  ): any {
    // Get raw value from entity - handle undefined field case
    const fieldName = channel.field || channel.property;
    if (!fieldName) {
      return channel.defaultValue;
    }
    
    const rawValue = (entity as any)[fieldName];
    
    // Apply scaling based on type - compare against channel type property
    const channelType = channel.type;
    if (channelType === 'categorical' || channelType === 'quantitative' || channelType === 'ordinal') {
      // Map visual channel types to render types
      if (channel.name === 'color' || channel.property === 'color') {
        return this.scaleColorValue(rawValue, channel);
      } else if (channel.name === 'size' || channel.property === 'size') {
        return this.scaleSizeValue(rawValue, confidenceScore);
      } else if (channel.name === 'opacity' || channel.property === 'opacity') {
        return this.scaleOpacityValue(rawValue, confidenceScore);
      }
    }
    
    return rawValue || channel.defaultValue;
  }

  /**
   * Scale color values with confidence weighting
   */
  private scaleColorValue(value: any, channel: VisualChannelConfig): string {
    if (typeof value === 'string') {
      return value; // Color hex or named color
    }
    
    // Apply confidence-weighted color scaling
    const scaledOpacity = this.scaledOpacity || 1.0;
    return this.interpolateColor(value, channel.scale, scaledOpacity);
  }

  /**
   * Scale size values with confidence-based minimum size
   */
  private scaleSizeValue(value: number, confidenceScore: number): number {
    const baseSize = typeof value === 'number' ? value : 8; // Default point size
    const minSize = Math.max(2, baseSize * 0.5); // Minimum size based on confidence
    const maxSize = baseSize * 1.5;
    
    return Math.max(minSize, Math.min(maxSize, baseSize * confidenceScore));
  }

  /**
   * Scale opacity with confidence scoring integration
   */
  private scaleOpacityValue(value: number, confidenceScore: number): number {
    const baseOpacity = typeof value === 'number' ? value : 0.8;
    return Math.max(0.1, Math.min(1.0, baseOpacity * confidenceScore));
  }

  /**
   * Setup entity cache for O(1) entity lookups
   */
  private setupEntityCache(): void {
    this.data.forEach(entity => {
      const entityId = (entity as any)[this.pointConfig.entityDataMapping.entityIdField];
      if (entityId) {
        this.entityCache.set(entityId, entity);
      }
    });
  }

  /**
   * Setup clustering configuration for performance optimization
   */
  private setupClustering(): void {
    this.clusterConfig = {
      radius: this.pointConfig.clusterRadius,
      maxZoom: this.pointConfig.maxZoomLevel,
      minZoom: this.pointConfig.minZoomLevel,
      enabled: this.pointConfig.enableClustering
    };
  }


  /**
   * Handle WebSocket messages for real-time entity updates
   */
  protected handleWebSocketMessage(message: LayerWebSocketMessage): void {
    try {
      const action = (message as any).action || message.type;
      switch (action) {
        case 'entity_update':
          this.handleEntityUpdate(message as any);
          break;
        case 'batch_entities':
          this.handleBatchEntities(message as any);
          break;
        case 'confidence_adjustment':
          this.handleConfidenceAdjustment(message as any);
          break;
        default:
          this.logAuditEvent('unhandled_message_action', {
            layerId: this.id,
            action,
            messageType: message.type
          });
      }
    } catch (error) {
      this.handleError('websocket_message_handling_failed', error as Error);
    }
  }

  /**
   * Handle individual entity update from WebSocket
   */
  private handleEntityUpdate(message: LayerWebSocketMessage): void {
    if (!message.data?.entity) return;
    
    const updatedEntity = message.data.entity as EntityDataPoint;
    const processedEntity = this.processEntity(updatedEntity);
    
    // Update cache and data
    this.entityCache.set(processedEntity.id, processedEntity);
    this.data = this.data.map(entity => 
      entity.id === processedEntity.id ? processedEntity : entity
    );
    
    // Trigger re-render with debouncing
    this.scheduleRender();
    
    this.logAuditEvent('entity_updated', {
      layerId: this.id,
      entityId: processedEntity.id,
      confidence: processedEntity.confidence
    });
  }

  /**
   * Handle batch entity updates for performance optimization
   */
  private handleBatchEntities(message: LayerWebSocketMessage): void {
    if (!message.data?.entities) return;
    
    const entities = message.data.entities as EntityDataPoint[];
    const processedEntities = entities.map(entity => this.processEntity(entity));
    
    // Update cache and data in batch
    processedEntities.forEach(entity => {
      this.entityCache.set(entity.id, entity);
    });
    
    this.data = this.data.map(entity => {
      const updated = processedEntities.find(u => u.id === entity.id);
      return updated || entity;
    });
    
    // Trigger single re-render for batch
    this.scheduleRender();
    
    this.logAuditEvent('batch_entities_updated', {
      layerId: this.id,
      entityCount: entities.length,
      batchSize: processedEntities.length
    });
  }

  /**
   * Handle confidence score adjustments from entity extraction
   */
  private handleConfidenceAdjustment(message: LayerWebSocketMessage): void {
    const { entityId, newConfidence } = message.data;
    const entity = this.entityCache.get(entityId);
    
    if (entity) {
      (entity as any).confidence = newConfidence;
      // Reprocess visual properties with new confidence
      const reprocessedEntity = this.processEntity(entity);
      this.entityCache.set(entityId, reprocessedEntity);
      
      this.scheduleRender();
    }
  }

  /**
   * Schedule render with debouncing to prevent performance issues
   */
  private scheduleRender(): void {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    
    this.renderTimeout = setTimeout(() => {
      this.onDataChange?.(this.data);
    }, 100); // 100ms debounce
  }

  /**
   * Export layer configuration for persistence and sharing
   */
  exportLayerConfig(): any {
    return {
      id: this.id,
      type: 'point',
      config: {
        ...this.pointConfig,
        // Remove function references for serialization
        getPosition: undefined,
        getColor: undefined,
        getSize: undefined,
        getOpacity: undefined
      },
      visualChannels: this.getVisualChannels(),
      performance: this.getPerformanceMetrics(),
      clusterConfig: this.clusterConfig,
      auditTrail: this.auditTrail || []
    };
  }

  /**
   * Get current visual channels configuration
   */
  getVisualChannels(): any {
    return {
      position: typeof this.pointConfig.getPosition === 'function' ? 'custom_position_function' : null,
      color: this.pointConfig.getColor,
      size: this.pointConfig.getSize,
      opacity: this.pointConfig.getOpacity
    };
  }
  /**
   * Initialize GPU filtering infrastructure for performance optimization
   */
  private initializeGPUFiltering(): void {
    if (!this.pointConfig.gpuFilterConfig) return;

    const { gpuFilterConfig } = this.pointConfig;
    
    try {
      // Initialize GPU filter buffer
      this.gpuFilterBuffer = new Float32Array(this.data.length);
      
      // Pre-compute filter values for all entities
      this.updateGPUFilterBuffer();
      
      this.logAuditEvent('gpu_filtering_initialized', {
        layerId: this.id,
        bufferSize: this.data.length,
        filterRange: gpuFilterConfig.filterRange,
        batchSize: gpuFilterConfig.batchSize,
        useGPU: gpuFilterConfig.useGPU
      });
    } catch (error) {
      this.handleError('gpu_filtering_initialization_failed', error as Error);
      // Fallback to CPU filtering if GPU fails
      this.pointConfig.gpuFilterConfig.enabled = false;
    }
  }

  /**
   * Apply GPU filtering to optimize rendering performance
   */
  private applyGPUFiltering(): EntityDataPoint[] {
    if (!this.pointConfig.gpuFilterConfig?.enabled) {
      return this.data;
    }

    const startTime = performance.now();
    const gpuConfig = this.pointConfig.gpuFilterConfig;

    try {
      // Update filter buffer with latest data
      this.updateGPUFilterBuffer();
      
      let filteredData: EntityDataPoint[];
      
      if (gpuConfig.useGPU && this.filteredIndices) {
        // Use GPU-computed filtered indices
        filteredData = gpuConfig.getFiltered(this.filteredIndices, this.data);
      } else {
        // CPU fallback filtering
        const [minFilter, maxFilter] = gpuConfig.filterRange;
        filteredData = this.data.filter(entity => {
          const filterValue = gpuConfig.filteredValueAccessor(entity);
          return filterValue >= minFilter && filterValue <= maxFilter;
        });
      }
      
      const filterTime = performance.now() - startTime;
      const efficiency = (filteredData.length / this.data.length) * 100;
      
      this.logAuditEvent('gpu_filtering_applied', {
        layerId: this.id,
        originalCount: this.data.length,
        filteredCount: filteredData.length,
        filterEfficiency: efficiency,
        filterTime,
        gpuUsed: gpuConfig.useGPU
      });
      
      return filteredData;
    } catch (error) {
      this.handleError('gpu_filtering_failed', error as Error);
      // Fallback to unfiltered data
      return this.data;
    }
  }

  /**
   * Update GPU filter buffer with current entity values
   */
  private updateGPUFilterBuffer(): void {
    if (!this.gpuFilterBuffer || !this.pointConfig.gpuFilterConfig) return;

    const gpuConfig = this.pointConfig.gpuFilterConfig;
    const batchSize = gpuConfig.batchSize || 1000;
    
    // Process entities in batches to avoid blocking
    for (let i = 0; i < this.data.length; i += batchSize) {
      const batch = this.data.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const entity = batch[j];
        const filterValue = gpuConfig.filteredValueAccessor(entity);
        this.gpuFilterBuffer[i + j] = filterValue;
      }
    }
    
    // Mark buffer as updated for GPU processing
    this.updateTriggers.set('gpuFilterBuffer', Date.now());
  }

  /**
   * Create Deck.gl ScatterplotLayer configuration with GPU filtering integration
   */
  private createScatterplotLayerConfig(filteredData: EntityDataPoint[]): ScatterplotLayerConfig {
    const defaultConfig = {
      data: filteredData,
      getPosition: (entity: EntityDataPoint) => this.pointConfig.getPosition(entity),
      getFillColor: (entity: EntityDataPoint) => this.getEntityColor(entity),
      getRadius: (entity: EntityDataPoint) => this.getEntitySize(entity),
      radiusUnits: 'pixels' as const,
      stroked: false,
      filled: true,
      opacity: this.config.opacity,
      pickable: true,
      onClick: this.onClick.bind(this),
      onHover: this.onHover.bind(this),
      updateTriggers: {
        getPosition: this.updateTriggers.get('getPosition'),
        getFillColor: this.updateTriggers.get('getFillColor'),
        getRadius: this.updateTriggers.get('getRadius')
      },
      parameters: {
        depthTest: true,
        blend: true
      }
    };

    // Merge with user-provided scatterplot config
    return {
      ...defaultConfig,
      ...this.pointConfig.scatterplotConfig
    };
  }

  /**
   * Get entity color from visual channel configuration
   */
  private getEntityColor(entity: EntityDataPoint): [number, number, number, number] {
    const colorValue = this.applyVisualChannel(this.pointConfig.getColor, entity, entity.confidence || 0.5);
    
    // Convert to RGBA format expected by ScatterplotLayer
    if (Array.isArray(colorValue) && colorValue.length >= 3) {
      const [r, g, b] = colorValue;
      const a = (entity.confidence || 0.5) * 255;
      return [r, g, b, a];
    }
    
    // Default color mapping
    return [100, 150, 200, 200];
  }

  /**
   * Get entity size from visual channel configuration
   */
  private getEntitySize(entity: EntityDataPoint): number {
    const sizeValue = this.applyVisualChannel(this.pointConfig.getSize, entity, entity.confidence || 0.5);
    return typeof sizeValue === 'number' ? Math.max(1, sizeValue) : 5;
  }

  /**
   * Validate performance constraint compliance
   */
  private validatePerformanceConstraint(renderTime: number): void {
    const maxRenderTime = this.pointConfig.maxRenderTime || this.performanceTarget;
    
    if (renderTime > maxRenderTime) {
      this.handleError('performance_constraint_violation', new Error(
        `Render time ${renderTime.toFixed(2)}ms exceeds target ${maxRenderTime}ms`
      ), {
        renderTime,
        targetTime: maxRenderTime,
        entityCount: this.data.length
      });
      
      // Trigger performance optimization
      this.triggerPerformanceOptimization();
    }
  }

  /**
   * Update performance metrics with current render data
   */
  private updatePerformanceMetrics(renderTime: number, entityCount: number): void {
    if (this.performanceMetrics) {
      this.performanceMetrics.renderTime = renderTime;
      this.performanceMetrics.dataSize = entityCount;
      this.performanceMetrics.memoryUsage = this.estimateMemoryUsage();
      this.performanceMetrics.fps = renderTime > 0 ? 1000 / renderTime : 0;
      this.performanceMetrics.lastRenderTime = new Date().toISOString();
    }
  }

  // Enhanced methods for visual channel processing with confidence scoring
  private interpolateColor(value: any, scale: any, opacity: number): string {
    if (!scale || !Array.isArray(scale.range)) {
      return `rgba(100, 150, 200, ${opacity})`;
    }
    
    // Simple interpolation - in real implementation would use more sophisticated color mapping
    const range = scale.range as string[];
    const index = Math.floor(Math.random() * range.length);
    return range[index] || `rgba(100, 150, 200, ${opacity})`;
  }

  private calculateCacheHitRate(): number {
    const stats = this.getCacheStatistics();
    return stats.hitRate / 100;
  }

  private calculateAverageConfidence(entities: EntityDataPoint[]): number {
    if (entities.length === 0) return 0.5;
    
    const totalConfidence = entities.reduce((sum, entity) => 
      sum + (entity.confidence || 0.5), 0
    );
    return totalConfidence / entities.length;
  }

  private extractEntityHierarchy(entities: EntityDataPoint[]): any {
    // Build hierarchy relationships for navigation
    const hierarchyMap = new Map<string, any>();
    
    entities.forEach(entity => {
      if (entity.hierarchy) {
        hierarchyMap.set(entity.id, entity.hierarchy);
      }
    });
    
    return Object.fromEntries(hierarchyMap);
  }

  private checkPerformanceHealth(): void {
    const metrics = this.getPerformanceMetrics();
    if (!metrics) return;
    
    // Check if performance is degrading
    if (metrics.renderTime > this.performanceTarget * 1.5) {
      this.handleError('performance_degradation_detected', new Error(
        `Performance degradation: ${metrics.renderTime}ms > ${this.performanceTarget * 1.5}ms`
      ));
    }
  }

  /**
   * Trigger performance optimization when constraints are violated
   */
  protected triggerPerformanceOptimization(): void {
    this.logAuditEvent('performance_optimization_triggered', {
      layerId: this.id,
      reason: 'performance_constraint_violation',
      currentRenderTime: this.performanceMetrics?.renderTime,
      targetTime: this.performanceTarget
    });

    // Enable aggressive caching
    this.config.cacheEnabled = true;
    
    // Reduce data size through sampling if needed
    if (this.data.length > 5000) {
      this.performDataSampling();
    }

    // Trigger GPU filtering if available
    if (this.pointConfig.gpuFilterConfig && !this.pointConfig.gpuFilterConfig.enabled) {
      this.pointConfig.gpuFilterConfig.enabled = true;
      this.initializeGPUFiltering();
    }

    // Emit optimization event
    this.emit('performanceOptimization', {
      timestamp: new Date().toISOString(),
      reason: 'performance_constraint_violation'
    });
  }

  /**
   * Perform data sampling for performance optimization
   */
  protected performDataSampling(): void {
    if (this.data.length <= 1000) return;

    // Sample data to maintain performance
    const sampleRate = 1000 / this.data.length;
    const sampledData = this.data.filter(() => Math.random() < sampleRate);
    
    this.logAuditEvent('data_sampling_performed', {
      layerId: this.id,
      originalSize: this.data.length,
      sampledSize: sampledData.length,
      sampleRate
    });

    this.data = sampledData;
    this.invalidateCaches();
  }

  /**
   * Invalidate caches when data changes
   */
  protected invalidateCaches(): void {
    this.entityCache.clear();
    this.updateTriggers.clear();
  }

  /**
   * Clean up resources when layer is destroyed
   */
  dispose(): void {
    this.entityCache.clear();
    
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = null;
    }
    
    // Clean up GPU resources
    this.gpuFilterBuffer = null;
    this.filteredIndices = null;
    
    this.logAuditEvent('layer_disposed', {
      layerId: this.id,
      disposedEntities: this.data.length,
      finalPerformanceMetrics: this.getPerformanceMetrics()
    });
    
    // Call parent dispose method
    super.destroy();
  }
}

// Export factory function for dynamic layer creation
export function createPointLayer(
  props: Omit<PointLayerProps, 'config'> & { config: Partial<PointLayerConfig> }
): PointLayer {
  const fullConfig = createPointLayerConfig(props.config);
  return new PointLayer({ ...props, config: fullConfig });
}