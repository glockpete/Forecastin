/**
 * useFeatureFlag Hook - Feature Flag Integration with Backend
 * 
 * Integrates with forecastin's FeatureFlagService backend API
 * Implements gradual rollout percentage logic with user context
 * Coordinates with hybrid state management system
 * Supports WebSocket real-time updates
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useHybridState } from './useHybridState';

// API Base URL from environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Feature flag data model matching backend
interface FeatureFlag {
  id: string;
  flag_name: string;
  description: string | null;
  is_enabled: boolean;
  rollout_percentage: number;
  created_at: number;
  updated_at: number;
}

// Hook configuration
interface UseFeatureFlagOptions {
  userId?: string;  // User ID for consistent rollout targeting
  checkRollout?: boolean;  // Whether to apply rollout percentage logic
  fallbackEnabled?: boolean;  // Default value if flag not found
  refetchOnWindowFocus?: boolean;
}

// Return type
interface UseFeatureFlagReturn {
  isEnabled: boolean;
  isLoading: boolean;
  error: Error | null;
  flag: FeatureFlag | null;
  refetch: () => void;
}

// Query keys for React Query
const featureFlagKeys = {
  all: ['featureFlags'] as const,
  single: (flagName: string) => ['featureFlags', flagName] as const,
  enabled: (flagName: string) => ['featureFlags', flagName, 'enabled'] as const,
};

/**
 * Fetch feature flag from backend API
 */
async function fetchFeatureFlag(flagName: string): Promise<FeatureFlag | null> {
  const response = await fetch(`${API_BASE_URL}/api/feature-flags/${flagName}`);
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error(`Failed to fetch feature flag: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.feature_flag;
}

/**
 * Check if feature flag is enabled with rollout logic
 */
async function checkFeatureFlagEnabled(
  flagName: string,
  userId?: string
): Promise<boolean> {
  const url = new URL(`${API_BASE_URL}/api/feature-flags/${flagName}/enabled`);
  if (userId) {
    url.searchParams.set('user_id', userId);
  }
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Failed to check feature flag: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.is_enabled;
}

/**
 * Hash user ID for consistent rollout targeting (matches backend logic)
 */
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if user should receive feature based on rollout percentage
 */
function isUserInRollout(userId: string | undefined, rolloutPercentage: number): boolean {
  if (rolloutPercentage === 100) {
    return true;
  }
  
  if (rolloutPercentage === 0) {
    return false;
  }
  
  if (!userId) {
    // No user context - use random assignment
    return Math.random() * 100 < rolloutPercentage;
  }
  
  // Consistent hash-based rollout
  const userHash = hashUserId(userId);
  const userPercentage = (userHash % 100) + 1;
  
  return userPercentage <= rolloutPercentage;
}

/**
 * useFeatureFlag Hook
 * 
 * Checks if a feature flag is enabled, respecting rollout percentage and user context.
 * Integrates with backend FeatureFlagService and WebSocket real-time updates.
 * 
 * @param flagName - Name of the feature flag (e.g., "ff.geo.layers_enabled")
 * @param options - Configuration options
 * @returns Feature flag status and metadata
 *
 * @example
 * ```tsx
 * const { isEnabled, isLoading } = useFeatureFlag('ff.geo.layers_enabled', {
 *   userId: currentUser.id,
 *   checkRollout: true,
 *   fallbackEnabled: false
 * });
 *
 * if (isEnabled) {
 *   return <GeospatialLayerMap />;
 * }
 * ```
 */
export function useFeatureFlag(
  flagName: string,
  options: UseFeatureFlagOptions = {}
): UseFeatureFlagReturn {
  const {
    userId,
    checkRollout = true,
    fallbackEnabled = false,
    refetchOnWindowFocus = false
  } = options;
  
  const queryClient = useQueryClient();
  const { isConnected, lastSync } = useHybridState();
  
  // Fetch feature flag data
  const {
    data: flag,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: featureFlagKeys.single(flagName),
    queryFn: () => fetchFeatureFlag(flagName),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus,
    retry: 2
  });
  
  // Calculate if flag is enabled based on rollout logic
  const isEnabled = useMemo(() => {
    if (!flag) {
      return fallbackEnabled;
    }
    
    if (!flag.is_enabled) {
      return false;
    }
    
    // If rollout check is disabled, just return enabled status
    if (!checkRollout) {
      return true;
    }
    
    // Apply rollout percentage logic
    return isUserInRollout(userId, flag.rollout_percentage);
  }, [flag, userId, checkRollout, fallbackEnabled]);
  
  // Listen for WebSocket updates via hybrid state coordination
  useEffect(() => {
    if (!isConnected) return;
    
    // WebSocket updates trigger React Query invalidations through hybrid state
    // This ensures real-time flag changes are reflected in the UI
    const handleFlagUpdate = () => {
      queryClient.invalidateQueries({ queryKey: featureFlagKeys.single(flagName) });
    };
    
    // Subscribe to flag change events
    // Note: Actual WebSocket subscription is handled by useHybridState
    // We just need to invalidate queries when sync happens
    handleFlagUpdate();
  }, [lastSync, isConnected, flagName, queryClient]);
  
  return {
    isEnabled,
    isLoading,
    error: error as Error | null,
    flag: flag ?? null,
    refetch: useCallback(() => { refetch(); }, [refetch])
  };
}

/**
 * useFeatureFlags Hook - Multiple flags at once
 * 
 * Efficiently checks multiple feature flags in parallel.
 * 
 * @param flagNames - Array of feature flag names
 * @param options - Configuration options
 * @returns Map of flag statuses
 */
export function useFeatureFlags(
  flagNames: string[],
  options: UseFeatureFlagOptions = {}
): Record<string, boolean> {
  const flags = flagNames.map(name => 
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useFeatureFlag(name, options)
  );
  
  return useMemo(() => {
    const result: Record<string, boolean> = {};
    flagNames.forEach((name, index) => {
      result[name] = flags[index].isEnabled;
    });
    return result;
  }, [flagNames, flags]);
}

/**
 * useGeospatialFeatureFlags Hook - Specialized for geospatial features
 * 
 * Checks all geospatial-related feature flags and returns their status.
 * Respects dependencies (e.g., geospatial_layers must be enabled for point_layer).
 * 
 * @param options - Configuration options
 * @returns Geospatial feature flag statuses
 */
export function useGeospatialFeatureFlags(options: UseFeatureFlagOptions = {}) {
  const mapV1 = useFeatureFlag('ff.map_v1', options);
  const geospatialLayers = useFeatureFlag('ff.geo.layers_enabled', options);
  const pointLayer = useFeatureFlag('ff.geo.point_layer_active', options);
  const polygonLayer = useFeatureFlag('ff.geo.polygon_layer_active', options);
  const heatmapLayer = useFeatureFlag('ff.geo.heatmap_layer_active', options);
  const clustering = useFeatureFlag('ff.geo.clustering_enabled', options);
  const gpuFiltering = useFeatureFlag('ff.geo.gpu_rendering_enabled', options);
  const websocketLayers = useFeatureFlag('ff.geo.websocket_layers_enabled', options);
  const realtimeUpdates = useFeatureFlag('ff.geo.realtime_updates_enabled', options);
  
  return useMemo(() => ({
    // Base dependencies
    mapV1Enabled: mapV1.isEnabled,
    
    // Core geospatial features (depend on map_v1)
    geospatialLayersEnabled: geospatialLayers.isEnabled && mapV1.isEnabled,
    
    // Layer types (depend on geospatial_layers)
    pointLayerEnabled: pointLayer.isEnabled && geospatialLayers.isEnabled && mapV1.isEnabled,
    polygonLayerEnabled: polygonLayer.isEnabled && geospatialLayers.isEnabled && mapV1.isEnabled,
    heatmapLayerEnabled: heatmapLayer.isEnabled && geospatialLayers.isEnabled && mapV1.isEnabled,
    
    // Advanced features
    clusteringEnabled: clustering.isEnabled && geospatialLayers.isEnabled && mapV1.isEnabled,
    gpuFilteringEnabled: gpuFiltering.isEnabled && geospatialLayers.isEnabled && mapV1.isEnabled,
    
    // Real-time features (depend on websocket_layers)
    websocketLayersEnabled: websocketLayers.isEnabled && geospatialLayers.isEnabled && mapV1.isEnabled,
    realtimeUpdatesEnabled: realtimeUpdates.isEnabled && websocketLayers.isEnabled && geospatialLayers.isEnabled,
    
    // Loading states
    isLoading: mapV1.isLoading || geospatialLayers.isLoading,
    
    // Errors
    hasError: !!(mapV1.error || geospatialLayers.error)
  }), [
    mapV1,
    geospatialLayers,
    pointLayer,
    polygonLayer,
    heatmapLayer,
    clustering,
    gpuFiltering,
    websocketLayers,
    realtimeUpdates
  ]);
}

// Export types for external use
export type { FeatureFlag, UseFeatureFlagOptions, UseFeatureFlagReturn };