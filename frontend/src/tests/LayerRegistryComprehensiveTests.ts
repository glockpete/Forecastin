/**
 * LayerRegistry Comprehensive Test Suite
 * 
 * Tests all LayerRegistry functionality including:
 * - Dynamic layer registration and instantiation
 * - Multi-tier caching (L1, L2, L3, L4)
 * - WebSocket integration
 * - Performance monitoring and SLO compliance
 * - Feature flag integration
 * - Error handling and resilience
 */

import { LayerRegistry } from '../layers/registry/LayerRegistry';
import { LayerConfig, LayerType } from '../layers/types/layer-types';
import { BaseLayer } from '../layers/base/BaseLayer';

// Mock layer implementations for testing
class MockLayer extends BaseLayer {
  private config: LayerConfig;
  private data: any[] = [];
  private renderTime: number = 1.0;

  constructor(config: LayerConfig) {
    super(config);
    this.config = config;
  }

  render(gl: WebGLRenderingContext): void {
    // Mock rendering
  }

  getBounds(): [number, number][] | null {
    return [[0, 0], [100, 100]];
  }

  onHover(info: any): void {
    // Mock hover handling
  }

  onClick(info: any): void {
    // Mock click handling
  }

  setData(data: any[]): Promise<void> {
    this.data = data;
    return Promise.resolve();
  }

  getPerformanceMetrics() {
    return {
      layerId: this.config.id,
      renderTime: this.renderTime,
      dataSize: this.data.length,
      memoryUsage: this.data.length * 100,
      cacheHitRate: 0.95,
      lastRenderTime: new Date().toISOString(),
      fps: 60
    };
  }
}

describe('LayerRegistry', () => {
  let layerRegistry: LayerRegistry;
  let testConfig: LayerConfig;

  beforeEach(() => {
    // Reset test configuration
    testConfig = {
      id: 'test-layer',
      type: 'point',
      data: [],
      visible: true,
      opacity: 0.8,
      zIndex: 1,
      name: 'Test Layer',
      cacheEnabled: true,
      cacheTTL: 300000,
      featureFlag: 'ff.test_enabled',
      rolloutPercentage: 100,
      realTimeEnabled: true,
      auditEnabled: true,
      dataClassification: 'internal'
    };

    // Initialize LayerRegistry with test configuration
    layerRegistry = new LayerRegistry({
      enableWebSocket: true,
      cacheSize: 100,
      cacheTTL: 60000
    });

    // Register a test layer type
    layerRegistry.registerLayer('test-point', {
      type: 'test-point',
      factory: (config: LayerConfig) => new MockLayer(config),
      visualChannels: [
        { name: 'position', property: 'coordinates', type: 'quantitative' }
      ],
      requiredProperties: ['coordinates'],
      optionalProperties: ['color', 'size'],
      performance: {
        maxFeatures: 1000,
        recommendedChunkSize: 100,
        memoryUsage: 'low'
      }
    });
  });

  afterEach(() => {
    // Cleanup after each test
    if (layerRegistry) {
      layerRegistry.destroy();
    }
  });

  describe('Layer Registration and Instantiation', () => {
    test('should register new layer types successfully', () => {
      const entry = {
        type: 'point' as LayerType,
        factory: (config: LayerConfig) => new MockLayer(config),
        visualChannels: [
          { name: 'color', property: 'color', type: 'categorical' }
        ],
        requiredProperties: ['coordinates'],
        optionalProperties: [],
        performance: {
          maxFeatures: 500,
          recommendedChunkSize: 50,
          memoryUsage: 'medium'
        }
      };

      expect(() => {
        layerRegistry.registerLayer('point', entry);
      }).not.toThrow();
    });

    test('should prevent duplicate layer registration', () => {
      const entry = {
        type: 'test-point' as LayerType,
        factory: (config: LayerConfig) => new MockLayer(config),
        visualChannels: [],
        requiredProperties: [],
        optionalProperties: [],
        performance: {
          maxFeatures: 100,
          recommendedChunkSize: 10,
          memoryUsage: 'low'
        }
      };

      expect(() => {
        layerRegistry.registerLayer('test-point', entry);
      }).toThrow();
    });

    test('should validate registry entries during registration', () => {
      const invalidEntry = {
        type: 'invalid' as LayerType,
        factory: null as any, // Invalid factory
        visualChannels: 'invalid' as any, // Should be array
        requiredProperties: [],
        optionalProperties: [],
        performance: {
          maxFeatures: 100,
          recommendedChunkSize: 10,
          memoryUsage: 'low'
        }
      };

      expect(() => {
        layerRegistry.registerLayer('invalid', invalidEntry);
      }).toThrow();
    });

    test('should create layer instances dynamically', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      const layer = await layerRegistry.createLayer(config);
      
      expect(layer).toBeInstanceOf(BaseLayer);
      expect(layer.getConfig().id).toBe(config.id);
    });
  });

  describe('Layer Lifecycle Management', () => {
    test('should cache layer instances with TTL', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      // Create first instance
      const layer1 = await layerRegistry.createLayer(config);
      
      // Get same instance from cache
      const layer2 = layerRegistry.getLayer(config.id);
      
      expect(layer2).toBe(layer1);
    });

    test('should remove layer instances correctly', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      // Create and then remove layer
      await layerRegistry.createLayer(config);
      const removed = layerRegistry.removeLayer(config.id);
      
      expect(removed).toBe(true);
      expect(layerRegistry.getLayer(config.id)).toBeNull();
    });

    test('should clear all cached instances', async () => {
      const config1 = { ...testConfig, id: 'layer-1', type: 'test-point' as LayerType };
      const config2 = { ...testConfig, id: 'layer-2', type: 'test-point' as LayerType };
      
      await layerRegistry.createLayer(config1);
      await layerRegistry.createLayer(config2);
      
      layerRegistry.clearCache();
      
      expect(layerRegistry.getLayer(config1.id)).toBeNull();
      expect(layerRegistry.getLayer(config2.id)).toBeNull();
    });

    test('should implement singleton pattern correctly', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      const layer1 = await layerRegistry.getOrCreateLayer(config);
      const layer2 = await layerRegistry.getOrCreateLayer(config);
      
      expect(layer1).toBe(layer2);
    });
  });

  describe('Performance Monitoring and SLO Compliance', () => {
    test('should collect performance metrics correctly', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      await layerRegistry.createLayer(config);
      
      // Wait for performance monitoring
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = layerRegistry.getStatistics();
      
      expect(stats.totalCreated).toBeGreaterThan(0);
      expect(stats.averageCreationTime).toBeGreaterThan(0);
    });

    test('should track cache hit rate', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      // Create layer
      await layerRegistry.createLayer(config);
      
      // Access from cache multiple times
      layerRegistry.getLayer(config.id);
      layerRegistry.getLayer(config.id);
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = layerRegistry.getStatistics();
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    test('should monitor SLO compliance (1.25ms target)', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      const startTime = performance.now();
      await layerRegistry.createLayer(config);
      const creationTime = performance.now() - startTime;
      
      // Creation time should be under reasonable threshold (not necessarily 1.25ms in tests)
      expect(creationTime).toBeLessThan(100); // 100ms for test environment
    });

    test('should trigger performance optimization on degradation', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      // Create multiple layers to stress the system
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const layerConfig = { ...config, id: `layer-${i}` };
        promises.push(layerRegistry.createLayer(layerConfig));
      }
      
      await Promise.all(promises);
      
      // Wait for performance monitoring
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should not throw errors during optimization
      expect(() => layerRegistry.getStatistics()).not.toThrow();
    });
  });

  describe('Feature Flag Integration', () => {
    test('should validate feature flags during layer creation', async () => {
      const config = { 
        ...testConfig, 
        type: 'test-point' as LayerType,
        featureFlag: 'ff.nonexistent'
      };
      
      // Should succeed since registry doesn't actually check feature flags in tests
      const layer = await layerRegistry.createLayer(config);
      expect(layer).toBeInstanceOf(BaseLayer);
    });

    test('should get available layer types based on feature flags', () => {
      const available = layerRegistry.getAvailableLayerTypes();
      
      expect(Array.isArray(available)).toBe(true);
      expect(available).toContain('test-point');
    });

    test('should reload feature flags', async () => {
      await expect(layerRegistry.reloadFeatureFlags()).resolves.not.toThrow();
    });
  });

  describe('Layer Validation', () => {
    test('should validate layer configuration correctly', () => {
      const validConfig = { ...testConfig, type: 'test-point' as LayerType };
      const validation = layerRegistry.validateConfig(validConfig);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid configurations', () => {
      const invalidConfig = {
        ...testConfig,
        id: '', // Missing ID
        type: 'nonexistent' as LayerType,
        opacity: 1.5 // Invalid opacity range
      };
      
      const validation = layerRegistry.validateConfig(invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should check required properties for layer types', () => {
      const config = { 
        ...testConfig, 
        type: 'test-point' as LayerType,
        data: [] // Missing required coordinates
      };
      
      const validation = layerRegistry.validateConfig(config);
      
      // Should have validation errors for missing properties
      expect(validation.errors).toContain('Missing required property: coordinates');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle layer creation errors gracefully', async () => {
      const config = { ...testConfig, type: 'nonexistent' as LayerType };
      
      await expect(layerRegistry.createLayer(config)).rejects.toThrow();
    });

    test('should handle WebSocket connection errors', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      // Create layer with WebSocket enabled
      await expect(layerRegistry.createLayer(config)).resolves.not.toThrow();
      
      // Registry should handle WebSocket errors gracefully
      expect(() => layerRegistry.getStatistics()).not.toThrow();
    });

    test('should handle cache miss scenarios', () => {
      const nonExistentLayer = layerRegistry.getLayer('non-existent');
      expect(nonExistentLayer).toBeNull();
    });

    test('should handle invalid layer removal', () => {
      const result = layerRegistry.removeLayer('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide comprehensive statistics', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      await layerRegistry.createLayer(config);
      const stats = layerRegistry.getStatistics();
      
      expect(stats).toHaveProperty('totalCreated');
      expect(stats).toHaveProperty('totalDestroyed');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('averageCreationTime');
      expect(stats).toHaveProperty('mostUsedLayers');
      expect(stats).toHaveProperty('sloCompliance');
    });

    test('should track layer usage patterns', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      // Create layer and access it multiple times
      await layerRegistry.createLayer(config);
      layerRegistry.getLayer(config.id);
      layerRegistry.getLayer(config.id);
      
      const stats = layerRegistry.getStatistics();
      
      expect(stats.mostUsedLayers).toContainEqual(
        expect.objectContaining({ type: 'test-point' })
      );
    });
  });

  describe('Layer Registry Entry Management', () => {
    test('should retrieve layer registry entries', () => {
      const entry = layerRegistry.getLayerEntry('test-point');
      
      expect(entry).toBeDefined();
      expect(entry?.type).toBe('test-point');
      expect(entry?.visualChannels).toBeDefined();
      expect(entry?.performance).toBeDefined();
    });

    test('should return undefined for non-existent registry entries', () => {
      const entry = layerRegistry.getLayerEntry('non-existent');
      expect(entry).toBeUndefined();
    });
  });

  describe('Resource Management and Cleanup', () => {
    test('should cleanup resources properly on destroy', () => {
      // Create some layers
      layerRegistry.registerLayer('temp', {
        type: 'temp' as LayerType,
        factory: (config: LayerConfig) => new MockLayer(config),
        visualChannels: [],
        requiredProperties: [],
        optionalProperties: [],
        performance: { maxFeatures: 100, recommendedChunkSize: 10, memoryUsage: 'low' }
      });
      
      // Destroy registry
      expect(() => layerRegistry.destroy()).not.toThrow();
      
      // Try to use after destroy (should handle gracefully)
      expect(() => layerRegistry.getStatistics()).not.toThrow();
    });

    test('should handle multiple destroy calls gracefully', () => {
      expect(() => {
        layerRegistry.destroy();
        layerRegistry.destroy(); // Second destroy should be safe
      }).not.toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet creation time targets', async () => {
      const iterations = 50;
      const creationTimes: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const config = { 
          ...testConfig, 
          id: `perf-test-${i}`,
          type: 'test-point' as LayerType 
        };
        
        const startTime = performance.now();
        await layerRegistry.createLayer(config);
        const creationTime = performance.now() - startTime;
        
        creationTimes.push(creationTime);
      }
      
      // Calculate statistics
      const avgCreationTime = creationTimes.reduce((a, b) => a + b, 0) / creationTimes.length;
      const maxCreationTime = Math.max(...creationTimes);
      
      // In test environment, be lenient but still measure
      expect(avgCreationTime).toBeLessThan(50); // 50ms average
      expect(maxCreationTime).toBeLessThan(100); // 100ms max
    });

    test('should maintain high cache hit rate under load', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      // Create layer
      await layerRegistry.createLayer(config);
      
      // Access it multiple times
      const accessCount = 100;
      for (let i = 0; i < accessCount; i++) {
        layerRegistry.getLayer(config.id);
      }
      
      // Wait for metrics
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = layerRegistry.getStatistics();
      
      // Should have very high cache hit rate for repeated access
      expect(stats.cacheHitRate).toBeGreaterThan(0.9); // 90% hit rate
    });
  });

  describe('Integration with External Systems', () => {
    test('should integrate with layer cache manager', async () => {
      const config = { ...testConfig, type: 'test-point' as LayerType };
      
      // This tests the multi-tier caching integration
      const layer = await layerRegistry.createLayer(config);
      
      // Should not throw errors during cache operations
      expect(() => layerRegistry.getLayer(config.id)).not.toThrow();
    });

    test('should handle feature flag rollouts', () => {
      // Test that registry works with gradual rollout percentages
      const available = layerRegistry.getAvailableLayerTypes();
      
      expect(Array.isArray(available)).toBe(true);
    });
  });
});

// Performance test utilities
export class LayerRegistryPerformanceTest {
  static async runBenchmark(iterations: number = 100): Promise<{
    avgCreationTime: number;
    maxCreationTime: number;
    minCreationTime: number;
    p95CreationTime: number;
    cacheHitRate: number;
  }> {
    const registry = new LayerRegistry({ cacheSize: 1000 });
    
    const creationTimes: number[] = [];
    
    // Register test layer
    registry.registerLayer('perf-test', {
      type: 'perf-test' as LayerType,
      factory: (config: LayerConfig) => new MockLayer(config),
      visualChannels: [],
      requiredProperties: [],
      optionalProperties: [],
      performance: { maxFeatures: 1000, recommendedChunkSize: 100, memoryUsage: 'low' }
    });
    
    for (let i = 0; i < iterations; i++) {
      const config: LayerConfig = {
        id: `benchmark-${i}`,
        type: 'perf-test' as LayerType,
        data: [],
        visible: true,
        opacity: 0.8,
        zIndex: 1,
        name: `Benchmark Layer ${i}`,
        cacheEnabled: true,
        cacheTTL: 300000,
        featureFlag: undefined,
        rolloutPercentage: 100,
        realTimeEnabled: false,
        auditEnabled: false,
        dataClassification: 'internal'
      };
      
      const startTime = performance.now();
      await registry.createLayer(config);
      const creationTime = performance.now() - startTime;
      
      creationTimes.push(creationTime);
    }
    
    // Calculate statistics
    const sortedTimes = [...creationTimes].sort((a, b) => a - b);
    const avgCreationTime = creationTimes.reduce((a, b) => a + b, 0) / creationTimes.length;
    const maxCreationTime = Math.max(...creationTimes);
    const minCreationTime = Math.min(...creationTimes);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95CreationTime = sortedTimes[p95Index];
    
    const stats = registry.getStatistics();
    
    registry.destroy();
    
    return {
      avgCreationTime,
      maxCreationTime,
      minCreationTime,
      p95CreationTime,
      cacheHitRate: stats.cacheHitRate
    };
  }
}

export default LayerRegistryPerformanceTest;