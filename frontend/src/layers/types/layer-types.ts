/**
 * Comprehensive Geospatial Layer Type Definitions
 * Following kepler.gl patterns with forecastin integration
 * Implements strict TypeScript type safety for GPU filtering and hybrid state management
 */

import { Feature, Geometry, Point, LineString, Polygon, MultiPolygon, Position } from 'geojson';

// Forward declare BaseLayer to avoid circular dependency
export type { BaseLayer } from '../base/BaseLayer';

// Re-export existing forecastin types for consistency
export type { Entity, EntityData, EntityId, ConfidenceScore } from '../../types';

// Re-export geojson Position type for convenience
export type { Position };

// Base entity data point - generic on geometry type
// This is the foundation type that all entity-specific types build upon
interface BaseEntityDataPoint<G extends Geometry = Geometry> extends LayerData<G> {
  id: string;
  position: [number, number, number?]; // [lng, lat, altitude?]
  confidence: number;
  hierarchy?: {
    entityId: string;
    path: string;
    depth: number; // Changed from pathDepth to match LayerData interface
    ancestors: string[];
    descendants: string[];
  };
  visualProperties?: {
    color: string | [number, number, number, number]; // RGBA
    size: number;
    opacity: number;
  };
  // Additional entity-specific properties
  title?: string;
  organization?: string;
  location?: string;
}

// Entity data point for point layers - type alias using Point geometry
export type EntityDataPoint = BaseEntityDataPoint<Point>;

// Linestring entity data point - interface with LineString-specific properties
export interface LinestringEntityDataPoint extends BaseEntityDataPoint<LineString> {
  // LineString-specific properties required by LinestringLayer
  path: Position[]; // Ordered array of [longitude, latitude] coordinates
  width?: number;
  color?: [number, number, number, number];
  dashArray?: [number, number] | null;
  showArrows?: boolean;
  arrowSpacing?: number;
  metadata?: {
    who?: string;
    what?: string;
    where?: string;
    when?: string;
    why?: string;
  };
  pathType?: 'route' | 'boundary' | 'connection' | 'flow' | 'custom';
}

// Polygon entity data point - interface with Polygon-specific properties
export interface PolygonEntityDataPoint extends BaseEntityDataPoint<Polygon | MultiPolygon> {
  // Visual styling properties (top-level for direct access)
  fillColor?: [number, number, number, number];
  strokeColor?: [number, number, number, number];
  strokeWidth?: number;
  filled?: boolean;
  extruded?: boolean;
  elevation?: number;
  
  // Polygon-specific computed properties
  centroid?: [number, number]; // [lng, lat] centroid for filtering
  bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number }; // Bounding box for spatial queries
  area?: number; // Polygon area in square meters
  perimeter?: number; // Polygon perimeter in meters
  
  // Hierarchy path for LTREE filtering
  hierarchyPath?: string; // LTREE path for hierarchy-based filtering
  
  // Override visualProperties to match PolygonLayer requirements
  visualProperties?: {
    fillColor?: [number, number, number, number];
    strokeColor?: [number, number, number, number];
    strokeWidth?: number;
    filled?: boolean;
    extruded?: boolean;
    elevation?: number;
    fillOpacity?: number; // Opacity for fill color
    // Include base properties for compatibility (required)
    color: string | [number, number, number, number];
    size: number;
    opacity: number;
  };
}

// Extended types that explicitly include all required properties
export interface LinestringEntityDataPointExtended extends LinestringEntityDataPoint {
  // Explicitly include geometry and properties from LayerData<LineString>
  geometry: LineString | null;
  properties: Record<string, any> & { [key: string]: any };
  
  // Additional extended properties
  arrowSize?: number;
  arrowFrequency?: number;
  bidirectional?: boolean;
}

export interface PolygonEntityDataPointExtended extends PolygonEntityDataPoint {
  // Explicitly include geometry and properties from LayerData<Polygon | MultiPolygon>
  geometry: Polygon | MultiPolygon | null;
  properties: Record<string, any> & { [key: string]: any };
  
  // Additional extended properties
  wireframe?: boolean;
  elevationScale?: number;
  metadata?: Record<string, any>;
}

// Comprehensive Layer Visual Configuration with GPU filtering integration
export interface LayerVisConfig {
  // Core visual properties
  visible: boolean;
  opacity: number;
  zIndex: number;
  
  // Visual channel configurations
  position?: {
    lat: string;
    lng: string;
    altitude?: string;
    elevationScale?: number;
  };
  
  color?: VisualChannel & {
    colorScale?: 'sequential' | 'diverging' | 'categorical';
    colorSpace?: 'rgb' | 'hsl' | 'lab' | 'lch';
    colorRange?: string[];
  };
  
  size?: VisualChannel & {
    sizeScale?: number;
    sizeRange?: [number, number];
    radiusMinPixels?: number;
    radiusMaxPixels?: number;
  };
  
  opacityChannel?: VisualChannel & {
    opacityRange?: [number, number];
  };
  
  text?: VisualChannel & {
    textField?: string;
    textSize?: number;
    textSizeScale?: number;
    textFont?: string | string[];
    textAnchor?: 'start' | 'end' | 'center';
    textAlignment?: 'left' | 'right' | 'center';
  };

  // GPU filtering integration
  filterConfig?: GPUFilterConfig;
  
  // Performance and rendering
  pickable: boolean;
  updateTriggers?: FilterUpdateTriggers;
  
  // Material and styling
  material?: {
    ambient: number;
    diffuse: number;
    shininess: number;
    specularColor: string;
  };
  
  // Advanced visual effects
  effects?: {
    bloom?: boolean;
    bloomThreshold?: number;
    bloomStrength?: number;
  };
}

// GPU Filtering Integration Types
export type FilterValue = string | number | boolean | null | undefined | FilterRange | FilterDomain;

export interface FilterRange {
  min: number;
  max: number;
  inclusive?: boolean;
}

export interface FilterDomain {
  values: FilterValue[];
  domainType: 'categorical' | 'quantitative' | 'temporal' | 'spatial';
}

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: FilterValue;
  domain?: FilterDomain;
  description?: string;
}

export type FilterOperator = 
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts_with' | 'ends_with' | 'in_range'
  | 'within' | 'intersects' | 'contains_point';

export interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
  enabled: boolean;
}

export interface GPUFilterConfig {
  enabled: boolean;
  filters: FilterGroup[];
  performance: {
    batchSize: number;
    maxFilters: number;
    enableGPU: boolean;
    memoryLimit: number; // MB
  };
  ui: {
    showFilterPanel: boolean;
    collapsible: boolean;
    defaultExpanded: boolean;
  };
}

// Filter Update Triggers for reactive updates
export interface FilterUpdateTriggers {
  // Global update trigger
  global?: number;
  
  // Conditional triggers
  conditional?: {
    [conditionId: string]: number | string;
  };
  
  // Timestamp of last update for each field (index signature last)
  [fieldName: string]: number | string | undefined | { [conditionId: string]: number | string };
}

// Enhanced Layer Configuration with strict typing
export interface EnhancedLayerConfig extends Omit<LayerConfig, 'data' | 'featureFlag'> {
  visConfig: LayerVisConfig;
  data: {
    id: string;
    label: string;
    fields: LayerField[];
  };
  
  // Strict feature flag integration (overrides base type)
  featureFlag?: {
    flagName: string;
    enabled: boolean;
    rolloutPercentage: number;
  };
  
  // Additional properties for enhanced configuration
  security?: {
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
    encryptionAtRest?: boolean;
  };
  
  optimization?: {
    performanceMode?: 'optimized' | 'standard' | 'performance';
    cacheStrategy?: string;
  };
}

// Layer field definitions with strict typing
export interface LayerField {
  name: string;
  type: LayerFieldType;
  format?: string;
  description?: string;
  nullable: boolean;
  defaultValue?: any;
  
  // Validation constraints
  constraints?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
    required?: boolean;
  };
  
  // Geospatial-specific properties
  geospatial?: {
    coordinateSystem?: 'WGS84' | 'WebMercator' | 'Custom';
    precision?: number;
    crs?: string;
    srid?: number;
  };
  
  // Entity hierarchy integration
  hierarchy?: {
    isKey: boolean;
    parentField?: string;
    depthField?: string;
    pathField?: string;
  };
}

export type LayerFieldType = 
  | 'string' | 'number' | 'boolean' | 'date' | 'datetime'
  | 'geometry' | 'point' | 'linestring' | 'polygon' | 'multipoint'
  | 'multilinestring' | 'multipolygon' | 'geometrycollection'
  | 'json' | 'text' | 'integer' | 'float' | 'decimal'
  | 'timestamp' | 'uuid' | 'email' | 'url';

// Enhanced geospatial feature flags
export interface GeospatialFeatureFlags {
  // Core map features
  mapV1Enabled: boolean;
  mapV2Enabled: boolean;
  advancedLayers: boolean;
  customProjections: boolean;
  
  // Layer types
  layerTypes: {
    point: FeatureFlagConfig;
    polygon: FeatureFlagConfig;
    linestring: FeatureFlagConfig;
    heatmap: FeatureFlagConfig;
    cluster: FeatureFlagConfig;
    hexagon: FeatureFlagConfig;
    terrain: FeatureFlagConfig;
    imagery: FeatureFlagConfig;
    geojson: FeatureFlagConfig;
  };
  
  // Performance and optimization
  performance: {
    gpuAcceleration: boolean;
    wasmOptimization: boolean;
    webWorkers: boolean;
    levelOfDetail: boolean;
    frustumCulling: boolean;
    occlusionCulling: boolean;
  };
  
  // Advanced features
  advanced: {
    gpuFiltering: boolean;
    realTimeUpdates: boolean;
    collaborativeEditing: boolean;
    advancedStyling: boolean;
    customMaterials: boolean;
    postProcessing: boolean;
  };
  
  // Experimental features
  experimental: {
    vrSupport: boolean;
    arSupport: boolean;
    aiAssistedStyling: boolean;
    predictiveCaching: boolean;
    quantumComputing: boolean;
  };
  
  // Compliance and security
  compliance: {
    auditLogging: boolean;
    dataClassification: boolean;
    encryptionAtRest: boolean;
    gdprCompliance: boolean;
    soxCompliance: boolean;
  };
}

// Enhanced Feature Flag Configuration
export interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  minimumUserId?: string;
  
  // Targeting rules
  conditions?: {
    userProperties?: {
      role?: string[];
      department?: string[];
      location?: string[];
      device?: string[];
      [key: string]: any;
    };
    environment?: string[];
    timeRange?: {
      start: string;
      end: string;
    };
    percentage?: {
      value: number;
      seed?: string;
    };
  };
  
  // A/B testing configuration
  abTest?: {
    testId: string;
    variant: string;
    trafficAllocation: number;
    conversionGoals?: string[];
    successMetrics?: string[];
  };
  
  // Risk management
  risk?: {
    level: 'low' | 'medium' | 'high' | 'critical';
    rollbackEnabled: boolean;
    monitoringEnabled: boolean;
    alertThresholds?: {
      errorRate?: number;
      performance?: number;
      userSatisfaction?: number;
    };
  };
}

// Performance monitoring and compliance types
export interface LayerPerformanceMetrics {
  // Base performance metrics
  layerId: string;
  renderTime: number;
  dataSize: number;
  memoryUsage: number;
  cacheHitRate: number;
  lastRenderTime: string;
  fps: number;
  
  // Enhanced SLO compliance tracking (required)
  sloCompliance: {
    targetResponseTime: number; // 1.25ms target
    currentP95: number;
    currentP99: number;
    complianceRate: number; // Percentage of requests under target
    violations: number;
    lastViolation?: string;
  };
  
  // Resource usage
  gpu?: {
    memoryUsage: number; // MB
    memoryLimit: number; // MB
    utilization: number; // 0-100%
    computeUnits: number;
    temperature?: number;
  };
  
  // Network and I/O
  network?: {
    bandwidth: number; // Mbps
    latency: number; // ms
    packetLoss: number; // 0-1
    connectionType: 'wifi' | '4g' | '5g' | 'ethernet' | 'unknown';
  };
  
  // Battery and device optimization
  device?: {
    batteryLevel?: number; // 0-100
    isLowPowerMode: boolean;
    thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
    memoryPressure: 'normal' | 'warning' | 'critical';
  };
}

// Hybrid state management integration types
export interface HybridLayerState {
  // React Query integration
  query: {
    data?: LayerData[];
    isLoading: boolean;
    error?: string;
    lastUpdated: string;
    staleTime: number;
    cacheTime: number;
    refetchOnMount: boolean | 'always';
    refetchOnWindowFocus: boolean;
    retry: boolean | number;
  };
  
  // Zustand UI state
  ui: {
    visible: boolean;
    opacity: number;
    selected: boolean;
    hovered: boolean;
    zIndex: number;
    panelOpen: boolean;
    settingsExpanded: boolean;
  };
  
  // WebSocket real-time state
  realtime: {
    connected: boolean;
    lastUpdate: string;
    pendingUpdates: number;
    syncStatus: 'synced' | 'pending' | 'error' | 'disconnected';
    autoSync: boolean;
  };
  
  // Derived/computed state
  derived: {
    filteredData?: LayerData[];
    aggregatedData?: LayerData[];
    bounds?: [number, number][];
    statistics?: LayerStatistics;
  };
}

// Layer statistics and analytics
export interface LayerStatistics {
  featureCount: number;
  visibleCount: number;
  filteredCount: number;
  errorCount: number;
  
  // Geometry statistics
  geometryTypes: Record<string, number>;
  spatialExtent: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ?: number;
    maxZ?: number;
  };
  
  // Attribute statistics
  attributeStats: Record<string, {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    stdDev?: number;
    nullCount: number;
    uniqueCount: number;
  }>;
  
  // Performance statistics
  renderTime: {
    average: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  
  // Last updated timestamp
  lastCalculated: string;
}

// WebSocket-safe serialization types (following orjson pattern)
export interface SerializableValue {
  __type?: string;
  iso?: string; // For Date objects
  [key: string]: any;
}

export interface WebSocketSafeMessage {
  type: string;
  payload: {
    layerId: string;
    data?: SerializableValue[];
    timestamp: string;
    safeSerialized: true; // Mark as safely serialized
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    userId?: string;
    sessionId: string;
    requestId: string;
  };
}

// Layer event types with enhanced error handling
export interface LayerEventWithContext extends LayerEvent {
  // Error context
  errorContext?: {
    recoverable: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    retryable: boolean;
    fallbackStrategy?: string;
  };
  
  // Performance context
  performanceContext?: {
    renderTime: number;
    dataSize: number;
    cacheHit: boolean;
    gpuUsed: boolean;
  };
  
  // User context
  userContext?: {
    userId?: string;
    permissions: string[];
    sessionId: string;
  };
  
  // Audit information
  auditContext?: {
    actionId: string;
    riskLevel: 'low' | 'medium' | 'high';
    complianceFlags: string[];
    ipAddress?: string;
    userAgent?: string;
  };
}

// Strict validation schemas
export interface LayerValidationSchema {
  config: {
    required: string[];
    optional: string[];
    constraints: Record<string, {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      min?: number;
      max?: number;
      pattern?: RegExp;
      enum?: any[];
      customValidator?: (value: any) => boolean;
    }>;
  };
  
  data: {
    schema: LayerField[];
    validationLevel: 'strict' | 'permissive' | 'offline';
    errorHandling: 'throw' | 'warn' | 'skip' | 'coerce';
  };
  
  visual: {
    channelValidation: boolean;
    rangeValidation: boolean;
    typeChecking: boolean;
    strictMode: boolean;
  };
}

// Type guards for runtime type checking
export const isLayerData = (value: any): value is LayerData => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.geometry === 'object'
  );
};

export const isVisualChannel = (value: any): value is VisualChannel => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.name === 'string' &&
    typeof value.property === 'string' &&
    typeof value.type === 'string'
  );
};

export const isGPUFilterConfig = (value: any): value is GPUFilterConfig => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.enabled === 'boolean' &&
    Array.isArray(value.filters)
  );
};

// Utility types for strict type safety
export type RequiredLayerConfig = Pick<LayerConfig, 'id' | 'type' | 'data' | 'visible' | 'opacity' | 'zIndex' | 'name'>;

export type OptionalLayerConfig = Partial<Omit<LayerConfig, 'id' | 'type' | 'data' | 'visible' | 'opacity' | 'zIndex' | 'name'>>;

export type CompleteLayerConfig = RequiredLayerConfig & OptionalLayerConfig & {
  visConfig: Required<LayerVisConfig>;
  featureFlag?: FeatureFlagConfig;
  security?: {
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
    encryptionAtRest?: boolean;
  };
  optimization?: {
    performanceMode?: 'optimized' | 'standard' | 'performance';
    cacheStrategy?: string;
  };
};

// Constants for type safety
export const LAYER_TYPES = [
  'point', 'polygon', 'linestring', 'heatmap', 'cluster',
  'hexagon', 'geojson', 'terrain', 'imagery'
] as const;

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Legacy interface names for existing implementations
export type BaseLayerConfig = LayerConfig;
export type VisualChannelConfig = VisualChannel;
export type ComplianceAuditEntry = LayerAuditEntry;

// Legacy GPU Filter Config (PointLayer compatibility)
export interface LegacyGPUFilterConfig {
  enabled: boolean;
  filterRange: [number, number];
  filteredValueAccessor: (entity: EntityDataPoint) => number;
  getFilterValue: (entities: EntityDataPoint[]) => Float32Array;
  getFiltered: (filteredIndices: Uint8Array, originalData: EntityDataPoint[]) => EntityDataPoint[];
  batchSize: number;
  useGPU: boolean;
}

// Legacy Scatterplot Layer Config (PointLayer compatibility)
export interface LegacyScatterplotLayerConfig {
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

// Legacy Point Layer Config (PointLayer compatibility)
export interface LegacyPointLayerConfig extends BaseLayerConfig {
  getPosition: (entity: EntityDataPoint) => [number, number, number?];
  getColor: VisualChannelConfig;
  getSize: VisualChannelConfig;
  getOpacity: VisualChannelConfig;
  scatterplotConfig?: Partial<LegacyScatterplotLayerConfig>;
  enableClustering: boolean;
  clusterRadius: number;
  maxZoomLevel: number;
  minZoomLevel: number;
  gpuFilterConfig?: LegacyGPUFilterConfig;
  entityDataMapping: {
    positionField: string;
    colorField: string;
    sizeField?: string;
    entityIdField: string;
    confidenceField: string;
  };
  performanceTarget: number;
  maxRenderTime: number;
}

// Legacy Point Layer Props (PointLayer compatibility)
export interface LegacyPointLayerProps {
  id: string;
  config: LegacyPointLayerConfig;
  data: EntityDataPoint[];
  visible: boolean;
  opacity?: number;
  zIndex?: number;
}

// Legacy WebSocket message type for PointLayer compatibility
export interface LegacyWebSocketLayerMessage {
  type: string;
  data?: {
    entity?: EntityDataPoint;
    entities?: EntityDataPoint[];
    entityId?: string;
    newConfidence?: number;
  };
  timestamp: string;
  layerId?: string;
}

// Legacy EntityData type for backward compatibility
export type LegacyEntityData = EntityDataPoint[];

// Type assertion helpers for legacy compatibility
export const asLegacyConfig = (config: EnhancedLayerConfig): LegacyPointLayerConfig => {
  const result = {
    ...config,
    data: [], // Provide default empty array for legacy compatibility
    ...(config.featureFlag?.flagName !== undefined && { featureFlag: config.featureFlag?.flagName }),
    getPosition: config.position ?
      (entity: EntityDataPoint) => {
        const lat = config.position?.lat ? (entity as any)[config.position.lat] : 0;
        const lng = config.position?.lng ? (entity as any)[config.position.lng] : 0;
        const altitude = config.position?.altitude ? (entity as any)[config.position.altitude] : undefined;
        return [lng, lat, altitude];
      } :
      (entity: EntityDataPoint) => entity.position || [0, 0],
    getColor: config.color as VisualChannelConfig,
    getSize: config.size as VisualChannelConfig,
    getOpacity: config.opacityChannel as VisualChannelConfig,
    enableClustering: false,
    clusterRadius: 50,
    maxZoomLevel: 18,
    minZoomLevel: 0,
    performanceTarget: 100,
    maxRenderTime: 100,
    entityDataMapping: {
      positionField: 'position',
      colorField: 'color',
      sizeField: 'size',
      entityIdField: 'id',
      confidenceField: 'confidence'
    }
  } as LegacyPointLayerConfig;

  return result;
};

// ============================================================================
// TYPE VALIDATION AND ASSERTION FUNCTIONS
// ============================================================================

export const validateLayerData = (data: any[]): data is LayerData[] => {
  return Array.isArray(data) && data.every(isLayerData);
};

export const validateVisualChannel = (channel: any): channel is VisualChannel => {
  return isVisualChannel(channel);
};

export const validateGPUFilterConfig = (config: any): config is GPUFilterConfig => {
  return isGPUFilterConfig(config);
};

export const validateEnhancedLayerConfig = (config: any): config is EnhancedLayerConfig => {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.id === 'string' &&
    typeof config.type === 'string' &&
    Array.isArray(config.data) &&
    typeof config.visible === 'boolean' &&
    typeof config.opacity === 'number' &&
    typeof config.zIndex === 'number' &&
    typeof config.name === 'string'
  );
};

// ============================================================================
// COMPREHENSIVE TYPE GUARDS
// ============================================================================

export const isEntityDataPoint = (value: any): value is EntityDataPoint => {
  return (
    isLayerData(value) &&
    typeof value.id === 'string' &&
    'position' in value &&
    Array.isArray((value as any).position) &&
    (value as any).position.length >= 2 &&
    typeof value.confidence === 'number'
  );
};

export const isLayerVisConfig = (value: any): value is LayerVisConfig => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.visible === 'boolean' &&
    typeof value.opacity === 'number' &&
    typeof value.zIndex === 'number' &&
    typeof value.pickable === 'boolean'
  );
};

export const isGeospatialFeatureFlags = (value: any): value is GeospatialFeatureFlags => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.mapV1Enabled === 'boolean' &&
    typeof value.layerTypes === 'object' &&
    typeof value.performance === 'object' &&
    typeof value.advanced === 'object'
  );
};

export const isFilterCondition = (value: any): value is FilterCondition => {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.field === 'string' &&
    typeof value.operator === 'string' &&
    'value' in value
  );
};

// ============================================================================
// COMPREHENSIVE ENUM ARRAYS FOR TYPE SAFETY
// ============================================================================

export const LAYER_FIELD_TYPES: LayerFieldType[] = [
  'string', 'number', 'boolean', 'date', 'datetime',
  'geometry', 'point', 'linestring', 'polygon', 'multipoint',
  'multilinestring', 'multipolygon', 'geometrycollection',
  'json', 'text', 'integer', 'float', 'decimal',
  'timestamp', 'uuid', 'email', 'url'
];

export const COORDINATE_SYSTEMS = ['LNGLAT', 'METER_OFFSETS', 'CARTESIAN'] as const;
export const VISUAL_CHANNEL_TYPES_LIST = ['categorical', 'quantitative', 'ordinal'] as const;
export const FILTER_OPERATORS_LIST = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 
  'starts_with', 'ends_with', 'in_range', 'within', 
  'intersects', 'contains_point'
] as const;

export const DATA_TRANSFORM_TYPES = ['aggregate', 'filter', 'bin', 'hexagon'] as const;
export const COLOR_SCALES = ['sequential', 'diverging', 'categorical'] as const;
export const COLOR_SPACES = ['rgb', 'hsl', 'lab', 'lch'] as const;

export const VISUAL_CHANNEL_TYPES = [
  'categorical', 'quantitative', 'ordinal'
] as const;

export const FILTER_OPERATORS = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains',
  'starts_with', 'ends_with', 'in_range', 'within',
  'intersects', 'contains_point'
] as const;

// Enhanced Visual Channel Types (Following kepler.gl patterns)
export type VisualChannelValue = string | number | boolean | null | undefined;

export interface VisualChannelScale {
  domain: [number, number] | string[];
  range: [number, number] | string[];
  type: 'linear' | 'log' | 'sqrt' | 'quantize' | 'ordinal';
}

export interface VisualChannel {
  name: string;
  property: string;
  type: 'categorical' | 'quantitative' | 'ordinal';
  scale?: VisualChannelScale;
  defaultValue?: VisualChannelValue;
  aggregation?: 'sum' | 'mean' | 'min' | 'max' | 'count';
  
  // Enhanced features for kepler.gl compliance
  field?: string; // Alternative to property for field mapping
  encoding?: string; // Encoding specification (e.g., 'x', 'y', 'color', 'size')
  condition?: {
    test: string; // Conditional expression
    value: VisualChannelValue;
  };
  
  // Performance and validation
  validation?: {
    required: boolean;
    minValue?: number;
    maxValue?: number;
    pattern?: RegExp;
    customValidator?: (value: any) => boolean;
  };
  
  // Metadata for analytics and compliance
  metadata?: {
    description?: string;
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
    retentionPeriod?: string;
    complianceFlags?: string[];
  };
}

// Layer Configuration
export interface LayerConfig {
  id: string;
  type: LayerType;
  data: any[];
  visible: boolean;
  opacity: number;
  zIndex: number;
  name: string;
  
  // Visual Channels
  position?: {
    lat: string;
    lng: string;
    altitude?: string;
  };
  color?: VisualChannel;
  size?: VisualChannel & { sizeScale?: number };
  opacityChannel?: VisualChannel;
  text?: VisualChannel & { textField?: string; textSize?: number };
  
  // Performance and caching
  cacheEnabled: boolean;
  cacheTTL: number; // milliseconds
  
  // Feature flag integration
  featureFlag?: string;
  rolloutPercentage?: number; // 0-100
  
  // WebSocket integration
  realTimeEnabled: boolean;
  updateInterval?: number; // milliseconds
  
  // Compliance and audit
  auditEnabled: boolean;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
}

// Layer Types
export type LayerType = 
  | 'point'
  | 'polygon' 
  | 'linestring'
  | 'heatmap'
  | 'cluster'
  | 'hexagon'
  | 'geojson'
  | 'terrain'
  | 'imagery';

// Base Layer Data Interface - Generic on geometry type
export interface LayerData<G extends Geometry = Geometry> {
  id: string;
  geometry: G | null;
  properties: Record<string, any> & { [key: string]: any }; // Safe index signature for dynamic property access
  confidence?: number;
  source?: string;
  timestamp?: string;
  entityId?: string; // Links to forecastin entities
  hierarchy?: {
    ancestors: string[];
    descendants: string[];
    path: string;
    depth: number;
  };
}

// Layer State (for React Query integration)
export interface LayerState {
  config: LayerConfig;
  data: LayerData[];
  loading: boolean;
  error?: string;
  lastUpdated: string;
  cacheHit: boolean;
  performance?: {
    renderTime: number;
    dataLoadTime: number;
    cacheMisses: number;
  };
}

// Layer Event Types (for WebSocket integration)
export interface LayerEvent {
  type: 'layer_loaded' | 'layer_updated' | 'layer_removed' | 'data_updated' | 'error';
  layerId: string;
  timestamp: string;
  data?: any;
  error?: string;
}

// Forward declare BaseLayer type for LayerRegistryEntry
export type BaseLayerType = any; // Will be properly typed when BaseLayer is imported

// Layer Registry Entry
export interface LayerRegistryEntry {
  type: LayerType;
  factory: (config: LayerConfig) => BaseLayerType;
  visualChannels: VisualChannel[];
  requiredProperties: string[];
  optionalProperties: string[];
  performance: {
    maxFeatures: number;
    recommendedChunkSize: number;
    memoryUsage: 'low' | 'medium' | 'high';
  };
}

// Layer Performance Metrics (with WebSocket integration support)
export interface LayerPerformanceMetrics {
  layerId: string;
  renderTime: number; // milliseconds
  dataSize: number; // features count
  memoryUsage: number; // bytes
  cacheHitRate: number; // 0-1
  lastRenderTime: string;
  fps: number; // frames per second
  
  // WebSocket-specific metrics for layer updates
  messagesSent?: number;
  messagesReceived?: number;
  lastMessageTime?: number;
  averageLatency?: number;
  throughput?: number; // requests per second
  
  
  // Resource usage (optional)
  gpu?: {
    memoryUsage: number; // MB
    memoryLimit: number; // MB
    utilization: number; // 0-100%
    computeUnits: number;
    temperature?: number;
  };
  
  // Network and I/O (optional)
  network?: {
    bandwidth: number; // Mbps
    latency: number; // ms
    packetLoss: number; // 0-1
    connectionType: 'wifi' | '4g' | '5g' | 'ethernet' | 'unknown';
  };
  
  // Battery and device optimization (optional)
  device?: {
    batteryLevel?: number; // 0-100
    isLowPowerMode: boolean;
    thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
    memoryPressure: 'normal' | 'warning' | 'critical';
  };
}

// Feature Flag Integration
export interface FeatureFlagConfig {
  mapV1Enabled: boolean;
  layerTypes: {
    [K in LayerType]?: {
      enabled: boolean;
      rolloutPercentage: number;
      minimumUserId?: string; // for targeted rollout
    };
  };
  realTimeUpdates: boolean;
  performanceMode: 'optimized' | 'standard' | 'performance';
}

// Compliance and Audit
export interface LayerAuditEntry {
  layerId: string;
  action: 'created' | 'updated' | 'deleted' | 'accessed';
  userId: string;
  timestamp: string;
  metadata?: Record<string, any>;
  dataClassification: string;
  complianceFlags: string[];
}

// Export utility types
export type LayerDataInput = LayerData[] | string | { 
  url: string; 
  format: 'geojson' | 'csv' | 'json';
  cacheKey?: string;
};

export type LayerVisibility = 'visible' | 'hidden' | 'conditional';

export interface LayerFilter {
  property: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface LayerStyle {
  fillColor?: string | VisualChannel;
  strokeColor?: string | VisualChannel;
  strokeWidth?: number | VisualChannel;
  opacity?: number | VisualChannel;
  radius?: number | VisualChannel;
}

// WebSocket message types for layer updates
export interface LayerWebSocketMessage {
  type: 'layer_update' | 'layer_creation' | 'layer_deletion' | 'data_update'
      | 'layer_initialization' | 'layer_data' | 'entity_update' | 'batch_update'
      | 'performance_metrics' | 'compliance_event' | 'heartbeat' | 'heartbeat_response' | 'error';
  action?: string;
  payload?: {
    layerId?: string;
    data?: LayerData[] | any;
    config?: Partial<LayerConfig>;
    timestamp?: string;
  };
  data?: any; // Flexible data field for different message types
  safeSerialized?: boolean; // Uses orjson pattern from forecastin
}

// Backward compatibility alias for LayerWebSocketIntegration
export type WebSocketLayerMessage = LayerWebSocketMessage;

// Export missing types that LinestringLayer needs
export type PerformanceMetrics = LayerPerformanceMetrics;
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
}
export interface AuditLogEntry {
  timestamp: string;
  action: string;
  userId?: string;
  metadata?: Record<string, any>;
}

// Fix duplicate sloCompliance declaration (line 426 and 1083)
export interface LayerPerformanceMetricsFixed extends LayerPerformanceMetrics {
  sloCompliance: {
    targetResponseTime: number; // 1.25ms target
    currentP95: number;
    currentP99: number;
    complianceRate: number; // Percentage of requests under target
    violations: number;
    lastViolation?: string;
  };
}

// Fix FeatureFlagConfig missing properties
export interface EnhancedFeatureFlagConfig extends FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage: number;
}

// Fix PolygonEntityDataPoint visual properties interface conflicts
export interface PolygonEntityDataPointFixed extends BaseEntityDataPoint<Polygon | MultiPolygon> {
  // Visual styling properties (top-level for direct access)
  fillColor?: [number, number, number, number];
  strokeColor?: [number, number, number, number];
  strokeWidth?: number;
  filled?: boolean;
  extruded?: boolean;
  elevation?: number;
  
  // Polygon-specific computed properties
  centroid?: [number, number]; // [lng, lat] centroid for filtering
  bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number }; // Bounding box for spatial queries
  area?: number; // Polygon area in square meters
  perimeter?: number; // Polygon perimeter in meters
  
  // Hierarchy path for LTREE filtering
  hierarchyPath?: string; // LTREE path for hierarchy-based filtering
  
  // Override visualProperties to match PolygonLayer requirements with compatibility
  visualProperties?: {
    // Base properties required by BaseEntityDataPoint
    color: string | [number, number, number, number]; // Required by base
    size: number; // Required by base
    opacity: number; // Required by base
    // Polygon-specific properties
    fillColor?: [number, number, number, number];
    strokeColor?: [number, number, number, number];
    strokeWidth?: number;
    filled?: boolean;
    extruded?: boolean;
    elevation?: number;
    fillOpacity?: number; // Opacity for fill color
  };
}