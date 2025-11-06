/**
 * Type definitions for the forecastin frontend
 * Following forecastin patterns for entity hierarchy and WebSocket integration
 */

// Core entity types
export interface Entity {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  path: string;
  pathDepth: number;
  confidence?: number;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  hasChildren?: boolean;
  childrenCount?: number;
}

// Additional type aliases for layer compatibility
export type EntityData = Entity;
export type EntityId = string;
export type ConfidenceScore = number;

export interface BreadcrumbItem {
  id: string;
  name: string;
  type: string;
  path: string;
  pathDepth: number;
  hasChildren?: boolean;
  childrenCount?: number;
}

export interface HierarchyNode {
  id: string;
  name: string;
  type: string;
  path: string;
  pathDepth: number;
  children: Entity[];
  hasMore: boolean;
  totalChildren?: number;
  confidence?: number;
}

export interface HierarchyResponse {
  nodes: Entity[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
  channels?: string[];
  timestamp?: string;
}

export interface UseWebSocketOptions {
  url?: string;
  channels?: string[];
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

// UI state types
export interface UIState {
  isMobile: boolean;
  selectedColumnIndex: number;
  columnPaths: string[];
  breadcrumb: BreadcrumbItem[];
  selectedEntity: Entity | null;
  setActiveEntity: (entity: Entity) => void;
  navigateToEntity: (entity: Entity, columnIndex: number) => void;
  navigateBack: () => void;
}

// Search types
export interface SearchResult {
  entities: Entity[];
  totalCount: number;
  query: string;
  filters?: Record<string, any>;
}

// Error boundary types
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

// Component prop types
export interface EntityItemProps {
  entity: Entity;
  isSelected: boolean;
  onClick: (entity: Entity) => void;
  onHover?: (entity: Entity | null) => void;
  depth: number;
}

export interface ColumnProps {
  path: string;
  depth: number;
  selectedEntity: Entity | null;
  onEntitySelect: (entity: Entity) => void;
  onEntityHover: (entity: Entity | null) => void;
}

export interface MobileColumnViewProps {
  currentPath: string;
  depth: number;
  selectedEntity: Entity | null;
  onEntitySelect: (entity: Entity) => void;
  onEntityHover: (entity: Entity | null) => void;
  onNavigateBack: () => void;
}