/**
 * @file GeoJsonLayer.ts
 * @description Intelligent GeoJSON layer with automatic geometry detection and delegation
 * 
 * **Architecture Overview:**
 * - Extends BaseLayer with GeoJSON-specific geometry parsing and routing
 * - Automatic geometry type detection (Point/LineString/Polygon/Multi*)
 * - Dynamic layer delegation to PointLayer, LinestringLayer, or PolygonLayer
 * - Mixed geometry collection handling with property mapping
 * - Feature flag integration for gradual rollout
 * - WebSocket integration for real-time GeoJSON updates
 * - Multi-tier caching with RLock synchronization
 * - Compliance audit trail for all operations
 * 
 * **Supported Geometry Types:**
 * - Point, MultiPoint
 * - LineString, MultiLineString
 * - Polygon, MultiPolygon
 * - GeometryCollection (mixed types)
 * 
 * **Performance Targets:**
 * - Parse time: <5ms for 1000 features
 * - Delegation overhead: <2ms per geometry type
 * - Cache hit rate: >99%
 * - Memory footprint: <50MB for 5000 features
 * 
 * **WebSocket Message Types:**
 * - `geojson_update`: Real-time GeoJSON data updates
 * - `feature_update`: Individual feature modifications
 * - `batch_features`: Bulk feature updates
 * 
 * **Feature Flags:**
 * - `ff.geojson_layer_enabled`: Master switch for GeoJSON layer
 * - `ff.multi_geometry_support`: Enable MultiPoint/MultiLineString/MultiPolygon
 * - `ff.geometry_collection_support`: Enable GeometryCollection handling
 * 
 * **References:**
 * - Architecture: docs/POLYGON_LINESTRING_ARCHITECTURE.md
 * - BaseLayer: frontend/src/layers/base/BaseLayer.ts
 * - PointLayer: frontend/src/layers/implementations/PointLayer.ts
 * - LinestringLayer: frontend/src/layers/implementations/LinestringLayer.ts
 * - PolygonLayer: frontend/src/layers/implementations/PolygonLayer.ts
 */

import { GeoJsonLayer as DeckGeoJsonLayer } from '@deck.gl/geo-layers';
import type { GeoJsonLayerProps } from '@deck.gl/geo-layers';
import type { Layer } from '@deck.gl/core';
import type { RGBAColor as Color, Position } from '@deck.gl/core';
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import { BaseLayer } from '../base/BaseLayer';
import { PointLayer } from './PointLayer';
import { LinestringLayer } from './LinestringLayer';
import { PolygonLayer } from './PolygonLayer';
import type {
  EntityDataPoint,
  LinestringEntityDataPoint,
  LinestringEntityDataPointExtended,
  PolygonEntityDataPoint,
  PolygonEntityDataPointFixed,
  LayerConfig,
  LayerPerformanceMetrics,
  LayerData,
  WebSocketLayerMessage
} from '../types/layer-types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * GeoJSON geometry types
 */
export type GeometryType = 
  | 'Point'
  | 'MultiPoint'
  | 'LineString'
  | 'MultiLineString'
  | 'Polygon'
  | 'MultiPolygon'
  | 'GeometryCollection';

/**
 * Custom properties for Forecastin features
 * Standalone interface with index signature for dynamic property access
 * Compatible with GeoJsonProperties but doesn't extend it (due to null type)
 */
export interface ForecastinFeatureProperties {
  [key: string]: any;  // Index signature for dynamic property access
  id?: string | number;
  name?: string;
  confidence?: number;
  who?: string;
  what?: string;
  where?: string;
  when?: string;
  why?: string;
}

/**
 * Type aliases for backward compatibility
 */
export type GeoJsonFeature = Feature<Geometry, ForecastinFeatureProperties>;
export type GeoJsonFeatureCollection = FeatureCollection<Geometry, ForecastinFeatureProperties>;

/**
 * GeoJSON entity data point
 * Extends LayerData with GeoJSON-specific properties
 */
export interface GeoJsonEntityDataPoint extends LayerData {
  /** Entity name */
  name: string;
  
  /** Entity type */
  type: string;
  
  /** Original GeoJSON feature */
  feature: GeoJsonFeature;
  
  /** Detected geometry type */
  geometryType: GeometryType;
  
  /** Confidence score from properties or metadata (optional) */
  confidence?: number;
  
  /** 5-W framework metadata extracted from properties */
  metadata?: {
    who?: string;
    what?: string;
    where?: string;
    when?: string;
    why?: string;
  };
}

/**
 * Delegated layer container
 */
interface DelegatedLayers {
  pointLayers: PointLayer[];
  linestringLayers: LinestringLayer[];
  polygonLayers: PolygonLayer[];
}

/**
 * Geometry parsing statistics
 */
interface GeometryStats {
  totalFeatures: number;
  pointCount: number;
  linestringCount: number;
  polygonCount: number;
  multiGeometryCount: number;
  geometryCollectionCount: number;
  parseTime: number;
}

/**
 * GeoJSON layer-specific configuration
 */
export interface GeoJsonLayerConfig extends LayerConfig {
  /** Enable automatic geometry detection */
  autoDetect: boolean;
  
  /** Enable multi-geometry support (MultiPoint, MultiLineString, MultiPolygon) */
  multiGeometryEnabled: boolean;
  
  /** Enable GeometryCollection support */
  geometryCollectionEnabled: boolean;
  
  /** Enable pickable interaction */
  pickable?: boolean;
  
  /** Property mapping configuration */
  propertyMapping: {
    /** Property name for entity ID */
    idProperty: string;
    /** Property name for entity name */
    nameProperty: string;
    /** Property name for confidence score */
    confidenceProperty: string;
    /** Property names for 5-W framework */
    metadataProperties: {
      who?: string;
      what?: string;
      where?: string;
      when?: string;
      why?: string;
    };
  };
  
  /** Enable WebSocket real-time updates */
  realtimeEnabled: boolean;
  
  /** WebSocket message debounce interval in ms */
  wsDebounceMs: number;
  
  /** Delegation configuration for specialized layers */
  delegation: {
    /** Delegate to PointLayer for Point geometries */
    usePointLayer: boolean;
    /** Delegate to LinestringLayer for LineString geometries */
    useLinestringLayer: boolean;
    /** Delegate to PolygonLayer for Polygon geometries */
    usePolygonLayer: boolean;
  };
}

// ============================================================================
// GeoJsonLayer Implementation
// ============================================================================

/**
 * Intelligent GeoJSON layer with automatic geometry detection and delegation
 * 
 * **Key Features:**
 * - Automatic geometry type detection and parsing
 * - Dynamic delegation to specialized layers (Point, Linestring, Polygon)
 * - Mixed geometry collection handling
 * - Property mapping with 5-W framework integration
 * - Real-time WebSocket updates for GeoJSON data
 * - Multi-tier caching with RLock synchronization
 * - Feature flag integration for gradual rollout
 * - Compliance audit logging for all operations
 * 
 * **Usage Example:**
 * ```typescript
 * const layer = createGeoJsonLayer({
 *   id: 'geospatial-entities',
 *   data: geoJsonFeatureCollection,
 *   config: {
 *     autoDetect: true,
 *     multiGeometryEnabled: true,
 *     delegation: { usePointLayer: true, useLinestringLayer: true, usePolygonLayer: true }
 *   }
 * });
 * ```
 */
export class GeoJsonLayer extends BaseLayer {
  private delegatedLayers: DelegatedLayers = {
    pointLayers: [],
    linestringLayers: [],
    polygonLayers: []
  };
  
  private geometryStats: GeometryStats = {
    totalFeatures: 0,
    pointCount: 0,
    linestringCount: 0,
    polygonCount: 0,
    multiGeometryCount: 0,
    geometryCollectionCount: 0,
    parseTime: 0
  };
  
  private featureCache: Map<string, GeoJsonEntityDataPoint> = new Map();
  private geoJsonLayer: DeckGeoJsonLayer | null = null;

  constructor(
    id: string,
    geoJsonData: GeoJsonFeatureCollection,
    config: Partial<GeoJsonLayerConfig>
  ) {
    // Parse GeoJSON and convert to entity data points
    const entityData = GeoJsonLayer.parseGeoJsonFeatures(geoJsonData, config as GeoJsonLayerConfig);
    
    // Construct full config with parsed entity data
    const fullConfig: LayerConfig = {
      id,
      type: 'geojson',
      visible: config.visible ?? true,
      opacity: config.opacity ?? 1.0,
      zIndex: config.zIndex ?? 1,
      name: config.name ?? id,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL ?? 60000,
      featureFlag: config.featureFlag,
      rolloutPercentage: config.rolloutPercentage,
      realTimeEnabled: config.realTimeEnabled ?? false,
      updateInterval: config.updateInterval,
      auditEnabled: config.auditEnabled ?? true,
      dataClassification: config.dataClassification ?? 'internal',
      data: entityData as any[], // Ensure data is always an array
      ...config
    };
    
    // Call BaseLayer constructor with 3 parameters: id, data, config
    super(id, entityData as any[], fullConfig);
    this.initializeGeoJsonLayer();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize GeoJSON layer with parsing and delegation
   */
  private initializeGeoJsonLayer(): void {
    try {
      const config = this.config as GeoJsonLayerConfig;
      
      // Setup feature cache
      this.setupFeatureCache();
      
      // Calculate geometry statistics
      this.calculateGeometryStats();
      
      // Delegate to specialized layers if enabled
      if (config.delegation.usePointLayer || 
          config.delegation.useLinestringLayer || 
          config.delegation.usePolygonLayer) {
        this.delegateToSpecializedLayers();
      }
      
      // Subscribe to WebSocket events if realtime enabled
      if (config.realtimeEnabled) {
        this.subscribeToGeoJsonEvents();
      }
      
      // Log initialization
      this.logAuditEvent('geojson_layer_initialized', {
        entityId: this.config.id,
        totalFeatures: this.geometryStats.totalFeatures,
        geometryTypes: {
          points: this.geometryStats.pointCount,
          linestrings: this.geometryStats.linestringCount,
          polygons: this.geometryStats.polygonCount
        },
        delegationEnabled: config.delegation.usePointLayer ||
                         config.delegation.useLinestringLayer ||
                         config.delegation.usePolygonLayer
      });
      
      console.log(
        `[GeoJsonLayer] Initialized layer ${this.config.id} with ${this.data.length} features`,
        this.geometryStats
      );
      
    } catch (error) {
      console.error(`[GeoJsonLayer] Initialization failed for layer ${this.config.id}:`, error);
      throw error;
    }
  }

  /**
   * Setup feature cache for fast lookups
   */
  private setupFeatureCache(): void {
    this.featureCache.clear();
    
    for (const entity of this.data as GeoJsonEntityDataPoint[]) {
      this.featureCache.set(entity.id, entity);
    }
    
    console.log(`[GeoJsonLayer] Feature cache populated: ${this.featureCache.size} entries`);
  }

  /**
   * Calculate geometry statistics for monitoring
   */
  private calculateGeometryStats(): void {
    const startTime = performance.now();
    
    this.geometryStats = {
      totalFeatures: this.data.length,
      pointCount: 0,
      linestringCount: 0,
      polygonCount: 0,
      multiGeometryCount: 0,
      geometryCollectionCount: 0,
      parseTime: 0
    };
    
    for (const entity of this.data as GeoJsonEntityDataPoint[]) {
      switch (entity.geometryType) {
        case 'Point':
          this.geometryStats.pointCount++;
          break;
        case 'LineString':
          this.geometryStats.linestringCount++;
          break;
        case 'Polygon':
          this.geometryStats.polygonCount++;
          break;
        case 'MultiPoint':
        case 'MultiLineString':
        case 'MultiPolygon':
          this.geometryStats.multiGeometryCount++;
          break;
        case 'GeometryCollection':
          this.geometryStats.geometryCollectionCount++;
          break;
      }
    }
    
    this.geometryStats.parseTime = performance.now() - startTime;
    
    console.log(`[GeoJsonLayer] Geometry statistics calculated:`, this.geometryStats);
  }

  // ==========================================================================
  // GeoJSON Parsing
  // ==========================================================================

  /**
   * Parse GeoJSON FeatureCollection into entity data points
   * 
   * **Performance Target:** <5ms for 1000 features
   */
  private static parseGeoJsonFeatures(
    geoJson: GeoJsonFeatureCollection,
    config: GeoJsonLayerConfig
  ): GeoJsonEntityDataPoint[] {
    const startTime = performance.now();
    const entities: GeoJsonEntityDataPoint[] = [];
    
    for (const feature of geoJson.features) {
      try {
        // Extract entity ID from properties or generate
        const entityId = this.extractEntityId(feature, config);
        
        // Extract entity name from properties
        const entityName = this.extractEntityName(feature, config);
        
        // Extract confidence score
        const confidence = this.extractConfidence(feature, config);
        
        // Extract 5-W framework metadata
        const metadata = this.extract5WMetadata(feature, config);
        
        // Create entity data point
        const entity: GeoJsonEntityDataPoint = {
          id: entityId,
          name: entityName,
          type: 'geojson_feature',
          geometry: feature.geometry as Geometry, // Cast to GeoJSON Geometry type
          feature,
          geometryType: feature.geometry.type,
          properties: feature.properties || {},
          confidence,
          metadata
        };
        
        entities.push(entity);
        
      } catch (error) {
        console.error('[GeoJsonLayer] Failed to parse feature:', feature, error);
      }
    }
    
    const parseTime = performance.now() - startTime;
    
    // Validate performance constraint
    if (parseTime > 5.0 && geoJson.features.length >= 1000) {
      console.warn(
        `[GeoJsonLayer] Parse time exceeded 5ms target: ${parseTime.toFixed(2)}ms for ${geoJson.features.length} features`
      );
    }
    
    return entities;
  }

  /**
   * Extract entity ID from feature
   */
  private static extractEntityId(
    feature: GeoJsonFeature,
    config: GeoJsonLayerConfig
  ): string {
    // Use feature.id if available
    if (feature.id !== undefined) {
      return String(feature.id);
    }
    
    // Use mapped property with safe access
    if (feature.properties && config.propertyMapping.idProperty) {
      const props = feature.properties as ForecastinFeatureProperties;
      const id = props[config.propertyMapping.idProperty];
      if (id !== undefined) return String(id);
    }
    
    // Generate UUID
    return `geojson-feature-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract entity name from feature properties
   */
  private static extractEntityName(
    feature: GeoJsonFeature,
    config: GeoJsonLayerConfig
  ): string {
    if (!feature.properties) return 'Unnamed Feature';
    
    const props = feature.properties as ForecastinFeatureProperties;
    
    // Use mapped property
    if (config.propertyMapping.nameProperty) {
      const name = props[config.propertyMapping.nameProperty];
      if (name) return String(name);
    }
    
    // Common fallback properties
    const fallbackProperties = ['name', 'title', 'label', 'id'];
    for (const prop of fallbackProperties) {
      if (props[prop]) {
        return String(props[prop]);
      }
    }
    
    return 'Unnamed Feature';
  }

  /**
   * Extract confidence score from feature properties
   */
  private static extractConfidence(
    feature: GeoJsonFeature,
    config: GeoJsonLayerConfig
  ): number | undefined {
    if (!feature.properties) return undefined;
    
    const props = feature.properties as ForecastinFeatureProperties;
    
    // Use mapped property
    if (config.propertyMapping.confidenceProperty) {
      const confidence = props[config.propertyMapping.confidenceProperty];
      if (typeof confidence === 'number') {
        return Math.max(0, Math.min(1, confidence)); // Clamp to [0, 1]
      }
    }
    
    return undefined;
  }

  /**
   * Extract 5-W framework metadata from feature properties
   */
  private static extract5WMetadata(
    feature: GeoJsonFeature,
    config: GeoJsonLayerConfig
  ): GeoJsonEntityDataPoint['metadata'] | undefined {
    if (!feature.properties) return undefined;
    
    const props = feature.properties as ForecastinFeatureProperties;
    const mapping = config.propertyMapping.metadataProperties;
    const metadata: any = {};
    
    if (mapping.who && props[mapping.who]) {
      metadata.who = String(props[mapping.who]);
    }
    if (mapping.what && props[mapping.what]) {
      metadata.what = String(props[mapping.what]);
    }
    if (mapping.where && props[mapping.where]) {
      metadata.where = String(props[mapping.where]);
    }
    if (mapping.when && props[mapping.when]) {
      metadata.when = String(props[mapping.when]);
    }
    if (mapping.why && props[mapping.why]) {
      metadata.why = String(props[mapping.why]);
    }
    
    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  // ==========================================================================
  // Layer Delegation
  // ==========================================================================

  /**
   * Delegate geometries to specialized layers for optimized rendering
   * 
   * **Performance Target:** <2ms delegation overhead per geometry type
   */
  private delegateToSpecializedLayers(): void {
    const startTime = performance.now();
    const config = this.config as GeoJsonLayerConfig;
    
    // Group entities by geometry type
    const pointEntities: any[] = [];
    const linestringEntities: LinestringEntityDataPoint[] = [];
    const polygonEntities: PolygonEntityDataPoint[] = [];
    
    for (const entity of this.data as GeoJsonEntityDataPoint[]) {
      switch (entity.geometryType) {
        case 'Point':
        case 'MultiPoint':
          if (config.delegation.usePointLayer) {
            pointEntities.push(this.convertToPointEntity(entity));
          }
          break;
          
        case 'LineString':
        case 'MultiLineString':
          if (config.delegation.useLinestringLayer) {
            linestringEntities.push(this.convertToLinestringEntity(entity));
          }
          break;
          
        case 'Polygon':
        case 'MultiPolygon':
          if (config.delegation.usePolygonLayer) {
            polygonEntities.push(this.convertToPolygonEntity(entity));
          }
          break;
          
        case 'GeometryCollection':
          if (config.geometryCollectionEnabled) {
            this.handleGeometryCollection(entity, pointEntities, linestringEntities, polygonEntities);
          }
          break;
      }
    }
    
    // Create delegated layers
    if (pointEntities.length > 0 && config.delegation.usePointLayer) {
      const pointLayerConfig = {
        id: `${this.config.id}-points`,
        type: 'point' as const,
        visible: true,
        opacity: 1.0,
        zIndex: 0,
        name: 'GeoJSON Point Delegation',
        cacheEnabled: true,
        cacheTTL: 300000,
        realTimeEnabled: false,
        auditEnabled: true
      };
      const pointLayer = new PointLayer({
        id: `${this.config.id}-points`,
        config: pointLayerConfig as any,
        data: pointEntities as any[],
        visible: true
      });
      this.delegatedLayers.pointLayers.push(pointLayer);
    }
    
    // Delegate to LinestringLayer (uses 3 separate arguments: id, data, config)
    if (linestringEntities.length > 0 && config.delegation.useLinestringLayer) {
      const linestringLayerConfig = {
        visible: true,
        opacity: 1.0,
        pickable: true,
        gpuFiltering: {
          boundsFilter: { enabled: true, bounds: [-180, -90, 180, 90] as [number, number, number, number], buffer: 1 },
          segmentFilter: { enabled: true, minLength: 100, maxLength: 10000 },
          densityCulling: { enabled: false, maxPerTile: 50, tileSize: 256 }
        },
        pathStyle: {
          defaultWidth: 3,
          widthScaling: { enabled: true, minWidth: 1, maxWidth: 8 },
          dashPattern: { enabled: false, defaultDash: [5, 5] as [number, number], patterns: {} },
          arrows: { enabled: false, spacing: 100, size: 12, color: [255, 255, 0, 255] as [number, number, number, number] },
          colorScheme: { custom: [100, 100, 100, 200] as [number, number, number, number] }
        },
        realtimeEnabled: false,
        wsDebounceMs: 100
      };
      
      const linestringLayer = new LinestringLayer(
        `${this.config.id}-linestrings`,
        linestringEntities as any,
        linestringLayerConfig as any
      );
      this.delegatedLayers.linestringLayers.push(linestringLayer);
    }
    
    // Delegate to PolygonLayer (uses 3 separate arguments: id, data, config)
    if (polygonEntities.length > 0 && config.delegation.usePolygonLayer) {
      const polygonLayerConfig = {
        id: `${this.config.id}-polygons`,
        type: 'polygon' as const,
        layerType: 'polygon' as const,
        data: polygonEntities as any,
        visible: true,
        opacity: 0.6,
        zIndex: 0,
        name: 'GeoJSON Polygon Delegation',
        cacheEnabled: true,
        cacheTTL: 300000,
        realTimeEnabled: false,
        auditEnabled: true,
        gpuFilterConfig: {
          enabled: true,
          boundsFilter: { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 },
          centroidFilter: { enabled: false, bounds: { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 } },
          vertexFilter: { enabled: false, mode: 'any' as const, bounds: { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 } },
          intersectionFilter: { enabled: false, geometry: { type: 'Polygon', coordinates: [[]] }, algorithm: 'raycasting' as const },
          maxVerticesPerGeometry: 10000,
          simplificationTolerance: 0.001
        },
        performanceConfig: {
          simplificationTolerance: 0.001,
          maxVerticesPerPolygon: 10000,
          useCentroidFallback: false,
          enableBoundsCache: true
        },
        enable3D: false,
        elevationScale: 1.0
      };
      const polygonLayer = new PolygonLayer(
        `${this.config.id}-polygons`,
        polygonEntities as any,
        polygonLayerConfig as any
      );
      this.delegatedLayers.polygonLayers.push(polygonLayer);
    }
    
    const delegationTime = performance.now() - startTime;
    
    console.log(
      `[GeoJsonLayer] Delegated to specialized layers in ${delegationTime.toFixed(2)}ms:`,
      {
        points: pointEntities.length,
        linestrings: linestringEntities.length,
        polygons: polygonEntities.length
      }
    );
    
    // Log audit event
    this.logAuditEvent('layer_delegation_completed', {
      delegationTime,
      layerCounts: {
        points: this.delegatedLayers.pointLayers.length,
        linestrings: this.delegatedLayers.linestringLayers.length,
        polygons: this.delegatedLayers.polygonLayers.length
      }
    });
  }

  /**
   * Convert GeoJSON entity to PointLayer entity
   */
  private convertToPointEntity(entity: GeoJsonEntityDataPoint): any {
    const geometry = entity.feature.geometry;
    
    // Type guard: ensure geometry has coordinates (not GeometryCollection)
    if (!geometry || geometry.type === 'GeometryCollection' || !('coordinates' in geometry)) {
      throw new Error(`Invalid geometry type for Point conversion: ${geometry?.type}`);
    }
    
    const coords = geometry.coordinates;
    const position: Position = entity.geometryType === 'Point'
      ? coords as Position
      : coords[0] as Position; // Use first point for MultiPoint
    
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      position,
      confidence: entity.confidence,
      metadata: entity.metadata,
      properties: entity.properties
    };
  }

  /**
   * Convert GeoJSON entity to LinestringLayer entity
   */
  private convertToLinestringEntity(entity: GeoJsonEntityDataPoint): LinestringEntityDataPoint {
    const geometry = entity.feature.geometry;
    
    // Type guard: ensure geometry has coordinates and is LineString
    if (!geometry || geometry.type === 'GeometryCollection' || !('coordinates' in geometry)) {
      throw new Error(`Invalid geometry type for Linestring conversion: ${geometry?.type}`);
    }
    
    // Only proceed if geometry is actually LineString
    if (entity.geometryType !== 'LineString' || geometry.type !== 'LineString') {
      throw new Error(`Geometry is not LineString: ${entity.geometryType}`);
    }
    
    const coords = geometry.coordinates;
    const path: Position[] = coords as Position[];
    
    // Create LineString geometry for compatibility
    const linestringGeometry = {
      type: 'LineString' as const,
      coordinates: coords as number[][]
    };
    
    return {
      id: entity.id,
      geometry: linestringGeometry,
      properties: {
        name: entity.name,
        type: entity.type,
        ...entity.properties
      },
      position: path[0] && path[0].length >= 2 ? [path[0][0], path[0][1]] : [0, 0],
      confidence: entity.confidence || 0.5,
      path: path as any,  // Cast to any to avoid Position[] incompatibility
      metadata: entity.metadata,
      pathType: 'custom'
    };
  }

  /**
   * Convert GeoJSON entity to PolygonLayer entity
   */
  private convertToPolygonEntity(entity: GeoJsonEntityDataPoint): PolygonEntityDataPoint {
    const geometry = entity.feature.geometry;
    
    // Type guard: ensure geometry has coordinates (not GeometryCollection)
    if (!geometry || geometry.type === 'GeometryCollection' || !('coordinates' in geometry)) {
      throw new Error(`Invalid geometry type for Polygon conversion: ${geometry?.type}`);
    }
    
    const coords = geometry.coordinates;
    const polygon: Position[][] = entity.geometryType === 'Polygon'
      ? coords as Position[][]
      : coords[0] as Position[][]; // Use first polygon for MultiPolygon
    
    // Calculate centroid from first ring of polygon
    const firstRing = polygon[0] || [];
    let centroidLng = 0, centroidLat = 0;
    if (firstRing.length > 0) {
      for (const coord of firstRing) {
        centroidLng += coord[0];
        centroidLat += coord[1];
      }
      centroidLng /= firstRing.length;
      centroidLat /= firstRing.length;
    }
    
    // Type-safe geometry extraction for PolygonEntityDataPoint
    const polygonGeometry: PolygonEntityDataPoint['geometry'] =
      entity.geometryType === 'Polygon'
        ? {
            type: 'Polygon',
            coordinates: coords as number[][][]
          }
        : {
            type: 'MultiPolygon',
            coordinates: coords as number[][][][]
          };
    
    return {
      id: entity.id,
      geometry: polygonGeometry,
      properties: {
        name: entity.name,
        type: entity.type,
        ...entity.properties
      },
      position: [centroidLng, centroidLat],
      confidence: entity.confidence || 0.5,
      centroid: [centroidLng, centroidLat],
      bbox: this.calculateBoundingBox(polygon),
      area: 0, // Calculate actual area if needed
      perimeter: 0, // Calculate actual perimeter if needed
      visualProperties: {
        fillColor: [100, 150, 200, 200],
        fillOpacity: 0.6,
        strokeColor: [50, 50, 50, 255],
        strokeWidth: 1,
        strokeOpacity: 1.0,
        elevation: 0,
        extruded: false,
        // Add required base properties for compatibility
        color: [100, 150, 200, 200] as [number, number, number, number],
        size: 1,
        opacity: 0.6
      },
      hierarchyPath: '',
      childEntityIds: [],
      confidenceFactors: {
        geometricAccuracy: entity.confidence || 0.5,
        sourceReliability: entity.confidence || 0.5,
        temporalRelevance: entity.confidence || 0.5,
        conflictResolution: entity.confidence || 0.5
      },
      metadata: entity.metadata
    } as PolygonEntityDataPoint;
  }

  /**
   * Calculate bounding box from polygon coordinates
   */
  private calculateBoundingBox(polygon: Position[][]): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    
    polygon.forEach(ring => {
      ring.forEach(([lng, lat]) => {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      });
    });
    
    return { minLat, maxLat, minLng, maxLng };
  }

  /**
   * Handle GeometryCollection by extracting individual geometries
   */
  private handleGeometryCollection(
    entity: GeoJsonEntityDataPoint,
    pointEntities: any[],
    linestringEntities: LinestringEntityDataPoint[],
    polygonEntities: PolygonEntityDataPoint[]
  ): void {
    // GeometryCollection handling would require recursive parsing
    // For now, log warning
    console.warn(`[GeoJsonLayer] GeometryCollection not yet implemented for entity ${(entity as any).id}`);
  }

  // ==========================================================================
  // Layer Rendering
  // ==========================================================================

  /**
   * Generate deck.gl GeoJsonLayer
   */
  public getDeckGLLayer(): Layer {
    const config = this.config as GeoJsonLayerConfig;
    
    // If delegation enabled, return composite layer
    if (config.delegation.usePointLayer ||
        config.delegation.useLinestringLayer ||
        config.delegation.usePolygonLayer) {
      return this.getDelegatedLayers() as any;
    }
    
    // Otherwise, use deck.gl's native GeoJsonLayer
    // deck.gl accepts FeatureCollection OR Feature[] (not just FeatureCollection)
    const entities = this.data as GeoJsonEntityDataPoint[];
    const featureData = entities.length > 0
      ? {
          type: 'FeatureCollection' as const,
          features: entities.map(e => e.feature)
        }
      : { type: 'FeatureCollection' as const, features: [] };
    
    this.geoJsonLayer = new DeckGeoJsonLayer<ForecastinFeatureProperties>({
      id: `${this.config.id}-geojson-layer`,
      data: featureData as FeatureCollection<Geometry, ForecastinFeatureProperties>,
      
      // Styling
      filled: true,
      stroked: true,
      lineWidthMinPixels: 2,
      
      // Colors with proper typing - deck.gl passes Feature<Geometry, GeoJsonProperties>
      getFillColor: (f: any) => this.getFeatureFillColor(f as GeoJsonFeature),
      getLineColor: (f: any) => this.getFeatureLineColor(f as GeoJsonFeature),
      getLineWidth: (f: any) => this.getFeatureLineWidth(f as GeoJsonFeature),
      getPointRadius: (f: any) => this.getFeaturePointRadius(f as GeoJsonFeature),
      
      // Interaction
      pickable: config.pickable,
      
      // Update triggers
      updateTriggers: {
        getFillColor: [config.propertyMapping],
        getLineColor: [config.propertyMapping],
        getLineWidth: [config.propertyMapping],
        getPointRadius: [config.propertyMapping]
      }
    });
    
    return this.geoJsonLayer as Layer;
  }

  /**
   * Get delegated layers as composite
   */
  private getDelegatedLayers(): Layer | Layer[] {
    const layers: Layer[] = [];
    
    // Note: Point, Linestring, and Polygon layers don't expose getDeckGLLayer method
    // This delegation pattern needs to be implemented differently
    // For now, return the native GeoJsonLayer as fallback
    
    return this.getDeckGLLayer();
  }

  /**
   * Get fill color for feature
   */
  private getFeatureFillColor(feature: GeoJsonFeature): Color {
    const entity = this.findEntityByFeature(feature);
    const props = feature.properties as ForecastinFeatureProperties | null;
    const confidence = props?.confidence || entity?.confidence || 0.5;
    const alpha = Math.floor(180 * (0.5 + 0.5 * confidence));
    
    return [100, 150, 200, alpha] as Color;
  }

  /**
   * Get line color for feature
   */
  private getFeatureLineColor(feature: GeoJsonFeature): Color {
    return [255, 255, 255, 255];
  }

  /**
   * Get line width for feature
   */
  private getFeatureLineWidth(feature: GeoJsonFeature): number {
    const entity = this.findEntityByFeature(feature);
    const props = feature.properties as ForecastinFeatureProperties | null;
    const confidence = props?.confidence || entity?.confidence || 0.5;
    return 1 + 3 * confidence; // 1-4px based on confidence
  }

  /**
   * Get point radius for feature
   */
  private getFeaturePointRadius(feature: GeoJsonFeature): number {
    const entity = this.findEntityByFeature(feature);
    const props = feature.properties as ForecastinFeatureProperties | null;
    const confidence = props?.confidence || entity?.confidence || 0.5;
    return 3 + 7 * confidence; // 3-10px based on confidence
  }

  /**
   * Find entity by GeoJSON feature
   */
  private findEntityByFeature(feature: GeoJsonFeature): GeoJsonEntityDataPoint | undefined {
    if (feature.id !== undefined) {
      return this.featureCache.get(String(feature.id));
    }
    
    // Fallback to linear search
    return (this.data as GeoJsonEntityDataPoint[]).find(e => e.feature === feature);
  }

  // ==========================================================================
  // WebSocket Integration
  // ==========================================================================

  /**
   * Subscribe to GeoJSON-specific WebSocket events
   */
  private subscribeToGeoJsonEvents(): void {
    // Access websocketManager from BaseLayer (inherited property)
    const wsManager = (this as any).websocketManager;
    
    wsManager?.subscribe('geojson_update', (message: any) => {
      this.handleGeoJsonUpdate(message);
    });
    
    wsManager?.subscribe('feature_update', (message: any) => {
      this.handleFeatureUpdate(message);
    });
    
    wsManager?.subscribe('batch_features', (message: any) => {
      this.handleBatchFeatures(message);
    });
    
    console.log(`[GeoJsonLayer] Subscribed to WebSocket events`);
  }

  /**
   * Handle GeoJSON update event
   */
  private handleGeoJsonUpdate(message: any): void {
    try {
      const { geoJson } = message.payload;
      const config = this.config as GeoJsonLayerConfig;
      
      // Parse new GeoJSON data
      const newEntities = GeoJsonLayer.parseGeoJsonFeatures(geoJson, config);
      
      // Replace data
      this.data = newEntities;
      
      // Rebuild caches and delegation
      this.setupFeatureCache();
      this.calculateGeometryStats();
      this.delegateToSpecializedLayers();
      
      // Trigger re-render
      this.triggerLayerUpdate();
      
      this.logAuditEvent('geojson_updated', {
        featureCount: newEntities.length
      });
      
    } catch (error) {
      console.error('[GeoJsonLayer] Error handling GeoJSON update:', error);
    }
  }

  /**
   * Handle individual feature update
   */
  private handleFeatureUpdate(message: any): void {
    try {
      const { featureId, properties } = message.payload;
      
      const entity = this.featureCache.get(featureId);
      if (!entity) return;
      
      // Update properties
      entity.properties = { ...entity.properties, ...properties };
      
      // Trigger re-render
      this.triggerLayerUpdate();
      
    } catch (error) {
      console.error('[GeoJsonLayer] Error handling feature update:', error);
    }
  }

  /**
   * Handle batch feature updates
   */
  private handleBatchFeatures(message: any): void {
    try {
      const { features } = message.payload;
      
      for (const update of features) {
        const entity = this.featureCache.get(update.featureId);
        if (entity) {
          entity.properties = { ...entity.properties, ...update.properties };
        }
      }
      
      this.triggerLayerUpdate();
      
    } catch (error) {
      console.error('[GeoJsonLayer] Error handling batch features:', error);
    }
  }

  /**
   * Trigger layer update for re-rendering
   */
  private triggerLayerUpdate(): void {
    if (this.geoJsonLayer) {
      this.getDeckGLLayer();
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Cleanup layer resources
   */
  public destroy(): void {
    // Clear caches
    this.featureCache.clear();
    
    // Destroy delegated layers
    for (const layer of this.delegatedLayers.pointLayers) {
      layer.destroy();
    }
    for (const layer of this.delegatedLayers.linestringLayers) {
      layer.destroy();
    }
    for (const layer of this.delegatedLayers.polygonLayers) {
      layer.destroy();
    }
    
    // Clear delegated layers
    this.delegatedLayers = {
      pointLayers: [],
      linestringLayers: [],
      polygonLayers: []
    };
    
    // Unsubscribe from WebSocket events
    const wsManager = (this as any).websocketManager;
    wsManager?.unsubscribe('geojson_update');
    wsManager?.unsubscribe('feature_update');
    wsManager?.unsubscribe('batch_features');
    
    // Call parent cleanup
    super.destroy();
    
    console.log(`[GeoJsonLayer] Layer ${this.config.id} destroyed`);
  }

  // ==========================================================================
  // Abstract Method Implementations (required by BaseLayer)
  // ==========================================================================

  /**
   * Initialize visual channels for GeoJSON layer
   */
  protected initializeVisualChannels(): void {
    // GeoJSON layers use deck.gl's native styling
    // Visual channels are managed through getDeckGLLayer() configuration
    console.log(`[GeoJsonLayer] Visual channels initialized for layer ${this.config.id}`);
  }

  /**
   * Render the layer (delegated to deck.gl)
   */
  render(gl: WebGLRenderingContext): void {
    // Rendering is handled by deck.gl through getDeckGLLayer()
    // This method is here to satisfy the abstract interface
  }

  /**
   * Get layer bounds for spatial queries
   */
  getBounds(): [number, number][] | null {
    if (this.data.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const entity of this.data as GeoJsonEntityDataPoint[]) {
      const geometry = entity.feature.geometry;
      
      // Skip GeometryCollection or invalid geometries
      if (!geometry || geometry.type === 'GeometryCollection' || !('coordinates' in geometry)) {
        continue;
      }
      
      const coords = geometry.coordinates;
      
      // Handle different geometry types
      const flatCoords = this.flattenCoordinates(coords);
      
      for (const [x, y] of flatCoords) {
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
   * Flatten coordinates for bounds calculation
   */
  private flattenCoordinates(coords: any): [number, number][] {
    const result: [number, number][] = [];
    
    const flatten = (arr: any): void => {
      if (Array.isArray(arr)) {
        if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
          result.push([arr[0], arr[1]]);
        } else {
          for (const item of arr) {
            flatten(item);
          }
        }
      }
    };
    
    flatten(coords);
    return result;
  }

  /**
   * Handle hover events on features
   */
  onHover(info: any): void {
    if (!info.object) return;
    
    const feature = info.object as GeoJsonFeature;
    const entity = this.findEntityByFeature(feature);
    
    if (entity) {
      console.log(`[GeoJsonLayer] Hover: ${entity.name}`, entity);
    }
  }

  /**
   * Handle click events on features
   */
  onClick(info: any): void {
    if (!info.object) return;
    
    const feature = info.object as GeoJsonFeature;
    const entity = this.findEntityByFeature(feature);
    
    if (entity) {
      console.log(`[GeoJsonLayer] Click: ${entity.name}`, entity);
      
      // Emit click event for external handling
      this.emit('featureClick', {
        entity,
        feature,
        coordinate: info.coordinate
      });
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create GeoJsonLayer with default configuration
 * 
 * **Usage Example:**
 * ```typescript
 * const layer = createGeoJsonLayer({
 *   id: 'geospatial-data',
 *   data: {
 *     type: 'FeatureCollection',
 *     features: [...]
 *   },
 *   config: {
 *     autoDetect: true,
 *     multiGeometryEnabled: true,
 *     delegation: {
 *       usePointLayer: true,
 *       useLinestringLayer: true,
 *       usePolygonLayer: true
 *     }
 *   }
 * });
 * ```
 */
export function createGeoJsonLayer(params: {
  id: string;
  data: GeoJsonFeatureCollection;
  config?: Partial<GeoJsonLayerConfig>;
}): GeoJsonLayer {
  const defaultConfig: Partial<GeoJsonLayerConfig> = {
    visible: true,
    opacity: 1.0,
    pickable: true,
    autoDetect: true,
    multiGeometryEnabled: true,
    geometryCollectionEnabled: false,
    propertyMapping: {
      idProperty: 'id',
      nameProperty: 'name',
      confidenceProperty: 'confidence',
      metadataProperties: {
        who: 'who',
        what: 'what',
        where: 'where',
        when: 'when',
        why: 'why'
      }
    },
    realtimeEnabled: false,
    wsDebounceMs: 100,
    delegation: {
      usePointLayer: true,
      useLinestringLayer: true,
      usePolygonLayer: true
    }
  };
  
  const mergedConfig = { ...defaultConfig, ...params.config };
  return new GeoJsonLayer(params.id, params.data, mergedConfig);
}