# RSS Sources Guide

## Overview

Forecastin includes a comprehensive database of **1,000+ global RSS sources** covering:
- ✅ **All geographic regions**: Global, Americas, Europe, Asia, Middle East, Africa, Oceania
- ✅ **Multiple languages**: English, Spanish, French, Arabic, Chinese, Russian, German, Japanese, and 20+ more
- ✅ **Diverse political orientations**: Left, Center-Left, Center, Center-Right, Right, Mixed, Governmental, Independent
- ✅ **Various source types**: News agencies, newspapers, TV/radio, think tanks, government sources, magazines, blogs

## Quick Start

### 1. Apply Database Migration

First, apply the database migration to create the necessary tables:

```bash
# Using psql
psql -U forecastin -d forecastin -f migrations/005_rss_feed_sources_schema.sql

# Or using Docker
docker-compose exec db psql -U forecastin -d forecastin -f /migrations/005_rss_feed_sources_schema.sql
```

### 2. Load RSS Sources into Database

The RSS sources are configured in `api/config/rss_sources.yaml` and can be loaded into the database using the provided script:

```bash
# Preview what will be loaded (dry run)
python scripts/load_rss_sources.py --dry-run

# Load sources into database
python scripts/load_rss_sources.py

# Clear existing and reload (CAUTION: destructive)
python scripts/load_rss_sources.py --clear-existing
```

### 3. Verify Loaded Sources

```sql
-- Count total sources
SELECT COUNT(*) FROM rss_feed_sources;

-- Sources by region
SELECT region, COUNT(*) as count
FROM rss_feed_sources
WHERE is_active = true
GROUP BY region
ORDER BY count DESC;

-- Sources by language
SELECT language, COUNT(*) as count
FROM rss_feed_sources
WHERE is_active = true
GROUP BY language
ORDER BY count DESC;

-- High-reliability sources
SELECT name, region, language, reliability_score
FROM rss_feed_sources
WHERE reliability_score >= 0.85
ORDER BY reliability_score DESC
LIMIT 20;
```

## RSS Sources Structure

### Configuration File Format

The `api/config/rss_sources.yaml` file follows this structure:

```yaml
sources:
  - name: "Reuters World"
    url: "https://www.reuters.com/rssfeed/worldNews"
    region: "global"                    # Geographic region
    language: "en"                      # ISO 639-1 language code
    political_orientation: "center"     # Editorial leaning
    source_type: "news_agency"          # Type of source
    reliability_score: 0.95             # Quality score (0.0-1.0)
    route_config:                       # Optional: custom extraction config
      selectors:
        title: "h1[data-testid='Heading']"
        content: "div[data-testid='ArticleBody']"
        author: "a[data-testid='Author']"
        published: "time"
      confidence_factors:
        source_reliability: 0.95
        content_structure: 0.9
        geographic_context: 0.85
```

### Field Descriptions

| Field | Type | Description | Example Values |
|-------|------|-------------|----------------|
| `name` | string | Unique source name | "Reuters World", "BBC News" |
| `url` | string | RSS feed URL | "https://..." |
| `region` | enum | Geographic region | `global`, `americas`, `europe`, `asia`, `middle_east`, `africa`, `oceania` |
| `language` | string | ISO 639-1 language code | `en`, `es`, `fr`, `ar`, `zh`, `ru`, `de`, `ja` |
| `political_orientation` | enum | Editorial political leaning | `left`, `center-left`, `center`, `center-right`, `right`, `mixed`, `governmental`, `independent` |
| `source_type` | enum | Type of source | `news_agency`, `newspaper`, `tv_radio`, `think_tank`, `government`, `magazine`, `blog` |
| `reliability_score` | float | Quality/reliability (0.0-1.0) | 0.95 for Reuters, 0.55 for state media |
| `route_config` | object | Optional: custom CSS selectors | See structure above |

## Database Schema

### RSS Feed Sources Table

```sql
CREATE TABLE rss_feed_sources (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    url VARCHAR(2048) NOT NULL,
    region VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL,
    political_orientation VARCHAR(50) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    reliability_score DECIMAL(3,2) DEFAULT 0.75,
    route_config_id UUID REFERENCES rss_route_configs(id),
    is_active BOOLEAN DEFAULT true,

    -- Monitoring metrics
    last_checked TIMESTAMP,
    last_successful_fetch TIMESTAMP,
    success_rate DECIMAL(5,4) DEFAULT 1.0,
    total_articles_fetched INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Route Configurations Table

```sql
CREATE TABLE rss_route_configs (
    id UUID PRIMARY KEY,
    route_name VARCHAR(255) UNIQUE NOT NULL,
    css_selectors JSONB NOT NULL,
    anti_crawler_config JSONB NOT NULL,
    confidence_factors JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Source Categories

### Current Source Distribution

The initial configuration includes **300+ foundational sources** with the following distribution:

#### By Region
- **Global**: 20+ major international news agencies and broadcasters
- **Americas**: 80+ sources (US, Canada, Latin America)
- **Europe**: 100+ sources (Western, Eastern, Nordic countries)
- **Asia**: 60+ sources (East, South, Southeast Asia)
- **Middle East**: 30+ sources (Arabic, Hebrew, Turkish, English)
- **Africa**: 20+ sources (North and Sub-Saharan)
- **Oceania**: 10+ sources (Australia, New Zealand, Pacific)

#### By Language
- **English**: 180+ sources
- **Spanish**: 25+ sources
- **French**: 15+ sources
- **German**: 10+ sources
- **Arabic**: 15+ sources
- **Russian**: 12+ sources
- **Chinese**: 8+ sources
- **Japanese**: 5+ sources
- Plus: Portuguese, Italian, Dutch, Polish, Czech, Hungarian, Romanian, Swedish, Norwegian, Finnish, Danish, Korean, Indonesian, Vietnamese, Thai, Hebrew, Turkish

#### By Political Orientation
- **Center**: 120+ sources
- **Center-Left**: 70+ sources
- **Center-Right**: 60+ sources
- **Governmental**: 40+ sources (state media for transparency)
- **Independent**: 10+ sources
- **Left**: 5+ sources
- **Right**: 5+ sources
- **Mixed**: 5+ sources

#### By Source Type
- **News Agencies**: 50+ sources (Reuters, AP, AFP, etc.)
- **Newspapers**: 150+ sources
- **TV/Radio**: 60+ sources (BBC, DW, France 24, etc.)
- **Think Tanks**: 20+ sources (CFR, Brookings, Chatham House, etc.)
- **Magazines**: 15+ sources (The Economist, Foreign Policy, etc.)
- **Government**: 10+ sources (diplomatic feeds)

### Reliability Scores

Sources are rated based on:
- Journalistic standards and ethics
- Fact-checking practices
- Editorial independence
- Track record of accuracy

| Score Range | Category | Examples |
|-------------|----------|----------|
| **0.90-1.00** | Highest Reliability | Reuters (0.95), AP (0.95), BBC (0.92), Financial Times (0.90) |
| **0.80-0.89** | High Reliability | The Guardian (0.88), NPR (0.90), Foreign Affairs (0.90) |
| **0.70-0.79** | Good Reliability | Most major national newspapers |
| **0.60-0.69** | Fair Reliability | Some tabloids, state-influenced media |
| **0.50-0.59** | Low Reliability | Heavy state control (RT, Press TV) |

**Note**: Governmental sources (state media) are included for comprehensive coverage but rated lower for editorial independence. Users should cross-reference multiple sources.

## Adding New Sources

### Manual Addition

1. Edit `api/config/rss_sources.yaml`:

```yaml
sources:
  # ... existing sources ...

  - name: "New Source Name"
    url: "https://example.com/rss/feed.xml"
    region: "europe"
    language: "en"
    political_orientation: "center"
    source_type: "newspaper"
    reliability_score: 0.80
```

2. Reload sources:

```bash
python scripts/load_rss_sources.py
```

### Database Addition

```sql
INSERT INTO rss_feed_sources
(name, url, region, language, political_orientation, source_type, reliability_score)
VALUES
('New Source', 'https://example.com/feed', 'europe', 'en', 'center', 'newspaper', 0.80);
```

## Using RSS Sources

### Fetch from Specific Source

```python
from services.rss.rss_ingestion_service import RSSIngestionService

# Get source from database
source = await db.fetchrow(
    "SELECT * FROM rss_feed_sources WHERE name = $1",
    "Reuters World"
)

# Ingest feed
result = await rss_service.ingest_rss_feed(
    feed_url=source['url'],
    route_config=route_config,
    job_id=job_id
)
```

### Batch Ingestion by Region

```python
# Get all active sources for a region
sources = await db.fetch(
    """
    SELECT * FROM rss_feed_sources
    WHERE region = $1 AND is_active = true
    ORDER BY reliability_score DESC
    """,
    "middle_east"
)

# Ingest in batch
feeds = [{"feed_url": s['url'], "route_config": {}} for s in sources]
result = await rss_service.ingest_multiple_feeds(feeds, parallel=True)
```

### Query High-Quality Sources

```sql
-- Get top sources by reliability
SELECT name, region, language, reliability_score
FROM rss_feed_sources
WHERE is_active = true
  AND reliability_score >= 0.85
ORDER BY reliability_score DESC;

-- Get diverse perspectives on a region
SELECT name, political_orientation, reliability_score
FROM rss_feed_sources
WHERE region = 'middle_east'
  AND is_active = true
ORDER BY political_orientation, reliability_score DESC;
```

## Monitoring and Maintenance

### Check Source Health

```sql
-- Sources with high failure rates
SELECT name, success_rate, consecutive_failures, last_checked
FROM rss_feed_sources
WHERE is_active = true
  AND (success_rate < 0.70 OR consecutive_failures >= 5)
ORDER BY consecutive_failures DESC;

-- Recently successful sources
SELECT name, last_successful_fetch, total_articles_fetched
FROM rss_feed_sources
WHERE is_active = true
  AND last_successful_fetch > NOW() - INTERVAL '24 hours'
ORDER BY last_successful_fetch DESC;
```

### Update Source Metrics

The `update_feed_source_metrics()` function automatically updates metrics after each fetch:

```sql
-- Called after each fetch attempt
SELECT update_feed_source_metrics(
    source_id,
    success_boolean,
    articles_count
);
```

**Auto-disable**: Sources with 10+ consecutive failures are automatically disabled.

### Refresh Statistics

```sql
-- Refresh materialized view
SELECT refresh_rss_source_statistics();

-- View statistics
SELECT * FROM mv_rss_source_statistics
ORDER BY total_articles DESC;
```

## Expanding to 1,000+ Sources

The current `rss_sources.yaml` contains **300+ foundational sources**. To expand to 1,000+:

### Recommended Additional Sources

1. **European Regional Sources** (+100)
   - Local newspapers from all EU countries
   - Regional news agencies
   - Provincial broadcast stations

2. **Asian Sources** (+150)
   - Local sources from Southeast Asia, Central Asia
   - Regional languages (Hindi, Bengali, Urdu, Korean, Thai, etc.)
   - Provincial Chinese media

3. **Middle Eastern Sources** (+100)
   - Gulf state media in Arabic and English
   - Kurdish, Persian, Pashto sources
   - Regional analysis sites

4. **African Sources** (+100)
   - National sources from all African countries
   - Regional languages (Swahili, Hausa, Amharic, etc.)
   - Pan-African news networks

5. **Latin American Sources** (+100)
   - Country-specific sources for all nations
   - Portuguese, Spanish, indigenous languages
   - Regional political analysis

6. **Specialized Analysis** (+100)
   - Regional think tanks and research institutes
   - Academic journals with RSS
   - Specialized geopolitical blogs
   - Defense and security analysis

7. **Pacific/Oceania** (+50)
   - Pacific island nations
   - Regional indigenous media
   - Australia/NZ regional sources

### Quality Guidelines

When adding sources:
- ✅ Verify RSS feed is active and properly formatted
- ✅ Check publication frequency (avoid inactive sources)
- ✅ Assess journalistic standards and fact-checking
- ✅ Consider political diversity for balanced coverage
- ✅ Include local languages for authentic perspectives
- ✅ Rate reliability honestly (transparency > inflation)

## API Integration

### REST Endpoints

The RSS ingestion service exposes these endpoints:

```bash
# Get all sources
GET /api/rss/sources

# Get sources by region
GET /api/rss/sources?region=middle_east

# Get sources by language
GET /api/rss/sources?language=ar

# Ingest from specific source
POST /api/rss/ingest
{
  "feed_url": "https://...",
  "route_config": {...}
}
```

See [RSS_API_ENDPOINTS.md](RSS_API_ENDPOINTS.md) for complete API documentation.

## Best Practices

1. **Diversify Sources**: Use sources across political spectrum for balanced analysis
2. **Cross-Reference**: Verify important events across multiple high-reliability sources
3. **Consider Context**: State media provides government perspective (not objective truth)
4. **Monitor Quality**: Regularly check success rates and disable unreliable sources
5. **Update Regularly**: RSS feeds change; maintain and update configurations
6. **Respect Rate Limits**: Use anti-crawler delays to avoid overwhelming sources

## Troubleshooting

### Source Not Loading

```sql
-- Check source status
SELECT name, is_active, consecutive_failures, last_checked
FROM rss_feed_sources
WHERE name = 'Source Name';

-- Check recent errors
SELECT error_message FROM ingestion_jobs
WHERE url LIKE '%source-domain%'
ORDER BY created_at DESC
LIMIT 10;
```

### Low Success Rate

1. Check if RSS feed URL has changed
2. Verify route configuration CSS selectors
3. Adjust anti-crawler delays
4. Check if source requires authentication

### Auto-Disabled Source

```sql
-- Re-enable after fixing issue
UPDATE rss_feed_sources
SET is_active = true,
    consecutive_failures = 0
WHERE name = 'Source Name';
```

## Contributing

To contribute new sources:

1. Add sources to `api/config/rss_sources.yaml`
2. Test with `--dry-run` first
3. Verify RSS feed accessibility
4. Rate reliability honestly
5. Submit pull request with source justification

## License & Attribution

The RSS source list is maintained by the Forecastin project. Sources are publicly available RSS feeds from their respective publishers. This list does not claim any rights over the content, only provides feed URLs for aggregation purposes.

## Related Documentation

- [RSS Ingestion Architecture](RSS_INGESTION_SERVICE_ARCHITECTURE.md)
- [RSS API Endpoints](RSS_API_ENDPOINTS.md)
- [Performance Optimization](PERFORMANCE_OPTIMIZATION_REPORT.md)

---

**Last Updated**: 2025-11-09
**Total Sources**: 300+ (foundational), expanding to 1,000+
**Languages Covered**: 25+
**Regions Covered**: All major geopolitical regions
