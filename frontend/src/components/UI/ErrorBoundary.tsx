/**
 * Error Boundary Component
 * Catches and handles React errors gracefully with retry/backoff
 * Integrates with error catalog for consistent error handling
 */

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AppError, fromUnknownError, reportError } from '../../errors/errorCatalog';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  appError?: AppError;
  retryCount: number;
  isRetrying: boolean;
  lastRetryTime?: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Convert to AppError for consistent handling
    const appError = error instanceof AppError
      ? error
      : fromUnknownError(error, {
          componentStack: errorInfo.componentStack,
          retryCount: this.state.retryCount,
        });

    this.setState({
      error,
      errorInfo,
      appError,
    });

    // Report error to monitoring
    reportError(new AppError('ERR_601', {
      originalError: error.message,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    }));

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log error to monitoring service in production
    if (import.meta.env.MODE === 'production') {
      console.error('Production error:', appError.toStructured());
    }
  }

  override componentDidUpdate(prevProps: Props) {
    // Reset error state if props changed (allows recovery)
    if (this.props.resetOnPropsChange && this.state.hasError && prevProps.children !== this.props.children) {
      this.resetError();
    }
  }

  override componentWillUnmount() {
    // Clean up retry timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private getRetryDelay(): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, this.state.retryCount), maxDelay);
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return delay + jitter;
  }

  /**
   * Check if retry is allowed
   */
  private canRetry(): boolean {
    const maxRetries = this.props.maxRetries ?? 3;
    return this.state.retryCount < maxRetries;
  }

  /**
   * Reset error state
   */
  private resetError = () => {
    this.setState({
      hasError: false,
      isRetrying: false,
    });
  };

  /**
   * Handle manual retry
   */
  handleRetry = () => {
    if (this.state.isRetrying) {
      return;
    }

    if (!this.canRetry()) {
      // Max retries exceeded - force full reset
      this.setState({ retryCount: 0 });
      this.resetError();
      return;
    }

    this.setState({
      isRetrying: true,
      retryCount: this.state.retryCount + 1,
    });

    const delay = this.getRetryDelay();
    console.log(`Retrying after ${delay.toFixed(0)}ms (attempt ${this.state.retryCount + 1}/${this.props.maxRetries ?? 3})`);

    this.retryTimeoutId = setTimeout(() => {
      this.resetError();
    }, delay);
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { appError, error, errorInfo, retryCount, isRetrying } = this.state;
      const maxRetries = this.props.maxRetries ?? 3;
      const canRetry = this.canRetry();

      // Get user-friendly message from app error if available
      const userMessage = appError?.getUserMessage() ||
        'We encountered an unexpected error. Please try refreshing the page.';

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md mx-auto text-center p-6">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {userMessage}
            </p>

            {/* Retry information */}
            {retryCount > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                Retry attempt {retryCount} of {maxRetries}
              </p>
            )}

            {/* Recovery suggestions from error catalog */}
            {appError && appError.getRecoverySuggestions().length > 0 && (
              <details className="mt-4 mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                  Recovery Suggestions
                </summary>
                <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside space-y-1">
                  {appError.getRecoverySuggestions().map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </details>
            )}

            {/* Retry button */}
            <button
              onClick={this.handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying
                ? 'Retrying...'
                : canRetry
                ? 'Try Again'
                : 'Reset'}
            </button>

            {/* Development error details */}
            {import.meta.env.MODE === 'development' && error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  Error Details (Development)
                </summary>
                <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-auto max-h-96">
                  {appError && (
                    <div className="mb-4 pb-4 border-b border-gray-300 dark:border-gray-600">
                      <div className="text-blue-600 dark:text-blue-400 mb-2">
                        <strong>App Error:</strong> {appError.definition.code}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 mb-1">
                        <strong>Category:</strong> {appError.definition.category}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 mb-1">
                        <strong>Severity:</strong> {appError.definition.severity}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 mb-1">
                        <strong>Retryable:</strong> {appError.isRetryable() ? 'Yes' : 'No'}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        <strong>Developer Message:</strong> {appError.getDeveloperMessage()}
                      </div>
                    </div>
                  )}
                  <div className="text-red-600 dark:text-red-400 mb-2">
                    {error.name}: {error.message}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {error.stack}
                  </div>
                  {errorInfo && (
                    <div className="mt-2 text-gray-600 dark:text-gray-400">
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;