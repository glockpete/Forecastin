/**
 * Layer Validation Utilities
 * Comprehensive validation system for layer configurations following kepler.gl patterns
 * with forecastin-specific compliance and performance requirements
 */

import {
  LayerConfig,
  VisualChannel,
  VisualChannelScale,
  LayerData,
  LayerType,
  VisualChannelValue
} from '../types/layer-types';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: any;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  value?: any;
  impact?: 'performance' | 'usability' | 'compliance';
}

export interface ValidationSuggestion {
  code: string;
  message: string;
  action: string;
  field?: string;
  priority: 'high' | 'medium' | 'low';
}

export class LayerValidationUtils {
  /**
   * Comprehensive layer configuration validation
   */
  static validateLayerConfig(config: LayerConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Validate required fields
    this.validateRequiredFields(config, errors);
    
    // Validate layer type specific requirements
    this.validateLayerType(config, errors, warnings);
    
    // Validate visual channels
    this.validateVisualChannels(config, errors, warnings, suggestions);
    
    // Validate performance configuration
    this.validatePerformanceConfig(config, warnings, suggestions);
    
    // Validate compliance settings
    this.validateComplianceConfig(config, errors, warnings);
    
    // Validate feature flags
    this.validateFeatureFlags(config, warnings, suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate visual channel configuration
   */
  static validateVisualChannel(
    channelName: string, 
    channel: VisualChannel
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Basic validation
    if (!channelName || typeof channelName !== 'string') {
      errors.push({
        code: 'INVALID_CHANNEL_NAME',
        message: 'Channel name must be a non-empty string',
        severity: 'error'
      });
    }

    if (!channel || typeof channel !== 'object') {
      errors.push({
        code: 'INVALID_CHANNEL_OBJECT',
        message: 'Channel must be a valid VisualChannel object',
        severity: 'error'
      });
      return { isValid: false, errors, warnings, suggestions };
    }

    // Validate channel properties
    if (!channel.property || typeof channel.property !== 'string') {
      errors.push({
        code: 'INVALID_CHANNEL_PROPERTY',
        message: 'Channel property must be a string',
        field: 'property',
        value: channel.property,
        severity: 'error'
      });
    }

    // Validate channel type
    if (!['categorical', 'quantitative', 'ordinal'].includes(channel.type)) {
      errors.push({
        code: 'INVALID_CHANNEL_TYPE',
        message: 'Channel type must be categorical, quantitative, or ordinal',
        field: 'type',
        value: channel.type,
        severity: 'error'
      });
    }

    // Validate scale configuration
    if (channel.scale) {
      this.validateVisualChannelScale(channel.scale, errors, warnings);
    }

    // Validate default value
    if (channel.defaultValue !== undefined) {
      this.validateChannelValue(channel.defaultValue, channel.type, errors, warnings);
    }

    // Validate aggregation
    if (channel.aggregation && !['sum', 'mean', 'min', 'max', 'count'].includes(channel.aggregation)) {
      errors.push({
        code: 'INVALID_AGGREGATION',
        message: 'Invalid aggregation type',
        field: 'aggregation',
        value: channel.aggregation,
        severity: 'error'
      });
    }

    // Validate encoding
    if (channel.encoding && !['x', 'y', 'color', 'size', 'opacity', 'text'].includes(channel.encoding)) {
      warnings.push({
        code: 'INVALID_ENCODING',
        message: 'Unknown encoding type, may not be supported by all renderers',
        field: 'encoding',
        value: channel.encoding,
        impact: 'usability'
      });
    }

    // Validate condition
    if (channel.condition) {
      this.validateChannelCondition(channel.condition, errors, warnings);
    }

    // Performance suggestions
    if (channel.scale && channel.scale.type === 'linear' && channel.scale.domain.length > 2) {
      suggestions.push({
        code: 'OPTIMIZE_SCALE_DOMAIN',
        message: 'Consider using quantized scale for large domains',
        action: 'Use quantized scale for better performance',
        field: 'scale.domain',
        priority: 'medium'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate visual channel scale configuration
   */
  private static validateVisualChannelScale(
    scale: VisualChannelScale, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): void {
    // Validate scale type
    if (!['linear', 'log', 'sqrt', 'quantize', 'ordinal'].includes(scale.type)) {
      errors.push({
        code: 'INVALID_SCALE_TYPE',
        message: 'Invalid scale type',
        field: 'scale.type',
        value: scale.type,
        severity: 'error'
      });
    }

    // Validate domain
    if (!scale.domain || !Array.isArray(scale.domain) || scale.domain.length < 2) {
      errors.push({
        code: 'INVALID_SCALE_DOMAIN',
        message: 'Scale domain must be an array with at least 2 elements',
        field: 'scale.domain',
        value: scale.domain,
        severity: 'error'
      });
    } else {
      // Validate domain values
      for (let i = 0; i < scale.domain.length; i++) {
        const value = scale.domain[i];
        if (typeof value !== 'number' && typeof value !== 'string') {
          errors.push({
            code: 'INVALID_SCALE_DOMAIN_VALUE',
            message: 'Scale domain values must be numbers or strings',
            field: `scale.domain[${i}]`,
            value: value,
            severity: 'error'
          });
        }
      }

      // Check for domain range issues
      if (scale.type === 'linear' && typeof scale.domain[0] === 'number' && typeof scale.domain[1] === 'number') {
        if (scale.domain[0] === scale.domain[1]) {
          warnings.push({
            code: 'DEGENERATE_SCALE_DOMAIN',
            message: 'Scale domain has identical min and max values',
            field: 'scale.domain',
            impact: 'performance'
          });
        }
      }
    }

    // Validate range
    if (!scale.range || !Array.isArray(scale.range) || scale.range.length < 2) {
      errors.push({
        code: 'INVALID_SCALE_RANGE',
        message: 'Scale range must be an array with at least 2 elements',
        field: 'scale.range',
        value: scale.range,
        severity: 'error'
      });
    }

    // Validate scale consistency
    if (scale.type === 'ordinal') {
      if (scale.domain.length !== scale.range.length) {
        warnings.push({
          code: 'MISMATCHED_ORDINAL_SCALE',
          message: 'Ordinal scale domain and range have different lengths',
          field: 'scale',
          impact: 'usability'
        });
      }
    }
  }

  /**
   * Validate channel condition
   */
  private static validateChannelCondition(
    condition: { test: string; value: VisualChannelValue },
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!condition.test || typeof condition.test !== 'string') {
      errors.push({
        code: 'INVALID_CONDITION_TEST',
        message: 'Condition test must be a string',
        field: 'condition.test',
        value: condition.test,
        severity: 'error'
      });
    }

    // Basic validation for condition expression (simplified)
    if (condition.test.length > 200) {
      warnings.push({
        code: 'COMPLEX_CONDITION',
        message: 'Complex condition may impact performance',
        field: 'condition.test',
        impact: 'performance'
      });
    }
  }

  /**
   * Validate channel value against type
   */
  private static validateChannelValue(
    value: VisualChannelValue,
    type: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    switch (type) {
      case 'quantitative':
        if (value !== null && value !== undefined && typeof value !== 'number') {
          errors.push({
            code: 'INVALID_QUANTITATIVE_VALUE',
            message: 'Quantitative channel values must be numbers',
            value,
            severity: 'error'
          });
        }
        break;
      case 'categorical':
        if (value !== null && value !== undefined && typeof value !== 'string') {
          warnings.push({
            code: 'NON_STRING_CATEGORICAL',
            message: 'Categorical channel values should be strings',
            value,
            impact: 'usability'
          });
        }
        break;
      case 'ordinal':
        if (value !== null && value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
          warnings.push({
            code: 'INVALID_ORDINAL_VALUE',
            message: 'Ordinal channel values should be strings or numbers',
            value,
            impact: 'usability'
          });
        }
        break;
    }
  }

  /**
   * Validate required fields
   */
  private static validateRequiredFields(config: LayerConfig, errors: ValidationError[]): void {
    const requiredFields = [
      { field: 'id', value: config.id },
      { field: 'type', value: config.type },
      { field: 'name', value: config.name }
    ];

    for (const { field, value } of requiredFields) {
      if (!value) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${field}' is missing`,
          field,
          severity: 'error'
        });
      }
    }

    // Validate ID format
    if (config.id && !/^[a-zA-Z0-9_-]+$/.test(config.id)) {
      errors.push({
        code: 'INVALID_ID_FORMAT',
        message: 'Layer ID must contain only alphanumeric characters, hyphens, and underscores',
        field: 'id',
        value: config.id,
        severity: 'error'
      });
    }
  }

  /**
   * Validate layer type specific requirements
   */
  private static validateLayerType(
    config: LayerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const validTypes: LayerType[] = [
      'point', 'polygon', 'linestring', 'heatmap', 
      'cluster', 'hexagon', 'geojson', 'terrain', 'imagery'
    ];

    if (!validTypes.includes(config.type)) {
      errors.push({
        code: 'INVALID_LAYER_TYPE',
        message: `Invalid layer type: ${config.type}`,
        field: 'type',
        value: config.type,
        severity: 'error'
      });
    }

    // Type-specific validation
    switch (config.type) {
      case 'point':
        if (!config.position) {
          errors.push({
            code: 'MISSING_POSITION_FOR_POINT',
            message: 'Point layers require position configuration',
            field: 'position',
            severity: 'error'
          });
        }
        break;
      case 'polygon':
      case 'linestring':
        // These require geometry data
        break;
    }
  }

  /**
   * Validate visual channels
   */
  private static validateVisualChannels(
    config: LayerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): void {
    // Check for required visual channels based on layer type
    const requiredChannels = this.getRequiredChannelsForType(config.type);
    const hasRequiredChannels = requiredChannels.every(channelName => 
      config[channelName as keyof LayerConfig]
    );

    if (!hasRequiredChannels) {
      const missingChannels = requiredChannels.filter(channelName => 
        !config[channelName as keyof LayerConfig]
      );
      
      warnings.push({
        code: 'MISSING_REQUIRED_CHANNELS',
        message: `Layer type '${config.type}' should have channels: ${missingChannels.join(', ')}`,
        field: 'visualChannels',
        impact: 'usability'
      });
    }

    // Validate channel configurations if present
    if (config.color) {
      const colorValidation = this.validateVisualChannel('color', config.color);
      errors.push(...colorValidation.errors);
      warnings.push(...colorValidation.warnings);
    }

    if (config.size) {
      const sizeValidation = this.validateVisualChannel('size', config.size);
      errors.push(...sizeValidation.errors);
      warnings.push(...sizeValidation.warnings);
    }
  }

  /**
   * Get required channels for layer type
   */
  private static getRequiredChannelsForType(type: LayerType): string[] {
    const requirements: Record<LayerType, string[]> = {
      'point': ['position', 'color'],
      'polygon': ['color'],
      'linestring': ['color'],
      'heatmap': ['position'],
      'cluster': ['position', 'color'],
      'hexagon': ['position', 'color'],
      'geojson': ['color'],
      'terrain': ['position'],
      'imagery': ['position']
    };

    return requirements[type] || [];
  }

  /**
   * Validate performance configuration
   */
  private static validatePerformanceConfig(
    config: LayerConfig,
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): void {
    // Validate cache TTL
    if (config.cacheTTL && config.cacheTTL < 1000) {
      warnings.push({
        code: 'LOW_CACHE_TTL',
        message: 'Cache TTL below 1 second may cause performance issues',
        field: 'cacheTTL',
        value: config.cacheTTL,
        impact: 'performance'
      });
    }

    if (config.cacheTTL && config.cacheTTL > 3600000) {
      warnings.push({
        code: 'HIGH_CACHE_TTL',
        message: 'Cache TTL above 1 hour may serve stale data',
        field: 'cacheTTL',
        value: config.cacheTTL,
        impact: 'performance'
      });
    }

    // Suggest cache optimization
    if (!config.cacheEnabled && config.data && config.data.length > 1000) {
      suggestions.push({
        code: 'ENABLE_CACHING',
        message: 'Large datasets benefit from caching',
        action: 'Enable cache for better performance',
        field: 'cacheEnabled',
        priority: 'high'
      });
    }
  }

  /**
   * Validate compliance configuration
   */
  private static validateComplianceConfig(
    config: LayerConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Validate data classification
    const validClassifications = ['public', 'internal', 'confidential', 'restricted'];
    if (config.dataClassification && !validClassifications.includes(config.dataClassification)) {
      errors.push({
        code: 'INVALID_DATA_CLASSIFICATION',
        message: `Invalid data classification: ${config.dataClassification}`,
        field: 'dataClassification',
        value: config.dataClassification,
        severity: 'error'
      });
    }

    // Check audit requirements
    if (config.dataClassification === 'confidential' || config.dataClassification === 'restricted') {
      if (!config.auditEnabled) {
        errors.push({
          code: 'MISSING_AUDIT_FOR_SENSITIVE_DATA',
          message: 'Audit logging is required for sensitive data classifications',
          field: 'auditEnabled',
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate feature flags
   */
  private static validateFeatureFlags(
    config: LayerConfig,
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): void {
    // Validate rollout percentage
    if (config.rolloutPercentage !== undefined) {
      if (config.rolloutPercentage < 0 || config.rolloutPercentage > 100) {
        warnings.push({
          code: 'INVALID_ROLLOUT_PERCENTAGE',
          message: 'Rollout percentage must be between 0 and 100',
          field: 'rolloutPercentage',
          value: config.rolloutPercentage,
          impact: 'usability'
        });
      }
    }

    // Suggest feature flag usage
    if (config.realTimeEnabled && !config.featureFlag) {
      suggestions.push({
        code: 'FEATURE_FLAG_FOR_REALTIME',
        message: 'Consider using feature flags for real-time updates',
        action: 'Add feature flag for gradual rollout',
        field: 'featureFlag',
        priority: 'medium'
      });
    }
  }

  /**
   * Validate layer data
   */
  static validateLayerData(data: LayerData[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!Array.isArray(data)) {
      errors.push({
        code: 'INVALID_DATA_ARRAY',
        message: 'Layer data must be an array',
        severity: 'error'
      });
      return { isValid: false, errors, warnings, suggestions };
    }

    // Check data size
    if (data.length > 100000) {
      warnings.push({
        code: 'LARGE_DATASET',
        message: 'Dataset exceeds 100,000 features may impact performance',
        impact: 'performance'
      });
    }

    if (data.length === 0) {
      suggestions.push({
        code: 'EMPTY_DATASET',
        message: 'Empty dataset will not render any features',
        action: 'Add data or hide layer',
        priority: 'low'
      });
    }

    // Validate individual data points
    data.slice(0, 100).forEach((item, index) => { // Validate first 100 items
      this.validateDataPoint(item, index, errors, warnings);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate individual data point
   */
  private static validateDataPoint(
    item: LayerData,
    index: number,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Validate ID
    if (!item.id) {
      errors.push({
        code: 'MISSING_DATA_POINT_ID',
        message: `Data point at index ${index} is missing ID`,
        severity: 'error'
      });
    }

    // Validate geometry
    if (item.geometry) {
      const validGeometryTypes = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'];
      if (!validGeometryTypes.includes(item.geometry.type)) {
        errors.push({
          code: 'INVALID_GEOMETRY_TYPE',
          message: `Invalid geometry type: ${item.geometry.type}`,
          field: `geometry.type`,
          value: item.geometry.type,
          severity: 'error'
        });
      }
    }

    // Validate properties
    if (!item.properties || typeof item.properties !== 'object') {
      warnings.push({
        code: 'MISSING_PROPERTIES',
        message: `Data point at index ${index} is missing properties`,
        field: `properties`,
        impact: 'usability'
      });
    }
  }

  /**
   * Performance benchmark validation
   */
  static validatePerformanceBenchmark(results: {
    operation: string;
    duration: number;
    dataSize: number;
    memoryUsage: number;
  }): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check SLO compliance (1.25ms target)
    if (results.duration > 1.25) {
      warnings.push({
        code: 'SLO_VIOLATION',
        message: `Operation exceeded 1.25ms SLO: ${results.duration.toFixed(2)}ms`,
        impact: 'performance'
      });
    }

    // Check memory usage
    if (results.memoryUsage > 50 * 1024 * 1024) { // 50MB
      warnings.push({
        code: 'HIGH_MEMORY_USAGE',
        message: `Memory usage is high: ${(results.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        impact: 'performance'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: []
    };
  }

  /**
   * Generate validation report
   */
  static generateValidationReport(validationResult: ValidationResult): string {
    const { isValid, errors, warnings, suggestions } = validationResult;
    
    let report = `Layer Validation Report\n`;
    report += `Status: ${isValid ? 'VALID' : 'INVALID'}\n\n`;

    if (errors.length > 0) {
      report += `Errors (${errors.length}):\n`;
      errors.forEach(error => {
        report += `  - ${error.code}: ${error.message}\n`;
        if (error.field) report += `    Field: ${error.field}\n`;
      });
      report += `\n`;
    }

    if (warnings.length > 0) {
      report += `Warnings (${warnings.length}):\n`;
      warnings.forEach(warning => {
        report += `  - ${warning.code}: ${warning.message}\n`;
        if (warning.field) report += `    Field: ${warning.field}\n`;
      });
      report += `\n`;
    }

    if (suggestions.length > 0) {
      report += `Suggestions (${suggestions.length}):\n`;
      suggestions.forEach(suggestion => {
        report += `  - ${suggestion.code}: ${suggestion.message}\n`;
        report += `    Action: ${suggestion.action}\n`;
        report += `    Priority: ${suggestion.priority}\n`;
      });
      report += `\n`;
    }

    return report;
  }
}

export default LayerValidationUtils;