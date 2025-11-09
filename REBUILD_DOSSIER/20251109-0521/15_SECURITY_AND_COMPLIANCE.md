# 15 Security and Compliance

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Security architecture and compliance requirements
**Evidence:** F-0002 (hardcoded password), antipattern AP-6 (credential exposure)

---

## Executive Summary

**Critical Findings:**
- **F-0002**: Hardcoded database password in source control (CRITICAL)
- **AP-6**: Credentials in Git history (unrecoverable without history rewrite)

**Immediate Actions Required:**
1. Remove hardcoded password from `direct_performance_test.py` (15 minutes)
2. Rotate compromised database credentials (1 hour)
3. Implement secrets management (4 hours)
4. Add pre-commit hooks to prevent future leaks (2 hours)

---

## Threat Model

### Assets

1. **User Data**
   - Entity hierarchy data (geopolitical intelligence)
   - User authentication tokens
   - API keys

2. **Infrastructure**
   - PostgreSQL database (contains sensitive geopolitical data)
   - Redis cache
   - API servers

3. **Source Code**
   - Proprietary algorithms (LTREE hierarchy, caching strategies)
   - Contract definitions

### Threat Actors

1. **External Attackers**
   - Motivation: Data theft, service disruption
   - Vectors: SQL injection, XSS, credential stuffing

2. **Malicious Insiders**
   - Motivation: Data exfiltration
   - Vectors: Direct database access, API abuse

3. **Accidental Exposure**
   - Motivation: None (unintentional)
   - Vectors: Hardcoded secrets (F-0002), misconfigured S3 buckets

---

## Security Controls

### 1. Secrets Management

#### Current State (INSECURE)

**PATH:** `/home/user/Forecastin/scripts/testing/direct_performance_test.py:23`

```python
# CRITICAL SECURITY ISSUE (F-0002)
DATABASE_URL = "postgresql://postgres:HARDCODED_PASSWORD@localhost:5432/forecastin"
```

**Evidence:** Password visible in plaintext in Git history

#### Target State (SECURE)

**Use Environment Variables:**

```python
# scripts/testing/direct_performance_test.py

import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable not set")

# Use DATABASE_URL safely
```

**File:** `.env.example` (template for developers)
```bash
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/forecastin

# Redis connection
REDIS_URL=redis://localhost:6379/0

# API keys (use development keys)
SENTRY_DSN=https://...@sentry.io/...
```

**File:** `.env` (gitignored, contains actual secrets)
```bash
# DO NOT COMMIT THIS FILE
DATABASE_URL=postgresql://postgres:actual_password@localhost:5432/forecastin
```

**Verify `.gitignore`:**
```bash
# .gitignore
.env
.env.local
.env.*.local
*.key
*.pem
credentials.json
secrets/
```

#### Production Secrets Management

**Use AWS Secrets Manager or HashiCorp Vault:**

```python
# api/config/secrets.py

import boto3
import json
from functools import lru_cache

@lru_cache
def get_secret(secret_name: str) -> dict:
    """Retrieve secret from AWS Secrets Manager."""

    client = boto3.client('secretsmanager', region_name='us-east-1')

    try:
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except Exception as e:
        logger.error(f"Failed to retrieve secret {secret_name}: {e}")
        raise

# Usage
db_credentials = get_secret('prod/forecastin/database')
DATABASE_URL = f"postgresql://{db_credentials['username']}:{db_credentials['password']}@{db_credentials['host']}/forecastin"
```

**Rotation Policy:**
- Database passwords: Rotate every 90 days
- API keys: Rotate every 180 days
- JWT signing keys: Rotate every 30 days

---

### 2. Pre-Commit Hooks (Prevent Secret Leaks)

**Install Gitleaks:**

```bash
# .pre-commit-config.yaml

repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
        name: Detect hardcoded secrets
        description: Scan for hardcoded secrets before commit
        entry: gitleaks protect --verbose --redact --staged
        language: system
        pass_filenames: false
```

**Install:**
```bash
pip install pre-commit
pre-commit install
```

**Test:**
```bash
# Try to commit a file with password
echo 'PASSWORD="secret123"' > test.py
git add test.py
git commit -m "test"

# Gitleaks should BLOCK the commit:
# [ERROR] Gitleaks detected hardcoded secret in test.py:1
```

**Acceptance Criteria (T-0001):**
```bash
gitleaks detect  # Returns: "No leaks found"
```

---

### 3. Input Validation (Prevent Injection)

#### SQL Injection Prevention

**SECURE: Use Parameterized Queries**

```python
# api/repositories/entity_repository.py

from sqlalchemy import text

async def get_entity_by_name(name: str) -> Entity:
    """Get entity by name (SQL injection safe)."""

    # SECURE: Parameterized query
    query = text("SELECT * FROM entities WHERE name = :name")
    result = await db.execute(query, {"name": name})

    return result.fetchone()
```

**INSECURE (DO NOT USE):**
```python
# VULNERABLE TO SQL INJECTION - DO NOT USE
query = f"SELECT * FROM entities WHERE name = '{name}'"  # DANGEROUS!
```

**Test:**
```python
# tests/security/test_sql_injection.py

import pytest

def test_sql_injection_prevention():
    """Verify SQL injection attempts are safely handled."""

    # Malicious input
    malicious_name = "'; DROP TABLE entities; --"

    # This should NOT delete the table
    entity = await get_entity_by_name(malicious_name)

    # Verify table still exists
    result = await db.execute("SELECT COUNT(*) FROM entities")
    assert result.scalar() > 0, "Table should not be dropped"
```

#### XSS Prevention

**Frontend: Sanitize User Input**

```typescript
// frontend/src/utils/sanitize.ts

import DOMPurify from 'dompurify';

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  });
}

// Usage
function EntityDescription({ description }: { description: string }) {
  const clean = sanitizeHTML(description);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

**Backend: Content Security Policy**

```python
# api/middleware/security.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)

    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.mapbox.com"
    )

    # XSS Protection
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    return response
```

---

### 4. Authentication and Authorization

#### JWT Authentication

**File:** `api/auth/jwt.py`

```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.environ.get("JWT_SECRET_KEY")  # From secrets manager
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Create JWT access token."""

    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """Verify JWT token."""

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

#### Role-Based Access Control (RBAC)

```python
# api/auth/permissions.py

from enum import Enum
from fastapi import Depends, HTTPException

class Role(Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"

class Permission(Enum):
    READ_ENTITIES = "read:entities"
    WRITE_ENTITIES = "write:entities"
    MANAGE_FEATURE_FLAGS = "manage:feature_flags"

ROLE_PERMISSIONS = {
    Role.ADMIN: [
        Permission.READ_ENTITIES,
        Permission.WRITE_ENTITIES,
        Permission.MANAGE_FEATURE_FLAGS
    ],
    Role.ANALYST: [
        Permission.READ_ENTITIES,
        Permission.WRITE_ENTITIES
    ],
    Role.VIEWER: [
        Permission.READ_ENTITIES
    ]
}


def require_permission(permission: Permission):
    """Decorator to require specific permission."""

    def decorator(func):
        async def wrapper(current_user: User = Depends(get_current_user)):
            user_role = current_user.role
            allowed_permissions = ROLE_PERMISSIONS.get(user_role, [])

            if permission not in allowed_permissions:
                raise HTTPException(
                    status_code=403,
                    detail=f"Missing required permission: {permission.value}"
                )

            return await func(current_user)
        return wrapper
    return decorator


# Usage
@router.post("/entities")
@require_permission(Permission.WRITE_ENTITIES)
async def create_entity(entity: EntityCreateRequest, current_user: User = Depends(get_current_user)):
    # Only users with WRITE_ENTITIES permission can access
    pass
```

---

### 5. Rate Limiting

**Prevent API Abuse:**

```python
# api/middleware/rate_limit.py

from fastapi import Request, HTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get("/api/v1/hierarchy")
@limiter.limit("100/minute")  # Max 100 requests per minute
async def get_hierarchy(request: Request):
    # Rate-limited endpoint
    pass


@app.post("/api/v1/entities")
@limiter.limit("10/minute")  # Stricter limit for writes
async def create_entity(request: Request):
    # Rate-limited endpoint
    pass
```

**Redis-backed rate limiting for distributed systems:**

```python
from redis import Redis

redis_client = Redis(host='localhost', port=6379, db=0)

def check_rate_limit(user_id: str, limit: int, window: int) -> bool:
    """Check if user has exceeded rate limit."""

    key = f"rate_limit:{user_id}"
    current = redis_client.get(key)

    if current is None:
        redis_client.setex(key, window, 1)
        return True

    if int(current) >= limit:
        return False

    redis_client.incr(key)
    return True
```

---

### 6. Audit Logging

**Track Security-Relevant Events:**

```python
# api/services/audit_logger.py

import logging
from datetime import datetime
from enum import Enum

class AuditEvent(Enum):
    LOGIN_SUCCESS = "login.success"
    LOGIN_FAILURE = "login.failure"
    ENTITY_CREATED = "entity.created"
    ENTITY_UPDATED = "entity.updated"
    ENTITY_DELETED = "entity.deleted"
    PERMISSION_DENIED = "permission.denied"

audit_logger = logging.getLogger("audit")


async def log_audit_event(
    event: AuditEvent,
    user_id: str,
    ip_address: str,
    details: dict
):
    """Log security audit event."""

    audit_logger.info(
        "AUDIT",
        extra={
            "event": event.value,
            "user_id": user_id,
            "ip_address": ip_address,
            "timestamp": datetime.utcnow().isoformat(),
            "details": details
        }
    )

    # Also write to database for compliance
    await db.execute(
        "INSERT INTO audit_log (event, user_id, ip_address, details, timestamp) VALUES (:event, :user_id, :ip, :details, :timestamp)",
        {
            "event": event.value,
            "user_id": user_id,
            "ip": ip_address,
            "details": json.dumps(details),
            "timestamp": datetime.utcnow()
        }
    )


# Usage
@router.post("/entities")
async def create_entity(entity: EntityCreateRequest, request: Request, current_user: User = Depends(get_current_user)):
    new_entity = await entity_service.create(entity)

    # Log audit event
    await log_audit_event(
        AuditEvent.ENTITY_CREATED,
        user_id=current_user.id,
        ip_address=request.client.host,
        details={"entity_id": new_entity.id, "entity_type": new_entity.entity_type}
    )

    return new_entity
```

**Retention Policy:**
- Audit logs: Retain for 1 year
- Access logs: Retain for 90 days
- Error logs: Retain for 30 days

---

### 7. Dependency Scanning

**Automated Vulnerability Detection:**

**File:** `.github/workflows/security-scan.yml`

```yaml
name: Security Scan

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  pull_request:

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Python dependency scan
        run: |
          pip install safety
          safety check --json --output safety-report.json

      - name: Node.js dependency scan
        working-directory: frontend
        run: npm audit --json > npm-audit.json

      - name: Upload reports
        uses: actions/upload-artifact@v4
        with:
          name: security-reports
          path: |
            safety-report.json
            npm-audit.json
```

**Automated Patching:**
```bash
# Update dependencies monthly
pip-upgrade  # For Python
npm update   # For Node.js
```

---

### 8. Data Encryption

#### Encryption at Rest

**Database Encryption:**
```sql
-- Enable PostgreSQL encryption
ALTER DATABASE forecastin SET encryption = 'on';

-- Encrypt sensitive columns
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    key_hash TEXT NOT NULL,  -- Store bcrypt hash, not plaintext
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Backup Encryption:**
```bash
# Encrypt database backups
pg_dump forecastin | gpg --encrypt --recipient admin@example.com > backup.sql.gpg
```

#### Encryption in Transit

**Force HTTPS:**
```python
# api/middleware/https_redirect.py

from fastapi import Request
from fastapi.responses import RedirectResponse

@app.middleware("http")
async def https_redirect(request: Request, call_next):
    if request.url.scheme == "http" and not request.url.hostname == "localhost":
        url = request.url.replace(scheme="https")
        return RedirectResponse(url)

    return await call_next(request)
```

**TLS Configuration:**
```python
# Require TLS 1.2+
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
ssl_context.load_cert_chain('cert.pem', 'key.pem')
```

---

## Compliance Requirements

### GDPR Compliance

**User Data Rights:**

1. **Right to Access:**
```python
@router.get("/users/{user_id}/data")
async def export_user_data(user_id: str, current_user: User = Depends(get_current_user)):
    """Export all user data (GDPR Article 15)."""

    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(403)

    user_data = await gather_user_data(user_id)
    return JSONResponse(user_data)
```

2. **Right to Deletion:**
```python
@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete user and all associated data (GDPR Article 17)."""

    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(403)

    await anonymize_user_data(user_id)
    await log_audit_event(AuditEvent.USER_DELETED, user_id, request.client.host, {})
```

3. **Data Breach Notification:**
   - Notify users within 72 hours of breach discovery
   - Maintain incident response plan

---

## Security Checklist

### Development
- [ ] F-0002: Remove hardcoded password
- [ ] Rotate compromised credentials
- [ ] Install pre-commit hooks (Gitleaks)
- [ ] Use environment variables for all secrets
- [ ] Enable `.env` gitignore

### Code Review
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Parameterized queries used
- [ ] Input validation on all endpoints
- [ ] Output sanitization in frontend

### Deployment
- [ ] Secrets stored in AWS Secrets Manager
- [ ] TLS/HTTPS enforced
- [ ] Rate limiting enabled
- [ ] Audit logging active
- [ ] Security headers configured

### Monitoring
- [ ] Dependency scanning weekly
- [ ] Audit log review monthly
- [ ] Penetration testing annually
- [ ] Incident response plan tested

---

**Security and Compliance Complete**
**Addresses F-0002 (critical), implements defense in depth**
**Compliance: GDPR, OWASP Top 10**
