# ADR-0005: Secrets Management

**Status:** Accepted
**Date:** 2025-11-09
**Deciders:** Engineering Team
**Evidence:** F-0002, Antipattern-6
**Severity:** CRITICAL

---

## Context

**Critical Security Issue (F-0002):**
- Hardcoded database password in source control
- Password visible in Git history (unrecoverable without rewrite)
- Exposed in plaintext: `"postgresql://postgres:HARDCODED_PASSWORD@localhost:5432/forecastin"`

**PATH Evidence:**
- `/home/user/Forecastin/scripts/testing/direct_performance_test.py:23`

**Risk:**
- Anyone with repository access has database password
- Compromised in Git history (even if deleted)
- Violates security best practices

---

## Decision

We will implement a **layered secrets management strategy**:

### Layer 1: Environment Variables (Development)

**Development:**
```bash
# .env (NEVER commit this file)
DATABASE_URL=postgresql://postgres:dev_password@localhost:5432/forecastin
REDIS_URL=redis://localhost:6379/0
```

**Gitignore:**
```
.env
.env.local
.env.*.local
*.key
*.pem
credentials.json
```

**Template:**
```bash
# .env.example (SAFE to commit)
DATABASE_URL=postgresql://user:password@localhost:5432/forecastin
REDIS_URL=redis://localhost:6379/0
SENTRY_DSN=https://...
```

### Layer 2: Pre-Commit Hooks (Prevention)

**Install Gitleaks:**
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

**CI/CD Check:**
```yaml
# .github/workflows/security-scan.yml
- name: Gitleaks scan
  run: |
    gitleaks detect
    # MUST return: "No leaks found"
```

### Layer 3: Production Secrets (AWS Secrets Manager)

**Store in AWS Secrets Manager:**
```json
{
  "name": "prod/forecastin/database",
  "value": {
    "username": "forecastin_prod",
    "password": "RANDOMLY_GENERATED_64_CHAR_PASSWORD",
    "host": "db.example.com",
    "port": 5432,
    "database": "forecastin"
  }
}
```

**Retrieve in code:**
```python
import boto3
import json

def get_database_url() -> str:
    """Retrieve database URL from AWS Secrets Manager."""

    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId='prod/forecastin/database')
    secret = json.loads(response['SecretString'])

    return f"postgresql://{secret['username']}:{secret['password']}@{secret['host']}/{secret['database']}"

DATABASE_URL = get_database_url()
```

### Layer 4: Rotation Policy

**Rotation Schedule:**
- Database passwords: Every 90 days
- API keys: Every 180 days
- JWT signing keys: Every 30 days

**Automated rotation:**
```python
# scripts/rotate_secrets.py
# Run weekly via cron
```

---

## Consequences

**Positive:**
- Zero secrets in source control
- Pre-commit hook prevents future leaks
- Production secrets centrally managed
- Automated rotation
- Audit trail (who accessed when)

**Negative:**
- AWS Secrets Manager cost (~$0.40/secret/month)
- Extra setup complexity
- Developers need AWS credentials

**Immediate Actions (T-0001):**
1. Remove hardcoded password (15 minutes)
2. Rotate compromised credentials (1 hour)
3. Install pre-commit hooks (2 hours)
4. Set up AWS Secrets Manager (4 hours)

**Total:** ~7 hours

---

## Migration Steps

### Step 1: Remove Hardcoded Secret (T-0001)

```python
# Before (INSECURE)
DATABASE_URL = "postgresql://postgres:HARDCODED_PASSWORD@localhost:5432/forecastin"

# After (SECURE)
import os
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable not set")
```

### Step 2: Update All Usages

```bash
# Find all hardcoded credentials
grep -r "password" api/ scripts/ --include="*.py"

# Replace with environment variable access
```

### Step 3: Rotate Credentials

```sql
-- Connect to PostgreSQL
ALTER USER postgres WITH PASSWORD 'NEW_RANDOM_PASSWORD';
```

### Step 4: Install Pre-Commit Hooks

```bash
pip install pre-commit
pre-commit install

# Test
echo 'PASSWORD="secret123"' > test.py
git add test.py
git commit -m "test"
# Should BLOCK with: "Gitleaks detected hardcoded secret"
```

### Step 5: Configure AWS Secrets Manager

```bash
# Create secret
aws secretsmanager create-secret \
  --name prod/forecastin/database \
  --secret-string '{"username":"forecastin","password":"RANDOM_64_CHAR"}'

# Grant application IAM role access
aws secretsmanager put-resource-policy \
  --secret-id prod/forecastin/database \
  --resource-policy file://policy.json
```

---

## Verification (Acceptance Criteria)

**T-0001 Acceptance Test:**
```bash
# 1. Gitleaks must find nothing
gitleaks detect
# Output: "No leaks found"

# 2. Application must connect with env var
export DATABASE_URL="postgresql://user:pass@localhost/db"
python scripts/testing/direct_performance_test.py
# Should connect successfully

# 3. Pre-commit hook must block secrets
echo 'API_KEY="sk-1234567890"' > test.py
git add test.py
git commit -m "test"
# Should FAIL with Gitleaks error
```

---

## Alternatives Considered

### Alternative 1: Keep Secrets in Code

**Pros:** Simple, no extra dependencies

**Cons:**
- **CRITICAL SECURITY RISK**
- Violates best practices
- Compliance violations

**Rejected because:** Unacceptable security risk

### Alternative 2: HashiCorp Vault

**Pros:**
- Open source
- Feature-rich
- Dynamic secrets

**Cons:**
- Complex to set up and maintain
- Extra infrastructure to manage

**Rejected because:** AWS Secrets Manager is simpler (already on AWS)

### Alternative 3: Encrypted Files in Repo

**Pros:** No external dependencies

**Cons:**
- Decryption key still needs to be managed
- Rotation requires new commit
- Audit trail limited

**Rejected because:** Secrets Manager has better audit and rotation

---

## Related

- **Addresses:** F-0002 (CRITICAL), AP-6
- **Tasks:** T-0001 (15 minutes - highest priority)
- **Files:** `scripts/testing/direct_performance_test.py:23`
- **ADRs:** ADR-0004 (Observability - audit logging for secret access)
