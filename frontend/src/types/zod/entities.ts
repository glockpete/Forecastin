/**
 * GENERATED: Do not edit by hand
 *
 * Zod Runtime Validation Schemas for Entities
 *
 * These schemas mirror the TypeScript type definitions in types/index.ts
 * and provide runtime validation for data from untrusted sources (API, WebSocket).
 *
 * Keep in sync with:
 * - frontend/src/types/index.ts (TypeScript types)
 * - frontend/src/types/brand.ts (Branded types)
 */

import { z } from 'zod';

/**
 * Entity type discriminator
 */
export const EntityTypeSchema = z.enum([
  'actor',
  'org',
  'initiative',
  'outcome',
  'horizon',
  'evidence',
  'stakeholder',
  'opportunity',
  'action',
  'lens',
  'layer',
  'filter',
]);

export type EntityTypeFromSchema = z.infer<typeof EntityTypeSchema>;

/**
 * Branded ID validation (validates as string, consumer must apply brand)
 */
export const EntityIdSchema = z.string().min(1, 'Entity ID cannot be empty');

/**
 * Path string validation (must start with /)
 */
export const PathStringSchema = z
  .string()
  .min(1)
  .refine((path) => path.startsWith('/'), {
    message: 'Path must start with /',
  });

/**
 * Confidence score validation (0-1 inclusive)
 */
export const ConfidenceScoreSchema = z
  .number()
  .min(0, 'Confidence score must be >= 0')
  .max(1, 'Confidence score must be <= 1');

/**
 * ISO 8601 timestamp validation
 */
export const TimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    'Timestamp must be ISO 8601 format'
  );

/**
 * Core Entity schema (generic, no type-specific validation)
 */
export const EntitySchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1, 'Entity name cannot be empty'),
  type: EntityTypeSchema,
  parentId: EntityIdSchema.optional(),
  path: PathStringSchema,
  pathDepth: z.number().int().nonnegative(),
  confidence: ConfidenceScoreSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional(),
  hasChildren: z.boolean().optional(),
  childrenCount: z.number().int().nonnegative().optional(),
});

export type EntityFromSchema = z.infer<typeof EntitySchema>;

/**
 * Type-specific entity schemas (enforce type field matches)
 */
export const ActorEntitySchema = EntitySchema.extend({
  type: z.literal('actor'),
});

export const OrgEntitySchema = EntitySchema.extend({
  type: z.literal('org'),
});

export const InitiativeEntitySchema = EntitySchema.extend({
  type: z.literal('initiative'),
});

export const OutcomeEntitySchema = EntitySchema.extend({
  type: z.literal('outcome'),
});

export const HorizonEntitySchema = EntitySchema.extend({
  type: z.literal('horizon'),
});

export const EvidenceEntitySchema = EntitySchema.extend({
  type: z.literal('evidence'),
});

export const StakeholderEntitySchema = EntitySchema.extend({
  type: z.literal('stakeholder'),
});

export const OpportunityEntitySchema = EntitySchema.extend({
  type: z.literal('opportunity'),
});

export const ActionEntitySchema = EntitySchema.extend({
  type: z.literal('action'),
});

export const LensEntitySchema = EntitySchema.extend({
  type: z.literal('lens'),
});

export const LayerEntitySchema = EntitySchema.extend({
  type: z.literal('layer'),
});

export const FilterEntitySchema = EntitySchema.extend({
  type: z.literal('filter'),
});

/**
 * Union of all entity schemas (discriminated by type field)
 */
export const AnyEntitySchema = z.discriminatedUnion('type', [
  ActorEntitySchema,
  OrgEntitySchema,
  InitiativeEntitySchema,
  OutcomeEntitySchema,
  HorizonEntitySchema,
  EvidenceEntitySchema,
  StakeholderEntitySchema,
  OpportunityEntitySchema,
  ActionEntitySchema,
  LensEntitySchema,
  LayerEntitySchema,
  FilterEntitySchema,
]);

/**
 * BreadcrumbItem schema
 */
export const BreadcrumbItemSchema = z.object({
  id: EntityIdSchema,
  name: z.string(),
  type: EntityTypeSchema,
  path: PathStringSchema,
  pathDepth: z.number().int().nonnegative(),
  hasChildren: z.boolean().optional(),
  childrenCount: z.number().int().nonnegative().optional(),
});

export type BreadcrumbItemFromSchema = z.infer<typeof BreadcrumbItemSchema>;

/**
 * HierarchyNode schema
 */
export const HierarchyNodeSchema = z.object({
  id: EntityIdSchema,
  name: z.string(),
  type: EntityTypeSchema,
  path: PathStringSchema,
  pathDepth: z.number().int().nonnegative(),
  children: z.array(EntitySchema),
  hasMore: z.boolean(),
  totalChildren: z.number().int().nonnegative().optional(),
  confidence: ConfidenceScoreSchema.optional(),
});

export type HierarchyNodeFromSchema = z.infer<typeof HierarchyNodeSchema>;

/**
 * HierarchyResponse schema
 */
export const HierarchyResponseSchema = z.object({
  nodes: z.array(EntitySchema),
  totalCount: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});

export type HierarchyResponseFromSchema = z.infer<typeof HierarchyResponseSchema>;

/**
 * SearchResult schema
 */
export const SearchResultSchema = z.object({
  entities: z.array(EntitySchema),
  totalCount: z.number().int().nonnegative(),
  query: z.string(),
  filters: z.record(z.unknown()).optional(),
});

export type SearchResultFromSchema = z.infer<typeof SearchResultSchema>;

/**
 * Helper: Get entity schema by type
 */
export function getEntitySchemaByType(type: EntityTypeFromSchema): z.ZodSchema {
  const schemaMap = {
    actor: ActorEntitySchema,
    org: OrgEntitySchema,
    initiative: InitiativeEntitySchema,
    outcome: OutcomeEntitySchema,
    horizon: HorizonEntitySchema,
    evidence: EvidenceEntitySchema,
    stakeholder: StakeholderEntitySchema,
    opportunity: OpportunityEntitySchema,
    action: ActionEntitySchema,
    lens: LensEntitySchema,
    layer: LayerEntitySchema,
    filter: FilterEntitySchema,
  };
  return schemaMap[type];
}
