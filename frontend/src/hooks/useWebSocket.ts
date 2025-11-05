/**
 * WebSocket Hook for Real-time Updates
 * Implements orjson serialization handling and connection resilience
 * Following forecastin patterns for WebSocket resilience and reconnection
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '../types';

export interface UseWebSocketOptions {
  url?: string;
  channels?: string[];
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url = process.env.REACT_APP_WS_URL || 'ws://localhost:9000/ws',
    channels = ['hierarchy_updates'],
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<Event | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectCountRef = useRef(0);

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

  // Connect to WebSocket with reconnection logic
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
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

        onConnect?.();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        onDisconnect?.();

        // Auto-reconnect with exponential backoff
        if (reconnectCountRef.current < reconnectAttempts) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectCountRef.current),
            30000
          );
          
          console.log(`Reconnecting in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            connect();
          }, delay);
        } else {
          setConnectionStatus('error');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError(error);
        setConnectionStatus('error');
        onError?.(error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [url, channels, handleMessage, onConnect, onDisconnect, onError, reconnectAttempts, reconnectInterval]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

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
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
  };
};