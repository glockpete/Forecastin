# Changelog

All notable changes to Forecastin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Repository Audit & Documentation Consolidation (2025-11-08)**:
  - Comprehensive documentation audit with 84 markdown files analysed
  - `checks/help_docs_consolidation.md` - Consolidation report with 15 actions (18% doc reduction)
  - `checks/gap_map.md` - 30 identified gaps with code-only vs requires-stack classification
  - 3 PR-ready patches: performance metrics alignment, migration path fix, API endpoint updates
  - Complete backend API map (33 routes, 14 services, 13 DB tables)
  - Complete frontend structure map (hybrid state management, geospatial layers, WebSocket integration)
- Documentation update: Fixed file path references and API endpoint documentation
- Comprehensive developer documentation (CONTRIBUTING.md, DEVELOPER_SETUP.md, TESTING_GUIDE.md, etc.)
- **RSS Service Integration**: Complete RSS ingestion service now integrated with API
  - 5 new API endpoints: `/api/rss/ingest`, `/api/rss/ingest/batch`, `/api/rss/metrics`, `/api/rss/health`, `/api/rss/jobs/{job_id}`
  - Full initialization in main.py lifespan with service configuration
  - Module structure completed with proper `__init__.py` files
  - Comprehensive integration documentation in RSS_INTEGRATION_SUMMARY.md
  - Services integrated: route processor, entity extractor, deduplicator, anti-crawler, WebSocket notifier

### Changed
- **Documentation Consolidation Plan**:
  - Proposed move: `docs/reports/SCOUT_LOG.md` → `checks/SCOUT_LOG.md`
  - Proposed removal: 8 redundant summary/update files
  - Proposed merge: 6 files into canonical documentation
  - Updated GOLDEN_SOURCE.md with corrected API endpoint documentation
  - Updated AGENTS.md with accurate migration file paths (migration 003 does not exist, use 001)

### Fixed
- Corrected documentation file references (removed non-existent migration 003)
- **Performance Metrics Drift**: README.md now shows actual measured performance (3.46ms) instead of projected (0.07ms)
- **REPO_MAP Completeness**: Added missing RSS endpoints to API route documentation
- **TypeScript Strict Type Checking**: Fixed all TypeScript errors in layer infrastructure (PR #22, #23)
  - Fixed 103 type errors across 8 layer files
  - Added `override` modifiers for proper inheritance
  - Added null/undefined guards for `noUncheckedIndexedAccess`
  - Fixed `exactOptionalPropertyTypes` issues with conditional property spreading
  - All layer files now compile with strict TypeScript checking enabled
  - Files fixed: BaseLayer, LinestringLayer, PointLayer, PolygonLayer, GeoJsonLayer, layer-types, layer-utils, performance-monitor
- **RSS Service Integration Gap**: Resolved missing API integration for fully-implemented RSS service
  - RSS ingestion service code existed but was not connected to API endpoints
  - Added complete API endpoint integration
  - Service now initializes automatically with cache, realtime, and hierarchy services

### Documentation
- **Audit Findings (2025-11-08)**:
  - 30 gaps identified (28 code-only, 2 requires-stack)
  - 15 documentation files flagged for consolidation
  - 6 undocumented environment variables found
  - 5 contract drift issues documented (3 code-only fixable)
  - Performance SLO regression investigation required (ancestor resolution: 3.46ms vs 1.25ms target)

## [0.9.0] - 2025-11-07 (Current Development)

### Added

#### Core Features
- **RSS Ingestion Service**: RSSHub-inspired architecture with route processors
  - CSS selector-based content extraction
  - Anti-crawler strategies with exponential backoff
  - Content deduplication with 0.8 similarity threshold
  - 5-W entity extraction framework integration
  - WebSocket real-time notifications
- **WebSocket Hardening**: Comprehensive WebSocket reliability improvements
  - Dedicated diagnostic endpoints (`/ws/echo`, `/ws/health`)
  - Server-side heartbeat with configurable intervals
  - Connection state guards to prevent infinite retry loops
  - Enhanced diagnostic logging for troubleshooting
- **Automated Materialized View Refresh**: Background job system
  - Manual refresh API endpoint
  - Scheduled automated refresh
  - Performance metrics and monitoring

#### Performance
- Multi-tier caching (L1-L4) with 99.2% hit rate
- LTREE materialized views for O(log n) hierarchy navigation
- 42,726 RPS throughput validated
- Sub-millisecond ancestor resolution (0.07ms mean)
- WebSocket serialization: 0.019ms with orjson

#### Geospatial Features
- BaseLayer architecture with GPU filtering
- PointLayer, PolygonLayer, LinestringLayer implementations
- GeoJSON import support with automatic geometry detection
- Real-time layer updates via WebSocket
- Feature flag-based gradual rollout (10% → 25% → 50% → 100%)

#### Developer Experience
- TypeScript strict mode compliance (0 compilation errors)
- Comprehensive documentation suite
- CI/CD pipeline with performance validation
- SLO monitoring and automated compliance checks

### Performance Metrics

| Metric | Target | Achieved | Status |
|--------|--------|----------|--------|
| Ancestor Resolution | <10ms | 3.46ms | ⚠️ Regression |
| Throughput | >10k RPS | 42,726 RPS | ✅ |
| Cache Hit Rate | >90% | 99.2% | ✅ |
| WebSocket Latency | <200ms | 0.019ms | ✅ |

### Database Schema
- Phase 0: Initial schema with LTREE and PostGIS extensions
- Phase 1: Entity extraction and RSS feed tables
- Phase 2: ML A/B testing framework
- Phase 3: Scenario planning and validation rules
- Phase 4: Automated materialized view refresh

### Known Issues
- Ancestor resolution performance regression (3.46ms vs 1.25ms target) - under investigation
- ~~RSS ingestion service architecture complete but implementation pending~~ ✅ **RESOLVED** - Service now fully integrated with API endpoints

## [0.8.0] - 2025-11-05

### Added
- **Advanced Scenario Construction**: Multi-factor analysis and validation
- **UI/UX Enhancement**: Miller's Columns navigation with mobile optimization
- **Performance Scaling**: Load testing and CDN integration
- **WCAG 2.1 AA Accessibility**: Full accessibility compliance

### Changed
- Upgraded frontend to React 18.2 with concurrent features
- Enhanced state management with React Query + Zustand hybrid approach

### Performance
- Achieved 99.2% cache hit rate
- Validated 42,726 RPS throughput under load
- Optimized geospatial rendering to sub-10ms for 10k points

## [0.7.0] - 2025-11-04

### Added
- **Geospatial Visualization System**: Complete layer architecture
  - BaseLayer with visual channels system (kepler.gl-inspired)
  - LayerRegistry with dynamic layer instantiation
  - GPU filtering with automatic CPU fallback
  - Performance monitoring every 30 seconds
- **Feature Flag System**: Database-backed with real-time updates
  - Multi-tier caching integration
  - WebSocket notifications on flag changes
  - Percentage-based rollout support

### Performance
- Geospatial render time: 1.25ms (P95: 1.87ms)
- GPU filter time: 65ms for 10,000 points
- Materialized view refresh: 850ms

## [0.6.0] - 2025-11-03

### Added
- **Scenario Planning & Forecasting**: Hierarchical forecasting workbench
- **Risk Assessment Framework**: STEEP analysis integration
- **Multi-variable Scenario Modeling**: Confidence-weighted outcomes

## [0.5.0] - 2025-11-02

### Added
- **ML A/B Testing Framework**: Automatic rollback with 7 risk conditions
- **Entity Deduplication**: Similarity threshold 0.8 with canonical keys
- **Multi-factor Confidence Scoring**: Calibrated confidence for entity extraction

## [0.4.0] - 2025-11-01

### Added
- **PostGIS Integration**: Geospatial queries and proximity analysis
- **Mobile-Responsive UI**: Miller's Columns adaptation for mobile devices
- **Real-time Updates**: WebSocket integration with <200ms latency

### Changed
- Migrated to LTREE materialised views from recursive queries
- Performance improvement: O(n²) → O(log n) for hierarchy queries

## [0.3.0] - 2025-10-30

### Added
- **STEEP Categorisation Engine**: Social, Technological, Economic, Environmental, Political analysis
- **Curator Override System**: Manual categorisation with audit trail
- **Breadcrumb Navigation**: Hierarchical context in UI
- **Deep Linking**: Direct links to hierarchical views

### Performance
- P95 API response times: <100ms (validated)

## [0.2.0] - 2025-10-28

### Added
- **Entity Extraction Pipeline**: 5-W framework (Who, What, Where, When, Why)
- **RSSHub Integration**: Feed ingestion with 95% daily success rate
- **Miller's Columns UI**: Hierarchical navigation component
- **Basic Navigation API**: LTREE-based hierarchy endpoints

### Changed
- Established multi-tier caching strategy (L1-L4)

## [0.1.0] - 2025-10-25

### Added
- **Initial Project Setup**
  - PostgreSQL with LTREE and PostGIS extensions
  - FastAPI service on port 9000
  - React frontend on port 3000
  - Docker Compose development environment
  - Basic CI/CD pipeline

### Infrastructure
- Database schema with LTREE hierarchical support
- Redis caching layer
- WebSocket infrastructure foundation

## Release Process

### Version Numbering

Forecastin follows Semantic Versioning:

- **Major (X.0.0)**: Breaking changes, major new features
- **Minor (0.X.0)**: New features, backwards-compatible
- **Patch (0.0.X)**: Bug fixes, minor improvements

### Release Checklist

Before releasing a new version:

- [ ] All tests passing
- [ ] Performance SLOs validated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Security audit completed
- [ ] Breaking changes documented
- [ ] Migration guide provided (if needed)

### Release Notes Template

```markdown
## [X.Y.Z] - YYYY-MM-DD

### 🎉 Highlights
Brief summary of major changes

### ✨ Added
- New feature 1
- New feature 2

### 🔧 Changed
- Change 1
- Change 2

### 🐛 Fixed
- Bug fix 1
- Bug fix 2

### ⚠️ Breaking Changes
- Breaking change 1 with migration instructions
- Breaking change 2 with migration instructions

### 📈 Performance
- Performance improvement 1
- Performance improvement 2

### 🔒 Security
- Security fix 1 (CVE-YYYY-XXXXX)

### 📚 Documentation
- Doc update 1
- Doc update 2

### 🗄️ Database Migrations
- Migration file 1
- Migration file 2

### ⚡ Performance Metrics
| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Throughput | X RPS | Y RPS | +Z% |
| Latency | Xms | Yms | -Z% |
```

## Migration Guides

### Upgrading to 0.9.0

No breaking changes. New features are opt-in via feature flags.

**New Environment Variables**:
```bash
WS_PING_INTERVAL=30
WS_PING_TIMEOUT=10
```

**New Database Migrations**:
```bash
psql $DATABASE_URL -f migrations/004_rss_entity_extraction_schema.sql
psql $DATABASE_URL -f migrations/004_automated_materialized_view_refresh.sql
```

### Upgrading to 0.8.0

**Breaking Changes**:
- None

**New Features**:
- Advanced scenario construction
- Performance scaling optimizations

**Migration Steps**:
1. No database changes required
2. Clear Redis cache for optimal performance:
   ```bash
   redis-cli FLUSHDB
   ```

## Deprecation Notices

### Planned for Removal

Currently no deprecations planned.

## Security Advisories

No security vulnerabilities reported to date.

For security disclosures, see [SECURITY.md](SECURITY.md).

## Contributors

Thank you to all contributors who have helped make Forecastin better!

See the [GitHub contributors page](https://github.com/glockpete/Forecastin/graphs/contributors) for a complete list.

## Links

- **Repository**: https://github.com/glockpete/Forecastin
- **Issues**: https://github.com/glockpete/Forecastin/issues
- **Documentation**: [docs/](docs/)
- **Security**: [SECURITY.md](SECURITY.md)

---

**Note**: This project is currently in active development (Phase 9: Open Source Launch). Version numbers may change as we approach v1.0.0 release.
