-- Migration: Standardize Feature Flag Names
-- Date: 2025-11-07
-- Updated: 2025-11-08
-- Breaking Change: Yes - renames existing feature flags to match standardized naming convention
--
-- This migration standardizes all feature flag names to use consistent dot notation
-- with namespace prefixes:
-- - ff.geo.* for geospatial features
-- - ff.ml.* for machine learning features
-- - ff.ws.* for WebSocket features
-- - ff.hierarchy.* for hierarchy/navigation features
-- - ff.data.* for data management features
--
-- BEFORE: ff_geospatial_layers, ff.map_v1, ff.hierarchy_optimized
-- AFTER:  ff.geo.layers_enabled, ff.geo.map, ff.hierarchy.optimized

-- Start transaction for atomic migration
BEGIN;

-- Backup existing flags table (safety measure)
CREATE TABLE IF NOT EXISTS feature_flags_backup_20251107 AS
SELECT * FROM feature_flags;

-- Update flag names to standardized pattern
-- Core geospatial layer flag
UPDATE feature_flags
SET flag_name = 'ff.geo.layers_enabled'
WHERE flag_name IN (
    'ff_geospatial_layers',
    'ff.geospatial_layers',
    'ff_geospatial_enabled'
);

-- GPU rendering flag
UPDATE feature_flags
SET flag_name = 'ff.geo.gpu_rendering_enabled'
WHERE flag_name IN (
    'ff_gpu_filtering',
    'ff.gpu_filtering'
);

-- Point layer flag
UPDATE feature_flags
SET flag_name = 'ff.geo.point_layer_active'
WHERE flag_name IN (
    'ff_point_layer',
    'ff.point_layer',
    'ff_point_layer_enabled'
);

-- Polygon layer flag
UPDATE feature_flags
SET flag_name = 'ff.geo.polygon_layer_active'
WHERE flag_name IN (
    'ff_polygon_layer',
    'ff.polygon_layer'
);

-- Heatmap layer flag
UPDATE feature_flags
SET flag_name = 'ff.geo.heatmap_layer_active'
WHERE flag_name IN (
    'ff_heatmap_layer',
    'ff.heatmap_layer'
);

-- Clustering flag
UPDATE feature_flags
SET flag_name = 'ff.geo.clustering_enabled'
WHERE flag_name IN (
    'ff_clustering_enabled',
    'ff.clustering_enabled'
);

-- WebSocket layers flag
UPDATE feature_flags
SET flag_name = 'ff.geo.websocket_layers_enabled'
WHERE flag_name IN (
    'ff_websocket_layers',
    'ff.websocket_layers',
    'ff_websocket_layers_enabled'
);

-- Real-time updates flag
UPDATE feature_flags
SET flag_name = 'ff.geo.realtime_updates_enabled'
WHERE flag_name IN (
    'ff_realtime_updates',
    'ff.realtime_updates'
);

-- Performance monitoring flag
UPDATE feature_flags
SET flag_name = 'ff.geo.performance_monitoring_enabled'
WHERE flag_name IN (
    'ff_layer_performance_monitoring',
    'ff.layer_performance_monitoring'
);

-- Audit logging flag
UPDATE feature_flags
SET flag_name = 'ff.geo.audit_logging_enabled'
WHERE flag_name IN (
    'ff_layer_audit_logging',
    'ff.layer_audit_logging'
);

-- Linestring layer flag
UPDATE feature_flags
SET flag_name = 'ff.geo.linestring_layer_active'
WHERE flag_name IN (
    'ff_linestring_layer',
    'ff.linestring_layer'
);

-- === Core System Flags Standardization ===

-- Map/Geospatial core flag
UPDATE feature_flags
SET flag_name = 'ff.geo.map'
WHERE flag_name = 'ff.map_v1';

-- Hierarchy navigation flag
UPDATE feature_flags
SET flag_name = 'ff.hierarchy.optimized'
WHERE flag_name = 'ff.hierarchy_optimized';

-- WebSocket realtime flag
UPDATE feature_flags
SET flag_name = 'ff.ws.realtime'
WHERE flag_name = 'ff.ws_v1';

-- === Machine Learning Flags ===

-- Prophet forecasting flag
UPDATE feature_flags
SET flag_name = 'ff.ml.prophet_forecasting'
WHERE flag_name = 'ff.prophet_forecasting';

-- A/B testing routing flag
UPDATE feature_flags
SET flag_name = 'ff.ml.ab_routing'
WHERE flag_name = 'ff.ab_routing';

-- === Data Management Flags ===

-- Cursor pagination flag
UPDATE feature_flags
SET flag_name = 'ff.data.cursor_pagination'
WHERE flag_name = 'ff.cursor_pagination';

-- Scenario construction flag
UPDATE feature_flags
SET flag_name = 'ff.scenario.construction'
WHERE flag_name = 'ff.scenario_construction';

-- Verify migration success
DO $$
DECLARE
    old_pattern_count INTEGER;
BEGIN
    -- Check for any remaining old-style flag names (underscore notation)
    SELECT COUNT(*) INTO old_pattern_count
    FROM feature_flags
    WHERE flag_name LIKE 'ff_%'
      AND flag_name NOT LIKE 'ff.%';

    IF old_pattern_count > 0 THEN
        RAISE EXCEPTION 'Migration incomplete: % flags still using underscore naming pattern', old_pattern_count;
    END IF;

    RAISE NOTICE 'Migration successful: All feature flags standardized to namespaced dot notation';
    RAISE NOTICE 'Namespaces: ff.geo.*, ff.ml.*, ff.ws.*, ff.hierarchy.*, ff.data.*, ff.scenario.*';
END $$;

COMMIT;

-- Log migration completion
INSERT INTO migration_log (migration_name, applied_at, description)
VALUES (
    '001_standardize_feature_flag_names',
    NOW(),
    'Standardized all feature flag names to ff.geo.* pattern per GEOSPATIAL_FEATURE_FLAGS.md'
);
