# WebSocket Browser Connectivity Fix - Summary

## Problem Diagnosis

**Root Cause:** Frontend was built with Docker-internal hostname `ws://api:9000` baked into the bundle at compile time. This hostname only exists inside the Docker network and is unreachable from the browser.

**Symptom:** Browser console showed repeated WebSocket connection failures with "ERR_NAME_NOT_RESOLVED" or similar errors when trying to connect to `ws://api:9000/ws/{client_id}`.

## Solution Implemented

### 1. Runtime Configuration (NEW)
Created [`frontend/src/config/env.ts`](frontend/src/config/env.ts:1) to derive WebSocket URLs from `window.location` at runtime:

```typescript
// Derives URLs from browser location, not Docker-internal names
const wsBase = `${isHttps ? 'wss' : 'ws'}://${window.location.hostname}:${apiPort}`;
```

**Key Benefits:**
- Browser connects to `ws://localhost:9000` (reachable)
- HTTPS pages automatically use `wss://`
- Port-aware (defaults to 9000)
- Supports production reverse proxy scenarios

### 2. Updated WebSocket Hook
Modified [`frontend/src/hooks/useWebSocket.ts`](frontend/src/hooks/useWebSocket.ts:11) to use runtime config:

**Before:**
```typescript
const baseUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:9000/ws';
const wsUrl = `${baseUrl}/${clientId}`;
```

**After:**
```typescript
import { getWebSocketUrl } from '../config/env';
const wsUrl = options.url || getWebSocketUrl(clientId);
```

**Enhanced Diagnostics:**
- Added detailed logging of WebSocket URL construction
- Close code and reason logging
- Readystate tracking in error handlers

### 3. Docker Compose Fix
Updated [`docker-compose.yml`](docker-compose.yml:73) to remove Docker-internal URLs:

**Before:**
```yaml
args:
  - REACT_APP_API_URL=http://api:9000
  - REACT_APP_WS_URL=ws://api:9000  # ❌ BROKEN
```

**After:**
```yaml
args:
  - REACT_APP_API_PORT=9000  # ✅ FIXED
# Frontend derives URLs from window.location at runtime
```

### 4. Backend CORS Verification
Confirmed [`api/main.py:241`](api/main.py:241) has proper CORS middleware:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Testing Instructions

### 1. Rebuild and Start Services
```bash
docker-compose down
docker-compose up --build -d
```

### 2. Verify Services Running
```bash
docker-compose ps
# All services should show "Up" status
```

### 3. Browser Testing

**Access Frontend:**
- Open http://localhost:3000 in browser
- Open DevTools (F12)

**Check Console Logs:**
Look for these diagnostic messages:
```
[RUNTIME CONFIG] Environment configuration: {...}
[useWebSocket] Connecting to: ws://localhost:9000/ws/ws_client_...
[useWebSocket] WebSocket closed - code: 1000, reason: "..."
```

**Check Network Tab:**
1. Filter by "WS" or "WebSockets"
2. Look for connection to `ws://localhost:9000/ws/{client_id}`
3. Verify status shows "101 Switching Protocols" (success)

**Expected Success Indicators:**
- ✅ WebSocket URL uses `localhost:9000` (not `api:9000`)
- ✅ Connection shows "101 Switching Protocols"
- ✅ No repeated connection error spam
- ✅ Console shows "[useWebSocket] WebSocket closed" with clean reason

**Expected Failure Indicators (if not fixed):**
- ❌ Connection to `ws://api:9000` (wrong hostname)
- ❌ ERR_NAME_NOT_RESOLVED
- ❌ Repeated connection attempts with exponential backoff

### 4. API Health Check
```bash
curl http://localhost:9000/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "cache": "healthy",
    "websocket": "active: 0"
  }
}
```

## Architecture Changes

### Before (Broken)
```
Browser → ws://api:9000/ws/... → DNS Lookup Fails ❌
         (Docker-internal hostname unreachable from browser)
```

### After (Fixed)
```
Browser → ws://localhost:9000/ws/... → FastAPI Backend ✅
         (Browser-accessible hostname)
```

### Production Deployment (Optional Reverse Proxy)

For production, use same-origin WebSocket via reverse proxy:

**Nginx Example:**
```nginx
location /api/ { proxy_pass http://backend:9000/; }
location /ws/ {
  proxy_pass http://backend:9000/ws/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "Upgrade";
}
```

Then frontend config uses:
```typescript
const wsBase = window.location.origin.replace('http', 'ws');
const wsPath = '/ws';
```

## Files Modified

1. **NEW:** [`frontend/src/config/env.ts`](frontend/src/config/env.ts:1) - Runtime URL configuration
2. **MODIFIED:** [`frontend/src/hooks/useWebSocket.ts`](frontend/src/hooks/useWebSocket.ts:11) - Use runtime config
3. **MODIFIED:** [`docker-compose.yml`](docker-compose.yml:73) - Remove Docker-internal URLs
4. **VERIFIED:** [`api/main.py:241`](api/main.py:241) - CORS middleware correct

## Key Takeaways

1. **Docker networking ≠ Browser networking:** Container service names work between containers but not from browser
2. **Runtime > Compile-time:** Derive URLs from `window.location` rather than baking them into the bundle
3. **Protocol awareness:** Use `window.location.protocol` to auto-detect HTTP vs HTTPS
4. **Diagnostics matter:** Added comprehensive logging to debug future WebSocket issues

## Rollback Procedure

If issues occur, revert to previous configuration:
```bash
git checkout HEAD -- frontend/src/config/env.ts
git checkout HEAD -- frontend/src/hooks/useWebSocket.ts  
git checkout HEAD -- docker-compose.yml
docker-compose down && docker-compose up --build -d
```

## Next Steps

- [ ] User verifies WebSocket connection in browser Network tab
- [ ] User confirms no console error spam
- [ ] User tests actual WebSocket message exchange (echo)
- [ ] Optional: Set up reverse proxy for production deployment