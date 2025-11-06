/**
 * Client ID Generation Utility
 * Generates unique identifiers for WebSocket connections following forecastin patterns
 * Implements timestamp-based unique identifiers for consistent client identification
 */

/**
 * Generate a unique client ID for WebSocket connections
 * Uses timestamp and random component to ensure uniqueness across browser sessions
 * @param prefix Optional prefix for the client ID (default: 'client')
 * @returns Unique client ID string
 */
export const generateClientId = (prefix: string = 'client'): string => {
  const timestamp = Date.now();
  const randomComponent = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${randomComponent}`;
};

/**
 * Generate a short client ID for less verbose URLs
 * @param prefix Optional prefix for the client ID (default: 'c')
 * @returns Short unique client ID string
 */
export const generateShortClientId = (prefix: string = 'c'): string => {
  const timestamp = Date.now().toString(36);
  const randomComponent = Math.random().toString(36).substr(2, 4);
  return `${prefix}_${timestamp}${randomComponent}`;
};

/**
 * Validate if a client ID follows the expected format
 * @param clientId Client ID to validate
 * @returns True if valid format, false otherwise
 */
export const isValidClientId = (clientId: string): boolean => {
  if (!clientId || typeof clientId !== 'string') {
    return false;
  }
  
  // Check for potentially dangerous characters (matching backend validation)
  const dangerousChars = ['..', '/', '\\', ':', '*', '?', '"', '<', '>', '|'];
  if (dangerousChars.some(char => clientId.includes(char))) {
    return false;
  }
  
  // Should contain at least one underscore and have reasonable length
  const parts = clientId.split('_');
  if (parts.length < 2 || clientId.length < 5 || clientId.length > 100) {
    return false;
  }
  
  return true;
};

/**
 * Extract prefix from client ID
 * @param clientId Client ID to extract prefix from
 * @returns Prefix part of the client ID
 */
export const getClientIdPrefix = (clientId: string): string => {
  const parts = clientId.split('_');
  return parts.length > 0 ? parts[0] : 'unknown';
};

/**
 * Check if client ID is expired (optional for session management)
 * @param clientId Client ID to check
 * @param maxAgeMs Maximum age in milliseconds (default: 24 hours)
 * @returns True if expired, false otherwise
 */
export const isClientIdExpired = (clientId: string, maxAgeMs: number = 24 * 60 * 60 * 1000): boolean => {
  try {
    const parts = clientId.split('_');
    if (parts.length < 2) return true;
    
    const timestamp = parseInt(parts[1]);
    if (isNaN(timestamp)) return true;
    
    const now = Date.now();
    return (now - timestamp) > maxAgeMs;
  } catch {
    return true;
  }
};