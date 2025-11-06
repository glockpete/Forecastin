# Contributing to Forecastin

We're excited that you're interested in contributing to the Forecastin platform! This guide provides all the technical details you need to get started.

## Architecture Overview

This repository contains the complete architecture for the Forecastin Geopolitical Intelligence Platform.

### Key Architectural Decisions

**Database Architecture:**
- PostgreSQL with LTREE extension for hierarchical data (O(log n) performance)
- Materialized views (`mv_entity_ancestors`, `mv_descendant_counts`) for pre-computed hierarchies
- PostGIS for geospatial capabilities
- Four-tier caching strategy (L1 Memory → L2 Redis → L3 DB → L4 Materialized Views)

**Backend Architecture:**
- FastAPI on port 9000 with orjson serialization
- WebSocket support with custom `safe_serialize_message()` for datetime/dataclass handling
- Thread-safe LRU cache with RLock synchronization
- TCP keepalives for database connection firewall prevention

**Frontend Architecture:**
- React application on port 3000
- Miller's Columns UI pattern for hierarchical navigation
- Hybrid state management (React Query + Zustand + WebSocket integration)
- Responsive design with mobile adaptation

**Performance Targets:**
- Ancestor resolution: **1.25ms** (P95: 1.87ms)
- Descendant retrieval: **1.25ms** (P99: 17.29ms)
- Throughput: **42,726 RPS**
- Cache hit rate: **99.2%**
- Materialized view refresh: **850ms**

## Project Structure

```
forecastin/
├── api/                    # FastAPI backend
│   ├── main.py            # FastAPI application entry point
│   └── ...
├── frontend/              # React frontend
│   ├── package.json       # Node.js dependencies
│   └── src/
├── migrations/            # Database migrations
├── docker-compose.yml     # Development environment
└── .github/workflows/     # CI/CD pipelines
```

## Development Setup

### Prerequisites
- Docker and Docker Compose
- Python 3.9+ (for local development)
- Node.js 16+ (for local development)

### Quick Start
1. Clone the repository
2. Run `docker-compose up` to start all services
3. Access:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:9000
   - API Documentation: http://localhost:9000/docs
   - WebSocket Endpoint: ws://localhost:9000/ws

### Services
- **PostgreSQL**: Database with LTREE and PostGIS extensions
- **Redis**: Cache and session storage
- **FastAPI**: Backend API server (port 9000)
- **React Frontend**: Web application (port 3000)
- **WebSocket Service**: Real-time communication (port 9000)

## Feature Flag Service Implementation

The FeatureFlagService provides comprehensive feature flag management with real-time WebSocket notifications and multi-tier caching. See the original `README.md` in the commit history for more details on the API endpoints and caching strategy.

## Geospatial Layer System

The platform includes a comprehensive geospatial layer system. See the original `README.md` in the commit history for more details on capabilities, performance SLOs, and layer types.

## Compliance & Security

The architecture includes automated evidence collection scripts and compliance framework integration. The CI/CD pipeline includes comprehensive performance validation against defined SLOs.
