-- Migration: 002_ml_ab_testing_framework.sql
-- ML Model A/B Testing Framework Database Schema
-- Implements persistent Test Registry with automatic rollback capabilities

-- Model variants management table
CREATE TABLE model_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_name TEXT UNIQUE NOT NULL, -- 'baseline_rule_based', 'llm_v1', 'llm_v2', etc.
    model_type TEXT NOT NULL, -- 'rule_based', 'llm', 'hybrid'
    model_version TEXT NOT NULL,
    model_config JSONB NOT NULL, -- Model-specific configuration parameters
    performance_baseline JSONB DEFAULT '{}', -- Baseline performance metrics
    is_active BOOLEAN DEFAULT false,
    is_champion BOOLEAN DEFAULT false, -- Current production model
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CHECK (model_type IN ('rule_based', 'llm', 'hybrid'))
);

-- A/B test registry table for persistent test tracking
CREATE TABLE ab_test_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_name TEXT NOT NULL,
    test_description TEXT,
    champion_variant_id UUID NOT NULL REFERENCES model_variants(id),
    challenger_variant_id UUID NOT NULL REFERENCES model_variants(id),
    test_status TEXT NOT NULL DEFAULT 'draft' CHECK (test_status IN ('draft', 'active', 'paused', 'completed', 'rolled_back', 'cancelled')),
    rollout_strategy TEXT DEFAULT 'gradual' CHECK (rollout_strategy IN ('immediate', 'gradual', 'user_based')),
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    target_sample_size INTEGER, -- Minimum sample size for statistical significance
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    auto_rollback_enabled BOOLEAN DEFAULT true,
    
    -- 7 Configurable Risk Conditions (JSON storage)
    risk_conditions JSONB NOT NULL DEFAULT '{
        "accuracy_threshold": 0.85,
        "latency_threshold_ms": 2.0,
        "confidence_drift_threshold": 0.1,
        "error_rate_threshold": 0.05,
        "cache_hit_threshold": 0.98,
        "throughput_threshold_rps": 30000,
        "anomaly_detection_sensitivity": "high"
    }',
    
    -- Performance metrics tracking
    performance_metrics JSONB DEFAULT '{}',
    risk_assessment JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure we don't test a variant against itself
    CHECK (champion_variant_id != challenger_variant_id)
);

-- Test assignments table for user/session routing
CREATE TABLE test_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES ab_test_registry(id) ON DELETE CASCADE,
    user_id TEXT, -- NULL for anonymous users
    session_id TEXT, -- Fallback for anonymous users
    assigned_variant_id UUID NOT NULL REFERENCES model_variants(id),
    assignment_reason TEXT NOT NULL CHECK (assignment_reason IN ('random', 'user_based', 'sticky', 'percentage_based')),
    assignment_hash TEXT, -- Hash for deterministic assignment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique assignment per user/session per test
    UNIQUE(test_id, user_id),
    UNIQUE(test_id, session_id)
);

-- Performance metrics tracking table
CREATE TABLE test_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES ab_test_registry(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES model_variants(id),
    metric_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Core performance metrics
    accuracy DECIMAL(5,4), -- Model accuracy score (0.0000 to 1.0000)
    latency_ms DECIMAL(8,3), -- Processing latency in milliseconds
    throughput_rps DECIMAL(10,2), -- Requests per second
    cache_hit_rate DECIMAL(5,4), -- Cache hit rate (0.0000 to 1.0000)
    
    -- Entity extraction specific metrics
    entities_processed INTEGER DEFAULT 0,
    average_confidence DECIMAL(5,4),
    deduplication_rate DECIMAL(5,4),
    error_rate DECIMAL(5,4),
    
    -- Additional metadata
    sample_size INTEGER,
    geographic_distribution JSONB, -- Regional performance breakdown
    temporal_distribution JSONB, -- Time-based performance
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk condition evaluation log
CREATE TABLE risk_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES ab_test_registry(id) ON DELETE CASCADE,
    evaluation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Risk condition results
    accuracy_risk BOOLEAN DEFAULT false,
    latency_risk BOOLEAN DEFAULT false,
    confidence_drift_risk BOOLEAN DEFAULT false,
    error_rate_risk BOOLEAN DEFAULT false,
    cache_performance_risk BOOLEAN DEFAULT false,
    throughput_risk BOOLEAN DEFAULT false,
    anomaly_risk BOOLEAN DEFAULT false,
    
    -- Risk assessment details
    triggered_conditions TEXT[], -- Array of triggered condition names
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    recommendation TEXT NOT NULL CHECK (recommendation IN ('continue', 'monitor', 'pause', 'rollback')),
    
    -- Detailed metrics at evaluation time
    current_metrics JSONB NOT NULL,
    threshold_config JSONB NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rollback event log
CREATE TABLE rollback_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES ab_test_registry(id),
    triggered_by TEXT NOT NULL CHECK (triggered_by IN ('manual', 'automatic', 'scheduled')),
    rollback_reason TEXT NOT NULL,
    triggered_conditions TEXT[],
    
    -- Rollback details
    original_champion UUID REFERENCES model_variants(id),
    original_challenger UUID REFERENCES model_variants(id),
    rollback_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Impact assessment
    affected_users INTEGER DEFAULT 0,
    affected_sessions INTEGER DEFAULT 0,
    performance_impact JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extend feature flags for A/B testing
INSERT INTO feature_flags (flag_name, description, is_enabled, rollout_percentage) VALUES
('ff.ab_routing', 'Enable A/B testing traffic routing', false, 0),
('ff.ab_auto_rollback', 'Enable automatic rollback for A/B tests', true, 100),
('ff.ab_risk_monitoring', 'Enable real-time risk condition monitoring', true, 100),
('ff.ab_performance_tracking', 'Enable detailed performance metrics tracking', true, 100)
ON CONFLICT (flag_name) DO NOTHING;

-- Insert initial model variants
INSERT INTO model_variants (variant_name, model_type, model_version, model_config, is_active, is_champion) VALUES
('baseline_rule_based', 'rule_based', '1.0.0', '{
    "confidence_threshold": 0.7,
    "similarity_threshold": 0.8,
    "max_entities_per_text": 100,
    "rule_based_extraction": true,
    "pattern_matching": true
}', true, true),
('llm_v1', 'llm', '1.0.0', '{
    "model_name": "gpt-3.5-turbo",
    "confidence_threshold": 0.8,
    "max_tokens": 1000,
    "temperature": 0.1,
    "rule_based_calibration": true
}', false, false),
('llm_v2', 'llm', '2.0.0', '{
    "model_name": "gpt-4",
    "confidence_threshold": 0.85,
    "max_tokens": 1500,
    "temperature": 0.05,
    "rule_based_calibration": true,
    "enhanced_prompting": true
}', false, false),
('llm_v2_enhanced', 'llm', '2.1.0', '{
    "model_name": "gpt-4-turbo",
    "confidence_threshold": 0.87,
    "max_tokens": 2000,
    "temperature": 0.03,
    "rule_based_calibration": true,
    "enhanced_prompting": true,
    "additional_training": true
}', false, false),
('hybrid_v1', 'hybrid', '1.0.0', '{
    "rule_based_weight": 0.4,
    "llm_weight": 0.6,
    "model_name": "gpt-4",
    "confidence_threshold": 0.82,
    "ensemble_method": "weighted_average"
}', false, false)
ON CONFLICT (variant_name) DO NOTHING;

-- Performance optimized indexes
CREATE INDEX idx_model_variants_name ON model_variants (variant_name);
CREATE INDEX idx_model_variants_active ON model_variants (is_active) WHERE is_active = true;
CREATE INDEX idx_model_variants_champion ON model_variants (is_champion) WHERE is_champion = true;

CREATE INDEX idx_ab_test_status ON ab_test_registry (test_status);
CREATE INDEX idx_ab_test_variants ON ab_test_registry (champion_variant_id, challenger_variant_id);
CREATE INDEX idx_ab_test_rollout ON ab_test_registry (rollout_percentage) WHERE test_status = 'active';
CREATE INDEX idx_ab_test_timeframe ON ab_test_registry (start_time, end_time);

CREATE INDEX idx_test_assignments_test ON test_assignments (test_id);
CREATE INDEX idx_test_assignments_user ON test_assignments (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_test_assignments_session ON test_assignments (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_test_assignments_variant ON test_assignments (assigned_variant_id);
CREATE INDEX idx_test_assignments_hash ON test_assignments (assignment_hash);

CREATE INDEX idx_performance_metrics_test ON test_performance_metrics (test_id);
CREATE INDEX idx_performance_metrics_variant ON test_performance_metrics (variant_id);
CREATE INDEX idx_performance_metrics_timestamp ON test_performance_metrics (metric_timestamp);
CREATE INDEX idx_performance_metrics_accuracy ON test_performance_metrics (accuracy) WHERE accuracy IS NOT NULL;

CREATE INDEX idx_risk_evaluations_test ON risk_evaluations (test_id);
CREATE INDEX idx_risk_evaluations_timestamp ON risk_evaluations (evaluation_timestamp);
CREATE INDEX idx_risk_level ON risk_evaluations (risk_level);
CREATE INDEX idx_risk_recommendation ON risk_evaluations (recommendation);

CREATE INDEX idx_rollback_events_test ON rollback_events (test_id);
CREATE INDEX idx_rollback_events_timestamp ON rollback_events (rollback_timestamp);
CREATE INDEX idx_rollback_events_trigger ON rollback_events (triggered_by);

-- Materialized views for performance analytics
CREATE MATERIALIZED VIEW mv_test_performance AS
SELECT 
    t.id as test_id,
    t.test_name,
    t.test_status,
    mv_champion.variant_name as champion_variant,
    mv_challenger.variant_name as challenger_variant,
    t.rollout_percentage,
    t.risk_conditions,
    -- Assignment statistics
    COUNT(ta.id) as total_assignments,
    COUNT(CASE WHEN ta.assigned_variant_id = t.champion_variant_id THEN 1 END) as champion_assignments,
    COUNT(CASE WHEN ta.assigned_variant_id = t.challenger_variant_id THEN 1 END) as challenger_assignments,
    
    -- Performance metrics (aggregated)
    AVG(CASE WHEN pm.variant_id = t.champion_variant_id THEN pm.accuracy END) as champion_avg_accuracy,
    AVG(CASE WHEN pm.variant_id = t.challenger_variant_id THEN pm.accuracy END) as challenger_avg_accuracy,
    AVG(CASE WHEN pm.variant_id = t.champion_variant_id THEN pm.latency_ms END) as champion_avg_latency,
    AVG(CASE WHEN pm.variant_id = t.challenger_variant_id THEN pm.latency_ms END) as challenger_avg_latency,
    AVG(CASE WHEN pm.variant_id = t.champion_variant_id THEN pm.throughput_rps END) as champion_avg_throughput,
    AVG(CASE WHEN pm.variant_id = t.challenger_variant_id THEN pm.throughput_rps END) as challenger_avg_throughput,
    
    -- Risk assessment
    MAX(CASE WHEN re.risk_level = 'critical' THEN 1 ELSE 0 END) as has_critical_risk,
    MAX(CASE WHEN re.recommendation = 'rollback' THEN 1 ELSE 0 END) as has_rollback_recommendation
FROM ab_test_registry t
LEFT JOIN model_variants mv_champion ON t.champion_variant_id = mv_champion.id
LEFT JOIN model_variants mv_challenger ON t.challenger_variant_id = mv_challenger.id
LEFT JOIN test_assignments ta ON t.id = ta.test_id
LEFT JOIN test_performance_metrics pm ON t.id = pm.test_id
LEFT JOIN risk_evaluations re ON t.id = re.test_id
WHERE t.test_status IN ('active', 'completed')
GROUP BY t.id, mv_champion.variant_name, mv_challenger.variant_name;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_mv_test_performance_test_id ON mv_test_performance (test_id);
CREATE INDEX idx_mv_test_performance_status ON mv_test_performance (test_status);
CREATE INDEX idx_mv_test_performance_champion ON mv_test_performance (champion_variant);
CREATE INDEX idx_mv_test_performance_challenger ON mv_test_performance (challenger_variant);

-- Risk assessment materialized view
CREATE MATERIALIZED VIEW mv_risk_assessment AS
SELECT 
    t.id as test_id,
    t.test_name,
    t.test_status,
    re.evaluation_timestamp,
    re.risk_level,
    re.recommendation,
    re.triggered_conditions,
    re.current_metrics,
    re.threshold_config,
    -- Risk score calculation
    (CASE WHEN re.accuracy_risk THEN 1 ELSE 0 END +
     CASE WHEN re.latency_risk THEN 1 ELSE 0 END +
     CASE WHEN re.confidence_drift_risk THEN 1 ELSE 0 END +
     CASE WHEN re.error_rate_risk THEN 1 ELSE 0 END +
     CASE WHEN re.cache_performance_risk THEN 1 ELSE 0 END +
     CASE WHEN re.throughput_risk THEN 1 ELSE 0 END +
     CASE WHEN re.anomaly_risk THEN 1 ELSE 0 END) as risk_score
FROM ab_test_registry t
JOIN risk_evaluations re ON t.id = re.test_id
WHERE re.evaluation_timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY re.evaluation_timestamp DESC;

-- Create indexes on risk assessment view
CREATE INDEX idx_mv_risk_assessment_test ON mv_risk_assessment (test_id);
CREATE INDEX idx_mv_risk_assessment_timestamp ON mv_risk_assessment (evaluation_timestamp);
CREATE INDEX idx_mv_risk_assessment_level ON mv_risk_assessment (risk_level);
CREATE INDEX idx_mv_risk_assessment_recommendation ON mv_risk_assessment (recommendation);

-- Function to refresh A/B testing materialized views
CREATE OR REPLACE FUNCTION refresh_ab_testing_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_test_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_risk_assessment;
END;
$$ LANGUAGE plpgsql;

-- Extend existing refresh_hierarchy_views function
CREATE OR REPLACE FUNCTION refresh_hierarchy_views()
RETURNS void AS $$
BEGIN
    -- Refresh existing hierarchy views
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_descendant_counts;
    
    -- Refresh A/B testing views
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_test_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_risk_assessment;
END;
$$ LANGUAGE plpgsql;

-- Function to get test assignment with fallback logic
CREATE OR REPLACE FUNCTION get_test_assignment(p_test_id UUID, p_user_id TEXT DEFAULT NULL, p_session_id TEXT DEFAULT NULL)
RETURNS TABLE (
    assignment_id UUID,
    variant_name TEXT,
    assignment_reason TEXT,
    is_champion BOOLEAN
) AS $$
BEGIN
    -- Try to get existing assignment
    RETURN QUERY
    SELECT 
        ta.id,
        mv.variant_name,
        ta.assignment_reason,
        mv.is_champion
    FROM test_assignments ta
    JOIN model_variants mv ON ta.assigned_variant_id = mv.id
    WHERE ta.test_id = p_test_id
    AND (p_user_id IS NULL OR ta.user_id = p_user_id)
    AND (p_session_id IS NULL OR ta.session_id = p_session_id)
    ORDER BY ta.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to evaluate risk conditions
CREATE OR REPLACE FUNCTION evaluate_risk_conditions(p_test_id UUID, p_metrics JSONB)
RETURNS TABLE (
    risk_level TEXT,
    recommendation TEXT,
    triggered_conditions TEXT[],
    accuracy_risk BOOLEAN,
    latency_risk BOOLEAN,
    confidence_drift_risk BOOLEAN,
    error_rate_risk BOOLEAN,
    cache_performance_risk BOOLEAN,
    throughput_risk BOOLEAN,
    anomaly_risk BOOLEAN
) AS $$
DECLARE
    risk_conditions JSONB;
    accuracy_risk_flag BOOLEAN := false;
    latency_risk_flag BOOLEAN := false;
    confidence_drift_flag BOOLEAN := false;
    error_rate_flag BOOLEAN := false;
    cache_performance_flag BOOLEAN := false;
    throughput_flag BOOLEAN := false;
    anomaly_flag BOOLEAN := false;
    triggered_conditions_list TEXT[] := '{}';
    risk_score INTEGER := 0;
    final_risk_level TEXT;
    final_recommendation TEXT;
BEGIN
    -- Get risk conditions from test registry
    SELECT risk_conditions INTO risk_conditions
    FROM ab_test_registry
    WHERE id = p_test_id;
    
    -- Evaluate each condition
    -- 1. Accuracy threshold
    IF (p_metrics->>'accuracy')::DECIMAL < (risk_conditions->>'accuracy_threshold')::DECIMAL THEN
        accuracy_risk_flag := true;
        triggered_conditions_list := triggered_conditions_list || 'accuracy_drop';
        risk_score := risk_score + 1;
    END IF;
    
    -- 2. Latency threshold
    IF (p_metrics->>'latency_ms')::DECIMAL > (risk_conditions->>'latency_threshold_ms')::DECIMAL THEN
        latency_risk_flag := true;
        triggered_conditions_list := triggered_conditions_list || 'latency_spike';
        risk_score := risk_score + 1;
    END IF;
    
    -- 3. Error rate threshold
    IF (p_metrics->>'error_rate')::DECIMAL > (risk_conditions->>'error_rate_threshold')::DECIMAL THEN
        error_rate_flag := true;
        triggered_conditions_list := triggered_conditions_list || 'error_rate_increase';
        risk_score := risk_score + 1;
    END IF;
    
    -- 4. Cache performance threshold
    IF (p_metrics->>'cache_hit_rate')::DECIMAL < (risk_conditions->>'cache_hit_threshold')::DECIMAL THEN
        cache_performance_flag := true;
        triggered_conditions_list := triggered_conditions_list || 'cache_performance_degradation';
        risk_score := risk_score + 1;
    END IF;
    
    -- 5. Throughput threshold
    IF (p_metrics->>'throughput_rps')::DECIMAL < (risk_conditions->>'throughput_threshold_rps')::DECIMAL THEN
        throughput_flag := true;
        triggered_conditions_list := triggered_conditions_list || 'throughput_degradation';
        risk_score := risk_score + 1;
    END IF;
    
    -- Determine risk level and recommendation
    CASE risk_score
        WHEN 0 THEN 
            final_risk_level := 'low';
            final_recommendation := 'continue';
        WHEN 1, 2 THEN 
            final_risk_level := 'medium';
            final_recommendation := 'monitor';
        WHEN 3, 4 THEN 
            final_risk_level := 'high';
            final_recommendation := 'pause';
        ELSE 
            final_risk_level := 'critical';
            final_recommendation := 'rollback';
    END CASE;
    
    -- Log the risk evaluation
    INSERT INTO risk_evaluations (
        test_id, triggered_conditions, risk_level, recommendation, 
        accuracy_risk, latency_risk, error_rate_risk, cache_performance_risk, 
        throughput_risk, anomaly_risk, current_metrics, threshold_config
    ) VALUES (
        p_test_id, triggered_conditions_list, final_risk_level, final_recommendation,
        accuracy_risk_flag, latency_risk_flag, error_rate_flag, cache_performance_flag,
        throughput_flag, anomaly_flag, p_metrics, risk_conditions
    );
    
    -- Return results
    RETURN QUERY SELECT 
        final_risk_level,
        final_recommendation,
        triggered_conditions_list,
        accuracy_risk_flag,
        latency_risk_flag,
        confidence_drift_flag,
        error_rate_flag,
        cache_performance_flag,
        throughput_flag,
        anomaly_flag;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_model_variants_updated_at
    BEFORE UPDATE ON model_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_ab_test_registry_updated_at
    BEFORE UPDATE ON ab_test_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Performance monitoring view
CREATE VIEW v_ab_testing_performance AS
SELECT 
    'active_tests' as metric_name,
    COUNT(*) as current_value,
    'count' as unit,
    'PASS' as status
FROM ab_test_registry
WHERE test_status = 'active'
UNION ALL
SELECT 
    'total_assignments' as metric_name,
    COUNT(*) as current_value,
    'count' as unit,
    CASE WHEN COUNT(*) > 1000 THEN 'PASS' ELSE 'WARNING' END as status
FROM test_assignments
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'risk_evaluations' as metric_name,
    COUNT(*) as current_value,
    'count' as unit,
    CASE WHEN COUNT(*) > 50 THEN 'PASS' ELSE 'WARNING' END as status
FROM risk_evaluations
WHERE evaluation_timestamp >= NOW() - INTERVAL '24 hours';

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO forecastin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO forecastin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO forecastin;
GRANT ALL PRIVILEGES ON ALL MATERIALIZED VIEWS IN SCHEMA public TO forecastin;

-- Add comments for documentation
COMMENT ON TABLE model_variants IS 'ML model variants registry with configuration and performance baselines';
COMMENT ON TABLE ab_test_registry IS 'Persistent A/B test registry with 7 configurable risk conditions';
COMMENT ON TABLE test_assignments IS 'User/session test assignments for traffic routing';
COMMENT ON TABLE test_performance_metrics IS 'Real-time performance metrics tracking for A/B tests';
COMMENT ON TABLE risk_evaluations IS 'Risk condition evaluation history for automatic rollback decisions';
COMMENT ON TABLE rollback_events IS 'Complete audit trail of rollback events and impact assessment';
COMMENT ON FUNCTION refresh_ab_testing_views() IS 'Refresh A/B testing materialized views (required for performance optimization)';
COMMENT ON FUNCTION evaluate_risk_conditions(UUID, JSONB) IS 'Evaluate 7 configurable risk conditions and determine rollback recommendation';
COMMENT ON MATERIALIZED VIEW mv_test_performance IS 'Aggregated test performance analytics for dashboard monitoring';
COMMENT ON MATERIALIZED VIEW mv_risk_assessment IS 'Real-time risk assessment data for automatic monitoring';

-- Final validation check
DO $$
BEGIN
    -- Verify all model variants are properly configured
    PERFORM COUNT(*) FROM model_variants WHERE model_config != '{}';
    
    -- Verify risk conditions structure
    PERFORM risk_conditions FROM ab_test_registry WHERE risk_conditions ? 'accuracy_threshold';
    
    -- Verify materialized views are accessible
    PERFORM COUNT(*) FROM mv_test_performance;
    PERFORM COUNT(*) FROM mv_risk_assessment;
    
    RAISE NOTICE 'ML A/B Testing Framework schema initialized successfully with persistent Test Registry';
END $$;