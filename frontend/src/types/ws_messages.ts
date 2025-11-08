/**
 * UNIFIED WebSocket Message Schemas - Single Source of Truth
 *
 * This file consolidates all WebSocket message types with Zod runtime validation.
 * It replaces the previous fragmented schema files and provides:
 * - Zod discriminated union for all 28+ message types
 * - Runtime validation with .parse() and .safeParse()
 * - Type guards for safe message handling
 * - Standardized null discipline: .optional() for undefined, .nullable() for null
 * - Exhaustiveness checking at compile time
 *
 * IMPORTANT: This is the ONLY schema file for WebSocket messages.
 * Do NOT create separate schema files. Update this file for new message types.
 */

import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS & UTILITIES
// ============================================================================

const TimestampSchema = z.union([z.number(), z.string()]).optional();
const ChannelsSchema = z.array(z.string()).optional();

// ============================================================================
// ENTITY & HIERARCHY MESSAGES
// ============================================================================

const EntityDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  path: z.string(),
  pathDepth: z.number(),
  confidence: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  hasChildren: z.boolean().optional(),
  childrenCount: z.number().optional(),
});

export const EntityUpdateMessageSchema = z.object({
  type: z.literal('entity_update'),
  data: z.object({
    entityId: z.string(),
    entity: EntityDataSchema,
    changeType: z.enum(['create', 'update', 'delete']).optional(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const HierarchyChangeMessageSchema = z.object({
  type: z.literal('hierarchy_change'),
  data: z.object({
    path: z.string(),
    affectedEntities: z.array(z.string()),
    operation: z.enum(['add', 'remove', 'move', 'restructure']),
    parentId: z.string().optional(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const BulkUpdateMessageSchema = z.object({
  type: z.literal('bulk_update'),
  data: z.object({
    entityIds: z.array(z.string()),
    updateType: z.enum(['confidence', 'metadata', 'hierarchy']),
    changes: z.record(z.any()),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

// ============================================================================
// GEOSPATIAL LAYER MESSAGES
// ============================================================================

const BoundingBoxSchema = z.object({
  minLat: z.number(),
  maxLat: z.number(),
  minLng: z.number(),
  maxLng: z.number(),
}).optional();

const LayerEntitySchema = z.object({
  id: z.string(),
  geometry: z.any(), // GeoJSON Geometry
  properties: z.record(z.any()),
  confidence: z.number(),
});

export const LayerDataUpdateMessageSchema = z.object({
  type: z.literal('layer_data_update'),
  data: z.object({
    layerId: z.string(),
    layerType: z.enum(['point', 'polygon', 'linestring', 'heatmap']),
    entities: z.array(LayerEntitySchema),
    operation: z.enum(['add', 'update', 'remove', 'replace']),
    affectedBounds: BoundingBoxSchema,
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

const GPUFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'between']),
  value: z.any(),
});

export const GPUFilterSyncMessageSchema = z.object({
  type: z.literal('gpu_filter_sync'),
  data: z.object({
    layerId: z.string(),
    filters: z.array(GPUFilterSchema),
    filteredCount: z.number(),
    totalCount: z.number(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

// ============================================================================
// FEATURE FLAG MESSAGES
// ============================================================================

export const FeatureFlagChangeMessageSchema = z.object({
  type: z.literal('feature_flag_change'),
  data: z.object({
    flagName: z.string(),
    isEnabled: z.boolean(),
    rolloutPercentage: z.number(),
    previousValue: z.boolean().optional(),
    updatedAt: z.number(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const FeatureFlagCreatedMessageSchema = z.object({
  type: z.literal('feature_flag_created'),
  data: z.object({
    flag: z.object({
      id: z.string(),
      flag_name: z.string(),
      description: z.string().nullable(),
      is_enabled: z.boolean(),
      rollout_percentage: z.number(),
      created_at: z.number(),
      updated_at: z.number(),
    }),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const FeatureFlagDeletedMessageSchema = z.object({
  type: z.literal('feature_flag_deleted'),
  data: z.object({
    flagName: z.string(),
    deletedAt: z.number(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

// ============================================================================
// SCENARIO & FORECAST MESSAGES
// ============================================================================

const ForecastDataPointSchema = z.object({
  timestamp: z.string(),
  value: z.number(),
  confidence: z.number(),
  upperBound: z.number().optional(),
  lowerBound: z.number().optional(),
});

export const ForecastUpdateMessageSchema = z.object({
  type: z.literal('forecast_update'),
  data: z.object({
    scenarioId: z.string(),
    path: z.string(),
    forecast: z.array(ForecastDataPointSchema),
    forecastType: z.enum(['top_down', 'bottom_up', 'hybrid']),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

const HierarchicalForecastSchema = z.object({
  entityId: z.string(),
  path: z.string(),
  predictions: z.array(z.object({
    timestamp: z.string(),
    value: z.number(),
    confidence: z.number(),
  })),
});

export const HierarchicalForecastUpdateMessageSchema = z.object({
  type: z.literal('hierarchical_forecast_update'),
  data: z.object({
    scenarioId: z.string(),
    path: z.string(),
    hierarchyLevel: z.number(),
    forecasts: z.array(HierarchicalForecastSchema),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

const AnalysisFactorSchema = z.object({
  factor_type: z.string(),
  factor_name: z.string(),
  weight: z.number(),
  parameters: z.record(z.any()),
});

export const ScenarioAnalysisUpdateMessageSchema = z.object({
  type: z.literal('scenario_analysis_update'),
  data: z.object({
    scenarioId: z.string(),
    analysisId: z.string(),
    factors: z.array(AnalysisFactorSchema),
    overallConfidence: z.number(),
    factorScores: z.record(z.number()),
    recommendations: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const ScenarioValidationUpdateMessageSchema = z.object({
  type: z.literal('scenario_validation_update'),
  data: z.object({
    scenarioId: z.string(),
    validationStatus: z.enum(['pending', 'validated', 'failed', 'in_progress']),
    errors: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    validatedAt: z.number().optional(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const CollaborationUpdateMessageSchema = z.object({
  type: z.literal('collaboration_update'),
  data: z.object({
    scenarioId: z.string(),
    activeUsers: z.array(z.string()),
    lastModifiedBy: z.string(),
    lastModifiedAt: z.string(),
    changeCount: z.number(),
    conflictCount: z.number(),
    version: z.number(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

// ============================================================================
// OUTCOMES DASHBOARD MESSAGES
// ============================================================================

const OpportunityDataSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  roiScore: z.number(),
  confidence: z.number(),
  horizon: z.enum(['immediate', 'short', 'medium', 'long']),
  riskLevel: z.number(),
  momentum: z.number(),
  sector: z.array(z.string()),
  marketLevel: z.array(z.string()),
  updatedAt: z.string(),
});

export const OpportunityUpdateMessageSchema = z.object({
  type: z.literal('opportunity_update'),
  data: z.object({
    opportunityId: z.string(),
    opportunity: OpportunityDataSchema,
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const ActionUpdateMessageSchema = z.object({
  type: z.literal('action_update'),
  data: z.object({
    actionId: z.string(),
    opportunityId: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
    updatedAt: z.string(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const StakeholderUpdateMessageSchema = z.object({
  type: z.literal('stakeholder_update'),
  data: z.object({
    stakeholderId: z.string(),
    influence: z.number().optional(),
    alignment: z.number().optional(),
    updatedAt: z.string(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const EvidenceUpdateMessageSchema = z.object({
  type: z.literal('evidence_update'),
  data: z.object({
    evidenceId: z.string(),
    opportunityIds: z.array(z.string()),
    confidence: z.number(),
    updatedAt: z.string(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

// ============================================================================
// SYSTEM & ERROR MESSAGES
// ============================================================================

export const PingMessageSchema = z.object({
  type: z.literal('ping'),
  data: z.object({}).optional(),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const PongMessageSchema = z.object({
  type: z.literal('pong'),
  data: z.object({
    client_id: z.string().optional(),
    timestamp: z.number(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const SerializationErrorMessageSchema = z.object({
  type: z.literal('serialization_error'),
  error: z.string(),
  originalMessageType: z.string().optional(),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const ConnectionEstablishedMessageSchema = z.object({
  type: z.literal('connection_established'),
  data: z.object({
    clientId: z.string(),
    serverTime: z.number(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const HeartbeatMessageSchema = z.object({
  type: z.literal('heartbeat'),
  data: z.object({
    serverTime: z.number(),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const EchoMessageSchema = z.object({
  type: z.literal('echo'),
  data: z.any(),
  client_id: z.string().optional(),
  server_processing_ms: z.number().optional(),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const SubscribeMessageSchema = z.object({
  type: z.literal('subscribe'),
  channels: z.array(z.string()),
  timestamp: TimestampSchema,
}).strict();

export const UnsubscribeMessageSchema = z.object({
  type: z.literal('unsubscribe'),
  channels: z.array(z.string()),
  timestamp: TimestampSchema,
}).strict();

export const CacheInvalidateMessageSchema = z.object({
  type: z.literal('cache_invalidate'),
  data: z.object({
    keys: z.array(z.array(z.string())),
    strategy: z.enum(['cascade', 'selective', 'lazy', 'immediate']),
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

export const BatchMessageSchema = z.object({
  type: z.literal('batch'),
  data: z.object({
    messages: z.array(z.any()), // Will be validated recursively
  }),
  timestamp: TimestampSchema,
  channels: ChannelsSchema,
}).strict();

// ============================================================================
// DISCRIMINATED UNION - SINGLE SOURCE OF TRUTH
// ============================================================================

export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  // Entity & Hierarchy
  EntityUpdateMessageSchema,
  HierarchyChangeMessageSchema,
  BulkUpdateMessageSchema,

  // Geospatial Layers
  LayerDataUpdateMessageSchema,
  GPUFilterSyncMessageSchema,

  // Feature Flags
  FeatureFlagChangeMessageSchema,
  FeatureFlagCreatedMessageSchema,
  FeatureFlagDeletedMessageSchema,

  // Scenarios & Forecasts
  ForecastUpdateMessageSchema,
  HierarchicalForecastUpdateMessageSchema,
  ScenarioAnalysisUpdateMessageSchema,
  ScenarioValidationUpdateMessageSchema,
  CollaborationUpdateMessageSchema,

  // Outcomes Dashboard
  OpportunityUpdateMessageSchema,
  ActionUpdateMessageSchema,
  StakeholderUpdateMessageSchema,
  EvidenceUpdateMessageSchema,

  // System & Errors
  PingMessageSchema,
  PongMessageSchema,
  SerializationErrorMessageSchema,
  ConnectionEstablishedMessageSchema,
  ErrorMessageSchema,
  HeartbeatMessageSchema,
  EchoMessageSchema,
  SubscribeMessageSchema,
  UnsubscribeMessageSchema,
  CacheInvalidateMessageSchema,
  BatchMessageSchema,
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Type exports for each message type
export type EntityUpdateMessage = z.infer<typeof EntityUpdateMessageSchema>;
export type HierarchyChangeMessage = z.infer<typeof HierarchyChangeMessageSchema>;
export type BulkUpdateMessage = z.infer<typeof BulkUpdateMessageSchema>;
export type LayerDataUpdateMessage = z.infer<typeof LayerDataUpdateMessageSchema>;
export type GPUFilterSyncMessage = z.infer<typeof GPUFilterSyncMessageSchema>;
export type FeatureFlagChangeMessage = z.infer<typeof FeatureFlagChangeMessageSchema>;
export type FeatureFlagCreatedMessage = z.infer<typeof FeatureFlagCreatedMessageSchema>;
export type FeatureFlagDeletedMessage = z.infer<typeof FeatureFlagDeletedMessageSchema>;
export type ForecastUpdateMessage = z.infer<typeof ForecastUpdateMessageSchema>;
export type HierarchicalForecastUpdateMessage = z.infer<typeof HierarchicalForecastUpdateMessageSchema>;
export type ScenarioAnalysisUpdateMessage = z.infer<typeof ScenarioAnalysisUpdateMessageSchema>;
export type ScenarioValidationUpdateMessage = z.infer<typeof ScenarioValidationUpdateMessageSchema>;
export type CollaborationUpdateMessage = z.infer<typeof CollaborationUpdateMessageSchema>;
export type OpportunityUpdateMessage = z.infer<typeof OpportunityUpdateMessageSchema>;
export type ActionUpdateMessage = z.infer<typeof ActionUpdateMessageSchema>;
export type StakeholderUpdateMessage = z.infer<typeof StakeholderUpdateMessageSchema>;
export type EvidenceUpdateMessage = z.infer<typeof EvidenceUpdateMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export type PongMessage = z.infer<typeof PongMessageSchema>;
export type SerializationErrorMessage = z.infer<typeof SerializationErrorMessageSchema>;
export type ConnectionEstablishedMessage = z.infer<typeof ConnectionEstablishedMessageSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;
export type EchoMessage = z.infer<typeof EchoMessageSchema>;
export type SubscribeMessage = z.infer<typeof SubscribeMessageSchema>;
export type UnsubscribeMessage = z.infer<typeof UnsubscribeMessageSchema>;
export type CacheInvalidateMessage = z.infer<typeof CacheInvalidateMessageSchema>;
export type BatchMessage = z.infer<typeof BatchMessageSchema>;

// ============================================================================
// RUNTIME TYPE GUARDS
// ============================================================================

export function isEntityUpdate(msg: WebSocketMessage): msg is EntityUpdateMessage {
  return msg.type === 'entity_update';
}

export function isHierarchyChange(msg: WebSocketMessage): msg is HierarchyChangeMessage {
  return msg.type === 'hierarchy_change';
}

export function isBulkUpdate(msg: WebSocketMessage): msg is BulkUpdateMessage {
  return msg.type === 'bulk_update';
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

export function isFeatureFlagCreated(msg: WebSocketMessage): msg is FeatureFlagCreatedMessage {
  return msg.type === 'feature_flag_created';
}

export function isFeatureFlagDeleted(msg: WebSocketMessage): msg is FeatureFlagDeletedMessage {
  return msg.type === 'feature_flag_deleted';
}

export function isForecastUpdate(msg: WebSocketMessage): msg is ForecastUpdateMessage {
  return msg.type === 'forecast_update';
}

export function isHierarchicalForecastUpdate(msg: WebSocketMessage): msg is HierarchicalForecastUpdateMessage {
  return msg.type === 'hierarchical_forecast_update';
}

export function isScenarioAnalysisUpdate(msg: WebSocketMessage): msg is ScenarioAnalysisUpdateMessage {
  return msg.type === 'scenario_analysis_update';
}

export function isScenarioValidationUpdate(msg: WebSocketMessage): msg is ScenarioValidationUpdateMessage {
  return msg.type === 'scenario_validation_update';
}

export function isCollaborationUpdate(msg: WebSocketMessage): msg is CollaborationUpdateMessage {
  return msg.type === 'collaboration_update';
}

export function isOpportunityUpdate(msg: WebSocketMessage): msg is OpportunityUpdateMessage {
  return msg.type === 'opportunity_update';
}

export function isActionUpdate(msg: WebSocketMessage): msg is ActionUpdateMessage {
  return msg.type === 'action_update';
}

export function isStakeholderUpdate(msg: WebSocketMessage): msg is StakeholderUpdateMessage {
  return msg.type === 'stakeholder_update';
}

export function isEvidenceUpdate(msg: WebSocketMessage): msg is EvidenceUpdateMessage {
  return msg.type === 'evidence_update';
}

export function isPing(msg: WebSocketMessage): msg is PingMessage {
  return msg.type === 'ping';
}

export function isPong(msg: WebSocketMessage): msg is PongMessage {
  return msg.type === 'pong';
}

export function isSerializationError(msg: WebSocketMessage): msg is SerializationErrorMessage {
  return msg.type === 'serialization_error';
}

export function isConnectionEstablished(msg: WebSocketMessage): msg is ConnectionEstablishedMessage {
  return msg.type === 'connection_established';
}

export function isError(msg: WebSocketMessage): msg is ErrorMessage {
  return msg.type === 'error';
}

export function isHeartbeat(msg: WebSocketMessage): msg is HeartbeatMessage {
  return msg.type === 'heartbeat';
}

export function isEcho(msg: WebSocketMessage): msg is EchoMessage {
  return msg.type === 'echo';
}

export function isSubscribe(msg: WebSocketMessage): msg is SubscribeMessage {
  return msg.type === 'subscribe';
}

export function isUnsubscribe(msg: WebSocketMessage): msg is UnsubscribeMessage {
  return msg.type === 'unsubscribe';
}

export function isCacheInvalidate(msg: WebSocketMessage): msg is CacheInvalidateMessage {
  return msg.type === 'cache_invalidate';
}

export function isBatch(msg: WebSocketMessage): msg is BatchMessage {
  return msg.type === 'batch';
}

// ============================================================================
// MESSAGE PARSING & VALIDATION
// ============================================================================

/**
 * Parse and validate a WebSocket message (throws on failure)
 * Use this when you want errors to be thrown for invalid messages
 */
export function parseWebSocketMessage(raw: unknown): WebSocketMessage {
  return WebSocketMessageSchema.parse(raw);
}

/**
 * Safely parse and validate a WebSocket message (returns Result type)
 * Use this when you want to handle validation errors gracefully
 */
export function safeParseWebSocketMessage(
  raw: unknown
): { success: true; data: WebSocketMessage } | { success: false; error: z.ZodError } {
  return WebSocketMessageSchema.safeParse(raw);
}

/**
 * Parse raw JSON string into validated WebSocket message
 */
export function parseWebSocketJSON(json: string): WebSocketMessage {
  const parsed = JSON.parse(json);
  return parseWebSocketMessage(parsed);
}

/**
 * Safely parse raw JSON string into validated WebSocket message
 */
export function safeParseWebSocketJSON(
  json: string
): { success: true; data: WebSocketMessage } | { success: false; error: Error } {
  try {
    const parsed = JSON.parse(json);
    const result = safeParseWebSocketMessage(parsed);
    if (result.success) {
      return result;
    }
    // Type narrowing: result.success is false, so result.error exists
    const zodError = result as { success: false; error: z.ZodError };
    return { success: false, error: new Error(zodError.error.message) };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// ============================================================================
// EXHAUSTIVENESS CHECKING
// ============================================================================

/**
 * Ensures all message types are handled (compile-time check)
 * Use in default case of switch statements
 *
 * @example
 * switch (message.type) {
 *   case 'entity_update': return handleEntityUpdate(message);
 *   case 'hierarchy_change': return handleHierarchyChange(message);
 *   // ... all other cases
 *   default: return assertNever(message);
 * }
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled message type: ${JSON.stringify(x)}`);
}

/**
 * Type-safe message dispatcher
 * Ensures all message types have handlers
 */
export type MessageHandlers = {
  [K in WebSocketMessage['type']]: (
    message: Extract<WebSocketMessage, { type: K }>
  ) => void | Promise<void>;
};

/**
 * Dispatch message to appropriate handler with exhaustiveness checking
 */
export async function dispatchMessage(
  message: WebSocketMessage,
  handlers: Partial<MessageHandlers>
): Promise<void> {
  const messageType = message.type;
  const handler = handlers[messageType] as ((msg: WebSocketMessage) => void | Promise<void>) | undefined;

  if (handler) {
    // Type narrowing: handler expects the correct message type via MessageHandlers definition
    await handler(message);
  } else {
    console.warn(`No handler registered for message type: ${messageType}`, message);
  }
}

/**
 * Log unknown message types for monitoring drift
 */
export function logUnknownMessage(raw: unknown): void {
  console.warn('[WebSocket] Unknown or invalid message received:', {
    raw,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// DEFECT FIX #1: RUNTIME VALIDATION FOR WEBSOCKET MESSAGES
// ============================================================================

/**
 * Alias for backward compatibility with existing code
 */
export type RealtimeMessage = WebSocketMessage;

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  message?: WebSocketMessage;
  errors?: z.ZodError['errors'];
}

/**
 * Validate a raw message against the WebSocket schema
 * Returns a validation result with detailed error information
 */
export function validateRealtimeMessage(raw: unknown): ValidationResult {
  const result = safeParseWebSocketMessage(raw);

  if (result.success) {
    return {
      valid: true,
      message: result.data,
    };
  } else {
    return {
      valid: false,
      errors: result.error.errors,
    };
  }
}

/**
 * Parse and validate a realtime message (throws on failure)
 * Use this when you want errors to be thrown for invalid messages
 */
export function parseRealtimeMessage(raw: unknown): RealtimeMessage {
  return parseWebSocketMessage(raw);
}

/**
 * Type aliases for message types used in handlers
 */
export type SearchUpdateMessage = WebSocketMessage & {
  type: 'search_update';
  payload: {
    query: string;
    results: Array<{
      id: string;
      name: string;
      path: string;
      type: string;
    }>;
  };
};

/**
 * Type guard for search update messages
 */
export function isSearchUpdate(msg: WebSocketMessage): msg is SearchUpdateMessage {
  return (msg as any).type === 'search_update';
}

// ============================================================================
// DEFECT FIX #2: MESSAGE SEQUENCE TRACKER (RACE CONDITION FIX)
// ============================================================================

/**
 * Tracks message sequence numbers to prevent processing out-of-order messages
 * Also provides a processing queue to ensure sequential execution
 *
 * FIXES: Defect #2 - Race condition where concurrent async message processing
 * could cause out-of-order state updates
 */
export class MessageSequenceTracker {
  private sequenceMap = new Map<string, number>();
  private processingQueue = new Map<string, Promise<void>>();

  /**
   * Check if a message should be processed based on sequence number
   * Returns false if an equal or higher sequence number has already been seen
   */
  shouldProcess(message: RealtimeMessage): boolean {
    const clientId = (message as any).meta?.clientId || (message as any).clientId || 'default';
    const sequence = (message as any).meta?.sequence || (message as any).sequence;

    if (sequence === undefined) {
      // No sequence number - allow processing
      return true;
    }

    const lastSequence = this.sequenceMap.get(clientId) ?? -1;

    if (sequence <= lastSequence) {
      // Out of order or duplicate message
      console.warn(`Dropping out-of-order message: sequence=${sequence}, last=${lastSequence}, client=${clientId}`);
      return false;
    }

    // Update sequence tracker
    this.sequenceMap.set(clientId, sequence);
    return true;
  }

  /**
   * Process a message in order, ensuring sequential execution
   * Messages from the same client are processed sequentially, even if async
   *
   * @param message - The message to process
   * @param handler - Async handler function to execute
   */
  async processInOrder(
    message: RealtimeMessage,
    handler: () => Promise<void>
  ): Promise<void> {
    const clientId = (message as any).meta?.clientId || (message as any).clientId || 'default';

    // Get the previous promise for this client (or resolve immediately)
    const previousPromise = this.processingQueue.get(clientId) || Promise.resolve();

    // Chain this message's processing after the previous one
    const currentPromise = previousPromise
      .then(async () => {
        // Check if we should process this message
        if (this.shouldProcess(message)) {
          await handler();
        }
      })
      .catch((error) => {
        // Log error but don't block subsequent messages
        console.error('Error processing message in sequence:', error);
      });

    // Store the promise for the next message to chain after
    this.processingQueue.set(clientId, currentPromise);

    // Wait for this message to complete
    await currentPromise;
  }

  /**
   * Reset sequence tracking for a specific client
   */
  reset(clientId: string): void {
    this.sequenceMap.delete(clientId);
    this.processingQueue.delete(clientId);
  }

  /**
   * Clear all sequence tracking data
   */
  clearAll(): void {
    this.sequenceMap.clear();
    this.processingQueue.clear();
  }
}

// ============================================================================
// DEFECT FIX #4: MESSAGE DEDUPLICATOR WITH MEMORY LEAK FIX
// ============================================================================

/**
 * Deduplicates WebSocket messages within a time window
 * Prevents processing duplicate messages that arrive close together
 *
 * FIXES: Defect #4 - Memory leak where old entries never expire during idle periods
 * Added periodic cleanup timer to ensure bounded memory usage
 */
export class MessageDeduplicator {
  private recentMessages = new Map<string, number>();
  private windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * @param windowMs - Time window for deduplication in milliseconds (default 5000ms)
   */
  constructor(windowMs = 5000) {
    this.windowMs = windowMs;

    // DEFECT FIX #4: Start periodic cleanup timer
    // This ensures old entries are removed even during idle periods
    this.cleanupTimer = setInterval(() => {
      this.cleanup(Date.now());
    }, windowMs);
  }

  /**
   * Check if a message is new (not a duplicate)
   * @param message - The message to check
   * @returns true if message is new, false if duplicate
   */
  isNew(message: RealtimeMessage): boolean {
    const key = this.generateKey(message);
    const now = Date.now();

    // Inline cleanup for immediate response
    this.cleanup(now);

    const lastSeen = this.recentMessages.get(key);

    if (lastSeen && (now - lastSeen) < this.windowMs) {
      // Duplicate message within time window
      return false;
    }

    // New message - record it
    this.recentMessages.set(key, now);
    return true;
  }

  /**
   * Generate a unique key for a message based on its content
   */
  private generateKey(message: RealtimeMessage): string {
    const type = message.type;
    const timestamp = (message as any).timestamp || (message as any).meta?.timestamp;

    // Generate key based on message type and relevant identifying fields
    switch (type) {
      case 'entity_update': {
        const entityMsg = message as EntityUpdateMessage;
        return `entity_update:${entityMsg.data.entityId}:${timestamp}`;
      }
      case 'hierarchy_change': {
        const hierarchyMsg = message as HierarchyChangeMessage;
        return `hierarchy_change:${hierarchyMsg.data.path}:${timestamp}`;
      }
      case 'bulk_update': {
        const bulkMsg = message as BulkUpdateMessage;
        return `bulk_update:${bulkMsg.data.entityIds.join(',')}:${timestamp}`;
      }
      case 'cache_invalidate': {
        const cacheMsg = message as CacheInvalidateMessage;
        return `cache_invalidate:${JSON.stringify(cacheMsg.data.keys)}:${timestamp}`;
      }
      case 'layer_data_update': {
        const layerMsg = message as LayerDataUpdateMessage;
        return `layer_data_update:${layerMsg.data.layerId}:${timestamp}`;
      }
      default:
        // Generic key for other message types
        return `${type}:${timestamp}:${JSON.stringify(message).substring(0, 100)}`;
    }
  }

  /**
   * Remove expired entries from the deduplication map
   */
  private cleanup(now: number): void {
    const cutoff = now - this.windowMs;

    for (const [key, timestamp] of this.recentMessages.entries()) {
      if (timestamp < cutoff) {
        this.recentMessages.delete(key);
      }
    }
  }

  /**
   * DEFECT FIX #4: Cleanup method to prevent memory leaks
   * Call this when the deduplicator is no longer needed (e.g., component unmount)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.recentMessages.clear();
  }

  /**
   * Get current size of the deduplication map (for monitoring)
   */
  getSize(): number {
    return this.recentMessages.size;
  }
}
