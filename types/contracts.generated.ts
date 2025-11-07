/**
 * AUTO-GENERATED TypeScript Interfaces from Backend Pydantic Models
 * Generated from: api/services/
 *
 * DO NOT EDIT MANUALLY - Regenerate using: npm run generate:contracts
 *
 * Generation Script: scripts/dev/generate_contracts.py
 * Last Generated: 2025-11-06
 *
 * Purpose: Ensure frontend↔backend contract alignment
 */

// ============================================================================
// FEATURE FLAG SERVICE CONTRACTS
// Source: api/services/feature_flag_service.py
// ============================================================================

export interface FeatureFlag {
  id: string;                      // UUID as string
  flagName: string;                // flag_name → flagName (camelCase)
  description: string | null;
  isEnabled: boolean;              // is_enabled → isEnabled
  rolloutPercentage: number;       // rollout_percentage → rolloutPercentage
  createdAt: number;               // created_at → createdAt (Unix timestamp)
  updatedAt: number;               // updated_at → updatedAt (Unix timestamp)
}

export interface CreateFeatureFlagRequest {
  flagName: string;
  description?: string | null;
  isEnabled?: boolean;
  rolloutPercentage?: number;
  flagCategory?: string | null;    // e.g., "geospatial", "ml", "ui"
  dependencies?: string[] | null;  // Flags this flag depends on
}

export interface UpdateFeatureFlagRequest {
  description?: string | null;
  isEnabled?: boolean | null;
  rolloutPercentage?: number | null;
  flagCategory?: string | null;
  dependencies?: string[] | null;
}

export interface GeospatialFeatureFlags {
  // Core geospatial features
  ffGeospatialLayers: boolean;
  ffPointLayer: boolean;
  ffPolygonLayer: boolean;
  ffLinestringLayer: boolean;
  ffHeatmapLayer: boolean;

  // Advanced features
  ffClusteringEnabled: boolean;
  ffGpuFiltering: boolean;
  ffRealtimeUpdates: boolean;
  ffWebsocketLayers: boolean;

  // Performance features
  ffLayerPerformanceMonitoring: boolean;
  ffLayerAuditLogging: boolean;

  // Rollout percentages
  rolloutPercentages: {
    coreLayers: number;
    pointLayers: number;
    websocketIntegration: number;
    advancedFeatures: number;
    performanceMonitoring: number;
  };
}

export interface FeatureFlagMetrics {
  totalFlags: number;
  enabledFlags: number;
  cacheHits: number;
  cacheMisses: number;
  databaseQueries: number;
  websocketNotifications: number;
  avgResponseTimeMs: number;
}

// ============================================================================
// SCENARIO SERVICE CONTRACTS (Phase 6)
// Source: api/services/scenario_service.py
// ============================================================================

export type ValidationStatus = 'pending' | 'validated' | 'failed' | 'in_progress';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskProfile {
  riskLevel: RiskLevel;
  riskFactors: string[];
  mitigationStrategies: string[];
  confidenceScore: number;  // 0.0-1.0
  assessedAt: string;       // ISO 8601 datetime string
}

export interface CollaborationState {
  activeUsers: string[];
  lastModifiedBy: string;
  lastModifiedAt: string;   // ISO 8601 datetime string
  changeCount: number;
  conflictCount: number;
  version: number;
}

export interface ScenarioEntity {
  scenarioId: string;
  path: string;             // LTREE path: "root.child.grandchild"
  pathDepth: number;        // Pre-computed depth for O(1) lookups
  pathHash: string;         // Pre-computed hash for existence checks
  name: string;
  description: string | null;
  confidenceScore: number;  // 0.0-1.0
  riskAssessment: RiskProfile;
  validationStatus: ValidationStatus;
  collaborationData: CollaborationState;
  metadata: Record<string, any>;
  createdAt: string;        // ISO 8601 datetime string
  updatedAt: string;        // ISO 8601 datetime string
}

export interface AnalysisFactor {
  factorType: 'geospatial' | 'temporal' | 'entity' | 'risk';
  factorName: string;
  weight: number;           // 0.0-1.0
  parameters: Record<string, any>;
}

export interface AnalysisResult {
  scenarioId: string;
  analysisId: string;
  factors: AnalysisFactor[];
  overallConfidence: number;
  factorScores: Record<string, number>;
  recommendations: string[];
  warnings: string[];
  generatedAt: string;      // ISO 8601 datetime string
  generationTimeMs: number;
}

// ============================================================================
// HIERARCHICAL FORECAST SERVICE CONTRACTS
// Source: api/services/hierarchical_forecast_service.py
// ============================================================================

export interface ForecastDataPoint {
  timestamp: string;        // ISO 8601 datetime string
  value: number;
  confidenceLower: number;  // Lower confidence bound
  confidenceUpper: number;  // Upper confidence bound
}

export interface HierarchicalForecast {
  entityId: string;
  path: string;             // LTREE path
  pathDepth: number;
  forecastType: 'top_down' | 'bottom_up' | 'hybrid';
  forecasts: ForecastDataPoint[];
  generatedAt: string;      // ISO 8601 datetime string
  validUntil: string;       // ISO 8601 datetime string
  confidence: number;       // 0.0-1.0
  metadata: {
    algorithm: string;
    trainingWindow: number; // days
    forecastHorizon: number; // days
    rmse?: number;
    mae?: number;
    mape?: number;
  };
}

// ============================================================================
// HEALTH CHECK CONTRACTS
// Source: api/main.py
// ============================================================================

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;        // Unix timestamp
  services: {
    database: 'ok' | 'degraded' | 'unavailable';
    redis: 'ok' | 'degraded' | 'unavailable';
    websocket: 'ok' | 'degraded' | 'unavailable';
    hierarchy: 'ok' | 'degraded' | 'unavailable';
    cache: 'ok' | 'degraded' | 'unavailable';
  };
  performanceMetrics: {
    avgResponseTimeMs: number;
    p95ResponseTimeMs: number;
    activeConnections: number;
    cacheHitRate: number;
    queriesPerSecond: number;
  };
}

// ============================================================================
// ENTITY & HIERARCHY CONTRACTS
// Source: api/main.py, navigation_api/
// ============================================================================

export interface Entity {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  path: string;             // LTREE path
  pathDepth: number;
  confidence?: number | null;
  metadata?: Record<string, any> | null;
  createdAt?: string | null;  // ISO 8601 datetime string
  updatedAt?: string | null;  // ISO 8601 datetime string
  hasChildren?: boolean;
  childrenCount?: number;
}

export interface HierarchyNode {
  id: string;
  name: string;
  type: string;
  path: string;
  pathDepth: number;
  children: Entity[];
  hasMore: boolean;
  totalChildren?: number;
  confidence?: number;
}

export interface HierarchyResponse {
  nodes: Entity[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

// ============================================================================
// OUTCOMES DASHBOARD CONTRACTS
// Source: api/main.py (inferred from routes)
// ============================================================================

export type TimeHorizon = 'immediate' | 'short' | 'medium' | 'long';

export interface LensFilters {
  role?: string[];
  sector?: string[];
  marketLevel?: string[];
  function?: string[];
  risk?: string[];
  horizon?: TimeHorizon[];
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  roiScore: number;         // 0-1 scale
  confidence: number;       // 0-1 scale
  horizon: TimeHorizon;
  policyWindow?: number | null;  // days until policy window closes
  riskLevel: number;        // 0-1 scale
  momentum: number;         // -1 to 1, trend direction
  sector: string[];
  marketLevel: string[];
  stakeholders: string[];   // stakeholder IDs
  evidence: string[];       // evidence IDs
  fxExposure?: {
    currency: string;
    amount: number;
    volatility: number;
  } | null;
  createdAt: string;        // ISO 8601 datetime string
  updatedAt: string;        // ISO 8601 datetime string
  metadata?: Record<string, any>;
}

export type ActionType = 'engage_policy' | 'market_scan' | 'partnership' | 'hedge_fx' | 'monitor_alert';
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type ActionPriority = 'high' | 'medium' | 'low';

export interface Action {
  id: string;
  opportunityId: string;
  type: ActionType;
  title: string;
  description: string;
  priority: ActionPriority;
  status: ActionStatus;
  dueDate?: string | null;  // ISO 8601 datetime string
  assignee?: string | null;
  businessRule: string;     // which rule generated this action
  createdAt: string;        // ISO 8601 datetime string
  updatedAt: string;        // ISO 8601 datetime string
  metadata?: Record<string, any>;
}

export interface Stakeholder {
  id: string;
  name: string;
  organization?: string | null;
  role: string;
  influence: number;        // 0-1 scale (x-axis)
  alignment: number;        // 0-1 scale (y-axis)
  sector: string[];
  opportunities: string[];  // opportunity IDs
  lastContact?: string | null;  // ISO 8601 datetime string
  notes?: string | null;
  createdAt: string;        // ISO 8601 datetime string
  updatedAt: string;        // ISO 8601 datetime string
  metadata?: Record<string, any>;
}

export type EvidenceSourceType = 'report' | 'news' | 'data' | 'expert' | 'internal';

export interface Evidence {
  id: string;
  title: string;
  source: string;
  sourceType: EvidenceSourceType;
  url?: string | null;
  excerpt: string;
  confidence: number;       // 0-1 scale
  date: string;             // ISO 8601 date string
  opportunities: string[];  // opportunity IDs
  citations: number;
  tags: string[];
  createdAt: string;        // ISO 8601 datetime string
  updatedAt: string;        // ISO 8601 datetime string
  metadata?: Record<string, any>;
}

// ============================================================================
// PAGINATED RESPONSE CONTRACTS
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page?: number;
  pageSize?: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export type OpportunitiesResponse = PaginatedResponse<Opportunity> & {
  filters: LensFilters;
};

export type ActionsResponse = PaginatedResponse<Action> & {
  opportunityId?: string;
};

export type StakeholdersResponse = PaginatedResponse<Stakeholder> & {
  opportunityId?: string;
};

export type EvidenceResponse = PaginatedResponse<Evidence> & {
  opportunityId?: string;
};

// ============================================================================
// ERROR RESPONSE CONTRACTS
// ============================================================================

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: number;
  path?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Branded type for LTREE paths
 * Ensures path format validation: "root.child.grandchild"
 */
export type LTreePath = string & { __brand: 'LTreePath' };

/**
 * Branded type for ISO 8601 datetime strings
 */
export type ISODateTimeString = string & { __brand: 'ISODateTimeString' };

/**
 * Branded type for UUID strings
 */
export type UUIDString = string & { __brand: 'UUIDString' };

/**
 * Normalized entity with required fields
 * Use this in components that require full entity data
 */
export type NormalizedEntity = Required<Pick<Entity, 'id' | 'name' | 'type' | 'path' | 'pathDepth'>> &
  Partial<Omit<Entity, 'id' | 'name' | 'type' | 'path' | 'pathDepth'>>;

/**
 * Safe entity accessor - returns default values for missing optionals
 */
export function normalizeEntity(entity: Entity): NormalizedEntity {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    path: entity.path,
    pathDepth: entity.pathDepth,
    parentId: entity.parentId ?? undefined,
    confidence: entity.confidence ?? undefined,
    metadata: entity.metadata ?? undefined,
    createdAt: entity.createdAt ?? undefined,
    updatedAt: entity.updatedAt ?? undefined,
    hasChildren: entity.hasChildren ?? false,
    childrenCount: entity.childrenCount ?? 0,
  };
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates LTREE path format
 * Valid: "root", "root.child", "root.child.grandchild"
 * Invalid: ".root", "root.", "root..child", "root child"
 */
export function isValidLTreePath(path: string): path is LTreePath {
  return /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(path);
}

/**
 * Validates ISO 8601 datetime string
 */
export function isValidISODateTime(dateStr: string): dateStr is ISODateTimeString {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && dateStr === date.toISOString();
}

/**
 * Validates UUID string format
 */
export function isValidUUID(uuid: string): uuid is UUIDString {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Parse optional date string safely
 */
export function parseEntityDate(dateStr?: string | null): Date | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Get confidence score with fallback
 */
export function getConfidence(entity: Entity): number {
  return entity.confidence ?? 0.0;
}

/**
 * Get children count with fallback
 */
export function getChildrenCount(entity: Entity): number {
  return entity.childrenCount ?? 0;
}
