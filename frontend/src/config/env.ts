/**
 * Runtime Environment Configuration
 *
 * CRITICAL: This replaces compile-time environment variables for WebSocket URLs
 * The browser needs to connect to the real host, not Docker-internal hostnames like "api:9000"
 *
 * Pattern:
 * - Derive API/WS URLs from window.location at runtime
 * - Support both HTTP/WS and HTTPS/WSS protocols
 * - Allow override via environment variables for development
 */

import { logger } from '@lib/logger';

export const RUNTIME = (() => {
  // Detect if running in browser (vs SSR/build time)
  const isBrowser = typeof window !== 'undefined';
  
  if (!isBrowser) {
    // Build-time fallback - these won't be used in actual connections
    return {
      apiBase: 'http://localhost:9000',
      wsBase: 'ws://localhost:9000',
      wsPath: '/ws' as const,
    };
  }

  // Runtime detection from browser location
  const isHttps = window.location.protocol === 'https:';
  const host = window.location.hostname;

  // Port detection - use 9000 for API by default (matching api/main.py:1394)
  // In production with reverse proxy, port may be same as frontend
  const apiPort = Number(
    process.env.REACT_APP_API_PORT ||
    process.env.VITE_API_PORT ||
    9000
  );

  // WebSocket port - can be different from API port for flexibility
  // Falls back to API port if not specified
  const wsPort = Number(
    process.env.REACT_APP_WS_PORT ||
    process.env.VITE_WS_PORT ||
    apiPort
  );

  // Allow environment variable override for development
  // But compute from window.location by default to avoid Docker hostname issues
  const apiBase =
    process.env.REACT_APP_API_URL_OVERRIDE ||
    process.env.VITE_API_URL_OVERRIDE ||
    `${isHttps ? 'https' : 'http'}://${host}:${apiPort}`;

  const wsBase =
    process.env.REACT_APP_WS_URL_OVERRIDE ||
    process.env.VITE_WS_URL_OVERRIDE ||
    `${isHttps ? 'wss' : 'ws'}://${host}:${wsPort}`;

  // Log configuration for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    logger.debug('[RUNTIME CONFIG] Environment configuration:', {
      protocol: window.location.protocol,
      host: window.location.hostname,
      port: window.location.port,
      isHttps,
      apiPort,
      wsPort,
      apiBase,
      wsBase,
    });
  }

  return {
    apiBase,
    wsBase,
    wsPath: '/ws' as const,
  };
})();

/**
 * API Base URL constant for legacy compatibility
 * @deprecated Use RUNTIME.apiBase or getApiUrl() instead
 */
export const API_BASE_URL = RUNTIME.apiBase;

/**
 * Helper to construct full WebSocket URL (clean endpoint without client_id)
 * CRITICAL: WebSocket connection uses clean /ws endpoint, not /ws/{client_id}
 * This fixes the connection loop issue by removing client_id from URL
 * @returns Full WebSocket URL
 */
export function getWebSocketUrl(): string {
  const url = `${RUNTIME.wsBase}${RUNTIME.wsPath}`;

  // Log constructed URL for diagnostics
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[WS URL] Constructed WebSocket URL: ${url}`);
  }

  return url;
}

/**
 * Helper to construct API endpoint URL
 * @param path - API path (should start with /)
 * @returns Full API URL
 */
export function getApiUrl(path: string): string {
  return `${RUNTIME.apiBase}${path}`;
}