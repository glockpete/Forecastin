/**
 * AUTO-GENERATED TypeScript Interfaces from Backend Pydantic Models
 * Generated: 2025-11-07T15:52:52.234192
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
  ffGeospatialLayers?: boolean;
  ffPointLayer?: boolean;
  ffPolygonLayer?: boolean;
  ffLinestringLayer?: boolean;
  ffHeatmapLayer?: boolean;
  ffClusteringEnabled?: boolean;
  ffGpuFiltering?: boolean;
  ffRealtimeUpdates?: boolean;
  ffWebsocketLayers?: boolean;
  ffLayerPerformanceMonitoring?: boolean;
  ffLayerAuditLogging?: boolean;
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
 * Generated from: api/main.py
 * Python class: HealthResponse
 */
export interface HealthResponse {
  status: string;
  timestamp: number;
  services: Record<string, string>;
  performanceMetrics: Record<string, any>;
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
