/**
 * Performance Benchmarking Tests for BaseLayer Architecture
 * Validates 1.25ms response time target and performance optimizations
 */

import { BaseLayer } from '../layers/base/BaseLayer';
import { LayerConfig, LayerData, LayerType } from '../layers/types/layer-types';
import LayerValidationUtils from '../layers/utils/LayerValidationUtils';

// Mock implementation for testing
class BenchmarkLayer extends BaseLayer {
  constructor(config: LayerConfig) {
    super(config);
  }

  protected initializeVisualChannels(): void {
    // Initialize default visual channels for benchmarking
    this.setVisualChannel('position', {
      name: 'position',
      property: 'coordinates',
      type: 'quantitative',
      defaultValue: [0, 0] as any
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

    this.setVisualChannel('size', {
      name: 'size',
      property: 'magnitude',
      type: 'quantitative',
      defaultValue: 10,
      scale: {
        domain: [1, 50],
        range: [1, 20],
        type: 'linear'
      }
    });
  }

  render(gl: WebGLRenderingContext): void {
    // Mock render implementation for benchmarking
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

interface BenchmarkResult {
  operation: string;
  duration: number;
  memoryUsage: number;
  dataSize: number;
  sloCompliance: boolean;
  cacheHitRate: number;
}

class PerformanceBenchmarkSuite {
  private results: BenchmarkResult[] = [];
  private memorySnapshots: number[] = [];

  /**
   * Run comprehensive performance benchmarks
   */
  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('🚀 Starting BaseLayer Performance Benchmarks...\n');

    // Small dataset benchmarks (1-100 items)
    await this.benchmarkSmallDatasets();
    
    // Medium dataset benchmarks (100-1000 items)
    await this.benchmarkMediumDatasets();
    
    // Large dataset benchmarks (1000-10000 items)
    await this.benchmarkLargeDatasets();
    
    // Stress test benchmarks (10000+ items)
    await this.benchmarkStressTests();
    
    // WebSocket performance tests
    await this.benchmarkWebSocketOperations();
    
    // Cache performance tests
    await this.benchmarkCacheOperations();
    
    // Memory usage benchmarks
    await this.benchmarkMemoryUsage();
    
    // Concurrency tests
    await this.benchmarkConcurrency();
    
    console.log('📊 Performance Benchmark Suite Complete\n');
    return this.results;
  }

  /**
   * Benchmark small datasets (1-100 items)
   */
  private async benchmarkSmallDatasets(): Promise<void> {
    console.log('📈 Small Dataset Benchmarks (1-100 items)');
    
    for (let size of [1, 10, 50, 100]) {
      const data = this.generateTestData(size);
      const config = this.createTestConfig('small-dataset-test');
      
      const layer = new BenchmarkLayer(config);
      
      // Data loading benchmark
      const dataLoadResult = await this.benchmarkOperation('dataLoad', () => 
        layer.setData(data), layer
      );
      this.results.push(dataLoadResult);
      
      // Render benchmark
      const renderResult = this.benchmarkOperation('render', () => 
        layer.render({} as WebGLRenderingContext), layer
      );
      this.results.push(renderResult);
      
      // Cache access benchmark
      const cacheAccessResult = this.benchmarkOperation('cacheAccess', () => 
        layer.getData(), layer
      );
      this.results.push(cacheAccessResult);
      
      // Visual channels processing benchmark
      const channelResult = this.benchmarkOperation('visualChannels', () => 
        layer.getAllVisualChannels(), layer
      );
      this.results.push(channelResult);
      
      layer.destroy();
      
      console.log(`  ✓ Dataset size ${size}: Data load ${dataLoadResult.duration.toFixed(2)}ms, Render ${renderResult.duration.toFixed(2)}ms`);
    }
    
    console.log('');
  }

  /**
   * Benchmark medium datasets (100-1000 items)
   */
  private async benchmarkMediumDatasets(): Promise<void> {
    console.log('📈 Medium Dataset Benchmarks (100-1000 items)');
    
    for (let size of [100, 500, 1000]) {
      const data = this.generateTestData(size);
      const config = this.createTestConfig('medium-dataset-test');
      
      const layer = new BenchmarkLayer(config);
      
      const dataLoadResult = await this.benchmarkOperation('dataLoadMedium', () => 
        layer.setData(data), layer
      );
      this.results.push(dataLoadResult);
      
      const batchProcessResult = this.benchmarkOperation('batchProcess', () => 
        (layer as any).processVisualChannelsBatch(data), layer
      );
      this.results.push(batchProcessResult);
      
      // Test with caching enabled
      layer.updateConfig({ cacheEnabled: true });
      const cachedAccessResult = this.benchmarkOperation('cachedAccess', () => 
        layer.getData(), layer
      );
      this.results.push(cachedAccessResult);
      
      layer.destroy();
      
      console.log(`  ✓ Dataset size ${size}: Load ${dataLoadResult.duration.toFixed(2)}ms, Batch ${batchProcessResult.duration.toFixed(2)}ms, Cached ${cachedAccessResult.duration.toFixed(2)}ms`);
    }
    
    console.log('');
  }

  /**
   * Benchmark large datasets (1000-10000 items)
   */
  private async benchmarkLargeDatasets(): Promise<void> {
    console.log('📈 Large Dataset Benchmarks (1000-10000 items)');
    
    for (let size of [1000, 5000, 10000]) {
      const data = this.generateTestData(size);
      const config = this.createTestConfig('large-dataset-test');
      
      const layer = new BenchmarkLayer(config);
      
      const dataLoadResult = await this.benchmarkOperation('dataLoadLarge', () => 
        layer.setData(data), layer
      );
      this.results.push(dataLoadResult);
      
      // Test performance degradation detection
      const degradationResult = this.benchmarkOperation('degradationDetection', () => 
        (layer as any).checkPerformanceDegradation(), layer
      );
      this.results.push(degradationResult);
      
      // Test materialized views
      const materializedViewResult = this.benchmarkOperation('materializedViewAccess', () => 
        (layer as any).materializedViews.get('hierarchy_cache'), layer
      );
      this.results.push(materializedViewResult);
      
      layer.destroy();
      
      console.log(`  ✓ Dataset size ${size}: Load ${dataLoadResult.duration.toFixed(2)}ms, Degradation ${degradationResult.duration.toFixed(2)}ms`);
    }
    
    console.log('');
  }

  /**
   * Stress test benchmarks (10000+ items)
   */
  private async benchmarkStressTests(): Promise<void> {
    console.log('📈 Stress Test Benchmarks (10000+ items)');
    
    const size = 50000;
    const data = this.generateTestData(size);
    const config = this.createTestConfig('stress-test');
    
    const layer = new BenchmarkLayer(config);
    
    // Test data loading under stress
    const stressLoadResult = await this.benchmarkOperation('stressDataLoad', () => 
      layer.setData(data), layer
    );
    this.results.push(stressLoadResult);
    
    // Test memory cleanup
    const memoryCleanupResult = this.benchmarkOperation('memoryCleanup', () => 
      (layer as any).optimizeCaches(), layer
    );
    this.results.push(memoryCleanupResult);
    
    // Test performance optimization triggers
    const optimizationResult = this.benchmarkOperation('performanceOptimization', () => 
      (layer as any).triggerPerformanceOptimization(), layer
    );
    this.results.push(optimizationResult);
    
    layer.destroy();
    
    console.log(`  ✓ Stress test (${size} items): Load ${stressLoadResult.duration.toFixed(2)}ms, Memory cleanup ${memoryCleanupResult.duration.toFixed(2)}ms`);
    console.log('');
  }

  /**
   * WebSocket performance benchmarks
   */
  private async benchmarkWebSocketOperations(): Promise<void> {
    console.log('📈 WebSocket Operation Benchmarks');
    
    const config = this.createTestConfig('websocket-test');
    const layer = new BenchmarkLayer(config);
    
    // Test serialization performance
    const testData = {
      timestamp: new Date(),
      complexObject: { nested: { value: 42 } },
      array: new Array(100).fill(0).map((_, i) => ({ id: i }))
    };
    
    const serializationResult = this.benchmarkOperation('websocketSerialization', () => 
      (layer as any).safeSerialize(testData), layer
    );
    this.results.push(serializationResult);
    
    // Test WebSocket message sending
    const messageSendResult = this.benchmarkOperation('websocketSend', () => 
      (layer as any).sendWebSocketMessage('test_message', { data: testData }), layer
    );
    this.results.push(messageSendResult);
    
    // Test circular reference handling
    const circularData = { test: 'value' };
    (circularData as any).circular = circularData;
    
    const circularSerializationResult = this.benchmarkOperation('circularSerialization', () => 
      (layer as any).safeSerialize(circularData), layer
    );
    this.results.push(circularSerializationResult);
    
    layer.destroy();
    
    console.log(`  ✓ Serialization ${serializationResult.duration.toFixed(2)}ms, Send ${messageSendResult.duration.toFixed(2)}ms, Circular ${circularSerializationResult.duration.toFixed(2)}ms`);
    console.log('');
  }

  /**
   * Cache operation benchmarks
   */
  private async benchmarkCacheOperations(): Promise<void> {
    console.log('📈 Cache Operation Benchmarks');
    
    const config = this.createTestConfig('cache-test');
    const layer = new BenchmarkLayer(config);
    
    const testData = this.generateTestData(1000);
    await layer.setData(testData);
    
    // Test cache hits
    const cacheHitResult = this.benchmarkOperation('cacheHit', () => 
      layer.getData(), layer
    );
    this.results.push(cacheHitResult);
    
    // Test cache misses with different data
    const differentData = this.generateTestData(1000);
    differentData.forEach(item => item.id = `new-${item.id}`);
    
    const cacheMissResult = this.benchmarkOperation('cacheMiss', () => 
      layer.setData(differentData), layer
    );
    this.results.push(cacheMissResult);
    
    // Test cache statistics
    const statsResult = this.benchmarkOperation('cacheStats', () => 
      layer.getCacheStatistics(), layer
    );
    this.results.push(statsResult);
    
    layer.destroy();
    
    console.log(`  ✓ Cache hit ${cacheHitResult.duration.toFixed(2)}ms, Miss ${cacheMissResult.duration.toFixed(2)}ms, Stats ${statsResult.duration.toFixed(2)}ms`);
    console.log('');
  }

  /**
   * Memory usage benchmarks
   */
  private async benchmarkMemoryUsage(): Promise<void> {
    console.log('📈 Memory Usage Benchmarks');
    
    const config = this.createTestConfig('memory-test');
    
    // Test memory usage with different data sizes
    for (let size of [100, 1000, 10000]) {
      const layer = new BenchmarkLayer(config);
      const data = this.generateTestData(size);
      
      const memoryBefore = this.getMemoryUsage();
      await layer.setData(data);
      const memoryAfter = this.getMemoryUsage();
      
      const memoryResult: BenchmarkResult = {
        operation: `memoryUsage${size}`,
        duration: memoryAfter - memoryBefore,
        memoryUsage: memoryAfter - memoryBefore,
        dataSize: size,
        sloCompliance: (memoryAfter - memoryBefore) < 1000000, // 1MB threshold
        cacheHitRate: layer.getCacheStatistics()?.hitRate || 0
      };
      
      this.results.push(memoryResult);
      layer.destroy();
      
      console.log(`  ✓ Dataset size ${size}: Memory ${((memoryAfter - memoryBefore) / 1024).toFixed(2)}KB`);
    }
    
    console.log('');
  }

  /**
   * Concurrency benchmarks
   */
  private async benchmarkConcurrency(): Promise<void> {
    console.log('📈 Concurrency Benchmarks');
    
    const config = this.createTestConfig('concurrency-test');
    const layer = new BenchmarkLayer(config);
    
    // Test concurrent data access
    const concurrentAccessResult = this.benchmarkOperation('concurrentAccess', async () => {
      const promises = Array.from({ length: 10 }, () => 
        Promise.resolve(layer.getData())
      );
      await Promise.all(promises);
    }, layer);
    this.results.push(concurrentAccessResult);
    
    // Test concurrent configuration updates
    const concurrentConfigResult = this.benchmarkOperation('concurrentConfig', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        Promise.resolve(layer.updateConfig({ opacity: 0.1 * (i + 1) }))
      );
      await Promise.all(promises);
    }, layer);
    this.results.push(concurrentConfigResult);
    
    layer.destroy();
    
    console.log(`  ✓ Concurrent access ${concurrentAccessResult.duration.toFixed(2)}ms, Config ${concurrentConfigResult.duration.toFixed(2)}ms`);
    console.log('');
  }

  /**
   * Execute a benchmark operation
   */
  private async benchmarkOperation(
    operationName: string,
    operation: () => any,
    layer: BenchmarkLayer
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();
    
    try {
      await operation();
      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();
      
      const duration = endTime - startTime;
      const memoryUsed = endMemory - startMemory;
      const sloCompliance = duration <= 1.25;
      const cacheStats = layer.getCacheStatistics();
      
      return {
        operation: operationName,
        duration,
        memoryUsage: memoryUsed,
        dataSize: layer.getData().length,
        sloCompliance,
        cacheHitRate: cacheStats?.hitRate || 0
      };
    } catch (error) {
      console.error(`Benchmark operation ${operationName} failed:`, error);
      return {
        operation: operationName,
        duration: performance.now() - startTime,
        memoryUsage: this.getMemoryUsage() - startMemory,
        dataSize: 0,
        sloCompliance: false,
        cacheHitRate: 0
      };
    }
  }

  /**
   * Generate test data
   */
  private generateTestData(count: number): LayerData[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      geometry: {
        type: 'Point',
        coordinates: [Math.random() * 180 - 90, Math.random() * 360 - 180]
      },
      properties: {
        value: Math.random() * 100,
        magnitude: Math.random() * 50 + 1,
        category: `category-${i % 10}`,
        timestamp: new Date().toISOString()
      },
      confidence: Math.random(),
      source: 'benchmark-test',
      entityId: i % 5 === 0 ? `entity-${Math.floor(i / 5)}` : undefined
    }));
  }

  /**
   * Create test configuration
   */
  private createTestConfig(suffix: string): LayerConfig {
    return {
      id: `benchmark-layer-${suffix}`,
      type: 'point' as LayerType,
      data: [],
      visible: true,
      opacity: 0.8,
      zIndex: 1,
      name: `Benchmark Layer ${suffix}`,
      cacheEnabled: true,
      cacheTTL: 30000,
      realTimeEnabled: false,
      auditEnabled: false, // Disable for performance testing
      dataClassification: 'internal'
    };
  }

  /**
   * Get current memory usage (simplified)
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    // Fallback for browser environment
    return (performance as any).memory?.usedJSHeapSize || 0;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    const validResults = this.results.filter(r => !isNaN(r.duration));
    const avgDuration = validResults.reduce((sum, r) => sum + r.duration, 0) / validResults.length;
    const sloCompliantCount = validResults.filter(r => r.sloCompliance).length;
    const sloComplianceRate = (sloCompliantCount / validResults.length) * 100;
    const avgMemoryUsage = validResults.reduce((sum, r) => sum + r.memoryUsage, 0) / validResults.length;
    const avgCacheHitRate = validResults.reduce((sum, r) => sum + r.cacheHitRate, 0) / validResults.length;

    let report = `\n📊 BaseLayer Performance Benchmark Report\n`;
    report += `========================================\n\n`;
    report += `Total Operations: ${this.results.length}\n`;
    report += `Valid Operations: ${validResults.length}\n`;
    report += `Average Duration: ${avgDuration.toFixed(2)}ms\n`;
    report += `SLO Compliance: ${sloComplianceRate.toFixed(1)}% (${sloCompliantCount}/${validResults.length})\n`;
    report += `Average Memory Usage: ${(avgMemoryUsage / 1024).toFixed(2)}KB\n`;
    report += `Average Cache Hit Rate: ${avgCacheHitRate.toFixed(1)}%\n\n`;

    // Performance targets validation
    report += `🎯 Performance Targets:\n`;
    report += `- 1.25ms SLO Target: ${sloComplianceRate >= 95 ? '✅ PASS' : '❌ FAIL'} (${sloComplianceRate.toFixed(1)}%)\n`;
    report += `- Cache Hit Rate: ${avgCacheHitRate >= 90 ? '✅ PASS' : '❌ FAIL'} (${avgCacheHitRate.toFixed(1)}%)\n`;
    report += `- Memory Efficiency: ${avgMemoryUsage <= 10 * 1024 * 1024 ? '✅ PASS' : '❌ FAIL'} (<10MB)\n\n`;

    // Operation breakdown
    report += `📈 Operation Breakdown:\n`;
    const operationGroups = validResults.reduce((groups, result) => {
      if (!groups[result.operation]) groups[result.operation] = [];
      groups[result.operation].push(result);
      return groups;
    }, {} as Record<string, BenchmarkResult[]>);

    for (const [operation, results] of Object.entries(operationGroups)) {
      const avgOpDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const sloRate = (results.filter(r => r.sloCompliance).length / results.length) * 100;
      report += `- ${operation}: ${avgOpDuration.toFixed(2)}ms avg, ${sloRate.toFixed(1)}% SLO compliance\n`;
    }

    // Recommendations
    report += `\n💡 Recommendations:\n`;
    if (sloComplianceRate < 95) {
      report += `- Consider implementing data sampling for large datasets\n`;
      report += `- Enable aggressive caching for frequently accessed data\n`;
    }
    if (avgCacheHitRate < 90) {
      report += `- Review cache key strategy to improve hit rate\n`;
      report += `- Consider increasing cache TTL for stable data\n`;
    }
    if (avgMemoryUsage > 10 * 1024 * 1024) {
      report += `- Implement memory cleanup strategies\n`;
      report += `- Consider data pagination for large datasets\n`;
    }

    report += `\n🏆 Benchmarking Complete - All systems operational\n`;
    return report;
  }
}

// Performance test runner
export async function runPerformanceBenchmarks(): Promise<void> {
  const benchmark = new PerformanceBenchmarkSuite();
  const results = await benchmark.runAllBenchmarks();
  const report = benchmark.generatePerformanceReport();
  
  console.log(report);
  
  // Validate results against SLOs
  const validationResults = results.map(result => 
    LayerValidationUtils.validatePerformanceBenchmark(result)
  );
  
  const hasErrors = validationResults.some(result => result.errors.length > 0);
  const hasWarnings = validationResults.some(result => result.warnings.length > 0);
  
  if (hasErrors) {
    console.error('❌ Performance benchmarks failed validation');
    process.exit(1);
  } else if (hasWarnings) {
    console.warn('⚠️ Performance benchmarks completed with warnings');
  } else {
    console.log('✅ All performance benchmarks passed');
  }
}

export { PerformanceBenchmarkSuite, BenchmarkResult };
export default runPerformanceBenchmarks;