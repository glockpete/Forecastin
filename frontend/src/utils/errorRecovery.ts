/**
 * Advanced Error Recovery System
 * Implements circuit breakers, exponential backoff, and resilience patterns
 * Following forecastin patterns for WebSocket resilience and error handling
 */

import { PerformanceMonitor } from './stateManager';
import { logger } from '@lib/logger';

// Circuit breaker states
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeout: number;
  expectedErrors?: Array<new (...args: any[]) => Error>;
  resetTimeout?: number;
  monitoringWindow?: number;
}

// Circuit breaker for failing operations
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private lastFailure = 0;
  private successes = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly performanceMonitor: PerformanceMonitor;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      resetTimeout: 30000, // 30 seconds
      monitoringWindow: 60000, // 1 minute
      ...config,
      failureThreshold: config.failureThreshold ?? 5,
      timeout: config.timeout ?? 60000 // 1 minute
    };
    this.performanceMonitor = new PerformanceMonitor();
  }

  // Execute operation with circuit breaker protection
  async execute<T>(
    operation: () => Promise<T>,
    operationKey: string
  ): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      // Check circuit breaker state
      if (!this.canExecute()) {
        const duration = performance.now() - startTime;
        this.performanceMonitor.recordMetric(`${operationKey}_blocked`, duration);
        throw new Error(`Circuit breaker is ${this.state} for ${operationKey}`);
      }

      // Execute operation
      const result = await operation();
      
      // Record success
      this.recordSuccess();
      this.performanceMonitor.recordMetric(`${operationKey}_success`, performance.now() - startTime);
      
      return result;
    } catch (error) {
      // Check if this is an expected error type
      if (this.isExpectedError(error)) {
        const duration = performance.now() - startTime;
        this.performanceMonitor.recordMetric(`${operationKey}_expected_error`, duration);
        return null;
      }

      // Record failure
      this.recordFailure();
      this.performanceMonitor.recordMetric(`${operationKey}_failure`, performance.now() - startTime);
      
      throw error;
    }
  }

  private canExecute(): boolean {
    const now = Date.now();
    
    switch (this.state) {
      case 'closed':
        return true;
        
      case 'open':
        if (now - this.lastFailure >= (this.config.resetTimeout || 30000)) {
          this.state = 'half-open';
          this.successes = 0;
          return true;
        }
        return false;
        
      case 'half-open':
        return true;
        
      default:
        return true;
    }
  }

  private recordSuccess() {
    this.failures = 0;
    
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= 3) { // Allow 3 successes before closing
        this.state = 'closed';
      }
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  private isExpectedError(error: any): boolean {
    if (!this.config.expectedErrors) return false;
    
    return this.config.expectedErrors.some(ErrorClass => 
      error instanceof ErrorClass
    );
  }

  // Get current state and statistics
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      performance: this.performanceMonitor.getStats('circuit_breaker_metrics')
    };
  }

  // Reset circuit breaker (for testing or manual recovery)
  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = 0;
    // Cannot reassign readonly property - create new instance via constructor instead
    // this.performanceMonitor = new PerformanceMonitor();
  }
}

// Exponential backoff retry mechanism
export class ExponentialBackoff {
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;
  private multiplier: number;
  private jitter: boolean;

  constructor(options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    multiplier?: number;
    jitter?: boolean;
  } = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.multiplier = options.multiplier || 2;
    this.jitter = options.jitter !== false; // Jitter enabled by default
  }

  async retry<T>(
    operation: () => Promise<T>,
    operationKey: string,
    shouldRetry?: (error: Error, attempt: number) => boolean
  ): Promise<T | null> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (attempt === this.maxRetries || 
            (shouldRetry && !shouldRetry(lastError, attempt))) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);

        logger.debug(`Retry ${attempt + 1}/${this.maxRetries} for ${operationKey} in ${delay}ms`);

        await this.sleep(delay);
      }
    }

    logger.error(`All retries exhausted for ${operationKey}:`, lastError);
    return null;
  }

  private calculateDelay(attempt: number): number {
    const baseDelay = this.baseDelay * Math.pow(this.multiplier, attempt);
    const delay = Math.min(baseDelay, this.maxDelay);

    // Add jitter to prevent thundering herd
    if (this.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      return delay + (Math.random() - 0.5) * jitterAmount * 2;
    }

    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Error categorization for different recovery strategies
export class ErrorCategorizer {
  // Categorize errors for appropriate recovery strategies
  static categorize(error: Error): {
    category: 'network' | 'validation' | 'timeout' | 'server' | 'unknown';
    recoverable: boolean;
    retryable: boolean;
  } {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (message.includes('network') || 
        message.includes('fetch') || 
        message.includes('connection') ||
        name.includes('networkerror')) {
      return {
        category: 'network',
        recoverable: true,
        retryable: true
      };
    }

    // Timeout errors
    if (message.includes('timeout') || 
        message.includes('timed out') ||
        name.includes('timeout')) {
      return {
        category: 'timeout',
        recoverable: true,
        retryable: true
      };
    }

    // Validation errors
    if (message.includes('validation') || 
        message.includes('invalid') ||
        message.includes('bad request') ||
        name.includes('validationerror')) {
      return {
        category: 'validation',
        recoverable: false,
        retryable: false
      };
    }

    // Server errors
    if (message.includes('server error') || 
        message.includes('internal server error') ||
        message.includes('500') ||
        name.includes('servererror')) {
      return {
        category: 'server',
        recoverable: true,
        retryable: true
      };
    }

    return {
      category: 'unknown',
      recoverable: true,
      retryable: false
    };
  }

  // Get appropriate recovery strategy based on error
  static getRecoveryStrategy(error: Error): {
    strategy: 'retry' | 'circuit_breaker' | 'fallback' | 'abort';
    priority: number;
  } {
    const categorization = this.categorize(error);

    switch (categorization.category) {
      case 'network':
        return { strategy: 'retry', priority: 1 };
      case 'timeout':
        return { strategy: 'retry', priority: 2 };
      case 'server':
        return { strategy: 'circuit_breaker', priority: 3 };
      case 'validation':
        return { strategy: 'abort', priority: 4 };
      default:
        return { strategy: 'fallback', priority: 5 };
    }
  }
}

// Health check system for monitoring system health
export class HealthChecker {
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private healthStatus: Map<string, { healthy: boolean; lastCheck: number; latency: number }> = new Map();

  registerCheck(name: string, check: () => Promise<boolean>) {
    this.checks.set(name, check);
  }

  async runChecks(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, { healthy: boolean; latency: number; lastCheck: number }>;
  }> {
    const results: Record<string, { healthy: boolean; latency: number; lastCheck: number }> = {};
    let healthyCount = 0;

    const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      const startTime = performance.now();
      try {
        const result = await check();
        const latency = performance.now() - startTime;
        
        results[name] = {
          healthy: result,
          latency,
          lastCheck: Date.now()
        };
        
        this.healthStatus.set(name, { healthy: result, lastCheck: Date.now(), latency });
        
        if (result) healthyCount++;
      } catch (error) {
        const latency = performance.now() - startTime;
        
        results[name] = {
          healthy: false,
          latency,
          lastCheck: Date.now()
        };
        
        this.healthStatus.set(name, { healthy: false, lastCheck: Date.now(), latency });
      }
    });

    await Promise.all(checkPromises);

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === this.checks.size) {
      overall = 'healthy';
    } else if (healthyCount > this.checks.size * 0.5) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return { overall, checks: results };
  }

  getStatus() {
    const status: Record<string, { healthy: boolean; latency: number; lastCheck: number }> = {};
    this.healthStatus.forEach((value, key) => {
      status[key] = value;
    });
    return status;
  }
}

// Error monitoring and alerting
export class ErrorMonitor {
  private errors: Array<{
    timestamp: number;
    error: Error;
    context: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];

  private maxErrors = 1000;
  private alertThresholds = {
    'critical': 1,
    'high': 5,
    'medium': 10,
    'low': 20
  };

  recordError(error: Error, context?: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    // Add to error log
    this.errors.push({
      timestamp: Date.now(),
      error,
      context,
      severity
    });

    // Maintain size limit
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Check for alert conditions
    this.checkAlertConditions(severity);

    // Log error based on severity
    switch (severity) {
      case 'critical':
        logger.error('CRITICAL ERROR:', error, context);
        break;
      case 'high':
        logger.error('HIGH SEVERITY ERROR:', error, context);
        break;
      case 'medium':
        logger.warn('MEDIUM SEVERITY ERROR:', error, context);
        break;
      case 'low':
        logger.info('LOW SEVERITY ERROR:', error, context);
        break;
    }
  }

  private checkAlertConditions(severity: string) {
    const recentErrors = this.errors.filter(
      e => e.severity === severity && 
           Date.now() - e.timestamp < 60000 // Last minute
    );

    if (recentErrors.length >= this.alertThresholds[severity as keyof typeof this.alertThresholds]) {
      logger.warn(`Alert: ${severity} error threshold exceeded (${recentErrors.length} in last minute)`);
      // Here you could trigger actual alerts/notifications
    }
  }

  getErrorStats(timeWindowMs = 300000) { // 5 minutes default
    const cutoff = Date.now() - timeWindowMs;
    const recentErrors = this.errors.filter(e => e.timestamp > cutoff);

    const stats = {
      total: recentErrors.length,
      bySeverity: {
        critical: recentErrors.filter(e => e.severity === 'critical').length,
        high: recentErrors.filter(e => e.severity === 'high').length,
        medium: recentErrors.filter(e => e.severity === 'medium').length,
        low: recentErrors.filter(e => e.severity === 'low').length
      },
      byCategory: {} as Record<string, number>
    };

    // Categorize errors
    recentErrors.forEach(({ error }) => {
      const category = ErrorCategorizer.categorize(error).category;
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });

    return stats;
  }

  clearErrors() {
    this.errors = [];
  }
}

// Global error recovery system
export class GlobalErrorRecovery {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private healthChecker = new HealthChecker();
  private errorMonitor = new ErrorMonitor();
  private exponentialBackoff = new ExponentialBackoff();

  // Register a circuit breaker for an operation
  registerCircuitBreaker(key: string, config?: Partial<CircuitBreakerConfig>) {
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      timeout: 60000
    };
    this.circuitBreakers.set(key, new CircuitBreaker({ ...defaultConfig, ...config }));
  }

  // Execute operation with full error recovery
  async executeWithRecovery<T>(
    operationKey: string,
    operation: () => Promise<T>,
    options: {
      circuitBreaker?: boolean;
      retry?: boolean;
      fallback?: () => T;
    } = {}
  ): Promise<T | null> {
    try {
      const circuitBreaker = this.circuitBreakers.get(operationKey);
      
      if (options.circuitBreaker && circuitBreaker) {
        return await circuitBreaker.execute(operation, operationKey);
      }

      if (options.retry) {
        return await this.exponentialBackoff.retry(operation, operationKey, (error) => {
          const categorization = ErrorCategorizer.categorize(error);
          return categorization.retryable;
        });
      }

      return await operation();
    } catch (error) {
      this.errorMonitor.recordError(error as Error, { operationKey }, 'medium');

      if (options.fallback) {
        try {
          logger.warn(`Using fallback for ${operationKey}`);
          return options.fallback();
        } catch (fallbackError) {
          this.errorMonitor.recordError(fallbackError as Error, { 
            operationKey, 
            originalError: error 
          }, 'high');
          return null;
        }
      }
      
      return null;
    }
  }

  // Register health check
  registerHealthCheck(name: string, check: () => Promise<boolean>) {
    this.healthChecker.registerCheck(name, check);
  }

  // Get system health
  async getHealthStatus() {
    return await this.healthChecker.runChecks();
  }

  // Get error statistics
  getErrorStats() {
    return this.errorMonitor.getErrorStats();
  }

  // Get circuit breaker states
  getCircuitBreakerStates() {
    const states: Record<string, any> = {};
    this.circuitBreakers.forEach((breaker, key) => {
      states[key] = breaker.getState();
    });
    return states;
  }

  // Reset all circuit breakers
  resetCircuitBreakers() {
    this.circuitBreakers.forEach(breaker => breaker.reset());
  }
}

// Create global instance
export const globalErrorRecovery = new GlobalErrorRecovery();