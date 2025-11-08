/**
 * Error Catalog with Stable Error Codes
 *
 * Centralized error taxonomy for the Forecastin frontend.
 * Each error has:
 * - Stable code (e.g., ERR_001)
 * - Category (network, validation, auth, etc.)
 * - Severity (critical, error, warning, info)
 * - User-facing message
 * - Developer context
 * - Recovery suggestions
 */

import { logger } from '@lib/logger';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  CRITICAL = 'critical', // System unusable, requires immediate attention
  ERROR = 'error',       // Feature broken, user action blocked
  WARNING = 'warning',   // Degraded experience, user can continue
  INFO = 'info',         // Informational, no user impact
}

/**
 * Error categories
 */
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  WEBSOCKET = 'websocket',
  CACHE = 'cache',
  RENDER = 'render',
  STATE = 'state',
  UNKNOWN = 'unknown',
}

/**
 * Error catalog entry
 */
export interface ErrorDefinition {
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  developerMessage: string;
  recoverySuggestions: readonly string[];
  retryable: boolean;
  reportToMonitoring: boolean;
}

/**
 * Error catalog - stable error definitions
 */
export const ERROR_CATALOG: Readonly<Record<string, ErrorDefinition>> = {
  // Network errors (ERR_1xx)
  ERR_101: {
    code: 'ERR_101',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.ERROR,
    userMessage: 'Unable to connect to the server. Please check your internet connection.',
    developerMessage: 'Network request failed - no response from server',
    recoverySuggestions: [
      'Check internet connection',
      'Verify API endpoint is accessible',
      'Check for CORS issues',
      'Retry request after delay',
    ],
    retryable: true,
    reportToMonitoring: true,
  },

  ERR_102: {
    code: 'ERR_102',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.ERROR,
    userMessage: 'Request timeout. The server is taking too long to respond.',
    developerMessage: 'Network request exceeded timeout threshold',
    recoverySuggestions: [
      'Retry with exponential backoff',
      'Check server performance',
      'Increase timeout threshold if appropriate',
    ],
    retryable: true,
    reportToMonitoring: true,
  },

  ERR_103: {
    code: 'ERR_103',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.WARNING,
    userMessage: 'Slow connection detected. Some features may load slowly.',
    developerMessage: 'Network latency exceeds acceptable threshold',
    recoverySuggestions: [
      'Enable low-bandwidth mode',
      'Reduce data payloads',
      'Implement progressive loading',
    ],
    retryable: false,
    reportToMonitoring: false,
  },

  // Validation errors (ERR_2xx)
  ERR_201: {
    code: 'ERR_201',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.ERROR,
    userMessage: 'The data received is invalid. Please refresh and try again.',
    developerMessage: 'Schema validation failed for incoming data',
    recoverySuggestions: [
      'Check data against schema',
      'Verify backend contract matches frontend expectations',
      'Log validation errors for debugging',
      'Use parseOrReport for detailed error info',
    ],
    retryable: false,
    reportToMonitoring: true,
  },

  ERR_202: {
    code: 'ERR_202',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    userMessage: 'Some data could not be loaded. Partial information is displayed.',
    developerMessage: 'Partial validation failure - some fields invalid',
    recoverySuggestions: [
      'Use parsePartial to extract valid fields',
      'Display what data is available',
      'Log which fields failed validation',
    ],
    retryable: false,
    reportToMonitoring: false,
  },

  ERR_203: {
    code: 'ERR_203',
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.ERROR,
    userMessage: 'Invalid entity type. This data cannot be displayed.',
    developerMessage: 'Entity type discriminator is invalid or missing',
    recoverySuggestions: [
      'Verify entity type enum is up to date',
      'Check backend entity type values',
      'Ensure type field is properly set',
    ],
    retryable: false,
    reportToMonitoring: true,
  },

  // WebSocket errors (ERR_3xx)
  ERR_301: {
    code: 'ERR_301',
    category: ErrorCategory.WEBSOCKET,
    severity: ErrorSeverity.CRITICAL,
    userMessage: 'Real-time updates are unavailable. Data may be out of date.',
    developerMessage: 'WebSocket connection failed to establish',
    recoverySuggestions: [
      'Retry connection with exponential backoff',
      'Check WebSocket URL configuration',
      'Verify WebSocket server is running',
      'Fall back to polling if WebSocket unavailable',
    ],
    retryable: true,
    reportToMonitoring: true,
  },

  ERR_302: {
    code: 'ERR_302',
    category: ErrorCategory.WEBSOCKET,
    severity: ErrorSeverity.WARNING,
    userMessage: 'Real-time connection lost. Attempting to reconnect...',
    developerMessage: 'WebSocket connection closed unexpectedly',
    recoverySuggestions: [
      'Implement reconnection logic',
      'Check for network interruptions',
      'Verify server stability',
      'Add connection status indicator to UI',
    ],
    retryable: true,
    reportToMonitoring: false,
  },

  ERR_303: {
    code: 'ERR_303',
    category: ErrorCategory.WEBSOCKET,
    severity: ErrorSeverity.ERROR,
    userMessage: 'Received invalid real-time update. Changes may not be reflected.',
    developerMessage: 'WebSocket message failed validation',
    recoverySuggestions: [
      'Log invalid message for debugging',
      'Validate all incoming WS messages',
      'Implement message versioning',
      'Add schema migration support',
    ],
    retryable: false,
    reportToMonitoring: true,
  },

  ERR_304: {
    code: 'ERR_304',
    category: ErrorCategory.WEBSOCKET,
    severity: ErrorSeverity.WARNING,
    userMessage: 'Duplicate update received. Ignoring redundant change.',
    developerMessage: 'Duplicate message detected by idempotency guard',
    recoverySuggestions: [
      'Message was already processed, safe to ignore',
      'Ensure message IDs are unique',
      'Check idempotency window size',
    ],
    retryable: false,
    reportToMonitoring: false,
  },

  // Cache errors (ERR_4xx)
  ERR_401: {
    code: 'ERR_401',
    category: ErrorCategory.CACHE,
    severity: ErrorSeverity.WARNING,
    userMessage: 'Cache update failed. You may see outdated information.',
    developerMessage: 'React Query cache update failed',
    recoverySuggestions: [
      'Invalidate affected queries',
      'Refetch data from server',
      'Check cache coordinator logic',
    ],
    retryable: true,
    reportToMonitoring: false,
  },

  ERR_402: {
    code: 'ERR_402',
    category: ErrorCategory.CACHE,
    severity: ErrorSeverity.ERROR,
    userMessage: 'Failed to invalidate outdated data. Please refresh the page.',
    developerMessage: 'Cache invalidation failed',
    recoverySuggestions: [
      'Check query key structure',
      'Verify invalidation map is correct',
      'Log affected query keys',
    ],
    retryable: true,
    reportToMonitoring: true,
  },

  // State errors (ERR_5xx)
  ERR_501: {
    code: 'ERR_501',
    category: ErrorCategory.STATE,
    severity: ErrorSeverity.ERROR,
    userMessage: 'Application state is inconsistent. Some features may not work correctly.',
    developerMessage: 'State invariant violation detected',
    recoverySuggestions: [
      'Reset state to known good state',
      'Log state snapshot for debugging',
      'Check for race conditions',
      'Verify state update logic',
    ],
    retryable: false,
    reportToMonitoring: true,
  },

  ERR_502: {
    code: 'ERR_502',
    category: ErrorCategory.STATE,
    severity: ErrorSeverity.CRITICAL,
    userMessage: 'Critical application error. Please refresh the page.',
    developerMessage: 'Unrecoverable state error - full reset required',
    recoverySuggestions: [
      'Clear local storage',
      'Reset all state stores',
      'Reload application',
      'Check for corrupted persisted state',
    ],
    retryable: false,
    reportToMonitoring: true,
  },

  // Render errors (ERR_6xx)
  ERR_601: {
    code: 'ERR_601',
    category: ErrorCategory.RENDER,
    severity: ErrorSeverity.ERROR,
    userMessage: 'This component could not be displayed. Please try refreshing.',
    developerMessage: 'React component threw error during render',
    recoverySuggestions: [
      'Caught by ErrorBoundary',
      'Check component props and state',
      'Verify data is valid',
      'Log error stack trace',
    ],
    retryable: true,
    reportToMonitoring: true,
  },

  ERR_602: {
    code: 'ERR_602',
    category: ErrorCategory.RENDER,
    severity: ErrorSeverity.WARNING,
    userMessage: 'Some content could not be displayed.',
    developerMessage: 'Non-critical render error in child component',
    recoverySuggestions: [
      'Use ErrorBoundary to isolate failure',
      'Render fallback UI',
      'Log error for debugging',
    ],
    retryable: false,
    reportToMonitoring: false,
  },

  // Not Found errors (ERR_7xx)
  ERR_701: {
    code: 'ERR_701',
    category: ErrorCategory.NOT_FOUND,
    severity: ErrorSeverity.WARNING,
    userMessage: 'The requested item could not be found.',
    developerMessage: '404 - Resource not found',
    recoverySuggestions: [
      'Verify resource ID is correct',
      'Check if resource was deleted',
      'Navigate to parent resource',
      'Show "not found" UI',
    ],
    retryable: false,
    reportToMonitoring: false,
  },

  // Authentication errors (ERR_8xx)
  ERR_801: {
    code: 'ERR_801',
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.CRITICAL,
    userMessage: 'Your session has expired. Please log in again.',
    developerMessage: '401 - Authentication required',
    recoverySuggestions: [
      'Redirect to login page',
      'Clear auth tokens',
      'Show login modal',
    ],
    retryable: false,
    reportToMonitoring: false,
  },

  // Authorization errors (ERR_9xx)
  ERR_901: {
    code: 'ERR_901',
    category: ErrorCategory.AUTHORIZATION,
    severity: ErrorSeverity.ERROR,
    userMessage: 'You do not have permission to access this resource.',
    developerMessage: '403 - Forbidden',
    recoverySuggestions: [
      'Check user permissions',
      'Show "access denied" UI',
      'Navigate to accessible resource',
    ],
    retryable: false,
    reportToMonitoring: false,
  },

  // Unknown errors (ERR_999)
  ERR_999: {
    code: 'ERR_999',
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.ERROR,
    userMessage: 'An unexpected error occurred. Please try again.',
    developerMessage: 'Unknown error - no specific error code matched',
    recoverySuggestions: [
      'Log full error details',
      'Check error message and stack trace',
      'Add specific error code if this error is common',
    ],
    retryable: true,
    reportToMonitoring: true,
  },
};

/**
 * Application error class with error code
 */
export class AppError extends Error {
  public readonly definition: ErrorDefinition;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;
  public cause?: Error;

  constructor(
    code: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    const definition = ERROR_CATALOG[code] || ERROR_CATALOG.ERR_999!;
    super(definition.developerMessage);

    this.name = 'AppError';
    this.definition = definition;
    if (context !== undefined) {
      this.context = context;
    }
    this.timestamp = new Date();

    // Link to original error
    if (cause) {
      this.cause = cause;
    }

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Get user-facing message
   */
  getUserMessage(): string {
    return this.definition.userMessage;
  }

  /**
   * Get developer message
   */
  getDeveloperMessage(): string {
    return this.definition.developerMessage;
  }

  /**
   * Get recovery suggestions
   */
  getRecoverySuggestions(): readonly string[] {
    return this.definition.recoverySuggestions;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.definition.retryable;
  }

  /**
   * Check if error should be reported to monitoring
   */
  shouldReport(): boolean {
    return this.definition.reportToMonitoring;
  }

  /**
   * Convert to structured log format
   */
  toStructured(): {
    type: 'AppError';
    code: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    context?: Record<string, unknown>;
    timestamp: string;
    stack?: string;
  } {
    return {
      type: 'AppError',
      code: this.definition.code,
      category: this.definition.category,
      severity: this.definition.severity,
      message: this.message,
      ...(this.context !== undefined && { context: this.context }),
      timestamp: this.timestamp.toISOString(),
      ...(this.stack !== undefined && { stack: this.stack }),
    };
  }
}

/**
 * Create AppError from HTTP response
 */
export function fromHttpError(response: Response, context?: Record<string, unknown>): AppError {
  switch (response.status) {
    case 401:
      return new AppError('ERR_801', { ...context, status: response.status });
    case 403:
      return new AppError('ERR_901', { ...context, status: response.status });
    case 404:
      return new AppError('ERR_701', { ...context, status: response.status });
    case 408:
    case 504:
      return new AppError('ERR_102', { ...context, status: response.status });
    default:
      if (response.status >= 500) {
        return new AppError('ERR_101', { ...context, status: response.status });
      }
      return new AppError('ERR_999', { ...context, status: response.status });
  }
}

/**
 * Create AppError from unknown error
 */
export function fromUnknownError(error: unknown, context?: Record<string, unknown>): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError('ERR_999', { ...context, originalMessage: error.message }, error);
  }

  return new AppError('ERR_999', { ...context, error });
}

/**
 * Error reporter for monitoring integration
 */
export interface ErrorReporter {
  report(error: AppError): void;
}

/**
 * Console error reporter (default)
 */
export class ConsoleErrorReporter implements ErrorReporter {
  report(error: AppError): void {
    if (!error.shouldReport()) {
      return;
    }

    logger.error('[AppError]', error.toStructured());
  }
}

/**
 * Global error reporter instance
 */
export let errorReporter: ErrorReporter = new ConsoleErrorReporter();

/**
 * Set global error reporter
 */
export function setErrorReporter(reporter: ErrorReporter): void {
  errorReporter = reporter;
}

/**
 * Report error to global reporter
 */
export function reportError(error: AppError): void {
  errorReporter.report(error);
}
