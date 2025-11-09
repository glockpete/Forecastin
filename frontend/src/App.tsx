/**
 * Forecastin Frontend - Phase 0 Implementation
 * Implements Miller's Columns UI pattern with hybrid state management
 * React Query (Server State) + Zustand (UI State) + WebSocket (Real-time)
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { useUIStore } from './store/uiStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useHybridState } from './hooks/useHybridState';
import OutcomesDashboard from './components/Outcomes/OutcomesDashboard';
import { MillerColumns } from './components/MillerColumns/MillerColumns';
import { NavigationPanel } from './components/Navigation/NavigationPanel';
import { EntityDetail } from './components/Entity/EntityDetail';
import { SearchInterface } from './components/Search/SearchInterface';
import { LoadingSpinner } from './components/UI/LoadingSpinner';
import { ErrorBoundary } from './components/UI/ErrorBoundary';
import { CacheCoordinator, RealtimePerformanceMonitor } from './utils/stateManager';
import { routeRealtimeMessage, handleRealtimeError } from './handlers/realtimeHandlers';
import { layerPerformanceMonitor } from './layers/utils/performance-monitor';

// Create React Query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
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
  // Always use dark theme (enforced at html/body level in index.css)
  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col h-screen">
        {/* Header with navigation */}
        <header className="bg-surface border-b border-dark-default">
          <NavigationPanel />
        </header>

        {/* Main content area with Miller's Columns */}
        <main className="flex-1 overflow-hidden bg-background">
          <MillerColumns />
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppContent />
          <ReactQueryDevtools initialIsOpen={false} />
          <Toaster position="top-right" />
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;