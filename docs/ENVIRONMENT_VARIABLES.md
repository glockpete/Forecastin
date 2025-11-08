# Environment Variables Reference

Complete reference for all environment variables used in Forecastin.

## Table of Contents

- [Overview](#overview)
- [Database Configuration](#database-configuration)
- [Redis Configuration](#redis-configuration)
- [API Configuration](#api-configuration)
- [WebSocket Configuration](#websocket-configuration)
- [Frontend Configuration](#frontend-configuration)
- [Feature Flags](#feature-flags)
- [Monitoring & Logging](#monitoring--logging)
- [Security](#security)
- [Environment-Specific Settings](#environment-specific-settings)
- [Example Configurations](#example-configurations)

## Overview

Forecastin uses environment variables for configuration to support different deployment environments (development, staging, production) without code changes.

### Configuration Priority

1. **System environment variables** (highest priority)
2. **.env file** in root directory
3. **docker-compose.yml** environment section
4. **Default values** in code (lowest priority)

### Setting Environment Variables

#### Docker Compose (Recommended)

Edit `docker-compose.yml`:

```yaml
services:
  api:
    environment:
      - DATABASE_URL=postgresql://user:pass@host:5432/db
      - REDIS_URL=redis://host:6379/0
```

#### .env File

Create `.env` in project root:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379/0
API_PORT=9000
```

#### Shell Export

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
export REDIS_URL="redis://localhost:6379/0"
```

## Database Configuration

### DATABASE_URL

**Description**: Complete PostgreSQL connection string

**Format**: `postgresql://[user]:[password]@[host]:[port]/[database]`

**Default**: `postgresql://forecastin:forecastin_password@localhost:5432/forecastin`

**Example**:
```bash
DATABASE_URL=postgresql://forecastin:secure_password@postgres:5432/forecastin
```

**Notes**:
- Must include LTREE and PostGIS extension support
- Connection pooling handled by application
- TCP keepalives configured automatically

### DATABASE_HOST

**Description**: PostgreSQL server hostname

**Default**: `localhost`

**Example**:
```bash
DATABASE_HOST=postgres  # Docker service name
DATABASE_HOST=db.example.com  # Production host
```

### DATABASE_PORT

**Description**: PostgreSQL server port

**Default**: `5432`

**Example**:
```bash
DATABASE_PORT=5432
```

### DATABASE_USER

**Description**: PostgreSQL username

**Default**: `forecastin`

**Example**:
```bash
DATABASE_USER=forecastin
```

### DATABASE_PASSWORD

**Description**: PostgreSQL password

**Default**: `forecastin_password`

**Example**:
```bash
DATABASE_PASSWORD=secure_random_password_here
```

**Security**: Use strong passwords in production. Consider using secrets management.

### DATABASE_NAME

**Description**: PostgreSQL database name

**Default**: `forecastin`

**Example**:
```bash
DATABASE_NAME=forecastin_prod
```

### Database Connection Pool Settings

**Summary Table**:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POOL_MIN_SIZE` | `5` | Minimum number of connections in pool |
| `DB_POOL_MAX_SIZE` | `20` | Maximum number of connections in pool |
| `DB_COMMAND_TIMEOUT` | `60` | Command timeout in seconds |
| `DB_KEEPALIVES_IDLE` | `30` | TCP keepalive idle seconds |
| `DB_KEEPALIVES_INTERVAL` | `10` | TCP keepalive interval seconds |
| `DB_KEEPALIVES_COUNT` | `5` | TCP keepalive retry count |

**Example**:
```bash
DB_POOL_MIN_SIZE=5
DB_POOL_MAX_SIZE=20
DB_COMMAND_TIMEOUT=60
DB_KEEPALIVES_IDLE=30
DB_KEEPALIVES_INTERVAL=10
DB_KEEPALIVES_COUNT=5
```

**Notes**:
- Pool health monitored every 30 seconds
- 80% utilization triggers warnings
- Uses RLock for thread-safe connection management
- Exponential backoff retry mechanism for transient failures
- TCP keepalives prevent firewall connection drops

## Redis Configuration

### REDIS_URL

**Description**: Complete Redis connection string

**Format**: `redis://[host]:[port]/[db]`

**Default**: `redis://localhost:6379/0`

**Example**:
```bash
REDIS_URL=redis://redis:6379/0
REDIS_URL=redis://:password@redis:6379/0  # With password
```

**Notes**:
- Database 0 for production
- Database 1 for testing (recommended)
- Connection pooling enabled automatically

### REDIS_HOST

**Description**: Redis server hostname

**Default**: `localhost`

**Example**:
```bash
REDIS_HOST=redis
```

### REDIS_PORT

**Description**: Redis server port

**Default**: `6379`

**Example**:
```bash
REDIS_PORT=6379
```

### REDIS_DB

**Description**: Redis database number (0-15)

**Default**: `0`

**Example**:
```bash
REDIS_DB=0  # Production
REDIS_DB=1  # Testing
```

### REDIS_PASSWORD

**Description**: Redis authentication password (if enabled)

**Default**: None

**Example**:
```bash
REDIS_PASSWORD=secure_redis_password
```

### Advanced Redis Connection Pool Settings

**Summary Table**:

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_MAX_CONNECTIONS` | `10` | Maximum connection pool size |
| `REDIS_SOCKET_TIMEOUT` | `5` | Socket timeout in seconds |
| `REDIS_RETRY_ON_TIMEOUT` | `true` | Retry on timeout |
| `REDIS_HEALTH_CHECK_INTERVAL` | `30` | Health check interval in seconds |
| `REDIS_SOCKET_KEEPALIVE` | `true` | Enable socket keepalive |

**Example**:
```bash
REDIS_MAX_CONNECTIONS=10
REDIS_SOCKET_TIMEOUT=5
REDIS_RETRY_ON_TIMEOUT=true
REDIS_HEALTH_CHECK_INTERVAL=30
REDIS_SOCKET_KEEPALIVE=true
```

**Notes**:
- Connection pool shared across cache service instances
- Exponential backoff retry mechanism (0.5s, 1.0s, 2.0s)
- Health checks prevent using dead connections
- Keepalive prevents connection drops

### Cache TTL Settings

**Description**: Time-to-live for cached data

**Defaults**:
- L1 (Memory): No TTL (LRU eviction)
- L2 (Redis): 3600 seconds (1 hour)
- L3 (Database): No TTL
- L4 (Materialized Views): Manual refresh

**Example**:
```bash
CACHE_TTL_DEFAULT=3600
CACHE_TTL_ENTITIES=7200
CACHE_TTL_FEATURE_FLAGS=300
```

## API Configuration

### API_PORT

**Description**: Port for FastAPI server

**Default**: `9000`

**Example**:
```bash
API_PORT=9000
```

**Notes**:
- Must match docker-compose port mapping
- Frontend proxy configuration must match

### ENVIRONMENT

**Description**: Deployment environment

**Values**: `development`, `staging`, `production`

**Default**: `development`

**Example**:
```bash
ENVIRONMENT=production
```

**Effects**:
- `development`: Debug logging, auto-reload, CORS relaxed
- `staging`: Info logging, validation warnings
- `production`: Warning logging, strict security, monitoring

### PUBLIC_BASE_URL

**Description**: Public URL for API endpoints

**Default**: `http://localhost:9000`

**Example**:
```bash
PUBLIC_BASE_URL=https://api.forecastin.com
PUBLIC_BASE_URL=http://localhost:9000  # Development
```

**Notes**:
- Used for CORS validation
- Used in WebSocket URL generation
- Must match actual public-facing URL

### LOG_LEVEL

**Description**: Application logging level

**Values**: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`

**Default**: `INFO`

**Example**:
```bash
LOG_LEVEL=DEBUG  # Development
LOG_LEVEL=WARNING  # Production
```

## WebSocket Configuration

**Summary Table**:

| Variable | Default | Validation | Production Recommendation |
|----------|---------|------------|---------------------------|
| `WS_PING_INTERVAL` | `30` | Integer 10-300 | 30 (prevents proxy timeouts) |
| `WS_PING_TIMEOUT` | `10` | Integer 5-60 | 10 (quick failure detection) |
| `WS_PUBLIC_URL` | `ws://localhost:9000/ws` | Valid WebSocket URL | Use `wss://` with actual frontend domain |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated URLs | Set to actual frontend URLs (no wildcards) |

### WS_PING_INTERVAL

**Description**: Seconds between server ping messages

**Default**: `30`

**Example**:
```bash
WS_PING_INTERVAL=30  # Send ping every 30 seconds
```

**Notes**:
- Prevents proxy timeout disconnects
- Must be less than proxy idle timeout
- Recommended: 30s for most deployments

**Reference**: [README.md - WebSocket Hardening](../README.md#websocket-hardening)

### WS_PING_TIMEOUT

**Description**: Seconds to wait for pong response

**Default**: `10`

**Example**:
```bash
WS_PING_TIMEOUT=10
```

**Notes**:
- Connection considered dead if no pong received
- Should be less than `WS_PING_INTERVAL`

### WS_PUBLIC_URL

**Description**: Public WebSocket URL for client connections

**Format**: `ws://[host]:[port]/ws` or `wss://[host]:[port]/ws`

**Default**: `ws://localhost:9000/ws`

**Example**:
```bash
WS_PUBLIC_URL=wss://api.forecastin.com/ws  # Production with SSL
WS_PUBLIC_URL=ws://localhost:9000/ws  # Development
```

**Notes**:
- Use `wss://` for HTTPS sites (required by browsers)
- Use `ws://` for HTTP sites
- Must match `PUBLIC_BASE_URL` hostname

### ALLOWED_ORIGINS

**Description**: Comma-separated list of allowed CORS origins

**Default**: `http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080`

**Example**:
```bash
ALLOWED_ORIGINS=https://app.forecastin.com,https://staging.forecastin.com
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000  # Development
```

**Notes**:
- No wildcards in production
- Include all frontend URLs
- Must include protocol (http/https)

## Frontend Configuration

Frontend environment variables are prefixed with `REACT_APP_`.

### REACT_APP_API_URL

**Description**: Backend API base URL

**Default**: `http://localhost:9000`

**Example**:
```bash
REACT_APP_API_URL=https://api.forecastin.com
REACT_APP_API_URL=http://localhost:9000  # Development
```

**Build Time**: This variable is embedded at build time. Rebuild required for changes.

### REACT_APP_WS_URL

**Description**: WebSocket connection URL

**Default**: `ws://localhost:9000`

**Example**:
```bash
REACT_APP_WS_URL=wss://api.forecastin.com
REACT_APP_WS_URL=ws://localhost:9000  # Development
```

**Build Time**: This variable is embedded at build time. Rebuild required for changes.

**Notes**:
- Frontend dynamically constructs from `window.location` if not set
- See `frontend/src/config/env.ts` for runtime URL generation

### NODE_ENV

**Description**: Node.js environment mode

**Values**: `development`, `production`, `test`

**Default**: Set automatically by npm scripts

**Example**:
```bash
NODE_ENV=production
```

**Notes**:
- `development`: Development server, hot reload
- `production`: Optimized build, minification
- `test`: Test environment, mocks enabled

## RSS Ingestion Service

**Summary Table**:

| Variable | Default | Description |
|----------|---------|-------------|
| `RSS_BATCH_SIZE` | `50` | Number of articles to process in parallel |
| `RSS_PARALLEL_WORKERS` | `4` | Number of parallel worker threads |
| `RSS_MAX_RETRIES` | `3` | Maximum retry attempts for failed ingestions |
| `RSS_DEFAULT_TTL` | `86400` | Cache TTL in seconds (24 hours) |
| `RSS_MIN_DELAY` | `2.0` | Minimum delay between requests (seconds) |
| `RSS_MAX_DELAY` | `10.0` | Maximum delay for exponential backoff (seconds) |
| `RSS_USER_AGENT_ROTATION` | `true` | Enable user agent rotation |
| `RSS_ENABLE_ENTITY_EXTRACTION` | `true` | Enable 5-W entity extraction |
| `RSS_ENABLE_DEDUPLICATION` | `true` | Enable content deduplication (0.8 threshold) |
| `RSS_ENABLE_WEBSOCKET_NOTIFICATIONS` | `true` | Enable real-time WebSocket notifications |

### RSS_BATCH_SIZE

**Description**: Number of articles to process in parallel per batch

**Default**: `50`

**Example**:
```bash
RSS_BATCH_SIZE=50  # Process 50 articles per batch
```

**Notes**:
- Higher values increase throughput but use more memory
- Recommended: 50-100 for production

### RSS_PARALLEL_WORKERS

**Description**: Number of parallel worker threads for RSS ingestion

**Default**: `4`

**Example**:
```bash
RSS_PARALLEL_WORKERS=4  # 4 concurrent workers
```

**Notes**:
- Adjust based on CPU cores and network bandwidth
- Recommended: 4-8 for most deployments

### RSS_MAX_RETRIES

**Description**: Maximum retry attempts for failed ingestions

**Default**: `3`

**Example**:
```bash
RSS_MAX_RETRIES=3
```

**Notes**:
- Uses exponential backoff between retries
- Prevents infinite retry loops

### RSS_DEFAULT_TTL

**Description**: Cache TTL for RSS articles in seconds

**Default**: `86400` (24 hours)

**Example**:
```bash
RSS_DEFAULT_TTL=86400  # 24 hours
RSS_DEFAULT_TTL=3600   # 1 hour for frequently updated feeds
```

### RSS_MIN_DELAY

**Description**: Minimum delay between requests to prevent rate limiting

**Default**: `2.0` seconds

**Example**:
```bash
RSS_MIN_DELAY=2.0  # 2 second minimum delay
```

**Notes**:
- Part of anti-crawler strategy
- Prevents rate limiting from RSS sources

### RSS_MAX_DELAY

**Description**: Maximum delay for exponential backoff

**Default**: `10.0` seconds

**Example**:
```bash
RSS_MAX_DELAY=10.0  # Max 10 second backoff
```

**Notes**:
- Used during rate limit detection
- Prevents excessive waiting

### RSS_USER_AGENT_ROTATION

**Description**: Enable user agent rotation to avoid detection

**Default**: `true`

**Example**:
```bash
RSS_USER_AGENT_ROTATION=true
```

### RSS_ENABLE_ENTITY_EXTRACTION

**Description**: Enable 5-W (Who, What, Where, When, Why) entity extraction

**Default**: `true`

**Example**:
```bash
RSS_ENABLE_ENTITY_EXTRACTION=true
```

### RSS_ENABLE_DEDUPLICATION

**Description**: Enable content deduplication with 0.8 similarity threshold

**Default**: `true`

**Example**:
```bash
RSS_ENABLE_DEDUPLICATION=true
```

### RSS_ENABLE_WEBSOCKET_NOTIFICATIONS

**Description**: Enable real-time WebSocket notifications during RSS ingestion

**Default**: `true`

**Example**:
```bash
RSS_ENABLE_WEBSOCKET_NOTIFICATIONS=true
```

## Feature Flags

Feature flags are stored in the database but can have default overrides.

### FF_HIERARCHY_OPTIMIZED

**Description**: Enable LTREE hierarchy optimization

**Default**: `true` (100% rollout)

**Example**:
```bash
FF_HIERARCHY_OPTIMIZED=true
```

### FF_GEOSPATIAL_LAYERS

**Description**: Enable geospatial visualization layers

**Default**: `true` (100% rollout)

**Example**:
```bash
FF_GEOSPATIAL_LAYERS=true
```

### FF_RSS_INGESTION

**Description**: Enable RSS feed ingestion service

**Default**: `false` (not yet rolled out)

**Example**:
```bash
FF_RSS_INGESTION=true
```

### FF_AB_ROUTING

**Description**: Enable A/B testing framework

**Default**: `true` (100% rollout)

**Example**:
```bash
FF_AB_ROUTING=true
```

**Notes**: Feature flags in database override environment variables.

## Monitoring & Logging

### PROMETHEUS_PORT

**Description**: Port for Prometheus metrics

**Default**: `9090`

**Example**:
```bash
PROMETHEUS_PORT=9090
```

### GRAFANA_PORT

**Description**: Port for Grafana dashboard

**Default**: `3001`

**Example**:
```bash
GRAFANA_PORT=3001
```

**Note**: Default is 3001 to avoid conflict with frontend (3000)

### GRAFANA_ADMIN_PASSWORD

**Description**: Grafana admin user password

**Default**: `admin`

**Example**:
```bash
GRAFANA_ADMIN_PASSWORD=secure_grafana_password
```

**Security**: Change default password in production

### LOG_FILE_PATH

**Description**: Path to application log files

**Default**: `./logs/app.log`

**Example**:
```bash
LOG_FILE_PATH=/var/log/forecastin/app.log
```

### SENTRY_DSN

**Description**: Sentry error tracking DSN (future)

**Default**: None

**Example**:
```bash
SENTRY_DSN=https://[key]@sentry.io/[project]
```

## Security

### SECRET_KEY

**Description**: Application secret key for cryptographic operations

**Default**: Auto-generated (not recommended for production)

**Example**:
```bash
SECRET_KEY=your-256-bit-secret-key-here
```

**Security**:
- Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- Never commit to version control
- Rotate periodically in production

### JWT_SECRET

**Description**: JWT token signing secret (future authentication)

**Default**: None

**Example**:
```bash
JWT_SECRET=your-jwt-secret-key-here
```

### ENABLE_CORS

**Description**: Enable CORS middleware

**Default**: `true`

**Example**:
```bash
ENABLE_CORS=false  # Disable for same-origin only
```

## Environment-Specific Settings

### Development

```bash
ENVIRONMENT=development
LOG_LEVEL=DEBUG
DATABASE_URL=postgresql://forecastin:forecastin_password@localhost:5432/forecastin
REDIS_URL=redis://localhost:6379/0
API_PORT=9000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
PUBLIC_BASE_URL=http://localhost:9000
WS_PUBLIC_URL=ws://localhost:9000/ws
REACT_APP_API_URL=http://localhost:9000
REACT_APP_WS_URL=ws://localhost:9000
```

### Staging

```bash
ENVIRONMENT=staging
LOG_LEVEL=INFO
DATABASE_URL=postgresql://forecastin:secure_password@db-staging.internal:5432/forecastin_staging
REDIS_URL=redis://redis-staging.internal:6379/0
API_PORT=9000
ALLOWED_ORIGINS=https://staging.forecastin.com
PUBLIC_BASE_URL=https://api-staging.forecastin.com
WS_PUBLIC_URL=wss://api-staging.forecastin.com/ws
REACT_APP_API_URL=https://api-staging.forecastin.com
REACT_APP_WS_URL=wss://api-staging.forecastin.com
SECRET_KEY=<staging-secret-key>
```

### Production

```bash
ENVIRONMENT=production
LOG_LEVEL=WARNING
DATABASE_URL=postgresql://forecastin:${DB_PASSWORD}@db-prod.internal:5432/forecastin_prod
REDIS_URL=redis://redis-prod.internal:6379/0
API_PORT=9000
ALLOWED_ORIGINS=https://app.forecastin.com
PUBLIC_BASE_URL=https://api.forecastin.com
WS_PUBLIC_URL=wss://api.forecastin.com/ws
REACT_APP_API_URL=https://api.forecastin.com
REACT_APP_WS_URL=wss://api.forecastin.com
SECRET_KEY=<production-secret-key>
GRAFANA_ADMIN_PASSWORD=<secure-password>
SENTRY_DSN=<sentry-dsn>
```

## Example Configurations

### .env.example

Create this file for developers to copy:

```bash
# Database Configuration
DATABASE_URL=postgresql://forecastin:forecastin_password@localhost:5432/forecastin
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=forecastin
DATABASE_PASSWORD=forecastin_password
DATABASE_NAME=forecastin

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379

# API Configuration
API_PORT=9000
ENVIRONMENT=development
PUBLIC_BASE_URL=http://localhost:9000
LOG_LEVEL=DEBUG

# WebSocket Configuration
WS_PING_INTERVAL=30
WS_PING_TIMEOUT=10
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
WS_PUBLIC_URL=ws://localhost:9000/ws

# Frontend Configuration
REACT_APP_API_URL=http://localhost:9000
REACT_APP_WS_URL=ws://localhost:9000

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_ADMIN_PASSWORD=admin

# Feature Flags (optional overrides)
# FF_HIERARCHY_OPTIMIZED=true
# FF_GEOSPATIAL_LAYERS=true
# FF_RSS_INGESTION=false
```

### Docker Compose Override

Create `docker-compose.override.yml` for local development:

```yaml
version: '3.8'

services:
  api:
    environment:
      - LOG_LEVEL=DEBUG
      - WS_PING_INTERVAL=15  # Shorter interval for testing

  frontend:
    environment:
      - REACT_APP_API_URL=http://localhost:9000
```

## Validation

Validate your environment configuration:

```bash
# Check environment variables are set
python3 << EOF
import os
required_vars = ['DATABASE_URL', 'REDIS_URL', 'API_PORT']
missing = [var for var in required_vars if not os.getenv(var)]
if missing:
    print(f"Missing required variables: {missing}")
else:
    print("All required variables set!")
EOF
```

## Troubleshooting

### Variable Not Taking Effect

1. Check variable name (case-sensitive)
2. Restart application/containers
3. Check docker-compose.yml vs .env priority
4. Frontend variables require rebuild

### Database Connection Issues

Check `DATABASE_URL` format:
```bash
# Correct
postgresql://user:pass@host:5432/db

# Wrong
postgres://user:pass@host:5432/db  # Should be postgresql://
```

### CORS Errors

Ensure `ALLOWED_ORIGINS` includes exact frontend URL:
```bash
# Includes protocol and port
ALLOWED_ORIGINS=http://localhost:3000

# Not just
ALLOWED_ORIGINS=localhost:3000  # Wrong
```

### WebSocket Connection Fails

1. Check `WS_PUBLIC_URL` matches protocol (`ws://` vs `wss://`)
2. Ensure `ALLOWED_ORIGINS` includes frontend URL
3. Verify `WS_PING_INTERVAL` is less than proxy timeout

## Security Best Practices

1. ✅ **Never commit .env files to version control**
   ```bash
   echo ".env" >> .gitignore
   ```

2. ✅ **Use secrets management in production**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets

3. ✅ **Rotate secrets regularly**
   - Database passwords
   - API keys
   - JWT secrets

4. ✅ **Use strong passwords**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

5. ✅ **Restrict CORS origins in production**
   ```bash
   # Bad
   ALLOWED_ORIGINS=*

   # Good
   ALLOWED_ORIGINS=https://app.forecastin.com
   ```

## References

- [Docker Compose Environment Variables](https://docs.docker.com/compose/environment-variables/)
- [Twelve-Factor App: Config](https://12factor.net/config)
- [GOLDEN_SOURCE.md](GOLDEN_SOURCE.md) - Project configuration
- [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md) - Development setup

---

**Need help?** Check [TROUBLESHOOTING.md](../README.md#common-issues-and-solutions) or open a GitHub issue.
