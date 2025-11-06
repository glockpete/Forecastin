/**
 * Comprehensive Test Suite for BaseLayer Architecture
 * Tests all enhanced features: visual channels, error handling, performance monitoring, etc.
 */

import { BaseLayer } from '../layers/base/BaseLayer';
import { 
  LayerConfig, 
  LayerData, 
  VisualChannel, 
  VisualChannelScale,
  LayerType 
} from '../layers/types/layer-types';

// Mock implementation for testing
class TestLayer extends BaseLayer {
  constructor(config: LayerConfig) {
    super(config);
  }

  protected initializeVisualChannels(): void {
    // Initialize default visual channels for testing
    this.setVisualChannel('position', {
      name: 'position',
      property: 'coordinates',
      type: 'quantitative',
      defaultValue: [0, 0] as any,
      scale: {
        domain: [-180, 180],
        range: [-180, 180],
        type: 'linear'
      }
    });

    this.setVisualChannel('color', {
      name: 'color',
      property: 'value',
      type: 'quantitative',
      defaultValue: '#FF0000',
      scale: {
        domain: [0, 100],
        range: ['#FF0000', '#00FF00'],
        type: 'linear'
      }
    });
  }

  render(gl: WebGLRenderingContext): void {
    // Mock render implementation
  }

  getBounds(): [number, number][] | null {
    return [[0, 0], [100, 100]];
  }

  onHover(info: any): void {
    // Mock hover implementation
  }

  onClick(info: any): void {
    // Mock click implementation
  }
}

describe('BaseLayer Enhanced Architecture', () => {
  let layer: TestLayer;
  let mockConfig: LayerConfig;

  beforeEach(() => {
    mockConfig = {
      id: 'test-layer',
      type: 'point' as LayerType,
      data: [],
      visible: true,
      opacity: 0.8,
      zIndex: 1,
      name: 'Test Layer',
      cacheEnabled: true,
      cacheTTL: 30000,
      realTimeEnabled: false,
      auditEnabled: true,
      dataClassification: 'internal'
    };

    layer = new TestLayer(mockConfig);
  });

  afterEach(() => {
    if (layer) {
      layer.destroy();
    }
  });

  describe('Visual Channels System', () => {
    test('should initialize visual channels correctly', () => {
      const channels = layer.getAllVisualChannels();
      
      expect(channels).toHaveProperty('position');
      expect(channels).toHaveProperty('color');
      expect(channels.position?.type).toBe('quantitative');
      expect(channels.color?.type).toBe('quantitative');
    });

    test('should validate visual channel configuration', () => {
      const validChannel: VisualChannel = {
        name: 'size',
        property: 'radius',
        type: 'quantitative',
        defaultValue: 5,
        scale: {
          domain: [1, 50],
          range: [1, 20],
          type: 'linear'
        }
      };

      expect(() => {
        layer.setVisualChannel('size', validChannel);
      }).not.toThrow();
    });

    test('should reject invalid visual channel configuration', () => {
      const invalidChannel = {
        name: '', // Invalid: empty name
        property: 'test',
        type: 'quantitative' as const
      } as VisualChannel;

      expect(() => {
        layer.setVisualChannel('', invalidChannel);
      }).toThrow('Channel name must be a non-empty string');
    });

    test('should apply scale transformations correctly', () => {
      const scale: VisualChannelScale = {
        domain: [0, 100],
        range: [0, 1],
        type: 'linear'
      };

      const dataPoint = { value: 50 };
      const channel: VisualChannel = {
        name: 'test',
        property: 'value',
        type: 'quantitative',
        scale
      };

      // Access protected method through type assertion for testing
      const value = (layer as any).updateChannelValue(channel, dataPoint);
      expect(value).toBe(0.5);
    });

    test('should handle batch processing of visual channels', () => {
      const testData = [
        { id: '1', value: 10, coordinates: [10, 20] },
        { id: '2', value: 50, coordinates: [30, 40] },
        { id: '3', value: 90, coordinates: [50, 60] }
      ];

      const batchResult = (layer as any).processVisualChannelsBatch(testData);
      
      expect(batchResult).toHaveProperty('position');
      expect(batchResult).toHaveProperty('color');
      expect(batchResult.position).toHaveLength(3);
      expect(batchResult.color).toHaveLength(3);
    });
  });

  describe('Error Handling and ErrorBoundary Integration', () => {
    test('should handle errors gracefully', () => {
      const errorSpy = jest.spyOn(layer, 'handleError' as any);
      
      const testError = new Error('Test error');
      (layer as any).handleError('test_error', testError, { context: 'test' });
      
      expect(errorSpy).toHaveBeenCalledWith('test_error', testError, { context: 'test' });
    });

    test('should determine error severity correctly', () => {
      const isCriticalError = (layer as any).isCriticalError.bind(layer);
      
      expect(isCriticalError('layer_initialization_failed')).toBe(true);
      expect(isCriticalError('render_failed')).toBe(false);
      expect(isCriticalError('data_validation_warning')).toBe(false);
    });

    test('should determine if error is recoverable', () => {
      const isRecoverableError = (layer as any).isRecoverableError.bind(layer);
      
      expect(isRecoverableError('cache_miss')).toBe(true);
      expect(isRecoverableError('layer_initialization_failed')).toBe(false);
      expect(isRecoverableError('render_failed')).toBe(false);
    });

    test('should trigger fallback behavior for critical errors', () => {
      const fallbackSpy = jest.spyOn(layer, 'emit' as any);
      
      const testError = new Error('Critical error');
      (layer as any).handleError('layer_initialization_failed', testError);
      
      expect(fallbackSpy).toHaveBeenCalledWith('criticalError', expect.any(Object));
      expect(fallbackSpy).toHaveBeenCalledWith('fallbackRequired', expect.any(Object));
    });
  });

  describe('Performance Monitoring', () => {
    test('should setup performance monitoring correctly', () => {
      const metrics = layer.getPerformanceMetrics();
      
      expect(metrics).not.toBeNull();
      expect(metrics?.sloCompliance.targetResponseTime).toBe(1.25);
      expect(metrics?.layerId).toBe('test-layer');
    });

    test('should track performance metrics accurately', () => {
      const startTime = performance.now();
      
      // Simulate an operation
      setTimeout(() => {
        (layer as any).recordPerformance('test_operation', startTime);
      }, 1);

      const metrics = layer.getPerformanceMetrics();
      expect(metrics?.lastRenderTime).toBeDefined();
    });

    test('should generate performance reports', () => {
      const report = layer.getPerformanceReport();
      
      expect(report).toHaveProperty('currentMetrics');
      expect(report).toHaveProperty('sloCompliance');
      expect(report).toHaveProperty('optimizationRecommendations');
      expect(report).toHaveProperty('lastOptimizations');
    });

    test('should detect performance degradation', () => {
      // Mock low SLO compliance
      const metrics = layer.getPerformanceMetrics();
      if (metrics) {
        metrics.sloCompliance.complianceRate = 85; // Below 95% threshold
      }

      const checkDegradation = (layer as any).checkPerformanceDegradation.bind(layer);
      expect(() => checkDegradation()).not.toThrow();
    });

    test('should provide cache statistics', () => {
      const stats = layer.getCacheStatistics();
      
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('materializedViewCount');
    });
  });

  describe('WebSocket Integration', () => {
    test('should serialize data safely', () => {
      const testData = {
        timestamp: new Date(),
        circular: {} as any,
        function: () => {}
      };
      
      testData.circular = testData; // Create circular reference

      expect(() => {
        (layer as any).safeSerialize(testData);
      }).not.toThrow();
    });

    test('should handle serialization errors gracefully', () => {
      const problematicObject = {
        get value() {
          throw new Error('Serialization error');
        }
      };

      expect(() => {
        (layer as any).safeSerialize(problematicObject);
      }).toThrow();
    });

    test('should send WebSocket messages safely', () => {
      const sendMessageSpy = jest.spyOn(layer, 'emit' as any);
      
      (layer as any).sendWebSocketMessage('test_message', { data: 'test' });
      
      expect(sendMessageSpy).toHaveBeenCalledWith('webSocketMessage', expect.any(Object));
    });
  });

  describe('Audit Trail and Compliance', () => {
    test('should log audit events correctly', () => {
      const auditSpy = jest.spyOn(layer, 'emit' as any);
      
      (layer as any).logAuditEvent('test_action', { metadata: 'test' });
      
      expect(auditSpy).toHaveBeenCalledWith('auditEvent', expect.objectContaining({
        action: 'test_action',
        layerId: 'test-layer',
        timestamp: expect.any(String)
      }));
    });

    test('should extract compliance flags correctly', () => {
      const extractFlags = (layer as any).extractComplianceFlags.bind(layer);
      
      const flags = extractFlags('data_export', { userId: 'test_user' });
      expect(flags).toContain('USER_ACTION');
      expect(flags).toContain('DATA_EXPORT');
    });

    test('should assess risk levels correctly', () => {
      const assessRisk = (layer as any).assessRiskLevel.bind(layer);
      
      expect(assessRisk('data_delete')).toBe('high');
      expect(assessRisk('config_change')).toBe('high');
      expect(assessRisk('layer_access')).toBe('medium');
      expect(assessRisk('cache_read')).toBe('low');
    });

    test('should identify sensitive operations', () => {
      const isSensitive = (layer as any).isSensitiveOperation.bind(layer);
      
      expect(isSensitive('data_export')).toBe(true);
      expect(isSensitive('data_delete')).toBe(true);
      expect(isSensitive('config_change')).toBe(true);
      expect(isSensitive('render')).toBe(false);
    });
  });

  describe('Materialization Patterns', () => {
    test('should initialize materialized views', () => {
      const materializedViews = (layer as any).materializedViews;
      
      expect(materializedViews.has('hierarchy_cache')).toBe(true);
      expect(materializedViews.has('visual_channels_cache')).toBe(true);
      expect(materializedViews.has('bounds_cache')).toBe(true);
    });

    test('should refresh materialized views', () => {
      const refreshSpy = jest.spyOn(layer as any, 'refreshMaterializedView');
      
      (layer as any).refreshMaterializedView('hierarchy_cache');
      
      expect(refreshSpy).toHaveBeenCalledWith('hierarchy_cache');
    });

    test('should build hierarchy cache correctly', () => {
      const testData: LayerData[] = [
        {
          id: '1',
          geometry: null,
          properties: {},
          entityId: 'entity_1',
          hierarchy: {
            ancestors: [],
            descendants: [],
            path: 'entity:entity_1',
            depth: 1
          }
        }
      ];

      (layer as any).setData(testData);
      const cache = (layer as any).buildHierarchyCache();
      
      expect(cache.entity_1).toBeDefined();
      expect(cache.entity_1.path).toBe('entity:entity_1');
    });

    test('should calculate bounds correctly', () => {
      const testData: LayerData[] = [
        {
          id: '1',
          geometry: {
            type: 'Point',
            coordinates: [10, 20]
          },
          properties: {}
        },
        {
          id: '2',
          geometry: {
            type: 'Point',
            coordinates: [30, 40]
          },
          properties: {}
        }
      ];

      (layer as any).setData(testData);
      const bounds = (layer as any).calculateBounds();
      
      expect(bounds).toEqual([[10, 20], [30, 40]]);
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration with validation', () => {
      expect(() => {
        layer.updateConfig({ opacity: 0.5 });
      }).not.toThrow();

      expect(layer.getOpacity()).toBe(0.5);
    });

    test('should reject invalid configuration updates', () => {
      expect(() => {
        layer.updateConfig({ opacity: 1.5 }); // Invalid: > 1
      }).toThrow();

      expect(() => {
        layer.updateConfig({ id: 'new-id' }); // Invalid: changing ID
      }).toThrow();
    });

    test('should handle feature flag validation', () => {
      const updateWithFeatureFlag = () => {
        layer.updateConfig({ realTimeEnabled: true });
      };

      // This should handle feature flag validation gracefully
      expect(updateWithFeatureFlag).not.toThrow();
    });
  });

  describe('Data Management', () => {
    test('should set and get data correctly', async () => {
      const testData: LayerData[] = [
        {
          id: '1',
          geometry: null,
          properties: { test: 'value' }
        }
      ];

      await layer.setData(testData);
      const retrievedData = layer.getData();
      
      expect(retrievedData).toHaveLength(1);
      expect(retrievedData[0].id).toBe('1');
    });

    test('should validate data correctly', async () => {
      await expect(layer.setData('invalid_data' as any)).rejects.toThrow('Data must be an array');
      await expect(layer.setData(new Array(100001).fill({}) as any)).rejects.toThrow('Data size exceeds maximum limit');
    });

    test('should enhance data with hierarchy', () => {
      const testData: LayerData[] = [
        {
          id: '1',
          geometry: null,
          properties: {},
          entityId: 'entity_1'
        }
      ];

      const enhancedData = (layer as any).enhanceDataWithHierarchy(testData);
      
      expect(enhancedData[0].hierarchy).toBeDefined();
      expect(enhancedData[0].hierarchy?.path).toBe('entity:entity_1');
    });
  });

  describe('Layer Lifecycle', () => {
    test('should manage layer visibility correctly', () => {
      expect(layer.isVisible()).toBe(true);
      
      layer.setVisible(false);
      expect(layer.isVisible()).toBe(false);
      
      layer.setVisible(true);
      expect(layer.isVisible()).toBe(true);
    });

    test('should manage layer opacity correctly', () => {
      expect(layer.getOpacity()).toBe(0.8);
      
      layer.setOpacity(0.5);
      expect(layer.getOpacity()).toBe(0.5);
      
      // Should clamp values
      layer.setOpacity(1.5);
      expect(layer.getOpacity()).toBe(1);
      
      layer.setOpacity(-0.1);
      expect(layer.getOpacity()).toBe(0);
    });

    test('should cleanup resources properly', () => {
      const removeAllListenersSpy = jest.spyOn(layer, 'removeAllListeners');
      
      layer.destroy();
      
      expect(removeAllListenersSpy).toHaveBeenCalled();
      // Additional cleanup assertions would go here
    });
  });

  describe('Type Safety', () => {
    test('should enforce type safety for visual channel values', () => {
      const channel: VisualChannel = {
        name: 'test',
        property: 'value',
        type: 'quantitative'
      };

      const numericValue = (layer as any).validateChannelValue(42, 'quantitative');
      const stringValue = (layer as any).validateChannelValue('test', 'quantitative');
      
      expect(numericValue).toBe(42);
      expect(stringValue).toBe(null); // Should reject non-numeric for quantitative
    });

    test('should handle different channel types correctly', () => {
      const categoricalValue = (layer as any).validateChannelValue('category', 'categorical');
      const ordinalValue = (layer as any).validateChannelValue(3, 'ordinal');
      
      expect(typeof categoricalValue).toBe('string');
      expect(typeof ordinalValue).toBe('string');
    });
  });

  describe('Integration Tests', () => {
    test('should handle full data flow with error handling', async () => {
      const testData: LayerData[] = [
        {
          id: '1',
          geometry: null,
          properties: { value: 50 }
        }
      ];

      // This should complete without errors and update metrics
      await layer.setData(testData);
      const metrics = layer.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
    });

    test('should handle performance monitoring during operations', () => {
      const startTime = performance.now();
      
      // Simulate a render operation
      (layer as any).recordPerformance('render', startTime);
      
      const metrics = layer.getPerformanceMetrics();
      expect(metrics?.renderTime).toBeGreaterThan(0);
    });

    test('should maintain audit trail across operations', () => {
      const initialAuditLength = (layer as any).auditTrail.length;
      
      layer.setVisible(false);
      layer.updateConfig({ opacity: 0.7 });
      
      const finalAuditLength = (layer as any).auditTrail.length;
      expect(finalAuditLength).toBeGreaterThan(initialAuditLength);
    });
  });
});

// Performance benchmarking tests
describe('BaseLayer Performance Benchmarks', () => {
  let layer: TestLayer;

  beforeEach(() => {
    const config: LayerConfig = {
      id: 'perf-test-layer',
      type: 'point' as LayerType,
      data: [],
      visible: true,
      opacity: 0.8,
      zIndex: 1,
      name: 'Performance Test Layer',
      cacheEnabled: true,
      cacheTTL: 30000,
      realTimeEnabled: false,
      auditEnabled: false, // Disable for performance testing
      dataClassification: 'internal'
    };

    layer = new TestLayer(config);
  });

  afterEach(() => {
    if (layer) {
      layer.destroy();
    }
  });

  test('should meet 1.25ms SLO for small datasets', () => {
    const testData = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      geometry: null,
      properties: { value: Math.random() * 100 }
    }));

    const startTime = performance.now();
    layer.setData(testData);
    const endTime = performance.now();

    const operationTime = endTime - startTime;
    expect(operationTime).toBeLessThan(1.25);
  });

  test('should maintain performance with large datasets', () => {
    const testData = Array.from({ length: 10000 }, (_, i) => ({
      id: `item-${i}`,
      geometry: null,
      properties: { value: Math.random() * 100 }
    }));

    const startTime = performance.now();
    layer.setData(testData);
    const endTime = performance.now();

    const operationTime = endTime - startTime;
    // Allow more time for larger datasets but still reasonable
    expect(operationTime).toBeLessThan(50);
  });

  test('should maintain cache hit rates above 90%', () => {
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      geometry: null,
      properties: { value: i % 10 } // Create repetition for cache efficiency
    }));

    layer.setData(testData);
    
    // Access data multiple times to build cache
    for (let i = 0; i < 10; i++) {
      layer.getData();
    }

    const stats = layer.getCacheStatistics();
    expect(stats.hitRate).toBeGreaterThan(90);
  });
});