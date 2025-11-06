# Frontend Multi-Stage Dockerfile Optimization Guide

## Overview

This document describes the optimized multi-stage Docker setup for the Forecastin frontend React + TypeScript + Deck.gl application. The implementation separates build and runtime concerns, reduces image size, and maintains all functionality.

## File Structure

```
frontend/
├── Dockerfile              # Production multi-stage build
├── Dockerfile.dev          # Development with hot reloading
├── nginx.conf              # Main nginx configuration
├── frontend-nginx.conf     # Frontend-specific nginx rules
└── .dockerignore          # Build context optimization
```

## Production Dockerfile Architecture

### Stage 1: Builder (Build Environment)

**Base Image:** `node:18-alpine`

**Purpose:** Compile TypeScript, bundle React application with Webpack, and optimize static assets

**Key Features:**
- Uses `npm ci --only=production` for deterministic builds
- Excludes devDependencies from final image
- Leverages Docker layer caching for package installations
- Configurable build arguments for environment variables

**Build Arguments:**
```dockerfile
ARG NODE_ENV=production
ARG REACT_APP_API_URL=http://localhost:9000
ARG REACT_APP_WS_URL=ws://localhost:9000
```

**Output:** Compiled static assets in `/app/build` directory

### Stage 2: Runtime (Nginx Server)

**Base Image:** `nginx:1.25-alpine`

**Purpose:** Serve static assets with optimized nginx configuration

**Key Features:**
- Minimal runtime footprint (~50MB vs ~500MB development)
- Non-root user execution for security
- Health check endpoint for container orchestration
- Optimized nginx configuration for SPA routing

**Security Enhancements:**
- Non-root user (`nginx`) execution
- Removed server tokens
- Security headers (X-Frame-Options, CSP, etc.)
- Rate limiting for API and static assets

## Development Dockerfile Architecture

**Base Image:** `node:18-alpine`

**Purpose:** Hot-reloading development server with debugging capabilities

**Key Features:**
- Multi-stage dependency installation for layer caching
- All dependencies including devDependencies
- Non-root user for security
- Health check for development container
- Volume mounting for hot reloading

**Usage:**
```bash
docker build -f Dockerfile.dev -t forecastin-frontend:dev .
docker run -p 3000:3000 -v $(pwd)/src:/app/src forecastin-frontend:dev
```

## Nginx Configuration

### Main Configuration ([`nginx.conf`](frontend/nginx.conf:1))

**Performance Optimizations:**
- Worker process auto-scaling
- Epoll event model for efficient I/O
- Sendfile and TCP optimizations
- Gzip compression for text assets

**Security Headers:**
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- X-Content-Type-Options: nosniff
- Content-Security-Policy for XSS prevention

**Rate Limiting Zones:**
- `api`: 10 requests/second
- `static`: 30 requests/second

### Frontend Configuration ([`frontend-nginx.conf`](frontend/frontend-nginx.conf:1))

**Static Asset Caching:**
- **Long-term cache** (1 year): JS, CSS, images, fonts
- **Short-term cache** (1 hour): Manifest, service workers
- **Medium-term cache** (30 days): GeoJSON, map tiles

**SPA Routing:**
- Fallback to `index.html` for client-side routing
- No caching for HTML files (always fresh)

**API Proxying:**
- WebSocket support with extended timeouts
- Proxy headers for real IP forwarding
- Error handling with custom error pages

**WebSocket Support:**
- Upgrade header handling
- 24-hour connection timeout
- Buffering disabled for real-time data

**Health Check:**
- `/health` endpoint for container orchestration
- No logging for health checks

## Build Optimization Strategies

### Layer Caching Strategy

1. **Package files first:** Maximize Docker layer cache reuse
2. **Dependencies separately:** Install before copying source code
3. **Source code last:** Most frequently changing layer

**Dockerfile Order:**
```dockerfile
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
```

### .dockerignore Optimization

**Excluded from build context:**
- Test files and test directories
- Development configurations
- Documentation files
- Build artifacts (will be regenerated)
- IDE configurations
- Git repository

**Retained for builds:**
- `package.json` and `package-lock.json` (deterministic builds)
- `tsconfig.json` (TypeScript compilation)
- Nginx configuration files
- Source code (`src/` directory)

### Image Size Reduction

**Techniques:**
1. **Alpine base images:** ~5MB vs ~200MB for full Node.js
2. **Multi-stage builds:** Only runtime dependencies in final image
3. **Production dependencies only:** Excludes devDependencies
4. **Cache cleaning:** `npm cache clean --force`

**Size Comparison:**
- Development image: ~500MB (all dependencies + dev tools)
- Production image: ~50MB (static assets + nginx)
- Size reduction: **90% smaller**

## Environment Configuration

### Build Arguments

Pass environment-specific values during build:

```bash
docker build \
  --build-arg REACT_APP_API_URL=https://api.production.com \
  --build-arg REACT_APP_WS_URL=wss://api.production.com \
  -t forecastin-frontend:prod \
  .
```

### Runtime Environment Variables

For nginx configuration (defined in docker-compose):

```yaml
environment:
  - NGINX_WORKER_PROCESSES=auto
  - NGINX_WORKER_CONNECTIONS=1024
```

## Build and Deployment

### Production Build

```bash
# Build the image
docker build -t forecastin-frontend:latest -f Dockerfile .

# Run the container
docker run -p 80:80 forecastin-frontend:latest

# With environment variables
docker run -p 80:80 \
  --env-file .env.production \
  forecastin-frontend:latest
```

### Development Build

```bash
# Build development image
docker build -t forecastin-frontend:dev -f Dockerfile.dev .

# Run with hot reloading
docker run -p 3000:3000 \
  -v $(pwd)/src:/app/src \
  forecastin-frontend:dev
```

### Docker Compose Integration

```yaml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - REACT_APP_API_URL=http://api:9000
        - REACT_APP_WS_URL=ws://api:9000
    ports:
      - "80:80"
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

## Performance Considerations

### Caching Strategy

**Static Assets:**
- **Immutable assets** (hashed filenames): 1-year cache
- **Manifest files**: 1-hour cache for update detection
- **HTML files**: No cache (always fetch latest)

**Geospatial Data:**
- GeoJSON files: 30-day cache
- Map tiles: Configurable caching
- Access-Control-Allow-Origin for cross-origin requests

### Compression

**Gzip Enabled For:**
- Text: HTML, CSS, JavaScript
- JSON: Application data, manifests
- SVG: Vector graphics
- Minimum size: 10KB (avoid overhead for small files)

**Gzip Disabled For:**
- Pre-compressed files (`.br`, `.gz`)
- Images (already compressed)
- Video/audio files

## Security Best Practices

### Container Security

1. **Non-root user execution:** Both build and runtime stages
2. **Minimal base images:** Alpine Linux reduces attack surface
3. **No unnecessary packages:** Only required runtime dependencies
4. **Security headers:** Comprehensive HTTP security headers

### Nginx Security

1. **Server tokens disabled:** Hide nginx version
2. **Rate limiting:** Prevent DoS attacks
3. **Client size limits:** 10MB max body size
4. **Timeout controls:** Prevent resource exhaustion

### Content Security Policy

```
default-src 'self' http: https: ws: wss: data: blob: 'unsafe-inline' 'unsafe-eval';
frame-ancestors 'self';
```

**Note:** CSP allows geospatial data sources and WebSocket connections required for Deck.gl

## Monitoring and Health Checks

### Health Check Configuration

**Development:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1
```

**Production:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1
```

### Health Endpoint

- Path: `/health`
- Method: GET
- Response: `200 OK` with body `"healthy\n"`
- No access logging to reduce noise

## Troubleshooting

### Common Build Issues

**Problem:** `npm ci` fails with dependency errors
**Solution:** Delete `node_modules` and ensure `package-lock.json` is committed

**Problem:** Build stage runs out of memory
**Solution:** Increase Docker memory limit or use `--max-old-space-size` flag

**Problem:** Static assets not found after build
**Solution:** Verify `build/` directory exists and contains assets

### Runtime Issues

**Problem:** 404 errors on client-side routes
**Solution:** Ensure nginx `try_files` directive includes `/index.html` fallback

**Problem:** WebSocket connections failing
**Solution:** Check nginx upgrade headers and API proxy configuration

**Problem:** CORS errors on API calls
**Solution:** Verify proxy configuration forwards correct headers

## Performance Metrics

### Expected Performance

**Build Time:**
- Initial build: ~2-3 minutes (cold cache)
- Incremental build: ~30-60 seconds (warm cache)

**Image Sizes:**
- Builder stage: ~500MB (not persisted)
- Final production image: ~50MB
- Development image: ~500MB

**Runtime Performance:**
- First contentful paint: <1.5s
- Time to interactive: <3.5s
- Static asset delivery: <100ms (with CDN)

## Integration with Forecastin Architecture

### WebSocket Layer Integration

The nginx configuration supports the project's WebSocket layer for real-time geospatial updates:

- Upgrade header forwarding for WebSocket connections
- Extended timeout (24 hours) for persistent connections
- Buffering disabled for real-time data streaming

### Hybrid State Management Support

The configuration supports the frontend's hybrid state management:

- React Query: API proxying with proper caching headers
- Zustand: Client-side state (no server config needed)
- WebSocket: Real-time state fed through nginx proxy

### Deck.gl Geospatial Optimization

**GeoJSON/TopoJSON caching:** 30-day cache with CORS headers
**Map tile support:** Configurable caching and compression
**Large payload handling:** 10MB max body size for geospatial data

## Future Enhancements

### Potential Optimizations

1. **Brotli compression:** Better compression than gzip for text assets
2. **HTTP/2 Server Push:** Push critical assets before request
3. **Service Worker integration:** Offline-first PWA capabilities
4. **CDN integration:** Static asset delivery optimization

### Monitoring Integration

1. **Prometheus metrics:** Export nginx metrics for monitoring
2. **Access log analysis:** ELK stack integration
3. **Performance monitoring:** Real User Monitoring (RUM)
4. **Error tracking:** Sentry integration for client errors

## References

- Docker multi-stage builds: https://docs.docker.com/build/building/multi-stage/
- Nginx optimization: https://www.nginx.com/blog/tuning-nginx/
- React build optimization: https://create-react-app.dev/docs/production-build/
- Deck.gl performance: https://deck.gl/docs/developer-guide/performance

## Changelog

- **v1.0.0** (2025-11-06): Initial multi-stage Dockerfile implementation
  - Separated build and runtime stages
  - Added nginx configuration for SPA routing
  - Implemented security headers and rate limiting
  - Created development Dockerfile variant
  - Optimized .dockerignore for build context