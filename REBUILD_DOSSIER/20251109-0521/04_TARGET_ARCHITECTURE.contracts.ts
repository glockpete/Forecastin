/**
 * Canonical TypeScript Contract Definitions
 *
 * These are the definitive TypeScript types for Forecastin API contracts.
 * DO NOT modify without corresponding changes in Python contracts.
 *
 * Generation: Auto-generated from api/contracts/*.py via generate_contracts_v2.py
 * Evidence: Addresses F-0004, F-0001, F-0005 from 02_FINDINGS.md
 *
 * @experimental This file represents the target architecture.
 * @version 1.0
 */

// ============================================================================
// Base Types
// ============================================================================

/**
 * 2D coordinate: [longitude, latitude]
 */
export type Coordinate2D = [number, number];

/**
 * 3D coordinate: [longitude, latitude, altitude]
 */
export type Coordinate3D = [number, number, number];

/**
 * Coordinate can be 2D or 3D
 */
export type Coordinate = Coordinate2D | Coordinate3D;

/**
 * RGBA color: [red, green, blue, alpha]
 * Each component is 0-255
 */
export type Color = [number, number, number, number];

// ============================================================================
// GeoJSON Geometry Types (Full Type Fidelity)
// ============================================================================

/**
 * GeoJSON Point geometry
 *
 * @example
 * ```typescript
 * const point: PointGeometry = {
 *   type: 'Point',
 *   coordinates: [-122.4194, 37.7749] // San Francisco
 * };
 * ```
 */
export interface PointGeometry {
  type: 'Point'; // NOT 'any' - full discriminator support!
  coordinates: Coordinate;
}

/**
 * GeoJSON LineString geometry
 * Minimum 2 points required
 */
export interface LineStringGeometry {
  type: 'LineString';
  coordinates: Coordinate[]; // Array of at least 2 coordinates
}

/**
 * GeoJSON Polygon geometry
 *
 * coordinates[0] = exterior ring
 * coordinates[1..n] = holes (optional)
 *
 * Each ring must be closed (first point === last point)
 */
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Coordinate[][]; // Array of rings
}

/**
 * GeoJSON MultiPoint geometry
 */
export interface MultiPointGeometry {
  type: 'MultiPoint';
  coordinates: Coordinate[];
}

/**
 * GeoJSON MultiLineString geometry
 */
export interface MultiLineStringGeometry {
  type: 'MultiLineString';
  coordinates: Coordinate[][];
}

/**
 * GeoJSON MultiPolygon geometry
 */
export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Coordinate[][][];
}

/**
 * Union type for all geometry types
 * TypeScript will narrow based on 'type' discriminator
 */
export type Geometry =
  | PointGeometry
  | LineStringGeometry
  | PolygonGeometry
  | MultiPointGeometry
  | MultiLineStringGeometry
  | MultiPolygonGeometry;

// ============================================================================
// Type Guards (Addresses F-0001: properly exported utilities)
// ============================================================================

export function isPointGeometry(geom: Geometry): geom is PointGeometry {
  return geom.type === 'Point';
}

export function isLineStringGeometry(geom: Geometry): geom is LineStringGeometry {
  return geom.type === 'LineString';
}

export function isPolygonGeometry(geom: Geometry): geom is PolygonGeometry {
  return geom.type === 'Polygon';
}

export function isMultiPointGeometry(geom: Geometry): geom is MultiPointGeometry {
  return geom.type === 'MultiPoint';
}

export function isMultiLineStringGeometry(geom: Geometry): geom is MultiLineStringGeometry {
  return geom.type === 'MultiLineString';
}

export function isMultiPolygonGeometry(geom: Geometry): geom is MultiPolygonGeometry {
  return geom.type === 'MultiPolygon';
}

// ============================================================================
// Request Contracts
// ============================================================================

/**
 * Request for hierarchical entity query
 *
 * @example
 * ```typescript
 * const request: HierarchyQueryRequest = {
 *   parent_path: 'world.asia.japan',
 *   entity_types: ['city', 'prefecture'],
 *   max_depth: 2,
 *   offset: 0,
 *   limit: 100
 * };
 * ```
 */
export interface HierarchyQueryRequest {
  /** LTREE path of parent (null for root) */
  parent_path?: string | null;

  /** Filter by entity types */
  entity_types?: string[] | null;

  /** Maximum depth to traverse (1-10) */
  max_depth?: number | null;

  /** Spatial bounding box filter */
  bbox?: Geometry | null;

  /** Pagination offset */
  offset: number;

  /** Pagination limit (1-1000) */
  limit: number;
}

/**
 * Request to create a new entity
 */
export interface EntityCreateRequest {
  /** Entity name (1-255 characters) */
  name: string;

  /** Entity type */
  entity_type: string;

  /** Optional description */
  description?: string | null;

  /** Parent entity UUID */
  parent_id?: string | null;

  /** Geospatial location */
  location?: Geometry | null;

  /** Flexible metadata */
  metadata?: Record<string, unknown>;

  /** Confidence score (0.0-1.0) */
  confidence_score?: number;
}

// ============================================================================
// Response Contracts (Addresses F-0005: complete schemas)
// ============================================================================

/**
 * Standard paginated response wrapper
 * Generic type for any paginated list
 */
export interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];

  /** Total count of items (across all pages) */
  total: number;

  /** Current offset */
  offset: number;

  /** Current limit */
  limit: number;

  /** True if more items available */
  has_more: boolean;
}

/**
 * Single entity response
 *
 * ADDRESSES F-0005: Includes `children_count` property
 */
export interface EntityResponse {
  /** Entity UUID */
  id: string;

  /** Entity name */
  name: string;

  /** Entity type */
  entity_type: string;

  /** Description */
  description?: string | null;

  /** LTREE path as string */
  path: string;

  /** Pre-computed path depth */
  path_depth: number;

  /** GeoJSON location */
  location?: Record<string, unknown> | null;

  /** Confidence score (0.0-1.0) */
  confidence_score: number;

  /** Number of direct children (ADDED) */
  children_count: number;

  /** Creation timestamp */
  created_at: string; // ISO 8601

  /** Last update timestamp */
  updated_at: string; // ISO 8601
}

/**
 * Hierarchical entity query response
 *
 * ADDRESSES F-0005: Includes `entities` array
 */
export interface HierarchyResponse {
  /** Array of entities (ADDED to fix compilation errors) */
  entities: EntityResponse[];

  /** Total count */
  total: number;

  /** True if more results available */
  has_more: boolean;

  // Pagination metadata
  offset: number;
  limit: number;

  // Query metadata
  /** Parent path queried */
  parent_path?: string | null;

  /** True if max depth was reached */
  max_depth_reached: boolean;
}

// ============================================================================
// WebSocket Event Contracts (Versioned)
// ============================================================================

/**
 * Base event envelope with versioning
 */
export interface BaseEvent {
  /** Event schema version */
  version: '1.0';

  /** Unique event ID for idempotency */
  event_id: string;

  /** Event timestamp */
  timestamp: string; // ISO 8601

  /** Correlation ID for request tracing */
  correlation_id?: string | null;
}

/**
 * Layer update event
 *
 * ADDRESSES F-0003: Includes required `layer_id` property
 */
export interface LayerUpdateEvent extends BaseEvent {
  type: 'layer_update';

  /** Layer identifier (REQUIRED) */
  layer_id: string;

  /** Update action */
  action: 'add' | 'update' | 'remove';

  /** GeoJSON features */
  features: Record<string, unknown>[];

  /** Number of features affected */
  affected_count: number;
}

/**
 * Feature flag update event
 */
export interface FeatureFlagUpdateEvent extends BaseEvent {
  type: 'feature_flag_update';

  /** Flag key (e.g., 'ff.map_v1') */
  flag_key: string;

  /** Flag enabled status */
  enabled: boolean;

  /** Rollout percentage (0-100) */
  rollout_percentage: number;
}

/**
 * Hierarchy cache invalidation event
 */
export interface HierarchyInvalidationEvent extends BaseEvent {
  type: 'hierarchy_invalidation';

  /** LTREE paths affected */
  affected_paths: string[];

  /** Reason for invalidation */
  reason: string;
}

/**
 * Union type for all WebSocket events
 * Discriminated by 'type' field
 */
export type WebSocketEvent =
  | LayerUpdateEvent
  | FeatureFlagUpdateEvent
  | HierarchyInvalidationEvent;

// ============================================================================
// Event Type Guards
// ============================================================================

export function isLayerUpdateEvent(event: WebSocketEvent): event is LayerUpdateEvent {
  return event.type === 'layer_update';
}

export function isFeatureFlagUpdateEvent(event: WebSocketEvent): event is FeatureFlagUpdateEvent {
  return event.type === 'feature_flag_update';
}

export function isHierarchyInvalidationEvent(event: WebSocketEvent): event is HierarchyInvalidationEvent {
  return event.type === 'hierarchy_invalidation';
}

// ============================================================================
// Utility Functions (Addresses F-0001: properly exported)
// ============================================================================

/**
 * Get confidence score from entity
 * Handles multiple possible property names
 */
export function getConfidence(entity: EntityResponse): number {
  return entity.confidence_score ?? 0;
}

/**
 * Get children count from entity
 * Handles multiple possible property names
 */
export function getChildrenCount(entity: EntityResponse): number {
  return entity.children_count ?? 0;
}

/**
 * Calculate centroid of a geometry
 */
export function getGeometryCentroid(geom: Geometry): Coordinate2D {
  if (isPointGeometry(geom)) {
    const [lon, lat] = geom.coordinates;
    return [lon, lat];
  }

  if (isLineStringGeometry(geom)) {
    // Midpoint of first and last coordinate
    const first = geom.coordinates[0];
    const last = geom.coordinates[geom.coordinates.length - 1];
    return [
      (first[0] + last[0]) / 2,
      (first[1] + last[1]) / 2,
    ];
  }

  if (isPolygonGeometry(geom)) {
    // Centroid of exterior ring
    const ring = geom.coordinates[0];
    const sum = ring.reduce(
      (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
      [0, 0] as [number, number]
    );
    return [sum[0] / ring.length, sum[1] / ring.length];
  }

  // Multi-geometry types: calculate centroid of all parts
  if (isMultiPointGeometry(geom)) {
    const sum = geom.coordinates.reduce(
      (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
      [0, 0] as [number, number]
    );
    return [sum[0] / geom.coordinates.length, sum[1] / geom.coordinates.length];
  }

  if (isMultiLineStringGeometry(geom)) {
    // Use first linestring's midpoint
    if (geom.coordinates.length > 0) {
      const firstLine = geom.coordinates[0];
      const first = firstLine[0];
      const last = firstLine[firstLine.length - 1];
      return [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
    }
  }

  if (isMultiPolygonGeometry(geom)) {
    // Use first polygon's centroid
    if (geom.coordinates.length > 0) {
      const firstPolygon = geom.coordinates[0];
      const ring = firstPolygon[0];
      const sum = ring.reduce(
        (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
        [0, 0] as [number, number]
      );
      return [sum[0] / ring.length, sum[1] / ring.length];
    }
  }

  // Default: origin
  return [0, 0];
}

/**
 * Validate that a geometry is well-formed
 * @throws Error if geometry is invalid
 */
export function validateGeometry(geom: Geometry): void {
  if (isLineStringGeometry(geom)) {
    if (geom.coordinates.length < 2) {
      throw new Error('LineString must have at least 2 points');
    }
  }

  if (isPolygonGeometry(geom)) {
    for (let i = 0; i < geom.coordinates.length; i++) {
      const ring = geom.coordinates[i];
      if (ring.length < 4) {
        throw new Error(`Polygon ring ${i} must have at least 4 points (closed ring)`);
      }

      // Check if ring is closed
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error(`Polygon ring ${i} must be closed (first point === last point)`);
      }
    }
  }

  // Add more validation as needed
}

// ============================================================================
// Constants
// ============================================================================

/**
 * API version
 */
export const API_VERSION = '1.0' as const;

/**
 * Maximum pagination limit
 */
export const MAX_LIMIT = 1000 as const;

/**
 * Default pagination limit
 */
export const DEFAULT_LIMIT = 100 as const;

/**
 * Maximum hierarchy depth
 */
export const MAX_HIERARCHY_DEPTH = 10 as const;
