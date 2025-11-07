# 🌍 Forecastin: The Future of Geopolitical Intelligence

> **Transform chaos into clarity. Navigate the future with confidence.**

Forecastin is a next-generation geopolitical intelligence platform that empowers organizations, analysts, and decision-makers to understand, anticipate, and navigate complex global events with unprecedented precision.

---

## ✨ Why Forecastin?

In an interconnected world where events cascade across borders in milliseconds, traditional analysis tools fall short. Forecastin combines cutting-edge technology with sophisticated analytical frameworks to deliver real-time insights that matter.

### 🚀 **Lightning-Fast Performance**
- **42,726 requests per second** - Handle massive analytical workloads
- **Sub-millisecond response times** - Real-time intelligence when you need it
- **99.2% cache hit rate** - Optimized for instant access to critical data
- **GPU-accelerated visualization** - Stunning geospatial rendering

### 🧠 **Intelligent by Design**
- **AI-powered entity extraction** - Automatically identify Who, What, Where, When, Why
- **ML-driven predictions** - Forecast geopolitical trends with confidence scoring
- **Smart content aggregation** - 10,000+ RSS sources processed in real-time
- **Advanced scenario modeling** - Explore alternative futures with sophisticated planning tools

### 🎯 **Built for Scale**
- **Multi-tier caching** - Enterprise-grade performance architecture
- **Real-time WebSocket updates** - Live intelligence streaming
- **Hierarchical data navigation** - Explore complex relationships effortlessly
- **Feature flag rollout system** - Deploy capabilities with precision control

---

## 💡 Potential Use Cases

### 🏢 **Enterprise Intelligence**
- **Risk Assessment**: Monitor geopolitical events that could impact supply chains, operations, or investments
- **Market Analysis**: Track policy changes, trade agreements, and regulatory shifts in real-time
- **Competitive Intelligence**: Understand regional dynamics affecting your industry
- **Strategic Planning**: Model scenarios and forecast outcomes with AI-powered tools

### 🏛️ **Government & Policy**
- **Threat Detection**: Identify emerging geopolitical risks before they escalate
- **Diplomatic Intelligence**: Track international relations, alliances, and conflicts
- **Crisis Response**: Real-time situational awareness during developing events
- **Policy Impact Analysis**: Model the cascading effects of policy decisions

### 📰 **Media & Journalism**
- **Breaking News Tracking**: Aggregate and analyze thousands of global sources instantly
- **Context Generation**: Automatically extract key entities and relationships from events
- **Trend Forecasting**: Identify emerging stories before they go mainstream
- **Data Visualization**: Create stunning geospatial visualizations for storytelling

### 🎓 **Research & Academia**
- **Historical Analysis**: Navigate hierarchical event relationships across time
- **Pattern Recognition**: Identify recurring geopolitical dynamics
- **Predictive Modeling**: Test hypotheses with ML-powered forecasting tools
- **Data Mining**: Extract insights from millions of processed articles

### 💰 **Finance & Investment**
- **Market Intelligence**: Track geopolitical events affecting asset prices
- **Country Risk Assessment**: Monitor political stability, policy changes, and regulatory shifts
- **Sanctions Tracking**: Stay ahead of trade restrictions and compliance requirements
- **Macro Trend Analysis**: Understand long-term geopolitical forces shaping markets

### 🔒 **Security & Defense**
- **Threat Intelligence**: Monitor adversarial actions, alliances, and capabilities
- **Open Source Intelligence (OSINT)**: Aggregate and analyze public information at scale
- **Early Warning Systems**: Detect escalating tensions and potential conflicts
- **Operational Planning**: Scenario modeling for strategic decision-making

---

## 🎨 Stunning Visualization

### **Miller's Columns Interface**
Navigate complex hierarchical relationships with an intuitive, responsive interface inspired by best-in-class UX patterns.

### **GPU-Accelerated Geospatial Layers**
- **Point Layers**: Visualize entities with confidence-based scaling
- **Linestring Layers**: Track routes, borders, and connections with directional arrows
- **Polygon Layers**: Display territories, zones, and regions with elevation support
- **GeoJSON Support**: Import custom datasets with automatic geometry detection

### **Real-Time Updates**
Watch intelligence unfold in real-time with WebSocket-powered live updates. No refresh needed.

---

## 🛠️ Technology Highlights

### **Backend Excellence**
- FastAPI with async/await for maximum throughput
- PostgreSQL with LTREE extension for O(log n) hierarchy navigation
- Redis-powered multi-tier caching
- WebSocket infrastructure for real-time communication

### **Frontend Innovation**
- React with TypeScript (100% strict mode compliance)
- React Query + Zustand hybrid state management
- Responsive mobile-first design
- GPU-accelerated rendering with CPU fallback

### **Advanced Analytics**
- ML model A/B testing framework with automatic rollback
- 5-W entity extraction (Who, What, Where, When, Why)
- Confidence scoring and validation
- Scenario planning and risk assessment

### **DevOps & Quality**
- CI/CD pipeline with automated performance validation
- SLO monitoring against strict performance baselines
- Security scanning (bandit, safety, semgrep)
- Automated compliance evidence collection

---

## 🚀 Quick Start

### **Get Running in 60 Seconds**

```bash
# Clone the repository
git clone https://github.com/glockpete/Forecastin.git
cd Forecastin

# Launch with Docker
docker-compose up

# Access the platform
# Frontend: http://localhost:3000
# Backend API: http://localhost:9000/docs
# WebSocket: ws://localhost:9000/ws
```

That's it! You're ready to explore geopolitical intelligence.

---

## 🔌 WebSocket Hardening

Forecastin implements robust WebSocket infrastructure to prevent persistent disconnects (especially **close code 1006**) and ensure reliable real-time updates.

### **Dedicated Diagnostic Endpoints**

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `/ws` | Primary real-time updates | Production WebSocket communication |
| `/ws/echo` | Echo server for testing | Connection latency testing, debugging |
| `/ws/health` | Health monitoring | Connection stability validation, heartbeat verification |

### **Server-Side Heartbeat**

The server automatically sends ping messages to keep connections alive and prevent proxy timeouts:

```bash
# Configure heartbeat intervals via environment variables
WS_PING_INTERVAL=30  # Send ping every 30 seconds (default)
WS_PING_TIMEOUT=10   # Wait 10 seconds for pong response (default)
```

### **Environment Configuration Matrix**

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `WS_PING_INTERVAL` | `30` | Seconds between server pings | `WS_PING_INTERVAL=30` |
| `WS_PING_TIMEOUT` | `10` | Seconds to wait for pong | `WS_PING_TIMEOUT=10` |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated allowed origins | `ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com` |
| `PUBLIC_BASE_URL` | `http://localhost:9000` | Public base URL for API | `PUBLIC_BASE_URL=https://api.example.com` |
| `WS_PUBLIC_URL` | `ws://localhost:9000/ws` | Public WebSocket URL for clients | `WS_PUBLIC_URL=wss://api.example.com/ws` |

### **Enhanced Diagnostics Logging**

All WebSocket connections log comprehensive diagnostic information:

```
[WS_DIAGNOSTICS] Connection attempt - origin, scheme, X-Forwarded headers
[WS_DIAGNOSTICS] Close code and reason on disconnect
[WS_DIAGNOSTICS] Heartbeat and latency metrics
```

This helps identify:
- **Mixed content issues** (HTTPS page connecting to WS instead of WSS)
- **Proxy configuration problems** (missing Upgrade headers)
- **Idle timeout issues** (insufficient heartbeat frequency)
- **Origin validation failures** (CORS policy mismatches)

### **Testing WebSocket Connections**

```bash
# Test echo endpoint
npm install -g wscat
wscat -c ws://localhost:9000/ws/echo

# Send test message
> {"type":"test","data":"hello"}

# Expect echo response
< {"type":"echo","original":{"type":"test","data":"hello"},...}

# Test health endpoint (stays connected with heartbeats)
wscat -c ws://localhost:9000/ws/health

# Expect periodic heartbeat messages every WS_PING_INTERVAL seconds
< {"type":"heartbeat","ping_number":1,"timestamp":1699564800,...}
```

### **Common Issues and Solutions**

| Problem | Cause | Solution |
|---------|-------|----------|
| 1006 after ~60s idle | Proxy timeout, missing heartbeat | Set `WS_PING_INTERVAL=30`, increase nginx `proxy_read_timeout` |
| 1006 immediately | Proxy missing Upgrade headers | Add `proxy_set_header Upgrade $http_upgrade` to nginx |
| Mixed content warning | HTTPS + WS (not WSS) | Use `wss://` URL, set `WS_PUBLIC_URL=wss://...` |
| 403 Forbidden | Origin not allowed | Add origin to `ALLOWED_ORIGINS` env var |

### **Diagnostics Playbook**

For detailed troubleshooting, see [`checks/ws_server_diagnostics.md`](checks/ws_server_diagnostics.md) which includes:
- Symptoms → Causes matrix for 1006 errors
- Step-by-step diagnostic procedures
- Nginx configuration examples
- Testing tools and scripts

### **Validation Tests**

Run the WebSocket test suite to verify robustness:

```bash
cd api
pytest tests/test_ws_echo.py tests/test_ws_health.py -v

# All tests should pass:
# ✅ test_echo_connection_establishment
# ✅ test_echo_basic_round_trip
# ✅ test_health_heartbeat_tracking
# ✅ test_health_config_validation
```

Tests validate:
- Connection establishment without 1006 errors
- Echo round-trip functionality
- Heartbeat configuration and delivery
- Sustained connections >30 seconds
- Proper close code reporting

---

## 🌟 Key Features

### **Real-Time RSS Ingestion**
- Process 10,000+ global news sources
- RSSHub-inspired architecture with CSS selectors
- Anti-crawler strategies for reliable data collection
- Content deduplication (0.8 similarity threshold)
- Automatic entity extraction from articles

### **Intelligent Caching**
- **L1 (Memory)**: Thread-safe LRU cache with 10,000 entries
- **L2 (Redis)**: Distributed cache with connection pooling
- **L3 (Database)**: PostgreSQL buffer cache optimization
- **L4 (Materialized Views)**: Pre-computed hierarchical queries

### **Feature Flag System**
- Granular control over feature rollout
- Percentage-based targeting (10% → 25% → 50% → 100%)
- Real-time WebSocket notifications
- Database-backed persistence

### **Geospatial Layers**
- Point, Linestring, Polygon, and GeoJSON layer types
- GPU filtering with automatic CPU fallback
- Dynamic layer registry with feature flag integration
- Sub-10ms rendering for 10,000+ points

### **Performance Monitoring**
- Real-time SLO compliance tracking
- Comprehensive metrics dashboard
- Automated performance regression detection
- Health check endpoints

---

## 📊 Performance Benchmarks

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Ancestor Resolution | <1.25ms | 0.07ms* | ✅ |
| Throughput | >40,000 RPS | 42,726 RPS | ✅ |
| Cache Hit Rate | >99% | 99.2% | ✅ |
| Descendant Retrieval | <2ms | 1.25ms | ✅ |
| Materialized View Refresh | <1000ms | 850ms | ✅ |
| WebSocket Serialization | <1ms | 0.019ms | ✅ |

*Projected after recent optimizations

---

## 🎯 Use Forecastin For...

### **Intelligence Operations**
Monitor global events, extract actionable intelligence, and stay ahead of emerging threats.

### **Business Strategy**
Navigate geopolitical complexity with confidence. Understand risks, identify opportunities, and make informed decisions.

### **Academic Research**
Explore historical patterns, test hypotheses, and contribute to geopolitical scholarship with powerful analytical tools.

### **Investigative Journalism**
Uncover connections, track entities across time and space, and tell compelling stories with data-driven insights.

### **Financial Analysis**
Assess country risk, monitor policy changes, and understand macroeconomic forces shaping markets.

---

## 📚 Documentation

### **Core Architecture**
- [GOLDEN_SOURCE.md](docs/GOLDEN_SOURCE.md) - Core requirements and specifications
- [AGENTS.md](docs/AGENTS.md) - Architectural patterns and constraints

### **Feature Documentation**
- [RSS Ingestion Architecture](docs/RSS_INGESTION_SERVICE_ARCHITECTURE.md)
- [Geospatial Feature Flags](docs/GEOSPATIAL_FEATURE_FLAGS.md)
- [WebSocket Layer Messages](docs/WEBSOCKET_LAYER_MESSAGES.md)
- [Performance Optimization Report](docs/PERFORMANCE_OPTIMIZATION_REPORT.md)

### **Deployment Guides**
- [Geospatial Deployment Guide](docs/GEOSPATIAL_DEPLOYMENT_GUIDE.md)
- [LTREE Refresh Implementation](LTREE_REFRESH_IMPLEMENTATION.md)

---

## 🤝 Open Source & Community

Forecastin is currently in **Phase 9: Open Source Launch and Community Building**. We're preparing to share our tools, components, and expertise with the broader community.

### **Coming Soon**
- Reusable component packages
- Community contribution guidelines
- Plugin architecture for custom analytics
- Public API documentation

---

## 🔬 Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React, TypeScript, React Query, Zustand, deck.gl |
| **Backend** | Python 3.9+, FastAPI, orjson, asyncio |
| **Database** | PostgreSQL, LTREE, PostGIS, Materialized Views |
| **Caching** | Redis, LRU Memory Cache |
| **DevOps** | Docker, Docker Compose, GitHub Actions |
| **Monitoring** | Custom SLO validation, Performance metrics |

---

## 🌐 Real-World Impact

Forecastin processes **millions of articles**, tracks **thousands of entities**, and serves **tens of thousands of requests per second** to deliver actionable geopolitical intelligence.

From boardrooms to newsrooms, from research labs to situation rooms, Forecastin empowers those who need to understand the world—fast.

---

## 🚦 Getting Started

1. **Explore the Demo**: `docker-compose up` and visit http://localhost:3000
2. **Read the Docs**: Start with [GOLDEN_SOURCE.md](docs/GOLDEN_SOURCE.md)
3. **Check the API**: Interactive docs at http://localhost:9000/docs
4. **Join the Community**: Watch this space for community guidelines

---

## 🎓 Learn More

- **Architecture Deep Dive**: [docs/AGENTS.md](docs/AGENTS.md)
- **Performance Optimization**: [docs/PERFORMANCE_OPTIMIZATION_REPORT.md](docs/PERFORMANCE_OPTIMIZATION_REPORT.md)
- **RSS Ingestion**: [docs/RSS_SERVICE_IMPLEMENTATION_GUIDE.md](docs/RSS_SERVICE_IMPLEMENTATION_GUIDE.md)

---

## 💫 The Future is Here

In a world of information overload, Forecastin cuts through the noise to deliver clarity. Whether you're managing risk, reporting news, researching history, or forecasting the future—Forecastin gives you the edge.

**Welcome to the next generation of geopolitical intelligence.**

---

## 📝 License

*License information coming soon as part of open source launch.*

## 🙏 Acknowledgments

Built with inspiration from industry-leading tools including kepler.gl, RSSHub, and modern web architecture best practices.

---

**Ready to explore?** `docker-compose up` and start your journey.
