# Feature Flag Naming Standardization

**Version:** 1.4
**Date:** 2025-11-08
**Status:** Implemented

## Overview

This document defines the standardized naming convention for all feature flags in the Forecastin platform. The standardization ensures consistency, maintainability, and clarity across the codebase.

## Naming Convention

All feature flags MUST follow the pattern: `ff.<namespace>.<feature_name>`

### Pattern Structure

```
ff.<namespace>.<feature_name>
│   │           │
│   │           └─ Descriptive feature name (snake_case)
│   └─ Namespace category
└─ Feature flag prefix
```

### Examples

✅ **Correct:**
- `ff.geo.layers_enabled`
- `ff.ml.prophet_forecasting`
- `ff.ws.realtime`
- `ff.hierarchy.optimized`

❌ **Incorrect:**
- `ff_geospatial_layers` (underscore notation)
- `ff.map_v1` (version in name - use `ff.geo.map` instead)
- `geospatial_enabled` (missing ff prefix)
- `ff.geospatialLayersEnabled` (camelCase instead of snake_case)

## Namespace Definitions

### `ff.geo.*` - Geospatial Features

For features related to mapping, geospatial data, and location-based functionality.

**Examples:**
- `ff.geo.map` - PostGIS geospatial mapping (formerly ff.map_v1)
- `ff.geo.layers_enabled` - Master switch for geospatial layer system
- `ff.geo.point_layer_active` - Point layer implementation
- `ff.geo.polygon_layer_active` - Polygon layer implementation
- `ff.geo.linestring_layer_active` - Linestring layer implementation
- `ff.geo.heatmap_layer_active` - Heatmap layer implementation
- `ff.geo.clustering_enabled` - Point clustering feature
- `ff.geo.gpu_rendering_enabled` - GPU-based spatial rendering
- `ff.geo.websocket_layers_enabled` - WebSocket layer integration
- `ff.geo.realtime_updates_enabled` - Real-time layer updates
- `ff.geo.performance_monitoring_enabled` - Layer performance tracking
- `ff.geo.audit_logging_enabled` - Layer audit trail

### `ff.ml.*` - Machine Learning Features

For features related to machine learning, forecasting, and predictive analytics.

**Examples:**
- `ff.ml.prophet_forecasting` - Prophet-based hierarchical forecasting (formerly ff.prophet_forecasting)
- `ff.ml.ab_routing` - A/B testing routing (formerly ff.ab_routing)
- `ff.ml.model_training` - ML model training capabilities
- `ff.ml.anomaly_detection` - Anomaly detection algorithms

### `ff.ws.*` - WebSocket Features

For features related to real-time communication and WebSocket functionality.

**Examples:**
- `ff.ws.realtime` - WebSocket v1 real-time features (formerly ff.ws_v1)
- `ff.ws.collaboration` - Real-time collaboration features
- `ff.ws.notifications` - WebSocket-based notifications

### `ff.hierarchy.*` - Hierarchy/Navigation Features

For features related to entity hierarchy, navigation, and organizational structure.

**Examples:**
- `ff.hierarchy.optimized` - LTREE optimized hierarchy (formerly ff.hierarchy_optimized)
- `ff.hierarchy.breadcrumbs` - Breadcrumb navigation
- `ff.hierarchy.drill_down` - Drill-down capabilities

### `ff.data.*` - Data Management Features

For features related to data handling, pagination, and data operations.

**Examples:**
- `ff.data.cursor_pagination` - Cursor-based pagination (formerly ff.cursor_pagination)
- `ff.data.bulk_import` - Bulk data import
- `ff.data.export` - Data export capabilities

### `ff.scenario.*` - Scenario Features

For features related to scenario construction, analysis, and management.

**Examples:**
- `ff.scenario.construction` - Scenario creation and management (formerly ff.scenario_construction)
- `ff.scenario.analysis` - Scenario analysis engine
- `ff.scenario.collaboration` - Scenario collaboration features

## Migration Mapping

### Database Flag Mappings

| Old Name | New Name | Status |
|----------|----------|--------|
| `ff.map_v1` | `ff.geo.map` | ✅ Migrated |
| `ff.hierarchy_optimized` | `ff.hierarchy.optimized` | ✅ Migrated |
| `ff.ws_v1` | `ff.ws.realtime` | ✅ Migrated |
| `ff.ab_routing` | `ff.ml.ab_routing` | ✅ Migrated |
| `ff.prophet_forecasting` | `ff.ml.prophet_forecasting` | ✅ Migrated |
| `ff.scenario_construction` | `ff.scenario.construction` | ✅ Migrated |
| `ff.cursor_pagination` | `ff.data.cursor_pagination` | ✅ Migrated |
| `ff_geospatial_layers` | `ff.geo.layers_enabled` | ✅ Migrated |
| `ff_point_layer` | `ff.geo.point_layer_active` | ✅ Migrated |
| `ff_polygon_layer` | `ff.geo.polygon_layer_active` | ✅ Migrated |
| `ff_linestring_layer` | `ff.geo.linestring_layer_active` | ✅ Migrated |
| `ff_heatmap_layer` | `ff.geo.heatmap_layer_active` | ✅ Migrated |
| `ff_clustering_enabled` | `ff.geo.clustering_enabled` | ✅ Migrated |
| `ff_gpu_filtering` | `ff.geo.gpu_rendering_enabled` | ✅ Migrated |
| `ff_websocket_layers` | `ff.geo.websocket_layers_enabled` | ✅ Migrated |
| `ff_realtime_updates` | `ff.geo.realtime_updates_enabled` | ✅ Migrated |
| `ff_layer_performance_monitoring` | `ff.geo.performance_monitoring_enabled` | ✅ Migrated |
| `ff_layer_audit_logging` | `ff.geo.audit_logging_enabled` | ✅ Migrated |

### Frontend Flag Mappings

| Old Interface Property | New Interface Property |
|------------------------|------------------------|
| `ff_geospatial_enabled` | `'ff.geo.layers_enabled'` |
| `ff_point_layer_enabled` | `'ff.geo.point_layer_active'` |
| `ff_clustering_enabled` | `'ff.geo.clustering_enabled'` |
| `ff_websocket_layers_enabled` | `'ff.geo.websocket_layers_enabled'` |
| `ff_layer_performance_monitoring` | `'ff.geo.performance_monitoring_enabled'` |
| `ff_layer_audit_logging` | `'ff.geo.audit_logging_enabled'` |

## Implementation Guidelines

### Backend (Python)

```python
# Check feature flag
is_enabled = await feature_flag_service.is_flag_enabled("ff.ml.prophet_forecasting")

# Get flag with rollout
is_enabled_for_user = await feature_flag_service.get_flag_with_rollout(
    "ff.geo.layers_enabled",
    user_id="user-123"
)

# Get all flags
all_flags = await feature_flag_service.get_all_flags()
```

### Frontend (TypeScript/React)

```typescript
// TypeScript interface
export interface FeatureFlagConfig {
  'ff.geo.layers_enabled': boolean;
  'ff.geo.point_layer_active': boolean;
  // ... other flags
}

// React hook usage
const { isEnabled } = useFeatureFlag('ff.geo.layers_enabled', {
  userId: currentUser.id,
  checkRollout: true,
  fallbackEnabled: false
});

// Check flag
if (layerFeatureFlags.isEnabled('ff.geo.layers_enabled')) {
  // Enable geospatial features
}
```

### Environment Variables

Environment variables should follow the pattern: `REACT_APP_FF_<NAMESPACE>_<FEATURE>`

**Examples:**
- `REACT_APP_FF_GEO_LAYERS=true`
- `REACT_APP_FF_ML_PROPHET=true`
- `REACT_APP_FF_WS_REALTIME=true`

## Migration Process

### 1. Database Migration

Execute the migration script:

```bash
psql -U forecastin_user -d forecastin -f migrations/001_standardize_feature_flag_names.sql
```

This will:
- Create a backup table (`feature_flags_backup_20251107`)
- Rename all flags to standardized pattern
- Validate the migration
- Log the migration

### 2. Code Updates

The following files have been updated:

**Backend:**
- `api/main.py` - API endpoint feature flag checks
- `api/services/init_phase6_flags.py` - Phase 6 flag definitions
- `migrations/001_initial_schema.sql` - Initial flag definitions

**Frontend:**
- `frontend/src/config/feature-flags.ts` - Flag configuration interface
- `frontend/src/config/feature-flags-local-override.ts` - Local testing overrides

### 3. Verification

After migration, verify all flags are standardized:

```sql
-- Check for any remaining underscore notation
SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff_%' AND flag_name NOT LIKE 'ff.%';

-- Should return 0 rows
```

### 4. Rollback (If Needed)

If issues occur, execute the rollback script:

```bash
psql -U forecastin_user -d forecastin -f migrations/001_standardize_feature_flag_names_ROLLBACK.sql
```

## Benefits of Standardization

1. **Consistency**: Single naming pattern across all flags
2. **Clarity**: Namespace immediately identifies feature category
3. **Maintainability**: Easier to locate and manage related flags
4. **Scalability**: Clear pattern for adding new flags
5. **Documentation**: Self-documenting flag names
6. **Contract Alignment**: Frontend and backend use same flag names

## Adding New Feature Flags

When adding a new feature flag:

1. **Choose the appropriate namespace** based on the feature category
2. **Use descriptive snake_case naming** for the feature name
3. **Update this documentation** with the new flag
4. **Add to both backend and frontend** configurations
5. **Include in migration scripts** if applicable

**Example:**

```python
# Bad
new_flag = "ff_my_new_feature"

# Good
new_flag = "ff.ml.sentiment_analysis"
```

## Flag Lifecycle

```
Creation → Testing → Gradual Rollout → Full Deployment → Deprecation → Removal
   │          │            │                  │               │          │
   └─────────┴────────────┴──────────────────┴───────────────┴──────────┘
                    Standardized naming used throughout
```

## Related Documentation

- [GEOSPATIAL_FEATURE_FLAGS.md](./GEOSPATIAL_FEATURE_FLAGS.md) - Geospatial flag details
- [MIGRATION_GUIDE_FF_NAMES.md](./MIGRATION_GUIDE_FF_NAMES.md) - Detailed migration guide
- [FEATURE_FLAG_MIGRATION_README.md](./FEATURE_FLAG_MIGRATION_README.md) - Quick start guide

## Questions & Support

For questions about feature flag naming:
1. Review this documentation
2. Check existing flags for similar features
3. Consult the namespace definitions
4. When in doubt, use the most specific namespace available

---

**Last Updated:** 2025-11-08
**Maintained By:** Engineering Team
**Version:** 1.4
