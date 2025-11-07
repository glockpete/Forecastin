/**
 * Validated WebSocket Message Handlers
 *
 * Wraps message handlers with:
 * - Schema validation (Zod)
 * - Idempotency guards (duplicate detection)
 * - Result<T,E> error handling
 * - Performance monitoring
 */

import { z } from 'zod';
import { Result, Ok, Err } from '../types/brand';
import { parseOrReport, ParseError } from '../utils/validation';
import {
  wsIdempotencyGuard,
  wsIdempotencyMetrics,
  getMessageId,
} from '../utils/idempotencyGuard';
import { AppError, reportError } from '../errors/errorCatalog';

/**
 * Message handler function type
 */
export type MessageHandler<T> = (message: T) => Promise<void> | void;

/**
 * Validated handler result
 */
export type HandlerResult =
  | { success: true }
  | { success: false; error: ParseError | AppError; isDuplicate?: boolean };

/**
 * Handler options
 */
export interface HandlerOptions {
  /** Enable idempotency checking */
  checkIdempotency?: boolean;
  /** Schema name for logging */
  schemaName?: string;
  /** Allow duplicate messages */
  allowDuplicates?: boolean;
}

/**
 * Wrap a message handler with validation and idempotency guards
 *
 * Usage:
 *   const handler = createValidatedHandler(
 *     EntityUpdateMessageSchema,
 *     async (message) => {
 *       // Process validated message
 *     },
 *     { checkIdempotency: true }
 *   );
 *
 *   const result = await handler(rawMessage);
 *   if (!result.success) {
 *     console.error(result.error);
 *   }
 */
export function createValidatedHandler<T>(
  schema: z.ZodSchema<T>,
  handler: MessageHandler<T>,
  options: HandlerOptions = {}
): (data: unknown) => Promise<HandlerResult> {
  const {
    checkIdempotency = true,
    schemaName = 'WebSocketMessage',
    allowDuplicates = false,
  } = options;

  return async (data: unknown): Promise<HandlerResult> => {
    const startTime = performance.now();

    try {
      // Step 1: Validate message schema
      const parseResult = parseOrReport(schema, data, schemaName);

      if (!parseResult.success) {
        console.error(`[${schemaName}] Validation failed:`, parseResult.error.toDebugString());
        reportError(new AppError('ERR_303', {
          schemaName,
          error: parseResult.error.toStructured(),
        }));
        return { success: false, error: parseResult.error };
      }

      const validatedMessage = parseResult.value;

      // Step 2: Idempotency check (if enabled)
      if (checkIdempotency && !allowDuplicates) {
        const messageId = getMessageId(data as Record<string, unknown>);
        const isNewMessage = wsIdempotencyGuard.checkAndMark(messageId);

        if (!isNewMessage) {
          // Duplicate message - skip processing
          wsIdempotencyMetrics.recordDuplicate(messageId);
          console.debug(`[${schemaName}] Duplicate message ignored: ${messageId}`);
          reportError(new AppError('ERR_304', {
            schemaName,
            messageId,
          }));
          return {
            success: false,
            error: new AppError('ERR_304'),
            isDuplicate: true,
          };
        }

        wsIdempotencyMetrics.recordProcessed(messageId);
      }

      // Step 3: Process message
      await handler(validatedMessage);

      const duration = performance.now() - startTime;
      console.debug(`[${schemaName}] Processed in ${duration.toFixed(2)}ms`);

      return { success: true };

    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`[${schemaName}] Handler failed after ${duration.toFixed(2)}ms:`, error);

      const appError = error instanceof AppError
        ? error
        : new AppError('ERR_999', {
            schemaName,
            originalError: error instanceof Error ? error.message : String(error),
          });

      reportError(appError);
      return { success: false, error: appError };
    }
  };
}

/**
 * Create a batch handler that validates and processes multiple messages
 */
export function createBatchHandler<T>(
  schema: z.ZodSchema<T>,
  handler: MessageHandler<T[]>,
  options: HandlerOptions = {}
): (data: unknown[]) => Promise<HandlerResult[]> {
  return async (dataArray: unknown[]): Promise<HandlerResult[]> => {
    const results: HandlerResult[] = [];

    // Validate all messages first
    const validatedMessages: T[] = [];
    for (const data of dataArray) {
      const parseResult = parseOrReport(schema, data, options.schemaName);

      if (!parseResult.success) {
        results.push({ success: false, error: parseResult.error });
      } else {
        validatedMessages.push(parseResult.value);
        results.push({ success: true });
      }
    }

    // Process all valid messages
    if (validatedMessages.length > 0) {
      try {
        await handler(validatedMessages);
      } catch (error) {
        const appError = error instanceof AppError
          ? error
          : new AppError('ERR_999', {
              schemaName: options.schemaName,
              originalError: error instanceof Error ? error.message : String(error),
            });

        reportError(appError);
        // Mark all as failed
        return results.map(() => ({ success: false, error: appError }));
      }
    }

    return results;
  };
}

/**
 * Typed message router that dispatches to specific handlers
 */
export class ValidatedMessageRouter<T extends { type: string }> {
  private handlers = new Map<string, (message: T) => Promise<HandlerResult>>();
  private defaultHandler?: (message: T) => Promise<HandlerResult>;

  /**
   * Register a handler for a specific message type
   */
  on<M extends T>(
    type: M['type'],
    schema: z.ZodSchema<M>,
    handler: MessageHandler<M>,
    options?: HandlerOptions
  ): this {
    const validatedHandler = createValidatedHandler(
      schema,
      handler,
      { ...options, schemaName: `Message:${type}` }
    );

    this.handlers.set(type, validatedHandler as (message: T) => Promise<HandlerResult>);
    return this;
  }

  /**
   * Set default handler for unknown message types
   */
  onUnknown(handler: MessageHandler<T>, options?: HandlerOptions): this {
    const baseSchema = z.object({ type: z.string() }) as z.ZodSchema<T>;
    this.defaultHandler = createValidatedHandler(
      baseSchema,
      handler,
      { ...options, schemaName: 'Message:Unknown' }
    );
    return this;
  }

  /**
   * Route message to appropriate handler
   */
  async route(data: unknown): Promise<HandlerResult> {
    // First validate that it has a type field
    const baseResult = parseOrReport(
      z.object({ type: z.string() }),
      data,
      'MessageBase'
    );

    if (!baseResult.success) {
      return { success: false, error: baseResult.error };
    }

    const messageType = baseResult.value.type;
    const handler = this.handlers.get(messageType);

    if (handler) {
      return handler(data as T);
    }

    if (this.defaultHandler) {
      return this.defaultHandler(data as T);
    }

    // No handler found
    const error = new AppError('ERR_999', {
      reason: 'No handler registered for message type',
      messageType,
    });
    reportError(error);
    return { success: false, error };
  }

  /**
   * Get router statistics
   */
  getStats() {
    return {
      registeredHandlers: this.handlers.size,
      hasDefaultHandler: !!this.defaultHandler,
      handlerTypes: Array.from(this.handlers.keys()),
    };
  }
}

/**
 * Performance monitor for message handlers
 */
export class HandlerPerformanceMonitor {
  private metrics = new Map<string, {
    count: number;
    totalTime: number;
    minTime: number;
    maxTime: number;
    lastTime: number;
  }>();

  record(handlerName: string, duration: number): void {
    const current = this.metrics.get(handlerName) || {
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      lastTime: 0,
    };

    current.count++;
    current.totalTime += duration;
    current.minTime = Math.min(current.minTime, duration);
    current.maxTime = Math.max(current.maxTime, duration);
    current.lastTime = duration;

    this.metrics.set(handlerName, current);
  }

  getStats(handlerName?: string) {
    if (handlerName) {
      const stats = this.metrics.get(handlerName);
      if (!stats) return null;

      return {
        ...stats,
        avgTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
      };
    }

    return Array.from(this.metrics.entries()).map(([name, stats]) => ({
      handlerName: name,
      ...stats,
      avgTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
    }));
  }

  reset(handlerName?: string): void {
    if (handlerName) {
      this.metrics.delete(handlerName);
    } else {
      this.metrics.clear();
    }
  }
}

/**
 * Global handler performance monitor
 */
export const handlerPerformanceMonitor = new HandlerPerformanceMonitor();
