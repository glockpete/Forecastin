# Security Policy

## Reporting Security Vulnerabilities

The Forecastin team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### 🔒 Please DO NOT:

- **DO NOT** open public GitHub issues for security vulnerabilities
- **DO NOT** discuss security issues in public forums, chat rooms, or social media
- **DO NOT** exploit the vulnerability beyond the minimum necessary to demonstrate the issue

### ✅ Please DO:

1. **Email security reports** to: [SECURITY_EMAIL_TO_BE_CONFIGURED]
   - Use subject line: `[SECURITY] Brief description`
   - Include detailed reproduction steps
   - Include potential impact assessment
   - Include any proof-of-concept code (if applicable)

2. **Allow time for response** - We will acknowledge receipt within 48 hours

3. **Follow coordinated disclosure** - Work with us to understand and fix the issue before public disclosure

## What to Report

We're interested in any security issues, including but not limited to:

### Critical
- Remote code execution (RCE)
- SQL injection
- Authentication bypass
- Authorization bypass
- Server-side request forgery (SSRF)
- XML external entity (XXE) injection
- Cross-site scripting (XSS) leading to account takeover

### High
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Insecure direct object references (IDOR)
- Path traversal
- Information disclosure exposing sensitive data
- Cryptographic vulnerabilities
- Session management issues

### Medium
- Missing security headers
- Subdomain takeover
- Open redirects
- Information disclosure (non-sensitive)
- Rate limiting issues leading to abuse

### Low
- Missing best practices
- Security misconfigurations (non-exploitable)
- Outdated dependencies (without known exploits)

## Response Timeline

| Stage | Timeframe |
|-------|-----------|
| **Initial Response** | Within 48 hours |
| **Issue Triage** | Within 1 week |
| **Fix Development** | 1-4 weeks (depending on severity) |
| **Fix Deployment** | Within days of fix completion |
| **Public Disclosure** | 90 days after fix deployment (coordinated) |

### Severity-Based Response Times

- **Critical**: Fix within 48 hours, deploy immediately
- **High**: Fix within 1 week, deploy within 2 weeks
- **Medium**: Fix within 1 month, deploy within 6 weeks
- **Low**: Fix in next release cycle

## Security Update Process

1. **Acknowledgment**: We acknowledge the report and begin investigation
2. **Confirmation**: We confirm the vulnerability and severity
3. **Fix Development**: We develop and test a fix
4. **Security Advisory**: We prepare a security advisory (if warranted)
5. **Release**: We release the fix and publish the advisory
6. **Credit**: We credit the reporter (if desired)

## Public Disclosure

- We follow a **90-day coordinated disclosure** timeline
- Security advisories published on GitHub Security Advisories
- Critical issues may be disclosed sooner if actively exploited
- We will coordinate disclosure timing with the reporter

## Bug Bounty Program

**Status**: Not currently available

We plan to launch a bug bounty program in the future. Check back for updates.

## Security Measures

Forecastin implements multiple security layers:

### Application Security

#### Input Validation
- All user input validated and sanitized
- Parameterized SQL queries (no string concatenation)
- HTML content sanitization for RSS feeds
- Schema validation with Pydantic (backend) and Zod (frontend)

#### Authentication & Authorization
- *(Planned)* JWT-based authentication
- *(Planned)* Role-based access control (RBAC)
- *(Planned)* Rate limiting on authentication endpoints
- Session management with secure cookies

#### API Security
- CORS policy enforcement (`ALLOWED_ORIGINS`)
- Request size limits
- Rate limiting (planned)
- API versioning for breaking changes

#### Database Security
- Connection pooling with TCP keepalives
- Prepared statements (no SQL injection)
- Least privilege database user
- Regular security audits
- Encrypted connections (TLS)

#### WebSocket Security
- Origin validation against `ALLOWED_ORIGINS`
- Message size limits
- Connection rate limiting (planned)
- Heartbeat mechanism to detect dead connections

### Infrastructure Security

#### Secrets Management
- Environment variables for configuration
- No secrets in code or version control
- *(Production)* Secrets manager integration (AWS Secrets Manager, Vault)

#### Network Security
- Docker network isolation
- Firewall rules (production)
- TLS/SSL for all external communication
- Reverse proxy (nginx) with security headers

#### Monitoring & Logging
- Comprehensive application logging
- Security event monitoring (planned)
- Performance metrics via Prometheus
- Alerting via Alertmanager

### Dependency Security

#### Automated Scanning
- Dependabot enabled for GitHub dependencies
- Regular `npm audit` and `pip-audit` runs
- CI/CD security checks with bandit, safety, semgrep

#### Update Policy
- Critical security patches: immediate
- High severity patches: within 1 week
- Medium/low severity: next release cycle

## Security Best Practices for Contributors

### Code Security

1. **Never commit secrets**
   ```bash
   # Add to .gitignore
   .env
   .env.*
   secrets/
   *.pem
   *.key
   ```

2. **Validate all input**
   ```python
   from pydantic import BaseModel, validator

   class EntityInput(BaseModel):
       name: str
       path: str

       @validator('path')
       def validate_path(cls, v):
           if not re.match(r'^[a-z0-9._]+$', v):
               raise ValueError('Invalid path format')
           return v
   ```

3. **Use parameterized queries**
   ```python
   # Good ✅
   await db.execute(
       "SELECT * FROM entities WHERE path = $1",
       path
   )

   # Bad ❌
   await db.execute(f"SELECT * FROM entities WHERE path = '{path}'")
   ```

4. **Sanitize HTML content**
   ```python
   from bleach import clean

   safe_html = clean(
       user_content,
       tags=['p', 'br', 'strong', 'em'],
       strip=True
   )
   ```

5. **Use security headers**
   ```python
   # In FastAPI middleware
   response.headers['X-Content-Type-Options'] = 'nosniff'
   response.headers['X-Frame-Options'] = 'DENY'
   response.headers['X-XSS-Protection'] = '1; mode=block'
   ```

### Development Security

1. **Use HTTPS in production**
   - Redirect HTTP → HTTPS
   - Use HSTS header
   - Update `WS_PUBLIC_URL` to use `wss://`

2. **Secure configuration**
   ```bash
   # Production .env
   ENVIRONMENT=production
   LOG_LEVEL=WARNING  # Don't leak details
   ALLOWED_ORIGINS=https://app.forecastin.com  # Specific domains only
   ```

3. **Regular updates**
   ```bash
   # Check for security updates
   npm audit
   pip-audit

   # Update dependencies
   npm update
   pip install -U -r requirements.txt
   ```

## Security Testing

### Automated Security Checks

Run security checks before committing:

```bash
# Backend security checks
cd api
bandit -r . -ll
safety check
semgrep --config=auto .

# Frontend security checks
cd frontend
npm audit
npm audit fix  # Apply automatic fixes
```

### Manual Security Testing

Before major releases:

- [ ] SQL injection testing
- [ ] XSS testing
- [ ] CSRF testing
- [ ] Authentication bypass testing
- [ ] Authorization testing
- [ ] Input validation testing
- [ ] Rate limiting testing
- [ ] WebSocket security testing

### Security Review Checklist

- [ ] All user input validated
- [ ] No secrets in code/version control
- [ ] HTTPS enforced (production)
- [ ] CORS properly configured
- [ ] SQL queries parameterized
- [ ] HTML content sanitized
- [ ] Security headers set
- [ ] Dependencies up to date
- [ ] Error messages don't leak details
- [ ] Logging excludes sensitive data

## Known Security Considerations

### Current Limitations

1. **Authentication**: Not yet implemented
   - Planned for future releases
   - Current deployment should be behind authentication layer

2. **Rate Limiting**: Not yet implemented
   - Planned for future releases
   - Can cause resource exhaustion

3. **WAF**: Not included
   - Production deployments should use WAF (AWS WAF, Cloudflare, etc.)

### Recommendations for Production

1. **Deploy behind reverse proxy** (nginx, Caddy)
2. **Use Web Application Firewall** (WAF)
3. **Implement rate limiting** at proxy level
4. **Use secrets manager** (not .env files)
5. **Enable database encryption** at rest and in transit
6. **Use VPC/private networks** for database and Redis
7. **Implement monitoring and alerting**
8. **Regular security audits**
9. **Backup strategy** with encryption
10. **Incident response plan**

## Security Contacts

- **Security Issues**: [SECURITY_EMAIL_TO_BE_CONFIGURED]
- **General Questions**: Open a GitHub Discussion
- **Project Maintainer**: @glockpete

## Security Advisories

View published security advisories:
- https://github.com/glockpete/Forecastin/security/advisories

Subscribe to security notifications:
- Watch → Custom → Security alerts

## Acknowledgments

We thank the security researchers who have responsibly disclosed vulnerabilities:

*(No vulnerabilities reported to date)*

## Security Resources

### OWASP Top 10
- https://owasp.org/www-project-top-ten/

### CWE Top 25
- https://cwe.mitre.org/top25/

### Security Tools
- [bandit](https://github.com/PyCQA/bandit) - Python security linter
- [safety](https://github.com/pyupio/safety) - Python dependency scanner
- [semgrep](https://semgrep.dev/) - Static analysis
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - Node dependency scanner

## Compliance

Forecastin aims to comply with:

- **OWASP Top 10** - Web application security risks
- **CWE Top 25** - Most dangerous software weaknesses
- **GDPR** - Data protection (if applicable)

See [docs/GOLDEN_SOURCE.md](docs/GOLDEN_SOURCE.md) for compliance framework details.

## Updates to This Policy

This security policy may be updated from time to time. Significant changes will be announced via:

- GitHub releases
- Security advisory (if relevant)
- README.md notification

**Last Updated**: 2025-11-07

---

**Thank you for helping keep Forecastin secure!** 🔒

Your responsible disclosure helps protect all users of the platform.
