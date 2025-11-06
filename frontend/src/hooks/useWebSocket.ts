/**
 * WebSocket Hook for Real-time Updates
 * Implements orjson serialization handling and connection resilience
 * Following forecastin patterns for WebSocket resilience and reconnection
 *
 * CRITICAL FIXES:
 * - Uses clean /ws endpoint without client_id parameter
 * - Implements exponential backoff with jitter for reconnections
 * - Adds ping/pong keepalive every 20 seconds
 * - Hardened reconnection logic with proper state management
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '../types';
import { getWebSocketUrl } from '../config/env';

export interface UseWebSocketOptions {
  url?: string;
  channels?: string[];
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  pingInterval?: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  // Construct WebSocket URL using runtime configuration
  // This derives the URL from window.location to avoid Docker-internal hostnames
  const wsUrl = options.url || getWebSocketUrl();
  
  // Log the final WebSocket URL for diagnostics
  console.debug(`[useWebSocket] Connecting to: ${wsUrl}`);
  
  const {
    channels = ['hierarchy_updates'],
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    pingInterval = 20000, // 20 second keepalive
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<Event | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectCountRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const isManualDisconnect = useRef(false);

  // Handle WebSocket messages with orjson-safe deserialization
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      // Handle orjson serialization - parse safely to prevent crashes
      const message = JSON.parse(event.data);
      
      // Validate message structure
      if (typeof message !== 'object' || !message.type) {
        console.warn('Invalid WebSocket message structure:', message);
        return;
      }

      setLastMessage(message);
      setError(null);
      
      // Call custom message handler
      if (onMessage) {
        onMessage(message);
      }

      // Handle different message types
      switch (message.type) {
        case 'entity_update':
        case 'hierarchy_change':
        case 'layer_data_update':
        case 'gpu_filter_sync':
        case 'serialization_error':
          console.log(`Received ${message.type}:`, message.data);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      setError(new Event('message_parse_error'));
      
      // Send structured error message instead of crashing
      const errorMessage: WebSocketMessage = {
        type: 'serialization_error',
        error: 'Failed to parse WebSocket message',
      };
      setLastMessage(errorMessage);
    }
  }, [onMessage]);

  // Start ping/pong keepalive
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
          console.debug('[useWebSocket] Sent ping');
        } catch (error) {
          console.error('[useWebSocket] Failed to send ping:', error);
        }
      }
    }, pingInterval);
  }, [pingInterval]);

  // Stop ping/pong keepalive
  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    }
  }, []);

  // Connect to WebSocket with hardened reconnection logic
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    isManualDisconnect.current = false;

    try {
      console.log(`[WebSocket] Connecting to: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        reconnectCountRef.current = 0;

        // Subscribe to channels
        if (channels.length > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels: channels,
          }));
        }

        // Start keepalive ping
        startPingInterval();

        onConnect?.();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log(`[useWebSocket] WebSocket closed - code: ${event.code}, reason: "${event.reason}"`);
        console.log(`[useWebSocket] Close details - wasClean: ${event.wasClean}, URL: ${wsUrl}`);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Stop keepalive ping
        stopPingInterval();
        
        onDisconnect?.();

        // Auto-reconnect with exponential backoff + jitter (unless manual disconnect)
        if (!isManualDisconnect.current && reconnectCountRef.current < reconnectAttempts) {
          // Exponential backoff: 3s, 6s, 12s, 24s, 30s (capped)
          const baseDelay = reconnectInterval * Math.pow(2, reconnectCountRef.current);
          // Add jitter: ±20% randomization to prevent thundering herd
          const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
          const delay = Math.min(baseDelay + jitter, 30000);
          
          console.log(`[useWebSocket] Reconnecting in ${delay.toFixed(0)}ms (attempt ${reconnectCountRef.current + 1}/${reconnectAttempts})...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            connect();
          }, delay);
        } else if (reconnectCountRef.current >= reconnectAttempts) {
          console.error(`[useWebSocket] Max reconnection attempts (${reconnectAttempts}) reached. Giving up.`);
          setConnectionStatus('error');
        }
      };

      ws.onerror = (error) => {
        console.error('[useWebSocket] WebSocket error:', error);
        console.error(`[useWebSocket] Error details - URL: ${wsUrl}, readyState: ${ws.readyState}`);
        setError(error);
        setConnectionStatus('error');
        onError?.(error);
      };
    } catch (error) {
      console.error('[useWebSocket] Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [wsUrl, channels, handleMessage, onConnect, onDisconnect, onError, reconnectAttempts, reconnectInterval, startPingInterval, stopPingInterval]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    isManualDisconnect.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    stopPingInterval();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, [stopPingInterval]);

  // Send message through WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        // Ensure safe serialization for orjson compatibility
        const serializedMessage = JSON.stringify(message);
        wsRef.current.send(serializedMessage);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        setError(new Event('send_error'));
      }
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  // Subscribe to channels
  const subscribe = useCallback((channelsToSubscribe: string[]) => {
    sendMessage({
      type: 'subscribe',
      channels: channelsToSubscribe,
    });
  }, [sendMessage]);

  // Unsubscribe from channels
  const unsubscribe = useCallback((channelsToUnsubscribe: string[]) => {
    sendMessage({
      type: 'unsubscribe',
      channels: channelsToUnsubscribe,
    });
  }, [sendMessage]);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    error,
    wsUrl,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
  };
};