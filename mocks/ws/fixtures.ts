/**
 * WebSocket Mock Fixtures
 *
 * Purpose: Test WebSocket handlers without live connections
 * Includes: Valid, adversarial, and edge case payloads
 *
 * Usage:
 * ```typescript
 * import { validEntityUpdate, outOfOrderMessages } from '@/mocks/ws/fixtures';
 *
 * test('handles entity update', () => {
 *   handleMessage(validEntityUpdate);
 *   expect(cache.get(validEntityUpdate.data.entityId)).toBeDefined();
 * });
 * ```
 */

import type { WebSocketMessage } from '../../types/ws_messages';

// ============================================================================
// VALID FIXTURES - Happy path scenarios
// ============================================================================

export const validEntityUpdate: Extract<WebSocketMessage, { type: 'entity_update' }> = {
  type: 'entity_update',
  timestamp: 1730899200000,
  data: {
    entityId: 'ent_001',
    entity: {
      id: 'ent_001',
      name: 'Acme Corporation',
      type: 'organization',
      path: 'root.companies.acme',
      pathDepth: 3,
      confidence: 0.95,
      metadata: { industry: 'technology', employees: 5000 },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-11-06T12:00:00Z',
      hasChildren: true,
      childrenCount: 12,
    },
    changeType: 'update',
  },
};

export const validHierarchyChange: Extract<WebSocketMessage, { type: 'hierarchy_change' }> = {
  type: 'hierarchy_change',
  timestamp: 1730899200000,
  data: {
    path: 'root.companies',
    affectedEntities: ['ent_001', 'ent_002', 'ent_003'],
    operation: 'restructure',
    parentId: 'ent_parent_001',
  },
};

export const validLayerDataUpdate: Extract<WebSocketMessage, { type: 'layer_data_update' }> = {
  type: 'layer_data_update',
  timestamp: 1730899200000,
  data: {
    layerId: 'layer_points_001',
    layerType: 'point',
    entities: [
      {
        id: 'geo_001',
        geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        properties: { name: 'San Francisco HQ', confidence: 0.88 },
        confidence: 0.88,
      },
      {
        id: 'geo_002',
        geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
        properties: { name: 'New York Office', confidence: 0.92 },
        confidence: 0.92,
      },
    ],
    operation: 'add',
    affectedBounds: {
      minLat: 37.0,
      maxLat: 41.0,
      minLng: -125.0,
      maxLng: -73.0,
    },
  },
};

export const validFeatureFlagChange: Extract<WebSocketMessage, { type: 'feature_flag_change' }> = {
  type: 'feature_flag_change',
  timestamp: 1730899200000,
  data: {
    flagName: 'ff.geospatial_layers',
    isEnabled: true,
    rolloutPercentage: 50,
    previousValue: false,
    updatedAt: 1730899200000,
  },
};

export const validPing: Extract<WebSocketMessage, { type: 'ping' }> = {
  type: 'ping',
  timestamp: 1730899200000,
  data: {},
};

export const validPong: Extract<WebSocketMessage, { type: 'pong' }> = {
  type: 'pong',
  timestamp: 1730899201000,
  data: {
    client_id: 'ws_client_1730899200000_12345',
    timestamp: 1730899201000,
  },
};

// ============================================================================
// ADVERSARIAL FIXTURES - Edge cases and malformed data
// ============================================================================

/**
 * Duplicate messages with same timestamp
 * Tests: Deduplication logic
 */
export const duplicateMessages: WebSocketMessage[] = [
  validEntityUpdate,
  validEntityUpdate,  // Exact duplicate
  validEntityUpdate,  // Triple send
];

/**
 * Out-of-order messages with timestamps
 * Tests: Ordering enforcement
 */
export const outOfOrderMessages: Extract<WebSocketMessage, { type: 'entity_update' }>[] = [
  {
    type: 'entity_update',
    timestamp: 1730899203000,  // Latest
    data: {
      entityId: 'ent_001',
      entity: { ...validEntityUpdate.data.entity, confidence: 0.97 },
      changeType: 'update',
    },
  },
  {
    type: 'entity_update',
    timestamp: 1730899201000,  // Older
    data: {
      entityId: 'ent_001',
      entity: { ...validEntityUpdate.data.entity, confidence: 0.90 },
      changeType: 'update',
    },
  },
  {
    type: 'entity_update',
    timestamp: 1730899202000,  // Middle
    data: {
      entityId: 'ent_001',
      entity: { ...validEntityUpdate.data.entity, confidence: 0.93 },
      changeType: 'update',
    },
  },
];

/**
 * Missing required fields
 * Tests: Validation and error handling
 */
export const missingFieldsMessage = {
  type: 'entity_update',
  // Missing timestamp
  data: {
    // Missing entityId
    entity: {
      id: 'ent_999',
      // Missing name, type, path
    },
  },
};

/**
 * Null and undefined values
 * Tests: Null handling
 */
export const nullFieldsMessage: Extract<WebSocketMessage, { type: 'entity_update' }> = {
  type: 'entity_update',
  timestamp: 1730899200000,
  data: {
    entityId: 'ent_null',
    entity: {
      id: 'ent_null',
      name: 'Null Test',
      type: 'test',
      path: 'root.test',
      pathDepth: 2,
      confidence: undefined,
      metadata: null as any,
      createdAt: undefined,
      updatedAt: undefined,
      hasChildren: undefined,
      childrenCount: undefined,
    },
    changeType: undefined,
  },
};

/**
 * Very large payload
 * Tests: Performance and memory handling
 */
export const largePayload: Extract<WebSocketMessage, { type: 'bulk_update' }> = {
  type: 'bulk_update',
  timestamp: 1730899200000,
  data: {
    entityIds: Array.from({ length: 10000 }, (_, i) => `ent_${i.toString().padStart(6, '0')}`),
    updateType: 'confidence',
    changes: {
      confidence: 0.85,
      metadata: { bulkUpdate: true, batchSize: 10000 },
    },
  },
};

/**
 * Invalid GeoJSON geometry
 * Tests: Geospatial validation
 */
export const invalidGeometry: Extract<WebSocketMessage, { type: 'layer_data_update' }> = {
  type: 'layer_data_update',
  timestamp: 1730899200000,
  data: {
    layerId: 'layer_invalid',
    layerType: 'point',
    entities: [
      {
        id: 'geo_invalid',
        geometry: { type: 'Point', coordinates: [999, 999] } as any,  // Invalid coordinates
        properties: {},
        confidence: 0.5,
      },
    ],
    operation: 'add',
  },
};

/**
 * Circular reference attempt
 * Tests: Serialization safety
 */
export function createCircularReferenceMessage(): any {
  const circular: any = {
    type: 'entity_update',
    timestamp: 1730899200000,
    data: {
      entityId: 'ent_circular',
      entity: {} as any,
    },
  };
  circular.data.entity.self = circular;  // Create circular reference
  return circular;
}

/**
 * Deep nesting
 * Tests: Recursion limits
 */
export const deeplyNestedMessage: Extract<WebSocketMessage, { type: 'entity_update' }> = {
  type: 'entity_update',
  timestamp: 1730899200000,
  data: {
    entityId: 'ent_deep',
    entity: {
      id: 'ent_deep',
      name: 'Deep Test',
      type: 'test',
      path: 'root.test',
      pathDepth: 2,
      metadata: {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: 'deeply nested value',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * Special characters and Unicode
 * Tests: Character encoding
 */
export const specialCharactersMessage: Extract<WebSocketMessage, { type: 'entity_update' }> = {
  type: 'entity_update',
  timestamp: 1730899200000,
  data: {
    entityId: 'ent_unicode',
    entity: {
      id: 'ent_unicode',
      name: '中文 Français 日本語 العربية 🚀',
      type: 'test',
      path: 'root.test.unicode',
      pathDepth: 3,
      metadata: {
        emoji: '😀😃😄😁',
        rtl: 'مرحبا بك',
        cjk: '你好世界',
        special: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`',
      },
    },
  },
};

/**
 * Invalid LTREE path
 * Tests: Path validation
 */
export const invalidLTreePath: Extract<WebSocketMessage, { type: 'entity_update' }> = {
  type: 'entity_update',
  timestamp: 1730899200000,
  data: {
    entityId: 'ent_badpath',
    entity: {
      id: 'ent_badpath',
      name: 'Bad Path',
      type: 'test',
      path: '.root..child.',  // Invalid: leading/trailing dots, double dots
      pathDepth: -1,          // Invalid: negative depth
    },
  },
};

/**
 * Future timestamp (clock skew)
 * Tests: Timestamp validation
 */
export const futureTimestamp: Extract<WebSocketMessage, { type: 'entity_update' }> = {
  type: 'entity_update',
  timestamp: Date.now() + 3600000,  // 1 hour in future
  data: {
    entityId: 'ent_future',
    entity: {
      id: 'ent_future',
      name: 'Future Entity',
      type: 'test',
      path: 'root.test',
      pathDepth: 2,
    },
  },
};

// ============================================================================
// SCENARIO FIXTURES - Real-world scenarios
// ============================================================================

/**
 * Rapid update sequence (same entity)
 * Tests: Update throttling and batching
 */
export const rapidUpdateSequence: Extract<WebSocketMessage, { type: 'entity_update' }>[] = Array.from(
  { length: 100 },
  (_, i) => ({
    type: 'entity_update',
    timestamp: 1730899200000 + i * 10,  // 10ms apart
    data: {
      entityId: 'ent_rapid',
      entity: {
        id: 'ent_rapid',
        name: `Entity Update ${i}`,
        type: 'test',
        path: 'root.test.rapid',
        pathDepth: 3,
        confidence: 0.5 + (i / 200),  // Gradually increasing
      },
      changeType: 'update',
    },
  })
);

/**
 * Batch message with mixed types
 * Tests: Batch processing
 */
export const batchMessage: Extract<WebSocketMessage, { type: 'batch' }> = {
  type: 'batch',
  timestamp: 1730899200000,
  data: {
    messages: [
      validEntityUpdate,
      validHierarchyChange,
      validLayerDataUpdate,
      validFeatureFlagChange,
    ],
  },
};

/**
 * Error message
 * Tests: Error handling
 */
export const errorMessage: Extract<WebSocketMessage, { type: 'error' }> = {
  type: 'error',
  timestamp: 1730899200000,
  error: 'Database connection lost',
  code: 'DB_CONNECTION_ERROR',
  details: {
    service: 'postgres',
    retryCount: 3,
    lastError: 'Connection timeout after 30s',
  },
};

/**
 * Serialization error
 * Tests: Fallback error handling
 */
export const serializationError: Extract<WebSocketMessage, { type: 'serialization_error' }> = {
  type: 'serialization_error',
  timestamp: 1730899200000,
  error: 'Failed to serialize datetime object',
  originalMessageType: 'entity_update',
};

// ============================================================================
// COLLECTION EXPORTS
// ============================================================================

export const validMessages: WebSocketMessage[] = [
  validEntityUpdate,
  validHierarchyChange,
  validLayerDataUpdate,
  validFeatureFlagChange,
  validPing,
  validPong,
];

export const adversarialMessages = [
  ...duplicateMessages,
  ...outOfOrderMessages,
  missingFieldsMessage,
  nullFieldsMessage,
  largePayload,
  invalidGeometry,
  deeplyNestedMessage,
  specialCharactersMessage,
  invalidLTreePath,
  futureTimestamp,
];

export const scenarioMessages = [
  ...rapidUpdateSequence,
  batchMessage,
  errorMessage,
  serializationError,
];

export const allFixtures = [
  ...validMessages,
  ...adversarialMessages,
  ...scenarioMessages,
];
