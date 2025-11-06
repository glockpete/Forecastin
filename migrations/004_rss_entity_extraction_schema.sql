-- Migration: RSS Entity Extraction Schema
-- Created: 2025-11-06 13:15:00 UTC
-- Purpose: Store RSS feed articles with extracted 5-W entities for geopolitical intelligence

-- Enable UUID extension for job tracking
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RSS Feed Articles Table
CREATE TABLE IF NOT EXISTS rss_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(2048) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    content TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    feed_source VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Article metadata
    author VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en',
    content_hash VARCHAR(64), -- For deduplication
    status VARCHAR(50) DEFAULT 'pending' -- pending, processing, completed, failed
);

-- Ingestion Jobs Table (for async processing tracking)
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id VARCHAR(255) UNIQUE NOT NULL,
    url VARCHAR(2048) NOT NULL,
    status VARCHAR(50) DEFAULT 'queued', -- queued, processing, completed, failed
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5-W Entity Extraction Results Table
CREATE TABLE IF NOT EXISTS entity_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES rss_articles(id) ON DELETE CASCADE,
    
    -- 5-W Framework Fields
    who TEXT,        -- Entities: persons, organizations, countries
    what TEXT,       -- Actions, events, topics
    entity_when TEXT,       -- Temporal references, dates, time periods  
    entity_where TEXT,      -- Geographic references, locations
    why TEXT,        -- Motivations, reasons, contexts
    
    -- Confidence scores (0.0 to 1.0)
    who_confidence DECIMAL(3,2),
    what_confidence DECIMAL(3,2),
    when_confidence DECIMAL(3,2),
    where_confidence DECIMAL(3,2),
    why_confidence DECIMAL(3,2),
    overall_confidence DECIMAL(3,2),
    
    -- Extraction metadata
    extraction_method VARCHAR(100), -- spacy_nlp, rule_based, etc.
    extraction_version VARCHAR(20) DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Quality indicators
    extraction_time_ms INTEGER,
    token_count INTEGER,
    entity_count INTEGER
);

-- Feature Flags Table
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_name VARCHAR(255) UNIQUE NOT NULL,
    flag_value BOOLEAN NOT NULL DEFAULT false,
    fallback_value BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache Table (for Redis-like functionality in PostgreSQL)
CREATE TABLE IF NOT EXISTS cache_data (
    cache_key VARCHAR(500) PRIMARY KEY,
    cache_value TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_rss_articles_url ON rss_articles(url);
CREATE INDEX IF NOT EXISTS idx_rss_articles_published_at ON rss_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_articles_status ON rss_articles(status);
CREATE INDEX IF NOT EXISTS idx_rss_articles_feed_source ON rss_articles(feed_source);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created_at ON ingestion_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_entity_extractions_article_id ON entity_extractions(article_id);
CREATE INDEX IF NOT EXISTS idx_entity_extractions_confidence ON entity_extractions(overall_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_entity_extractions_who ON entity_extractions(who);
CREATE INDEX IF NOT EXISTS idx_entity_extractions_what ON entity_extractions(what);
CREATE INDEX IF NOT EXISTS idx_entity_extractions_when ON entity_extractions(entity_when);
CREATE INDEX IF NOT EXISTS idx_entity_extractions_where ON entity_extractions(entity_where);
CREATE INDEX IF NOT EXISTS idx_entity_extractions_why ON entity_extractions(why);

CREATE INDEX IF NOT EXISTS idx_cache_data_expires_at ON cache_data(expires_at);

-- Insert default feature flags
INSERT INTO feature_flags (flag_name, flag_value, fallback_value, description) VALUES
('rss_ingestion_enabled', true, false, 'Enable/disable RSS ingestion service'),
('entity_extraction_enabled', true, false, 'Enable/disable 5-W entity extraction'),
('geospatial_layers_enabled', false, false, 'Enable/disable geospatial features'),
('map_v1', false, false, 'Version 1 of map feature'),
('hierarchy_optimized', false, false, 'Optimized hierarchy queries'),
('ws_v1', false, false, 'Version 1 of WebSocket service'),
('ab_routing', false, false, 'A/B test routing for ML models')
ON CONFLICT (flag_name) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_rss_articles_updated_at BEFORE UPDATE ON rss_articles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entity_extractions_updated_at BEFORE UPDATE ON entity_extractions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_data WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to the forecastin user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO forecastin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO forecastin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO forecastin;

-- Comments for documentation
COMMENT ON TABLE rss_articles IS 'Store RSS feed articles with content and metadata';
COMMENT ON TABLE ingestion_jobs IS 'Track async RSS ingestion jobs for monitoring and retry logic';
COMMENT ON TABLE entity_extractions IS 'Store 5-W entity extraction results from RSS articles';
COMMENT ON TABLE feature_flags IS 'Store feature flag configurations with fallback values';
COMMENT ON TABLE cache_data IS 'PostgreSQL-based cache for fallback when Redis is unavailable';

COMMENT ON COLUMN entity_extractions.who IS 'Person, organization, or country entities mentioned in article';
COMMENT ON COLUMN entity_extractions.what IS 'Actions, events, topics, or activities mentioned';
COMMENT ON COLUMN entity_extractions.entity_when IS 'Temporal references, dates, time periods mentioned';
COMMENT ON COLUMN entity_extractions.entity_where IS 'Geographic references, locations mentioned';
COMMENT ON COLUMN entity_extractions.why IS 'Motivations, reasons, contexts, or explanations mentioned';