/**
 * Runtime Validation Utilities
 *
 * Provides parseOrReport<T> for safe parsing with Result<T, E> pattern.
 * Integrates Zod schemas with branded types and error reporting.
 */

import { z } from 'zod';
import type { Result} from '../types/brand';
import { Ok, Err } from '../types/brand';

/**
 * Parse error with detailed context
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly zodError?: z.ZodError,
    public readonly input?: unknown,
    public readonly schemaName?: string
  ) {
    super(message);
    this.name = 'ParseError';

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ParseError);
    }
  }

  /**
   * Format error for developer debugging
   */
  toDebugString(): string {
    const parts: string[] = [
      `ParseError: ${this.message}`,
    ];

    if (this.schemaName) {
      parts.push(`Schema: ${this.schemaName}`);
    }

    if (this.zodError) {
      parts.push('Zod Errors:');
      this.zodError.errors.forEach((err, idx) => {
        parts.push(`  ${idx + 1}. ${err.path.join('.')}: ${err.message}`);
      });
    }

    if (this.input !== undefined) {
      parts.push(`Input: ${JSON.stringify(this.input, null, 2)}`);
    }

    return parts.join('\n');
  }

  /**
   * Format error for user display (no sensitive data)
   */
  toUserString(): string {
    return `Data validation failed: ${this.message}`;
  }

  /**
   * Get structured error data for logging
   */
  toStructured(): {
    type: 'ParseError';
    message: string;
    schemaName?: string;
    zodErrors?: Array<{ path: string; message: string }>;
  } {
    return {
      type: 'ParseError',
      message: this.message,
      schemaName: this.schemaName,
      zodErrors: this.zodError?.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    };
  }
}

/**
 * Parse data with Zod schema and return Result<T, ParseError>
 *
 * Usage:
 *   const result = parseOrReport(EntitySchema, rawData, 'Entity');
 *   if (isOk(result)) {
 *     const entity = result.value;
 *   } else {
 *     console.error(result.error.toDebugString());
 *   }
 */
export function parseOrReport<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  schemaName?: string
): Result<T, ParseError> {
  try {
    const parsed = schema.parse(data);
    return Ok(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const parseError = new ParseError(
        `Validation failed${schemaName ? ` for ${schemaName}` : ''}`,
        error,
        data,
        schemaName
      );
      return Err(parseError);
    }

    // Unexpected error during parsing
    const parseError = new ParseError(
      error instanceof Error ? error.message : 'Unknown parsing error',
      undefined,
      data,
      schemaName
    );
    return Err(parseError);
  }
}

/**
 * Safe parse (returns undefined on error, no Result wrapper)
 * Use when you don't need detailed error info
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | undefined {
  const result = schema.safeParse(data);
  return result.success ? result.data : undefined;
}

/**
 * Parse with default fallback
 */
export function parseOrDefault<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  defaultValue: T
): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : defaultValue;
}

/**
 * Partial validation - returns successfully parsed fields even if some fail
 * Useful for progressive enhancement
 */
export function parsePartial<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  data: unknown
): Partial<z.infer<z.ZodObject<T>>> {
  if (typeof data !== 'object' || data === null) {
    return {};
  }

  const partial: Record<string, unknown> = {};
  const dataObj = data as Record<string, unknown>;

  for (const key in schema.shape) {
    const fieldSchema = schema.shape[key];
    const fieldValue = dataObj[key];

    const result = fieldSchema.safeParse(fieldValue);
    if (result.success) {
      partial[key] = result.data;
    }
  }

  return partial as Partial<z.infer<z.ZodObject<T>>>;
}

/**
 * Validation middleware for async operations
 */
export async function validateAsync<T>(
  schema: z.ZodSchema<T>,
  dataPromise: Promise<unknown>,
  schemaName?: string
): Promise<Result<T, ParseError>> {
  try {
    const data = await dataPromise;
    return parseOrReport(schema, data, schemaName);
  } catch (error) {
    const parseError = new ParseError(
      `Async validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      undefined,
      schemaName
    );
    return Err(parseError);
  }
}

/**
 * Batch validation - validate multiple items, collect all errors
 */
export function validateBatch<T>(
  schema: z.ZodSchema<T>,
  items: unknown[],
  schemaName?: string
): {
  succeeded: T[];
  failed: Array<{ index: number; error: ParseError; input: unknown }>;
} {
  const succeeded: T[] = [];
  const failed: Array<{ index: number; error: ParseError; input: unknown }> = [];

  items.forEach((item, index) => {
    const result = parseOrReport(schema, item, schemaName);
    if (result.success) {
      succeeded.push(result.value);
    } else {
      failed.push({ index, error: result.error, input: item });
    }
  });

  return { succeeded, failed };
}

/**
 * Type guard with runtime validation
 */
export function isValid<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): data is T {
  return schema.safeParse(data).success;
}

/**
 * Assert type with validation (throws on failure)
 */
export function assertValid<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  schemaName?: string
): asserts data is T {
  const result = parseOrReport(schema, data, schemaName);
  if (!result.success) {
    throw result.error;
  }
}

/**
 * Create a validator function for reuse
 */
export function createValidator<T>(
  schema: z.ZodSchema<T>,
  schemaName?: string
) {
  return (data: unknown): Result<T, ParseError> => {
    return parseOrReport(schema, data, schemaName);
  };
}

/**
 * Validation metrics for monitoring
 */
export class ValidationMetrics {
  private metrics = new Map<string, {
    total: number;
    succeeded: number;
    failed: number;
    lastError?: ParseError;
  }>();

  record(schemaName: string, result: Result<unknown, ParseError>): void {
    const current = this.metrics.get(schemaName) || {
      total: 0,
      succeeded: 0,
      failed: 0,
    };

    current.total++;
    if (result.success) {
      current.succeeded++;
    } else {
      current.failed++;
      current.lastError = result.error;
    }

    this.metrics.set(schemaName, current);
  }

  getStats(schemaName: string) {
    return this.metrics.get(schemaName);
  }

  getAllStats() {
    return Array.from(this.metrics.entries()).map(([name, stats]) => ({
      schemaName: name,
      ...stats,
      successRate: stats.total > 0 ? stats.succeeded / stats.total : 0,
    }));
  }

  reset(schemaName?: string): void {
    if (schemaName) {
      this.metrics.delete(schemaName);
    } else {
      this.metrics.clear();
    }
  }
}

/**
 * Global validation metrics instance
 */
export const globalValidationMetrics = new ValidationMetrics();

/**
 * Instrumented parseOrReport that records metrics
 */
export function parseWithMetrics<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  schemaName: string
): Result<T, ParseError> {
  const result = parseOrReport(schema, data, schemaName);
  globalValidationMetrics.record(schemaName, result);
  return result;
}

// ============================================================================
// DOMAIN-SPECIFIC VALIDATORS (QW007, QW008)
// ============================================================================

// Domain-specific validators and branded types
export type LTreePath = string & { readonly __brand: 'LTreePath' };
export type UUIDString = string & { readonly __brand: 'UUIDString' };
export type ISODateTimeString = string & { readonly __brand: 'ISODateTimeString' };

/**
 * Validate LTREE path format
 */
export function isValidLTreePath(path: string): boolean {
  // Basic ltree validation - labels separated by dots, no leading/trailing dots
  return /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)*$/.test(path);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Validate ISO 8601 date-time format
 */
export function isValidISODateTime(dateTime: string): boolean {
  const date = new Date(dateTime);
  return !isNaN(date.getTime()) && dateTime === date.toISOString();
}

/**
 * Parse entity date
 */
export function parseEntityDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Validate LTREE path and return Result
 *
 * @example
 * const result = validateLTreePath('root.child.grandchild');
 * if (isOk(result)) {
 *   const path: LTreePath = result.value;
 * }
 */
export function validateLTreePath(path: string): Result<LTreePath, ParseError> {
  if (isValidLTreePath(path)) {
    return Ok(path as LTreePath);
  }
  return Err(new ParseError(
    'Invalid LTREE path format. Expected: "root.child.grandchild" (alphanumeric + underscores, no leading/trailing/double dots)',
    undefined,
    path,
    'LTreePath'
  ));
}

/**
 * Validate UUID and return Result
 */
export function validateUUID(uuid: string): Result<UUIDString, ParseError> {
  if (isValidUUID(uuid)) {
    return Ok(uuid as UUIDString);
  }
  return Err(new ParseError(
    'Invalid UUID format. Expected: 8-4-4-4-12 hex format (e.g., 550e8400-e29b-41d4-a716-446655440000)',
    undefined,
    uuid,
    'UUID'
  ));
}

/**
 * Validate ISO 8601 datetime string and return Result
 */
export function validateISODateTime(dateStr: string): Result<ISODateTimeString, ParseError> {
  if (isValidISODateTime(dateStr)) {
    return Ok(dateStr as ISODateTimeString);
  }
  return Err(new ParseError(
    'Invalid ISO 8601 datetime format. Expected: YYYY-MM-DDTHH:mm:ss.sssZ',
    undefined,
    dateStr,
    'ISODateTime'
  ));
}

/**
 * Parse entity date safely with Result pattern
 */
export function validateEntityDate(dateStr?: string | null): Result<Date, ParseError> {
  const date = parseEntityDate(dateStr);
  if (date) {
    return Ok(date);
  }
  return Err(new ParseError(
    'Invalid date string or null/undefined value',
    undefined,
    dateStr,
    'EntityDate'
  ));
}

/**
 * Client-side form validation helper
 * Use before submitting forms to backend
 *
 * @example
 * const errors = validateFormData({
 *   path: formData.path,
 *   parentId: formData.parentId,
 *   createdAt: formData.createdAt
 * });
 *
 * if (errors.length > 0) {
 *   setFormErrors(errors);
 *   return;
 * }
 */
export interface FormValidationError {
  field: string;
  message: string;
}

export function validateFormData(data: {
  path?: string;
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
}): FormValidationError[] {
  const errors: FormValidationError[] = [];

  if (data.path) {
    const result = validateLTreePath(data.path);
    if (!result.success) {
      errors.push({ field: 'path', message: result.error.toUserString() });
    }
  }

  if (data.parentId) {
    const result = validateUUID(data.parentId);
    if (!result.success) {
      errors.push({ field: 'parentId', message: result.error.toUserString() });
    }
  }

  if (data.createdAt) {
    const result = validateISODateTime(data.createdAt);
    if (!result.success) {
      errors.push({ field: 'createdAt', message: result.error.toUserString() });
    }
  }

  if (data.updatedAt) {
    const result = validateISODateTime(data.updatedAt);
    if (!result.success) {
      errors.push({ field: 'updatedAt', message: result.error.toUserString() });
    }
  }

  return errors;
}
