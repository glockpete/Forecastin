/**
 * Layer WebSocket Integration
 * 
 * Integrates geospatial layer system with existing forecastin WebSocket infrastructure
 * following established patterns from api/services/realtime_service.py and
 * frontend/src/hooks/useWebSocket.ts
 */

import { useWebSocket } from '../hooks/useWebSocket';
import { layerFeatureFlags } from '../config/feature-flags';
import { safe_serialize_message } from '../layers/utils/layer-ws-utilities';
import type {
  EntityDataPoint,
  WebSocketLayerMessage,
  LayerPerformanceMetrics,
  LayerAuditEntry
} from '../layers/types/layer-types';

// WebSocket-specific audit entry (more flexible than LayerAuditEntry)
interface WebSocketAuditEntry {
  timestamp: string;
  event: string;
  details?: Record<string, any>;
}

export interface LayerWebSocketConfig {
  // WebSocket connection settings
  url: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  
  // Layer-specific message handlers
  onLayerMessage?: (message: WebSocketLayerMessage) => void;
  onEntityUpdate?: (entity: EntityDataPoint) => void;
  onBatchUpdate?: (entities: EntityDataPoint[]) => void;
  onPerformanceMetrics?: (metrics: LayerPerformanceMetrics) => void;
  onComplianceEvent?: (auditEntry: LayerAuditEntry) => void;
  
  // Error handling
  onError?: (error: any) => void;
  onConnectionError?: (error: any) => void;
  
  // Feature flag integration
  featureFlagCheck?: () => boolean;
}

export interface LayerWebSocketState {
  connected: boolean;
  lastMessageTime: number;
  reconnectAttempts: number;
  messageQueue: WebSocketLayerMessage[];
  performanceMetrics: LayerPerformanceMetrics;
  auditLog: WebSocketAuditEntry[];
}

export class LayerWebSocketIntegration {
  private ws: WebSocket | null = null;
  private config: LayerWebSocketConfig;
  private state: LayerWebSocketState;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketLayerMessage[] = [];
  private isConnecting = false;

  constructor(config: LayerWebSocketConfig) {
    this.config = {
      reconnectAttempts: 3,
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      featureFlagCheck: () => layerFeatureFlags.isEnabled('ff.geo.websocket_layers_enabled'),
      ...config
    };
    
    this.state = {
      connected: false,
      lastMessageTime: 0,
      reconnectAttempts: 0,
      messageQueue: [],
      performanceMetrics: this.defaultPerformanceMetrics(),
      auditLog: []
    };
  }

  /**
   * Default performance metrics factory
   */
  private defaultPerformanceMetrics(): LayerPerformanceMetrics {
    return {
      layerId: 'websocket-layer',
      renderTime: 1.25,    // Target: 1.25ms
      dataSize: 0,
      memoryUsage: 0,
      cacheHitRate: 0.992, // Target: 99.2%
      lastRenderTime: new Date().toISOString(),
      fps: 60,
      messagesSent: 0,
      messagesReceived: 0,
      lastMessageTime: 0,
      averageLatency: 0,
      throughput: 42726,   // Target: 42,726 RPS
      sloCompliance: {
        targetResponseTime: 1.25,
        currentP95: 0,
        currentP99: 0,
        complianceRate: 100,
        violations: 0
      }
    };
  }

  /**
   * Safely increment messages received counter
   */
  private incMessagesReceived(): void {
    this.state.performanceMetrics.messagesReceived =
      (this.state.performanceMetrics.messagesReceived || 0) + 1;
  }

  /**
   * Safely increment messages sent counter
   */
  private incMessagesSent(): void {
    this.state.performanceMetrics.messagesSent =
      (this.state.performanceMetrics.messagesSent || 0) + 1;
  }

  /**
   * Initialize WebSocket connection with feature flag check
   */
  async connect(): Promise<boolean> {
    // Check if WebSocket integration is enabled via feature flags
    if (!this.config.featureFlagCheck?.()) {
      this.logAuditEvent({
        timestamp: new Date().toISOString(),
        event: 'websocket_connection_blocked',
        details: { reason: 'Feature flag disabled', feature: 'ff_websocket_layers_enabled' }
      });
      return false;
    }

    if (this.isConnecting || this.state.connected) {
      return this.state.connected;
    }

    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(this.config.url);
      
      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        this.handleConnectionError(new Error('WebSocket connection timeout'));
      }, 10000);
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.handleConnectionOpen();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };
      
      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        this.handleConnectionClose(event);
      };
      
      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        this.handleConnectionError(error);
      };
      
      return true;
    } catch (error) {
      this.isConnecting = false;
      this.handleConnectionError(error);
      return false;
    }
  }

  /**
   * Handle successful connection establishment
   */
  private handleConnectionOpen(): void {
    this.state.connected = true;
    this.state.reconnectAttempts = 0;
    this.isConnecting = false;
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Flush queued messages
    this.flushMessageQueue();
    
    // Send initialization message
    this.sendMessage({
      type: 'layer_initialization',
      action: 'connect',
      data: {
        featureFlags: layerFeatureFlags.getConfig(),
        clientVersion: '1.0.0',
        timestamp: new Date().toISOString()
      }
    });
    
    this.logAuditEvent({
      timestamp: new Date().toISOString(),
      event: 'websocket_connected',
      details: { 
        url: this.config.url,
        featureFlags: layerFeatureFlags.getStatusSummary()
      }
    });
    
    console.log('[LayerWebSocket] Connected successfully');
  }

  /**
   * Handle connection close events
   */
  private handleConnectionClose(event: CloseEvent): void {
    this.state.connected = false;
    this.isConnecting = false;
    
    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    this.logAuditEvent({
      timestamp: new Date().toISOString(),
      event: 'websocket_disconnected',
      details: { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean
      }
    });
    
    console.warn('[LayerWebSocket] Connection closed:', event.code, event.reason);
    
    // Attempt reconnection if conditions allow
    this.attemptReconnection();
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: any): void {
    this.state.connected = false;
    this.isConnecting = false;
    
    this.logAuditEvent({
      timestamp: new Date().toISOString(),
      event: 'websocket_error',
      details: { error: error.message || error.toString() }
    });
    
    this.config.onConnectionError?.(error);
    console.error('[LayerWebSocket] Connection error:', error);
    
    // Attempt reconnection
    this.attemptReconnection();
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    const startTime = performance.now();
    
    try {
      // Use safe parsing to prevent crashes
      const message = JSON.parse(event.data);
      
      // Validate message structure
      if (!this.validateMessage(message)) {
        this.logAuditEvent({
          timestamp: new Date().toISOString(),
          event: 'invalid_message_received',
          details: { messageType: message?.type, structure: Object.keys(message || {}) }
        });
        return;
      }
      
      this.state.lastMessageTime = Date.now();
      
      // Safely increment messagesReceived using helper method
      this.incMessagesReceived();
      
      // Route message to appropriate handler
      this.routeMessage(message);
      
      // Calculate latency for performance metrics
      const latency = performance.now() - startTime;
      this.updatePerformanceMetrics({ averageLatency: latency });
      
      this.config.onLayerMessage?.(message);
      
    } catch (error) {
      this.handleMessageError(error, event.data);
    }
  }

  /**
   * Route messages to appropriate handlers based on type
   */
  private routeMessage(message: WebSocketLayerMessage): void {
    try {
      switch (message.type) {
        case 'layer_data':
          this.handleLayerData(message);
          break;
        case 'entity_update':
          this.handleEntityUpdateMessage(message);
          break;
        case 'batch_update':
          this.handleBatchUpdateMessage(message);
          break;
        case 'performance_metrics':
          this.handlePerformanceMetricsMessage(message);
          break;
        case 'compliance_event':
          this.handleComplianceEventMessage(message);
          break;
        case 'heartbeat_response':
          this.handleHeartbeatResponse(message);
          break;
        case 'error':
          this.handleErrorMessage(message);
          break;
        default:
          this.logAuditEvent({
            timestamp: new Date().toISOString(),
            event: 'unhandled_message_type',
            details: { messageType: message.type, action: message.action }
          });
      }
    } catch (error) {
      this.handleMessageRoutingError(error, message);
    }
  }

  /**
   * Handle layer-specific data messages
   */
  private handleLayerData(message: WebSocketLayerMessage): void {
    if (message.action === 'entity_batch') {
      const entities = message.data?.entities as EntityDataPoint[];
      if (entities && Array.isArray(entities)) {
        this.config.onBatchUpdate?.(entities);
        
        this.logAuditEvent({
          timestamp: new Date().toISOString(),
          event: 'batch_entity_update_received',
          details: { entityCount: entities.length, batchId: message.data?.batchId }
        });
      }
    }
  }

  /**
   * Handle individual entity update messages
   */
  private handleEntityUpdateMessage(message: WebSocketLayerMessage): void {
    const entity = message.data?.entity as EntityDataPoint;
    if (entity) {
      this.config.onEntityUpdate?.(entity);
      
      this.logAuditEvent({
        timestamp: new Date().toISOString(),
        event: 'entity_update_received',
        details: { entityId: entity.id, confidence: entity.confidence }
      });
    }
  }

  /**
   * Handle batch update messages
   */
  private handleBatchUpdateMessage(message: WebSocketLayerMessage): void {
    const entities = message.data?.entities as EntityDataPoint[];
    if (entities && Array.isArray(entities)) {
      this.config.onBatchUpdate?.(entities);
      
      this.logAuditEvent({
        timestamp: new Date().toISOString(),
        event: 'batch_update_received',
        details: { entityCount: entities.length, batchId: message.data?.batchId }
      });
    }
  }

  /**
   * Handle performance metrics messages
   */
  private handlePerformanceMetricsMessage(message: WebSocketLayerMessage): void {
    const metrics = message.data?.metrics as LayerPerformanceMetrics;
    if (metrics) {
      this.state.performanceMetrics = { ...this.state.performanceMetrics, ...metrics };
      this.config.onPerformanceMetrics?.(this.state.performanceMetrics);
    }
  }

  /**
   * Handle compliance audit events
   */
  private handleComplianceEventMessage(message: WebSocketLayerMessage): void {
    const auditEntry = message.data?.auditEntry as LayerAuditEntry;
    if (auditEntry) {
      // Store as WebSocket audit entry for internal tracking
      const wsAuditEntry: WebSocketAuditEntry = {
        timestamp: auditEntry.timestamp,
        event: auditEntry.action,
        details: auditEntry.metadata
      };
      this.state.auditLog.push(wsAuditEntry);
      this.config.onComplianceEvent?.(auditEntry);
    }
  }

  /**
   * Handle heartbeat response
   */
  private handleHeartbeatResponse(message: WebSocketLayerMessage): void {
    this.logAuditEvent({
      timestamp: new Date().toISOString(),
      event: 'heartbeat_received',
      details: { serverTime: message.data?.serverTime }
    });
  }

  /**
   * Handle error messages from server
   */
  private handleErrorMessage(message: WebSocketLayerMessage): void {
    const error = message.data?.error;
    this.logAuditEvent({
      timestamp: new Date().toISOString(),
      event: 'server_error_received',
      details: { error: error?.message, code: error?.code }
    });
    
    this.config.onError?.(error);
  }

  /**
   * Send message using safe serialization
   */
  sendMessage(message: WebSocketLayerMessage): boolean {
    if (!this.state.connected || !this.ws) {
      // Queue message for later sending
      this.messageQueue.push(message);
      this.logAuditEvent({
        timestamp: new Date().toISOString(),
        event: 'message_queued',
        details: { messageType: message.type, queueSize: this.messageQueue.length }
      });
      return false;
    }

    try {
      // Use safe serialization to prevent WebSocket crashes
      const serializedMessage = safe_serialize_message(message);
      this.ws.send(serializedMessage);
      
      this.incMessagesSent();
      this.state.lastMessageTime = Date.now();
      
      this.logAuditEvent({
        timestamp: new Date().toISOString(),
        event: 'message_sent',
        details: { messageType: message.type, messageSize: serializedMessage.length }
      });
      
      return true;
    } catch (error) {
      this.handleMessageError(error, message);
      return false;
    }
  }

  /**
   * Send batched entity updates for performance optimization
   */
  sendBatchUpdate(entities: EntityDataPoint[], batchId?: string): void {
    const message: WebSocketLayerMessage = {
      type: 'batch_update',
      action: 'entities',
      data: {
        entities,
        batchId: batchId || `batch_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };

    // Use debouncing to batch multiple small updates
    setTimeout(() => {
      this.sendMessage(message);
    }, 100);
  }

  /**
   * Send confidence adjustment for entities
   */
  sendConfidenceAdjustment(entityId: string, newConfidence: number, reason: string): void {
    const message: WebSocketLayerMessage = {
      type: 'entity_update',
      action: 'confidence_adjustment',
      data: {
        entityId,
        newConfidence,
        reason,
        timestamp: new Date().toISOString()
      }
    };

    this.sendMessage(message);
  }

  /**
   * Start heartbeat mechanism to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.state.connected) {
        const heartbeatMessage: WebSocketLayerMessage = {
          type: 'heartbeat',
          action: 'ping',
          data: {
            clientTime: new Date().toISOString(),
            featureFlags: layerFeatureFlags.getStatusSummary()
          }
        };
        
        this.sendMessage(heartbeatMessage);
      }
    }, this.config.heartbeatInterval!);
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnection(): void {
    if (this.state.reconnectAttempts >= this.config.reconnectAttempts!) {
      this.logAuditEvent({
        timestamp: new Date().toISOString(),
        event: 'max_reconnect_attempts_reached',
        details: { attempts: this.state.reconnectAttempts }
      });
      return;
    }

    this.state.reconnectAttempts++;
    const delay = this.config.reconnectInterval! * Math.pow(2, this.state.reconnectAttempts - 1);
    
    this.reconnectTimer = setTimeout(() => {
      console.log(`[LayerWebSocket] Attempting reconnection ${this.state.reconnectAttempts}/${this.config.reconnectAttempts}`);
      this.connect();
    }, delay);
  }

  /**
   * Flush queued messages when connection is restored
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length > 0) {
      console.log(`[LayerWebSocket] Flushing ${this.messageQueue.length} queued messages`);
      
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!;
        this.sendMessage(message);
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(updates: Partial<LayerPerformanceMetrics>): void {
    this.state.performanceMetrics = { ...this.state.performanceMetrics, ...updates };
    
    // Check if performance targets are being met
    const targets = layerFeatureFlags.getPerformanceTargets();
    if (this.state.performanceMetrics.renderTime > targets.render_time_ms) {
      this.logAuditEvent({
        timestamp: new Date().toISOString(),
        event: 'performance_target_exceeded',
        details: {
          currentRenderTime: this.state.performanceMetrics.renderTime,
          targetRenderTime: targets.render_time_ms
        }
      });
    }
  }

  /**
   * Validate incoming message structure
   */
  private validateMessage(message: any): boolean {
    if (!message || typeof message !== 'object') {
      return false;
    }
    
    if (!message.type || !message.action) {
      return false;
    }
    
    // Additional validation based on message type
    switch (message.type) {
      case 'layer_data':
        return message.data && typeof message.data === 'object';
      case 'entity_update':
        return message.data && message.data.entity;
      case 'batch_update':
        return message.data && Array.isArray(message.data.entities);
      default:
        return true;
    }
  }

  /**
   * Handle message processing errors
   */
  private handleMessageError(error: any, messageData: any): void {
    this.logAuditEvent({
      timestamp: new Date().toISOString(),
      event: 'message_processing_error',
      details: {
        error: error.message || error.toString(),
        messageData: typeof messageData === 'string' ? messageData.substring(0, 100) : messageData
      }
    });
    
    this.config.onError?.(error);
  }

  /**
   * Handle message routing errors
   */
  private handleMessageRoutingError(error: any, message: WebSocketLayerMessage): void {
    this.logAuditEvent({
      timestamp: new Date().toISOString(),
      event: 'message_routing_error',
      details: {
        error: error.message || error.toString(),
        messageType: message.type,
        action: message.action
      }
    });
  }

  /**
   * Log audit events for compliance tracking
   */
  private logAuditEvent(auditEntry: WebSocketAuditEntry): void {
    this.state.auditLog.push(auditEntry);
    
    // Keep only recent audit entries to prevent memory issues
    if (this.state.auditLog.length > 1000) {
      this.state.auditLog = this.state.auditLog.slice(-500);
    }
    
    // Output to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[LayerAudit] ${auditEntry.event}:`, auditEntry.details);
    }
  }

  /**
   * Get current connection state
   */
  getState(): LayerWebSocketState {
    return { ...this.state };
  }

  /**
   * Get audit log for compliance reporting
   */
  getAuditLog(): WebSocketAuditEntry[] {
    return [...this.state.auditLog];
  }

  /**
   * Disconnect WebSocket and cleanup resources
   */
  disconnect(): void {
    // Stop all timers
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Close connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.state.connected = false;
    this.isConnecting = false;
    this.messageQueue = [];
    
    this.logAuditEvent({
      timestamp: new Date().toISOString(),
      event: 'websocket_disconnected_manual',
      details: { finalMetrics: this.state.performanceMetrics }
    });
    
    console.log('[LayerWebSocket] Disconnected manually');
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    const timeSinceLastMessage = Date.now() - this.state.lastMessageTime;
    const heartbeatThreshold = this.config.heartbeatInterval! * 2;
    
    return this.state.connected && timeSinceLastMessage < heartbeatThreshold;
  }
}

// React hook for easier integration with components
export function useLayerWebSocket(config: LayerWebSocketConfig) {
  const integration = new LayerWebSocketIntegration(config);
  
  return {
    connect: () => integration.connect(),
    disconnect: () => integration.disconnect(),
    sendMessage: (message: WebSocketLayerMessage) => integration.sendMessage(message),
    sendBatchUpdate: (entities: EntityDataPoint[], batchId?: string) => 
      integration.sendBatchUpdate(entities, batchId),
    sendConfidenceAdjustment: (entityId: string, confidence: number, reason: string) =>
      integration.sendConfidenceAdjustment(entityId, confidence, reason),
    getState: () => integration.getState(),
    getAuditLog: () => integration.getAuditLog(),
    isHealthy: () => integration.isHealthy()
  };
}

export default LayerWebSocketIntegration;