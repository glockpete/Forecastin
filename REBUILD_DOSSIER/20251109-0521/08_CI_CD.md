# 08 CI/CD Pipeline Design

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** CI/CD pipeline design for rebuild
**Evidence:** Current workflows in `.github/workflows/`

---

## Current State

**PATH:** `/home/user/Forecastin/.github/workflows/`

**Existing Workflows:** 9 workflows detected in inventory
**Issues:**
- No contract validation in CI
- No automated migration testing
- Limited integration testing
- No performance regression detection

---

## Target CI/CD Architecture

```mermaid
graph LR
    PR[Pull Request] --> Lint[Lint & Format]
    Lint --> Unit[Unit Tests]
    Unit --> Contract[Contract Tests]
    Contract --> Integration[Integration Tests]
    Integration --> E2E[E2E Tests]
    E2E --> Perf[Performance Tests]
    Perf --> Build[Build]
    Build --> Deploy[Deploy to Staging]
    Deploy --> Smoke[Smoke Tests]
    Smoke --> Promote[Promote to Production]
```

---

## Pipeline Stages

### Stage 1: Code Quality (2 minutes)

**File:** `.github/workflows/code-quality.yml`

```yaml
name: Code Quality

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  lint-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install ruff mypy

      - name: Ruff lint
        run: ruff check api/ --output-format=github

      - name: Ruff format check
        run: ruff format --check api/

      - name: MyPy type check
        run: mypy api/ --strict

  lint-typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: ESLint
        working-directory: frontend
        run: npm run lint

      - name: TypeScript type check
        working-directory: frontend
        run: npm run type-check

      - name: Prettier format check
        working-directory: frontend
        run: npm run format:check

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Gitleaks scan
        uses: gitleaks/gitleaks-action@v2
        # F-0002: Must detect hardcoded passwords

      - name: Dependency vulnerability scan
        run: |
          pip install safety
          safety check --json
```

**Exit Criteria:**
- Zero lint errors
- Zero type errors
- Zero security vulnerabilities
- Zero hardcoded secrets (F-0002)

---

### Stage 2: Unit Tests (5 minutes)

**File:** `.github/workflows/unit-tests.yml`

```yaml
name: Unit Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio

      - name: Run unit tests
        run: |
          pytest api/tests/unit/ \
            --cov=api \
            --cov-report=xml \
            --cov-report=term-missing \
            --cov-fail-under=80

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage.xml
          flags: backend

  test-typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Run unit tests
        working-directory: frontend
        run: npm run test:unit -- --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./frontend/coverage/coverage-final.json
          flags: frontend
```

**Exit Criteria:**
- All tests pass
- Code coverage ≥80%
- Test execution time <5 minutes

---

### Stage 3: Contract Tests (3 minutes)

**File:** `.github/workflows/contract-tests.yml`

```yaml
name: Contract Tests

on:
  pull_request:
    paths:
      - 'api/contracts/**'
      - 'frontend/src/types/contracts.generated.ts'
      - 'scripts/dev/generate_contracts_v2.py'

jobs:
  validate-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Generate TypeScript contracts
        run: python scripts/dev/generate_contracts_v2.py

      - name: Check for 'any' types (F-0004)
        run: |
          if grep -n ":\s*any" frontend/src/types/contracts.generated.ts; then
            echo "ERROR: Generated contracts contain 'any' type"
            exit 1
          fi

      - name: Verify required exports (F-0001)
        run: |
          required_exports=(
            "export function isPointGeometry"
            "export function getConfidence"
            "export function getChildrenCount"
          )
          for export in "${required_exports[@]}"; do
            if ! grep -q "$export" frontend/src/types/contracts.generated.ts; then
              echo "ERROR: Missing export: $export"
              exit 1
            fi
          done

      - name: Run contract schema tests
        run: pytest tests/contracts/ -v

      - name: Check contracts in sync
        run: |
          git diff --exit-code frontend/src/types/contracts.generated.ts || \
          (echo "ERROR: Contracts out of sync" && exit 1)
```

**Exit Criteria:**
- Zero `any` types in generated contracts (F-0004)
- All required exports present (F-0001)
- Contracts in sync with Pydantic models

---

### Stage 4: Integration Tests (10 minutes)

**File:** `.github/workflows/integration-tests.yml`

```yaml
name: Integration Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  integration-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: forecastin_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install PostgreSQL extensions
        run: |
          PGPASSWORD=postgres psql -h localhost -U postgres -d forecastin_test -c "CREATE EXTENSION IF NOT EXISTS ltree;"
          PGPASSWORD=postgres psql -h localhost -U postgres -d forecastin_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run migrations
        run: |
          alembic upgrade head
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/forecastin_test

      - name: Run integration tests
        run: |
          pytest tests/integration/ -v --maxfail=1
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/forecastin_test
          REDIS_URL: redis://localhost:6379/0

      - name: Test API contract compliance
        run: pytest tests/integration/test_api_contracts.py -v
```

**Exit Criteria:**
- All integration tests pass
- Database migrations apply cleanly
- API responses match contracts

---

### Stage 5: End-to-End Tests (15 minutes)

**File:** `.github/workflows/e2e-tests.yml`

```yaml
name: E2E Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: forecastin_test
        ports:
          - 5432:5432

      redis:
        image: redis:6
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install backend dependencies
        run: pip install -r requirements.txt

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci

      - name: Install Playwright
        working-directory: frontend
        run: npx playwright install --with-deps

      - name: Start backend
        run: |
          alembic upgrade head
          uvicorn api.main:app --host 0.0.0.0 --port 8000 &
          sleep 5
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/forecastin_test
          REDIS_URL: redis://localhost:6379/0

      - name: Build frontend
        working-directory: frontend
        run: npm run build

      - name: Serve frontend
        working-directory: frontend
        run: |
          npm run preview -- --port 3000 &
          sleep 5

      - name: Run Playwright tests
        working-directory: frontend
        run: npm run test:e2e
        env:
          VITE_API_URL: http://localhost:8000

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

**Exit Criteria:**
- All E2E tests pass
- Critical user flows verified (map rendering, hierarchy navigation, feature flag toggling)

---

### Stage 6: Performance Tests (5 minutes)

**File:** `.github/workflows/performance-tests.yml`

```yaml
name: Performance Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  performance-benchmarks:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: forecastin_test
        ports:
          - 5432:5432

      redis:
        image: redis:6
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install locust

      - name: Run migrations
        run: alembic upgrade head
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/forecastin_test

      - name: Load test data
        run: python scripts/testing/load_test_data.py
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/forecastin_test

      - name: Start backend
        run: |
          uvicorn api.main:app --host 0.0.0.0 --port 8000 &
          sleep 5
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/forecastin_test
          REDIS_URL: redis://localhost:6379/0

      - name: Run performance benchmarks
        run: python scripts/testing/direct_performance_test.py
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/forecastin_test

      - name: Verify performance budgets
        run: |
          python scripts/testing/verify_performance_budgets.py \
            --results performance_results.json \
            --budgets REBUILD_DOSSIER/20251109-0521/16_PERF_BUDGETS.md

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('performance_results.json'));
            const comment = `## Performance Results\n\n` +
              `- Throughput: ${results.throughput} RPS (target: 42,726 RPS)\n` +
              `- Ancestor resolution: ${results.ancestor_time}ms (target: <10ms)\n` +
              `- Cache hit rate: ${results.cache_hit_rate}% (target: 99.2%)\n`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

**Exit Criteria:**
- Throughput ≥42,726 RPS (current baseline)
- Ancestor resolution <10ms
- Cache hit rate ≥99.2%
- No performance regressions >5%

---

### Stage 7: Build & Deploy (5 minutes)

**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build backend
        run: |
          pip install -r requirements.txt
          # Package backend

      - name: Build frontend
        working-directory: frontend
        run: |
          npm ci
          npm run build

      - name: Deploy to staging
        run: |
          # Deploy to staging environment
          echo "Deploying to staging..."

      - name: Run smoke tests
        run: |
          pytest tests/smoke/ -v
        env:
          API_URL: https://staging.forecastin.example.com

      - name: Deploy to production
        if: success()
        run: |
          # Deploy to production
          echo "Deploying to production..."

      - name: Notify team
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ Deployed to production: ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Exit Criteria:**
- Frontend build succeeds
- Backend packages successfully
- Staging deployment passes smoke tests
- Production deployment completes

---

## Continuous Monitoring

### Post-Deployment Checks

```yaml
name: Post-Deployment Health

on:
  workflow_run:
    workflows: ["Deploy"]
    types:
      - completed

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check API health
        run: |
          curl -f https://api.forecastin.example.com/health || exit 1

      - name: Check Sentry errors
        run: |
          # Query Sentry API for errors in last 5 minutes
          python scripts/monitoring/check_sentry_errors.py

      - name: Verify metrics
        run: |
          # Check Prometheus/Grafana for anomalies
          python scripts/monitoring/verify_metrics.py
```

---

## Quality Gates

### PR Merge Requirements

```yaml
# .github/branch-protection.yml
branches:
  main:
    required_status_checks:
      strict: true
      contexts:
        - "Code Quality / lint-python"
        - "Code Quality / lint-typescript"
        - "Code Quality / security-scan"
        - "Unit Tests / test-python"
        - "Unit Tests / test-typescript"
        - "Contract Tests / validate-contracts"
        - "Integration Tests / integration-tests"
        - "Performance Tests / performance-benchmarks"
    required_pull_request_reviews:
      required_approving_review_count: 1
    enforce_admins: true
```

**Exit Criteria for PR Merge:**
- All status checks pass
- Code coverage ≥80%
- No security vulnerabilities
- No performance regressions >5%
- At least 1 approved review

---

## Rollback Procedures

### Automated Rollback

```yaml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      deployment_id:
        description: 'Deployment ID to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Rollback deployment
        run: |
          # Rollback to previous deployment
          echo "Rolling back to deployment: ${{ github.event.inputs.deployment_id }}"

      - name: Verify rollback
        run: |
          pytest tests/smoke/ -v

      - name: Notify team
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "⚠️ Rolled back to deployment: ${{ github.event.inputs.deployment_id }}"
            }
```

---

## CI/CD Metrics

### Key Metrics to Track

```yaml
# .github/workflows/ci-metrics.yml
name: CI Metrics

on:
  workflow_run:
    workflows: ["*"]
    types:
      - completed

jobs:
  collect-metrics:
    runs-on: ubuntu-latest
    steps:
      - name: Collect workflow metrics
        run: |
          echo "Workflow: ${{ github.workflow }}"
          echo "Duration: ${{ github.event.workflow_run.run_duration_ms }}ms"
          echo "Status: ${{ github.event.workflow_run.conclusion }}"

      - name: Send to monitoring
        run: |
          # Send metrics to Prometheus/Grafana
          curl -X POST https://metrics.example.com/ci \
            -d "workflow=${{ github.workflow }}" \
            -d "duration=${{ github.event.workflow_run.run_duration_ms }}" \
            -d "status=${{ github.event.workflow_run.conclusion }}"
```

**Target Metrics:**
- Build success rate: >95%
- Average PR time to merge: <4 hours
- Test execution time: <40 minutes total
- Deployment frequency: >5x per week
- Mean time to recovery (MTTR): <1 hour

---

**CI/CD Pipeline Design Complete**
**Addresses contract validation (F-0001, F-0004), security scanning (F-0002), performance regression detection**
**Total pipeline time: ~40 minutes**
