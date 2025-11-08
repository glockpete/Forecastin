/**
 * Miller's Columns Component
 * Hierarchical navigation with lazy loading and real-time updates
 * Implements responsive design with mobile single-column view
 * Part of hybrid state coordination: React Query + Zustand + WebSocket
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ChevronLeft,
  Folder,
  FolderOpen,
  FileText,
  Users,
  Building,
  MapPin,
  Loader2,
  AlertCircle,
  Search
} from 'lucide-react';

import { useUIStore } from '../../store/uiStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useHybridState } from '../../hooks/useHybridState';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import {
  useRootHierarchy,
  useChildren,
  useBreadcrumbs,
  hierarchyKeys
} from '../../hooks/useHierarchy';
import type { Entity } from '../../types';
import { cn } from '../../utils/cn';
import { RealtimePerformanceMonitor } from '../../utils/stateManager';
import SearchInterface from '../Search/SearchInterface';
import EntityDetail from '../Entity/EntityDetail';
import GeospatialView from '../Map/GeospatialView';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import { ErrorBoundary } from '../UI/ErrorBoundary';
import { getConfidence, getChildrenCount } from '../../types/contracts.generated';

// Entity type icons mapping
const getEntityIcon = (type: string) => {
  const iconMap = {
    folder: Folder,
    folderOpen: FolderOpen,
    document: FileText,
    person: Users,
    organization: Building,
    location: MapPin,
    default: FileText,
  };
  
  const IconComponent = iconMap[type as keyof typeof iconMap] || iconMap.default;
  return IconComponent;
};

// Individual entity item component
interface EntityItemProps {
  entity: Entity;
  isSelected: boolean;
  onClick: (entity: Entity) => void;
  onHover?: (entity: Entity | null) => void;
  depth: number;
}

const EntityItem: React.FC<EntityItemProps> = ({
  entity,
  isSelected,
  onClick,
  onHover,
  depth
}) => {
  const Icon = getEntityIcon(entity.type);
  const confidence = getConfidence(entity);
  
  return (
    <div
      className={cn(
        'flex items-center px-3 py-2 cursor-pointer transition-colors duration-200',
        'hover:bg-blue-50 dark:hover:bg-blue-900/20',
        isSelected
          ? 'bg-blue-100 dark:bg-blue-900/40 border-r-2 border-blue-500'
          : 'border-r-2 border-transparent',
        depth > 0 && 'ml-4'
      )}
      role="button"
      tabIndex={0}
      onClick={() => onClick(entity)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(entity);
        }
      }}
      onMouseEnter={() => onHover && onHover(entity)}
      onMouseLeave={() => onHover && onHover(null)}
    >
      <Icon 
        className={cn(
          'w-4 h-4 mr-3 flex-shrink-0',
          isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
        )} 
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {entity.name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-2">
          <span className="capitalize">{entity.type}</span>
          {confidence > 0 && (
            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
              {(confidence * 100).toFixed(0)}%
            </span>
          )}
          {entity.hasChildren && (
            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
              {getChildrenCount(entity)} children
            </span>
          )}
        </div>
      </div>
      {entity.hasChildren && (
        <ChevronRight className="w-4 h-4 text-gray-400" />
      )}
    </div>
  );
};

// Root column component for depth 0
interface RootColumnProps {
  selectedEntity: Entity | null;
  onEntitySelect: (entity: Entity) => void;
  onEntityHover: (entity: Entity | null) => void;
}

const RootColumn: React.FC<RootColumnProps> = ({
  selectedEntity,
  onEntitySelect,
  onEntityHover
}) => {
  const { data: rootData, isLoading: rootLoading, error: rootError } = useRootHierarchy();
  
  if (rootLoading) {
    return (
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading hierarchy...</span>
        </div>
      </div>
    );
  }
  
  if (rootError) {
    return (
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-center h-32 text-red-600">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span className="text-sm">Error loading hierarchy</span>
        </div>
      </div>
    );
  }
  
  const entities = rootData?.entities || rootData?.nodes || [];
  
  return (
    <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Root Hierarchy
        </h3>
      </div>
      <div className="overflow-y-auto max-h-96">
        {entities.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No entities found
          </div>
        ) : (
          entities.map((entity) => (
            <EntityItem
              key={entity.id}
              entity={entity}
              isSelected={selectedEntity?.id === entity.id}
              onClick={onEntitySelect}
              onHover={onEntityHover}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Child column component for depth > 0
interface ChildColumnProps {
  path: string;
  depth: number;
  selectedEntity: Entity | null;
  onEntitySelect: (entity: Entity) => void;
  onEntityHover: (entity: Entity | null) => void;
}

const ChildColumn: React.FC<ChildColumnProps> = ({
  path,
  depth,
  selectedEntity,
  onEntitySelect,
  onEntityHover
}) => {
  const { data: childrenData, isLoading, error } = useChildren(
    path || 'root',
    depth,
    true
  );

  const entities = childrenData?.entities || childrenData?.nodes || [];

  if (isLoading) {
    return (
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-center h-32 text-red-600">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span className="text-sm">Error loading children</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Level {depth + 1}
        </h3>
      </div>
      <div className="overflow-y-auto max-h-96">
        {entities.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No entities at this level
          </div>
        ) : (
          entities.map((entity) => (
            <EntityItem
              key={entity.id}
              entity={entity}
              isSelected={selectedEntity?.id === entity.id}
              onClick={onEntitySelect}
              onHover={onEntityHover}
              depth={depth}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Main column component that conditionally renders root or child column
interface ColumnProps {
  path: string;
  depth: number;
  selectedEntity: Entity | null;
  onEntitySelect: (entity: Entity) => void;
  onEntityHover: (entity: Entity | null) => void;
}

const Column: React.FC<ColumnProps> = ({
  path,
  depth,
  selectedEntity,
  onEntitySelect,
  onEntityHover
}) => {
  // For depth 0 and no path, use root column
  if (depth === 0 && !path) {
    return (
      <RootColumn
        selectedEntity={selectedEntity}
        onEntitySelect={onEntitySelect}
        onEntityHover={onEntityHover}
      />
    );
  }
  
  // For all other cases, use child column
  return (
    <ChildColumn
      path={path}
      depth={depth}
      selectedEntity={selectedEntity}
      onEntitySelect={onEntitySelect}
      onEntityHover={onEntityHover}
    />
  );
};

// Mobile single-column view component
interface MobileColumnViewProps {
  currentPath: string;
  depth: number;
  selectedEntity: Entity | null;
  onEntitySelect: (entity: Entity) => void;
  onEntityHover: (entity: Entity | null) => void;
  onNavigateBack: () => void;
}

const MobileColumnView: React.FC<MobileColumnViewProps> = ({
  currentPath,
  depth,
  selectedEntity,
  onEntitySelect,
  onEntityHover,
  onNavigateBack,
}) => {
  const { data: childrenData, isLoading } = useChildren(
    currentPath || 'root',
    depth,
    true
  );
  
  const entities = childrenData?.entities || childrenData?.nodes || [];

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Mobile header with back button */}
      <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
        {depth > 0 && (
          <button
            onClick={onNavigateBack}
            className="flex items-center mr-4 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </button>
        )}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {depth === 0 ? 'All Entities' : `Level ${depth + 1}`}
        </h2>
      </div>
      
      {/* Entity list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        ) : entities.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No entities found
          </div>
        ) : (
          entities.map((entity) => (
            <EntityItem
              key={entity.id}
              entity={entity}
              isSelected={selectedEntity?.id === entity.id}
              onClick={onEntitySelect}
              onHover={onEntityHover}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Main Miller's Columns component
// Performance: Wrapped with React.memo to prevent re-renders when parent updates
export const MillerColumns: React.FC = React.memo(() => {
  const queryClient = useQueryClient();
  const {
    isMobile,
    selectedColumnIndex,
    columnPaths,
    breadcrumb,
    setActiveEntity,
    navigateToEntity,
    navigateBack,
  } = useUIStore();

  // Feature flag for geospatial view
  const { isEnabled: mapV1Enabled, isLoading: mapFlagLoading } = useFeatureFlag('ff.map_v1', {
    checkRollout: true,
    fallbackEnabled: false
  });

  // Hybrid state management for React Query + Zustand + WebSocket coordination
  const hybridState = useHybridState({
    enabled: true,
    channels: ['hierarchy_updates', 'entity_changes'],
    autoInvalidate: true,
    optimisticUpdates: true,
    retryFailedSync: true,
    batchUpdates: true,
    debounceMs: 50 // Faster updates for better UX
  });

  // Performance monitoring for real-time operations
  const performanceMonitor = React.useMemo(() => new RealtimePerformanceMonitor(), []);

  // Monitor hybrid state sync status
  React.useEffect(() => {
    const syncStatus = hybridState.getSyncStatus();
    
    if (!syncStatus.connected) {
      console.log('Miller Columns: Hybrid state disconnected');
    } else if (syncStatus.pending > 0) {
      console.log(`Miller Columns: ${syncStatus.pending} pending updates`);
    }
  }, [hybridState]);

  // Current state
  const currentPath = columnPaths[selectedColumnIndex] || '';
  const selectedEntity = useUIStore((state) => state.activeEntity);

  // Handle entity selection with hybrid state coordination
  const handleEntitySelect = useCallback((entity: Entity) => {
    const startTime = performance.now();
    
    // Update UI state immediately
    setActiveEntity(entity);
    navigateToEntity(entity, selectedColumnIndex + 1);
    
    // Sync with hybrid state management
    hybridState.syncEntity(entity);
    
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric('entity_selection', duration);
    
    console.log(`Entity selected: ${entity.name} (${duration.toFixed(2)}ms)`);
  }, [selectedColumnIndex, setActiveEntity, navigateToEntity, hybridState, performanceMonitor]);

  // Handle entity hover for preview
  const handleEntityHover = useCallback((entity: Entity | null) => {
    // Could implement entity preview on hover
    // For now, just log for debugging
    if (entity) {
      console.log('Hovering entity:', entity.name);
    }
  }, []);

  // Navigate back in mobile view
  const handleNavigateBack = useCallback(() => {
    navigateBack();
  }, [navigateBack]);

  // Memoized columns for desktop view
  const desktopColumns = useMemo(() => {
    if (isMobile) return null;
    
    return columnPaths.map((path, index) => (
      <Column
        key={`column-${index}`}
        path={path}
        depth={index}
        selectedEntity={selectedEntity}
        onEntitySelect={handleEntitySelect}
        onEntityHover={handleEntityHover}
      />
    ));
  }, [columnPaths, selectedEntity, handleEntitySelect, handleEntityHover, isMobile]);

  return (
    <ErrorBoundary>
      <div className="flex-1 h-full flex flex-col bg-gray-50 dark:bg-gray-800">
        {/* Search Interface */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <SearchInterface />
        </div>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Miller Columns Area */}
          <div className="flex-1 flex flex-col">
            {isMobile ? (
              // Mobile single-column view
              <MobileColumnView
                currentPath={currentPath}
                depth={selectedColumnIndex}
                selectedEntity={selectedEntity}
                onEntitySelect={handleEntitySelect}
                onEntityHover={handleEntityHover}
                onNavigateBack={handleNavigateBack}
              />
            ) : (
              // Desktop multi-column view
              <div className="flex h-full overflow-x-auto">
                {desktopColumns}
                {/* Add new column button when there's a selected entity with children */}
                {selectedEntity?.hasChildren && (
                  <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                    <div className="flex items-center justify-center h-32">
                      <button
                        onClick={() => handleEntitySelect(selectedEntity)}
                        className="flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 mr-2" />
                        Load Children
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Geospatial View - conditionally rendered based on ff.map_v1 feature flag */}
          {mapV1Enabled && (
            <div className="w-96 border-l border-gray-200 dark:border-gray-700">
              <GeospatialView
                className="h-full"
                onLayerClick={(layerId, feature) => {
                  console.log('[MillerColumns] Layer clicked:', layerId, feature);
                }}
                onViewStateChange={(viewState) => {
                  console.log('[MillerColumns] View state changed:', viewState);
                }}
              />
            </div>
          )}
          
          {/* Entity Detail Panel */}
          {selectedEntity && (
            <div className="w-96 border-l border-gray-200 dark:border-gray-700">
              <EntityDetail />
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
});

// Add displayName for better debugging with React DevTools
MillerColumns.displayName = 'MillerColumns';

export default MillerColumns;