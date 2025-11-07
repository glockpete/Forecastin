-- Migration: Standardize Feature Flag Names
-- Date: 2025-11-07
-- Breaking Change: Yes - renames existing feature flags to match documentation
--
-- This migration standardizes all feature flag names to the documented pattern
-- from GEOSPATIAL_FEATURE_FLAGS.md (ff.geo.* namespace)
--
-- BEFORE: ff_geospatial_layers, ff.geospatial_layers, ff_geospatial_enabled
-- AFTER:  ff.geo.layers_enabled (consistent everywhere)

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

-- Verify migration success
DO $$
DECLARE
    old_pattern_count INTEGER;
BEGIN
    -- Check for any remaining old-style flag names
    SELECT COUNT(*) INTO old_pattern_count
    FROM feature_flags
    WHERE flag_name LIKE 'ff_%'
      AND flag_name NOT LIKE 'ff.%'
      AND flag_name != 'ff.map_v1';  -- Keep existing parent flag

    IF old_pattern_count > 0 THEN
        RAISE EXCEPTION 'Migration incomplete: % flags still using old naming pattern', old_pattern_count;
    END IF;

    RAISE NOTICE 'Migration successful: All feature flags standardized to ff.geo.* pattern';
END $$;

COMMIT;

-- Log migration completion
INSERT INTO migration_log (migration_name, applied_at, description)
VALUES (
    '001_standardize_feature_flag_names',
    NOW(),
    'Standardized all feature flag names to ff.geo.* pattern per GEOSPATIAL_FEATURE_FLAGS.md'
);
