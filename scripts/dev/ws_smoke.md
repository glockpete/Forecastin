# WebSocket Smoke Test Documentation

## Overview

This document describes how to perform manual and automated WebSocket smoke tests to verify connection stability and prevent close code 1006 (abnormal closure).

---

## Quick Start

### Automated Testing (websocat)

```bash
# Install websocat
cargo install websocat
# OR on macOS:
brew install websocat

# Run smoke test script
./scripts/dev/ws_smoke.sh

# Test specific URL
./scripts/dev/ws_smoke.sh wss://api.yourdomain.com
```

### Manual Testing (wscat)

```bash
# Install wscat
npm install -g wscat

# Run smoke test script for guided manual testing
./scripts/dev/ws_smoke.sh

# Or test directly:
wscat -c ws://localhost:9000/ws/echo
```

---

## Test Scenarios

### 1. Echo Endpoint Test

**Purpose:** Verify basic WebSocket connectivity and message round-trip.

**Steps:**
```bash
wscat -c ws://localhost:9000/ws/echo
```

**Expected Success Transcript:**
```
Connected (press CTRL+C to quit)
< {"type":"welcome","endpoint":"/ws/echo","client_id":"echo_client_1699564800123_12345","server_time":1699564800.123,"config":{"ping_interval":30,"ping_timeout":10}}

> {"type":"test","data":"hello"}
< {"type":"echo","original":{"type":"test","data":"hello"},"server_timestamp":1699564801.234,"client_id":"echo_client_1699564800123_12345","latency_info":{"received_at":1699564801.234,"connection_age_ms":1111.5}}

> {"type":"ping"}
< {"type":"echo","original":{"type":"ping"},...}
```

**Expected Behavior:**
1. ✅ Connection establishes immediately
2. ✅ Receive welcome message with config
3. ✅ Echo messages are returned with original payload
4. ✅ Server includes latency_info in response
5. ✅ Connection stays alive indefinitely
6. ✅ Press Ctrl+C closes with code 1000 (normal)

**Failure Indicators:**
- ❌ Connection closes immediately (code 1006) → Check nginx config, allowed origins
- ❌ No welcome message → Server not running or endpoint misconfigured
- ❌ Echo not received → Message serialization issue
- ❌ Connection drops after 60s → Proxy timeout, insufficient ping interval

---

### 2. Health Endpoint Test

**Purpose:** Verify sustained connection with heartbeat delivery.

**Steps:**
```bash
wscat -c ws://localhost:9000/ws/health
```

**Expected Success Transcript:**
```
Connected (press CTRL+C to quit)
< {"type":"health_status","status":"connected","client_id":"health_client_1699564800456_67890","server_time":1699564800.456,"config":{"ping_interval":30,"ping_timeout":10,"expected_min_connection_duration":30},"environment":{"allowed_origins":["http://localhost:3000","http://127.0.0.1:3000"],"public_base_url":"http://localhost:9000","ws_public_url":"ws://localhost:9000/ws"}}

# Wait ~30 seconds...
< {"type":"heartbeat","ping_number":1,"timestamp":1699564830.456,"connection_age_seconds":30.0,"client_id":"health_client_1699564800456_67890"}

# Wait another ~30 seconds...
< {"type":"heartbeat","ping_number":2,"timestamp":1699564860.456,"connection_age_seconds":60.0,"client_id":"health_client_1699564800456_67890"}

> {"type":"get_status"}
< {"type":"health_status","status":"healthy","connection_age_seconds":65.2,"ping_count":2,"pong_count":0,"timestamp":1699564865.656,"client_id":"health_client_1699564800456_67890"}
```

**Expected Behavior:**
1. ✅ Connection establishes with health_status message
2. ✅ Environment config is exposed (allowed_origins, etc.)
3. ✅ Heartbeat messages arrive every WS_PING_INTERVAL seconds (default 30s)
4. ✅ Connection stays alive for >60 seconds
5. ✅ get_status request returns current metrics (ping_count, connection_age)
6. ✅ Close with Ctrl+C gives code 1000

**Failure Indicators:**
- ❌ No heartbeat after 30s → WS_PING_INTERVAL not configured or server issue
- ❌ Connection drops after 60s → Nginx proxy_read_timeout too low
- ❌ Heartbeat count doesn't increment → Server heartbeat loop not running
- ❌ Close code 1006 → Abnormal closure, check diagnostics

---

### 3. Main WebSocket Endpoint Test

**Purpose:** Test production WebSocket with ping/pong behavior.

**Steps:**
```bash
wscat -c ws://localhost:9000/ws
```

**Expected Success Transcript:**
```
Connected (press CTRL+C to quit)

> {"type":"ping"}
< {"type":"pong","timestamp":1699564800.789,"client_id":"ws_client_1699564790123_99999"}

> {"type":"custom","data":"test"}
< {"type":"echo","data":{"type":"custom","data":"test"},"timestamp":1699564801.123,"client_id":"ws_client_1699564790123_99999","server_processing_ms":0.234}
```

**Expected Behavior:**
1. ✅ Connection establishes (no welcome message on /ws - optional)
2. ✅ Ping messages get pong responses
3. ✅ Other messages are echoed back
4. ✅ Connection persists with activity

---

## Testing Tools

### 1. wscat (Node.js)

**Installation:**
```bash
npm install -g wscat
```

**Basic Usage:**
```bash
# Connect to endpoint
wscat -c ws://localhost:9000/ws/echo

# Connect with custom headers
wscat -c ws://localhost:9000/ws/echo \
  -H "Origin: http://localhost:3000"

# Connect with authentication (if needed)
wscat -c ws://localhost:9000/ws/echo \
  -H "Authorization: Bearer TOKEN"
```

**Interactive Commands:**
```
> {"type":"test","data":"hello"}   # Send JSON message
> ping                              # Send ping frame
> close                             # Close connection
Press Ctrl+C                        # Force disconnect
```

**Pros:**
- Interactive REPL for manual testing
- Easy to install (npm)
- Good for exploratory testing

**Cons:**
- Manual interaction required
- Hard to automate
- Limited scripting capabilities

---

### 2. websocat (Rust)

**Installation:**
```bash
# Via Cargo
cargo install websocat

# Via Homebrew (macOS)
brew install websocat

# Via apt (Ubuntu/Debian)
sudo apt install websocat
```

**Basic Usage:**
```bash
# Connect and read one message
websocat -n1 ws://localhost:9000/ws/echo

# Connect and echo stdin to WebSocket
echo '{"type":"test","data":"hello"}' | websocat -n1 ws://localhost:9000/ws/echo

# Connect with verbose logging
websocat -v ws://localhost:9000/ws/health

# Auto-reconnect on disconnect
websocat --autoreconnect ws://localhost:9000/ws
```

**Automated Testing:**
```bash
# Test echo round-trip
echo '{"type":"test","data":"hello"}' | \
  websocat -n1 ws://localhost:9000/ws/echo | \
  jq '.type'
# Expected output: "welcome" or "echo"

# Test health endpoint returns status
websocat -n1 ws://localhost:9000/ws/health | \
  jq '.type'
# Expected output: "health_status"
```

**Pros:**
- Scriptable and automatable
- Excellent for CI/CD pipelines
- Supports many WebSocket features (binary, compression, etc.)

**Cons:**
- Rust toolchain required for compilation
- Less interactive than wscat

---

### 3. Python Script

**Example:**
```python
#!/usr/bin/env python3
import asyncio
import websockets
import json

async def test_echo():
    uri = "ws://localhost:9000/ws/echo"

    async with websockets.connect(uri) as websocket:
        # Receive welcome
        welcome = await websocket.recv()
        print(f"Welcome: {welcome}")

        # Send test message
        test_msg = {"type": "test", "data": "hello"}
        await websocket.send(json.dumps(test_msg))

        # Receive echo
        response = await websocket.recv()
        print(f"Echo: {response}")

        # Validate
        resp_data = json.loads(response)
        assert resp_data["type"] == "echo"
        assert resp_data["original"]["data"] == "hello"

        print("✓ Test passed")

asyncio.run(test_echo())
```

**Run:**
```bash
python3 test_websocket.py
```

**Pros:**
- Full control over test logic
- Easy assertions and validation
- Good for integration tests

**Cons:**
- Requires Python and websockets library
- More code to write

---

## Expected Results Summary

### Success Criteria

| Test | Expected Result | Pass Condition |
|------|----------------|----------------|
| Connection establishment | 101 Switching Protocols | Connection opens without error |
| Welcome/health message | Receive initial message | Message type matches endpoint |
| Echo round-trip | Receive echo of sent message | original field matches sent data |
| Heartbeat delivery | Receive heartbeat every WS_PING_INTERVAL | Heartbeat count increments |
| Sustained connection | Stay connected >60s | No 1006 close code |
| Normal closure | Close code 1000 | Clean disconnect with Ctrl+C |
| Latency | <100ms round-trip | server_timestamp - client_timestamp |
| Config exposure | Receive config in health_status | ping_interval and ping_timeout present |

### Failure Scenarios

| Symptom | Likely Cause | Check |
|---------|--------------|-------|
| Connection refused | Server not running | `curl http://localhost:9000/health` |
| 403 Forbidden | Origin not allowed | Add origin to ALLOWED_ORIGINS env var |
| 502 Bad Gateway | Nginx can't reach backend | Check upstream config, backend reachability |
| 1006 immediately | Nginx missing Upgrade headers | Add `proxy_set_header Upgrade $http_upgrade` |
| 1006 after 60s | Proxy timeout | Increase `proxy_read_timeout`, check WS_PING_INTERVAL |
| No heartbeat | Heartbeat disabled | Set WS_PING_INTERVAL, restart server |
| Mixed content warning | HTTPS + WS (not WSS) | Use `wss://` URL for HTTPS sites |

---

## Continuous Testing

### Local Development

```bash
# Watch mode - reconnect on disconnect
while true; do
  echo "Connecting to WebSocket..."
  websocat ws://localhost:9000/ws/health
  echo "Disconnected, reconnecting in 2s..."
  sleep 2
done
```

### CI/CD Integration

```yaml
# .github/workflows/ws-smoke.yml
- name: WebSocket Smoke Test
  run: |
    # Start server
    docker-compose up -d api

    # Wait for server ready
    timeout 30 bash -c 'until curl -f http://localhost:9000/health; do sleep 1; done'

    # Run smoke test
    ./scripts/dev/ws_smoke.sh

    # Run unit tests
    cd api && pytest tests/test_ws_echo.py tests/test_ws_health.py -v
```

---

## Troubleshooting

### Enable Debug Logging

```bash
# Server-side
docker-compose logs -f api | grep WS_DIAGNOSTICS

# Nginx-side (if using proxy)
docker-compose exec nginx tail -f /var/log/nginx/error.log
```

### Check Environment Variables

```bash
docker-compose exec api env | grep WS_
# Expected:
# WS_PING_INTERVAL=30
# WS_PING_TIMEOUT=10
# WS_PUBLIC_URL=ws://localhost:9000/ws
```

### Test Backend Directly (Bypass Nginx)

```bash
# If using nginx proxy, test backend directly to isolate issue
wscat -c ws://localhost:9000/ws/echo

# If this works but proxied connection fails, issue is nginx config
```

### Validate Nginx Headers

```bash
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

## Further Reading

- [checks/ws_server_diagnostics.md](../../checks/ws_server_diagnostics.md) - Comprehensive troubleshooting
- [ops/nginx/ws.conf](../../ops/nginx/ws.conf) - Nginx configuration examples
- [RFC 6455 - WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

## Support

If smoke tests fail:

1. Collect logs:
   ```bash
   docker-compose logs api > api.log
   docker-compose exec api env | grep WS_ > env.txt
   ```

2. Run diagnostic script:
   ```bash
   ./scripts/dev/ws_smoke.sh ws://localhost:9000 > smoke_test.log 2>&1
   ```

3. Review diagnostics playbook: `checks/ws_server_diagnostics.md`

4. Share logs with team for analysis.
