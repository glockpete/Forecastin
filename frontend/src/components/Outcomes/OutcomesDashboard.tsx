/**
 * OutcomesDashboard Component
 * Main "One Dashboard, Multiple Lenses" implementation
 * Replaces Miller's Columns with opportunity-focused dashboard
 * Implements Four Horizons: Immediate | Short | Medium | Long
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { LensFilters, Opportunity, TimeHorizon, LensFilterOption } from '../../types/outcomes';
import { useOpportunities, useActions, useStakeholders, useEvidence } from '../../hooks/useOutcomes';
import { useWebSocket } from '../../hooks/useWebSocket';
import LensBar from './LensBar';
import HorizonLane from './HorizonLane';
import StakeholderMap from './StakeholderMap';
import EvidencePanel from './EvidencePanel';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import { ErrorBoundary } from '../UI/ErrorBoundary';

const OutcomesDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  // Parse filters from URL params
  const filters: LensFilters = useMemo(() => {
    return {
      role: searchParams.get('role')?.split(',').filter(Boolean),
      sector: searchParams.get('sector')?.split(',').filter(Boolean),
      marketLevel: searchParams.get('marketLevel')?.split(',').filter(Boolean),
      function: searchParams.get('function')?.split(',').filter(Boolean),
      risk: searchParams.get('risk')?.split(',').filter(Boolean),
      horizon: searchParams.get('horizon')?.split(',').filter(Boolean) as TimeHorizon[] | undefined,
    };
  }, [searchParams]);

  // Fetch data with TanStack Query
  const { data: opportunitiesData, isLoading: opportunitiesLoading, error: opportunitiesError } = useOpportunities(filters);
  const { data: actionsData, generateActions } = useActions();
  const { data: stakeholdersData } = useStakeholders(selectedOpportunity?.id);
  const { data: evidenceData, isLoading: evidenceLoading } = useEvidence(selectedOpportunity?.id);

  // Stable WebSocket callbacks to prevent infinite reconnection loop
  const handleWebSocketConnect = useCallback(() => {
    console.log('[WebSocket] Connected successfully in OutcomesDashboard');
  }, []);

  const handleWebSocketDisconnect = useCallback(() => {
    console.log('[WebSocket] Disconnected in OutcomesDashboard');
  }, []);

  const handleWebSocketError = useCallback((error: Event) => {
    console.error('[WebSocket] Error in OutcomesDashboard:', error);
  }, []);

  // Initialize WebSocket connection for testing
  const {
    isConnected,
    connectionStatus,
    lastMessage,
    error: wsError,
    wsUrl
  } = useWebSocket({
    onConnect: handleWebSocketConnect,
    onDisconnect: handleWebSocketDisconnect,
    onError: handleWebSocketError,
  });

  // Extract data from responses
  const opportunities = opportunitiesData?.opportunities ?? [];
  const stakeholders = stakeholdersData?.stakeholders ?? [];
  const evidence = evidenceData?.evidence ?? [];

  // Generate actions for all opportunities
  const allActions = useMemo(() => {
    return generateActions(opportunities);
  }, [opportunities, generateActions]);

  // Group opportunities by horizon
  const opportunitiesByHorizon = useMemo(() => {
    const grouped: Record<TimeHorizon, Opportunity[]> = {
      immediate: [],
      short: [],
      medium: [],
      long: [],
    };

    opportunities.forEach((opp) => {
      if (grouped[opp.horizon]) {
        grouped[opp.horizon].push(opp);
      }
    });

    return grouped;
  }, [opportunities]);

  // Group actions by horizon (based on their opportunity's horizon)
  const actionsByHorizon = useMemo(() => {
    const grouped: Record<TimeHorizon, typeof allActions> = {
      immediate: [],
      short: [],
      medium: [],
      long: [],
    };

    allActions.forEach((action) => {
      const opportunity = opportunities.find((opp) => opp.id === action.opportunityId);
      if (opportunity && grouped[opportunity.horizon]) {
        grouped[opportunity.horizon].push(action);
      }
    });

    return grouped;
  }, [allActions, opportunities]);

  // Available filter options (would typically come from API)
  const availableFilters: {
    roles: LensFilterOption[];
    sectors: LensFilterOption[];
    marketLevels: LensFilterOption[];
    functions: LensFilterOption[];
    risks: LensFilterOption[];
    horizons: LensFilterOption[];
  } = {
    roles: [
      { value: 'ceo', label: 'CEO', count: 12 },
      { value: 'cfo', label: 'CFO', count: 8 },
      { value: 'analyst', label: 'Analyst', count: 15 },
    ],
    sectors: [
      { value: 'technology', label: 'Technology', count: 20 },
      { value: 'finance', label: 'Finance', count: 15 },
      { value: 'healthcare', label: 'Healthcare', count: 10 },
    ],
    marketLevels: [
      { value: 'global', label: 'Global', count: 18 },
      { value: 'regional', label: 'Regional', count: 12 },
      { value: 'local', label: 'Local', count: 8 },
    ],
    functions: [
      { value: 'strategy', label: 'Strategy', count: 14 },
      { value: 'operations', label: 'Operations', count: 10 },
      { value: 'marketing', label: 'Marketing', count: 8 },
    ],
    risks: [
      { value: 'high', label: 'High', count: 5 },
      { value: 'medium', label: 'Medium', count: 15 },
      { value: 'low', label: 'Low', count: 18 },
    ],
    horizons: [
      { value: 'immediate', label: 'Immediate', count: opportunitiesByHorizon.immediate.length },
      { value: 'short', label: 'Short', count: opportunitiesByHorizon.short.length },
      { value: 'medium', label: 'Medium', count: opportunitiesByHorizon.medium.length },
      { value: 'long', label: 'Long', count: opportunitiesByHorizon.long.length },
    ],
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: LensFilters) => {
    // Filters are managed via URL params in LensBar component
    console.log('Filters changed:', newFilters);
  };

  // Handle opportunity selection
  const handleOpportunitySelect = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
  };

  // Loading state
  if (opportunitiesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading opportunities...</span>
      </div>
    );
  }

  // Error state
  if (opportunitiesError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Error Loading Opportunities
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {opportunitiesError instanceof Error ? opportunitiesError.message : 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
        {/* Lens Bar - Filter Controls */}
        <LensBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          availableFilters={availableFilters}
        />

        {/* Main Dashboard Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Four Horizon Lanes */}
          <div className="flex-1 flex overflow-x-auto">
            {(['immediate', 'short', 'medium', 'long'] as TimeHorizon[]).map((horizon) => (
              <HorizonLane
                key={horizon}
                horizon={horizon}
                opportunities={opportunitiesByHorizon[horizon]}
                actions={actionsByHorizon[horizon]}
                selectedOpportunity={selectedOpportunity}
                onOpportunitySelect={handleOpportunitySelect}
                loading={opportunitiesLoading}
              />
            ))}
          </div>

          {/* Right Pane - Stakeholder Map + Evidence Panel */}
          {selectedOpportunity && (
            <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
              {/* Opportunity Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {selectedOpportunity.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {selectedOpportunity.description}
                </p>
                <div className="flex items-center space-x-3 mt-3 text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    ROI: <span className="font-medium text-green-600 dark:text-green-400">
                      {(selectedOpportunity.roiScore * 100).toFixed(0)}%
                    </span>
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Confidence: <span className="font-medium">
                      {(selectedOpportunity.confidence * 100).toFixed(0)}%
                    </span>
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Risk: <span className="font-medium text-red-600 dark:text-red-400">
                      {(selectedOpportunity.riskLevel * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
              </div>

              {/* Stakeholder Map */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <StakeholderMap
                  stakeholders={stakeholders}
                  onStakeholderClick={(stakeholder) => console.log('Stakeholder clicked:', stakeholder)}
                  height={250}
                />
              </div>

              {/* Evidence Panel */}
              <div className="flex-1 overflow-hidden">
                <EvidencePanel
                  evidence={evidence}
                  opportunityId={selectedOpportunity.id}
                  loading={evidenceLoading}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default OutcomesDashboard;