# DISCOVERY.md - Forecastin Repository Baseline

**Generated:** 2025-11-07
**Repository:** Forecastin Geopolitical Intelligence Platform
**Branch:** claude/forecastin-discovery-baseline-011CUu2Hzx1f4SFqQ6QgZ4Wh

---

## 1. Frontend Inventory

### Package Management
- **Package Manager:** npm
- **Lock File:** package-lock.json (present, 866KB)
- **Node Version Target:** 18 (from CI workflows)

### Configuration Files

#### TypeScript Configuration
- **File:** `frontend/tsconfig.json`
- **Compiler Options:**
  - Target: ES5
  - Strict Mode: ✅ Enabled
  - `noImplicitOverride`: ✅ true
  - `exactOptionalPropertyTypes`: ✅ true
  - `noUncheckedIndexedAccess`: ✅ true
  - `noImplicitReturns`: ✅ true
  - `forceConsistentCasingInFileNames`: ✅ true
  - `noFallthroughCasesInSwitch`: ✅ true
  - Module: esnext, Resolution: node
  - JSX: react-jsx
- **Excludes:** Test files (`src/tests/**/*`, `src/**/*.test.ts`, `src/**/*.test.tsx`)

#### ESLint Configuration
- **File:** `frontend/.eslintrc.js`
- **Extends:**
  - eslint:recommended
  - plugin:@typescript-eslint/recommended
  - plugin:react/recommended
  - plugin:react-hooks/recommended
  - plugin:jsx-a11y/recommended
- **Parser:** @typescript-eslint/parser
- **Key Rules:**
  - `@typescript-eslint/no-explicit-any`: warn
  - `@typescript-eslint/consistent-type-imports`: warn (prefer type-imports)
  - `react-hooks/rules-of-hooks`: error
  - `react-hooks/exhaustive-deps`: warn
  - `no-console`: warn (allow warn/error)
- **Ignored:** build/, dist/, node_modules/, *.config.js, *.config.ts, coverage/, .eslintrc.js

#### Prettier Configuration
- **File:** `frontend/.prettierrc`
- **Settings:**
  - Semi: true
  - TrailingComma: es5
  - SingleQuote: true
  - PrintWidth: 100
  - TabWidth: 2
  - UseTabs: false
  - ArrowParens: always
  - EndOfLine: lf
  - BracketSpacing: true

#### Test Configuration (Vitest)
- **File:** `frontend/vitest.config.ts`
- **Framework:** Vitest with React plugin
- **Environment:** jsdom
- **Setup Files:** [] (empty)
- **Include Patterns:**
  - tests/**/*.test.ts
  - tests/**/*.test.tsx
  - tests/**/*.spec.ts
  - src/**/*.test.ts
  - src/**/*.test.tsx
- **Coverage:**
  - Provider: v8
  - Reporters: text, json, html
  - Excludes: node_modules/, tests/, **/*.d.ts, **/*.config.*, **/mockData, build/
- **Path Alias:** `@` → `./src`

### NPM Scripts (from package.json)
```json
{
  "start": "react-scripts start",
  "build": "react-scripts build",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "contracts:check": "tsx ../scripts/verify_contract_drift.ts",
  "ff:check": "tsx ../scripts/feature_flags/smoke_geo.ts",
  "eject": "react-scripts eject"
}
```

**MISSING SCRIPTS:**
- ❌ No `typecheck` script (tsc --noEmit)
- ❌ No `lint` script
- ❌ No `format` script (prettier)
- ❌ No `gen:api` or codegen scripts

### Dependencies (package.json v0.1.0)

#### Production Dependencies
- **React Ecosystem:** react@^18.2.0, react-dom@^18.2.0, react-router-dom@^6.17.0
- **State Management:** zustand@^4.4.6, @tanstack/react-query@^5.8.4
- **Geospatial:**
  - react-map-gl@^7.1.7
  - deck.gl@^8.9.35
  - @deck.gl/core@^8.9.35
  - @deck.gl/layers@^8.9.35
  - @deck.gl/geo-layers@^8.9.35
  - h3-js@^4.1.0
- **Styling:** tailwindcss@^3.3.5, autoprefixer@^10.4.16, postcss@^8.4.31, clsx@^2.0.0, class-variance-authority@^0.7.0
- **UI Components:** lucide-react@^0.292.0, react-hot-toast@^2.6.0
- **Validation:** zod@^3.22.4
- **Utilities:** react-use@^17.4.0, web-vitals@^2.1.4
- **TypeScript:** typescript@^4.9.5

#### Dev Dependencies
- **Testing:** vitest@^1.1.0, @testing-library/react@^14.0.0, @testing-library/user-event@^14.5.1, jsdom@^23.0.1, msw@^2.0.11
- **Build Tools:** react-scripts@5.0.1, @vitejs/plugin-react@^4.2.1
- **Execution:** tsx@^4.7.0

**NOTES:**
- ⚠️ No Playwright or Cypress for E2E testing
- ⚠️ No Storybook configuration detected
- ⚠️ No Jest configuration (migrated to Vitest)
- ✅ MSW (Mock Service Worker) present for API mocking
- ⚠️ TypeScript v4.9.5 (not latest, but compatible)

### Mock Service Worker (MSW) Setup
- **Location:** `frontend/mocks/`
- **Structure:**
  - `frontend/mocks/rss/` - RSS feed mocks (4 files: ukraine_conflict, china_trade, middle_east_tensions, climate_summit)
  - `frontend/mocks/ws/` - WebSocket message mocks (8+ files including layer_data_update, polygon_update, geometry_batch_update, heartbeat)
- **Status:** ✅ Present with fixture data

### Validation & Schemas
- **Zod Validators:** `frontend/src/types/zod/`
  - `entities.ts` (5.7KB)
  - `messages.ts.deprecated` (7KB, deprecated)
- **Contract Files:**
  - `/types/ws_messages.ts` - Re-exports from frontend unified schema
  - `/types/contracts.generated.ts` - Generated contracts
  - Unified Source: `frontend/src/types/ws_messages.ts` (SINGLE SOURCE OF TRUTH)

### Pre-commit Hooks (Frontend-specific)
From `.pre-commit-config.yaml`:
- **ESLint:** Fix on commit for .ts, .tsx, .js, .jsx files
- **Prettier:** Format on commit for .ts, .tsx, .js, .jsx, .json, .css, .md files
- **TypeScript Type Checking:** Disabled (commented out - "better done in CI/CD pipeline")

### Frontend Test Structure
```
frontend/tests/
├── contracts/
│   └── contract_drift.spec.ts
├── reactQueryKeys.test.ts (14KB)
└── realtimeHandlers.test.ts (13KB)

frontend/src/layers/tests/
├── GeospatialIntegrationTests.test.ts
└── types/layer-types.test.ts
```

**Test Count:** 5 test files discovered

### Frontend Directory Structure
```
frontend/src/
├── App.tsx
├── components/ (UI, Entity, Search, MillerColumns, Outcomes, Map, Navigation)
├── config/
├── errors/
├── handlers/
├── hooks/
├── integrations/
├── layers/ (base, implementations, registry, types, utils, tests)
├── store/
├── tests/
├── types/ (zod)
└── utils/
```

---

## 2. Backend Inventory

### Package Management
- **Build System:** setuptools (PEP 517 compliant)
- **Build Backend:** setuptools.build_meta
- **Python Version:** >=3.11 (target: 3.11, CI uses 3.9)

### Configuration Files

#### pyproject.toml
- **Location:** `/pyproject.toml`
- **Project:** forecastin v0.1.0
- **Description:** Forecastin Geopolitical Intelligence Platform
- **License:** MIT

#### Black Configuration
- **Line Length:** 88
- **Target Version:** py311
- **Exclude:** .eggs, .git, .hg, .mypy_cache, .tox, .venv, build, dist, migrations, node_modules

#### isort Configuration
- **Profile:** black
- **Line Length:** 88
- **Known First Party:** api, navigation_api, services
- **Skip:** */migrations/*, */node_modules/*

#### Pytest Configuration
- **Test Paths:** api/tests, tests
- **Python Files:** test_*.py, *_test.py
- **Python Classes:** Test*
- **Python Functions:** test_*
- **Asyncio Mode:** auto
- **Markers:**
  - slow: marks tests as slow
  - integration: integration tests
  - unit: unit tests
  - performance: performance benchmarks
  - websocket: tests requiring websocket connections
- **Coverage:**
  - Source: api
  - Omit: */tests/*, */migrations/*, */venv/*, */node_modules/*, */frontend/*
  - Branch: true
  - Parallel: true
  - Fail Under: 70.0%
- **Filter Warnings:** Error by default, ignore DeprecationWarning and PendingDeprecationWarning
- **Add Options:**
  ```
  -v, --strict-markers, --strict-config, --tb=short,
  --cov=api, --cov-report=term-missing, --cov-report=xml, --cov-report=html
  ```

#### Mypy Configuration
- **Python Version:** 3.11
- **Flags:**
  - warn_return_any: true
  - warn_unused_configs: true
  - disallow_untyped_defs: false (relaxed)
  - disallow_incomplete_defs: true
  - check_untyped_defs: true
  - no_implicit_optional: true
  - warn_redundant_casts: true
  - warn_unused_ignores: true
  - warn_no_return: true
  - warn_unreachable: true
  - strict_equality: true
  - show_error_codes: true
  - show_column_numbers: true
  - ignore_missing_imports: true
- **Overrides:** Tests have relaxed disallow_untyped_defs

#### Bandit Configuration
- **Exclude:** /tests/, /test_*.py, *_test.py, /migrations/, /venv/, /node_modules/
- **Skips:** B101 (assert_used), B601 (paramiko_calls)

#### Flake8 Configuration
- **Max Line Length:** 88
- **Extend Ignore:** E203, E266, E501, W503
- **Max Complexity:** 10
- **Per-file Ignores:**
  - __init__.py: F401
  - tests/*: F401, F811

#### Pylint Configuration
- **Max Line Length:** 88
- **Disabled:**
  - C0111: missing-docstring
  - C0103: invalid-name
  - R0903: too-few-public-methods
  - R0913: too-many-arguments

#### Pydocstyle Configuration
- **Convention:** google
- **Ignore:** D100, D104
- **Match:** (?!test_).*\.py
- **Match Dir:** Exclude tests, migrations, venv, node_modules

### Python Dependencies

#### Core Requirements (requirements.txt)
**FastAPI & ASGI:**
- fastapi==0.104.1
- uvicorn[standard]==0.24.0

**Database:**
- psycopg[binary]==3.1.18
- psycopg2-binary==2.9.9
- SQLAlchemy==2.0.23
- asyncpg==0.29.0

**Serialization:**
- orjson==3.9.10 (CRITICAL for WebSocket)
- ujson==5.9.0

**Caching & Redis:**
- redis==5.0.1
- hiredis==2.2.3

**HTTP & WebSocket:**
- httpx==0.25.2
- aiohttp==3.9.1
- websockets==12.0

**Configuration:**
- pydantic==2.6.0
- pydantic-settings==2.1.0
- python-dotenv==1.0.0

**File & Date/Time:**
- aiofiles==23.2.1
- python-dateutil==2.8.2

**Logging & Monitoring:**
- structlog==23.2.0
- prometheus-client==0.14.1

**Testing (in main requirements):**
- pytest==7.4.3
- pytest-asyncio==0.21.1
- pytest-cov==4.1.0
- pytest-benchmark==4.0.0

**Code Quality:**
- black==23.12.1
- isort==5.13.2
- flake8==7.0.0
- mypy==1.7.1
- types-redis==4.6.0.11

**Security:**
- bandit==1.7.5
- safety==3.7.0
- semgrep==1.45.0

**Pre-commit:**
- pre-commit==3.6.0

**Performance:**
- locust==2.20.0
- memory-profiler==0.61.0
- psutil==5.9.6

**Geospatial:**
- shapely==2.0.2

**NOTES:**
- Prophet, pandas, numpy, pyarrow are optional (not included due to build dependencies)
- Dev dependencies duplicated in requirements-dev.txt with safety@2.3.5 (main has 3.7.0 - version mismatch)

#### Dev Requirements (requirements-dev.txt)
Duplicates from main requirements.txt:
- Testing: pytest, pytest-asyncio, pytest-cov, pytest-benchmark
- Code Quality: black, isort, flake8, mypy, types-redis
- Security: bandit@1.7.5, safety@2.3.5 ⚠️, semgrep
- Pre-commit: pre-commit
- Performance: locust, memory-profiler, psutil

**ISSUE:** ⚠️ safety version mismatch (requirements.txt: 3.7.0, requirements-dev.txt: 2.3.5)

### Backend Test Structure
```
api/tests/
├── __init__.py
├── conftest.py (1.5KB - pytest setup with Python path)
├── test_connection_manager.py (928B)
├── test_hierarchical_forecast_service.py (17.8KB)
├── test_ltree_refresh.py (9.6KB)
├── test_performance.py (18.6KB)
├── test_rss_performance_slos.py (10.3KB)
├── test_scenario_api.py (19.2KB)
├── test_scenario_service.py (20.3KB)
├── test_scenario_validation.py (14.1KB)
├── test_ws_echo.py (9.9KB)
└── test_ws_health.py (13.7KB)

tests/ (root level)
├── fixtures/
├── integration/
├── load/
├── performance/
└── test_db_performance.py (1.7KB)
```

**Test Count:** 12 test files in api/tests + 1 in root tests/

### Backend Directory Structure
```
api/
├── main.py (81.8KB - main FastAPI application)
├── conftest.py (313B - pytest Python path setup)
├── navigation_api/
├── services/
├── tests/
├── validate_performance_slos.py (5.1KB executable)
├── requirements.txt
├── requirements-dev.txt
├── Dockerfile (3 variants: standard, .full, .railway)
└── DOCKERFILE_OPTIMIZATION.md, RAILWAY_BUILD_FIX.md, REQUIREMENTS_README.md
```

### Pre-commit Hooks (Backend-specific)
From `.pre-commit-config.yaml`:
- **Black:** Format Python code (line-length=88, target-version=py311)
- **isort:** Sort imports (profile=black, line-length=88)
- **Flake8:** Lint Python (max-line-length=88, extend-ignore=E203,W503)
- **Mypy:** Type check Python (--ignore-missing-imports, --strict-optional)
- **Bandit:** Security lint Python (-c pyproject.toml)
- **Safety:** Dependency security check (python-safety-dependencies-check)
- **Pydocstyle:** Docstring formatting (convention=google)

---

## 3. Contracts and Schemas

### WebSocket Message Types
- **Location:** `/types/ws_messages.ts`
- **Source of Truth:** `frontend/src/types/ws_messages.ts`
- **Generated Contracts:** `/types/contracts.generated.ts`
- **Message Types:** (to be extracted in Phase 1)
  - layer_data_update
  - gpu_filter_sync
  - polygon_update
  - geometry_batch_update
  - heartbeat
- **Status:** ✅ Discriminated unions expected based on mock filenames

### Request/Response DTOs
- **Frontend Validators:** Zod schemas in `frontend/src/types/zod/entities.ts`
- **Backend Models:** Pydantic models (locations to be discovered in Phase 1)

### OpenAPI Schema
- **Status:** ❌ NOT FOUND
- **Searched:** openapi.json, openapi.yaml
- **Generator:** `scripts/dev/generate_contracts.py` exists
- **CI Check:** Workflow ci.yml line 406-418 validates contract drift

### PostGIS/LTREE Type Mirrors
- **LTREE:** Materialised views for O(log n) performance (documented in GOLDEN_SOURCE.md)
- **PostGIS:** shapely@2.0.2 for Python geospatial operations
- **Status:** To be discovered in Phase 1 static analysis

### Feature Flag Keys
- **Script:** `scripts/feature_flags/smoke_geo.ts`
- **NPM Script:** `npm run ff:check`
- **Naming Convention:** `ff.geo.*` (from GOLDEN_SOURCE.md)
- **Service:** FeatureFlagService with multi-tier caching (mentioned in GOLDEN_SOURCE.md)
- **Status:** ✅ IMPLEMENTED (per GOLDEN_SOURCE.md)

---

## 4. CI/CD

### Workflow Files
```
.github/workflows/
├── ci.yml (14.8KB - comprehensive CI/CD pipeline)
├── ci-cd-pipeline.yml (13.4KB - alternate/legacy?)
├── performance-validation.yml (26KB - SLO monitoring)
└── ws-smoke.yml (8.8KB - WebSocket smoke tests)
```

### CI Workflow (ci.yml) - PRIMARY WORKFLOW

**Triggers:**
- Push: main, develop branches
- Pull Request: main branch

**Environment Variables:**
- PYTHON_VERSION: "3.9" ⚠️ (pyproject.toml specifies >=3.11)
- NODE_VERSION: "18"

**Jobs:**

1. **backend-test**
   - Services: PostgreSQL (postgis/postgis:13-3.1), Redis (redis:6-alpine)
   - Steps:
     - Setup Python 3.9, Node 18
     - Cache Python dependencies (key: pip-api/requirements.txt)
     - Install: pip, requirements.txt, pytest-cov, black, isort, flake8, bandit, safety
     - Install frontend npm dependencies (npm ci)
     - Run linting: black --check, isort --check-only, flake8 (max-line-length=120), bandit
     - Run tests with coverage: pytest --cov=. --cov-report=xml --cov-report=html
     - Security: safety check, bandit -r . -ll
     - Upload coverage to codecov (flags: backend)

2. **frontend-test**
   - Steps:
     - Setup Node 18 with npm cache
     - Install: npm ci
     - Linting: eslint (json output to eslint-report.json), tsc --noEmit
     - Tests: npm test
     - Contract drift check: npm test -- contract_drift.spec.ts (continue-on-error: true)
     - Upload coverage to codecov (flags: frontend, file: coverage/lcov.info)

3. **db-migration-test**
   - Services: PostgreSQL (postgis/postgis:13-3.1)
   - Steps:
     - Test extensions: ltree, postgis
     - Performance validation: python scripts/performance_test.py

4. **docker-build**
   - Needs: backend-test, frontend-test
   - Steps:
     - Build backend & frontend Docker images (exit 0 - non-blocking)
     - Trivy vulnerability scanner (SARIF output)
     - Upload SARIF to GitHub CodeQL

5. **compliance-check**
   - Needs: backend-test, frontend-test
   - If: always()
   - Steps:
     - Run compliance evidence collection: gather_metrics.py, check_consistency.py, generate_compliance_report.py
     - Upload compliance-evidence artifact (if-no-files-found: ignore)

6. **performance-test**
   - Needs: docker-build
   - If: always()
   - Steps:
     - Mock performance tests (echo statements only)
     - Upload performance-results artifact

7. **deploy-staging**
   - Needs: compliance-check, performance-test
   - If: github.ref == 'refs/heads/main'
   - Steps: Mock deployment

8. **security-scan**
   - Steps:
     - npm audit --audit-level=moderate
     - safety check --json
     - python scripts/check_licenses.py

9. **docs-consistency**
   - Steps:
     - check_consistency.py, validate_docs_consistency.py (continue-on-error: true)
     - Contract generation validation: generate_contracts.py, git diff --exit-code types/contracts.generated.ts

10. **feature-flags-test**
    - Steps:
      - test_feature_flags.py
      - test_rollback_mechanisms.py

11. **cache-integration-test**
    - Services: Redis
    - Steps:
      - test_cache_tiers.py
      - test_cache_invalidation.py

12. **all-tests-pass**
    - Needs: all above jobs
    - If: always()
    - Steps: Summary with pass/fail counts, exit 1 if critical jobs failed

### CI-CD-Pipeline Workflow (ci-cd-pipeline.yml)
**Status:** Appears to be alternate/legacy version of ci.yml (13.4KB vs 14.8KB)

### Performance Validation Workflow (performance-validation.yml)
**Size:** 26KB
**Purpose:** SLO monitoring and validation
**Status:** ⚠️ GOLDEN_SOURCE.md reports SLO regression (Ancestor Resolution 3.46ms vs target <10ms but marked as FAILED)

### WebSocket Smoke Tests (ws-smoke.yml)
**Size:** 8.8KB
**Purpose:** WebSocket connection and message validation

### Caching Strategy
- **Python:** `~/.cache/pip` keyed on `api/requirements.txt`
- **Node:** npm cache keyed on `frontend/package-lock.json`

### Required Checks
Based on all-tests-pass job dependencies:
- backend-test (critical)
- frontend-test (critical)
- db-migration-test
- docker-build
- compliance-check
- security-scan
- docs-consistency

### Code Coverage
- **Backend:** codecov upload with xml/html reports, flags: backend
- **Frontend:** codecov upload from coverage/lcov.info, flags: frontend
- **Target:** pyproject.toml specifies fail_under: 70.0%

### Artifact Uploads
- Compliance evidence (deliverables/compliance/evidence/)
- Performance results (performance-reports/)
- Bandit JSON report (api/bandit-report.json)
- ESLint JSON report (frontend/eslint-report.json)
- Trivy SARIF reports

---

## 5. Docs and "Golden Source"

### GOLDEN_SOURCE.md
- **Location:** `/docs/GOLDEN_SOURCE.md`
- **Status:** Active
- **Last Updated:** 2025-11-07T07:30:00Z
- **Language:** British English (en-GB)
- **Units:** kilometres, metric system

**Key Sections:**
1. Project Snapshot - Core vision, business outcomes, technical architecture
2. Phase Index - 10-phase structure (Phases 0-7 completed, 8-10 in progress)
3. Performance SLOs - Current status with targets vs actuals

**Performance SLO Status:**
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Ancestor Resolution | <10ms | 3.46ms (P95: 5.20ms) | ❌ FAILED |
| Descendant Retrieval | <50ms | 1.25ms (P99: 17.29ms) | ✅ PASSED |
| Throughput | >10,000 RPS | 42,726 RPS | ✅ PASSED |
| Cache Hit Rate | >90% | 99.2%| ✅ PASSED |
| Geospatial Render | <10ms | 1.25ms (P95: 1.87ms) | ✅ PASSED |
| GPU Filter | <100ms | 65ms (10k points) | ✅ PASSED |

**Key Features Documented:**
- ✅ Feature Flags: FeatureFlagService with multi-tier caching
- ✅ Geospatial System: BaseLayer architecture with LayerRegistry, PointLayer, GPU filtering
- ✅ CI/CD Pipeline: Fully implemented with performance validation
- ✅ TypeScript Status: Layer infrastructure compliant, 103 errors fixed, 55 component errors remain
- ⚠️ Performance Monitoring: SLO regression detected

### Other Documentation
```
/docs/
└── GOLDEN_SOURCE.md

/api/
├── DOCKERFILE_OPTIMIZATION.md (8.3KB)
├── RAILWAY_BUILD_FIX.md (7.2KB)
└── REQUIREMENTS_README.md (1.2KB)

/frontend/
├── DOCKERFILE_OPTIMIZATION.md (11.5KB)
└── docs/ (subdirectory)

/root
├── CHANGELOG.md (10.6KB)
├── CODE_QUALITY_REVIEW.md (21.8KB)
├── CONTRIBUTING.md (10.9KB)
├── EXECUTE_MIGRATION_NOW.md (7.7KB)
├── README.md (16.7KB)
├── RSS_INTEGRATION_SUMMARY.md (9.7KB)
└── SECURITY.md (10.2KB)
```

### Existing Reports
```
/checks/
└── DAY_1-2_SUMMARY.md (8.7KB)

/root
├── quick_wins.json (23.5KB - exists from previous run)
└── tasks.json (6.9KB)
```

---

## 6. Test Layout

### Frontend Tests
**Location:** `frontend/tests/` and `frontend/src/layers/tests/`

**Structure:**
```
frontend/tests/
├── contracts/
│   └── contract_drift.spec.ts (Zod validator for WS messages)
├── reactQueryKeys.test.ts (14KB - query key tuple validation)
└── realtimeHandlers.test.ts (13KB - WebSocket handler idempotency)

frontend/src/layers/tests/
├── GeospatialIntegrationTests.test.ts (layer integration)
└── types/layer-types.test.ts (type validation)
```

**Test Count:** 5 test files

**Coverage Tooling:**
- **Runner:** Vitest v1.1.0
- **Environment:** jsdom
- **Coverage Provider:** v8
- **Reports:** text, json, html
- **Excludes:** node_modules/, tests/, **/*.d.ts, **/*.config.*, **/mockData, build/

**Factories/Fixtures:**
- **Location:** `frontend/mocks/`
- **RSS Mocks:** 4 JSON files (ukraine_conflict, china_trade, middle_east_tensions, climate_summit)
- **WebSocket Mocks:** 8+ JSON files (layer_data_update, polygon_update, geometry_batch_update, heartbeat, duplicate_message, out_of_order_sequence, etc.)

**Snapshot Tests:** Not detected (no .snap files found)

**Known Flaky Markers:** None detected in vitest.config.ts

### Backend Tests
**Location:** `api/tests/` and `tests/` (root)

**Structure:**
```
api/tests/
├── conftest.py (pytest config with Python path setup)
├── test_connection_manager.py (WebSocket connection pooling)
├── test_hierarchical_forecast_service.py (17.8KB - LTREE hierarchy)
├── test_ltree_refresh.py (9.6KB - materialized view refresh)
├── test_performance.py (18.6KB - SLO validation)
├── test_rss_performance_slos.py (10.3KB - RSS ingestion performance)
├── test_scenario_api.py (19.2KB - scenario API endpoints)
├── test_scenario_service.py (20.3KB - scenario business logic)
├── test_scenario_validation.py (14.1KB - scenario validation rules)
├── test_ws_echo.py (9.9KB - WebSocket echo test)
└── test_ws_health.py (13.7KB - WebSocket health checks)

tests/ (root)
├── fixtures/ (shared fixtures)
├── integration/ (integration tests)
├── load/ (load testing)
├── performance/ (performance benchmarks)
└── test_db_performance.py (1.7KB)
```

**Test Count:** 12 test files

**Coverage Tooling:**
- **Runner:** pytest 7.4.3
- **Async Support:** pytest-asyncio 0.21.1 (asyncio_mode: auto)
- **Coverage:** pytest-cov 4.1.0
  - Source: api
  - Omit: */tests/*, */migrations/*, */venv/*, */node_modules/*, */frontend/*
  - Branch: true, Parallel: true
  - Fail Under: 70.0%
  - Reports: term-missing, xml (coverage.xml), html (htmlcov/)
- **Benchmarking:** pytest-benchmark 4.0.0

**Markers:**
- slow: marks tests as slow (deselect with '-m "not slow"')
- integration: marks tests as integration tests
- unit: marks tests as unit tests
- performance: marks tests as performance benchmarks
- websocket: marks tests that require websocket connections

**Factories/Fixtures:**
- **Location:** `tests/fixtures/` (shared)
- **WebSocket Fixtures:** `frontend/mocks/ws/` (JSON messages)
- **conftest.py:** Python path setup in api/conftest.py and api/tests/conftest.py

**Snapshot Tests:** Not detected

**Known Flaky Markers:** None detected in pyproject.toml

---

## 7. Scripts and Automation

### Scripts Directory Structure
```
scripts/
├── check_consistency.py (5KB)
├── check_licenses.py (769B)
├── compliance_evidence_collector.py (30.4KB)
├── connection_recovery.py (15.6KB)
├── deployment/ (subdirectory)
├── dev/
│   ├── emit_test_messages.py
│   ├── generate_contracts.py
│   └── ws_smoke.sh
├── feature_flags/
│   └── smoke_geo.ts
├── generate_compliance_report.py (7KB)
├── golden_source_updater.py (14.9KB)
├── migrate_feature_flags.sh (6.4KB)
├── monitoring/
│   ├── gather_metrics.py
│   ├── infrastructure_health_monitor.py
│   ├── performance_monitor.py
│   ├── performance_monitor_enhanced.py
│   └── slo_validation.py
├── test_cache_invalidation.py (768B)
├── test_cache_tiers.py (833B)
├── test_feature_flags.py (647B)
├── test_pipeline.py (23.4KB)
├── test_rollback_mechanisms.py (691B)
├── testing/
│   ├── api_compatibility_test.py
│   ├── db_performance_test.py
│   ├── docker_startup_test.py
│   ├── load_performance_data.py
│   ├── load_test_runner.py
│   ├── performance_test.py
│   ├── test_automated_refresh.py
│   ├── test_automated_refresh_fixed.py
│   ├── test_refresh_endpoint.py
│   ├── test_websocket_connection.py
│   └── websocket_connectivity_test.py
├── user_feedback_collector.py (22.4KB)
├── validate_docs_consistency.py (1.6KB)
├── validation/ (subdirectory)
└── verify_contract_drift.ts (6.3KB)
```

### Executable Scripts Referenced in CI
- ✅ `scripts/gather_metrics.py` (monitoring/gather_metrics.py)
- ✅ `scripts/validation/check_consistency.py` (scripts/check_consistency.py)
- ✅ `scripts/generate_compliance_report.py`
- ✅ `scripts/performance_test.py` (testing/performance_test.py)
- ✅ `scripts/check_licenses.py`
- ✅ `scripts/validate_docs_consistency.py`
- ✅ `scripts/dev/generate_contracts.py`
- ✅ `scripts/test_feature_flags.py`
- ✅ `scripts/test_rollback_mechanisms.py`
- ✅ `scripts/test_cache_tiers.py`
- ✅ `scripts/test_cache_invalidation.py`

### NPM-Accessible Scripts
- ✅ `tsx ../scripts/verify_contract_drift.ts` (npm run contracts:check)
- ✅ `tsx ../scripts/feature_flags/smoke_geo.ts` (npm run ff:check)

---

## 8. Identified Gaps and Issues

### Frontend Gaps
1. ❌ **No `typecheck` script** - Should be `tsc --noEmit`
2. ❌ **No `lint` script** - Should be `eslint src --ext .ts,.tsx`
3. ❌ **No `format` script** - Should be `prettier --write .`
4. ⚠️ **TypeScript version** - v4.9.5 (not latest, but compatible)
5. ❌ **No E2E testing** - No Playwright or Cypress
6. ❌ **No Storybook** - Component documentation missing
7. ❌ **No codegen script** - No `gen:api` for OpenAPI client generation

### Backend Gaps
1. ⚠️ **Python version mismatch** - CI uses 3.9, pyproject.toml specifies >=3.11
2. ⚠️ **Safety version conflict** - requirements.txt: 3.7.0, requirements-dev.txt: 2.3.5
3. ❌ **No ruff configuration** - Using flake8 instead (ruff is faster)
4. ❌ **No mypy.ini** - Configuration only in pyproject.toml
5. ❌ **No pytest.ini** - Configuration only in pyproject.toml
6. ❌ **No tox/nox** - No multi-environment testing

### Contract & Schema Gaps
1. ❌ **No OpenAPI schema** - openapi.json/openapi.yaml not found
2. ⚠️ **Contract drift validation** - Exists but continue-on-error in CI
3. ❌ **No JSON schema files** - Only TypeScript/Zod validators

### CI/CD Gaps
1. ⚠️ **Python version mismatch** - CI: 3.9, repo: >=3.11
2. ⚠️ **Performance regression** - Ancestor Resolution marked as FAILED (3.46ms vs <10ms target, but actually passing)
3. ⚠️ **Mock tests** - Some CI jobs use echo statements instead of real tests
4. ⚠️ **Duplicate workflows** - ci.yml and ci-cd-pipeline.yml appear similar

### Documentation Gaps
1. ⚠️ **Inconsistent docs** - Some checks use continue-on-error: true
2. ❌ **No CI.md** - No local execution guide for CI commands
3. ❌ **No dependency graph docs** - Circular dependencies not documented

### Testing Gaps
1. ❌ **Limited WebSocket tests** - Only 2 WS test files (echo, health)
2. ❌ **No contract validators in tests** - Tests don't validate against schemas
3. ❌ **No geometry processor tests** - Polygon/Linestring processors untested at unit level
4. ❌ **No scenario validation tests** - Only 1 scenario validation test file
5. ⚠️ **Test coverage** - Target is 70%, actual coverage unknown

---

## 9. Summary Statistics

### Repository Structure
- **Total Frontend Test Files:** 5
- **Total Backend Test Files:** 12
- **Total Scripts:** 30+ executable scripts
- **CI Workflows:** 4
- **Documentation Files:** 10+ markdown files
- **Mock Fixtures:** 12+ JSON files (RSS + WebSocket)

### Configuration Files
- **Frontend:** 4 (tsconfig.json, .eslintrc.js, .prettierrc, vitest.config.ts)
- **Backend:** 1 (pyproject.toml with 11 tool sections)
- **Shared:** 1 (.pre-commit-config.yaml with 12 hooks)

### Dependencies
- **Frontend Production:** 25 packages
- **Frontend Dev:** 9 packages
- **Backend:** 50+ packages (combined requirements.txt + requirements-dev.txt)

### Code Quality Tools
- **Linters:** ESLint (frontend), Flake8 (backend), Pylint (backend)
- **Formatters:** Prettier (frontend), Black (backend)
- **Type Checkers:** TypeScript (frontend), Mypy (backend)
- **Security:** Bandit, Safety, Semgrep
- **Import Sorters:** isort (backend)

### Test Frameworks
- **Frontend:** Vitest + React Testing Library + MSW
- **Backend:** Pytest + pytest-asyncio + pytest-cov + pytest-benchmark

---

## 10. Next Steps (Phase 1)

Based on this discovery, the next phase should focus on:

1. **Run all existing scripts** and capture outputs to REPORT.md
2. **Generate dependency graphs** using TypeScript project references or depcruise
3. **Identify dead code** using ts-prune or static analysis
4. **Find circular dependencies** in both frontend and backend
5. **Complexity analysis** - files >500 lines, functions >80 LOC
6. **API ↔ UI drift analysis** - compare backend FastAPI endpoints with frontend API clients
7. **Query key audit** - validate React Query keys are tuples with `as const`
8. **Feature flag mapping** - extract all `ff.geo.*` usage
9. **Generate quick_wins.json** with actionable items
10. **Generate checks/bug_report.md** with top 25 defects

---

**END OF DISCOVERY.md**
