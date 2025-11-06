# Geospatial Feature Flags Documentation

## Overview

This document describes the three granular feature flags implemented for controlled rollout of the geospatial layer system in the Forecastin project.

## Feature Flags

### 1. `ff.geo.layers_enabled` (Master Switch)

**Purpose:** Master control for the entire geospatial layer system

**Dependencies:** `ff.map_v1`

**Default State:**
- Enabled: `false`
- Rollout: `0%`

**Description:** This flag acts as the master switch for all geospatial layer functionality. When disabled, all geospatial features are unavailable regardless of sub-flag states. Must be enabled before any other geospatial flags can function.

**Usage:**

Backend:
```python
from services.feature_flag_service import feature_flag_service

# Check if layers are enabled for a user
is_enabled = await feature_flag_service.get_flag_with_rollout(
    "ff.geo.layers_enabled", 
    user_id="user-123"
)
```

Frontend:
```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

const { isEnabled } = useFeatureFlag('ff.geo.layers_enabled', {
  userId: currentUser.id,
  checkRollout: true
});
```

---

### 2. `ff.geo.gpu_rendering_enabled` (GPU Acceleration)

**Purpose:** Controls GPU-accelerated filtering and rendering

**Dependencies:** `ff.geo.layers_enabled`

**Default State:**
- Enabled: `false`
- Rollout: `0%`

**Description:** Enables GPU-based spatial filtering for high-performance rendering of large geospatial datasets. When disabled, the system falls back to CPU-based rendering. This flag should only be enabled after `ff.geo.layers_enabled` has been successfully rolled out.

**Performance Impact:**
- **GPU Enabled:** 60+ FPS for 100K+ points
- **CPU Fallback:** 30-45 FPS for 100K+ points

**Usage:**

Backend:
```python
# Check GPU rendering availability
gpu_enabled = await feature_flag_service.get_flag_with_rollout(
    "ff.geo.gpu_rendering_enabled",
    user_id="user-123"
)

if gpu_enabled:
    renderer = GPUFilterRenderer()
else:
    renderer = StandardRenderer()
```

Frontend:
```typescript
const { isEnabled: useGPU } = useFeatureFlag('ff.geo.gpu_rendering_enabled');

const layerConfig = {
  ...baseConfig,
  gpuAcceleration: useGPU
};
```

---

### 3. `ff.geo.point_layer_active` (PointLayer Visibility)

**Purpose:** Controls visibility of PointLayer implementation

**Dependencies:** `ff.geo.layers_enabled`

**Default State:**
- Enabled: `false`
- Rollout: `0%`

**Description:** Enables/disables the PointLayer implementation for rendering point-based geospatial data (events, entities, incidents). This allows gradual rollout of point visualization features independent of other layer types.

**Usage:**

Backend:
```python
# Check if point layer should be visible
point_layer_active = await feature_flag_service.get_flag_with_rollout(
    "ff.geo.point_layer_active",
    user_id="user-123"
)

if point_layer_active:
    layers.append(PointLayer(data=point_data))
```

Frontend:
```typescript
const { isEnabled: showPointLayer } = useFeatureFlag('ff.geo.point_layer_active');

return (
  <GeospatialView>
    {showPointLayer && <PointLayer data={pointData} />}
  </GeospatialView>
);
```

---

## Dependency Chain

The flags follow a strict dependency hierarchy:

```
ff.map_v1 (existing)
  └─ ff.geo.layers_enabled (master switch)
      ├─ ff.geo.gpu_rendering_enabled
      └─ ff.geo.point_layer_active
```

**Rules:**
1. `ff.geo.layers_enabled` requires `ff.map_v1` to be enabled
2. `ff.geo.gpu_rendering_enabled` and `ff.geo.point_layer_active` require `ff.geo.layers_enabled`
3. Disabling a parent flag automatically disables dependent flags

---

## Rollout Strategy

All flags follow the standard **10% → 25% → 50% → 100%** rollout strategy.

### Phase 1: Foundation (Weeks 1-2)

**Prerequisite:**
```bash
# Ensure ff.map_v1 is enabled
curl -X PUT http://localhost:8000/api/feature-flags/ff.map_v1/enable
curl -X PUT http://localhost:8000/api/feature-flags/ff.map_v1/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 100}'
```

**Enable Master Switch:**
```bash
# Enable with 10% rollout
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/enable
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 10}'
```

**Monitor:**
- WebSocket message frequency
- Client-side rendering performance
- Server memory usage
- Error rates

**Success Criteria:**
- < 1% error rate
- < 100ms P95 layer update latency
- No memory leaks over 24 hours

### Phase 2: Expansion (Weeks 3-4)

```bash
# Increase rollout
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 25}'
```

**Monitor:**
- Scaling behavior with increased load
- Cache hit rates
- Database query performance

### Phase 3: Majority Rollout (Weeks 5-6)

```bash
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 50}'
```

**Monitor:**
- Infrastructure capacity
- Cost metrics
- User feedback

### Phase 4: Full Rollout + Sub-Features (Weeks 7-8)

```bash
# Full rollout of master switch
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 100}'

# Enable GPU rendering (10% rollout)
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.gpu_rendering_enabled/enable
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.gpu_rendering_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 10}'

# Enable point layer (10% rollout)
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.point_layer_active/enable
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.point_layer_active/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 10}'
```

---

## Rollback Procedures

### Emergency Rollback (Immediate)

**Scenario:** Critical bug detected

```bash
# Disable master switch (disables all geospatial features)
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/disable

# Or use the emergency rollback endpoint (if available)
curl -X POST http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/rollback
```

**Verification:**
```bash
# Check status
curl http://localhost:8000/api/feature-flags/ff.geo.layers_enabled
```

**Expected:**
```json
{
  "flag_name": "ff.geo.layers_enabled",
  "is_enabled": false,
  "rollout_percentage": 0
}
```

### Gradual Rollback

**Scenario:** Performance issues, gradual reduction preferred

```bash
# Reduce to 50%
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 50}'

# Monitor... then reduce to 25%
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 25}'

# Finally disable
curl -X PUT http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/disable
```

### Rollback Decision Matrix

| Severity | Strategy | Timeline |
|----------|----------|----------|
| **Critical** (data loss, security) | Emergency rollback | Immediate |
| **High** (major functionality broken) | Emergency rollback | < 1 hour |
| **Medium** (performance degradation) | Gradual rollback | < 4 hours |
| **Low** (UI glitches) | Gradual rollback | < 24 hours |

---

## Testing

### Backend Testing

Run the initialization script:
```bash
cd api/services
python init_geospatial_flags.py
```

### API Testing

**Get All Flags:**
```bash
curl http://localhost:8000/api/feature-flags
```

**Get Specific Flag:**
```bash
curl http://localhost:8000/api/feature-flags/ff.geo.layers_enabled
```

**Check If Enabled for User:**
```bash
curl "http://localhost:8000/api/feature-flags/ff.geo.layers_enabled/enabled?user_id=user-123"
```

### Frontend Testing

```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function TestComponent() {
  const layers = useFeatureFlag('ff.geo.layers_enabled');
  const gpu = useFeatureFlag('ff.geo.gpu_rendering_enabled');
  const points = useFeatureFlag('ff.geo.point_layer_active');
  
  return (
    <div>
      <p>Layers: {layers.isEnabled ? 'ON' : 'OFF'}</p>
      <p>GPU: {gpu.isEnabled ? 'ON' : 'OFF'}</p>
      <p>Points: {points.isEnabled ? 'ON' : 'OFF'}</p>
    </div>
  );
}
```

---

## Monitoring

### Key Metrics

**Service-Level:**
- Flag evaluation latency (P50, P95, P99)
- Cache hit rate
- Rollout distribution accuracy

**Feature-Level:**
- Layer render time (target: <10ms)
- WebSocket message rate
- GPU utilization (when enabled)
- Memory usage per layer

### Logging

Enable debug logging:
```python
import logging
logging.getLogger('feature_flag_service').setLevel(logging.DEBUG)
```

### Alerts

Configure alerts for:
1. Error rate > 1%
2. P95 render time > 200ms
3. Memory growth > 10%/hour
4. Rollout distribution deviation > 5%

---

## Database Schema

The flags are stored in the `feature_flags` table:

```sql
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT FALSE,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Dependencies (if using extension table):
```sql
CREATE TABLE feature_flag_dependencies (
    id SERIAL PRIMARY KEY,
    flag_name VARCHAR(255) REFERENCES feature_flags(flag_name),
    depends_on VARCHAR(255) REFERENCES feature_flags(flag_name),
    UNIQUE(flag_name, depends_on)
);
```

---

## Troubleshooting

### Flag Not Found

**Symptom:** API returns 404 for flag

**Solution:**
```bash
# Run initialization script
cd api/services
python init_geospatial_flags.py
```

### Dependency Not Satisfied

**Symptom:** Flag enabled but not working

**Solution:**
```bash
# Check dependencies
curl http://localhost:8000/api/feature-flags/ff.map_v1

# Enable dependency
curl -X PUT http://localhost:8000/api/feature-flags/ff.map_v1/enable
curl -X PUT http://localhost:8000/api/feature-flags/ff.map_v1/rollout \
  -H "Content-Type: application/json" \
  -d '{"percentage": 100}'
```

### Rollout Not Working

**Symptom:** All users see same behavior despite percentage rollout

**Solution:**
- Ensure `user_id` is being passed to flag checks
- Verify hash-based bucketing is working
- Check logs for rollout calculation

---

## Security Considerations

1. **Authorization:** Feature flags do NOT replace authorization checks
2. **User ID Hashing:** User IDs are hashed for consistent bucketing
3. **Audit Logging:** All flag changes are logged
4. **API Authentication:** Feature flag management endpoints should be protected

---

## Future Enhancements

1. **Redis Persistence:** Multi-instance flag state synchronization
2. **Admin UI:** Web interface for flag management
3. **A/B Testing Integration:** Tie flags to ML experimentation framework
4. **Scheduled Rollouts:** Automatic percentage increases
5. **Geographic Rollouts:** Different percentages per region

---

## Support

- Check logs: `api/logs/feature_flags.log`
- Run diagnostics: `python init_geospatial_flags.py`
- Review metrics: Feature flag service exposes performance metrics

---

## Changelog

| Date | Version | Changes |
|------|---------|----|
| 2025-11-05 | 1.0.0 | Initial implementation of three granular geospatial flags |