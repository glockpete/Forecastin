/**
 * UI State Management with Zustand
 * Global UI state for navigation, theme, mobile responsiveness
 * Part of hybrid state coordination: React Query (Server) + Zustand (UI) + WebSocket (Real-time)
 */

import React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Entity } from '../types';

export interface BreadcrumbItem {
  label: string;
  path: string;
  entityId?: string;
}

interface UIState {
  // Theme and appearance
  theme: 'light' | 'dark';
  isLoading: boolean;
  
  // Navigation state
  isNavigationOpen: boolean;
  activeEntity: Entity | null;
  breadcrumb: BreadcrumbItem[];
  
  // Mobile responsiveness
  isMobile: boolean;
  mobileView: 'list' | 'columns';
  
  // UI panels
  searchPanelOpen: boolean;
  entityPanelOpen: boolean;
  
  // Hierarchy navigation state
  selectedColumnIndex: number;
  columnPaths: string[]; // Track current path for each column
  
  // Search state
  searchQuery: string;
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  setLoading: (loading: boolean) => void;
  toggleNavigation: () => void;
  closeNavigation: () => void;
  setActiveEntity: (entity: Entity | null) => void;
  setBreadcrumb: (breadcrumb: BreadcrumbItem[]) => void;
  setMobile: (isMobile: boolean) => void;
  setMobileView: (view: 'list' | 'columns') => void;
  toggleSearchPanel: () => void;
  toggleEntityPanel: () => void;
  setSelectedColumnIndex: (index: number) => void;
  setColumnPaths: (paths: string[]) => void;
  navigateBack: () => void;
  navigateToEntity: (entity: Entity, columnIndex: number) => void;
  resetNavigation: () => void;
  setSearchQuery: (query: string) => void;
  getCurrentColumnPath: () => string;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'light',
      isLoading: false,
      isNavigationOpen: true,
      activeEntity: null,
      breadcrumb: [],
      isMobile: false,
      mobileView: 'list',
      searchPanelOpen: false,
      entityPanelOpen: false,
      selectedColumnIndex: 0,
      columnPaths: [],
      searchQuery: '',

      // Actions
      setTheme: (theme) => set({ theme }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      toggleNavigation: () => 
        set((state) => ({ isNavigationOpen: !state.isNavigationOpen })),
      
      closeNavigation: () => set({ isNavigationOpen: false }),
      
      setActiveEntity: (entity) => set({ 
        activeEntity: entity,
        entityPanelOpen: entity !== null 
      }),
      
      setBreadcrumb: (breadcrumb) => set({ breadcrumb }),
      
      setMobile: (isMobile) => set({ 
        isMobile,
        // Auto-collapse navigation on mobile
        isNavigationOpen: isMobile ? false : get().isNavigationOpen,
        mobileView: isMobile ? 'list' : 'columns'
      }),
      
      setMobileView: (view) => set({ mobileView: view }),
      
      toggleSearchPanel: () => 
        set((state) => ({ searchPanelOpen: !state.searchPanelOpen })),
      
      toggleEntityPanel: () => 
        set((state) => ({ entityPanelOpen: !state.entityPanelOpen })),
      
      setSelectedColumnIndex: (index) => set({ selectedColumnIndex: index }),
      
      setColumnPaths: (paths) => set({ columnPaths: paths }),
      
      // Navigate back in hierarchy
      navigateBack: () => {
        const { selectedColumnIndex, columnPaths, setSelectedColumnIndex, setColumnPaths } = get();
        
        if (selectedColumnIndex > 0) {
          const newIndex = selectedColumnIndex - 1;
          const newPaths = columnPaths.slice(0, newIndex + 1);
          
          setSelectedColumnIndex(newIndex);
          setColumnPaths(newPaths);
        }
      },
      
      // Navigate to specific entity
      navigateToEntity: (entity, columnIndex) => {
        const { selectedColumnIndex, columnPaths, setSelectedColumnIndex, setColumnPaths } = get();
        
        const newIndex = Math.max(columnIndex, 0);
        const newPaths = [
          ...columnPaths.slice(0, newIndex),
          entity.path
        ];
        
        setSelectedColumnIndex(newIndex);
        setColumnPaths(newPaths);
        
        // Update breadcrumb based on navigation
        const breadcrumb: BreadcrumbItem[] = [];
        for (let i = 0; i <= newIndex; i++) {
          breadcrumb.push({
            label: `Level ${i + 1}`,
            path: newPaths[i] || '',
            entityId: i === newIndex ? entity.id : undefined
          });
        }
        get().setBreadcrumb(breadcrumb);
      },
      
      // Reset navigation state
      resetNavigation: () => set({
        selectedColumnIndex: 0,
        columnPaths: [],
        breadcrumb: []
      }),
      
      // Search functionality
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      // Get current column path
      getCurrentColumnPath: () => {
        const { columnPaths, selectedColumnIndex } = get();
        return columnPaths[selectedColumnIndex] || '';
      },
    }),
    {
      name: 'forecastin-ui-state',
      partialize: (state) => ({
        theme: state.theme,
        isNavigationOpen: state.isNavigationOpen,
        mobileView: state.mobileView,
        searchPanelOpen: state.searchPanelOpen,
      }),
    }
  )
);

// Responsive breakpoint hook
export const useResponsive = () => {
  const [isMobile, setIsMobile] = React.useState(false);
  const setMobile = useUIStore((state) => state.setMobile);
  
  React.useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setMobile(mobile);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [setMobile]);
  
  return { isMobile };
};