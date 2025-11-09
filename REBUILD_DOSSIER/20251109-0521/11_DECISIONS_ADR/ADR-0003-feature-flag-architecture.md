# ADR-0003: Feature Flag Architecture

**Status:** Accepted
**Date:** 2025-11-09
**Deciders:** Engineering Team
**Evidence:** F-0008, Antipattern-5

---

## Context

**Current State:**
- 8 feature flags defined in database
- **88% unused in frontend** (7 of 8 flags)
- No React integration pattern
- Flags exist but code doesn't check them

**PATH Evidence:**
- `/home/user/Forecastin/api/models/feature_flags.py:1-50` - Backend definitions
- `/home/user/Forecastin/frontend/src/` - Zero usage of flags

**Impact:**
- Gradual rollouts impossible
- A/B testing not feasible
- Can't toggle features without deploy
- Wasted infrastructure

---

## Decision

We will implement a **FeatureGate HOC pattern** for React to integrate with existing backend flags:

### Architecture

```
┌──────────────┐
│   Database   │  ← Feature flags stored here
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  FastAPI     │  ← GET /api/v1/feature-flags/:key
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ React Query  │  ← Cache flag state (1 minute TTL)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ FeatureGate  │  ← HOC conditionally renders
└──────────────┘
```

### Implementation

**Backend (already exists):**
```python
@router.get("/feature-flags/{key}")
async def get_feature_flag(key: str) -> FeatureFlagResponse:
    flag = await feature_flag_service.get(key)
    return FeatureFlagResponse(
        key=flag.key,
        enabled=flag.enabled,
        rollout_percentage=flag.rollout_percentage
    )
```

**Frontend Hook:**
```typescript
export function useFeatureFlag(flagKey: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['feature-flag', flagKey],
    queryFn: async () => {
      const response = await api.get<FeatureFlag>(`/api/v1/feature-flags/${flagKey}`);
      return response.data;
    },
    staleTime: 60000  // Cache 1 minute
  });

  return {
    enabled: data?.enabled ?? false,
    rolloutPercentage: data?.rolloutPercentage ?? 0,
    loading: isLoading,
    error
  };
}
```

**FeatureGate HOC:**
```typescript
export function FeatureGate({
  flag,
  children,
  fallback = null
}: FeatureGateProps) {
  const { enabled, loading } = useFeatureFlag(flag);

  if (loading) return <Spinner />;
  if (!enabled) return <>{fallback}</>;

  return <>{children}</>;
}
```

**Usage:**
```typescript
<FeatureGate flag="ff.point_layer" fallback={<LegacyPointLayer />}>
  <NewPointLayer />
</FeatureGate>
```

---

## Consequences

**Positive:**
- 88% of flags can now be used
- Gradual rollouts enabled (0% → 10% → 50% → 100%)
- A/B testing possible
- Feature toggling without deploy
- Easy rollback (disable flag)
- Consistent pattern across components

**Negative:**
- Extra API calls (mitigated by caching)
- Loading states needed in UI
- Complexity for simple features

**Migration:**
- T-0301: Create FeatureGate HOC
- T-0302 to T-0309: Integrate 8 flags (16 hours)
- Test rollout strategy per flag

---

## Rollout Strategy

**Standard Rollout:**
```
Week 1: 10%  (internal testing)
Week 2: 25%  (early adopters)
Week 3: 50%  (half of users)
Week 4: 100% (all users)
```

**Monitoring at each stage:**
- Error rate increase?
- Performance degradation?
- User complaints?

If issues: rollback to 0%, fix, restart rollout.

---

## Alternatives Considered

### Alternative 1: Environment Variables

**Pros:** Simple, no database needed

**Cons:**
- Requires deploy to change
- No gradual rollout
- No per-user targeting

**Rejected because:** No runtime control

### Alternative 2: LaunchDarkly/Split.io

**Pros:** Feature-rich, SDKs available, analytics

**Cons:**
- Extra cost ($$$)
- External dependency
- Complexity

**Rejected because:** Our database-backed solution is sufficient

### Alternative 3: Build-time Feature Flags

**Pros:** Zero runtime cost

**Cons:**
- Requires rebuild to change
- No gradual rollout
- Multiple builds for A/B testing

**Rejected because:** Need runtime flexibility

---

## Related

- **Addresses:** F-0008, AP-5
- **Tasks:** T-0301 to T-0309
- **Files:** `frontend/src/components/FeatureGate/FeatureGate.tsx`
