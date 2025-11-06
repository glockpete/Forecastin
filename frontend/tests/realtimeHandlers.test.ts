/**
 * Realtime Handlers Idempotency and Ordering Tests
 *
 * Tests that WebSocket message handlers are idempotent and handle
 * out-of-order messages correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MessageSequenceTracker,
  MessageDeduplicator,
  type RealtimeMessage,
  type LayerDataUpdateMessage,
  type GPUFilterSyncMessage,
} from '../src/types/ws_messages';

// ============================================================================
// Mock Data
// ============================================================================

function createLayerDataUpdateMessage(
  layerId: string,
  sequence: number,
  clientId: string = 'test-client',
  changedAt: number = Date.now()
): LayerDataUpdateMessage {
  return {
    type: 'layer_data_update',
    payload: {
      layer_id: layerId,
      layer_type: 'point',
      layer_data: {
        type: 'FeatureCollection',
        features: [],
      },
      changed_at: changedAt,
    },
    meta: {
      timestamp: Date.now(),
      sequence,
      clientId,
    },
  };
}

function createGPUFilterSyncMessage(
  filterId: string,
  sequence: number,
  clientId: string = 'test-client',
  changedAt: number = Date.now()
): GPUFilterSyncMessage {
  return {
    type: 'gpu_filter_sync',
    payload: {
      filter_id: filterId,
      filter_type: 'spatial',
      filter_params: {
        bounds: {
          minLat: 0,
          maxLat: 10,
          minLng: 0,
          maxLng: 10,
        },
      },
      affected_layers: ['layer-1'],
      status: 'applied',
      changed_at: changedAt,
    },
    meta: {
      timestamp: Date.now(),
      sequence,
      clientId,
    },
  };
}

// ============================================================================
// Message Sequence Tracker Tests
// ============================================================================

describe('MessageSequenceTracker', () => {
  let tracker: MessageSequenceTracker;

  beforeEach(() => {
    tracker = new MessageSequenceTracker();
  });

  it('should process first message from client', () => {
    const msg = createLayerDataUpdateMessage('layer-1', 1, 'client-1');
    expect(tracker.shouldProcess(msg)).toBe(true);
  });

  it('should process messages in order', () => {
    const msg1 = createLayerDataUpdateMessage('layer-1', 1, 'client-1');
    const msg2 = createLayerDataUpdateMessage('layer-1', 2, 'client-1');
    const msg3 = createLayerDataUpdateMessage('layer-1', 3, 'client-1');

    expect(tracker.shouldProcess(msg1)).toBe(true);
    expect(tracker.shouldProcess(msg2)).toBe(true);
    expect(tracker.shouldProcess(msg3)).toBe(true);
  });

  it('should reject duplicate messages (same sequence)', () => {
    const msg1 = createLayerDataUpdateMessage('layer-1', 5, 'client-1');
    const msg2 = createLayerDataUpdateMessage('layer-1', 5, 'client-1');

    expect(tracker.shouldProcess(msg1)).toBe(true);
    expect(tracker.shouldProcess(msg2)).toBe(false); // Duplicate
  });

  it('should reject out-of-order messages (lower sequence)', () => {
    const msg1 = createLayerDataUpdateMessage('layer-1', 10, 'client-1');
    const msg2 = createLayerDataUpdateMessage('layer-1', 5, 'client-1');

    expect(tracker.shouldProcess(msg1)).toBe(true);
    expect(tracker.shouldProcess(msg2)).toBe(false); // Out of order
  });

  it('should handle multiple clients independently', () => {
    const msg1_client1 = createLayerDataUpdateMessage('layer-1', 1, 'client-1');
    const msg1_client2 = createLayerDataUpdateMessage('layer-1', 1, 'client-2');
    const msg2_client1 = createLayerDataUpdateMessage('layer-1', 2, 'client-1');
    const msg2_client2 = createLayerDataUpdateMessage('layer-1', 2, 'client-2');

    expect(tracker.shouldProcess(msg1_client1)).toBe(true);
    expect(tracker.shouldProcess(msg1_client2)).toBe(true);
    expect(tracker.shouldProcess(msg2_client1)).toBe(true);
    expect(tracker.shouldProcess(msg2_client2)).toBe(true);
  });

  it('should process messages without sequence numbers', () => {
    const msg: LayerDataUpdateMessage = {
      type: 'layer_data_update',
      payload: {
        layer_id: 'layer-1',
        layer_type: 'point',
        layer_data: {
          type: 'FeatureCollection',
          features: [],
        },
        changed_at: Date.now(),
      },
      meta: {
        timestamp: Date.now(),
        // No sequence or clientId
      },
    };

    expect(tracker.shouldProcess(msg)).toBe(true);
  });

  it('should reset tracking for specific client', () => {
    const msg1 = createLayerDataUpdateMessage('layer-1', 5, 'client-1');
    const msg2 = createLayerDataUpdateMessage('layer-1', 3, 'client-1');

    expect(tracker.shouldProcess(msg1)).toBe(true);
    expect(tracker.shouldProcess(msg2)).toBe(false);

    tracker.reset('client-1');

    const msg3 = createLayerDataUpdateMessage('layer-1', 1, 'client-1');
    expect(tracker.shouldProcess(msg3)).toBe(true);
  });

  it('should clear all tracking', () => {
    const msg1 = createLayerDataUpdateMessage('layer-1', 5, 'client-1');
    const msg2 = createLayerDataUpdateMessage('layer-2', 10, 'client-2');

    expect(tracker.shouldProcess(msg1)).toBe(true);
    expect(tracker.shouldProcess(msg2)).toBe(true);

    tracker.clearAll();

    const msg3 = createLayerDataUpdateMessage('layer-1', 1, 'client-1');
    const msg4 = createLayerDataUpdateMessage('layer-2', 1, 'client-2');

    expect(tracker.shouldProcess(msg3)).toBe(true);
    expect(tracker.shouldProcess(msg4)).toBe(true);
  });
});

// ============================================================================
// Message Deduplicator Tests
// ============================================================================

describe('MessageDeduplicator', () => {
  let deduplicator: MessageDeduplicator;

  beforeEach(() => {
    deduplicator = new MessageDeduplicator(1000); // 1 second window
  });

  it('should mark first message as new', () => {
    const msg = createLayerDataUpdateMessage('layer-1', 1, 'client-1');
    expect(deduplicator.isNew(msg)).toBe(true);
  });

  it('should detect duplicate messages within window', () => {
    const timestamp = Date.now();
    const msg1 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);
    const msg2 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);

    expect(deduplicator.isNew(msg1)).toBe(true);
    expect(deduplicator.isNew(msg2)).toBe(false); // Duplicate
  });

  it('should allow same message after window expires', async () => {
    const dedup = new MessageDeduplicator(100); // 100ms window

    const timestamp = Date.now();
    const msg1 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);
    const msg2 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);

    expect(dedup.isNew(msg1)).toBe(true);
    expect(dedup.isNew(msg2)).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    const msg3 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);
    expect(dedup.isNew(msg3)).toBe(true); // Window expired, should be new
  });

  it('should handle different message types independently', () => {
    const timestamp = Date.now();
    const layerMsg = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);
    const filterMsg = createGPUFilterSyncMessage('filter-1', 1, 'client-1', timestamp);

    expect(deduplicator.isNew(layerMsg)).toBe(true);
    expect(deduplicator.isNew(filterMsg)).toBe(true); // Different type, should be new
  });

  it('should handle different entities independently', () => {
    const timestamp = Date.now();
    const msg1 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);
    const msg2 = createLayerDataUpdateMessage('layer-2', 1, 'client-1', timestamp);

    expect(deduplicator.isNew(msg1)).toBe(true);
    expect(deduplicator.isNew(msg2)).toBe(true); // Different layer, should be new
  });

  it('should clear all tracked messages', () => {
    const timestamp = Date.now();
    const msg1 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);
    const msg2 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);

    expect(deduplicator.isNew(msg1)).toBe(true);
    expect(deduplicator.isNew(msg2)).toBe(false);

    deduplicator.clear();

    const msg3 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', timestamp);
    expect(deduplicator.isNew(msg3)).toBe(true); // After clear, should be new
  });
});

// ============================================================================
// Idempotency Tests
// ============================================================================

describe('Message Idempotency', () => {
  it('should produce same result when processing duplicate layer_data_update', () => {
    const tracker = new MessageSequenceTracker();
    const dedup = new MessageDeduplicator();

    const msg1 = createLayerDataUpdateMessage('layer-1', 10, 'client-1');
    const msg2 = createLayerDataUpdateMessage('layer-1', 10, 'client-1'); // Exact duplicate

    // First message should be processed
    expect(tracker.shouldProcess(msg1)).toBe(true);
    expect(dedup.isNew(msg1)).toBe(true);

    // Duplicate should be rejected
    expect(tracker.shouldProcess(msg2)).toBe(false);
    expect(dedup.isNew(msg2)).toBe(false);
  });

  it('should produce same result when processing duplicate gpu_filter_sync', () => {
    const tracker = new MessageSequenceTracker();
    const dedup = new MessageDeduplicator();

    const msg1 = createGPUFilterSyncMessage('filter-1', 5, 'client-1');
    const msg2 = createGPUFilterSyncMessage('filter-1', 5, 'client-1'); // Exact duplicate

    // First message should be processed
    expect(tracker.shouldProcess(msg1)).toBe(true);
    expect(dedup.isNew(msg1)).toBe(true);

    // Duplicate should be rejected
    expect(tracker.shouldProcess(msg2)).toBe(false);
    expect(dedup.isNew(msg2)).toBe(false);
  });
});

// ============================================================================
// Ordering Policy Tests
// ============================================================================

describe('Message Ordering Policy', () => {
  it('should ignore out-of-order messages by default', () => {
    const tracker = new MessageSequenceTracker();

    const msg1 = createLayerDataUpdateMessage('layer-1', 10, 'client-1');
    const msg2 = createLayerDataUpdateMessage('layer-1', 5, 'client-1'); // Out of order
    const msg3 = createLayerDataUpdateMessage('layer-1', 15, 'client-1');

    expect(tracker.shouldProcess(msg1)).toBe(true);
    expect(tracker.shouldProcess(msg2)).toBe(false); // Ignored (out of order)
    expect(tracker.shouldProcess(msg3)).toBe(true);
  });

  it('should process messages in strict sequence order', () => {
    const tracker = new MessageSequenceTracker();
    const results: boolean[] = [];

    const messages = [
      createLayerDataUpdateMessage('layer-1', 1, 'client-1'),
      createLayerDataUpdateMessage('layer-1', 2, 'client-1'),
      createLayerDataUpdateMessage('layer-1', 3, 'client-1'),
      createLayerDataUpdateMessage('layer-1', 4, 'client-1'),
      createLayerDataUpdateMessage('layer-1', 5, 'client-1'),
    ];

    messages.forEach(msg => {
      results.push(tracker.shouldProcess(msg));
    });

    expect(results).toEqual([true, true, true, true, true]);
  });

  it('should handle sequence gaps (missing messages)', () => {
    const tracker = new MessageSequenceTracker();

    const msg1 = createLayerDataUpdateMessage('layer-1', 1, 'client-1');
    const msg2 = createLayerDataUpdateMessage('layer-1', 5, 'client-1'); // Gap: 2, 3, 4 missing
    const msg3 = createLayerDataUpdateMessage('layer-1', 10, 'client-1'); // Another gap

    expect(tracker.shouldProcess(msg1)).toBe(true);
    expect(tracker.shouldProcess(msg2)).toBe(true); // Accept despite gap
    expect(tracker.shouldProcess(msg3)).toBe(true);
  });
});

// ============================================================================
// Deterministic Clock Tests
// ============================================================================

describe('Deterministic Clock for Testing', () => {
  it('should use mocked timestamps for reproducible tests', () => {
    const mockNow = 1699564800000; // Fixed timestamp
    vi.setSystemTime(new Date(mockNow));

    const msg = createLayerDataUpdateMessage('layer-1', 1);

    expect(msg.meta.timestamp).toBe(mockNow);

    vi.useRealTimers();
  });

  it('should handle time-based deduplication deterministically', () => {
    const mockNow = 1699564800000;
    vi.setSystemTime(new Date(mockNow));

    const dedup = new MessageDeduplicator(1000);

    const msg1 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', mockNow);
    expect(dedup.isNew(msg1)).toBe(true);

    // Advance time by 500ms (within window)
    vi.setSystemTime(new Date(mockNow + 500));
    const msg2 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', mockNow);
    expect(dedup.isNew(msg2)).toBe(false);

    // Advance time by 1100ms (beyond window)
    vi.setSystemTime(new Date(mockNow + 1100));
    const msg3 = createLayerDataUpdateMessage('layer-1', 1, 'client-1', mockNow);
    expect(dedup.isNew(msg3)).toBe(true);

    vi.useRealTimers();
  });
});
