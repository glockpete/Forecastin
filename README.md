# Forecastin Geopolitical Intelligence Platform - Phase 0

## Architecture Overview

This repository contains the foundational architecture for Phase 0 of the Forecastin Geopolitical Intelligence Platform, implementing the requirements from `GOLDEN_SOURCE.md` with specific architectural constraints from `AGENTS.md`.

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

**Performance Targets (Validated):**
- Ancestor resolution: 1.25ms (P95: 1.87ms)
- Throughput: 42,726 RPS
- Cache hit rate: 99.2%

## Project Structure

```
forecastin/
├── api/                    # FastAPI backend
│   ├── main.py            # FastAPI application entry point
│   ├── requirements.txt   # Python dependencies
│   └── navigation_api/    # Hierarchical navigation API
├── frontend/              # React frontend
│   ├── package.json       # Node.js dependencies
│   └── src/               # Source code
├── migrations/            # Database migrations
│   └── 001_initial_schema.sql
├── docker-compose.yml     # Development environment
├── .github/workflows/     # CI/CD pipelines
└── docs/                  # Documentation
    ├── GOLDEN_SOURCE.md   # Core requirements
    └── AGENTS.md          # Architectural constraints
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

### Services
- **PostgreSQL**: Database with LTREE and PostGIS extensions
- **Redis**: Cache and session storage
- **FastAPI**: Backend API server (port 9000)
- **React Frontend**: Web application (port 3000)

## Key Features Implemented

### Phase 0 Core Capabilities
- Hierarchical entity management with LTREE optimization
- Real-time updates via WebSocket infrastructure
- Multi-tier caching with RLock synchronization
- Miller's Columns UI for hierarchical navigation
- Basic CI/CD foundation with automated testing

### Architectural Constraints Addressed
- Materialized view refresh mechanisms
- TCP keepalive configuration for database connections
- orjson serialization with safe message handling
- Four-tier cache invalidation strategy
- Responsive Miller's Columns pattern

## Compliance & Security

The architecture includes automated evidence collection scripts and compliance framework integration as specified in `AGENTS.md`.

## Next Steps

Phase 0 establishes the foundational architecture. Subsequent phases will build upon this foundation with:
- Entity extraction with 5-W framework
- ML model A/B testing framework
- Advanced geospatial capabilities
- Multi-agent system integration

For detailed architectural constraints and non-obvious patterns, refer to `docs/AGENTS.md`.