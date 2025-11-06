/**
 * Type definitions for the forecastin frontend
 * Following forecastin patterns for entity hierarchy and WebSocket integration
 */

import {
  EntityId as BrandedEntityId,
  EntityType,
  PathString,
  ConfidenceScore as BrandedConfidenceScore,
  Timestamp,
  toEntityId,
  toPathString,
  toConfidenceScore,
  toTimestamp,
} from './brand';

// Re-export branded types
export type { EntityId, EntityType, PathString, ConfidenceScore, Timestamp } from './brand';
export { toEntityId, toPathString, toConfidenceScore, toTimestamp } from './brand';

// Core entity types with branded IDs
export interface Entity<T extends EntityType = EntityType> {
  id: BrandedEntityId<T>;
  name: string;
  type: T;
  parentId?: BrandedEntityId<T>;
  path: PathString;
  pathDepth: number;
  confidence?: BrandedConfidenceScore;
  metadata?: Record<string, unknown>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  hasChildren?: boolean;
  childrenCount?: number;
}

// Additional type aliases for layer compatibility
export type EntityData = Entity;

export interface BreadcrumbItem<T extends EntityType = EntityType> {
  id: BrandedEntityId<T>;
  name: string;
  type: T;
  path: PathString;
  pathDepth: number;
  hasChildren?: boolean;
  childrenCount?: number;
}

export interface HierarchyNode<T extends EntityType = EntityType> {
  id: BrandedEntityId<T>;
  name: string;
  type: T;
  path: PathString;
  pathDepth: number;
  children: Entity<T>[];
  hasMore: boolean;
  totalChildren?: number;
  confidence?: BrandedConfidenceScore;
}

export interface HierarchyResponse<T extends EntityType = EntityType> {
  nodes: Entity<T>[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data?: unknown;
  error?: string;
  channels?: readonly string[];
  timestamp?: Timestamp;
}

export interface UseWebSocketOptions {
  url?: string;
  channels?: readonly string[];
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

// UI state types
export interface UIState<T extends EntityType = EntityType> {
  isMobile: boolean;
  selectedColumnIndex: number;
  columnPaths: readonly PathString[];
  breadcrumb: readonly BreadcrumbItem<T>[];
  selectedEntity: Entity<T> | null;
  setActiveEntity: (entity: Entity<T>) => void;
  navigateToEntity: (entity: Entity<T>, columnIndex: number) => void;
  navigateBack: () => void;
}

// Search types
export interface SearchResult<T extends EntityType = EntityType> {
  entities: readonly Entity<T>[];
  totalCount: number;
  query: string;
  filters?: Readonly<Record<string, unknown>>;
}

// Error boundary types
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

// Component prop types
export interface EntityItemProps<T extends EntityType = EntityType> {
  entity: Entity<T>;
  isSelected: boolean;
  onClick: (entity: Entity<T>) => void;
  onHover?: (entity: Entity<T> | null) => void;
  depth: number;
}

export interface ColumnProps<T extends EntityType = EntityType> {
  path: PathString;
  depth: number;
  selectedEntity: Entity<T> | null;
  onEntitySelect: (entity: Entity<T>) => void;
  onEntityHover: (entity: Entity<T> | null) => void;
}

export interface MobileColumnViewProps<T extends EntityType = EntityType> {
  currentPath: PathString;
  depth: number;
  selectedEntity: Entity<T> | null;
  onEntitySelect: (entity: Entity<T>) => void;
  onEntityHover: (entity: Entity<T> | null) => void;
  onNavigateBack: () => void;
}