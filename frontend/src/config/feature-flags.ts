/**
 * Feature Flag Configuration for Geospatial Layer System
 *
 * Implements gradual rollout strategy following forecastin's existing patterns:
 * - Gradual rollout: 10% → 25% → 50% → 100%
 * - Integration with ff.map_v1 for map/geospatial features
 * - Rollback capability with flag disabling
 */

import { logger } from '@lib/logger';

export interface FeatureFlagConfig {
  // Core geospatial layer flags (standardized dot notation)
  'ff.geo.layers_enabled': boolean;
  'ff.geo.point_layer_active': boolean;
  'ff.geo.clustering_enabled': boolean;
  'ff.geo.websocket_layers_enabled': boolean;

  // Performance and monitoring flags
  'ff.geo.performance_monitoring_enabled': boolean;
  'ff.geo.audit_logging_enabled': boolean;
  
  // Gradual rollout percentages for each component
  rollout_percentages: {
    core_layers: number;        // BaseLayer, LayerRegistry
    point_layers: number;       // PointLayer implementation
    websocket_integration: number; // Real-time updates
    visual_channels: number;    // Advanced visual channel system
  };
  
  // A/B testing flags for ML model variants
  ab_testing: {
    enabled: boolean;
    variants: {
      layer_rendering_performance: 'baseline' | 'optimized' | 'experimental';
      confidence_scoring_algorithm: 'standard' | 'calibrated' | 'enhanced';
      entity_caching_strategy: 'lru' | 'adaptive' | 'hierarchical';
    };
  };
  
  // Performance SLO targets
  performance_targets: {
    render_time_ms: number;        // Target: <10ms
    cache_hit_rate_percent: number; // Target: >99%
    throughput_rps: number;         // Target: >10,000 RPS
    memory_usage_mb: number;        // Target: <100MB
  };
  
  // Compliance and monitoring
  compliance: {
    audit_logging: boolean;
    performance_metrics_collection: boolean;
    error_tracking: boolean;
    data_privacy_validation: boolean;
  };
}

// Default configuration following forecastin patterns
const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  // Core geospatial flags - start disabled for safe rollout
  'ff.geo.layers_enabled': false,
  'ff.geo.point_layer_active': false,
  'ff.geo.clustering_enabled': false,
  'ff.geo.websocket_layers_enabled': false,

  // Performance monitoring flags
  'ff.geo.performance_monitoring_enabled': true,
  'ff.geo.audit_logging_enabled': true,
  
  // Gradual rollout percentages (start at 0%, gradually increase)
  rollout_percentages: {
    core_layers: 0,              // Start with 0% rollout
    point_layers: 0,
    websocket_integration: 0,
    visual_channels: 0
  },
  
  // A/B testing configuration
  ab_testing: {
    enabled: false,              // Disabled until basic functionality is stable
    variants: {
      layer_rendering_performance: 'baseline',
      confidence_scoring_algorithm: 'standard',
      entity_caching_strategy: 'lru'
    }
  },
  
  // Performance SLO targets (from AGENTS.md validated metrics)
  performance_targets: {
    render_time_ms: 10,          // Target: <10ms
    cache_hit_rate_percent: 99,  // Target: >99%
    throughput_rps: 10000,       // Target: >10,000 RPS
    memory_usage_mb: 100         // Target: <100MB
  },
  
  // Compliance settings
  compliance: {
    audit_logging: true,
    performance_metrics_collection: true,
    error_tracking: true,
    data_privacy_validation: true
  }
};

// Environment variable overrides (for deployment configuration)
const ENV_OVERRIDES: Partial<FeatureFlagConfig> = {
  'ff.geo.layers_enabled': process.env.REACT_APP_FF_GEOSPATIAL === 'true',
  'ff.geo.point_layer_active': process.env.REACT_APP_FF_POINT_LAYER === 'true',
  'ff.geo.clustering_enabled': process.env.REACT_APP_FF_CLUSTERING === 'true',
  'ff.geo.websocket_layers_enabled': process.env.REACT_APP_FF_WS_LAYERS === 'true',
  
  rollout_percentages: {
    core_layers: parseInt(process.env.REACT_APP_FF_CORE_ROLLOUT || '0'),
    point_layers: parseInt(process.env.REACT_APP_FF_POINT_ROLLOUT || '0'),
    websocket_integration: parseInt(process.env.REACT_APP_FF_WS_ROLLOUT || '0'),
    visual_channels: parseInt(process.env.REACT_APP_FF_VISUAL_ROLLOUT || '0')
  }
};

/**
 * Feature Flag Manager for Geospatial Layers
 */
export class LayerFeatureFlagManager {
  private config: FeatureFlagConfig;
  private userRolloutId: string;
  
  constructor(userRolloutId?: string) {
    // Initialize with default configuration
    this.config = { ...DEFAULT_FEATURE_FLAGS };
    
    // Apply environment variable overrides
    this.applyEnvironmentOverrides();
    
    // Set user rollout ID (for consistent rollout percentage)
    this.userRolloutId = userRolloutId || this.generateRolloutId();
    
    // Validate configuration on initialization
    this.validateConfiguration();
  }
  
  /**
   * Check if a specific feature flag is enabled for the current user
   */
  isEnabled(flagName: keyof FeatureFlagConfig): boolean {
    if (!this.isRolloutPercentageAllowed(flagName)) {
      return false;
    }
    
    // Check if flag is enabled
    const flagValue = this.config[flagName];
    if (typeof flagValue === 'boolean') {
      return flagValue;
    }
    
    return false;
  }
  
  /**
   * Check rollout percentage for gradual feature enablement
   */
  private isRolloutPercentageAllowed(flagName: keyof FeatureFlagConfig): boolean {
    // Determine which rollout percentage applies to this flag
    let rolloutPercentage = 0;
    
    switch (flagName) {
      case 'ff.geo.layers_enabled':
        rolloutPercentage = this.config.rollout_percentages.core_layers;
        break;
      case 'ff.geo.point_layer_active':
        rolloutPercentage = this.config.rollout_percentages.point_layers;
        break;
      case 'ff.geo.websocket_layers_enabled':
        rolloutPercentage = this.config.rollout_percentages.websocket_integration;
        break;
      case 'ff.geo.clustering_enabled':
      case 'ff.geo.performance_monitoring_enabled':
      case 'ff.geo.audit_logging_enabled':
        // These features use the visual_channels rollout percentage
        rolloutPercentage = this.config.rollout_percentages.visual_channels;
        break;
      default:
        return false; // Unknown flags are disabled
    }
    
    // Check if user is in the rollout percentage
    const userHash = this.hashUserId(this.userRolloutId + flagName);
    const userBucket = userHash % 100;
    
    return userBucket < rolloutPercentage;
  }
  
  /**
   * Enable gradual rollout of features
   */
  enableRollout(component: keyof FeatureFlagConfig['rollout_percentages'], percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error(`Invalid rollout percentage: ${percentage}. Must be between 0 and 100.`);
    }
    
    this.config.rollout_percentages[component] = percentage;

    // Log rollout change for compliance audit
    logger.info(`[LayerFeatureFlag] Rollout enabled: ${component} at ${percentage}%`);

    // Auto-enable related feature flags when rollout reaches 100%
    if (percentage === 100) {
      this.autoEnableRelatedFlags(component);
    }
  }
  
  /**
   * Automatically enable feature flags when rollout reaches 100%
   */
  private autoEnableRelatedFlags(component: keyof FeatureFlagConfig['rollout_percentages']): void {
    switch (component) {
      case 'core_layers':
        this.config['ff.geo.layers_enabled'] = true;
        break;
      case 'point_layers':
        this.config['ff.geo.point_layer_active'] = true;
        break;
      case 'websocket_integration':
        this.config['ff.geo.websocket_layers_enabled'] = true;
        break;
      case 'visual_channels':
        this.config['ff.geo.clustering_enabled'] = true;
        this.config['ff.geo.performance_monitoring_enabled'] = true;
        this.config['ff.geo.audit_logging_enabled'] = true;
        break;
    }
  }
  
  /**
   * Emergency rollback - disable all geospatial features immediately
   */
  emergencyRollback(): void {
    // Disable all core feature flags
    this.config['ff.geo.layers_enabled'] = false;
    this.config['ff.geo.point_layer_active'] = false;
    this.config['ff.geo.clustering_enabled'] = false;
    this.config['ff.geo.websocket_layers_enabled'] = false;
    
    // Reset all rollout percentages to 0%
    Object.keys(this.config.rollout_percentages).forEach(key => {
      this.config.rollout_percentages[key as keyof typeof this.config.rollout_percentages] = 0;
    });
    
    // Disable A/B testing
    this.config.ab_testing.enabled = false;

    logger.warn('[LayerFeatureFlag] Emergency rollback executed - all geospatial features disabled');
  }
  
  /**
   * Get current configuration state
   */
  getConfig(): FeatureFlagConfig {
    return { ...this.config };
  }
  
  /**
   * Check if a specific A/B test variant is active
   */
  isAbTestVariantActive(testName: keyof FeatureFlagConfig['ab_testing']['variants']): boolean {
    if (!this.config.ab_testing.enabled) {
      return false;
    }
    
    // Hash user ID to determine which variant they get
    const userHash = this.hashUserId(this.userRolloutId + testName);
    const variantIndex = userHash % 3; // 3 variants per test
    
    // Map variant index to actual variant
    const variants = ['baseline', 'optimized', 'experimental'];
    const assignedVariant = variants[variantIndex];
    
    return assignedVariant === this.config.ab_testing.variants[testName];
  }
  
  /**
   * Get performance targets for current A/B test configuration
   */
  getPerformanceTargets(): FeatureFlagConfig['performance_targets'] {
    if (this.isAbTestVariantActive('layer_rendering_performance')) {
      // Return adjusted targets based on A/B test variant
      switch (this.config.ab_testing.variants.layer_rendering_performance) {
        case 'optimized':
          return {
            ...this.config.performance_targets,
            render_time_ms: 8  // More aggressive target
          };
        case 'experimental':
          return {
            ...this.config.performance_targets,
            render_time_ms: 12  // Experimental might be slower initially
          };
        default:
          return this.config.performance_targets;
      }
    }
    
    return this.config.performance_targets;
  }
  
  /**
   * Validate configuration for consistency and safety
   */
  private validateConfiguration(): void {
    // Validate rollout percentages are within bounds
    Object.entries(this.config.rollout_percentages).forEach(([component, percentage]) => {
      if (percentage < 0 || percentage > 100) {
        throw new Error(`Invalid rollout percentage for ${component}: ${percentage}`);
      }
    });
    
    // Validate performance targets are reasonable
    if (this.config.performance_targets.render_time_ms > 50) {
      logger.warn('Performance target for render time is very high:', this.config.performance_targets.render_time_ms);
    }

    // Check compliance requirements
    if (!this.config.compliance.audit_logging && this.config.compliance.performance_metrics_collection) {
      logger.warn('Performance metrics collection enabled without audit logging');
    }
  }
  
  /**
   * Apply environment variable overrides to configuration
   */
  private applyEnvironmentOverrides(): void {
    Object.entries(ENV_OVERRIDES).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Type-safe assignment with proper type checking
        const configKey = key as keyof FeatureFlagConfig;
        if (typeof value === 'boolean' && typeof this.config[configKey] === 'boolean') {
          (this.config[configKey] as boolean) = value;
        } else if (typeof value === 'object' && typeof this.config[configKey] === 'object') {
          this.config[configKey] = value as any;
        }
      }
    });
  }
  
  /**
   * Generate consistent user rollout ID
   */
  private generateRolloutId(): string {
    // Generate a hash-based ID for consistent rollout
    // Note: slice(2, 11) extracts 9 characters, same as deprecated substr(2, 9)
    // substr(start, length) vs slice(start, end) where end is exclusive
    return `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
  
  /**
   * Hash user ID for consistent bucket assignment
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Get feature flag status summary for debugging
   */
  getStatusSummary(): any {
    return {
      userRolloutId: this.userRolloutId,
      coreFlags: {
        geospatialEnabled: this.isEnabled('ff.geo.layers_enabled'),
        pointLayerEnabled: this.isEnabled('ff.geo.point_layer_active'),
        clusteringEnabled: this.isEnabled('ff.geo.clustering_enabled'),
        wsEnabled: this.isEnabled('ff.geo.websocket_layers_enabled')
      },
      rolloutPercentages: this.config.rollout_percentages,
      abTesting: this.config.ab_testing,
      performanceTargets: this.getPerformanceTargets(),
      compliance: this.config.compliance
    };
  }
}

// Export singleton instance for global use
export const layerFeatureFlags = new LayerFeatureFlagManager();

// Export utility functions for easy access
export const {
  isEnabled,
  enableRollout,
  emergencyRollback,
  getConfig,
  isAbTestVariantActive,
  getPerformanceTargets,
  getStatusSummary
} = layerFeatureFlags;

// Export default configuration for external use
export default LayerFeatureFlagManager;