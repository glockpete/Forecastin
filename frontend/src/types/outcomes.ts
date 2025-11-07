/**
 * Outcomes Dashboard Type Definitions
 * Following forecastin patterns for entity hierarchy and WebSocket integration
 * Implements "One Dashboard, Multiple Lenses" architecture
 */

// Lens filter types
export interface LensFilters {
  role?: string[];
  sector?: string[];
  marketLevel?: string[];
  function?: string[];
  risk?: string[];
  horizon?: TimeHorizon[];
}

export type TimeHorizon = 'immediate' | 'short' | 'medium' | 'long';

export interface LensFilterOption {
  value: string;
  label: string;
  count?: number;
}

// Opportunity types
export interface Opportunity {
  id: string;
  title: string;
  description: string;
  roiScore: number; // 0-1 scale
  confidence: number; // 0-1 scale
  horizon: TimeHorizon;
  policyWindow?: number; // days until policy window closes
  riskLevel: number; // 0-1 scale
  momentum: number; // -1 to 1, indicating trend direction
  sector: string[];
  marketLevel: string[];
  stakeholders: string[]; // stakeholder IDs
  evidence: string[]; // evidence IDs
  fxExposure?: {
    currency: string;
    amount: number;
    volatility: number;
  };
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick?: (opportunity: Opportunity) => void;
  selected?: boolean;
  compact?: boolean;
}

// Action types
export interface Action {
  id: string;
  opportunityId: string;
  type: 'engage_policy' | 'market_scan' | 'partnership' | 'hedge_fx' | 'monitor_alert';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  dueDate?: string;
  assignee?: string;
  businessRule: string; // which rule generated this action
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface ActionGenerationRule {
  id: string;
  name: string;
  condition: (opportunity: Opportunity) => boolean;
  generateAction: (opportunity: Opportunity) => Omit<Action, 'id' | 'createdAt' | 'updatedAt'>;
}

// Stakeholder types
export interface Stakeholder {
  id: string;
  name: string;
  organization?: string;
  role: string;
  influence: number; // 0-1 scale (x-axis)
  alignment: number; // 0-1 scale (y-axis)
  sector: string[];
  opportunities: string[]; // opportunity IDs
  lastContact?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface StakeholderMapPoint {
  stakeholder: Stakeholder;
  x: number; // influence
  y: number; // alignment
}

// Evidence types
export interface Evidence {
  id: string;
  title: string;
  source: string;
  sourceType: 'report' | 'news' | 'data' | 'expert' | 'internal';
  url?: string;
  excerpt: string;
  confidence: number; // 0-1 scale
  date: string;
  opportunities: string[]; // opportunity IDs
  citations: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

// API response types
export interface OpportunitiesResponse {
  opportunities: Opportunity[];
  totalCount: number;
  filters: LensFilters;
  nextCursor?: string;
}

export interface ActionsResponse {
  actions: Action[];
  totalCount: number;
  opportunityId?: string;
}

export interface StakeholdersResponse {
  stakeholders: Stakeholder[];
  totalCount: number;
  opportunityId?: string;
}

export interface EvidenceResponse {
  evidence: Evidence[];
  totalCount: number;
  opportunityId?: string;
}

// Component prop types
export interface LensBarProps {
  filters: LensFilters;
  onFiltersChange: (filters: LensFilters) => void;
  availableFilters: {
    roles: LensFilterOption[];
    sectors: LensFilterOption[];
    marketLevels: LensFilterOption[];
    functions: LensFilterOption[];
    risks: LensFilterOption[];
    horizons: LensFilterOption[];
  };
}

export interface HorizonLaneProps {
  horizon: TimeHorizon;
  opportunities: Opportunity[];
  actions: Action[];
  selectedOpportunity?: Opportunity | null;
  onOpportunitySelect: (opportunity: Opportunity) => void;
  loading?: boolean;
}

export interface OpportunityRadarProps {
  opportunities: Opportunity[];
  onOpportunityClick: (opportunity: Opportunity) => void;
  selectedId?: string;
}

export interface ActionQueueProps {
  actions: Action[];
  onActionClick?: (action: Action) => void;
  onActionStatusChange?: (actionId: string, status: Action['status']) => void;
}

export interface StakeholderMapProps {
  stakeholders: Stakeholder[];
  selectedStakeholder?: Stakeholder | null;
  onStakeholderClick: (stakeholder: Stakeholder) => void;
  height?: number;
}

export interface EvidencePanelProps {
  evidence: Evidence[];
  opportunityId?: string;
  loading?: boolean;
  onEvidenceClick?: (evidence: Evidence) => void;
}

// WebSocket message types for outcomes dashboard
export interface OutcomesWebSocketMessage {
  type: 'opportunity_update' | 'action_update' | 'stakeholder_update' | 'evidence_update' | 'bulk_update';
  data?: any;
  opportunityId?: string;
  timestamp: string;
}

// Query key factories for React Query
export const outcomesKeys = {
  all: ['outcomes'] as const,
  opportunities: () => [...outcomesKeys.all, 'opportunities'] as const,
  opportunitiesFiltered: (filters: LensFilters) => [...outcomesKeys.opportunities(), JSON.stringify(filters)] as const,
  opportunity: (id: string) => [...outcomesKeys.opportunities(), id] as const,
  actions: () => [...outcomesKeys.all, 'actions'] as const,
  actionsForOpportunity: (opportunityId: string) => [...outcomesKeys.actions(), opportunityId] as const,
  stakeholders: () => [...outcomesKeys.all, 'stakeholders'] as const,
  stakeholdersForOpportunity: (opportunityId: string) => [...outcomesKeys.stakeholders(), opportunityId] as const,
  evidence: () => [...outcomesKeys.all, 'evidence'] as const,
  evidenceForOpportunity: (opportunityId: string) => [...outcomesKeys.evidence(), opportunityId] as const,
} as const;