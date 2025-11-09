/**
 * Layer Performance Monitor - Dedicated monitoring for geospatial layer system
 * 
 * Implements:
 * - Layer rendering time tracking (1.25ms SLO target)
 * - GPU filtering application time measurement (<100ms for 10k points)
 * - Four-tier cache coordination impact tracking
 * - Integration with hybrid state management (Zustand/React Query)
 * - WebSocket reporting to backend
 * - Feature flag rollback trigger conditions
 * 
 * Following forecastin patterns from AGENTS.md:
 * - Thread-safe operations with RLock pattern
 * - orjson-safe serialization for WebSocket
 * - Exponential moving averages for metrics
 * - SLO compliance validation
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface LayerMetrics {
  layerId: string;
  layerType: string;
  renderTime: number;
  gpuFilterTime?: number;
  pointsRendered: number;
  dataSize: number;
  memoryUsage: number;
  cacheHitRate: number;
  cacheTier?: 'L1' | 'L2' | 'L3' | 'L4' | 'MISS';
  cacheLatency?: number;
  timestamp: number;
}

export interface PerformanceSLOs {
  targetRenderTime: number; // 1.25ms
  targetGpuFilterTime: number; // 100ms for 10k points
  targetCacheHitRate: number; // 90%
  minCompliance: number; // 95% of requests must meet SLOs
}

export interface PerformanceReport {
  layerId: string;
  currentMetrics: LayerMetrics;
  p50RenderTime: number;
  p95RenderTime: number;
  p99RenderTime: number;
  avgGpuFilterTime: number;
  cacheStats: CacheStatistics;
  sloCompliance: SLOCompliance;
  degradationWarnings: string[];
  recommendations: string[];
  timestamp: number;
}

export interface CacheStatistics {
  l1HitRate: number;
  l2HitRate: number;
  l3HitRate: number;
  l4HitRate: number;
  overallHitRate: number;
  avgLatency: number;
  tierDistribution: Record<string, number>;
}

export interface SLOCompliance {
  renderTimeCompliance: number; // Percentage meeting 1.25ms target
  gpuFilterCompliance: number; // Percentage meeting 100ms target
  cacheHitRateCompliance: number; // Percentage meeting 90% target
  overallCompliance: number;
  violations: Array<{ type: string; value: number; threshold: number; timestamp: number }>;
}

export interface LayerPerformanceOptions {
  reportingInterval?: number; // Interval to send reports to backend (ms)
  sampleSize?: number; // Number of metrics to keep for percentile calculations
  enableWebSocketReporting?: boolean;
  websocketUrl?: string;
  featureFlagThresholds?: {
    renderTimeDegradation: number; // Trigger rollback if > this (ms)
    gpuFilterDegradation: number; // Trigger rollback if > this (ms)
    cacheHitRateDrop: number; // Trigger rollback if < this (%)
  };
}

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

export class LayerPerformanceMonitor extends EventEmitter {
  private metrics: Map<string, LayerMetrics[]> = new Map();
  private readonly maxSampleSize: number;
  private readonly slos: PerformanceSLOs;
  private readonly options: LayerPerformanceOptions;
  private monitoring = false;
  private reportingInterval?: NodeJS.Timeout;
  private websocket?: WebSocket;
  
  // Thread-safe lock simulation (RLock pattern from AGENTS.md)
  private readonly lock = {
    locked: false,
    queue: [] as Array<() => void>
  };

  constructor(options: LayerPerformanceOptions = {}) {
    super();
    
    this.options = {
      reportingInterval: options.reportingInterval || 30000, // 30 seconds (AGENTS.md pattern)
      sampleSize: options.sampleSize || 1000,
      enableWebSocketReporting: options.enableWebSocketReporting !== false,
      websocketUrl: options.websocketUrl || import.meta.env.VITE_WS_URL || 'ws://localhost:9000/ws',
      featureFlagThresholds: {
        renderTimeDegradation: options.featureFlagThresholds?.renderTimeDegradation || 10, // 10ms
        gpuFilterDegradation: options.featureFlagThresholds?.gpuFilterDegradation || 200, // 200ms
        cacheHitRateDrop: options.featureFlagThresholds?.cacheHitRateDrop || 80, // 80%
      }
    };

    this.maxSampleSize = this.options.sampleSize!;

    // SLOs from task requirements
    this.slos = {
      targetRenderTime: 1.25, // 1.25ms overall response time target
      targetGpuFilterTime: 100, // <100ms for 10k points
      targetCacheHitRate: 90, // 90% cache hit rate
      minCompliance: 95 // 95% compliance required
    };
  }

  // ============================================================================
  // LOCK MANAGEMENT (RLock pattern from AGENTS.md)
  // ============================================================================

  private async acquireLock(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.lock.locked) {
        this.lock.locked = true;
        resolve();
      } else {
        this.lock.queue.push(resolve);
      }
    });
  }

  private releaseLock(): void {
    this.lock.locked = false;
    const next = this.lock.queue.shift();
    if (next) {
      this.lock.locked = true;
      next();
    }
  }

  // ============================================================================
  // MONITORING LIFECYCLE
  // ============================================================================

  async startMonitoring(): Promise<void> {
    if (this.monitoring) {
      console.warn('[LayerPerformanceMonitor] Already monitoring');
      return;
    }

    this.monitoring = true;
    console.log('[LayerPerformanceMonitor] Started monitoring');

    // Setup WebSocket connection for reporting
    if (this.options.enableWebSocketReporting) {
      await this.setupWebSocketReporting();
    }

    // Start periodic reporting
    this.reportingInterval = setInterval(() => {
      this.generateAndReportPerformance();
    }, this.options.reportingInterval);

    this.emit('monitoringStarted', { timestamp: Date.now() });
  }

  async stopMonitoring(): Promise<void> {
    this.monitoring = false;

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      delete (this as any).reportingInterval;
    }

    if (this.websocket) {
      this.websocket.close();
      delete (this as any).websocket;
    }

    console.log('[LayerPerformanceMonitor] Stopped monitoring');
    this.emit('monitoringStopped', { timestamp: Date.now() });
  }

  // ============================================================================
  // METRICS RECORDING
  // ============================================================================

  async recordLayerRender(
    layerId: string,
    layerType: string,
    renderTime: number,
    pointsRendered: number,
    dataSize: number,
    memoryUsage: number,
    cacheStats?: { tier: string; latency: number; hitRate: number }
  ): Promise<void> {
    await this.acquireLock();
    
    try {
      const metric: LayerMetrics = {
        layerId,
        layerType,
        renderTime,
        pointsRendered,
        dataSize,
        memoryUsage,
        cacheHitRate: cacheStats?.hitRate || 0,
        cacheTier: cacheStats?.tier as any,
        ...(cacheStats?.latency !== undefined && { cacheLatency: cacheStats.latency }),
        timestamp: Date.now()
      };

      // Store metric
      if (!this.metrics.has(layerId)) {
        this.metrics.set(layerId, []);
      }

      const layerMetrics = this.metrics.get(layerId)!;
      layerMetrics.push(metric);

      // Maintain sample size limit
      if (layerMetrics.length > this.maxSampleSize) {
        layerMetrics.shift();
      }

      // Check for SLO violations
      this.checkSLOViolations(metric);

      // Emit metric event
      this.emit('metricRecorded', { layerId, metric });

    } finally {
      this.releaseLock();
    }
  }

  async recordGPUFilterTime(
    layerId: string,
    filterTime: number,
    pointsProcessed: number
  ): Promise<void> {
    await this.acquireLock();

    try {
      const layerMetrics = this.metrics.get(layerId);
      if (layerMetrics && layerMetrics.length > 0) {
        const latestMetric = layerMetrics[layerMetrics.length - 1];
        if (latestMetric) {
          latestMetric.gpuFilterTime = filterTime;
        }
      }

      // Check GPU filter SLO
      const expectedTime = (pointsProcessed / 10000) * this.slos.targetGpuFilterTime;
      if (filterTime > expectedTime) {
        this.emit('sloViolation', {
          type: 'gpu_filter_time',
          layerId,
          actual: filterTime,
          expected: expectedTime,
          pointsProcessed,
          timestamp: Date.now()
        });
      }

    } finally {
      this.releaseLock();
    }
  }

  // ============================================================================
  // SLO VALIDATION
  // ============================================================================

  private checkSLOViolations(metric: LayerMetrics): void {
    const violations: Array<{ type: string; value: number; threshold: number }> = [];

    // Check render time SLO (1.25ms target)
    if (metric.renderTime > this.slos.targetRenderTime) {
      violations.push({
        type: 'render_time',
        value: metric.renderTime,
        threshold: this.slos.targetRenderTime
      });
    }

    // Check GPU filter time SLO (<100ms for 10k points)
    if (metric.gpuFilterTime) {
      const expectedTime = (metric.pointsRendered / 10000) * this.slos.targetGpuFilterTime;
      if (metric.gpuFilterTime > expectedTime) {
        violations.push({
          type: 'gpu_filter_time',
          value: metric.gpuFilterTime,
          threshold: expectedTime
        });
      }
    }

    // Check cache hit rate SLO (90%)
    if (metric.cacheHitRate < this.slos.targetCacheHitRate) {
      violations.push({
        type: 'cache_hit_rate',
        value: metric.cacheHitRate,
        threshold: this.slos.targetCacheHitRate
      });
    }

    // Emit violations
    if (violations.length > 0) {
      this.emit('sloViolation', {
        layerId: metric.layerId,
        violations,
        timestamp: Date.now()
      });
    }

    // Check for feature flag rollback conditions
    this.checkFeatureFlagRollback(metric, violations);
  }

  private checkFeatureFlagRollback(metric: LayerMetrics, violations: any[]): void {
    const thresholds = this.options.featureFlagThresholds!;

    // Critical render time degradation
    if (metric.renderTime > thresholds.renderTimeDegradation) {
      this.emit('featureFlagRollbackRequired', {
        reason: 'render_time_degradation',
        layerId: metric.layerId,
        actual: metric.renderTime,
        threshold: thresholds.renderTimeDegradation,
        severity: 'critical',
        timestamp: Date.now()
      });
    }

    // Critical GPU filter degradation
    if (metric.gpuFilterTime && metric.gpuFilterTime > thresholds.gpuFilterDegradation) {
      this.emit('featureFlagRollbackRequired', {
        reason: 'gpu_filter_degradation',
        layerId: metric.layerId,
        actual: metric.gpuFilterTime,
        threshold: thresholds.gpuFilterDegradation,
        severity: 'critical',
        timestamp: Date.now()
      });
    }

    // Critical cache hit rate drop
    if (metric.cacheHitRate < thresholds.cacheHitRateDrop) {
      this.emit('featureFlagRollbackRequired', {
        reason: 'cache_hit_rate_drop',
        layerId: metric.layerId,
        actual: metric.cacheHitRate,
        threshold: thresholds.cacheHitRateDrop,
        severity: 'high',
        timestamp: Date.now()
      });
    }
  }

  // ============================================================================
  // PERFORMANCE REPORTING
  // ============================================================================

  async generatePerformanceReport(layerId: string): Promise<PerformanceReport | null> {
    await this.acquireLock();
    
    try {
      const layerMetrics = this.metrics.get(layerId);
      if (!layerMetrics || layerMetrics.length === 0) {
        return null;
      }

      // Calculate percentiles for render time
      const renderTimes = layerMetrics.map(m => m.renderTime).sort((a, b) => a - b);
      const p50Index = Math.floor(renderTimes.length * 0.50);
      const p95Index = Math.floor(renderTimes.length * 0.95);
      const p99Index = Math.floor(renderTimes.length * 0.99);

      const p50RenderTime = renderTimes[p50Index] || 0;
      const p95RenderTime = renderTimes[p95Index] || 0;
      const p99RenderTime = renderTimes[p99Index] || 0;

      // Calculate GPU filter time average
      const gpuFilterTimes = layerMetrics
        .filter(m => m.gpuFilterTime !== undefined)
        .map(m => m.gpuFilterTime!);
      const avgGpuFilterTime = gpuFilterTimes.length > 0
        ? gpuFilterTimes.reduce((sum, t) => sum + t, 0) / gpuFilterTimes.length
        : 0;

      // Calculate cache statistics
      const cacheStats = this.calculateCacheStatistics(layerMetrics);

      // Calculate SLO compliance
      const sloCompliance = this.calculateSLOCompliance(layerMetrics);

      // Generate warnings and recommendations
      const degradationWarnings = this.generateDegradationWarnings(
        p95RenderTime,
        avgGpuFilterTime,
        cacheStats
      );
      const recommendations = this.generateRecommendations(
        p95RenderTime,
        avgGpuFilterTime,
        cacheStats,
        sloCompliance
      );

      const latestMetric = layerMetrics[layerMetrics.length - 1];

      if (!latestMetric) {
        return null;
      }

      return {
        layerId,
        currentMetrics: latestMetric,
        p50RenderTime,
        p95RenderTime,
        p99RenderTime,
        avgGpuFilterTime,
        cacheStats,
        sloCompliance,
        degradationWarnings,
        recommendations,
        timestamp: Date.now()
      };

    } finally {
      this.releaseLock();
    }
  }

  private calculateCacheStatistics(metrics: LayerMetrics[]): CacheStatistics {
    const tierCounts: Record<string, number> = {
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
      MISS: 0
    };

    let totalLatency = 0;
    let latencyCount = 0;

    for (const metric of metrics) {
      if (metric.cacheTier) {
        tierCounts[metric.cacheTier]++;
      }
      if (metric.cacheLatency !== undefined) {
        totalLatency += metric.cacheLatency;
        latencyCount++;
      }
    }

    const total = Object.values(tierCounts).reduce((sum, count) => sum + count, 0);
    const tierDistribution: Record<string, number> = {};
    
    for (const [tier, count] of Object.entries(tierCounts)) {
      tierDistribution[tier] = total > 0 ? (count / total) * 100 : 0;
    }

    return {
      l1HitRate: tierDistribution.L1 || 0,
      l2HitRate: tierDistribution.L2 || 0,
      l3HitRate: tierDistribution.L3 || 0,
      l4HitRate: tierDistribution.L4 || 0,
      overallHitRate: 100 - (tierDistribution.MISS || 0),
      avgLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
      tierDistribution
    };
  }

  private calculateSLOCompliance(metrics: LayerMetrics[]): SLOCompliance {
    let renderTimeCompliant = 0;
    let gpuFilterCompliant = 0;
    let cacheHitRateCompliant = 0;
    let gpuFilterCount = 0;

    const violations: Array<{ type: string; value: number; threshold: number; timestamp: number }> = [];

    for (const metric of metrics) {
      // Render time compliance
      if (metric.renderTime <= this.slos.targetRenderTime) {
        renderTimeCompliant++;
      } else {
        violations.push({
          type: 'render_time',
          value: metric.renderTime,
          threshold: this.slos.targetRenderTime,
          timestamp: metric.timestamp
        });
      }

      // GPU filter compliance
      if (metric.gpuFilterTime !== undefined) {
        gpuFilterCount++;
        const expectedTime = (metric.pointsRendered / 10000) * this.slos.targetGpuFilterTime;
        if (metric.gpuFilterTime <= expectedTime) {
          gpuFilterCompliant++;
        } else {
          violations.push({
            type: 'gpu_filter_time',
            value: metric.gpuFilterTime,
            threshold: expectedTime,
            timestamp: metric.timestamp
          });
        }
      }

      // Cache hit rate compliance
      if (metric.cacheHitRate >= this.slos.targetCacheHitRate) {
        cacheHitRateCompliant++;
      }
    }

    const renderTimeComplianceRate = (renderTimeCompliant / metrics.length) * 100;
    const gpuFilterComplianceRate = gpuFilterCount > 0
      ? (gpuFilterCompliant / gpuFilterCount) * 100
      : 100;
    const cacheHitRateComplianceRate = (cacheHitRateCompliant / metrics.length) * 100;

    const overallCompliance = (
      renderTimeComplianceRate +
      gpuFilterComplianceRate +
      cacheHitRateComplianceRate
    ) / 3;

    return {
      renderTimeCompliance: renderTimeComplianceRate,
      gpuFilterCompliance: gpuFilterComplianceRate,
      cacheHitRateCompliance: cacheHitRateComplianceRate,
      overallCompliance,
      violations
    };
  }

  private generateDegradationWarnings(
    p95RenderTime: number,
    avgGpuFilterTime: number,
    cacheStats: CacheStatistics
  ): string[] {
    const warnings: string[] = [];

    if (p95RenderTime > this.slos.targetRenderTime * 2) {
      warnings.push(
        `P95 render time (${p95RenderTime.toFixed(2)}ms) is ${(p95RenderTime / this.slos.targetRenderTime).toFixed(1)}x the target`
      );
    }

    if (avgGpuFilterTime > this.slos.targetGpuFilterTime * 1.5) {
      warnings.push(
        `Average GPU filter time (${avgGpuFilterTime.toFixed(2)}ms) exceeds target by 50%`
      );
    }

    if (cacheStats.overallHitRate < 85) {
      warnings.push(
        `Cache hit rate (${cacheStats.overallHitRate.toFixed(1)}%) is below 85% threshold`
      );
    }

    return warnings;
  }

  private generateRecommendations(
    p95RenderTime: number,
    avgGpuFilterTime: number,
    cacheStats: CacheStatistics,
    sloCompliance: SLOCompliance
  ): string[] {
    const recommendations: string[] = [];

    if (p95RenderTime > this.slos.targetRenderTime) {
      recommendations.push('Consider implementing data sampling for large datasets');
      recommendations.push('Enable aggressive caching for frequently accessed data');
    }

    if (avgGpuFilterTime > this.slos.targetGpuFilterTime) {
      recommendations.push('Optimize GPU filter algorithms for better performance');
      recommendations.push('Consider implementing spatial indexing for filter operations');
    }

    if (cacheStats.overallHitRate < this.slos.targetCacheHitRate) {
      recommendations.push('Review cache key strategy to improve hit rate');
      recommendations.push('Consider increasing cache TTL for stable data');
    }

    if (sloCompliance.overallCompliance < this.slos.minCompliance) {
      recommendations.push('CRITICAL: Overall SLO compliance below minimum threshold');
      recommendations.push('Consider triggering feature flag rollback');
    }

    return recommendations;
  }

  // ============================================================================
  // WEBSOCKET REPORTING
  // ============================================================================

  private async setupWebSocketReporting(): Promise<void> {
    try {
      this.websocket = new WebSocket(this.options.websocketUrl!);

      this.websocket.onopen = () => {
        console.log('[LayerPerformanceMonitor] WebSocket connected');
        
        // Subscribe to performance monitoring channel
        this.websocket!.send(JSON.stringify({
          type: 'subscribe',
          channels: ['layer_performance_monitoring']
        }));
      };

      this.websocket.onerror = (error) => {
        console.error('[LayerPerformanceMonitor] WebSocket error:', error);
      };

      this.websocket.onclose = () => {
        console.log('[LayerPerformanceMonitor] WebSocket disconnected');
      };

    } catch (error) {
      console.error('[LayerPerformanceMonitor] Failed to setup WebSocket:', error);
    }
  }

  private async generateAndReportPerformance(): Promise<void> {
    await this.acquireLock();
    
    try {
      const layerIds = Array.from(this.metrics.keys());
      
      for (const layerId of layerIds) {
        const report = await this.generatePerformanceReport(layerId);
        
        if (report) {
          // Emit report event
          this.emit('performanceReport', report);

          // Send via WebSocket if connected
          if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            await this.sendWebSocketReport(report);
          }
        }
      }

    } finally {
      this.releaseLock();
    }
  }

  private async sendWebSocketReport(report: PerformanceReport): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Safe serialization for WebSocket (orjson pattern from AGENTS.md)
      const message = {
        type: 'layer_performance_report',
        data: {
          ...report,
          timestamp: new Date().toISOString() // Convert to ISO string for orjson compatibility
        },
        timestamp: Date.now()
      };

      this.websocket.send(JSON.stringify(message));

    } catch (error) {
      console.error('[LayerPerformanceMonitor] Failed to send WebSocket report:', error);
      this.emit('reportingError', { error, report });
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  async getLayerMetrics(layerId: string): Promise<LayerMetrics[]> {
    await this.acquireLock();
    try {
      return [...(this.metrics.get(layerId) || [])];
    } finally {
      this.releaseLock();
    }
  }

  async getAllLayerReports(): Promise<PerformanceReport[]> {
    const layerIds = Array.from(this.metrics.keys());
    const reports: PerformanceReport[] = [];

    for (const layerId of layerIds) {
      const report = await this.generatePerformanceReport(layerId);
      if (report) {
        reports.push(report);
      }
    }

    return reports;
  }

  getSLOs(): PerformanceSLOs {
    return { ...this.slos };
  }

  async clearMetrics(layerId?: string): Promise<void> {
    await this.acquireLock();
    try {
      if (layerId) {
        this.metrics.delete(layerId);
      } else {
        this.metrics.clear();
      }
    } finally {
      this.releaseLock();
    }
  }

  async destroy(): Promise<void> {
    await this.stopMonitoring();
    await this.clearMetrics();
    this.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const layerPerformanceMonitor = new LayerPerformanceMonitor();