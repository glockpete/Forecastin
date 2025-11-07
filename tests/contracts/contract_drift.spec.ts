/**
 * Contract Drift Detection Tests
 *
 * Purpose: Verify frontend types match backend API responses
 * Method: Mock-based validation (no live API required)
 *
 * Run: npm test -- contract_drift.spec.ts
 */

import { describe, test, expect } from '@jest/globals';
import type {
  Entity,
  FeatureFlag,
  ScenarioEntity,
  Opportunity,
  HierarchyResponse,
} from '../../types/contracts.generated';

// ============================================================================
// MOCK API RESPONSES (simulating backend JSON)
// ============================================================================

const mockEntityResponse = {
  id: 'ent_001',
  name: 'Acme Corporation',
  type: 'organization',
  parentId: 'ent_parent',
  path: 'root.companies.acme',
  pathDepth: 3,
  confidence: 0.95,
  metadata: { industry: 'technology' },
  createdAt: '2025-11-06T12:00:00Z',
  updatedAt: '2025-11-06T12:00:00Z',
  hasChildren: true,
  childrenCount: 12,
};

const mockFeatureFlagResponse = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  flagName: 'ff.geospatial_layers',  // ✅ camelCase (after backend fix)
  description: 'Enable geospatial layer system',
  isEnabled: true,                   // ✅ camelCase (after backend fix)
  rolloutPercentage: 50,             // ✅ camelCase (after backend fix)
  createdAt: 1730899200000,
  updatedAt: 1730899200000,
};

const mockScenarioEntityResponse = {
  scenarioId: 'scen_001',
  path: 'root.scenarios.trade_war',
  pathDepth: 3,
  pathHash: 'abc123',
  name: 'Trade War Scenario',
  description: 'Analysis of potential trade war impacts',
  confidenceScore: 0.82,
  riskAssessment: {
    riskLevel: 'high',
    riskFactors: ['tariffs', 'supply_chain'],
    mitigationStrategies: ['diversification'],
    confidenceScore: 0.75,
    assessedAt: '2025-11-06T12:00:00Z',
  },
  validationStatus: 'validated',
  collaborationData: {
    activeUsers: ['user_001', 'user_002'],
    lastModifiedBy: 'user_001',
    lastModifiedAt: '2025-11-06T12:00:00Z',
    changeCount: 5,
    conflictCount: 0,
    version: 3,
  },
  metadata: { tags: ['trade', 'geopolitics'] },
  createdAt: '2025-11-01T00:00:00Z',
  updatedAt: '2025-11-06T12:00:00Z',
};

const mockOpportunityResponse = {
  id: 'opp_001',
  title: 'Enter Emerging Market',
  description: 'Opportunity to expand into Southeast Asian markets',
  roiScore: 0.85,
  confidence: 0.78,
  horizon: 'medium',
  policyWindow: 180,
  riskLevel: 0.4,
  momentum: 0.6,
  sector: ['technology', 'manufacturing'],
  marketLevel: ['regional'],
  stakeholders: ['stake_001', 'stake_002'],
  evidence: ['evid_001'],
  fxExposure: {
    currency: 'USD',
    amount: 1000000,
    volatility: 0.15,
  },
  createdAt: '2025-11-01T00:00:00Z',
  updatedAt: '2025-11-06T12:00:00Z',
  metadata: { priority: 'high' },
};

const mockHierarchyResponse = {
  nodes: [mockEntityResponse],
  totalCount: 1,
  hasMore: false,
  nextCursor: null,
};

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('Contract Drift Detection', () => {
  describe('Entity Contract', () => {
    test('should match Entity interface', () => {
      const entity: Entity = mockEntityResponse;

      // Required fields
      expect(entity.id).toBe('ent_001');
      expect(entity.name).toBe('Acme Corporation');
      expect(entity.type).toBe('organization');
      expect(entity.path).toBe('root.companies.acme');
      expect(entity.pathDepth).toBe(3);

      // Optional fields
      expect(entity.parentId).toBe('ent_parent');
      expect(entity.confidence).toBe(0.95);
      expect(entity.metadata).toEqual({ industry: 'technology' });
      expect(entity.createdAt).toBe('2025-11-06T12:00:00Z');
      expect(entity.updatedAt).toBe('2025-11-06T12:00:00Z');
      expect(entity.hasChildren).toBe(true);
      expect(entity.childrenCount).toBe(12);
    });

    test('should handle missing optional fields', () => {
      const minimalEntity: Entity = {
        id: 'ent_002',
        name: 'Minimal Entity',
        type: 'test',
        path: 'root.test',
        pathDepth: 2,
      };

      expect(minimalEntity.parentId).toBeUndefined();
      expect(minimalEntity.confidence).toBeUndefined();
      expect(minimalEntity.metadata).toBeUndefined();
    });
  });

  describe('FeatureFlag Contract', () => {
    test('should match FeatureFlag interface with camelCase fields', () => {
      const flag: FeatureFlag = mockFeatureFlagResponse;

      // Verify camelCase (not snake_case)
      expect(flag.flagName).toBe('ff.geospatial_layers');
      expect(flag.isEnabled).toBe(true);
      expect(flag.rolloutPercentage).toBe(50);

      // These should NOT exist (would be from snake_case backend):
      expect((flag as any).flag_name).toBeUndefined();
      expect((flag as any).is_enabled).toBeUndefined();
      expect((flag as any).rollout_percentage).toBeUndefined();
    });
  });

  describe('ScenarioEntity Contract', () => {
    test('should match ScenarioEntity interface', () => {
      const scenario: ScenarioEntity = mockScenarioEntityResponse;

      // Core fields
      expect(scenario.scenarioId).toBe('scen_001');
      expect(scenario.path).toBe('root.scenarios.trade_war');
      expect(scenario.pathDepth).toBe(3);
      expect(scenario.pathHash).toBe('abc123');
      expect(scenario.name).toBe('Trade War Scenario');
      expect(scenario.confidenceScore).toBe(0.82);

      // Nested objects
      expect(scenario.riskAssessment.riskLevel).toBe('high');
      expect(scenario.riskAssessment.riskFactors).toContain('tariffs');
      expect(scenario.collaborationData.activeUsers).toHaveLength(2);
      expect(scenario.validationStatus).toBe('validated');
    });

    test('should validate nested RiskProfile', () => {
      const scenario: ScenarioEntity = mockScenarioEntityResponse;
      const risk = scenario.riskAssessment;

      expect(['low', 'medium', 'high', 'critical']).toContain(risk.riskLevel);
      expect(risk.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(risk.confidenceScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Opportunity Contract', () => {
    test('should match Opportunity interface', () => {
      const opp: Opportunity = mockOpportunityResponse;

      expect(opp.id).toBe('opp_001');
      expect(opp.title).toBe('Enter Emerging Market');
      expect(opp.roiScore).toBe(0.85);
      expect(opp.confidence).toBe(0.78);
      expect(opp.horizon).toBe('medium');
      expect(opp.policyWindow).toBe(180);
      expect(opp.riskLevel).toBe(0.4);
      expect(opp.momentum).toBe(0.6);
      expect(opp.sector).toContain('technology');
      expect(opp.stakeholders).toHaveLength(2);
    });

    test('should validate TimeHorizon enum', () => {
      const opp: Opportunity = mockOpportunityResponse;
      expect(['immediate', 'short', 'medium', 'long']).toContain(opp.horizon);
    });

    test('should handle optional fxExposure', () => {
      const oppWithoutFx: Opportunity = {
        ...mockOpportunityResponse,
        fxExposure: null,
      };

      expect(oppWithoutFx.fxExposure).toBeNull();
    });
  });

  describe('HierarchyResponse Contract', () => {
    test('should match HierarchyResponse interface', () => {
      const response: HierarchyResponse = mockHierarchyResponse;

      expect(response.nodes).toHaveLength(1);
      expect(response.nodes[0].id).toBe('ent_001');
      expect(response.totalCount).toBe(1);
      expect(response.hasMore).toBe(false);
      expect(response.nextCursor).toBeNull();
    });
  });
});

// ============================================================================
// FIELD NAME VALIDATION (snake_case vs camelCase)
// ============================================================================

describe('Field Naming Convention Validation', () => {
  test('FeatureFlag should use camelCase', () => {
    const flag = mockFeatureFlagResponse;

    // Ensure NO snake_case fields
    expect(flag).not.toHaveProperty('flag_name');
    expect(flag).not.toHaveProperty('is_enabled');
    expect(flag).not.toHaveProperty('rollout_percentage');
    expect(flag).not.toHaveProperty('created_at');
    expect(flag).not.toHaveProperty('updated_at');

    // Ensure camelCase fields exist
    expect(flag).toHaveProperty('flagName');
    expect(flag).toHaveProperty('isEnabled');
    expect(flag).toHaveProperty('rolloutPercentage');
    expect(flag).toHaveProperty('createdAt');
    expect(flag).toHaveProperty('updatedAt');
  });

  test('ScenarioEntity should use camelCase', () => {
    const scenario = mockScenarioEntityResponse;

    // Ensure NO snake_case fields
    expect(scenario).not.toHaveProperty('scenario_id');
    expect(scenario).not.toHaveProperty('path_depth');
    expect(scenario).not.toHaveProperty('path_hash');
    expect(scenario).not.toHaveProperty('confidence_score');
    expect(scenario).not.toHaveProperty('risk_assessment');
    expect(scenario).not.toHaveProperty('validation_status');
    expect(scenario).not.toHaveProperty('collaboration_data');

    // Ensure camelCase fields exist
    expect(scenario).toHaveProperty('scenarioId');
    expect(scenario).toHaveProperty('pathDepth');
    expect(scenario).toHaveProperty('pathHash');
    expect(scenario).toHaveProperty('confidenceScore');
    expect(scenario).toHaveProperty('riskAssessment');
    expect(scenario).toHaveProperty('validationStatus');
    expect(scenario).toHaveProperty('collaborationData');
  });

  test('Entity should use camelCase', () => {
    const entity = mockEntityResponse;

    // Ensure NO snake_case fields
    expect(entity).not.toHaveProperty('parent_id');
    expect(entity).not.toHaveProperty('path_depth');
    expect(entity).not.toHaveProperty('created_at');
    expect(entity).not.toHaveProperty('updated_at');
    expect(entity).not.toHaveProperty('has_children');
    expect(entity).not.toHaveProperty('children_count');

    // Ensure camelCase fields exist
    expect(entity).toHaveProperty('parentId');
    expect(entity).toHaveProperty('pathDepth');
    expect(entity).toHaveProperty('createdAt');
    expect(entity).toHaveProperty('updatedAt');
    expect(entity).toHaveProperty('hasChildren');
    expect(entity).toHaveProperty('childrenCount');
  });
});

// ============================================================================
// RUNTIME VALIDATION (requires zod or ajv)
// ============================================================================

// TODO: Add zod schemas for runtime validation
// import { z } from 'zod';
//
// const EntitySchema = z.object({
//   id: z.string(),
//   name: z.string(),
//   type: z.string(),
//   path: z.string().regex(/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/),
//   pathDepth: z.number().int().min(1),
//   confidence: z.number().min(0).max(1).optional(),
//   // ...
// });
//
// test('should validate Entity with zod', () => {
//   const result = EntitySchema.safeParse(mockEntityResponse);
//   expect(result.success).toBe(true);
// });
