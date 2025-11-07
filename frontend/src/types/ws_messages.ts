/**
 * WebSocket Realtime Message Discriminated Unions
 *
 * This file defines type-safe discriminated unions for all WebSocket messages
 * with runtime type guards for safe message handling.
 *
 * Aligns with existing message types:
 * - layer_data_update
 * - gpu_filter_sync
 * - polygon_update
 * - linestring_update
 * - geometry_batch_update
 */

import { z } from 'zod';
import {
  MessageMetaSchema,
  LayerDataUpdatePayloadSchema,
  GPUFilterSyncPayloadSchema,
  PolygonUpdatePayloadSchema,
  PolygonActionSchema,
  LinestringUpdatePayloadSchema,
  LinestringActionSchema,
  GeometryBatchUpdatePayloadSchema,
  ErrorPayloadSchema,
  type MessageMeta,
  type LayerDataUpdatePayload,
  type GPUFilterSyncPayload,
  type PolygonUpdatePayload,
  type PolygonAction,
  type LinestringUpdatePayload,
  type LinestringAction,
  type GeometryBatchUpdatePayload,
  type ErrorPayload,
} from './contracts.generated';

// ============================================================================
// Discriminated Union Message Types
// ============================================================================

export const LayerDataUpdateMessageSchema = z.object({
  type: z.literal('layer_data_update'),
  payload: LayerDataUpdatePayloadSchema,
  meta: MessageMetaSchema,
}).strict();

export type LayerDataUpdateMessage = z.infer<typeof LayerDataUpdateMessageSchema>;

export const GPUFilterSyncMessageSchema = z.object({
  type: z.literal('gpu_filter_sync'),
  payload: GPUFilterSyncPayloadSchema,
  meta: MessageMetaSchema,
}).strict();

export type GPUFilterSyncMessage = z.infer<typeof GPUFilterSyncMessageSchema>;

export const PolygonUpdateMessageSchema = z.object({
  type: z.literal('polygon_update'),
  action: PolygonActionSchema,
  payload: PolygonUpdatePayloadSchema,
  meta: MessageMetaSchema,
}).strict();

export type PolygonUpdateMessage = z.infer<typeof PolygonUpdateMessageSchema>;

export const LinestringUpdateMessageSchema = z.object({
  type: z.literal('linestring_update'),
  action: LinestringActionSchema,
  payload: LinestringUpdatePayloadSchema,
  meta: MessageMetaSchema,
}).strict();

export type LinestringUpdateMessage = z.infer<typeof LinestringUpdateMessageSchema>;

export const GeometryBatchUpdateMessageSchema = z.object({
  type: z.literal('geometry_batch_update'),
  payload: GeometryBatchUpdatePayloadSchema,
  meta: MessageMetaSchema,
}).strict();

export type GeometryBatchUpdateMessage = z.infer<typeof GeometryBatchUpdateMessageSchema>;

export const HeartbeatMessageSchema = z.object({
  type: z.literal('heartbeat'),
  meta: MessageMetaSchema,
}).strict();

export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;

export const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  payload: ErrorPayloadSchema,
  meta: MessageMetaSchema,
}).strict();

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

// ============================================================================
// Discriminated Union
// ============================================================================

export const RealtimeMessageSchema = z.discriminatedUnion('type', [
  LayerDataUpdateMessageSchema,
  GPUFilterSyncMessageSchema,
  PolygonUpdateMessageSchema,
  LinestringUpdateMessageSchema,
  GeometryBatchUpdateMessageSchema,
  HeartbeatMessageSchema,
  ErrorMessageSchema,
]);

export type RealtimeMessage =
  | LayerDataUpdateMessage
  | GPUFilterSyncMessage
  | PolygonUpdateMessage
  | LinestringUpdateMessage
  | GeometryBatchUpdateMessage
  | HeartbeatMessage
  | ErrorMessage;

// ============================================================================
// Runtime Type Guards
// ============================================================================

/**
 * Type guard for LayerDataUpdateMessage
 */
export function isLayerDataUpdate(msg: RealtimeMessage): msg is LayerDataUpdateMessage {
  return msg.type === 'layer_data_update';
}

/**
 * Type guard for GPUFilterSyncMessage
 */
export function isGPUFilterSync(msg: RealtimeMessage): msg is GPUFilterSyncMessage {
  return msg.type === 'gpu_filter_sync';
}

/**
 * Type guard for PolygonUpdateMessage
 */
export function isPolygonUpdate(msg: RealtimeMessage): msg is PolygonUpdateMessage {
  return msg.type === 'polygon_update';
}

/**
 * Type guard for LinestringUpdateMessage
 */
export function isLinestringUpdate(msg: RealtimeMessage): msg is LinestringUpdateMessage {
  return msg.type === 'linestring_update';
}

/**
 * Type guard for GeometryBatchUpdateMessage
 */
export function isGeometryBatchUpdate(msg: RealtimeMessage): msg is GeometryBatchUpdateMessage {
  return msg.type === 'geometry_batch_update';
}

/**
 * Type guard for HeartbeatMessage
 */
export function isHeartbeat(msg: RealtimeMessage): msg is HeartbeatMessage {
  return msg.type === 'heartbeat';
}

/**
 * Type guard for ErrorMessage
 */
export function isError(msg: RealtimeMessage): msg is ErrorMessage {
  return msg.type === 'error';
}

// ============================================================================
// Message Validation and Parsing
// ============================================================================

/**
 * Parse and validate a raw WebSocket message
 * Throws if validation fails
 */
export function parseRealtimeMessage(rawMessage: unknown): RealtimeMessage {
  const result = RealtimeMessageSchema.safeParse(rawMessage);

  if (!result.success) {
    const errorDetails = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    throw new Error(
      `WebSocket message validation failed:\n${JSON.stringify(errorDetails, null, 2)}`
    );
  }

  return result.data;
}

/**
 * Safely validate a message without throwing
 * Returns validation result with typed data or errors
 */
export function validateRealtimeMessage(
  rawMessage: unknown
): { valid: true; message: RealtimeMessage } | { valid: false; errors: z.ZodIssue[] } {
  const result = RealtimeMessageSchema.safeParse(rawMessage);

  if (result.success) {
    return { valid: true, message: result.data };
  }

  return { valid: false, errors: result.error.issues };
}

/**
 * Parse raw WebSocket string data
 * Handles JSON parsing + validation
 */
export function parseWebSocketData(data: string): RealtimeMessage {
  try {
    const parsed = JSON.parse(data);
    return parseRealtimeMessage(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in WebSocket message: ${error.message}`);
    }
    throw error;
  }
}

// ============================================================================
// Message Handler Type Definitions
// ============================================================================

export interface MessageHandlers {
  onLayerDataUpdate?: (msg: LayerDataUpdateMessage) => void | Promise<void>;
  onGPUFilterSync?: (msg: GPUFilterSyncMessage) => void | Promise<void>;
  onPolygonUpdate?: (msg: PolygonUpdateMessage) => void | Promise<void>;
  onLinestringUpdate?: (msg: LinestringUpdateMessage) => void | Promise<void>;
  onGeometryBatchUpdate?: (msg: GeometryBatchUpdateMessage) => void | Promise<void>;
  onHeartbeat?: (msg: HeartbeatMessage) => void | Promise<void>;
  onError?: (msg: ErrorMessage) => void | Promise<void>;
}

/**
 * Dispatch a validated message to appropriate handler
 */
export async function dispatchRealtimeMessage(
  message: RealtimeMessage,
  handlers: MessageHandlers
): Promise<void> {
  if (isLayerDataUpdate(message) && handlers.onLayerDataUpdate) {
    await handlers.onLayerDataUpdate(message);
  } else if (isGPUFilterSync(message) && handlers.onGPUFilterSync) {
    await handlers.onGPUFilterSync(message);
  } else if (isPolygonUpdate(message) && handlers.onPolygonUpdate) {
    await handlers.onPolygonUpdate(message);
  } else if (isLinestringUpdate(message) && handlers.onLinestringUpdate) {
    await handlers.onLinestringUpdate(message);
  } else if (isGeometryBatchUpdate(message) && handlers.onGeometryBatchUpdate) {
    await handlers.onGeometryBatchUpdate(message);
  } else if (isHeartbeat(message) && handlers.onHeartbeat) {
    await handlers.onHeartbeat(message);
  } else if (isError(message) && handlers.onError) {
    await handlers.onError(message);
  }
}

// ============================================================================
// Message Sequence Tracking (for idempotency)
// ============================================================================

export class MessageSequenceTracker {
  private sequences = new Map<string, number>();
  private processingQueue = new Map<string, Promise<void>>();

  /**
   * Check if a message is out of order or duplicate
   * Returns true if message should be processed, false if should be ignored
   */
  shouldProcess(message: RealtimeMessage): boolean {
    const { sequence, clientId } = message.meta;

    // If no sequence number, always process
    if (sequence === undefined || !clientId) {
      return true;
    }

    const lastSeq = this.sequences.get(clientId);

    // First message from this client
    if (lastSeq === undefined) {
      this.sequences.set(clientId, sequence);
      return true;
    }

    // Duplicate message (idempotency check)
    if (sequence <= lastSeq) {
      return false;
    }

    // New message in sequence
    this.sequences.set(clientId, sequence);
    return true;
  }

  /**
   * Process a message in order, preventing race conditions
   * Ensures messages from the same client are processed sequentially
   *
   * @param message - The message to process
   * @param handler - Async function that processes the message
   * @returns Promise that resolves when the message is processed
   */
  async processInOrder(
    message: RealtimeMessage,
    handler: () => Promise<void>
  ): Promise<void> {
    const clientId = message.meta.clientId || 'default';

    // Get the previous promise in the queue (or a resolved one if this is the first)
    const previousPromise = this.processingQueue.get(clientId) || Promise.resolve();

    // Create a new promise that waits for the previous one to complete
    const currentPromise = previousPromise
      .then(async () => {
        // Only process if the message should be processed (sequence check)
        if (this.shouldProcess(message)) {
          await handler();
        } else {
          console.log(
            `Skipping out-of-order or duplicate message: seq=${message.meta.sequence}, client=${clientId}`
          );
        }
      })
      .catch((error) => {
        // Log error but don't block subsequent messages
        console.error(`Error processing message in sequence for client ${clientId}:`, error);
      });

    // Update the queue with the current promise
    this.processingQueue.set(clientId, currentPromise);

    // Wait for this message to be processed
    await currentPromise;
  }

  /**
   * Reset tracking for a client
   */
  reset(clientId: string): void {
    this.sequences.delete(clientId);
    this.processingQueue.delete(clientId);
  }

  /**
   * Clear all tracked sequences
   */
  clearAll(): void {
    this.sequences.clear();
    this.processingQueue.clear();
  }
}

// ============================================================================
// Message Deduplication (for idempotency)
// ============================================================================

export class MessageDeduplicator {
  private recentMessages = new Map<string, number>();
  private readonly windowMs: number;

  constructor(windowMs: number = 5000) {
    this.windowMs = windowMs;
  }

  /**
   * Check if a message has been seen recently
   * Returns true if message is new, false if duplicate
   */
  isNew(message: RealtimeMessage): boolean {
    const key = this.getMessageKey(message);
    const now = Date.now();
    const lastSeen = this.recentMessages.get(key);

    // Clean up old entries
    this.cleanup(now);

    if (lastSeen && now - lastSeen < this.windowMs) {
      return false; // Duplicate within window
    }

    this.recentMessages.set(key, now);
    return true;
  }

  private getMessageKey(message: RealtimeMessage): string {
    // Create unique key based on message content
    if (isLayerDataUpdate(message)) {
      return `layer:${message.payload.layer_id}:${message.payload.changed_at}`;
    }
    if (isGPUFilterSync(message)) {
      return `filter:${message.payload.filter_id}:${message.payload.changed_at}`;
    }
    if (isPolygonUpdate(message)) {
      return `polygon:${message.payload.entityId}:${message.payload.timestamp}`;
    }
    if (isLinestringUpdate(message)) {
      return `linestring:${message.payload.entityId}:${message.payload.timestamp}`;
    }
    if (isGeometryBatchUpdate(message)) {
      return `batch:${message.payload.batch_id}:${message.payload.timestamp}`;
    }

    // Fallback for other message types
    return `${message.type}:${message.meta.timestamp}`;
  }

  private cleanup(now: number): void {
    const cutoff = now - this.windowMs;
    for (const [key, timestamp] of this.recentMessages.entries()) {
      if (timestamp < cutoff) {
        this.recentMessages.delete(key);
      }
    }
  }

  /**
   * Clear all tracked messages
   */
  clear(): void {
    this.recentMessages.clear();
  }
}
