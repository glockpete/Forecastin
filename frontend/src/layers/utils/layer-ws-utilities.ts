/**
 * Layer WebSocket Utilities following forecastin patterns
 * Implements orjson-style safe serialization for WebSocket messages
 */

import { LayerWebSocketMessage } from '../types/layer-types';

/**
 * Safe serialization following orjson pattern from forecastin
 * Handles Date objects, circular references, and complex objects gracefully
 */
export function safe_serialize_message(data: any): string {
  try {
    return JSON.stringify(data, (key, value) => {
      // Handle Date objects
      if (value instanceof Date) {
        return {
          __type: 'Date',
          iso: value.toISOString()
        };
      }
      
      // Handle circular references and complex objects
      if (value && typeof value === 'object') {
        // Create a cache to detect circular references
        const cache = new WeakSet();
        
        // Check if we're in a circular reference
        if (cache.has(value)) {
          return `[Circular Reference: ${key}]`;
        }
        cache.add(value);
        
        // Handle different object types
        if (Array.isArray(value)) {
          return value.map(item =>
            typeof item === 'object' && item !== null ?
              JSON.parse(JSON.stringify(item, (k, v) => safe_serialize_replacer(k, v, cache))) :
              item
          );
        }
        
        if (value.constructor && value.constructor.name !== 'Object') {
          return {
            __type: value.constructor.name,
            data: JSON.parse(JSON.stringify(value, (k, v) => safe_serialize_replacer(k, v, cache)))
          };
        }
      }
      
      return safe_serialize_replacer(key, value, new WeakSet());
    });
  } catch (error) {
    throw new Error(`WebSocket serialization failed: ${error}`);
  }
}

/**
 * Safe serialization replacer function
 */
function safe_serialize_replacer(key: string, value: any, cache: WeakSet<object>): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      __type: 'Error',
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (typeof value === 'object') {
    // Check for circular reference
    if (cache.has(value)) {
      return `[Circular Reference: ${key}]`;
    }
    cache.add(value);
  }

  return value;
}

/**
 * Create WebSocket message following forecastin patterns
 */
export function create_layer_websocket_message(
  type: string, 
  payload: any, 
  layerId?: string
): LayerWebSocketMessage {
  return {
    type: type as any,
    payload: {
      ...payload,
      timestamp: new Date().toISOString(),
      layerId: layerId || 'unknown',
      safeSerialized: true
    },
    safeSerialized: true
  };
}

/**
 * Batch multiple small updates into single message for performance
 */
export function batch_layer_updates(updates: any[], layerId?: string): LayerWebSocketMessage {
  return create_layer_websocket_message('layer_batch_update', {
    updates: updates,
    count: updates.length,
    batched: true
  }, layerId);
}

/**
 * Send error message with safe serialization
 */
export function create_error_message(
  error: Error, 
  layerId?: string, 
  context?: any
): LayerWebSocketMessage {
  return create_layer_websocket_message('layer_error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context: context || {},
    timestamp: new Date().toISOString()
  }, layerId);
}

/**
 * Validate WebSocket message structure
 */
export function validate_websocket_message(message: any): message is LayerWebSocketMessage {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    message.payload &&
    typeof message.payload === 'object' &&
    'safeSerialized' in message
  );
}

/**
 * Extract payload from safely serialized message
 */
export function extract_payload(message: LayerWebSocketMessage): any {
  try {
    if (message.safeSerialized) {
      // Handle specially serialized objects
      const serialized = JSON.stringify(message.payload);
      return JSON.parse(serialized, (key, value) => {
        if (value && typeof value === 'object' && value.__type) {
          switch (value.__type) {
            case 'Date':
              return new Date(value.iso);
            case 'Error':
              return new Error(value.message);
            default:
              return value.data || value;
          }
        }
        return value;
      });
    }
    return message.payload;
  } catch (error) {
    throw new Error(`Failed to extract payload: ${error}`);
  }
}