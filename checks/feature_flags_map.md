# Feature Flag Usage Map

**Generated:** 2025-11-07
**Repository:** Forecastin Geopolitical Intelligence Platform

---

## Executive Summary

Feature flag infrastructure exists but is largely unused. Only 1 out of 9 defined flags (`ff.map_v1`) is actively used in production components. The remaining 8 geospatial layer flags are defined but not integrated into layer implementations.

**Status:** ⚠️ INFRASTRUCTURE READY, ADOPTION PENDING

---

## 1. Feature Flag Service Architecture

### Frontend Hook

**File:** `frontend/src/hooks/useFeatureFlag.ts` (245 LOC)

**Implementation:**
- React Query-based with backend integration
- Query Key: `['feature-flag', flagName] as const`
- Caching: 60s stale time, 5min GC time
- Fallback: Local config if backend unavailable

**Usage Pattern:**
```typescript
const { isEnabled, isLoading, error } = useFeatureFlag('ff.map_v1', {
  refetchInterval: 30000,
  fallback: false,
});
```

### Backend Service

**File:** `api/services/feature_flag_service.py` (1,204 LOC)

**Status:** ✅ EXISTS - Not validated (requires Python env)

**Features (from GOLDEN_SOURCE.md):**
- Multi-tier caching (L1-L4)
- WebSocket notifications for flag changes
- Gradual rollout support (10% → 25% → 50% → 100%)
- A/B testing framework
- Automatic rollback capabilities

### Local Configuration

**File:** `frontend/src/config/feature-flags.ts` (397 LOC)

**Purpose:** Fallback configuration when backend unavailable

**Environment Variables:**
```bash
REACT_APP_FF_GEOSPATIAL=true
REACT_APP_FF_POINT_LAYER=true
REACT_APP_FF_CLUSTERING=true
REACT_APP_FF_WS_LAYERS=true
REACT_APP_FF_CORE_ROLLOUT=0
REACT_APP_FF_POINT_ROLLOUT=0
REACT_APP_FF_WS_ROLLOUT=0
REACT_APP_FF_VISUAL_ROLLOUT=0
```

---

## 2. Feature Flag Inventory

### Active Flags (1 flag)

| Flag Key | Purpose | Used In | Default | Rollout |
|----------|---------|---------|---------|---------|
| **ff.map_v1** | Enable map component v1 | MillerColumns.tsx, GeospatialView.tsx | false | 100% ⚠️ |

**Details:**
- **Files:** 2 components
- **Refetch Interval:** 30 seconds
- **Integration:** Fully integrated with UI conditional rendering
- **Status:** ✅ PRODUCTION READY

---

### Defined but Unused Flags (8 flags)

#### Core Geospatial Flags

| Flag Key | Purpose | Intended Usage | Default | Status |
|----------|---------|----------------|---------|--------|
| **ff.geospatial_layers** | Enable geospatial layer system | BaseLayer, LayerRegistry | false | ⚠️ NOT USED |
| **ff.point_layer** | Enable point layer rendering | PointLayer.ts | false | ⚠️ NOT USED |
| **ff.polygon_layer** | Enable polygon layer rendering | PolygonLayer.ts | false | ⚠️ NOT USED |
| **ff.heatmap_layer** | Enable heatmap layer rendering | HeatmapLayer (if exists) | false | ⚠️ NOT USED |
| **ff.clustering_enabled** | Enable point clustering | PointLayer clustering logic | false | ⚠️ NOT USED |
| **ff.gpu_filtering** | Enable GPU-based filtering | Layer GPU filter system | false | ⚠️ NOT USED |
| **ff.websocket_layers** | Enable WebSocket layer updates | LayerWebSocketIntegration | false | ⚠️ NOT USED |
| **ff.realtime_updates** | Enable real-time data updates | Realtime handlers | false | ⚠️ NOT USED |

**Helper Hook:** `useGeospatialFlags()` exists in `useFeatureFlag.ts:156-165` but is never called.

---

## 3. Usage Locations

### MillerColumns.tsx

**Location:** `frontend/src/components/MillerColumns/MillerColumns.tsx:391`

```typescript
const { isEnabled: mapV1Enabled, isLoading: mapFlagLoading } =
  useFeatureFlag('ff.map_v1', {
    refetchInterval: 30000,
  });
```

**Usage:**
```typescript
{mapV1Enabled && (
  <GeospatialView
    layers={activeLayers}
    onLayerClick={handleLayerClick}
  />
)}
```

**Status:** ✅ ACTIVE

---

### GeospatialView.tsx

**Location:** `frontend/src/components/Map/GeospatialView.tsx`

```typescript
const { isEnabled: mapV1Enabled, isLoading: flagLoading } =
  useFeatureFlag('ff.map_v1', {
    refetchInterval: 30000,
  });
```

**Usage:**
```typescript
if (!mapV1Enabled) {
  return <div>Map view not available</div>;
}
```

**Status:** ✅ ACTIVE

---

## 4. Rollout Strategy (Not Implemented)

### Intended Strategy (from feature-flags.ts)

```typescript
rollout_percentages: {
  core_layers: 0,              // Start with 0% rollout
  point_layers: 0,
  websocket_integration: 0,
  visual_channels: 0
}
```

**Gradual Rollout Phases:**
1. **Phase 0 (Current):** 0% - All flags disabled by default
2. **Phase 1:** 10% - Internal testing
3. **Phase 2:** 25% - Beta users
4. **Phase 3:** 50% - Half of production users
5. **Phase 4:** 100% - Full rollout

**Status:** ⚠️ MECHANISM EXISTS, NOT USED

**Implementation:**
- `LayerFeatureFlagManager.isRolloutPercentageAllowed()` in feature-flags.ts
- User rollout ID hashing for consistent experience
- Environment variable overrides: `REACT_APP_FF_*_ROLLOUT`

---

## 5. A/B Testing Configuration (Not Implemented)

### Defined Variants (from feature-flags.ts)

```typescript
ab_testing: {
  enabled: false,              // Disabled until basic functionality is stable
  variants: {
    layer_rendering_performance: 'baseline' | 'optimized' | 'experimental',
    confidence_scoring_algorithm: 'standard' | 'calibrated' | 'enhanced',
    entity_caching_strategy: 'lru' | 'adaptive' | 'hierarchical'
  }
}
```

**Status:** ⚠️ DEFINED, NEVER USED

**Purpose:**
- Test layer rendering optimizations
- Compare confidence scoring algorithms
- Evaluate caching strategies

---

## 6. Performance Targets (Defined, Not Enforced)

From `feature-flags.ts`:

```typescript
performance_targets: {
  render_time_ms: 10,          // Target: <10ms
  cache_hit_rate_percent: 99,  // Target: >99%
  throughput_rps: 10000,       // Target: >10,000 RPS
  memory_usage_mb: 100         // Target: <100MB
}
```

**Status:** ⚠️ TARGETS DEFINED, NO ENFORCEMENT

**Recommendation:** Integrate with performance monitoring to automatically rollback if targets not met.

---

## 7. Gap Analysis

### Issues Identified

1. **Feature Flag Adoption: 11% (1/9 flags used)**
   - Only `ff.map_v1` is actively used
   - 8 geospatial flags defined but not integrated

2. **Layer Implementations Missing Flag Checks**
   - `PointLayer.ts` (957 LOC) - No feature flag check
   - `PolygonLayer.ts` (1,064 LOC) - No feature flag check
   - `LinestringLayer.ts` (1,124 LOC) - No feature flag check
   - `BaseLayer.ts` (1,348 LOC) - No feature flag check
   - `GeoJsonLayer.ts` (1,365 LOC) - No feature flag check

3. **WebSocket Integration Not Gated**
   - `LayerWebSocketIntegration.ts` (749 LOC) - No `ff.websocket_layers` check

4. **Rollout Percentages Not Implemented**
   - All rollout percentages hardcoded to 0%
   - No dynamic rollout in production

5. **A/B Testing Unused**
   - Infrastructure exists but `ab_testing.enabled: false`
   - No variant selection logic in components

6. **Performance Targets Not Monitored**
   - Targets defined but not checked at runtime
   - No automatic rollback on SLO violations

---

## 8. Integration Gaps

### Missing Integrations

| Component | Flag | Status | LOC | Effort |
|-----------|------|--------|-----|--------|
| **PointLayer** | ff.point_layer | ❌ NOT INTEGRATED | 957 | 1 hour |
| **PolygonLayer** | ff.polygon_layer | ❌ NOT INTEGRATED | 1,064 | 1 hour |
| **LinestringLayer** | (no flag defined) | ❌ NO FLAG | 1,124 | 1.5 hours |
| **GeoJsonLayer** | (no flag defined) | ❌ NO FLAG | 1,365 | 1.5 hours |
| **BaseLayer** | ff.geospatial_layers | ❌ NOT INTEGRATED | 1,348 | 2 hours |
| **LayerRegistry** | ff.geospatial_layers | ❌ NOT INTEGRATED | 1,186 | 1 hour |
| **LayerWebSocketIntegration** | ff.websocket_layers | ❌ NOT INTEGRATED | 749 | 1 hour |
| **Clustering Logic** | ff.clustering_enabled | ❌ NOT INTEGRATED | TBD | 1 hour |
| **GPU Filters** | ff.gpu_filtering | ❌ NOT INTEGRATED | TBD | 1 hour |

**Total Integration Effort:** 11-12 hours

---

## 9. Recommendations

### Priority 1: Integrate Existing Flags (6-8 hours)

1. **Add flag checks to layer implementations:**
   ```typescript
   // In PointLayer.ts constructor
   const { isEnabled } = useFeatureFlag('ff.point_layer');
   if (!isEnabled) {
     throw new Error('Point layer feature flag disabled');
   }
   ```

2. **Gate LayerWebSocketIntegration:**
   ```typescript
   // In LayerWebSocketIntegration.ts
   const { isEnabled } = useFeatureFlag('ff.websocket_layers');
   if (!isEnabled) {
     return; // Skip WebSocket setup
   }
   ```

3. **Add flags for LinestringLayer and GeoJsonLayer:**
   - Define `ff.linestring_layer` and `ff.geojson_layer`
   - Update `useGeospatialFlags()` helper
   - Integrate into layer constructors

### Priority 2: Implement Rollout Strategy (2-3 hours)

1. **Enable dynamic rollout percentages:**
   ```typescript
   // Connect to backend FeatureFlagService
   // User rollout ID from backend or localStorage
   ```

2. **Add rollout percentage UI:**
   - Admin panel to adjust rollout percentages
   - Display current rollout status in dev tools

3. **Test rollout logic:**
   - Verify consistent user experience (same user always gets same flag state)
   - Test percentage distribution (e.g., 10% rollout affects ~10% of users)

### Priority 3: Add Performance Monitoring (3-4 hours)

1. **Monitor SLO compliance:**
   ```typescript
   if (renderTime > performanceTargets.render_time_ms) {
     // Log warning
     // Consider rollback if sustained violation
   }
   ```

2. **Add automatic rollback:**
   - If render time >10ms for >5 minutes, reduce rollout to previous percentage
   - Alert engineering team

3. **Expose performance metrics:**
   - Dashboard showing render times, cache hit rates, throughput
   - Per-flag performance comparison

### Priority 4: Enable A/B Testing (2-3 hours)

1. **Implement variant selection:**
   ```typescript
   const { variant } = useFeatureFlagVariant('layer_rendering_performance', {
     variants: ['baseline', 'optimized', 'experimental'],
     distribution: [33, 33, 34], // Percentage for each variant
   });
   ```

2. **Track variant performance:**
   - Log metrics per variant
   - Compare render times, error rates, user engagement

3. **Graduate winning variant:**
   - After statistically significant results, promote winning variant to default

---

## 10. Testing Recommendations

### Feature Flag Tests

**Add tests for:**
1. Flag state changes propagate to components
2. Rollout percentage logic is deterministic
3. Fallback to local config when backend unavailable
4. WebSocket notifications update flag state in real-time

**Example test:**
```typescript
describe('useFeatureFlag', () => {
  it('should enable feature for users in rollout percentage', () => {
    const userId = 'user-123';
    const rolloutPercentage = 50; // 50% rollout

    // Mock backend response
    mockFeatureFlagAPI.mockReturnValue({
      ff_point_layer: true,
      rollout_percentage: rolloutPercentage,
    });

    const { result } = renderHook(() =>
      useFeatureFlag('ff.point_layer', { userId })
    );

    // User ID hashes to value < 50%, so should be enabled
    expect(result.current.isEnabled).toBe(true);
  });
});
```

---

## 11. Documentation Needs

### Missing Documentation

1. **Feature Flag Lifecycle:**
   - How to add a new feature flag
   - How to roll out a flag (0% → 10% → 25% → 50% → 100%)
   - How to roll back a flag
   - How to remove a flag after full rollout

2. **Backend FeatureFlagService API:**
   - Endpoint documentation
   - Request/response formats
   - WebSocket notification format
   - Caching behavior

3. **Local Development:**
   - How to override flags locally
   - How to test different rollout percentages
   - How to simulate A/B testing variants

4. **Production Playbook:**
   - Monitoring flag adoption
   - Responding to SLO violations
   - Coordinating flag changes across environments

---

## 12. Summary

### Current State

- ✅ Infrastructure: **Complete**
- ⚠️ Adoption: **11% (1/9 flags)**
- ⚠️ Rollout: **Not implemented**
- ⚠️ A/B Testing: **Not enabled**
- ⚠️ Monitoring: **Not integrated**

### Effort Required

| Task | Effort | Priority |
|------|--------|----------|
| Integrate flags into layers | 6-8 hours | P1 |
| Implement rollout strategy | 2-3 hours | P2 |
| Add performance monitoring | 3-4 hours | P2 |
| Enable A/B testing | 2-3 hours | P3 |
| Write documentation | 2-3 hours | P3 |
| **Total** | **15-21 hours** | |

### Expected Outcome

After completing integration:
- Gradual, safe rollout of geospatial features
- Data-driven decisions via A/B testing
- Automatic rollback on performance regressions
- Clear metrics on feature adoption and performance

---

**END OF feature_flags_map.md**
