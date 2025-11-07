# Pull Request: Fix Unbounded Memory Growth in MessageDeduplicator (Defect #4)

**Branch**: `claude/fix-deduplicator-memory-011CUsoAxs3YjamicNicZeGD`
**PR URL**: https://github.com/glockpete/Forecastin/pull/new/claude/fix-deduplicator-memory-011CUsoAxs3YjamicNicZeGD

## Summary

Fixes memory leak in `MessageDeduplicator` where old entries would accumulate indefinitely during low-traffic periods, causing unbounded memory growth.

## Problem

**Original Issue (Defect #4 - MEDIUM Priority)**:

The `cleanup()` method only runs when `isNew()` is called. During idle periods (no new messages), old entries never expire:

```typescript
// Scenario causing memory leak:
// 1. Process 1000 messages in 1 minute (high traffic)
// 2. Wait 1 hour with no messages
// 3. Map still contains all 1000 entries despite window expiration
// 4. Memory usage grows unbounded over time
```

## Solution

Added a periodic cleanup timer that runs automatically:

```typescript
export class MessageDeduplicator {
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(windowMs: number = 5000) {
    this.windowMs = windowMs;

    // Periodic cleanup timer runs every window duration
    this.cleanupTimer = setInterval(() => {
      this.cleanup(Date.now());
    }, windowMs);
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.recentMessages.clear();
  }
}
```

## Changes

### `src/types/ws_messages.ts`
- Added `cleanupTimer` property to track the interval
- Constructor now starts periodic cleanup timer
- Timer runs every `windowMs` (default 5 seconds)
- Added `destroy()` method to clean up timer and prevent memory leaks
- Inline cleanup still runs for immediate response

## Benefits

- **Memory Bounded**: Old entries removed even during idle periods
- **Predictable Memory Usage**: Memory usage bounded by `window size × message rate`
- **No Performance Impact**: Cleanup runs asynchronously
- **Proper Cleanup**: `destroy()` method prevents timer leak on unmount

## Testing

### Memory Leak Reproduction
```typescript
const dedup = new MessageDeduplicator(5000); // 5 second window

// Simulate high traffic followed by idle
for (let i = 0; i < 1000; i++) {
  dedup.isNew({ type: 'test', meta: { timestamp: Date.now() } });
}

console.log(dedup['recentMessages'].size); // 1000 entries

// BEFORE: Wait 1 hour -> still 1000 entries (memory leak)
// AFTER:  Wait 10 seconds -> 0 entries (cleaned up) ✅

// Don't forget to clean up!
dedup.destroy();
```

### Memory Usage Validation
```typescript
// Monitor memory usage over time
const dedup = new MessageDeduplicator(5000);

// Send burst of messages
for (let i = 0; i < 10000; i++) {
  dedup.isNew({ type: 'test', meta: { timestamp: Date.now() + i } });
}

// Wait for cleanup cycles
setTimeout(() => {
  const size = dedup['recentMessages'].size;
  console.log(`Entries after cleanup: ${size}`);
  // Should be 0 or near 0
  dedup.destroy();
}, 15000);
```

## Breaking Changes

None - backward compatible enhancement. Added `destroy()` method should be called on component unmount but existing code continues to work.

## Migration Guide

For React components using MessageDeduplicator:

```typescript
// Add cleanup on unmount
useEffect(() => {
  const dedup = new MessageDeduplicator();

  return () => {
    dedup.destroy(); // Clean up timer
  };
}, []);
```

## Related

- Fixes: Bug Report Defect #4 (MEDIUM priority)
- Risk: Performance, Memory Leak
- Files: 1 modified

---

**To create the PR**: Visit https://github.com/glockpete/Forecastin/pull/new/claude/fix-deduplicator-memory-011CUsoAxs3YjamicNicZeGD
