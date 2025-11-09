# 01 Repository Inventory

**Repository:** Forecastin
**Analysis Date:** 2025-11-09 05:21 UTC
**Branch:** claude/rebuild-dossier-audit-011CUwkh3z7W1NBQwe4Ysshk
**Purpose:** Deterministic inventory of all system components for rebuild reference

---

## Directory Structure

```
/home/user/Forecastin/
├── api/                          # Python FastAPI backend (71 .py files)
├── frontend/                     # React TypeScript SPA (60 .ts/.tsx files)
├── migrations/                   # PostgreSQL schema migrations (6 .sql files)
├── contracts/                    # Auto-generated API/WebSocket schemas
├── docs/                         # Documentation (60+ .md files, 964KB)
├── scripts/                      # Automation, deployment, testing
├── tests/                        # Root-level integration/performance tests
├── checks/                       # Code quality and gap analysis reports
├── monitoring/                   # Prometheus/Grafana configurations
├── ops/                          # Operations (nginx configs)
├── patches/                      # Bug fixes and documentation patches
├── github_issues/                # GitHub issue tracking
├── REBUILD_DOSSIER/             # Audit and architectural decision records
├── .github/workflows/            # CI/CD (9 workflow files)
└── .roo/                        # Claude Code assistant rules
```

---

## Core Areas

### API (Backend)

**Location:** `/home/user/Forecastin/api/`
**Tech Stack:** Python 3.11+, FastAPI 0.104.1, Uvicorn 0.24.0, PostgreSQL, Redis
**Lines of Code:** ~58,000 (largest file: optimized_hierarchy_resolver.py at 58,629 bytes)
**Stability:** Moderate - Active development with 71 Python files
**Coupling:** Medium - Services layer couples database, cache, and business logic

| Component | Files | Purpose | Notable Patterns |
|-----------|-------|---------|------------------|
| `api/main.py` | 1 | FastAPI app entry | Lifespan management, CORS, router registration |
| `api/routers/` | 9 | API endpoints | RESTful routes, WebSocket, health checks |
| `api/services/` | 15 | Business logic | Multi-tier caching, feature flags, scenarios |
| `api/models/` | 3 | Pydantic schemas | WebSocket messages, serializers |
| `api/navigation_api/` | 3 | LTREE hierarchy | O(log n) queries, materialized views |
| `api/tests/` | 20 | Backend tests | pytest, async fixtures, performance benchmarks |

**Key Dependencies:**
- **Database:** psycopg[binary]==3.2.3, SQLAlchemy==2.0.44, asyncpg==0.29.0
- **Caching:** redis==5.0.1, hiredis==2.2.3
- **Serialization:** orjson==3.9.10 (critical for WebSocket performance)
- **Testing:** pytest==8.3.3, pytest-asyncio==0.21.1, pytest-cov==4.1.0

**Configuration Files:**
- `api/requirements.txt` (production dependencies)
- `api/requirements-dev.txt` (development dependencies)
- `api/requirements.railway.txt` (Railway deployment)
- `api/Dockerfile`, `api/Dockerfile.railway`, `api/Dockerfile.full`

**Ownership:** Backend team
**Stability Level:** Production-ready with active feature development

---

### Frontend

**Location:** `/home/user/Forecastin/frontend/`
**Tech Stack:** React 18.2.0, TypeScript 5.3.0 (strict mode), Vite 5.4.11, Vitest 4.0.8
**Lines of Code:** ~35,000
**Stability:** Moderate - TypeScript strict mode with 97 'any' types
**Coupling:** Low - Clean separation with path aliases, hooks-based architecture

| Component | Files | Purpose | Notable Patterns |
|-----------|-------|---------|------------------|
| `src/App.tsx` | 1 | Root component | React Router v6 setup |
| `src/components/` | 16 | UI components | Miller columns, outcomes dashboard, map viewer |
| `src/hooks/` | 5 | Custom hooks | WebSocket, hybrid state, feature flags, hierarchy |
| `src/layers/` | 13 | Geospatial layers | Plugin-based registry, GPU filtering |
| `src/store/` | 1 | Zustand store | Global UI state (5,891 bytes) |
| `src/types/` | 8 | TypeScript types | Auto-generated contracts, WebSocket messages |
| `src/utils/` | 6 | Utilities | Error recovery, idempotency, validation |
| `src/integrations/` | 1 | Third-party | WebSocket-layer integration (21,388 bytes) |
| `tests/` | 8 | Frontend tests | Vitest, React Testing Library, contract drift |

**Key Dependencies:**
- **Core:** react@18.2.0, react-dom@18.2.0, typescript@5.3.0
- **State:** @tanstack/react-query@5.90.7, zustand@4.4.6
- **Routing:** react-router-dom@6.17.0
- **Visualization:** deck.gl@9.2.2, maplibre-gl@4.7.1, h3-js@4.1.0
- **Styling:** tailwindcss@3.3.5, lucide-react@0.292.0
- **Testing:** vitest@4.0.8, @testing-library/react@14.0.0, msw@2.0.11

**Path Aliases** (tsconfig.json:28-34):
```json
{
  "@": "./src",
  "@types": "./src/types",
  "@components": "./src/components",
  "@hooks": "./src/hooks",
  "@utils": "./src/utils",
  "@layers": "./src/layers",
  "@handlers": "./src/handlers"
}
```

**Configuration Files:**
- `frontend/package.json`, `frontend/package-lock.json`
- `frontend/tsconfig.json` (strict mode enabled)
- `frontend/vite.config.ts`, `frontend/vitest.config.ts`
- `frontend/.eslintrc.js`, `frontend/.prettierrc`
- `frontend/Dockerfile`, `frontend/Dockerfile.dev`

**Ownership:** Frontend team
**Stability Level:** Production-ready with minor type safety improvements needed

---

### Database

**Location:** `/home/user/Forecastin/migrations/`
**Tech Stack:** PostgreSQL 13 with LTREE and PostGIS extensions
**Migration Count:** 6 SQL files (001, 002, 004 sequences)
**Stability:** High - Schema stable with incremental migrations
**Coupling:** Medium - LTREE tightly couples hierarchical data model

| Migration | Purpose | Key Artifacts | Status |
|-----------|---------|---------------|--------|
| `001_initial_schema.sql` | Core schema | Entities, hierarchies, LTREE | Applied |
| `001_standardize_feature_flag_names.sql` | Feature flag refactor | Naming conventions | Applied |
| `001_standardize_feature_flag_names_ROLLBACK.sql` | Rollback script | Revert flag names | Rollback ready |
| `002_ml_ab_testing_framework.sql` | ML experiments | A/B testing, model versioning | Applied |
| `004_rss_entity_extraction_schema.sql` | RSS ingestion | 5-W extraction tables | Applied |
| `004_automated_materialized_view_refresh.sql` | Performance | Materialized views, auto-refresh | Applied |

**Index Count:** 62+ indexes across all migrations
**Special Features:**
- LTREE extension for O(log n) hierarchical queries
- PostGIS extension for geospatial data
- Materialized views with automated refresh triggers
- 99.2% cache hit rate achieved with L4 (materialized view) caching

**Notable Gap:** No migration framework (Alembic/Flyway) - manual execution required
*See Finding F-0011 in 02_FINDINGS.md*

---

### Contracts

**Location:** `/home/user/Forecastin/contracts/`
**Tech Stack:** Auto-generated from Pydantic models via `/scripts/dev/generate_contracts.py`
**File Count:** 3 files (6,265 + 77,109 + 8,744 bytes)
**Stability:** Medium - Auto-generation reliable but incomplete type translation
**Coupling:** High - Single source of truth with automated drift detection

| File | Purpose | Generation Method | Validation |
|------|---------|-------------------|------------|
| `openapi.json` | REST API schema | FastAPI auto-generation | Swagger/OpenAPI spec |
| `ws.json` | WebSocket messages | Pydantic model export | JSON Schema Draft 7 |
| `contracts.generated.ts` | TypeScript types | Python→TypeScript converter | Contract drift CI check |

**Generation Workflow:**
1. Define Pydantic models in `api/models/websocket_schemas.py`
2. Run `scripts/dev/generate_contracts.py`
3. Auto-generate TypeScript types in `frontend/src/types/contracts.generated.ts`
4. CI validates consistency via `.github/workflows/contract-drift-check.yml`

**Known Issues:**
- Python `Literal` types become `any` in TypeScript (F-0005)
- Python `Tuple` types become `any | any` in TypeScript (F-0005)
- Missing utility function exports (F-0002)

*See 04_TARGET_ARCHITECTURE.md for improved contract generation strategy*

---

### Scripts

**Location:** `/home/user/Forecastin/scripts/`
**Tech Stack:** Python 3.11+, TypeScript, Bash
**Script Count:** 30+ automation scripts
**Stability:** High - Scripts for deployment, validation, monitoring
**Coupling:** Low - Self-contained with minimal dependencies

| Category | Scripts | Purpose | Fix Type |
|----------|---------|---------|----------|
| `dev/` | 3 | Contract generation, test message emission, WebSocket smoke test | Code-only |
| `deployment/` | 2 | Startup validation, LTREE refresh post-deployment | Requires runtime |
| `validation/` | 3 | Consistency checks, performance SLO validation | Code-only |
| `monitoring/` | 4 | Performance monitoring, infrastructure health, SLO validation | Requires runtime |
| `testing/` | 8 | Performance tests, load testing, API compatibility | Requires runtime |
| `feature_flags/` | 1 | Geospatial feature flag smoke test | Code-only |

**Notable Scripts:**
- `scripts/dev/generate_contracts.py` - Contract generation (critical for CI)
- `scripts/check_performance_slos.py` - Performance SLO validation
- `scripts/monitoring/infrastructure_health_monitor.py` - Health monitoring
- `scripts/testing/load_test_runner.py` - Load testing orchestration

**Security Issue:** Hardcoded database password in `scripts/testing/direct_performance_test.py:50` (F-0009)

---

### Documentation

**Location:** `/home/user/Forecastin/docs/`
**File Count:** 60+ markdown files (964KB total)
**Stability:** High - Comprehensive documentation maintained
**Coupling:** Low - Documentation separate from code

| Category | Files | Coverage | Status |
|----------|-------|----------|--------|
| Getting Started | 5 | Developer setup, quick start, troubleshooting | Complete |
| Architecture | 4 | Golden source, discovery, agents, geospatial | Complete |
| Features | 7 | RSS, WebSocket, ML A/B, scenarios, geospatial | Complete |
| Testing | 3 | Testing guide, browser testing, GitHub Actions | Complete |
| Deployment | 5 | Railway setup, geospatial deployment, LTREE | Complete |
| Operations | 6 | Performance, environment variables, WebSocket fixes | Complete |
| Migration Guides | 3 | Feature flag migration, naming standards | Complete |
| Reports | 10+ | Analysis reports, gap analysis, bug reports | Active |

**Key Documents:**
- `docs/GOLDEN_SOURCE.md` (39,191 bytes) - Core requirements
- `docs/DISCOVERY.md` (30,124 bytes) - System discovery
- `docs/RSS_INGESTION_SERVICE_ARCHITECTURE.md` (29,922 bytes) - RSS architecture
- `docs/TESTING_GUIDE.md` (20,195 bytes) - Testing strategy
- `docs/ENVIRONMENT_VARIABLES.md` (21,120 bytes) - Configuration reference

**Documentation Gap:** `docs/reports/` and `checks/` contain overlapping content - consolidation recommended

---

### CI/CD

**Location:** `.github/workflows/`
**Workflow Count:** 9 workflow files
**Stability:** High - Strict baseline with comprehensive checks
**Coupling:** Medium - Workflows depend on specific branch naming, toolchain versions

| Workflow | Purpose | Triggers | Jobs | Duration |
|----------|---------|----------|------|----------|
| `baseline-ci.yml` | Strict baseline | Push to main/develop/staging, PRs, claude/** | Lint, typecheck, unit tests, build | ~8 min |
| `fullstack-ci.yml` | Integration tests | Push to main, PRs | Backend + frontend with services | ~12 min |
| `backend.yml` | Backend-only | Push to api/, PRs | Backend tests | ~4 min |
| `frontend.yml` | Frontend-only | Push to frontend/, PRs | Frontend tests | ~3 min |
| `contract-drift-check.yml` | Contract validation | Push, PRs | TS↔Python contract comparison | ~2 min |
| `ws-smoke.yml` | WebSocket diagnostics | Manual, nightly | WebSocket connection, echo, health | ~5 min |
| `performance-validation.yml` | SLO checks | Manual, weekly | Throughput, latency, cache hit rate | ~10 min |
| `ci.yml` | Minimal CI | Push | Quick checks | ~2 min |
| `ci-cd-pipeline.yml` | Full pipeline | Push to main | Lint, test, build, deploy (6 jobs) | ~20 min |

**CI Philosophy** (baseline-ci.yml:9-13):
- Never lies: Fails hard on any error
- No `continue-on-error`
- Strict checks enabled
- Warnings treated as errors

**Known Issue:** CI pipeline does not install frontend dependencies before type checking (F-0012)

---

### Infrastructure

**Location:** Root-level Docker and orchestration
**Tech Stack:** Docker, Docker Compose, Makefile
**Service Count:** 7 services in docker-compose.yml
**Stability:** High - Production-ready stack
**Coupling:** Medium - Services share network and volumes

| Service | Image | Purpose | Ports | Health Check |
|---------|-------|---------|-------|--------------|
| `postgres` | postgres:13-alpine (PostGIS 3.1) | Database | 5432 | pg_isready |
| `redis` | redis:6-alpine | L2 cache | 6379 | redis-cli ping |
| `api` | Custom (Dockerfile) | FastAPI backend | 9000 | /health endpoint |
| `frontend` | nginx:alpine | React SPA | 3000 | curl localhost:80 |
| `prometheus` | prom/prometheus:latest | Metrics | 9090 | /-/healthy |
| `grafana` | grafana/grafana:latest | Dashboards | 3001 | /api/health |
| `alertmanager` | prom/alertmanager:latest | Alerts | 9093 | /-/healthy |

**Makefile Targets:**
- `make bootstrap` - Setup development environment
- `make check` - Run all checks (typecheck + tests)
- `make dev` - Start development servers
- `make build` - Build production Docker images
- `make contracts` - Generate contracts from Python models
- `make services-up/down` - Docker Compose management

**Volumes:**
- `postgres_data` - Database persistence
- `redis_data` - Cache persistence
- `prometheus_data` - Metrics persistence
- `grafana_data` - Dashboard persistence
- `logs` - Application logs

**Networks:**
- `forecastin_network` (bridge) - Inter-service communication

---

## Technology Matrix

| Area | Primary Tech | Secondary Tech | Configuration | Stability |
|------|-------------|----------------|---------------|-----------|
| Backend | Python 3.11 | FastAPI 0.104.1 | pyproject.toml | High |
| Frontend | React 18.2.0 | TypeScript 5.3.0 | tsconfig.json | Medium |
| Database | PostgreSQL 13 | LTREE, PostGIS | migrations/ | High |
| Caching | Redis 6 | hiredis | docker-compose.yml | High |
| Build (FE) | Vite 5.4.11 | Vitest 4.0.8 | vite.config.ts | High |
| Build (BE) | Uvicorn 0.24.0 | Docker | Dockerfile | High |
| State Mgmt | React Query 5.90.7 | Zustand 4.4.6 | N/A | High |
| Visualization | deck.gl 9.2.2 | maplibre-gl 4.7.1 | N/A | High |
| Testing (BE) | pytest 8.3.3 | pytest-asyncio 0.21.1 | pyproject.toml | High |
| Testing (FE) | Vitest 4.0.8 | Testing Library 14 | vitest.config.ts | Medium |
| CI/CD | GitHub Actions | Docker | .github/workflows/ | High |
| Monitoring | Prometheus | Grafana | monitoring/ | Medium |

---

## File Count Summary

| File Type | Count | Location | Purpose |
|-----------|-------|----------|---------|
| Python (.py) | 71 | api/, scripts/, tests/ | Backend logic, automation |
| TypeScript (.ts) | 49 | frontend/src/ | Frontend logic, types |
| TSX (.tsx) | 16 | frontend/src/components/ | React components |
| SQL (.sql) | 6 | migrations/ | Database schema |
| Markdown (.md) | 60+ | docs/, checks/, patches/ | Documentation |
| JSON | 30+ | contracts/, config/, package.json | Configuration, contracts |
| YAML | 15+ | .github/workflows/, docker-compose.yml | CI/CD, infrastructure |
| Dockerfile | 6 | api/, frontend/ | Container builds |

**Total Lines of Code (estimated):** ~95,000
**Documentation Size:** ~964KB (60+ files)
**Largest File:** `api/navigation_api/database/optimized_hierarchy_resolver.py` (58,629 bytes)

---

## Dependency Versions (Critical)

### Backend Python
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
psycopg[binary]==3.2.3
SQLAlchemy==2.0.44
asyncpg==0.29.0
redis==5.0.1
orjson==3.9.10
pydantic==2.6.0
pytest==8.3.3
```

### Frontend Node.js
```json
{
  "react": "^18.2.0",
  "typescript": "^5.3.0",
  "vite": "^5.4.11",
  "@tanstack/react-query": "^5.90.7",
  "zustand": "^4.4.6",
  "deck.gl": "^9.2.2",
  "tailwindcss": "^3.3.5",
  "vitest": "^4.0.8"
}
```

### Infrastructure
```yaml
postgres: 13-alpine (with PostGIS 3.1)
redis: 6-alpine
nginx: alpine
prometheus: latest
grafana: latest
```

---

## Notable Patterns

### 1. Contract-First Development
- **Pattern:** Pydantic models auto-generate TypeScript types
- **Files:** `api/models/websocket_schemas.py` → `contracts/contracts.generated.ts`
- **Validation:** `.github/workflows/contract-drift-check.yml`
- **Benefit:** Single source of truth, prevents API drift

### 2. Multi-Tier Caching (L1-L4)
- **L1:** Thread-safe LRU memory cache (10,000 entries)
- **L2:** Redis distributed cache with connection pooling
- **L3:** PostgreSQL buffer cache
- **L4:** Materialized views with automated refresh
- **Performance:** 99.2% cache hit rate, sub-millisecond responses
- **Implementation:** `api/services/cache_service.py` (48,563 bytes)

### 3. Hybrid State Management
- **Pattern:** React Query for server state + Zustand for client UI state
- **File:** `frontend/src/hooks/useHybridState.ts` (19,436 bytes)
- **Benefit:** Best tool for each job, unified interface

### 4. Feature Flag System
- **Backend:** Database-backed with percentage rollout
- **Frontend:** WebSocket real-time updates with local overrides
- **Integration:** 88% unused (9 flags defined, 1 used) - See F-0014
- **Files:** `api/services/feature_flag_service.py`, `frontend/src/hooks/useFeatureFlag.ts`

### 5. Plugin-Based Layer Registry
- **Pattern:** Dynamic geospatial layer registration with GPU filtering
- **Base:** `frontend/src/layers/base/BaseLayer.ts`
- **Registry:** `frontend/src/layers/registry/LayerRegistry.ts`
- **Implementations:** Point, Polygon, Linestring, GeoJSON layers

### 6. LTREE Hierarchical Queries
- **Pattern:** O(log n) hierarchy traversal with materialized views
- **Implementation:** `api/navigation_api/database/optimized_hierarchy_resolver.py` (58,629 bytes)
- **Performance:** 3.46ms (target: <10ms), 42,726 RPS

---

## Stability Assessment

| Component | Stability | Confidence | Evidence |
|-----------|-----------|------------|----------|
| Database schema | High | 0.95 | 6 migrations applied, 62+ indexes, stable for 6+ months |
| Backend API | High | 0.90 | 71 Python files, 20 test files, 70%+ coverage target |
| Frontend UI | Medium | 0.75 | 97 'any' types, 6 compilation errors (F-0002), active development |
| Contracts | Medium | 0.70 | Auto-generation reliable but incomplete type translation (F-0005) |
| CI/CD | High | 0.90 | 9 workflows, strict baseline, comprehensive checks |
| Infrastructure | High | 0.95 | Docker Compose stable, 7 services with health checks |
| Documentation | High | 0.85 | 60+ files, comprehensive coverage, some overlap |

---

## Coupling Analysis

### Tight Coupling (High Risk)
- **LTREE ↔ Hierarchical Navigation:** Changing database extension requires major refactor
- **Pydantic ↔ TypeScript Contracts:** Contract generator failure breaks build
- **React Query ↔ Backend API:** API changes require frontend cache invalidation logic

### Medium Coupling (Moderate Risk)
- **Services ↔ Database Manager:** 7 services share database connection pool
- **Frontend Components ↔ Feature Flags:** Components check flags but 88% unused
- **WebSocket Messages ↔ Handlers:** Message type changes require handler updates

### Loose Coupling (Low Risk)
- **UI Components ↔ Layer Registry:** Plugin-based, swappable implementations
- **Scripts ↔ Core Application:** Scripts are self-contained
- **Documentation ↔ Code:** Separate, no direct dependencies

---

## Security Posture

### Strengths
- No `dangerouslySetInnerHTML` found (XSS protection)
- 62+ database indexes for performance
- TypeScript strict mode enabled
- Pre-commit hooks for code quality
- Comprehensive test coverage (53 test files)

### Weaknesses
- **CRITICAL:** Hardcoded database password in `scripts/testing/direct_performance_test.py:50` (F-0009)
- **HIGH:** SQL injection risk with string formatting in `api/services/hierarchical_forecast_service.py:646-647` (F-0009)
- **MEDIUM:** Console-based error logging instead of structured logging service
- **MEDIUM:** No error monitoring service integration (Sentry/Rollbar)

---

## Performance Metrics

| Metric | Target | Actual | Status | Evidence |
|--------|--------|--------|--------|----------|
| Throughput | >40,000 RPS | 42,726 RPS | ✅ Pass | performance-validation.yml |
| Ancestor Resolution | <10ms | 3.46ms | ✅ Pass | optimized_hierarchy_resolver.py |
| Cache Hit Rate | >99% | 99.2% | ✅ Pass | cache_service.py |
| Materialized View Refresh | <1000ms | 850ms | ✅ Pass | 004_automated_materialized_view_refresh.sql |
| WebSocket Serialization | <1ms | 0.019ms | ✅ Pass | orjson performance |

---

## Next Steps

**For detailed findings, see:**
- `02_FINDINGS.md` - 118+ issues with citations and confidence scores
- `03_MISTAKES_AND_PATTERNS.md` - Recurring antipatterns and prevention strategies
- `04_TARGET_ARCHITECTURE.md` - Improved architecture proposals
- `05_REBUILD_PLAN.md` - Phased rebuild strategy with exit criteria

**Machine-readable inventory:** `01_INVENTORY.json`

---

**Inventory Complete**
**Total Components Catalogued:** 15 major areas, 300+ files, 95,000+ lines of code
**Evidence Citations:** All findings linked to specific file paths and line ranges
