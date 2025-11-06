/**
 * Outcomes Dashboard Data Hooks
 * React Query hooks for fetching opportunities, actions, stakeholders, and evidence
 * Follows forecastin patterns for hybrid state management and WebSocket integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  Opportunity,
  Action,
  Stakeholder,
  Evidence,
  LensFilters,
  OpportunitiesResponse,
  ActionsResponse,
  StakeholdersResponse,
  EvidenceResponse,
  outcomesKeys,
  ActionGenerationRule,
} from '../types/outcomes';
import { API_BASE_URL } from '../config/env';

// API client functions
const fetchOpportunities = async (filters: LensFilters): Promise<OpportunitiesResponse> => {
  const params = new URLSearchParams();
  
  if (filters.role?.length) params.append('role', filters.role.join(','));
  if (filters.sector?.length) params.append('sector', filters.sector.join(','));
  if (filters.marketLevel?.length) params.append('marketLevel', filters.marketLevel.join(','));
  if (filters.function?.length) params.append('function', filters.function.join(','));
  if (filters.risk?.length) params.append('risk', filters.risk.join(','));
  if (filters.horizon?.length) params.append('horizon', filters.horizon.join(','));

  const response = await fetch(`${API_BASE_URL}/api/opportunities?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch opportunities: ${response.statusText}`);
  }
  
  return response.json();
};

const fetchActions = async (opportunityId?: string): Promise<ActionsResponse> => {
  const url = opportunityId
    ? `${API_BASE_URL}/api/actions?opportunityId=${opportunityId}`
    : `${API_BASE_URL}/api/actions`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch actions: ${response.statusText}`);
  }
  
  return response.json();
};

const fetchStakeholders = async (opportunityId?: string): Promise<StakeholdersResponse> => {
  const url = opportunityId
    ? `${API_BASE_URL}/api/stakeholders?opportunityId=${opportunityId}`
    : `${API_BASE_URL}/api/stakeholders`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch stakeholders: ${response.statusText}`);
  }
  
  return response.json();
};

const fetchEvidence = async (opportunityId?: string): Promise<EvidenceResponse> => {
  const url = opportunityId
    ? `${API_BASE_URL}/api/evidence?opportunityId=${opportunityId}`
    : `${API_BASE_URL}/api/evidence`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch evidence: ${response.statusText}`);
  }
  
  return response.json();
};

// Business rules for action generation
export const actionGenerationRules: ActionGenerationRule[] = [
  {
    id: 'policy_window',
    name: 'Policy Window Engagement',
    condition: (opp) => (opp.policyWindow ?? Infinity) <= 30 && opp.confidence >= 0.75,
    generateAction: (opp) => ({
      opportunityId: opp.id,
      type: 'engage_policy',
      title: 'Engage Policy Stakeholders',
      description: `Policy window closes in ${opp.policyWindow} days. High confidence (${(opp.confidence * 100).toFixed(0)}%) opportunity requiring immediate stakeholder engagement.`,
      priority: 'high',
      status: 'pending',
      businessRule: 'policy_window',
      metadata: {
        policyWindow: opp.policyWindow,
        confidence: opp.confidence,
      },
    }),
  },
  {
    id: 'high_roi_low_risk',
    name: 'High ROI Low Risk Opportunity',
    condition: (opp) => opp.roiScore >= 0.7 && opp.riskLevel <= 0.4,
    generateAction: (opp) => ({
      opportunityId: opp.id,
      type: 'market_scan',
      title: 'Open Market Scan / Initiate Partnership',
      description: `High ROI (${(opp.roiScore * 100).toFixed(0)}%) with low risk (${(opp.riskLevel * 100).toFixed(0)}%). Consider market entry or partnership opportunities.`,
      priority: 'high',
      status: 'pending',
      businessRule: 'high_roi_low_risk',
      metadata: {
        roiScore: opp.roiScore,
        riskLevel: opp.riskLevel,
      },
    }),
  },
  {
    id: 'fx_volatility_hedge',
    name: 'FX Volatility Hedge',
    condition: (opp) => {
      if (!opp.fxExposure) return false;
      return opp.fxExposure.volatility > 0.15; // 15% volatility threshold
    },
    generateAction: (opp) => ({
      opportunityId: opp.id,
      type: 'hedge_fx',
      title: 'Hedge FX Exposure',
      description: `High FX volatility detected (${((opp.fxExposure?.volatility ?? 0) * 100).toFixed(1)}%) for ${opp.fxExposure?.currency}. Consider hedging ${opp.fxExposure?.amount} ${opp.fxExposure?.currency}.`,
      priority: 'medium',
      status: 'pending',
      businessRule: 'fx_volatility_hedge',
      metadata: {
        currency: opp.fxExposure?.currency,
        amount: opp.fxExposure?.amount,
        volatility: opp.fxExposure?.volatility,
      },
    }),
  },
  {
    id: 'low_confidence_positive_momentum',
    name: 'Monitor and Alert',
    condition: (opp) => opp.confidence < 0.6 && opp.momentum > 0.3,
    generateAction: (opp) => ({
      opportunityId: opp.id,
      type: 'monitor_alert',
      title: 'Monitor + Alert',
      description: `Low confidence (${(opp.confidence * 100).toFixed(0)}%) but positive momentum (${(opp.momentum * 100).toFixed(0)}%). Continue monitoring for signal strength.`,
      priority: 'low',
      status: 'pending',
      businessRule: 'low_confidence_positive_momentum',
      metadata: {
        confidence: opp.confidence,
        momentum: opp.momentum,
      },
    }),
  },
];

// Generate actions based on business rules
const generateActionsForOpportunity = (opportunity: Opportunity): Omit<Action, 'id' | 'createdAt' | 'updatedAt'>[] => {
  const actions: Omit<Action, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  
  for (const rule of actionGenerationRules) {
    if (rule.condition(opportunity)) {
      actions.push(rule.generateAction(opportunity));
    }
  }
  
  return actions;
};

// React Query hooks
export const useOpportunities = (filters: LensFilters, enabled: boolean = true) => {
  return useQuery({
    queryKey: outcomesKeys.opportunitiesFiltered(filters),
    queryFn: () => fetchOpportunities(filters),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useActions = (opportunityId?: string, enabled: boolean = true) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: opportunityId
      ? outcomesKeys.actionsForOpportunity(opportunityId)
      : outcomesKeys.actions(),
    queryFn: () => fetchActions(opportunityId),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  
  // Generate actions for opportunities if needed
  const generateActions = useCallback((opportunities: Opportunity[]) => {
    const generatedActions: Action[] = [];
    const now = new Date().toISOString();
    
    opportunities.forEach((opp) => {
      const oppActions = generateActionsForOpportunity(opp);
      oppActions.forEach((action, index) => {
        generatedActions.push({
          ...action,
          id: `${opp.id}_${action.type}_${index}`,
          createdAt: now,
          updatedAt: now,
        });
      });
    });
    
    return generatedActions;
  }, []);
  
  return {
    ...query,
    generateActions,
  };
};

export const useStakeholders = (opportunityId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: opportunityId
      ? outcomesKeys.stakeholdersForOpportunity(opportunityId)
      : outcomesKeys.stakeholders(),
    queryFn: () => fetchStakeholders(opportunityId),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useEvidence = (opportunityId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: opportunityId
      ? outcomesKeys.evidenceForOpportunity(opportunityId)
      : outcomesKeys.evidence(),
    queryFn: () => fetchEvidence(opportunityId),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Mutation hooks for updating data
export const useUpdateActionStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ actionId, status }: { actionId: string; status: Action['status'] }) => {
      const response = await fetch(`${API_BASE_URL}/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update action: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate actions cache
      queryClient.invalidateQueries({ queryKey: outcomesKeys.actions() });
    },
  });
};

export const useUpdateOpportunity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ opportunityId, data }: { opportunityId: string; data: Partial<Opportunity> }) => {
      const response = await fetch(`${API_BASE_URL}/api/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update opportunity: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate opportunities cache
      queryClient.invalidateQueries({ queryKey: outcomesKeys.opportunities() });
      queryClient.invalidateQueries({ queryKey: outcomesKeys.opportunity(variables.opportunityId) });
    },
  });
};