/**
 * AUTO-GENERATED TYPE CONTRACTS AND ZOD SCHEMAS
 *
 * Generated from WebSocket message documentation
 * Source: docs/WEBSOCKET_LAYER_MESSAGES.md, docs/POLYGON_LINESTRING_ARCHITECTURE.md
 *
 * DO NOT EDIT MANUALLY - Regenerate via scripts/generate_contracts.ts
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

export const BoundingBoxSchema = z.object({
  minLat: z.number().min(-90).max(90),
  maxLat: z.number().min(-90).max(90),
  minLng: z.number().min(-180).max(180),
  maxLng: z.number().min(-180).max(180),
}).strict();

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const PositionSchema = z.tuple([
  z.number(), // longitude
  z.number(), // latitude
  z.number().optional(), // altitude
]);

export type Position = z.infer<typeof PositionSchema>;

export const ColorSchema = z.tuple([
  z.number().int().min(0).max(255), // r
  z.number().int().min(0).max(255), // g
  z.number().int().min(0).max(255), // b
  z.number().int().min(0).max(255), // a
]);

export type Color = z.infer<typeof ColorSchema>;

// ============================================================================
// GeoJSON Geometry Types
// ============================================================================

export const PointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: PositionSchema,
}).strict();

export type PointGeometry = z.infer<typeof PointGeometrySchema>;

export const LineStringGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(PositionSchema).min(2),
}).strict();

export type LineStringGeometry = z.infer<typeof LineStringGeometrySchema>;

export const PolygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(PositionSchema).min(4)), // Each ring must close
}).strict();

export type PolygonGeometry = z.infer<typeof PolygonGeometrySchema>;

export const MultiPolygonGeometrySchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(z.array(PositionSchema).min(4))),
}).strict();

export type MultiPolygonGeometry = z.infer<typeof MultiPolygonGeometrySchema>;

export const MultiLineStringGeometrySchema = z.object({
  type: z.literal('MultiLineString'),
  coordinates: z.array(z.array(PositionSchema).min(2)),
}).strict();

export type MultiLineStringGeometry = z.infer<typeof MultiLineStringGeometrySchema>;

export const GeometrySchema = z.discriminatedUnion('type', [
  PointGeometrySchema,
  LineStringGeometrySchema,
  PolygonGeometrySchema,
  MultiPolygonGeometrySchema,
  MultiLineStringGeometrySchema,
]);

export type Geometry = z.infer<typeof GeometrySchema>;

// ============================================================================
// GeoJSON Feature Types
// ============================================================================

export const GeoJSONFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: GeometrySchema,
  properties: z.record(z.unknown()).optional(),
  id: z.union([z.string(), z.number()]).optional(),
}).strict();

export type GeoJSONFeature = z.infer<typeof GeoJSONFeatureSchema>;

export const FeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(GeoJSONFeatureSchema),
}).strict();

export type FeatureCollection = z.infer<typeof FeatureCollectionSchema>;

// ============================================================================
// Message Metadata
// ============================================================================

export const MessageMetaSchema = z.object({
  timestamp: z.number(),
  sequence: z.number().int().nonnegative().optional(),
  clientId: z.string().optional(),
  sessionId: z.string().optional(),
}).strict();

export type MessageMeta = z.infer<typeof MessageMetaSchema>;

// ============================================================================
// LAYER_DATA_UPDATE Message
// ============================================================================

export const LayerTypeSchema = z.enum([
  'point',
  'polygon',
  'line',
  'linestring',
  'heatmap',
  'cluster',
  'geojson',
]);

export type LayerType = z.infer<typeof LayerTypeSchema>;

export const LayerDataUpdatePayloadSchema = z.object({
  layer_id: z.string().min(1),
  layer_type: LayerTypeSchema,
  layer_data: FeatureCollectionSchema,
  bbox: BoundingBoxSchema.optional(),
  changed_at: z.number(),
}).strict();

export type LayerDataUpdatePayload = z.infer<typeof LayerDataUpdatePayloadSchema>;

// ============================================================================
// GPU_FILTER_SYNC Message
// ============================================================================

export const FilterTypeSchema = z.enum([
  'spatial',
  'temporal',
  'attribute',
  'composite',
]);

export type FilterType = z.infer<typeof FilterTypeSchema>;

export const FilterStatusSchema = z.enum([
  'applied',
  'pending',
  'error',
  'cleared',
]);

export type FilterStatus = z.infer<typeof FilterStatusSchema>;

export const TemporalFilterSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/), // ISO8601
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
}).strict();

export type TemporalFilter = z.infer<typeof TemporalFilterSchema>;

export const FilterParamsSchema = z.object({
  bounds: BoundingBoxSchema.optional(),
  temporal: TemporalFilterSchema.optional(),
  attributes: z.record(z.unknown()).optional(),
}).strict();

export type FilterParams = z.infer<typeof FilterParamsSchema>;

export const GPUFilterSyncPayloadSchema = z.object({
  filter_id: z.string().min(1),
  filter_type: FilterTypeSchema,
  filter_params: FilterParamsSchema,
  affected_layers: z.array(z.string()).min(0),
  status: FilterStatusSchema,
  changed_at: z.number(),
}).strict();

export type GPUFilterSyncPayload = z.infer<typeof GPUFilterSyncPayloadSchema>;

// ============================================================================
// POLYGON_UPDATE Message
// ============================================================================

export const PolygonActionSchema = z.enum([
  'create',
  'update',
  'delete',
  'boundary_change',
]);

export type PolygonAction = z.infer<typeof PolygonActionSchema>;

export const EntityTypeSchema = z.enum([
  'country',
  'region',
  'infrastructure',
  'zone',
  'border',
  'pipeline',
  'route',
  'unknown',
]);

export type EntityType = z.infer<typeof EntityTypeSchema>;

export const PolygonVisualPropertiesSchema = z.object({
  fillColor: ColorSchema.optional(),
  strokeColor: ColorSchema.optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  strokeWidth: z.number().min(0).max(20).optional(),
  elevation: z.number().min(0).optional(),
  extruded: z.boolean().optional(),
}).strict();

export type PolygonVisualProperties = z.infer<typeof PolygonVisualPropertiesSchema>;

export const PolygonPropertiesSchema = z.object({
  name: z.string(),
  entityType: EntityTypeSchema,
  confidence: z.number().min(0).max(1),
  hierarchyPath: z.string(),
  visualProperties: PolygonVisualPropertiesSchema.optional(),
}).strict();

export type PolygonProperties = z.infer<typeof PolygonPropertiesSchema>;

export const PolygonUpdatePayloadSchema = z.object({
  entityId: z.string().min(1),
  geometry: z.union([PolygonGeometrySchema, MultiPolygonGeometrySchema]),
  properties: PolygonPropertiesSchema,
  bbox: BoundingBoxSchema,
  changeReason: z.string().optional(),
  timestamp: z.string(), // ISO8601
}).strict();

export type PolygonUpdatePayload = z.infer<typeof PolygonUpdatePayloadSchema>;

// ============================================================================
// LINESTRING_UPDATE Message
// ============================================================================

export const LinestringActionSchema = z.enum([
  'create',
  'update',
  'delete',
  'route_change',
]);

export type LinestringAction = z.infer<typeof LinestringActionSchema>;

export const LinestringVisualPropertiesSchema = z.object({
  pathColor: ColorSchema.optional(),
  pathWidth: z.number().min(1).max(50).optional(),
  pathOpacity: z.number().min(0).max(1).optional(),
  dashArray: z.tuple([z.number(), z.number()]).optional(),
  showArrows: z.boolean().optional(),
  elevation: z.number().min(0).optional(),
}).strict();

export type LinestringVisualProperties = z.infer<typeof LinestringVisualPropertiesSchema>;

export const LinestringPropertiesSchema = z.object({
  name: z.string(),
  entityType: EntityTypeSchema,
  confidence: z.number().min(0).max(1),
  hierarchyPath: z.string(),
  visualProperties: LinestringVisualPropertiesSchema.optional(),
}).strict();

export type LinestringProperties = z.infer<typeof LinestringPropertiesSchema>;

export const LinestringUpdatePayloadSchema = z.object({
  entityId: z.string().min(1),
  geometry: z.union([LineStringGeometrySchema, MultiLineStringGeometrySchema]),
  properties: LinestringPropertiesSchema,
  bbox: BoundingBoxSchema.optional(),
  changeReason: z.string().optional(),
  timestamp: z.string(), // ISO8601
}).strict();

export type LinestringUpdatePayload = z.infer<typeof LinestringUpdatePayloadSchema>;

// ============================================================================
// GEOMETRY_BATCH_UPDATE Message
// ============================================================================

export const GeometryBatchItemSchema = z.object({
  entityId: z.string().min(1),
  geometry: GeometrySchema,
  properties: z.record(z.unknown()),
  action: z.enum(['create', 'update', 'delete']),
}).strict();

export type GeometryBatchItem = z.infer<typeof GeometryBatchItemSchema>;

export const GeometryBatchUpdatePayloadSchema = z.object({
  batch_id: z.string().min(1),
  items: z.array(GeometryBatchItemSchema).min(1),
  bbox: BoundingBoxSchema.optional(),
  timestamp: z.string(), // ISO8601
}).strict();

export type GeometryBatchUpdatePayload = z.infer<typeof GeometryBatchUpdatePayloadSchema>;

// ============================================================================
// RSS Feed Types (5-W Framework)
// ============================================================================

export const FiveWFieldsSchema = z.object({
  who: z.string().optional(), // Actor/entity involved
  what: z.string(), // Event description (required)
  when: z.string(), // ISO8601 timestamp
  where: z.object({
    name: z.string().optional(),
    coordinates: PositionSchema.optional(),
    bbox: BoundingBoxSchema.optional(),
  }).optional(),
  why: z.string().optional(), // Motivation/context
  confidence: z.number().min(0).max(1),
}).strict();

export type FiveWFields = z.infer<typeof FiveWFieldsSchema>;

export const RSSItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  link: z.string().url(),
  description: z.string().optional(),
  pubDate: z.string(), // ISO8601
  fiveW: FiveWFieldsSchema,
  extracted: z.object({
    entities: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    sentiment: z.number().min(-1).max(1).optional(),
  }).optional(),
}).strict();

export type RSSItem = z.infer<typeof RSSItemSchema>;

// ============================================================================
// Performance Metrics
// ============================================================================

export const PerformanceMetricsSchema = z.object({
  renderTime: z.number().nonnegative(),
  cacheHitRate: z.number().min(0).max(1),
  memoryUsageMB: z.number().nonnegative(),
  throughputRPS: z.number().nonnegative().optional(),
}).strict();

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

// ============================================================================
// Error Types
// ============================================================================

export const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string(),
}).strict();

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

// ============================================================================
// Helper Functions for Runtime Validation
// ============================================================================

/**
 * Safely parse and validate a value against a schema
 * Returns typed data on success, throws on failure
 */
export function parseContract<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMessage = `Contract validation failed${context ? ` in ${context}` : ''}: ${JSON.stringify(result.error.issues, null, 2)}`;
    throw new Error(errorMessage);
  }
  return result.data;
}

/**
 * Validate without throwing - returns success boolean
 */
export function validateContract<T>(
  schema: z.ZodType<T>,
  data: unknown
): { valid: true; data: T } | { valid: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error.issues };
}

/**
 * Strip excess properties to match schema exactly
 */
export function sanitizeContract<T>(
  schema: z.ZodType<T>,
  data: unknown
): T {
  return parseContract(schema, data);
}
