/**
 * Idempotency Guard for WebSocket Messages
 *
 * Prevents duplicate message processing by tracking message IDs.
 * Uses a sliding window to limit memory usage.
 */

/**
 * Idempotency guard with sliding window
 */
export class IdempotencyGuard {
  private processedMessages: Set<string>;
  private messageTimestamps: Map<string, number>;
  private readonly windowMs: number;
  private readonly maxSize: number;
  private cleanupIntervalId?: NodeJS.Timeout;

  constructor(
    windowMs: number = 60000, // 1 minute default
    maxSize: number = 1000 // Maximum tracked messages
  ) {
    this.processedMessages = new Set();
    this.messageTimestamps = new Map();
    this.windowMs = windowMs;
    this.maxSize = maxSize;

    // Periodic cleanup of old messages
    this.cleanupIntervalId = setInterval(() => {
      this.cleanup();
    }, windowMs / 2);
  }

  /**
   * Check if message has been processed (idempotency check)
   * Returns true if this is a duplicate message
   */
  isDuplicate(messageId: string): boolean {
    return this.processedMessages.has(messageId);
  }

  /**
   * Mark message as processed
   */
  markProcessed(messageId: string): void {
    this.processedMessages.add(messageId);
    this.messageTimestamps.set(messageId, Date.now());

    // Enforce max size
    if (this.processedMessages.size > this.maxSize) {
      this.cleanup();
    }
  }

  /**
   * Check and mark atomically (returns true if message is new)
   */
  checkAndMark(messageId: string): boolean {
    if (this.isDuplicate(messageId)) {
      return false; // Duplicate
    }
    this.markProcessed(messageId);
    return true; // New message
  }

  /**
   * Clean up old messages outside the window
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    for (const [messageId, timestamp] of this.messageTimestamps.entries()) {
      if (timestamp < cutoff) {
        this.processedMessages.delete(messageId);
        this.messageTimestamps.delete(messageId);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      trackedMessages: this.processedMessages.size,
      windowMs: this.windowMs,
      maxSize: this.maxSize,
    };
  }

  /**
   * Clear all tracked messages
   */
  reset(): void {
    this.processedMessages.clear();
    this.messageTimestamps.clear();
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
    this.reset();
  }
}

/**
 * Generate deterministic message ID from message content
 * Use when message doesn't have explicit ID
 */
export function generateMessageId(message: unknown): string {
  const str = JSON.stringify(message);
  // Simple hash function (FNV-1a)
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Extract message ID from message (with fallback to content hash)
 */
export function getMessageId(message: Record<string, unknown>): string {
  // Try explicit message ID
  if (typeof message.messageId === 'string' && message.messageId) {
    return message.messageId;
  }

  // Try timestamp + type as ID (common pattern)
  if (message.timestamp && message.type) {
    return `${message.type}:${message.timestamp}`;
  }

  // Fallback to content hash
  return generateMessageId(message);
}

/**
 * Global idempotency guard instance for WebSocket messages
 */
export const wsIdempotencyGuard = new IdempotencyGuard(
  60000, // 1 minute window
  1000   // Track up to 1000 messages
);

/**
 * Idempotency metrics for monitoring
 */
export class IdempotencyMetrics {
  private duplicateCount = 0;
  private processedCount = 0;
  private lastDuplicateTime?: Date;

  recordDuplicate(messageId: string): void {
    this.duplicateCount++;
    this.lastDuplicateTime = new Date();
    console.debug(`[Idempotency] Duplicate message detected: ${messageId}`);
  }

  recordProcessed(messageId: string): void {
    this.processedCount++;
  }

  getStats() {
    return {
      duplicateCount: this.duplicateCount,
      processedCount: this.processedCount,
      duplicateRate: this.processedCount > 0
        ? this.duplicateCount / (this.duplicateCount + this.processedCount)
        : 0,
      lastDuplicateTime: this.lastDuplicateTime,
    };
  }

  reset(): void {
    this.duplicateCount = 0;
    this.processedCount = 0;
    this.lastDuplicateTime = undefined;
  }
}

/**
 * Global idempotency metrics
 */
export const wsIdempotencyMetrics = new IdempotencyMetrics();
