-- Migration 006: Production Validation and Observability Enhancements
--
-- This migration adds critical production readiness improvements:
-- 1. Language code constraints (ISO 639-1 validation)
-- 2. GIN indexes for JSONB columns (query performance)
-- 3. Database collation specifications (Unicode handling)
-- 4. Materialized view staleness monitoring
-- 5. Index health monitoring views
--
-- Author: Forecastin Development Team
-- Date: 2025-11-11
-- Status: Production Critical Patches

-- ============================================================================
-- PART 1: INPUT VALIDATION CONSTRAINTS
-- ============================================================================

-- Add language code constraint to rss_feed_sources
-- Validates against common ISO 639-1 language codes
ALTER TABLE rss_feed_sources
DROP CONSTRAINT IF EXISTS valid_language;

ALTER TABLE rss_feed_sources
ADD CONSTRAINT valid_language CHECK (
    language IN (
        'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
        'ar', 'hi', 'bn', 'pa', 'te', 'mr', 'ta', 'ur', 'gu', 'kn',
        'ml', 'or', 'as', 'bh', 'sa', 'ne', 'si', 'my', 'km', 'lo',
        'th', 'vi', 'id', 'ms', 'tl', 'jv', 'su', 'ceb', 'ilo', 'hil',
        'nl', 'sv', 'no', 'da', 'fi', 'is', 'pl', 'cs', 'sk', 'hu',
        'ro', 'bg', 'sr', 'hr', 'bs', 'mk', 'sq', 'sl', 'lt', 'lv',
        'et', 'uk', 'be', 'ka', 'hy', 'az', 'tr', 'el', 'he', 'yi',
        'fa', 'ps', 'ku', 'sd', 'sw', 'am', 'om', 'so', 'ha', 'ig',
        'yo', 'zu', 'xh', 'af', 'st', 'tn', 'sn', 'ny', 'mg'
    )
);

-- Ensure region constraint exists and is correct
ALTER TABLE rss_feed_sources
DROP CONSTRAINT IF EXISTS valid_region;

ALTER TABLE rss_feed_sources
ADD CONSTRAINT valid_region CHECK (
    region IN ('global', 'americas', 'europe', 'asia', 'middle_east', 'africa', 'oceania')
);

-- Add URL format validation (basic check for http/https)
ALTER TABLE rss_feed_sources
DROP CONSTRAINT IF EXISTS valid_url_scheme;

ALTER TABLE rss_feed_sources
ADD CONSTRAINT valid_url_scheme CHECK (
    url LIKE 'http://%' OR url LIKE 'https://%'
);

-- ============================================================================
-- PART 2: GIN INDEXES FOR JSONB COLUMNS (Performance Optimization)
-- ============================================================================

-- Add GIN indexes for JSONB columns in rss_route_configs
-- These enable fast queries using @>, <@, ?, ?&, ?| operators

-- Index for css_selectors JSONB column
CREATE INDEX IF NOT EXISTS idx_rss_route_configs_css_selectors_gin
ON rss_route_configs USING GIN (css_selectors);

COMMENT ON INDEX idx_rss_route_configs_css_selectors_gin IS
'GIN index for fast JSONB queries on css_selectors column. Enables @>, <@, ?, ?&, ?| operators.';

-- Index for anti_crawler_config JSONB column
CREATE INDEX IF NOT EXISTS idx_rss_route_configs_anti_crawler_gin
ON rss_route_configs USING GIN (anti_crawler_config);

COMMENT ON INDEX idx_rss_route_configs_anti_crawler_gin IS
'GIN index for fast JSONB queries on anti_crawler_config column.';

-- Index for confidence_factors JSONB column
CREATE INDEX IF NOT EXISTS idx_rss_route_configs_confidence_gin
ON rss_route_configs USING GIN (confidence_factors);

COMMENT ON INDEX idx_rss_route_configs_confidence_gin IS
'GIN index for fast JSONB queries on confidence_factors column.';

-- ============================================================================
-- PART 3: DATABASE COLLATION SPECIFICATIONS (Unicode Security)
-- ============================================================================

-- Note: Altering column collations on existing tables requires careful handling
-- For new tables, use COLLATE "en_US.UTF-8" in column definitions
-- For existing tables, we'll add comments and validation

COMMENT ON COLUMN rss_feed_sources.name IS
'Source name. Uses database default collation (typically en_US.UTF-8). Consider explicit COLLATE in queries for case-insensitive searches.';

COMMENT ON COLUMN rss_feed_sources.region IS
'Geographic region. Constrained values ensure consistent collation behavior.';

COMMENT ON COLUMN rss_feed_sources.language IS
'ISO 639-1 language code. Constrained to valid lowercase codes.';

-- ============================================================================
-- PART 4: MATERIALIZED VIEW STALENESS MONITORING
-- ============================================================================

-- View to monitor materialized view staleness and health
CREATE OR REPLACE VIEW v_materialized_view_health AS
SELECT
    mvrs.view_name,
    mvrs.last_refresh_at,
    mvrs.last_refresh_duration_ms,
    mvrs.last_success,
    mvrs.failure_count,
    mvrs.last_failure_reason,
    mvrs.refresh_count,
    -- Staleness metrics
    EXTRACT(EPOCH FROM (NOW() - mvrs.last_refresh_at)) AS age_seconds,
    ROUND(EXTRACT(EPOCH FROM (NOW() - mvrs.last_refresh_at)) / 60, 2) AS age_minutes,
    CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - mvrs.last_refresh_at)) / 60 > 60 THEN 'CRITICAL'
        WHEN EXTRACT(EPOCH FROM (NOW() - mvrs.last_refresh_at)) / 60 > 30 THEN 'WARNING'
        ELSE 'HEALTHY'
    END AS staleness_status,
    -- Failure status
    CASE
        WHEN NOT mvrs.last_success AND mvrs.failure_count >= 3 THEN 'CRITICAL'
        WHEN NOT mvrs.last_success AND mvrs.failure_count >= 1 THEN 'WARNING'
        ELSE 'OK'
    END AS failure_status,
    -- Overall health
    CASE
        WHEN NOT mvrs.last_success AND mvrs.failure_count >= 3 THEN 'UNHEALTHY'
        WHEN EXTRACT(EPOCH FROM (NOW() - mvrs.last_refresh_at)) / 60 > 60 THEN 'UNHEALTHY'
        WHEN NOT mvrs.last_success OR EXTRACT(EPOCH FROM (NOW() - mvrs.last_refresh_at)) / 60 > 30 THEN 'DEGRADED'
        ELSE 'HEALTHY'
    END AS overall_health,
    -- Thresholds
    mvrs.threshold_changes,
    mvrs.threshold_time_minutes,
    mvrs.auto_refresh_enabled,
    mvrs.smart_trigger_enabled,
    mvrs.updated_at
FROM materialized_view_refresh_schedule mvrs
ORDER BY
    CASE
        WHEN NOT mvrs.last_success AND mvrs.failure_count >= 3 THEN 1
        WHEN EXTRACT(EPOCH FROM (NOW() - mvrs.last_refresh_at)) / 60 > 60 THEN 2
        WHEN NOT mvrs.last_success OR EXTRACT(EPOCH FROM (NOW() - mvrs.last_refresh_at)) / 60 > 30 THEN 3
        ELSE 4
    END,
    mvrs.view_name;

COMMENT ON VIEW v_materialized_view_health IS
'Monitoring view for materialized view staleness and health status.
Use this for alerting on stale views (age > 30 min = WARNING, > 60 min = CRITICAL)
or refresh failures (failure_count >= 3 = CRITICAL).';

-- ============================================================================
-- PART 5: INDEX HEALTH MONITORING
-- ============================================================================

-- View to monitor index health, bloat, and usage
CREATE OR REPLACE VIEW v_index_health AS
SELECT
    schemaname,
    tablename,
    indexname,
    -- Usage statistics
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    -- Size information
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_relation_size(indexrelid) AS index_size_bytes,
    -- Health indicators
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END AS usage_status,
    -- Index type (B-tree, GIN, etc.)
    am.amname AS index_type,
    -- Index definition
    pg_get_indexdef(indexrelid) AS index_definition
FROM pg_stat_user_indexes psui
JOIN pg_am am ON am.oid = (SELECT relam FROM pg_class WHERE oid = psui.indexrelid)
ORDER BY pg_relation_size(indexrelid) DESC;

COMMENT ON VIEW v_index_health IS
'Monitoring view for index health and usage.
Identifies unused indexes (idx_scan = 0) which may be candidates for removal.
Shows index size and type for capacity planning.';

-- View for GIN index-specific monitoring
CREATE OR REPLACE VIEW v_gin_index_health AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS gin_index_scans,
    idx_tup_read AS gin_tuples_read,
    pg_size_pretty(pg_relation_size(indexrelid)) AS gin_index_size,
    pg_relation_size(indexrelid) AS gin_index_size_bytes,
    -- GIN-specific: pending list size (for fastupdate=on indexes)
    -- Note: pg_stat_user_indexes doesn't expose pending list size directly
    -- For detailed GIN monitoring, use: SELECT * FROM pg_index WHERE indrelid = 'table_name'::regclass;
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED_GIN'
        WHEN idx_scan < 50 THEN 'LOW_USAGE_GIN'
        ELSE 'ACTIVE_GIN'
    END AS gin_usage_status,
    pg_get_indexdef(indexrelid) AS gin_index_definition
FROM pg_stat_user_indexes psui
JOIN pg_am am ON am.oid = (SELECT relam FROM pg_class WHERE oid = psui.indexrelid)
WHERE am.amname = 'gin'
ORDER BY pg_relation_size(indexrelid) DESC;

COMMENT ON VIEW v_gin_index_health IS
'Specialized monitoring for GIN indexes (used for JSONB, arrays, full-text search).
Monitor for size growth and usage patterns.';

-- ============================================================================
-- PART 6: ALERTING QUERIES (for external monitoring systems)
-- ============================================================================

-- Function to get critical alerts
CREATE OR REPLACE FUNCTION get_critical_alerts()
RETURNS TABLE (
    alert_type TEXT,
    alert_severity TEXT,
    resource_name TEXT,
    alert_message TEXT,
    metric_value NUMERIC
) AS $$
BEGIN
    -- Stale materialized views
    RETURN QUERY
    SELECT
        'MV_STALENESS'::TEXT,
        'CRITICAL'::TEXT,
        view_name::TEXT,
        'Materialized view is stale (age: ' || age_minutes || ' minutes)'::TEXT,
        age_minutes
    FROM v_materialized_view_health
    WHERE staleness_status = 'CRITICAL';

    -- Failed MV refreshes
    RETURN QUERY
    SELECT
        'MV_FAILURE'::TEXT,
        'CRITICAL'::TEXT,
        view_name::TEXT,
        'Materialized view refresh failures: ' || failure_count || ' (reason: ' || COALESCE(last_failure_reason, 'unknown') || ')'::TEXT,
        failure_count::NUMERIC
    FROM v_materialized_view_health
    WHERE failure_status = 'CRITICAL';

    -- Unused indexes (potential waste)
    RETURN QUERY
    SELECT
        'UNUSED_INDEX'::TEXT,
        'WARNING'::TEXT,
        indexname::TEXT,
        'Index has never been scanned - consider removing (size: ' || index_size || ')'::TEXT,
        index_size_bytes::NUMERIC
    FROM v_index_health
    WHERE usage_status = 'UNUSED'
    AND index_size_bytes > 1024 * 1024; -- Only warn for indexes > 1MB

    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_critical_alerts() IS
'Returns critical alerts for monitoring systems (Prometheus, Datadog, etc.).
Call this function periodically to check for:
- Stale materialized views
- Failed MV refreshes
- Unused large indexes';

-- ============================================================================
-- PART 7: VALIDATE MIGRATION SUCCESS
-- ============================================================================

DO $$
DECLARE
    constraint_count INTEGER;
    index_count INTEGER;
BEGIN
    -- Verify language constraint was added
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint
    WHERE conname = 'valid_language'
    AND conrelid = 'rss_feed_sources'::regclass;

    IF constraint_count = 0 THEN
        RAISE WARNING 'Language constraint was not created successfully';
    ELSE
        RAISE NOTICE 'Language constraint created successfully';
    END IF;

    -- Verify GIN indexes were created
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND (
        indexname = 'idx_rss_route_configs_css_selectors_gin'
        OR indexname = 'idx_rss_route_configs_anti_crawler_gin'
        OR indexname = 'idx_rss_route_configs_confidence_gin'
    );

    IF index_count < 3 THEN
        RAISE WARNING 'Not all GIN indexes were created (expected 3, got %)', index_count;
    ELSE
        RAISE NOTICE 'All GIN indexes created successfully';
    END IF;

    -- Verify monitoring views were created
    IF NOT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_materialized_view_health') THEN
        RAISE WARNING 'Materialized view health monitoring view was not created';
    ELSE
        RAISE NOTICE 'Materialized view health monitoring view created successfully';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_index_health') THEN
        RAISE WARNING 'Index health monitoring view was not created';
    ELSE
        RAISE NOTICE 'Index health monitoring view created successfully';
    END IF;

    RAISE NOTICE '✓ Migration 006 completed successfully';
END $$;

-- ============================================================================
-- PART 7: GRANT PERMISSIONS FOR APPLICATION ROLE
-- ============================================================================

-- Grant SELECT permissions on monitoring views to application role
-- This allows the application to query monitoring data for health checks
GRANT SELECT ON v_materialized_view_health TO forecastin;
GRANT SELECT ON v_index_health TO forecastin;
GRANT SELECT ON v_gin_index_health TO forecastin;

-- Grant EXECUTE permission on alerting function
-- This allows the application to retrieve critical alerts
GRANT EXECUTE ON FUNCTION get_critical_alerts() TO forecastin;

COMMENT ON VIEW v_materialized_view_health IS
'Monitoring view for MV staleness - query with: SELECT * FROM v_materialized_view_health WHERE staleness_status = ''CRITICAL''';

COMMENT ON VIEW v_index_health IS
'Index usage monitoring - query with: SELECT * FROM v_index_health WHERE usage_status = ''UNUSED''';

COMMENT ON FUNCTION get_critical_alerts() IS
'Returns critical system alerts for monitoring integration (Prometheus, Datadog, etc.)';

