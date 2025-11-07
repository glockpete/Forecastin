/**
 * GENERATED: Do not edit by hand
 *
 * Branded Types for Type-Safe Entity IDs
 *
 * This module provides branded types to ensure compile-time type safety
 * for entity identifiers, preventing accidental mixing of different ID types.
 *
 * Example:
 *   const actorId: EntityId<'actor'> = 'abc123' as EntityId<'actor'>;
 *   const orgId: EntityId<'org'> = 'xyz789' as EntityId<'org'>;
 *   // Type error: Cannot assign EntityId<'org'> to EntityId<'actor'>
 */

/**
 * Brand<T, K> creates a nominal type from a base type T with a unique brand K.
 * This enables type-safe distinctions between structurally identical types.
 */
export type Brand<T, K extends string> = T & { readonly __brand: K };

/**
 * Entity type discriminators for the forecastin domain model
 */
export type EntityType =
  | 'actor'
  | 'org'
  | 'initiative'
  | 'outcome'
  | 'horizon'
  | 'evidence'
  | 'stakeholder'
  | 'opportunity'
  | 'action'
  | 'lens'
  | 'layer'
  | 'filter';

/**
 * Branded entity ID type that prevents mixing IDs of different entity types
 */
export type EntityId<T extends EntityType> = Brand<string, `EntityId<${T}>`>;

/**
 * Specific entity ID types for common entities
 */
export type ActorId = EntityId<'actor'>;
export type OrgId = EntityId<'org'>;
export type InitiativeId = EntityId<'initiative'>;
export type OutcomeId = EntityId<'outcome'>;
export type HorizonId = EntityId<'horizon'>;
export type EvidenceId = EntityId<'evidence'>;
export type StakeholderId = EntityId<'stakeholder'>;
export type OpportunityId = EntityId<'opportunity'>;
export type ActionId = EntityId<'action'>;
export type LensId = EntityId<'lens'>;
export type LayerId = EntityId<'layer'>;
export type FilterId = EntityId<'filter'>;

/**
 * Type guard to check if a string is a valid entity ID
 */
export function isEntityId<T extends EntityType>(
  value: unknown,
  _type: T
): value is EntityId<T> {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type-safe constructor for entity IDs
 * Use this to create branded IDs from raw strings
 */
export function toEntityId<T extends EntityType>(
  value: string,
  _type: T
): EntityId<T> {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid entity ID: ${value}`);
  }
  return value as EntityId<T>;
}

/**
 * Extract the raw string value from a branded entity ID
 */
export function fromEntityId<T extends EntityType>(
  id: EntityId<T>
): string {
  return id as string;
}

/**
 * Branded types for other domain primitives
 */
export type PathString = Brand<string, 'PathString'>;
export type ConfidenceScore = Brand<number, 'ConfidenceScore'>;
export type Timestamp = Brand<string, 'Timestamp'>;
export type ClientId = Brand<string, 'ClientId'>;
export type QueryKey = Brand<readonly unknown[], 'QueryKey'>;

/**
 * Constructors for other branded types
 */
export function toPathString(value: string): PathString {
  if (!value.startsWith('/')) {
    throw new Error(`Path must start with /: ${value}`);
  }
  return value as PathString;
}

export function toConfidenceScore(value: number): ConfidenceScore {
  if (value < 0 || value > 1) {
    throw new Error(`Confidence score must be between 0 and 1: ${value}`);
  }
  return value as ConfidenceScore;
}

export function toTimestamp(value: string | Date): Timestamp {
  const isoString = value instanceof Date ? value.toISOString() : value;
  // Basic ISO 8601 validation
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(isoString)) {
    throw new Error(`Invalid timestamp format: ${isoString}`);
  }
  return isoString as Timestamp;
}

export function toClientId(value: string): ClientId {
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid client ID: ${value}`);
  }
  return value as ClientId;
}

/**
 * Type-safe result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Helper to create success result
 */
export function Ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Helper to create error result
 */
export function Err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Type guard for success result
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

/**
 * Type guard for error result
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Extract value from result or throw error
 */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Extract value from result or return default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isOk(result) ? result.value : defaultValue;
}

/**
 * Map over a successful result
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return isOk(result) ? Ok(fn(result.value)) : result;
}

/**
 * Chain results together (flatMap)
 */
export function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return isOk(result) ? fn(result.value) : result;
}
