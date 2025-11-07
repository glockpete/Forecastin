# WebSocket Server Diagnostics Playbook

## Overview

This playbook helps diagnose and resolve persistent WebSocket disconnects, especially **close code 1006** (Abnormal Closure), when the frontend connects to `ws://localhost:9000/ws`.

Close code 1006 indicates the connection was closed abnormally without a proper close frame, often due to:
- Network interruptions
- Proxy/load balancer timeouts
- Missing WebSocket upgrade headers
- Mixed content (HTTPS page trying to connect to WS instead of WSS)
- Idle connection timeouts
- Server crashes or restarts

---

## Symptoms → Causes Matrix

| Symptom | Likely Cause | Diagnostic Steps | Fix |
|---------|--------------|------------------|-----|
| **1006 immediately on connect** | Origin not allowed, proxy missing Upgrade headers | Check server logs for `[WS_DIAGNOSTICS]`, verify nginx config | Add origin to `ALLOWED_ORIGINS`, fix nginx `proxy_set_header Upgrade` |
| **1006 after ~60 seconds idle** | Proxy idle timeout, missing server heartbeat | Check nginx `proxy_read_timeout`, verify `WS_PING_INTERVAL` | Increase `proxy_read_timeout` to 300s+, set `WS_PING_INTERVAL=30` |
| **1006 with mixed content warning** | HTTPS page connecting to WS (not WSS) | Check browser console for mixed content errors | Use `wss://` URL in production, ensure `X-Forwarded-Proto: https` |
| **1006 random during usage** | Network instability, server resource exhaustion | Monitor server CPU/memory, check for OOM kills | Scale server resources, implement connection pooling |
| **Connection never establishes** | Firewall blocking port 9000, server not running | `curl http://localhost:9000/health`, check firewall rules | Verify server running, open port 9000, check `ufw`/`iptables` |
| **403 Forbidden on connect** | Origin validation failed | Check `[WS_DIAGNOSTICS]` logs for origin rejection | Add frontend origin to `ALLOWED_ORIGINS` env var |
| **Connects but no messages** | Client/server serialization mismatch | Test with `/ws/echo` endpoint, check message format | Ensure JSON serialization, verify `orjson` installed |
| **Intermittent 1006 behind proxy** | Proxy not forwarding headers, buffering issues | Check `X-Forwarded-*` headers in logs, nginx buffering | Add proper proxy headers, disable `proxy_buffering` |

---

## Diagnostic Checklist

### 1. Server-Side Checks

#### Check Server Logs
```bash
# Tail logs for WebSocket diagnostics
docker-compose logs -f api | grep WS_DIAGNOSTICS

# Look for connection attempts
grep "CONNECTION ATTEMPT START" api.log

# Check for close codes
grep "disconnected - code=" api.log
```

**What to look for:**
- `[WS_DIAGNOSTICS] 403 FORBIDDEN` → Origin not allowed
- `close_code=1006` → Abnormal closure
- `X-Forwarded-Proto: none` → Proxy not forwarding headers
- `Origin: no_origin` → Missing origin header

#### Verify Server Configuration
```bash
# Check environment variables are loaded
docker-compose exec api env | grep WS_

# Expected output:
# WS_PING_INTERVAL=30
# WS_PING_TIMEOUT=10
# WS_PUBLIC_URL=ws://localhost:9000/ws
```

#### Test Endpoints Directly
```bash
# Test echo endpoint with wscat
npm install -g wscat
wscat -c ws://localhost:9000/ws/echo

# Expected: Welcome message with config
# {"type":"welcome","endpoint":"/ws/echo",...}

# Test health endpoint
wscat -c ws://localhost:9000/ws/health

# Expected: Health status with heartbeat config
# {"type":"health_status","status":"connected",...}

# Send echo test
> {"type":"test","data":"hello"}
# Expected: Echo response
< {"type":"echo","original":{"type":"test","data":"hello"},...}
```

---

### 2. Proxy/Load Balancer Checks

#### Nginx Configuration
Ensure nginx is properly configured for WebSocket upgrade:

```nginx
location /ws {
    proxy_pass http://backend:9000;

    # CRITICAL: WebSocket upgrade headers
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Forward client information
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;

    # CRITICAL: Generous timeout for long-lived connections
    proxy_read_timeout 300s;
    proxy_connect_timeout 10s;
    proxy_send_timeout 30s;

    # Disable buffering for real-time updates
    proxy_buffering off;
}
```

**Common nginx mistakes:**
- Missing `Upgrade` and `Connection` headers → 1006 immediately
- `proxy_read_timeout` too low (default 60s) → 1006 after idle period
- `proxy_buffering on` → delayed messages or timeouts

#### Verify Nginx Headers
```bash
# Check if nginx is forwarding headers correctly
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost/ws/health

# Should see:
# HTTP/1.1 101 Switching Protocols
# Upgrade: websocket
# Connection: upgrade
```

---

### 3. Client-Side Checks

#### Browser Developer Console
```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:9000/ws/echo');

ws.onopen = () => console.log('Connected');
ws.onclose = (event) => {
  console.log('Close code:', event.code, 'Reason:', event.reason);
  if (event.code === 1006) {
    console.error('Abnormal closure - check server logs and proxy config');
  }
};
ws.onerror = (err) => console.error('WebSocket error:', err);

// Send test message
ws.send(JSON.stringify({type: 'test', data: 'hello'}));
```

#### Mixed Content Warnings
If site is HTTPS but WebSocket URL is `ws://`:
```
Mixed Content: The page at 'https://example.com' was loaded over HTTPS,
but attempted to connect to the insecure WebSocket endpoint 'ws://...'.
This request has been blocked; this endpoint must be available over WSS.
```

**Fix:** Use `wss://` for HTTPS sites
```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//example.com/ws`);
```

---

### 4. Network Checks

#### Port Accessibility
```bash
# Check if port 9000 is listening
netstat -tuln | grep 9000
# Expected: tcp  0  0  0.0.0.0:9000  0.0.0.0:*  LISTEN

# Test connectivity
nc -zv localhost 9000
# Expected: Connection to localhost 9000 port [tcp/*] succeeded!

# Test from outside Docker network (if applicable)
curl -v http://localhost:9000/health
```

#### Firewall Rules
```bash
# Check UFW (Ubuntu)
sudo ufw status
sudo ufw allow 9000/tcp

# Check iptables
sudo iptables -L -n | grep 9000

# Check Docker network
docker network inspect forecastin_default
```

---

## Common Scenarios and Solutions

### Scenario 1: 1006 After 60 Seconds Idle

**Symptoms:**
- Connection works initially
- After ~60 seconds of no activity, connection closes with 1006
- Server logs show no error, just disconnect

**Diagnosis:**
```bash
# Check nginx timeout
grep proxy_read_timeout /etc/nginx/sites-enabled/default

# Check server heartbeat config
docker-compose exec api env | grep WS_PING_INTERVAL
```

**Solution:**
1. Set server heartbeat to send pings before timeout:
   ```bash
   # In docker-compose.yml or .env
   WS_PING_INTERVAL=30  # Send ping every 30 seconds
   ```

2. Increase nginx timeout:
   ```nginx
   proxy_read_timeout 300s;  # 5 minutes
   ```

3. Restart services:
   ```bash
   docker-compose restart nginx api
   ```

---

### Scenario 2: 1006 Immediately on Connect (Proxy Issue)

**Symptoms:**
- Connection closes immediately with 1006
- No messages exchanged
- Server logs show connection attempt but no upgrade

**Diagnosis:**
```bash
# Test direct connection (bypassing proxy)
wscat -c ws://localhost:9000/ws/echo

# If direct works but proxied fails:
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost/ws/echo
```

**Solution:**
Add WebSocket upgrade headers to nginx:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_http_version 1.1;
```

---

### Scenario 3: Mixed Content (HTTPS + WS)

**Symptoms:**
- Browser console shows mixed content warning
- Connection never establishes
- No server logs (connection blocked by browser)

**Solution:**
1. Use `wss://` for HTTPS sites:
   ```bash
   # Set in environment
   WS_PUBLIC_URL=wss://yourdomain.com/ws
   ```

2. Ensure nginx terminates SSL and forwards correctly:
   ```nginx
   server {
       listen 443 ssl;
       server_name yourdomain.com;

       location /ws {
           proxy_pass http://backend:9000;
           proxy_set_header X-Forwarded-Proto $scheme;  # Pass https
           # ... other WebSocket headers
       }
   }
   ```

---

### Scenario 4: Origin Not Allowed (403 Forbidden)

**Symptoms:**
- Server logs show `[WS_DIAGNOSTICS] 403 FORBIDDEN: Origin not in allowed list`
- Connection closes immediately with code 1008

**Solution:**
```bash
# Add frontend origin to allowed list
# In docker-compose.yml:
environment:
  ALLOWED_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000,https://yourdomain.com"

# Restart
docker-compose restart api
```

---

## Environment Variable Reference

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `WS_PING_INTERVAL` | `30` | Seconds between server-initiated pings | `WS_PING_INTERVAL=30` |
| `WS_PING_TIMEOUT` | `10` | Seconds to wait for pong before timeout | `WS_PING_TIMEOUT=10` |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated list of allowed origins | `ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com` |
| `PUBLIC_BASE_URL` | `http://localhost:9000` | Public base URL for API | `PUBLIC_BASE_URL=https://api.example.com` |
| `WS_PUBLIC_URL` | `ws://localhost:9000/ws` | Public WebSocket URL for clients | `WS_PUBLIC_URL=wss://api.example.com/ws` |

---

## Testing Tools

### wscat (Node.js)
```bash
npm install -g wscat

# Connect to echo endpoint
wscat -c ws://localhost:9000/ws/echo

# Send message
> {"type":"test","data":"hello"}

# Expect echo response
< {"type":"echo","original":{"type":"test","data":"hello"},...}
```

### websocat (Rust)
```bash
# Install
cargo install websocat
# or: brew install websocat

# Connect with auto-reconnect
websocat -v ws://localhost:9000/ws/health

# Expect heartbeat messages every WS_PING_INTERVAL seconds
```

### Python Test Script
```python
import asyncio
import websockets
import json

async def test_echo():
    uri = "ws://localhost:9000/ws/echo"
    async with websockets.connect(uri) as websocket:
        # Receive welcome
        welcome = await websocket.recv()
        print(f"Welcome: {welcome}")

        # Send test
        await websocket.send(json.dumps({"type": "test", "data": "hello"}))

        # Receive echo
        response = await websocket.recv()
        print(f"Echo: {response}")

asyncio.run(test_echo())
```

---

## Success Criteria

A healthy WebSocket connection should:

1. ✅ Establish without 1006 errors
2. ✅ Stay open for >30 seconds with idle timeout
3. ✅ Receive server heartbeats every `WS_PING_INTERVAL` seconds
4. ✅ Handle message round-trips with <100ms latency
5. ✅ Close gracefully with code 1000 (normal closure)
6. ✅ Show proper headers in logs:
   - `X-Forwarded-Proto: https` (if behind HTTPS proxy)
   - `Origin: https://yourdomain.com`
   - `Upgrade: websocket`

---

## Automated Testing

Run the test suite to verify WebSocket robustness:

```bash
cd api
pytest tests/test_ws_echo.py tests/test_ws_health.py -v

# Expected: All tests pass
# - test_echo_connection_establishment PASSED
# - test_echo_basic_round_trip PASSED
# - test_health_connection_establishment PASSED
# - test_health_heartbeat_tracking PASSED
# ... etc
```

If tests fail:
1. Check `WS_PING_INTERVAL` and `WS_PING_TIMEOUT` are set
2. Verify `ALLOWED_ORIGINS` includes test client
3. Check server logs for errors
4. Ensure orjson is installed (`pip install orjson`)

---

## Further Reading

- [RFC 6455 - WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [MDN WebSocket Close Codes](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code)
- [Nginx WebSocket Proxying](http://nginx.org/en/docs/http/websocket.html)
- [FastAPI WebSocket Documentation](https://fastapi.tiangolo.com/advanced/websockets/)

---

## Support

If issues persist after following this playbook:

1. Collect diagnostics:
   ```bash
   # Server logs
   docker-compose logs api > api.log

   # Nginx logs (if applicable)
   docker-compose logs nginx > nginx.log

   # Environment config
   docker-compose exec api env | grep -E "WS_|ALLOWED_ORIGINS" > env.txt
   ```

2. Test with diagnostic endpoints:
   ```bash
   # Echo test (should return message immediately)
   wscat -c ws://localhost:9000/ws/echo

   # Health test (should stay connected >30s with heartbeats)
   wscat -c ws://localhost:9000/ws/health
   ```

3. Share logs and environment config with team for analysis.
