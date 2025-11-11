-- Migration: RSS Feed Sources and Route Configurations Schema
-- Created: 2025-11-09
-- Purpose: Store RSS feed sources and route configurations for comprehensive global coverage
--
-- This migration adds tables for managing RSS sources across:
-- - All geographic regions
-- - Multiple languages
-- - Diverse political orientations
-- - Different source types (news agencies, newspapers, think tanks, etc.)

-- RSS Route Configurations Table (MUST BE CREATED FIRST - referenced by rss_feed_sources)
CREATE TABLE IF NOT EXISTS rss_route_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_name VARCHAR(255) UNIQUE NOT NULL,

    -- CSS Selectors for content extraction (JSONB for flexibility)
    css_selectors JSONB NOT NULL DEFAULT '{
        "title": ["h1.article-title", "h1.headline", "h1"],
        "content": ["div.article-body", "div.story-content", "article"],
        "author": [".author-name", ".byline", "meta[name=\"author\"]"],
        "published": ["time.published", ".timestamp", "meta[property=\"article:published_time\"]"],
        "geographic": [".location", ".geo-tag", ".region"]
    }'::jsonb,

    -- Anti-crawler configuration (JSONB)
    anti_crawler_config JSONB NOT NULL DEFAULT '{
        "min_delay": 2.0,
        "max_delay": 10.0,
        "user_agent_rotation": true,
        "retry_strategy": "exponential_backoff",
        "max_retries": 3
    }'::jsonb,

    -- Confidence factors for this route (JSONB)
    confidence_factors JSONB NOT NULL DEFAULT '{
        "source_reliability": 0.85,
        "content_structure": 0.80,
        "geographic_context": 0.75
    }'::jsonb,

    -- Metadata
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RSS Feed Sources Table
CREATE TABLE IF NOT EXISTS rss_feed_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    url VARCHAR(2048) NOT NULL,
    region VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL,
    political_orientation VARCHAR(50) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    reliability_score DECIMAL(3,2) DEFAULT 0.75,

    -- Configuration
    route_config_id UUID REFERENCES rss_route_configs(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,

    -- Monitoring metrics
    last_checked TIMESTAMP WITH TIME ZONE,
    last_successful_fetch TIMESTAMP WITH TIME ZONE,
    success_rate DECIMAL(5,4) DEFAULT 1.0,
    total_articles_fetched INTEGER DEFAULT 0,
    total_fetch_attempts INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_reliability_score CHECK (reliability_score >= 0.0 AND reliability_score <= 1.0),
    CONSTRAINT valid_success_rate CHECK (success_rate >= 0.0 AND success_rate <= 1.0),
    CONSTRAINT valid_region CHECK (region IN ('global', 'americas', 'europe', 'asia', 'middle_east', 'africa', 'oceania')),
    CONSTRAINT valid_political_orientation CHECK (political_orientation IN ('left', 'center-left', 'center', 'center-right', 'right', 'mixed', 'governmental', 'independent')),
    CONSTRAINT valid_source_type CHECK (source_type IN ('news_agency', 'newspaper', 'tv_radio', 'think_tank', 'government', 'magazine', 'blog'))
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_rss_route_configs_name ON rss_route_configs(route_name);

CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_region ON rss_feed_sources(region);
CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_language ON rss_feed_sources(language);
CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_political_orientation ON rss_feed_sources(political_orientation);
CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_source_type ON rss_feed_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_is_active ON rss_feed_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_reliability_score ON rss_feed_sources(reliability_score DESC);
CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_success_rate ON rss_feed_sources(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_last_checked ON rss_feed_sources(last_checked DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_active_region
    ON rss_feed_sources(region, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_active_language
    ON rss_feed_sources(language, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_rss_feed_sources_high_reliability
    ON rss_feed_sources(reliability_score DESC, is_active)
    WHERE is_active = true AND reliability_score >= 0.80;

-- Triggers for updated_at
CREATE TRIGGER update_rss_feed_sources_updated_at BEFORE UPDATE ON rss_feed_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rss_route_configs_updated_at BEFORE UPDATE ON rss_route_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default route configurations
INSERT INTO rss_route_configs (route_name, description, css_selectors, anti_crawler_config, confidence_factors) VALUES

-- Standard news route
('standard_news', 'Standard news website route with common CSS patterns',
'{
    "title": ["h1.article-title", "h1.headline", "h1.title", "h1", ".title", ".headline"],
    "content": ["div.article-body", "div.story-content", "div.content", "article .content", ".article-content", "div.body"],
    "author": [".author-name", ".byline", ".author", "meta[name=\"author\"]", ".published-by"],
    "published": ["time.published", ".timestamp", ".date-published", "meta[property=\"article:published_time\"]", ".publish-date"],
    "geographic": [".location", ".geo-tag", ".region", ".country", ".place", "[data-geo]"]
}'::jsonb,
'{
    "min_delay": 2.0,
    "max_delay": 5.0,
    "user_agent_rotation": true,
    "retry_strategy": "exponential_backoff",
    "max_retries": 3
}'::jsonb,
'{
    "source_reliability": 0.85,
    "content_structure": 0.80,
    "geographic_context": 0.75
}'::jsonb),

-- High-reliability news agencies
('news_agency_route', 'Route for major news agencies (Reuters, AP, AFP)',
'{
    "title": ["h1[data-testid=\"Heading\"]", "h1.article-title", "h1.headline", "h1"],
    "content": ["div[data-testid=\"paragraph-0\"]", "div[data-testid=\"ArticleBody\"]", "div.article-body", "article"],
    "author": ["a[data-testid=\"Author\"]", ".author-name", ".byline"],
    "published": ["time", "time.published", "meta[property=\"article:published_time\"]"],
    "geographic": [".location", "[data-geo]", ".geo-tag"]
}'::jsonb,
'{
    "min_delay": 1.5,
    "max_delay": 3.0,
    "user_agent_rotation": true,
    "retry_strategy": "exponential_backoff",
    "max_retries": 5
}'::jsonb,
'{
    "source_reliability": 0.95,
    "content_structure": 0.90,
    "geographic_context": 0.85
}'::jsonb),

-- Government and diplomatic sources
('diplomatic_route', 'Route for government and diplomatic press releases',
'{
    "title": ["h1.document-title", "h1.press-release-title", "h1"],
    "content": ["div.document-content", "div.press-release-body", "article"],
    "author": [".issuing-office", ".department", ".author"],
    "published": ["meta[property=\"article:published_time\"]", "time", ".publish-date"],
    "geographic": [".recipient-countries", ".target-audience", ".location"]
}'::jsonb,
'{
    "min_delay": 2.0,
    "max_delay": 4.0,
    "user_agent_rotation": false,
    "retry_strategy": "exponential_backoff",
    "max_retries": 3
}'::jsonb,
'{
    "source_reliability": 0.75,
    "content_structure": 0.85,
    "geographic_context": 0.80
}'::jsonb),

-- Think tanks and analysis
('think_tank_route', 'Route for think tanks and policy institutions',
'{
    "title": ["h1.article-title", "h1.analysis-title", "h1"],
    "content": ["div.article-content", "div.analysis-body", "article .content"],
    "author": [".author-name", ".analyst-name", ".byline"],
    "published": ["time.published", ".publish-date", "meta[property=\"article:published_time\"]"],
    "geographic": [".region-focus", ".country-tag", ".location"]
}'::jsonb,
'{
    "min_delay": 2.5,
    "max_delay": 6.0,
    "user_agent_rotation": true,
    "retry_strategy": "exponential_backoff",
    "max_retries": 4
}'::jsonb,
'{
    "source_reliability": 0.90,
    "content_structure": 0.85,
    "geographic_context": 0.80
}'::jsonb),

-- International broadcasters
('broadcaster_route', 'Route for international TV/Radio broadcasters',
'{
    "title": ["h1.story-headline", "h1.headline", "h1"],
    "content": ["div.story-body", "div.article-body", "article"],
    "author": [".reporter-name", ".correspondent", ".byline"],
    "published": ["time.timestamp", "time", ".publish-date"],
    "geographic": [".dateline", ".location", ".geo-tag"]
}'::jsonb,
'{
    "min_delay": 2.0,
    "max_delay": 5.0,
    "user_agent_rotation": true,
    "retry_strategy": "exponential_backoff",
    "max_retries": 3
}'::jsonb,
'{
    "source_reliability": 0.88,
    "content_structure": 0.85,
    "geographic_context": 0.82
}'::jsonb)

ON CONFLICT (route_name) DO NOTHING;

-- Create materialized view for source statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rss_source_statistics AS
SELECT
    region,
    language,
    political_orientation,
    source_type,
    COUNT(*) as total_sources,
    COUNT(*) FILTER (WHERE is_active = true) as active_sources,
    AVG(reliability_score) as avg_reliability,
    AVG(success_rate) as avg_success_rate,
    SUM(total_articles_fetched) as total_articles
FROM rss_feed_sources
GROUP BY region, language, political_orientation, source_type;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_rss_source_stats_region
    ON mv_rss_source_statistics(region);

-- Function to refresh source statistics
CREATE OR REPLACE FUNCTION refresh_rss_source_statistics()
RETURNS void AS $$
DECLARE
    lock_acquired boolean;
BEGIN
    -- Acquire advisory lock to prevent concurrent refreshes
    -- Use consistent lock ID for this specific materialized view
    SELECT pg_try_advisory_lock(hashtext('mv_rss_source_statistics')) INTO lock_acquired;

    IF NOT lock_acquired THEN
        RAISE NOTICE 'Could not acquire lock for mv_rss_source_statistics, refresh already in progress';
        RETURN;
    END IF;

    BEGIN
        -- Use CONCURRENTLY to avoid blocking reads during refresh
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rss_source_statistics;
    EXCEPTION
        WHEN insufficient_privilege OR feature_not_supported THEN
            -- Fallback to regular refresh if concurrent not available (requires unique index)
            REFRESH MATERIALIZED VIEW mv_rss_source_statistics;
    END;

    -- Always release the advisory lock
    PERFORM pg_advisory_unlock(hashtext('mv_rss_source_statistics'));
END;
$$ LANGUAGE plpgsql;

-- Function to update feed source metrics after fetch
CREATE OR REPLACE FUNCTION update_feed_source_metrics(
    p_source_id UUID,
    p_success BOOLEAN,
    p_articles_count INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
    UPDATE rss_feed_sources
    SET
        last_checked = NOW(),
        last_successful_fetch = CASE WHEN p_success THEN NOW() ELSE last_successful_fetch END,
        total_fetch_attempts = total_fetch_attempts + 1,
        total_articles_fetched = total_articles_fetched + p_articles_count,
        success_rate = (
            CASE WHEN p_success
            THEN ((total_fetch_attempts * success_rate) + 1.0) / (total_fetch_attempts + 1)
            ELSE ((total_fetch_attempts * success_rate) + 0.0) / (total_fetch_attempts + 1)
            END
        ),
        consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
        updated_at = NOW()
    WHERE id = p_source_id;

    -- Auto-disable sources with too many consecutive failures
    UPDATE rss_feed_sources
    SET is_active = false
    WHERE id = p_source_id
    AND consecutive_failures >= 10;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE rss_feed_sources TO forecastin;
GRANT ALL PRIVILEGES ON TABLE rss_route_configs TO forecastin;
GRANT SELECT ON mv_rss_source_statistics TO forecastin;

-- Comments for documentation
COMMENT ON TABLE rss_feed_sources IS 'Database of 300+ global RSS sources (designed for 1,000+ capacity) across all languages and political orientations';
COMMENT ON TABLE rss_route_configs IS 'Reusable route configurations for RSS content extraction with CSS selectors';
COMMENT ON COLUMN rss_feed_sources.reliability_score IS 'Editorial quality score (0.0-1.0) based on journalistic standards and fact-checking';
COMMENT ON COLUMN rss_feed_sources.political_orientation IS 'Editorial political leaning for balanced source diversity';
COMMENT ON COLUMN rss_feed_sources.success_rate IS 'Historical success rate of RSS feed fetches (0.0-1.0)';
COMMENT ON COLUMN rss_feed_sources.consecutive_failures IS 'Consecutive failed fetch attempts (auto-disabled at 10)';
COMMENT ON FUNCTION update_feed_source_metrics IS 'Update source metrics after each fetch attempt';
COMMENT ON FUNCTION refresh_rss_source_statistics IS 'Refresh materialized view of source statistics';
