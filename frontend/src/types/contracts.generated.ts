/**
 * AUTO-GENERATED TypeScript Interfaces from Backend Pydantic Models
 * Generated: 2025-11-08T17:45:26.738520
 *
 * DO NOT EDIT MANUALLY - Regenerate using: npm run generate:contracts
 *
 * Source: scripts/dev/generate_contracts.py
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Generated from: api/services/feature_flag_service.py
 * Python class: FeatureFlag
 */
export interface FeatureFlag {
  id: string;
  flagName: string;
  description?: string | null;
  isEnabled: boolean;
  rolloutPercentage: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Generated from: api/services/feature_flag_service.py
 * Python class: CreateFeatureFlagRequest
 */
export interface CreateFeatureFlagRequest {
  flagName: string;
  description?: string | null;
  isEnabled?: boolean;
  rolloutPercentage?: number;
  flagCategory?: string | null;
  dependencies?: string[] | null;
}

/**
 * Generated from: api/services/feature_flag_service.py
 * Python class: UpdateFeatureFlagRequest
 */
export interface UpdateFeatureFlagRequest {
  description?: string | null;
  isEnabled?: boolean | null;
  rolloutPercentage?: number | null;
  flagCategory?: string | null;
  dependencies?: string[] | null;
}

/**
 * Generated from: api/services/feature_flag_service.py
 * Python class: GeospatialFeatureFlags
 */
export interface GeospatialFeatureFlags {
  ffGeoLayersEnabled?: boolean;
  ffGeoPointLayerActive?: boolean;
  ffGeoPolygonLayerActive?: boolean;
  ffGeoLinestringLayerActive?: boolean;
  ffGeoHeatmapLayerActive?: boolean;
  ffGeoClusteringEnabled?: boolean;
  ffGeoGpuRenderingEnabled?: boolean;
  ffGeoRealtimeUpdatesEnabled?: boolean;
  ffGeoWebsocketLayersEnabled?: boolean;
  ffGeoPerformanceMonitoringEnabled?: boolean;
  ffGeoAuditLoggingEnabled?: boolean;
  rolloutPercentages?: Record<string, number>;
}

/**
 * Generated from: api/services/feature_flag_service.py
 * Python class: FeatureFlagMetrics
 */
export interface FeatureFlagMetrics {
  totalFlags?: number;
  enabledFlags?: number;
  cacheHits?: number;
  cacheMisses?: number;
  databaseQueries?: number;
  websocketNotifications?: number;
  avgResponseTimeMs?: number;
}

/**
 * Generated from: api/services/scenario_service.py
 * Python class: RiskProfile
 */
export interface RiskProfile {
  riskLevel: RiskLevel;
  riskFactors: string[];
  mitigationStrategies: string[];
  confidenceScore: number;
  assessedAt?: string;
}

/**
 * Generated from: api/services/scenario_service.py
 * Python class: CollaborationState
 */
export interface CollaborationState {
  activeUsers: string[];
  lastModifiedBy: string;
  lastModifiedAt: string;
  changeCount: number;
  conflictCount: number;
  version: number;
}

/**
 * Generated from: api/services/scenario_service.py
 * Python class: ScenarioEntity
 */
export interface ScenarioEntity {
  scenarioId: string;
  path: string;
  pathDepth: number;
  pathHash: string;
  name: string;
  description?: string | null;
  confidenceScore: number;
  riskAssessment: RiskProfile;
  validationStatus: ValidationStatus;
  collaborationData: CollaborationState;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Generated from: api/services/scenario_service.py
 * Python class: AnalysisFactor
 */
export interface AnalysisFactor {
  factorType: string;
  factorName: string;
  weight: number;
  parameters: Record<string, any>;
}

/**
 * Generated from: api/services/scenario_service.py
 * Python class: AnalysisResult
 */
export interface AnalysisResult {
  scenarioId: string;
  analysisId: string;
  factors: AnalysisFactor[];
  overallConfidence: number;
  factorScores: Record<string, number>;
  recommendations: string[];
  warnings: string[];
  generatedAt: string;
  generationTimeMs: number;
}

/**
 * Generated from: api/services/scenario_service.py
 * Python class: ValidationResult
 */
export interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  errors?: Record<string, string[]>;
  warnings?: Record<string, string[]>;
  riskLevel?: RiskLevel;
  validationTimestamp?: string;
  mlConfidence?: number | null;
  validationLayers?: Record<string, boolean>;
}

/**
 * Generated from: api/services/hierarchical_forecast_service.py
 * Python class: ForecastNode
 */
export interface ForecastNode {
  entityId: string;
  entityPath: string;
  entityName: string;
  forecastDates: string[];
  forecastValues: number[];
  lowerBound: number[];
  upperBound: number[];
  confidenceScore: number;
  method: string;
  children?: 'ForecastNode'[];
}

/**
 * Generated from: api/services/hierarchical_forecast_service.py
 * Python class: HierarchicalForecast
 */
export interface HierarchicalForecast {
  forecastId: string;
  rootNode: ForecastNode;
  forecastHorizon: number;
  forecastMethod: string;
  generatedAt: string;
  totalNodes: number;
  consistencyScore: number;
  performanceMetrics?: Record<string, any>;
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: BoundingBox
 */
export interface BoundingBox {
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: PointGeometry
 */
export interface PointGeometry {
  type: any;
  coordinates: any | any;
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: LineStringGeometry
 */
export interface LineStringGeometry {
  type: any;
  coordinates: any | any[];
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: PolygonGeometry
 */
export interface PolygonGeometry {
  type: any;
  coordinates: any | any[][];
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: MultiPolygonGeometry
 */
export interface MultiPolygonGeometry {
  type: any;
  coordinates: any | any[][][];
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: MultiLineStringGeometry
 */
export interface MultiLineStringGeometry {
  type: any;
  coordinates: any | any[][];
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python union type: Geometry
 */
export type Geometry =
  | PointGeometry
  | LineStringGeometry
  | PolygonGeometry
  | MultiPolygonGeometry
  | MultiLineStringGeometry;

/**
 * Generated from: api/models/websocket_schemas.py
 * Python enum: LayerType
 */
export type LayerType = 'point' | 'polygon' | 'line' | 'linestring' | 'heatmap' | 'cluster' | 'geojson';

/**
 * Generated from: api/models/websocket_schemas.py
 * Python enum: FilterType
 */
export type FilterType = 'spatial' | 'temporal' | 'attribute' | 'composite';

/**
 * Generated from: api/models/websocket_schemas.py
 * Python enum: FilterStatus
 */
export type FilterStatus = 'applied' | 'pending' | 'error' | 'cleared';

/**
 * Generated from: api/models/websocket_schemas.py
 * Python enum: MessageType
 */
export type MessageType = 'ping' | 'pong' | 'layer_data_update' | 'gpu_filter_sync' | 'polygon_update' | 'linestring_update' | 'search_update' | 'error' | 'echo';

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: GeoJSONFeature
 */
export interface GeoJSONFeature {
  type: any;
  geometry: Geometry;
  properties?: Record<string, any> | null;
  id?: any | null;
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: FeatureCollection
 */
export interface FeatureCollection {
  type: any;
  features: GeoJSONFeature[];
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: MessageMeta
 */
export interface MessageMeta {
  timestamp: number;
  sequence?: number | null;
  clientId?: string | null;
  sessionId?: string | null;
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: LayerDataUpdatePayload
 */
export interface LayerDataUpdatePayload {
  layerId?: string;
  layerType: LayerType;
  layerData: FeatureCollection;
  bbox?: BoundingBox | null;
  changedAt: number;
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: TemporalFilter
 */
export interface TemporalFilter {
  start: string;
  end: string;
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: FilterParams
 */
export interface FilterParams {
  bounds?: BoundingBox | null;
  temporal?: TemporalFilter | null;
  attributes?: Record<string, any> | null;
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: GPUFilterSyncPayload
 */
export interface GPUFilterSyncPayload {
  filterId?: string;
  filterType: FilterType;
  filterParams: FilterParams;
  affectedLayers?: string[];
  status: FilterStatus;
  changedAt: number;
}

/**
 * Generated from: api/models/websocket_schemas.py
 * Python class: BaseWebSocketMessage
 */
export interface BaseWebSocketMessage {
  type: MessageType;
  timestamp: number;
  clientId?: string | null;
  meta?: MessageMeta | null;
}

/**
 * Utility: Convert snake_case to camelCase
 * Use this for runtime object key transformation if backend sends snake_case
 */
export function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// Utility functions for entity confidence and children count
export function getConfidence(entity: any): number {
  return entity.confidence ?? 0;
}

export function getChildrenCount(entity: any): number {
  return entity.childrenCount ?? 0;
}

// Missing enum definitions
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ValidationStatus {
  PENDING = 'pending',
  VALID = 'valid',
  INVALID = 'invalid'
}
