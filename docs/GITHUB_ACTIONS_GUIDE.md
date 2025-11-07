# GitHub Actions Guide

Complete guide to using GitHub Actions CI/CD workflows in the Forecastin project.

## Table of Contents

- [Overview](#overview)
- [Available Workflows](#available-workflows)
- [Understanding Workflow Results](#understanding-workflow-results)
- [Working with CI/CD](#working-with-cicd)
- [Troubleshooting Failed Workflows](#troubleshooting-failed-workflows)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)

## Overview

Forecastin uses GitHub Actions for continuous integration and deployment. Our CI/CD pipeline automatically runs tests, security scans, performance validation, and compliance checks on every push and pull request.

### What Gets Tested?

- **Backend**: Python code linting, type checking, unit tests, integration tests
- **Frontend**: TypeScript compilation, ESLint, unit tests, component tests
- **Database**: Migration testing, LTREE operations, PostGIS extensions
- **Performance**: SLO validation, load testing, throughput benchmarks
- **Security**: Dependency scanning, vulnerability detection, security best practices
- **Docker**: Image building, container security scanning

### When Do Workflows Run?

- **On Push**: When code is pushed to `main` or `develop` branches
- **On Pull Request**: When a PR is opened or updated targeting `main` branch
- **Scheduled**: Some workflows (like performance validation) run daily
- **Manual**: Workflows can be triggered manually from the Actions tab

## Available Workflows

### 1. CI/CD Pipeline (`ci.yml`)

**Purpose**: Main continuous integration workflow

**Runs on**: Push to `main`/`develop`, Pull requests to `main`

**Jobs**:
- `backend-test`: Backend linting, tests, and security scans
- `frontend-test`: Frontend linting, TypeScript compilation, and tests
- `db-migration-test`: Database schema and migration validation
- `docker-build`: Build and scan Docker images
- `compliance-check`: Collect compliance evidence and generate reports
- `performance-test`: Run performance validation tests
- `security-scan`: Run security audits on dependencies
- `docs-consistency`: Validate documentation consistency
- `all-tests-pass`: Summary of all test results

**Key Features**:
- Uses `continue-on-error: true` for non-blocking checks
- Uploads artifacts for coverage reports and compliance evidence
- Generates compliance reports automatically
- Validates security with bandit, safety, and Trivy

**View Results**: [Actions Tab → CI/CD Pipeline](../../actions/workflows/ci.yml)

### 2. CI/CD Pipeline with Performance Validation (`ci-cd-pipeline.yml`)

**Purpose**: Extended CI/CD with comprehensive performance validation

**Runs on**: Push to `main`/`develop`, Pull requests to `main`

**Jobs**:
- `pre-commit`: Run pre-commit hooks, mypy, and TypeScript checks
- `test-api`: API unit tests with PostgreSQL and Redis
- `performance-tests`: Validate against performance SLOs
  - Hierarchy resolution (target: <10ms)
  - Cache hit rate (target: >90%)
  - Throughput (target: >10,000 RPS)
- `db-performance`: Database benchmarking
- `compliance-check`: Security scanning and evidence collection
- `integration-tests`: End-to-end integration tests
- `deploy`: Deploy to staging (main branch only)

**Performance SLOs Validated**:
- Ancestor resolution: Mean <10ms, P95 <15ms
- Throughput: >10,000 requests per second
- Cache hit rate: >90%
- Materialized view refresh: <1000ms

**View Results**: [Actions Tab → CI/CD Pipeline with Performance Validation](../../actions/workflows/ci-cd-pipeline.yml)

### 3. Performance Validation (`performance-validation.yml`)

**Purpose**: Daily performance regression testing

**Runs on**: Push to `main`/`develop`, Pull requests, Daily at 02:00 UTC

**Jobs**:
- `typescript-verification`: Verify TypeScript compilation
- `core-performance-slos`: Validate core performance metrics

**When to Use**:
- Before releasing new features that might impact performance
- After database schema changes
- After caching layer modifications
- To establish baseline performance metrics

**View Results**: [Actions Tab → Performance Validation](../../actions/workflows/performance-validation.yml)

### 4. WebSocket Smoke Tests (`ws-smoke.yml`)

**Purpose**: Quick validation of WebSocket connectivity

**Runs on**: Push, Pull requests, or manual trigger

**Tests**:
- WebSocket connection establishment
- Echo endpoint functionality
- Health endpoint heartbeat
- Connection stability

**View Results**: [Actions Tab → WebSocket Smoke Tests](../../actions/workflows/ws-smoke.yml)

## Understanding Workflow Results

### How to View Workflow Results

1. Navigate to the **Actions** tab in GitHub
2. Click on the workflow run you want to inspect
3. Review the job summary and individual job results
4. Click on a job to see detailed logs

### Interpreting Status Indicators

- ✅ **Success (Green)**: All checks passed
- ❌ **Failure (Red)**: One or more checks failed
- 🟡 **In Progress (Yellow)**: Workflow is currently running
- ⚪ **Skipped (Gray)**: Job was skipped due to conditions
- 🟠 **Cancelled (Orange)**: Workflow was manually cancelled

### Reading Job Logs

Each job contains multiple steps. Expand individual steps to see:
- Command output
- Error messages
- Test results
- Performance metrics

**Example**: Finding a failed test
```
1. Click on the failed job (e.g., "backend-test")
2. Expand the "Run backend tests with coverage" step
3. Look for lines starting with "FAILED" or "ERROR"
4. Review the assertion error or stack trace
```

### Artifacts

Some workflows upload artifacts (test reports, coverage data, performance metrics). To access them:

1. Scroll to the bottom of the workflow run page
2. Find the "Artifacts" section
3. Download the artifact (e.g., `compliance-evidence`, `performance-reports`)

**Available Artifacts**:
- `compliance-evidence`: Compliance reports and security scan results
- `performance-reports`: Performance benchmarks and SLO validation
- `integration-test-results`: Integration test outputs
- `typescript-errors`: TypeScript compilation errors (if any)

## Working with CI/CD

### Running Workflows Locally

Before pushing code, you can run tests locally to catch issues early:

```bash
# Backend tests
cd api
pytest tests/ -v

# Frontend tests
cd frontend
npm test

# Pre-commit hooks
pre-commit run --all-files

# Type checking
mypy api/ --ignore-missing-imports
cd frontend && npx tsc --noEmit
```

### Making CI Pass

**For Backend Test Failures**:
```bash
# Run linting
cd api
black .
isort .
flake8 . --max-line-length=120

# Run tests
pytest tests/ -v

# Check security
bandit -r . -ll
safety check
```

**For Frontend Test Failures**:
```bash
cd frontend
# Fix linting
npx eslint src --fix

# Type check
npx tsc --noEmit

# Run tests
npm test
```

**For Performance Test Failures**:
```bash
# Run performance tests locally
cd api
pytest tests/test_performance.py -v --benchmark-only

# Check specific SLO
pytest tests/test_performance.py::test_ancestor_resolution_slo -v
```

### Workflow Triggers

**Automatic Triggers**:
- Every push to `main` or `develop` triggers CI
- Opening/updating a PR to `main` triggers all workflows
- Daily at 02:00 UTC for performance validation

**Manual Triggers**:
1. Go to Actions tab
2. Select the workflow
3. Click "Run workflow"
4. Choose the branch
5. Click "Run workflow" button

### Branch Protection Rules

The `main` branch is protected and requires:
- CI/CD workflow to pass
- Code review approval
- Up-to-date with base branch

You cannot merge a PR if:
- Required workflows are failing
- Review is not approved
- Merge conflicts exist

## Troubleshooting Failed Workflows

### Common Failure Scenarios

#### 1. Backend Test Failures

**Symptom**: `backend-test` job fails

**Common Causes**:
- Import errors
- Test assertions failing
- Database connection issues
- Missing dependencies

**How to Debug**:
```bash
# Check the error in GitHub Actions logs
# Look for the specific test that failed
# Run the test locally:
cd api
pytest tests/test_name.py::test_function_name -v

# Check for missing dependencies
pip install -r requirements.txt
```

#### 2. Frontend Test Failures

**Symptom**: `frontend-test` job fails

**Common Causes**:
- TypeScript compilation errors
- Component test failures
- ESLint violations
- Missing npm packages

**How to Debug**:
```bash
cd frontend

# Check TypeScript errors
npx tsc --noEmit

# Run tests
npm test

# Fix ESLint issues
npx eslint src --fix
```

#### 3. Docker Build Failures

**Symptom**: `docker-build` job fails

**Common Causes**:
- Dockerfile syntax errors
- Missing dependencies
- Build context issues
- Security vulnerabilities

**How to Debug**:
```bash
# Build locally
docker build -t forecastin-api:test ./api
docker build -t forecastin-frontend:test ./frontend

# Check logs for errors
docker build --no-cache -t forecastin-api:test ./api
```

#### 4. Performance Test Failures

**Symptom**: `performance-tests` job fails or SLO violations

**Common Causes**:
- Code changes impacting performance
- Database query inefficiencies
- Cache misconfiguration
- Resource constraints in CI

**How to Debug**:
```bash
# Run performance tests locally
cd api
pytest tests/test_performance.py -v --benchmark-json=benchmark.json

# Analyze results
cat benchmark.json | jq '.benchmarks[] | {name: .name, mean: .stats.mean}'

# Check specific SLO violations in the logs
# Compare with baseline metrics in AGENTS.md
```

#### 5. Compliance Check Failures

**Symptom**: `compliance-check` job reports security issues

**Common Causes**:
- Vulnerable dependencies
- Security anti-patterns detected by bandit
- Unsafe code practices

**How to Debug**:
```bash
# Check Python dependencies
cd api
safety check
pip install --upgrade <vulnerable-package>

# Run bandit
bandit -r . -f json -o bandit-report.json
cat bandit-report.json | jq

# Fix npm vulnerabilities
cd frontend
npm audit fix
```

### Debugging Strategies

**1. Read the Full Logs**
- Don't just look at the summary—expand all steps
- Look for the first error (subsequent errors are often cascading)
- Check for warnings that might provide context

**2. Reproduce Locally**
```bash
# Use the same environment as CI
# Check .github/workflows/*.yml for versions
# For Python 3.9, Node 18:
pyenv install 3.9
pyenv local 3.9
nvm install 18
nvm use 18
```

**3. Check Environment Variables**
- CI uses specific environment variables
- Review `env:` sections in workflow files
- Ensure local `.env` matches CI expectations

**4. Compare with Main Branch**
```bash
# See what changed
git diff main...your-branch

# Check if main is passing
# Visit Actions tab and check main branch runs
```

**5. Use Workflow Artifacts**
- Download test reports
- Review coverage data
- Analyze performance benchmarks

## Advanced Usage

### Matrix Builds

Some workflows test across multiple versions:

```yaml
strategy:
  matrix:
    python-version: [3.9, 3.10, 3.11]
    node-version: [18.x, 20.x]
```

This creates a job for each combination, ensuring compatibility.

### Caching Dependencies

Workflows use caching to speed up runs:

```yaml
- uses: actions/cache@v3
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('api/requirements.txt') }}
```

**Cache Invalidation**:
- Caches are automatically invalidated when dependencies change
- Manual cache clearing: Go to Actions → Caches → Delete

### Secrets and Environment Variables

**Setting Secrets**:
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add name and value
4. Reference in workflows: `${{ secrets.SECRET_NAME }}`

**Using Environment Variables**:
```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
```

### Workflow Dispatch (Manual Triggers)

Some workflows support manual triggering with inputs:

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
```

**To Trigger**:
1. Actions tab → Select workflow
2. "Run workflow" button
3. Fill in inputs
4. Click "Run workflow"

### Conditional Job Execution

Jobs can run conditionally:

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
```

This job only runs on the `main` branch.

### Reusable Workflows

Share workflow logic across multiple workflows using reusable workflows:

```yaml
jobs:
  call-workflow:
    uses: ./.github/workflows/reusable-test.yml
    with:
      python-version: '3.9'
```

## Best Practices

### 1. Fix Failures Immediately

Don't let CI failures accumulate. Address them as soon as possible:
- Broken windows theory: One failure leads to more
- Harder to debug when multiple changes have occurred
- Blocks other developers

### 2. Run Tests Locally First

Before pushing:
```bash
# Run the full test suite
make test  # or equivalent

# Run linters
make lint

# Run type checkers
make typecheck
```

### 3. Use Descriptive Commit Messages

Good commit messages help when reviewing CI failures:
```bash
# Bad
git commit -m "fix"

# Good
git commit -m "fix: resolve null pointer in entity resolver"
```

### 4. Review CI Logs Before Requesting Review

Don't create a PR until CI is green:
1. Push to your branch
2. Wait for CI to complete
3. Fix any failures
4. Only then mark PR as ready for review

### 5. Understand What You're Testing

Each workflow validates different aspects:
- **Unit tests**: Individual component behavior
- **Integration tests**: Component interactions
- **Performance tests**: Speed and efficiency
- **Security tests**: Vulnerabilities and best practices

### 6. Monitor Performance Trends

Performance can degrade gradually:
- Review performance test results regularly
- Compare with previous runs
- Set up alerts for SLO violations

### 7. Keep Dependencies Updated

Regularly update dependencies to avoid security issues:
```bash
# Backend
cd api
pip list --outdated
pip install --upgrade <package>

# Frontend
cd frontend
npm outdated
npm update <package>
```

### 8. Use Feature Flags for Risky Changes

When making changes that might break CI:
- Use feature flags to disable in production
- Test thoroughly in development
- Roll out gradually (10% → 25% → 50% → 100%)

### 9. Document CI Changes

When modifying workflows:
- Update this guide if behavior changes
- Add comments in workflow files
- Document new environment variables

### 10. Leverage Artifacts

Upload useful artifacts for debugging:
```yaml
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: test-reports/
```

## Quick Reference

### Workflow Status Badges

Add to your PR or README to show CI status:

```markdown
![CI/CD Pipeline](https://github.com/glockpete/Forecastin/actions/workflows/ci.yml/badge.svg)
```

### Useful GitHub Actions Commands

```bash
# View workflow runs
gh run list

# View specific run
gh run view <run-id>

# View logs
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id> --failed

# Cancel a run
gh run cancel <run-id>
```

### Environment Setup

Match CI environment locally:

```bash
# Python version (from workflows)
pyenv install 3.9
pyenv local 3.9

# Node version
nvm install 18
nvm use 18

# PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgis/postgis:13-3.1

# Redis
docker run -d -p 6379:6379 redis:6-alpine
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Forecastin Testing Guide](TESTING_GUIDE.md)
- [Forecastin Contributing Guide](../CONTRIBUTING.md)
- [Performance SLOs](../README.md#performance-benchmarks)

## Getting Help

**If CI is failing and you can't figure out why**:

1. Check this guide for common issues
2. Review the full workflow logs
3. Reproduce the issue locally
4. Check recent commits to `main` for similar issues
5. Ask in GitHub Discussions or open an issue

**For workflow improvements**:

1. Open an issue describing the improvement
2. Tag with `ci/cd` label
3. Propose changes in a PR
4. Update this documentation

---

**Remember**: CI is here to help you ship quality code with confidence. Green builds mean you can merge with peace of mind! 🚀
