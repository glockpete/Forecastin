/**
 * React Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs the errors, and displays a fallback UI instead of crashing the entire app.
 *
 * In development: Shows detailed error information
 * In production: Shows a generic error message
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * @module components/ErrorBoundary
 */

import React, { Component, ReactNode } from 'react';
import { logger } from '@lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component that catches and handles React errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error to the console (in development) or error tracking service
    logger.error('React Error Boundary caught an error', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
    });

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return fallback;
      }

      // Otherwise, show the default error UI
      const isDevelopment = import.meta.env.MODE === 'development';

      return (
        <div
          role="alert"
          style={{
            padding: '2rem',
            margin: '2rem',
            border: '2px solid #ef4444',
            borderRadius: '0.5rem',
            backgroundColor: '#1f2937',
            color: '#f3f4f6',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Something went wrong
          </h1>

          {isDevelopment && error && (
            <>
              <details style={{ marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Error details
                </summary>
                <pre
                  style={{
                    padding: '1rem',
                    backgroundColor: '#111827',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem',
                    overflow: 'auto',
                  }}
                >
                  {error.toString()}
                </pre>
              </details>

              {errorInfo && (
                <details style={{ whiteSpace: 'pre-wrap' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Component stack
                  </summary>
                  <pre
                    style={{
                      padding: '1rem',
                      backgroundColor: '#111827',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                    }}
                  >
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </>
          )}

          {!isDevelopment && (
            <p style={{ marginBottom: '1rem' }}>
              We apologise for the inconvenience. Please try refreshing the page.
            </p>
          )}

          <button
            onClick={this.handleReset}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}
