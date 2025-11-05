/**
 * Forecastin Frontend - Phase 0 Implementation
 * Implements Miller's Columns UI pattern with hybrid state management
 * React Query (Server State) + Zustand (UI State) + WebSocket (Real-time)
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { useUIStore } from './store/uiStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useHybridState } from './hooks/useHybridState';
import { MillerColumns } from './components/MillerColumns/MillerColumns';
import { NavigationPanel } from './components/Navigation/NavigationPanel';
import { EntityDetail } from './components/Entity/EntityDetail';
import { SearchInterface } from './components/Search/SearchInterface';
import { LoadingSpinner } from './components/UI/LoadingSpinner';
import { ErrorBoundary } from './components/UI/ErrorBoundary';
import { CacheCoordinator, RealtimePerformanceMonitor } from './utils/stateManager';
import { routeRealtimeMessage, handleRealtimeError } from './handlers/realtimeHandlers';

// Create React Query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Implement exponential backoff retry mechanism
        if (failureCount < 3) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

interface AppState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  syncStatus?: {
    connected: boolean;
    pending: number;
    lastSync: number | null;
    health: 'healthy' | 'degraded' | 'error';
  };
}

function AppContent() {
  const {
    theme,
    isNavigationOpen,
    activeEntity,
    isMobile,
    breadcrumb,
    setActiveEntity,
    closeNavigation
  } = useUIStore();
  
  const [appState, setAppState] = React.useState<AppState>({
    isLoading: false,
    hasError: false,
  });

  // Initialize hybrid state management with React Query + Zustand + WebSocket
  const hybridState = useHybridState({
    enabled: true,
    channels: ['hierarchy_updates', 'entity_changes', 'cache_sync'],
    autoInvalidate: true,
    optimisticUpdates: true,
    retryFailedSync: true,
    batchUpdates: true,
    debounceMs: 100
  });

  // Performance monitoring for real-time updates
  const performanceMonitor = React.useMemo(() => new RealtimePerformanceMonitor(), []);

  // Handle WebSocket messages with hybrid state coordination
  React.useEffect(() => {
    if (hybridState.isConnected && hybridState.pendingUpdates > 0) {
      console.log('Processing pending updates:', hybridState.pendingUpdates);
    }
  }, [hybridState.isConnected, hybridState.pendingUpdates]);

  // Monitor sync health and update UI state
  React.useEffect(() => {
    const syncStatus = hybridState.getSyncStatus();
    setAppState(prev => ({ ...prev, syncStatus }));
    
    // Log performance warnings
    if (syncStatus.health === 'degraded') {
      console.warn('Hybrid state sync degraded:', syncStatus);
    } else if (syncStatus.health === 'error') {
      console.error('Hybrid state sync error:', syncStatus);
    }
  }, [hybridState]);

  // Handle connection errors
  React.useEffect(() => {
    if (!hybridState.isConnected) {
      console.log('Hybrid state disconnected');
    }
  }, [hybridState.isConnected]);

  // Responsive design: Miller's Columns collapses to single-column on mobile
  const isMobileView = isMobile || window.innerWidth < 768;

  if (appState.isLoading) {
    return <LoadingSpinner />;
  }

  if (appState.hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Forecastin - Geopolitical Intelligence Platform
          </h1>
          <p className="text-red-600 mb-4">
            {appState.errorMessage || 'An error occurred'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-gray-900 min-h-screen">
        {/* Global Navigation Bar */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Forecastin
                </h1>
                <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  Phase 0
                </span>
              </div>
              
              {/* Hybrid State Sync Status Indicator */}
              <div className="flex items-center space-x-4">
                <div className={`flex items-center space-x-2 ${
                  appState.syncStatus?.health === 'healthy' ? 'text-green-600' :
                  appState.syncStatus?.health === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    appState.syncStatus?.health === 'healthy' ? 'bg-green-500' :
                    appState.syncStatus?.health === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-medium">
                    {appState.syncStatus?.health === 'healthy' ? 'Synced' :
                     appState.syncStatus?.health === 'degraded' ? 'Syncing...' : 'Disconnected'}
                  </span>
                  {appState.syncStatus?.pending > 0 && (
                    <span className="text-xs text-gray-500">
                      ({appState.syncStatus.pending} pending)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Navigation Panel (collapsible on mobile) */}
          {isNavigationOpen && (
            <div className={`${isMobileView ? 'absolute inset-0 z-50' : 'w-64'} bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700`}>
              <NavigationPanel onClose={closeNavigation} />
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 flex">
            {/* Miller's Columns - Hierarchical Navigation */}
            <div className="flex-1 overflow-hidden">
              <MillerColumns />
            </div>

            {/* Entity Detail Panel (when entity is selected) */}
            {activeEntity && (
              <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <EntityDetail />
              </div>
            )}
          </div>
        </div>

        {/* Search Overlay (global search) */}
        <SearchInterface />
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AppContent />
          <ReactQueryDevtools initialIsOpen={false} />
          <Toaster position="top-right" />
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;