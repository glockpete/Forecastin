/**
 * Environment-gated logging utility
 *
 * Replaces raw console.* calls with a structured logger that respects NODE_ENV.
 * In production, only warnings and errors are logged. In development, all levels are logged.
 *
 * Usage:
 *   import { logger } from '@lib/logger';
 *
 *   logger.debug('Debug message', { userId: 123 });
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message', error);
 *
 * @module lib/logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
}

/**
 * Determines the minimum log level based on NODE_ENV
 */
function getMinLogLevel(): LogLevel {
  const env = import.meta.env.MODE || 'production';

  switch (env) {
    case 'development':
    case 'test':
      return 'debug';
    case 'staging':
      return 'info';
    case 'production':
    default:
      return 'warn';
  }
}

/**
 * Checks if a given log level should be emitted based on the minimum level
 */
function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const levelIndex = levels.indexOf(level);
  const minLevelIndex = levels.indexOf(minLevel);

  return levelIndex >= minLevelIndex;
}

/**
 * Formats a log message with optional context
 */
function formatMessage(level: LogLevel, message: string, context?: unknown): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (context !== undefined) {
    return `${prefix} ${message}`;
  }

  return `${prefix} ${message}`;
}

/**
 * Logger class with environment-gated logging
 */
class Logger {
  private config: LoggerConfig;

  constructor() {
    const minLevel = getMinLogLevel();
    this.config = {
      level: minLevel,
      enabled: true,
    };
  }

  /**
   * Debug-level logging (development only)
   * Use for detailed diagnostic information
   */
  debug(message: string, ...args: unknown[]): void {
    if (!this.config.enabled || !shouldLog('debug', this.config.level)) {
      return;
    }

    // eslint-disable-next-line no-console
    console.debug(formatMessage('debug', message), ...args);
  }

  /**
   * Info-level logging (development and staging)
   * Use for general informational messages
   */
  info(message: string, ...args: unknown[]): void {
    if (!this.config.enabled || !shouldLog('info', this.config.level)) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(formatMessage('info', message), ...args);
  }

  /**
   * Warning-level logging (all environments)
   * Use for potentially harmful situations
   */
  warn(message: string, ...args: unknown[]): void {
    if (!this.config.enabled || !shouldLog('warn', this.config.level)) {
      return;
    }

    // eslint-disable-next-line no-console
    console.warn(formatMessage('warn', message), ...args);
  }

  /**
   * Error-level logging (all environments)
   * Use for error events
   */
  error(message: string, ...args: unknown[]): void {
    if (!this.config.enabled || !shouldLog('error', this.config.level)) {
      return;
    }

    // eslint-disable-next-line no-console
    console.error(formatMessage('error', message), ...args);
  }

  /**
   * Group logging for related messages
   */
  group(label: string): void {
    if (!this.config.enabled) {
      return;
    }

    // eslint-disable-next-line no-console
    console.group(label);
  }

  /**
   * End a logging group
   */
  groupEnd(): void {
    if (!this.config.enabled) {
      return;
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  /**
   * Temporarily disable logging (for tests)
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Re-enable logging
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }
}

/**
 * Singleton logger instance
 */
export const logger = new Logger();

/**
 * Type-safe logger for testing
 */
export type { Logger, LogLevel, LoggerConfig };
