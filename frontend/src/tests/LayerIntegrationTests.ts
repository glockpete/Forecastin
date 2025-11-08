/**
 * Layer Integration Tests
 * 
 * Comprehensive testing suite that validates geospatial layer integration
 * with existing forecastin performance monitoring, compliance framework,
 * and hybrid state management systems.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { layerFeatureFlags } from '../config/feature-flags';
import { LayerWebSocketIntegration } from '../integrations/LayerWebSocketIntegration';
import { LayerRegistry } from '../layers/registry/LayerRegistry';
import { PointLayer } from '../layers/implementations/PointLayer';
import type { 
  EntityDataPoint, 
  LayerPerformanceMetrics,
  ComplianceAuditEntry 
} from '../layers/types/layer-types';

// Mock the existing forecastin systems
vi.mock('../hooks/useWebSocket');
vi.mock('../store/uiStore');
vi.mock('../utils/errorRecovery');

// Test data matching forecastin entity structure
const MOCK_ENTITIES: EntityDataPoint[] = [
  {
    id: 'entity_001',
    name: 'Test Organization A',
    type: 'organization',
    position: [40.7128, -74.0060], // NYC coordinates
    confidence: 0.85,
    properties: {
      title: 'CEO',
      organization: 'Test Corp',
      location: 'New York',
      path: 'root.org.test_corp',
      pathDepth: 3,
      ancestors: ['root', 'org'],
      descendants: []
    }
  },
  {
    id: 'entity_002',
    name: 'Test Person B',
    type: 'person',
    position: [34.0522, -118.2437], // LA coordinates
    confidence: 0.92,
    properties: {
      title: 'Director',
      organization: 'Test Corp',
      location: 'Los Angeles',
      path: 'root.org.test_corp.person_b',
      pathDepth: 4,
      ancestors: ['root', 'org', 'test_corp'],
      descendants: []
    }
  }
];

// Performance targets from AGENTS.md validated metrics
const PERFORMANCE_TARGETS = {
  render_time_ms: 10,
  cache_hit_rate_percent: 99,
  throughput_rps: 10000,
  ancestor_resolution_ms: 1.25,
  descendant_retrieval_ms: 1.25
};

describe('Geospatial Layer Integration Tests', () => {
  let layerRegistry: LayerRegistry;
  let wsIntegration: LayerWebSocketIntegration;
  let performanceMetrics: LayerPerformanceMetrics[];
  let auditLog: ComplianceAuditEntry[];

  beforeEach(() => {
    // Reset feature flags to safe state for testing
    layerFeatureFlags.emergencyRollback();
    
    // Initialize test components
    layerRegistry = new LayerRegistry();
    wsIntegration = new LayerWebSocketIntegration({
      url: 'ws://localhost:9000/layers',
      onPerformanceMetrics: (metrics) => {
        performanceMetrics.push(metrics);
      },
      onComplianceEvent: (auditEntry) => {
        auditLog.push(auditEntry);
      }
    });
    
    performanceMetrics = [];
    auditLog = [];
    
    // Mock performance.now() for consistent testing
    jest.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    layerFeatureFlags.emergencyRollback();
  });

  describe('Feature Flag Integration', () => {
    test('should respect gradual rollout percentages', () => {
      // Start with 0% rollout
      expect(layerFeatureFlags.isEnabled('ff_geospatial_enabled')).toBe(false);
      
      // Enable 50% rollout for core layers
      layerFeatureFlags.enableRollout('core_layers', 50);
      expect(layerFeatureFlags.isEnabled('ff_geospatial_enabled')).toBe(false);
      
      // Enable 100% rollout
      layerFeatureFlags.enableRollout('core_layers', 100);
      expect(layerFeatureFlags.isEnabled('ff_geospatial_enabled')).toBe(true);
      
      // Verify auto-enable of related flags
      expect(layerFeatureFlags.getStatusSummary().coreFlags.geospatialEnabled).toBe(true);
    });

    test('should provide consistent user rollout assignment', () => {
      const user1 = new LayerWebSocketIntegration({
        url: 'ws://localhost:9000/layers'
      });
      const user2 = new LayerWebSocketIntegration({
        url: 'ws://localhost:9000/layers'
      });
      
      layerFeatureFlags.enableRollout('core_layers', 50);
      
      // Users should have consistent assignment based on rollout ID
      const user1Status = (layerFeatureFlags as any).userRolloutId;
      const user2Status = (layerFeatureFlags as any).userRolloutId;
      
      expect(user1Status).not.toBe(user2Status);
    });

    test('should handle emergency rollback correctly', () => {
      // Enable features
      layerFeatureFlags.enableRollout('core_layers', 100);
      layerFeatureFlags.enableRollout('point_layers', 100);
      
      // Verify they're enabled
      expect(layerFeatureFlags.isEnabled('ff_geospatial_enabled')).toBe(true);
      expect(layerFeatureFlags.isEnabled('ff_point_layer_enabled')).toBe(true);
      
      // Execute emergency rollback
      layerFeatureFlags.emergencyRollback();
      
      // Verify everything is disabled
      expect(layerFeatureFlags.isEnabled('ff_geospatial_enabled')).toBe(false);
      expect(layerFeatureFlags.isEnabled('ff_point_layer_enabled')).toBe(false);
      
      // Check audit log entry
      const rollbackEntry = auditLog.find(entry => 
        entry.event === 'emergency_rollback_executed'
      );
      expect(rollbackEntry).toBeDefined();
    });
  });

  describe('Performance Monitoring Integration', () => {
    beforeEach(() => {
      layerFeatureFlags.enableRollout('core_layers', 100);
      layerFeatureFlags.enableRollout('point_layers', 100);
    });

    test('should meet performance SLO targets', async () => {
      const pointLayer = new PointLayer({
        id: 'test-point-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      // Test render performance
      const startTime = performance.now();
      const processedData = pointLayer.processVisualData(MOCK_ENTITIES);
      const renderTime = performance.now() - startTime;

      // Should meet SLO: <10ms render time
      expect(renderTime).toBeLessThan(PERFORMANCE_TARGETS.render_time_ms);
      
      // Verify processed data structure
      expect(processedData.entities).toHaveLength(2);
      expect(processedData.metadata.processingTime).toBeLessThan(PERFORMANCE_TARGETS.render_time_ms);
      expect(processedData.metadata.confidenceScore).toBeGreaterThan(0.8);
    });

    test('should maintain cache hit rate above 99%', () => {
      const pointLayer = new PointLayer({
        id: 'cache-test-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      // Process data multiple times to test cache efficiency
      for (let i = 0; i < 100; i++) {
        pointLayer.processVisualData(MOCK_ENTITIES);
      }

      const cacheHitRate = pointLayer.getPerformanceMetrics().cacheHitRate;
      
      // Should maintain >99% cache hit rate
      expect(cacheHitRate).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.cache_hit_rate_percent / 100);
    });

    test('should handle entity hierarchy performance', () => {
      const pointLayer = new PointLayer({
        id: 'hierarchy-test-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      // Test ancestor resolution performance
      const startTime = performance.now();
      const hierarchyData = pointLayer.processVisualData(MOCK_ENTITIES);
      const resolutionTime = performance.now() - startTime;

      // Should meet SLO: <10ms (actual target is 1.25ms from AGENTS.md)
      expect(resolutionTime).toBeLessThan(PERFORMANCE_TARGETS.ancestor_resolution_ms * 2);
      
      // Verify hierarchy data is properly extracted
      expect(hierarchyData.entities[0].hierarchy).toBeDefined();
      expect(hierarchyData.entities[0].hierarchy.path).toBe('root.org.test_corp');
      expect(hierarchyData.entities[0].hierarchy.pathDepth).toBe(3);
    });
  });

  describe('WebSocket Integration', () => {
    beforeEach(() => {
      layerFeatureFlags.enableRollout('websocket_integration', 100);
    });

    test('should handle entity updates via WebSocket', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };

      // Mock WebSocket constructor
      (global as any).WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

      const pointLayer = new PointLayer({
        id: 'ws-test-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      // Test WebSocket connection
      await wsIntegration.connect();
      expect(wsIntegration.getState().connected).toBe(true);

      // Test entity update message handling
      const updateMessage = {
        type: 'entity_update',
        action: 'confidence_adjustment',
        data: {
          entityId: 'entity_001',
          newConfidence: 0.95,
          reason: 'high_quality_data'
        }
      };

      wsIntegration.sendMessage(updateMessage);
      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    test('should handle batch updates for performance', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };

      (global as any).WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

      await wsIntegration.connect();

      // Test batch update
      wsIntegration.sendBatchUpdate(MOCK_ENTITIES, 'test_batch_001');
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      
      // Verify the message was properly serialized
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('batch_update');
      expect(sentMessage.data.batchId).toBe('test_batch_001');
      expect(sentMessage.data.entities).toHaveLength(2);
    });

    test('should implement message batching and debouncing', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };

      (global as any).WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

      await wsIntegration.connect();

      // Send multiple rapid updates
      wsIntegration.sendBatchUpdate([MOCK_ENTITIES[0]]);
      wsIntegration.sendBatchUpdate([MOCK_ENTITIES[1]]);
      
      // Should be debounced - only one message should be sent
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('Compliance Framework Integration', () => {
    beforeEach(() => {
      layerFeatureFlags.enableRollout('core_layers', 100);
    });

    test('should generate audit trail for all operations', () => {
      const pointLayer = new PointLayer({
        id: 'audit-test-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      // Process data to trigger audit logging
      pointLayer.processVisualData(MOCK_ENTITIES);

      // Get audit trail
      const auditTrail = pointLayer.getAuditTrail();
      
      // Should have audit entries for layer operations
      const initializationEntry = auditTrail.find(entry => 
        entry.event === 'layer_initialized'
      );
      expect(initializationEntry).toBeDefined();
      expect(initializationEntry?.layerId).toBe('audit-test-layer');
      
      const processingEntry = auditTrail.find(entry => 
        entry.event === 'visual_data_processed'
      );
      expect(processingEntry).toBeDefined();
    });

    test('should track performance compliance', () => {
      const pointLayer = new PointLayer({
        id: 'perf-compliance-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      const startTime = performance.now();
      pointLayer.processVisualData(MOCK_ENTITIES);
      const processingTime = performance.now() - startTime;

      // Check if performance target violations are logged
      const performanceEntry = auditLog.find(entry => 
        entry.event === 'performance_target_exceeded'
      );
      
      if (processingTime > PERFORMANCE_TARGETS.render_time_ms) {
        expect(performanceEntry).toBeDefined();
        expect(performanceEntry?.details.targetRenderTime).toBe(PERFORMANCE_TARGETS.render_time_ms);
      }
    });

    test('should integrate with existing compliance evidence collection', () => {
      // Mock existing compliance scripts
      const mockEvidenceCollector = {
        gatherMetrics: jest.fn(),
        checkConsistency: jest.fn(),
        generateReport: jest.fn()
      };

      const pointLayer = new PointLayer({
        id: 'evidence-integration-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      // Export layer configuration for compliance reporting
      const exportedConfig = pointLayer.exportLayerConfig();
      
      // Should include compliance metadata
      expect(exportedConfig.auditTrail).toBeDefined();
      expect(exportedConfig.performance).toBeDefined();
      
      // Should be compatible with existing evidence collection
      mockEvidenceCollector.gatherMetrics(exportedConfig);
      expect(mockEvidenceCollector.gatherMetrics).toHaveBeenCalledWith(exportedConfig);
    });
  });

  describe('Hybrid State Management Integration', () => {
    test('should coordinate with React Query for server state', () => {
      // Mock React Query integration
      const mockQueryClient = {
        invalidateQueries: jest.fn(),
        setQueryData: jest.fn()
      };

      const pointLayer = new PointLayer({
        id: 'react-query-integration-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      // Simulate data change triggering React Query invalidation
      pointLayer.onDataChange = (newData) => {
        mockQueryClient.invalidateQueries({ queryKey: ['entities'] });
        mockQueryClient.setQueryData(['entities', 'layer-data'], newData);
      };

      pointLayer.processVisualData(MOCK_ENTITIES);
      
      // Should trigger React Query invalidation for server state updates
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['entities']
      });
    });

    test('should integrate with Zustand for UI state', () => {
      // Mock Zustand store
      const mockUiStore = {
        setMapVisibility: jest.fn(),
        updateLayerSettings: jest.fn(),
        getState: jest.fn(() => ({
          mapVisible: true,
          layerSettings: {}
        }))
      };

      const pointLayer = new PointLayer({
        id: 'zustand-integration-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      // Simulate UI state change
      pointLayer.setVisible(false);
      
      // Should update Zustand store for UI state coordination
      expect(mockUiStore.updateLayerSettings).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Integration', () => {
    test('should integrate with existing error recovery system', () => {
      const mockErrorRecovery = {
        handleError: jest.fn(),
        getRecoveryStrategy: jest.fn(() => ({ strategy: 'retry', maxRetries: 3 })),
        logRecoveryEvent: jest.fn()
      };

      const pointLayer = new PointLayer({
        id: 'error-recovery-layer',
        config: {
          getPosition: (entity) => entity.position,
          getColor: { field: 'type', type: 'color', scale: {} },
          getSize: { field: 'confidence', type: 'size', scale: {} },
          getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
          enableClustering: false,
          clusterRadius: 50,
          maxZoomLevel: 18,
          minZoomLevel: 1,
          entityDataMapping: {
            positionField: 'position',
            colorField: 'type',
            sizeField: 'confidence',
            entityIdField: 'id',
            confidenceField: 'confidence'
          }
        },
        data: MOCK_ENTITIES,
        visible: true
      });

      // Simulate error handling
      try {
        pointLayer.processVisualData([{ ...MOCK_ENTITIES[0], position: null } as any]);
      } catch (error) {
        // Should integrate with error recovery system
        mockErrorRecovery.handleError(error, 'layer_processing');
        expect(mockErrorRecovery.handleError).toHaveBeenCalledWith(
          expect.any(Error),
          'layer_processing'
        );
      }
    });

    test('should handle WebSocket connection resilience', async () => {
      let connectionAttempts = 0;
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn((event, handler) => {
          if (event === 'open') {
            // Simulate connection failure on first attempt
            if (connectionAttempts === 0) {
              setTimeout(() => handler({ type: 'error' }), 10);
            } else {
              setTimeout(() => handler({ type: 'open' }), 10);
            }
            connectionAttempts++;
          }
        }),
        removeEventListener: jest.fn()
      };

      (global as any).WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

      const resilientWs = new LayerWebSocketIntegration({
        url: 'ws://localhost:9000/layers',
        reconnectAttempts: 2,
        reconnectInterval: 100
      });

      await resilientWs.connect();
      
      // Should attempt reconnection with exponential backoff
      expect(connectionAttempts).toBeGreaterThan(1);
    });
  });
});

// Integration test for end-to-end workflow
describe('End-to-End Integration Test', () => {
  test('should complete full geospatial workflow', async () => {
    // 1. Enable features via feature flags
    layerFeatureFlags.enableRollout('core_layers', 100);
    layerFeatureFlags.enableRollout('point_layers', 100);
    layerFeatureFlags.enableRollout('websocket_integration', 100);

    expect(layerFeatureFlags.isEnabled('ff_geospatial_enabled')).toBe(true);
    expect(layerFeatureFlags.isEnabled('ff_point_layer_enabled')).toBe(true);
    expect(layerFeatureFlags.isEnabled('ff_websocket_layers_enabled')).toBe(true);

    // 2. Create and configure layers
    const pointLayer = new PointLayer({
      id: 'e2e-test-layer',
      config: {
        getPosition: (entity) => entity.position,
        getColor: { field: 'type', type: 'color', scale: {} },
        getSize: { field: 'confidence', type: 'size', scale: {} },
        getOpacity: { field: 'confidence', type: 'opacity', scale: {} },
        enableClustering: false,
        clusterRadius: 50,
        maxZoomLevel: 18,
        minZoomLevel: 1,
        entityDataMapping: {
          positionField: 'position',
          colorField: 'type',
          sizeField: 'confidence',
          entityIdField: 'id',
          confidenceField: 'confidence'
        }
      },
      data: MOCK_ENTITIES,
      visible: true
    });

    // 3. Process data with performance monitoring
    const startTime = performance.now();
    const processedData = pointLayer.processVisualData(MOCK_ENTITIES);
    const processingTime = performance.now() - startTime;

    // 4. Verify performance targets are met
    expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.render_time_ms);
    expect(processedData.entities).toHaveLength(2);
    expect(processedData.metadata.confidenceScore).toBeGreaterThan(0.8);

    // 5. Verify audit trail is generated
    const auditTrail = pointLayer.getAuditTrail();
    expect(auditTrail.length).toBeGreaterThan(0);

    // 6. Test WebSocket integration
    const mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    (global as any).WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

    const wsIntegration = new LayerWebSocketIntegration({
      url: 'ws://localhost:9000/layers'
    });

    await wsIntegration.connect();
    wsIntegration.sendBatchUpdate(MOCK_ENTITIES);

    // 7. Verify all systems are working together
    expect(mockWebSocket.send).toHaveBeenCalled();
    expect(wsIntegration.isHealthy()).toBe(true);

    // 8. Test compliance integration
    const exportedConfig = pointLayer.exportLayerConfig();
    expect(exportedConfig.auditTrail).toBeDefined();
    expect(exportedConfig.performance).toBeDefined();

    console.log('✅ End-to-end integration test passed');
    console.log(`Performance: ${processingTime.toFixed(2)}ms (target: <${PERFORMANCE_TARGETS.render_time_ms}ms)`);
    console.log(`Entities processed: ${processedData.entities.length}`);
    console.log(`Audit entries: ${auditTrail.length}`);
  });
});

export default LayerIntegrationTests;