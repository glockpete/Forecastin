/**
 * WebSocket Message Schema - Discriminated Union Types
 * Generated from code audit of api/ and frontend/src/
 *
 * Purpose: Type-safe WebSocket message handling with exhaustive checking
 * Usage: Import type guards and use in message handlers
 *
 * CRITICAL: This replaces the loose `WebSocketMessage` interface with strict types
 */

// ============================================================================
// BASE MESSAGE STRUCTURE
// ============================================================================

interface BaseWSMessage<T extends string> {
  type: T;
  timestamp?: number | string;
  channels?: string[];
}

// ============================================================================
// ENTITY & HIERARCHY MESSAGES
// ============================================================================

export interface EntityUpdateMessage extends BaseWSMessage<'entity_update'> {
  data: {
    entityId: string;
    entity: {
      id: string;
      name: string;
      type: string;
      path: string;
      pathDepth: number;
      confidence?: number;
      metadata?: Record<string, any>;
      createdAt?: string;
      updatedAt?: string;
      hasChildren?: boolean;
      childrenCount?: number;
    };
    changeType?: 'create' | 'update' | 'delete';
  };
}

export interface HierarchyChangeMessage extends BaseWSMessage<'hierarchy_change'> {
  data: {
    path: string;
    affectedEntities: string[];
    operation: 'add' | 'remove' | 'move' | 'restructure';
    parentId?: string;
  };
}

export interface BulkUpdateMessage extends BaseWSMessage<'bulk_update'> {
  data: {
    entityIds: string[];
    updateType: 'confidence' | 'metadata' | 'hierarchy';
    changes: Record<string, any>;
  };
}

// ============================================================================
// GEOSPATIAL LAYER MESSAGES
// ============================================================================

export interface LayerDataUpdateMessage extends BaseWSMessage<'layer_data_update'> {
  data: {
    layerId: string;
    layerType: 'point' | 'polygon' | 'linestring' | 'heatmap';
    entities: Array<{
      id: string;
      geometry: any; // GeoJSON Geometry
      properties: Record<string, any>;
      confidence: number;
    }>;
    operation: 'add' | 'update' | 'remove' | 'replace';
    affectedBounds?: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };
  };
}

export interface GPUFilterSyncMessage extends BaseWSMessage<'gpu_filter_sync'> {
  data: {
    layerId: string;
    filters: {
      field: string;
      operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'between';
      value: any;
    }[];
    filteredCount: number;
    totalCount: number;
  };
}

// ============================================================================
// FEATURE FLAG MESSAGES
// ============================================================================

export interface FeatureFlagChangeMessage extends BaseWSMessage<'feature_flag_change'> {
  data: {
    flagName: string;
    isEnabled: boolean;
    rolloutPercentage: number;
    previousValue?: boolean;
    updatedAt: number;
  };
}

export interface FeatureFlagCreatedMessage extends BaseWSMessage<'feature_flag_created'> {
  data: {
    flag: {
      id: string;
      flag_name: string;
      description: string | null;
      is_enabled: boolean;
      rollout_percentage: number;
      created_at: number;
      updated_at: number;
    };
  };
}

export interface FeatureFlagDeletedMessage extends BaseWSMessage<'feature_flag_deleted'> {
  data: {
    flagName: string;
    deletedAt: number;
  };
}

// ============================================================================
// SCENARIO & FORECAST MESSAGES (Phase 6)
// ============================================================================

export interface ForecastUpdateMessage extends BaseWSMessage<'forecast_update'> {
  data: {
    scenarioId: string;
    path: string;
    forecast: {
      timestamp: string;
      value: number;
      confidence: number;
      upperBound?: number;
      lowerBound?: number;
    }[];
    forecastType: 'top_down' | 'bottom_up' | 'hybrid';
  };
}

export interface HierarchicalForecastUpdateMessage extends BaseWSMessage<'hierarchical_forecast_update'> {
  data: {
    scenarioId: string;
    path: string;
    hierarchyLevel: number;
    forecasts: Array<{
      entityId: string;
      path: string;
      predictions: Array<{
        timestamp: string;
        value: number;
        confidence: number;
      }>;
    }>;
  };
}

export interface ScenarioAnalysisUpdateMessage extends BaseWSMessage<'scenario_analysis_update'> {
  data: {
    scenarioId: string;
    analysisId: string;
    factors: Array<{
      factor_type: string;
      factor_name: string;
      weight: number;
      parameters: Record<string, any>;
    }>;
    overallConfidence: number;
    factorScores: Record<string, number>;
    recommendations: string[];
    warnings: string[];
  };
}

export interface ScenarioValidationUpdateMessage extends BaseWSMessage<'scenario_validation_update'> {
  data: {
    scenarioId: string;
    validationStatus: 'pending' | 'validated' | 'failed' | 'in_progress';
    errors?: string[];
    warnings?: string[];
    validatedAt?: number;
  };
}

export interface CollaborationUpdateMessage extends BaseWSMessage<'collaboration_update'> {
  data: {
    scenarioId: string;
    activeUsers: string[];
    lastModifiedBy: string;
    lastModifiedAt: string;
    changeCount: number;
    conflictCount: number;
    version: number;
  };
}

// ============================================================================
// OUTCOMES DASHBOARD MESSAGES
// ============================================================================

export interface OpportunityUpdateMessage extends BaseWSMessage<'opportunity_update'> {
  data: {
    opportunityId: string;
    opportunity: {
      id: string;
      title: string;
      description: string;
      roiScore: number;
      confidence: number;
      horizon: 'immediate' | 'short' | 'medium' | 'long';
      riskLevel: number;
      momentum: number;
      sector: string[];
      marketLevel: string[];
      updatedAt: string;
    };
  };
}

export interface ActionUpdateMessage extends BaseWSMessage<'action_update'> {
  data: {
    actionId: string;
    opportunityId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    updatedAt: string;
  };
}

export interface StakeholderUpdateMessage extends BaseWSMessage<'stakeholder_update'> {
  data: {
    stakeholderId: string;
    influence?: number;
    alignment?: number;
    updatedAt: string;
  };
}

export interface EvidenceUpdateMessage extends BaseWSMessage<'evidence_update'> {
  data: {
    evidenceId: string;
    opportunityIds: string[];
    confidence: number;
    updatedAt: string;
  };
}

// ============================================================================
// SYSTEM & ERROR MESSAGES
// ============================================================================

export interface PingMessage extends BaseWSMessage<'ping'> {
  data?: {};
}

export interface PongMessage extends BaseWSMessage<'pong'> {
  data: {
    client_id?: string;
    timestamp: number;
  };
}

export interface SerializationErrorMessage extends BaseWSMessage<'serialization_error'> {
  error: string;
  originalMessageType?: string;
}

export interface ConnectionEstablishedMessage extends BaseWSMessage<'connection_established'> {
  data: {
    clientId: string;
    serverTime: number;
  };
}

export interface ErrorMessage extends BaseWSMessage<'error'> {
  error: string;
  code?: string;
  details?: any;
}

export interface HeartbeatMessage extends BaseWSMessage<'heartbeat'> {
  data: {
    serverTime: number;
  };
}

export interface EchoMessage extends BaseWSMessage<'echo'> {
  data: any;
  client_id?: string;
  server_processing_ms?: number;
}

export interface SubscribeMessage extends BaseWSMessage<'subscribe'> {
  channels: string[];
}

export interface UnsubscribeMessage extends BaseWSMessage<'unsubscribe'> {
  channels: string[];
}

export interface CacheInvalidateMessage extends BaseWSMessage<'cache_invalidate'> {
  data: {
    keys: string[][];
    strategy: 'cascade' | 'selective' | 'lazy' | 'immediate';
  };
}

export interface BatchMessage extends BaseWSMessage<'batch'> {
  data: {
    messages: WebSocketMessage[];
  };
}

// ============================================================================
// DISCRIMINATED UNION - THE MAIN TYPE
// ============================================================================

export type WebSocketMessage =
  // Entity & Hierarchy
  | EntityUpdateMessage
  | HierarchyChangeMessage
  | BulkUpdateMessage

  // Geospatial Layers
  | LayerDataUpdateMessage
  | GPUFilterSyncMessage

  // Feature Flags
  | FeatureFlagChangeMessage
  | FeatureFlagCreatedMessage
  | FeatureFlagDeletedMessage

  // Scenarios & Forecasts
  | ForecastUpdateMessage
  | HierarchicalForecastUpdateMessage
  | ScenarioAnalysisUpdateMessage
  | ScenarioValidationUpdateMessage
  | CollaborationUpdateMessage

  // Outcomes Dashboard
  | OpportunityUpdateMessage
  | ActionUpdateMessage
  | StakeholderUpdateMessage
  | EvidenceUpdateMessage

  // System & Errors
  | PingMessage
  | PongMessage
  | SerializationErrorMessage
  | ConnectionEstablishedMessage
  | ErrorMessage
  | HeartbeatMessage
  | EchoMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | CacheInvalidateMessage
  | BatchMessage;

// ============================================================================
// TYPE GUARDS - For runtime type narrowing
// ============================================================================

export function isEntityUpdate(msg: WebSocketMessage): msg is EntityUpdateMessage {
  return msg.type === 'entity_update';
}

export function isHierarchyChange(msg: WebSocketMessage): msg is HierarchyChangeMessage {
  return msg.type === 'hierarchy_change';
}

export function isLayerDataUpdate(msg: WebSocketMessage): msg is LayerDataUpdateMessage {
  return msg.type === 'layer_data_update';
}

export function isGPUFilterSync(msg: WebSocketMessage): msg is GPUFilterSyncMessage {
  return msg.type === 'gpu_filter_sync';
}

export function isFeatureFlagChange(msg: WebSocketMessage): msg is FeatureFlagChangeMessage {
  return msg.type === 'feature_flag_change';
}

export function isForecastUpdate(msg: WebSocketMessage): msg is ForecastUpdateMessage {
  return msg.type === 'forecast_update';
}

export function isScenarioAnalysisUpdate(msg: WebSocketMessage): msg is ScenarioAnalysisUpdateMessage {
  return msg.type === 'scenario_analysis_update';
}

export function isOpportunityUpdate(msg: WebSocketMessage): msg is OpportunityUpdateMessage {
  return msg.type === 'opportunity_update';
}

export function isSerializationError(msg: WebSocketMessage): msg is SerializationErrorMessage {
  return msg.type === 'serialization_error';
}

export function isPing(msg: WebSocketMessage): msg is PingMessage {
  return msg.type === 'ping';
}

export function isPong(msg: WebSocketMessage): msg is PongMessage {
  return msg.type === 'pong';
}

export function isError(msg: WebSocketMessage): msg is ErrorMessage {
  return msg.type === 'error';
}

// ============================================================================
// EXHAUSTIVE SWITCH HELPER
// ============================================================================

/**
 * Ensures exhaustive handling of all message types at compile time.
 * Usage:
 *
 * switch (message.type) {
 *   case 'entity_update':
 *     // handle
 *     break;
 *   case 'hierarchy_change':
 *     // handle
 *     break;
 *   // ... all cases
 *   default:
 *     assertNever(message);
 * }
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected message type: ${JSON.stringify(x)}`);
}

/**
 * Exhaustive switch with callback handlers
 *
 * @example
 * exhaustiveSwitch(message, {
 *   entity_update: (msg) => handleEntityUpdate(msg.data),
 *   hierarchy_change: (msg) => handleHierarchyChange(msg.data),
 *   layer_data_update: (msg) => handleLayerUpdate(msg.data),
 *   // ... all handlers
 * });
 */
export function exhaustiveSwitch<R>(
  message: WebSocketMessage,
  handlers: {
    entity_update: (msg: EntityUpdateMessage) => R;
    hierarchy_change: (msg: HierarchyChangeMessage) => R;
    bulk_update: (msg: BulkUpdateMessage) => R;
    layer_data_update: (msg: LayerDataUpdateMessage) => R;
    gpu_filter_sync: (msg: GPUFilterSyncMessage) => R;
    feature_flag_change: (msg: FeatureFlagChangeMessage) => R;
    feature_flag_created: (msg: FeatureFlagCreatedMessage) => R;
    feature_flag_deleted: (msg: FeatureFlagDeletedMessage) => R;
    forecast_update: (msg: ForecastUpdateMessage) => R;
    hierarchical_forecast_update: (msg: HierarchicalForecastUpdateMessage) => R;
    scenario_analysis_update: (msg: ScenarioAnalysisUpdateMessage) => R;
    scenario_validation_update: (msg: ScenarioValidationUpdateMessage) => R;
    collaboration_update: (msg: CollaborationUpdateMessage) => R;
    opportunity_update: (msg: OpportunityUpdateMessage) => R;
    action_update: (msg: ActionUpdateMessage) => R;
    stakeholder_update: (msg: StakeholderUpdateMessage) => R;
    evidence_update: (msg: EvidenceUpdateMessage) => R;
    ping: (msg: PingMessage) => R;
    pong: (msg: PongMessage) => R;
    serialization_error: (msg: SerializationErrorMessage) => R;
    connection_established: (msg: ConnectionEstablishedMessage) => R;
    error: (msg: ErrorMessage) => R;
    heartbeat: (msg: HeartbeatMessage) => R;
    echo: (msg: EchoMessage) => R;
    subscribe: (msg: SubscribeMessage) => R;
    unsubscribe: (msg: UnsubscribeMessage) => R;
    cache_invalidate: (msg: CacheInvalidateMessage) => R;
    batch: (msg: BatchMessage) => R;
  }
): R {
  const handler = handlers[message.type];
  if (!handler) {
    throw new Error(`No handler for message type: ${message.type}`);
  }
  return handler(message as any);
}

// ============================================================================
// MESSAGE CONSTRUCTORS - Type-safe message creation
// ============================================================================

export function createEntityUpdate(
  entityId: string,
  entity: EntityUpdateMessage['data']['entity'],
  changeType?: 'create' | 'update' | 'delete'
): EntityUpdateMessage {
  return {
    type: 'entity_update',
    timestamp: Date.now(),
    data: { entityId, entity, changeType },
  };
}

export function createHierarchyChange(
  path: string,
  affectedEntities: string[],
  operation: 'add' | 'remove' | 'move' | 'restructure',
  parentId?: string
): HierarchyChangeMessage {
  return {
    type: 'hierarchy_change',
    timestamp: Date.now(),
    data: { path, affectedEntities, operation, parentId },
  };
}

export function createLayerDataUpdate(
  layerId: string,
  layerType: 'point' | 'polygon' | 'linestring' | 'heatmap',
  entities: LayerDataUpdateMessage['data']['entities'],
  operation: 'add' | 'update' | 'remove' | 'replace'
): LayerDataUpdateMessage {
  return {
    type: 'layer_data_update',
    timestamp: Date.now(),
    data: { layerId, layerType, entities, operation },
  };
}

// Add more constructors as needed...

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates WebSocket message structure
 */
export function isValidMessage(data: unknown): data is WebSocketMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const msg = data as any;
  return typeof msg.type === 'string';
}

/**
 * Safe message parser with validation
 */
export function parseMessage(raw: string): WebSocketMessage | null {
  try {
    const data = JSON.parse(raw);
    return isValidMessage(data) ? data : null;
  } catch {
    return null;
  }
}
