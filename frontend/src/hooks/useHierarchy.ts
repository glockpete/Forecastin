/**
 * Hierarchy API Hooks for React Query
 * Server state management with lazy loading and WebSocket integration
 * Optimized for LTREE database patterns and materialized views
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import type {
  Entity,
  BreadcrumbItem,
  HierarchyResponse} from '../types';
import {
  HierarchyNode,
  EntityType,
  PathString,
  toEntityId,
} from '../types';

// Re-export Entity type for components
export type { Entity };

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:9000/api';


// Query key factory
export const hierarchyKeys = {
  all: ['hierarchy'] as const,
  root: () => [...hierarchyKeys.all, 'root'] as const,
  node: (path: string) => [...hierarchyKeys.all, 'node', path] as const,
  children: (parentPath: string, depth: number) => 
    [...hierarchyKeys.all, 'children', parentPath, depth] as const,
  breadcrumbs: (path: string) => [...hierarchyKeys.all, 'breadcrumbs', path] as const,
  search: (query: string, filters?: any) => 
    [...hierarchyKeys.all, 'search', query, filters] as const,
  entity: (id: string) => [...hierarchyKeys.all, 'entity', id] as const,
};

// Fetch root hierarchy entities (top-level nodes only)
export const useRootHierarchy = () => {
  return useQuery({
    queryKey: hierarchyKeys.root(),
    queryFn: async (): Promise<HierarchyResponse> => {
      const response = await fetch(`${API_BASE}/hierarchy/root`);
      if (!response.ok) {
        throw new Error(`Failed to fetch root hierarchy: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount: number, error: Error) => {
      // Implement exponential backoff retry mechanism
      if (failureCount < 3) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Fetch child entities for a specific parent (lazy loading)
export const useChildren = (parentPath: string, depth: number, enabled = true) => {
  return useQuery({
    queryKey: hierarchyKeys.children(parentPath, depth),
    queryFn: async (): Promise<HierarchyResponse> => {
      const response = await fetch(
        `${API_BASE}/hierarchy/children?path=${encodeURIComponent(parentPath)}&depth=${depth}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch children: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: enabled && !!parentPath,
    staleTime: 2 * 60 * 1000, // 2 minutes for child nodes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Fetch breadcrumb path for an entity
export const useBreadcrumbs = (path: string) => {
  return useQuery({
    queryKey: hierarchyKeys.breadcrumbs(path),
    queryFn: async (): Promise<BreadcrumbItem[]> => {
      const response = await fetch(
        `${API_BASE}/hierarchy/breadcrumbs?path=${encodeURIComponent(path)}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch breadcrumbs: ${response.statusText}`);
      }
      const result = await response.json();
      return result.breadcrumbs || [];
    },
    enabled: !!path,
    staleTime: 10 * 60 * 1000, // 10 minutes for breadcrumbs
  });
};

// Fetch individual entity details
export const useEntity = (id: string) => {
  return useQuery({
    queryKey: hierarchyKeys.entity(id),
    queryFn: async (): Promise<Entity> => {
      const response = await fetch(`${API_BASE}/entities/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch entity: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// Search entities with filters
export const useSearchEntities = (query: string, filters?: any, enabled = true) => {
  return useQuery({
    queryKey: hierarchyKeys.search(query, filters),
    queryFn: async (): Promise<HierarchyResponse> => {
      const searchParams = new URLSearchParams({
        q: query,
        ...filters,
      });
      const response = await fetch(`${API_BASE}/hierarchy/search?${searchParams}`);
      if (!response.ok) {
        throw new Error(`Failed to search entities: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: enabled && !!query.trim(),
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
  });
};

// Refresh hierarchy views (for materialized view maintenance)
export const useRefreshHierarchy = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/hierarchy/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to refresh hierarchy: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all hierarchy queries to refresh cache
      queryClient.invalidateQueries({ queryKey: hierarchyKeys.all });
    },
  });
};

// Create new entity
export const useCreateEntity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entityData: Partial<Entity>) => {
      const response = await fetch(`${API_BASE}/entities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entityData),
      });
      if (!response.ok) {
        throw new Error(`Failed to create entity: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate hierarchy queries to reflect changes
      queryClient.invalidateQueries({ queryKey: hierarchyKeys.all });
    },
  });
};

// Update entity
export const useUpdateEntity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...entityData }: Partial<Entity> & { id: string }) => {
      const response = await fetch(`${API_BASE}/entities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entityData),
      });
      if (!response.ok) {
        throw new Error(`Failed to update entity: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Update specific entity query and invalidate hierarchy
      queryClient.setQueryData(hierarchyKeys.entity(data.id), data);
      queryClient.invalidateQueries({ queryKey: hierarchyKeys.all });
    },
  });
};

// Delete entity
export const useDeleteEntity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE}/entities/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete entity: ${response.statusText}`);
      }
    },
    onSuccess: (_, deletedId) => {
      // Remove from cache and invalidate queries
      queryClient.removeQueries({ queryKey: hierarchyKeys.entity(deletedId) });
      queryClient.invalidateQueries({ queryKey: hierarchyKeys.all });
    },
  });
};

// Move entity in hierarchy
export const useMoveEntity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, newParentId, newPath }: { 
      id: string; 
      newParentId?: string; 
      newPath: string; 
    }) => {
      const response = await fetch(`${API_BASE}/entities/${id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newParentId, newPath }),
      });
      if (!response.ok) {
        throw new Error(`Failed to move entity: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate hierarchy queries to refresh data
      queryClient.invalidateQueries({ queryKey: hierarchyKeys.all });
    },
  });
};

// Preload entity children (for performance optimization)
export const usePreloadChildren = () => {
  const queryClient = useQueryClient();
  
  return (entityPath: string, depth: number) => {
    // Prefetch children for better UX
    queryClient.prefetchQuery({
      queryKey: hierarchyKeys.children(entityPath, depth + 1),
      queryFn: () => fetch(
        `${API_BASE}/hierarchy/children?path=${encodeURIComponent(entityPath)}&depth=${depth + 1}`
      ).then(res => res.json()),
      staleTime: 2 * 60 * 1000,
    });
  };
};

// Get hierarchy statistics
export const useHierarchyStats = () => {
  return useQuery({
    queryKey: [...hierarchyKeys.all, 'stats'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/hierarchy/stats`);
      if (!response.ok) {
        throw new Error(`Failed to fetch hierarchy stats: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};