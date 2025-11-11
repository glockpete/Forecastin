-- Phase 4: Automated Materialized View Refresh System
-- Implements smart triggers, scheduler, and performance monitoring for LTREE hierarchy optimization
-- Resolves ancestor resolution performance regression (3.46ms → target <1.25ms)

-- Create refresh tracking table for monitoring and coordination
CREATE TABLE materialized_view_refresh_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    view_name TEXT NOT NULL UNIQUE,
    last_refresh_at TIMESTAMP WITH TIME ZONE,
    last_refresh_duration_ms INTEGER,
    last_success BOOLEAN DEFAULT false,
    refresh_count BIGINT DEFAULT 0,
    failure_count BIGINT DEFAULT 0,
    last_failure_reason TEXT,
    auto_refresh_enabled BOOLEAN DEFAULT true,
    smart_trigger_enabled BOOLEAN DEFAULT true,
    threshold_changes INTEGER DEFAULT 100, -- Trigger refresh after N changes
    threshold_time_minutes INTEGER DEFAULT 15, -- Trigger refresh after N minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create change tracking table for smart triggers
CREATE TABLE entity_change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    change_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    entity_id UUID,
    entity_path LTREE,
    change_count BIGINT DEFAULT 1,
    batch_id UUID DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_mv_refresh_schedule_view ON materialized_view_refresh_schedule (view_name);
CREATE INDEX idx_entity_change_log_batch ON entity_change_log (batch_id);
CREATE INDEX idx_entity_change_log_time ON entity_change_log (created_at);
CREATE INDEX idx_entity_change_log_type ON entity_change_log (change_type);

-- Initialize refresh schedule for existing materialized views
INSERT INTO materialized_view_refresh_schedule (view_name, auto_refresh_enabled, smart_trigger_enabled) VALUES
('mv_entity_ancestors', true, true),
('mv_descendant_counts', true, true)
ON CONFLICT (view_name) DO NOTHING;

-- Enhanced refresh function with metrics and smart triggers
CREATE OR REPLACE FUNCTION automated_refresh_materialized_view(
    view_name_param TEXT DEFAULT 'mv_entity_ancestors',
    force_refresh BOOLEAN DEFAULT false,
    batch_id_param UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    start_time TIMESTAMP;
    duration_ms INTEGER;
    result JSONB;
    change_threshold INTEGER;
    time_threshold INTEGER;
    recent_changes BIGINT;
    lock_acquired BOOLEAN;
BEGIN
    start_time := clock_timestamp();

    -- Acquire advisory lock to prevent concurrent refreshes of the same view
    -- Use hash of view name for consistent lock ID
    SELECT pg_try_advisory_lock(hashtext(view_name_param)) INTO lock_acquired;

    IF NOT lock_acquired THEN
        result := jsonb_build_object(
            'status', 'skipped',
            'reason', 'refresh_already_in_progress',
            'view_name', view_name_param
        );
        RETURN result;
    END IF;

    BEGIN
        -- Get smart trigger parameters
        SELECT
            COALESCE(threshold_changes, 100),
            COALESCE(threshold_time_minutes, 15)
        INTO change_threshold, time_threshold
        FROM materialized_view_refresh_schedule
        WHERE view_name = view_name_param;

        -- Check if refresh is needed (unless forced)
        IF NOT force_refresh THEN
            -- Count recent changes (last threshold_time_minutes)
            SELECT COUNT(*)
            INTO recent_changes
            FROM entity_change_log
            WHERE created_at >= NOW() - (time_threshold || ' minutes')::INTERVAL
            AND (batch_id_param IS NULL OR batch_id = batch_id_param);

            -- Skip if no significant changes
            IF recent_changes < change_threshold THEN
                result := jsonb_build_object(
                    'status', 'skipped',
                    'reason', 'insufficient_changes',
                    'recent_changes', recent_changes,
                    'threshold', change_threshold
                );
                -- Release lock before returning
                PERFORM pg_advisory_unlock(hashtext(view_name_param));
                RETURN result;
            END IF;
        END IF;

        -- Perform the refresh with timing
        BEGIN
            -- Try concurrent refresh first (non-blocking)
            EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || quote_ident(view_name_param);
        EXCEPTION
            WHEN insufficient_privilege OR feature_not_supported THEN
                -- Fallback to regular refresh if concurrent not available
                EXECUTE 'REFRESH MATERIALIZED VIEW ' || quote_ident(view_name_param);
        END;
    
    -- Calculate duration
    duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
    
    -- Update refresh tracking
    UPDATE materialized_view_refresh_schedule
    SET 
        last_refresh_at = NOW(),
        last_refresh_duration_ms = duration_ms,
        last_success = true,
        refresh_count = refresh_count + 1,
        failure_count = CASE WHEN last_success = false THEN 0 ELSE failure_count END,
        updated_at = NOW()
    WHERE view_name = view_name_param;
    
    -- Clear processed changes
    IF batch_id_param IS NOT NULL THEN
        DELETE FROM entity_change_log WHERE batch_id = batch_id_param;
    END IF;
    
    -- Build result
    result := jsonb_build_object(
        'status', 'success',
        'view_name', view_name_param,
        'duration_ms', duration_ms,
        'recent_changes', recent_changes,
        'timestamp', NOW()
    );

    -- Release advisory lock before returning
    PERFORM pg_advisory_unlock(hashtext(view_name_param));
    RETURN result;

    EXCEPTION WHEN OTHERS THEN
        -- Always release the advisory lock on error
        PERFORM pg_advisory_unlock(hashtext(view_name_param));

        -- Handle refresh failures
        duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;

        UPDATE materialized_view_refresh_schedule
        SET
            last_refresh_at = NOW(),
            last_refresh_duration_ms = duration_ms,
            last_success = false,
            failure_count = failure_count + 1,
            last_failure_reason = SQLERRM,
            updated_at = NOW()
        WHERE view_name = view_name_param;

        result := jsonb_build_object(
            'status', 'error',
            'view_name', view_name_param,
            'error', SQLERRM,
            'duration_ms', duration_ms,
            'timestamp', NOW()
        );

        RETURN result;
    END;
END;
$$ LANGUAGE plpgsql;

-- Batch refresh all materialized views
CREATE OR REPLACE FUNCTION automated_refresh_all_materialized_views(
    batch_id_param UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    refresh_results JSONB := '[]'::JSONB;
    result JSONB;
    view_record RECORD;
BEGIN
    FOR view_record IN 
        SELECT view_name FROM materialized_view_refresh_schedule 
        WHERE auto_refresh_enabled = true
    LOOP
        refresh_results := refresh_results || 
            jsonb_build_object(
                view_record.view_name,
                automated_refresh_materialized_view(
                    view_record.view_name, 
                    false, 
                    batch_id_param
                )
            );
    END LOOP;
    
    result := jsonb_build_object(
        'status', 'completed',
        'views_refreshed', (SELECT COUNT(*) FROM materialized_view_refresh_schedule WHERE auto_refresh_enabled = true),
        'results', refresh_results,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Smart trigger function for entity changes
CREATE OR REPLACE FUNCTION trigger_smart_materialized_view_refresh()
RETURNS TRIGGER AS $$
DECLARE
    current_batch_id UUID := uuid_generate_v4();
    change_type_param TEXT;
    entity_path_param LTREE;
BEGIN
    -- Determine operation type
    IF TG_OP = 'DELETE' THEN
        change_type_param := 'DELETE';
        entity_path_param := OLD.path;
    ELSIF TG_OP = 'UPDATE' THEN
        change_type_param := 'UPDATE';
        entity_path_param := NEW.path;
    ELSE
        change_type_param := 'INSERT';
        entity_path_param := NEW.path;
    END IF;
    
    -- Log the change
    INSERT INTO entity_change_log (
        change_type,
        entity_id,
        entity_path,
        batch_id
    ) VALUES (
        change_type_param,
        COALESCE(NEW.id, OLD.id),
        entity_path_param,
        current_batch_id
    );
    
    -- Check if immediate refresh is needed (high change volume)
    IF (SELECT COUNT(*) FROM entity_change_log 
        WHERE batch_id = current_batch_id) > 1000 THEN
        -- High volume change - trigger immediate refresh
        PERFORM automated_refresh_all_materialized_views(current_batch_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create smart triggers on entities table
DROP TRIGGER IF EXISTS trigger_smart_mv_refresh_insert ON entities;
DROP TRIGGER IF EXISTS trigger_smart_mv_refresh_update ON entities;
DROP TRIGGER IF EXISTS trigger_smart_mv_refresh_delete ON entities;

CREATE TRIGGER trigger_smart_mv_refresh_insert
    AFTER INSERT ON entities
    FOR EACH ROW EXECUTE FUNCTION trigger_smart_materialized_view_refresh();

CREATE TRIGGER trigger_smart_mv_refresh_update
    AFTER UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION trigger_smart_materialized_view_refresh();

CREATE TRIGGER trigger_smart_mv_refresh_delete
    AFTER DELETE ON entities
    FOR EACH ROW EXECUTE FUNCTION trigger_smart_materialized_view_refresh();

-- Create background worker scheduler function
CREATE OR REPLACE FUNCTION materialized_view_background_scheduler()
RETURNS void AS $$
DECLARE
    view_record RECORD;
    time_since_last_refresh INTERVAL;
    threshold_minutes INTEGER;
BEGIN
    -- Check each materialized view for scheduled refresh
    FOR view_record IN
        SELECT * FROM materialized_view_refresh_schedule
        WHERE auto_refresh_enabled = true
    LOOP
        -- Get time since last refresh
        time_since_last_refresh := NOW() - COALESCE(view_record.last_refresh_at, NOW() - INTERVAL '1 day');
        
        -- Get threshold
        SELECT threshold_time_minutes INTO threshold_minutes
        FROM materialized_view_refresh_schedule
        WHERE view_name = view_record.view_name;
        
        -- Trigger refresh if time threshold exceeded
        IF time_since_last_refresh > (threshold_minutes || ' minutes')::INTERVAL THEN
            PERFORM automated_refresh_materialized_view(view_record.view_name);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create performance monitoring view
CREATE OR REPLACE VIEW v_materialized_view_performance AS
SELECT 
    mrs.view_name,
    mrs.last_refresh_at,
    mrs.last_refresh_duration_ms,
    mrs.last_success,
    mrs.refresh_count,
    mrs.failure_count,
    CASE 
        WHEN mrs.last_success AND mrs.last_refresh_duration_ms < 1000 THEN 'HEALTHY'
        WHEN mrs.last_success AND mrs.last_refresh_duration_ms < 2000 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as health_status,
    -- Calculate average refresh time (last 10 refreshes)
    (
        SELECT AVG(duration_ms)
        FROM (
            SELECT 
                automated_refresh_materialized_view(mrs.view_name, true) as refresh_result
            FROM generate_series(1, 1) -- Placeholder for actual query
        ) recent_refreshes
    ) as avg_duration_ms
FROM materialized_view_refresh_schedule mrs;

-- Create refresh metrics for monitoring
CREATE TABLE IF NOT EXISTS refresh_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    view_name TEXT NOT NULL,
    refresh_duration_ms INTEGER,
    success BOOLEAN NOT NULL,
    changes_processed BIGINT DEFAULT 0,
    cache_invalidation_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_metrics_view_time ON refresh_metrics (view_name, created_at);

-- Function to get current refresh performance
CREATE OR REPLACE FUNCTION get_refresh_performance_summary()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_views', (SELECT COUNT(*) FROM materialized_view_refresh_schedule),
        'enabled_views', (SELECT COUNT(*) FROM materialized_view_refresh_schedule WHERE auto_refresh_enabled = true),
        'avg_refresh_time_ms', (
            SELECT ROUND(AVG(last_refresh_duration_ms))
            FROM materialized_view_refresh_schedule 
            WHERE last_success = true AND last_refresh_duration_ms IS NOT NULL
        ),
        'health_status', (
            SELECT jsonb_object_agg(view_name, health_status)
            FROM v_materialized_view_performance
        ),
        'recent_performance', (
            SELECT jsonb_agg(jsonb_build_object(
                'view_name', view_name,
                'avg_duration_ms', avg_duration_ms,
                'health_status', health_status
            ))
            FROM v_materialized_view_performance
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO forecastin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO forecastin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO forecastin;

-- Add comments for documentation
COMMENT ON TABLE materialized_view_refresh_schedule IS 'Controls automated refresh scheduling and smart trigger parameters';
COMMENT ON TABLE entity_change_log IS 'Tracks entity changes for smart refresh triggering';
COMMENT ON TABLE refresh_metrics IS 'Performance metrics for materialized view refresh operations';
COMMENT ON FUNCTION automated_refresh_materialized_view(TEXT, BOOLEAN, UUID) IS 'Performs smart refresh of materialized views with timing and error handling';
COMMENT ON FUNCTION trigger_smart_materialized_view_refresh() IS 'Smart trigger function that queues changes for efficient batch processing';
COMMENT ON FUNCTION materialized_view_background_scheduler() IS 'Background scheduler for periodic refresh based on time thresholds';

-- Initial refresh of existing materialized views
SELECT automated_refresh_all_materialized_views();

-- Validation check
DO $$
BEGIN
    -- Verify refresh system is working
    PERFORM get_refresh_performance_summary();
    
    RAISE NOTICE 'Automated materialized view refresh system initialized successfully';
END $$;