# 18 Developer Handbook

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Onboarding guide and development best practices
**Audience:** New developers, contributors, team members

---

## Welcome to Forecastin

Forecastin is a geopolitical intelligence platform with hierarchical entity management, geospatial visualization, and real-time updates.

**Tech Stack:**
- **Backend:** Python 3.11, FastAPI, PostgreSQL (LTREE + PostGIS)
- **Frontend:** React 18, TypeScript 5.3, deck.gl, MapLibre
- **Caching:** Redis multi-tier (L1-L4)
- **State:** @tanstack/react-query, Zustand

---

## Quick Start (30 minutes)

### Prerequisites

```bash
# Required
- Python 3.11+
- Node.js 20+
- PostgreSQL 13+ (with LTREE and PostGIS extensions)
- Redis 6+
- Git
```

### Clone and Setup

```bash
# 1. Clone repository
git clone https://github.com/yourorg/Forecastin.git
cd Forecastin

# 2. Backend setup
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Frontend setup
cd frontend
npm install
cd ..

# 4. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 5. Database setup
createdb forecastin
psql forecastin -c "CREATE EXTENSION IF NOT EXISTS ltree;"
psql forecastin -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 6. Run migrations
alembic upgrade head

# 7. Load test data
python scripts/testing/load_test_data.py

# 8. Start services
# Terminal 1: Backend
uvicorn api.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Redis
redis-server

# 9. Open browser
open http://localhost:3000
```

---

## Project Structure

```
Forecastin/
├── api/                           # Backend (Python/FastAPI)
│   ├── main.py                    # Application entry point
│   ├── config/                    # Configuration
│   ├── contracts/                 # Pydantic contracts (source of truth)
│   │   ├── requests.py
│   │   ├── responses.py
│   │   └── events.py
│   ├── services/                  # Business logic
│   │   ├── base.py                # BaseService ABC
│   │   ├── registry.py            # ServiceRegistry (DI)
│   │   ├── entity_service.py
│   │   ├── cache_service.py
│   │   └── websocket_manager.py
│   ├── routers/                   # API endpoints
│   │   ├── entities.py
│   │   └── hierarchy.py
│   ├── repositories/              # Database access
│   ├── middleware/                # Request/response middleware
│   │   ├── correlation_id.py
│   │   └── metrics.py
│   └── tests/                     # Tests
│       ├── unit/
│       ├── integration/
│       └── contracts/
├── frontend/                      # Frontend (React/TypeScript)
│   ├── src/
│   │   ├── components/            # React components
│   │   │   ├── Map/
│   │   │   │   └── GeospatialView.tsx
│   │   │   └── FeatureGate/       # Feature flag wrapper
│   │   │       └── FeatureGate.tsx
│   │   ├── hooks/                 # Custom hooks
│   │   │   ├── useFeatureFlag.ts
│   │   │   └── useWebSocket.ts
│   │   ├── layers/                # deck.gl layers
│   │   │   └── implementations/
│   │   ├── types/                 # TypeScript types
│   │   │   └── contracts.generated.ts  # Auto-generated from Python
│   │   └── utils/
│   │       ├── api.ts
│   │       └── validateContract.ts
│   └── tests/
├── migrations/                    # Alembic database migrations
├── scripts/
│   ├── dev/
│   │   └── generate_contracts_v2.py  # Contract generator
│   └── testing/
│       ├── direct_performance_test.py
│       └── load_test_data.py
├── REBUILD_DOSSIER/               # This documentation
│   └── 20251109-0521/
└── README.md
```

---

## Development Workflow

### 1. Creating a New Feature

**Process:**

```bash
# 1. Create feature branch
git checkout -b feature/add-entity-search

# 2. Update Pydantic contracts (if needed)
# Edit: api/contracts/requests.py, responses.py

# 3. Regenerate TypeScript contracts
python scripts/dev/generate_contracts_v2.py

# 4. Implement backend
# Create service, repository, router

# 5. Write tests
# Unit tests, integration tests, contract tests

# 6. Implement frontend
# Components, hooks, types

# 7. Run tests
pytest api/tests/
cd frontend && npm test

# 8. Commit with descriptive message
git add .
git commit -m "feat: Add entity search with autocomplete

- Add SearchRequest/SearchResponse contracts
- Implement SearchService with PostgreSQL full-text search
- Create SearchBar React component
- Add useSearch hook with debouncing
- Include contract tests"

# 9. Push and create PR
git push origin feature/add-entity-search
gh pr create
```

---

### 2. Contract-First Development

**CRITICAL:** Always start with contracts

**Step 1: Define Pydantic Contract**

```python
# api/contracts/requests.py

from pydantic import BaseModel, Field

class SearchRequest(BaseModel):
    """
    Search request contract

    @version 1.0.0
    """

    query: str = Field(..., min_length=1, max_length=255, description="Search query")
    entity_types: list[str] | None = Field(None, description="Filter by entity types")
    limit: int = Field(10, ge=1, le=100, description="Max results")
```

**Step 2: Generate TypeScript**

```bash
python scripts/dev/generate_contracts_v2.py

# Verify no 'any' types
grep -n ": any" frontend/src/types/contracts.generated.ts
# Should return nothing
```

**Step 3: Implement Backend**

```python
# api/routers/search.py

from fastapi import APIRouter
from api.contracts.requests import SearchRequest
from api.contracts.responses import SearchResponse

router = APIRouter()

@router.post("/search", response_model=SearchResponse)
async def search_entities(request: SearchRequest):
    results = await search_service.search(
        query=request.query,
        entity_types=request.entity_types,
        limit=request.limit
    )
    return SearchResponse(results=results)
```

**Step 4: Use in Frontend**

```typescript
// frontend/src/hooks/useSearch.ts

import { useQuery } from '@tanstack/react-query';
import { SearchRequest, SearchResponse } from '@/types/contracts.generated';
import { api } from '@/utils/api';

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const request: SearchRequest = {
        query,
        entity_types: null,
        limit: 10
      };

      const response = await api.post<SearchResponse>('/api/v1/search', request);
      return response.data;
    },
    enabled: query.length > 0
  });
}
```

---

### 3. Testing

**Test Pyramid:**

```
        /\
       /E2E\        <- Few (Playwright)
      /------\
     /Integration\ <- Some (pytest + real DB)
    /--------------\
   /    Unit Tests  \ <- Many (pytest, Vitest)
  /------------------\
```

**Unit Test Example:**

```python
# api/tests/unit/test_search_service.py

import pytest
from api.services.search_service import SearchService

@pytest.mark.asyncio
async def test_search_returns_matching_entities():
    """Search returns entities matching query."""

    service = SearchService()
    results = await service.search(query="Tokyo", limit=10)

    assert len(results) > 0
    assert all("tokyo" in r.name.lower() for r in results)


@pytest.mark.asyncio
async def test_search_filters_by_entity_type():
    """Search respects entity_type filter."""

    service = SearchService()
    results = await service.search(query="Japan", entity_types=["country"], limit=10)

    assert all(r.entity_type == "country" for r in results)
```

**Frontend Test Example:**

```typescript
// frontend/src/hooks/useSearch.test.ts

import { renderHook, waitFor } from '@testing-library/react';
import { useSearch } from './useSearch';

test('useSearch fetches results', async () => {
  const { result } = renderHook(() => useSearch('Tokyo'));

  await waitFor(() => {
    expect(result.current.data?.results).toHaveLength(greaterThan(0));
  });
});
```

**Contract Test Example:**

```python
# api/tests/contracts/test_search_contracts.py

def test_search_response_matches_contract():
    """Verify search response matches SearchResponse contract."""

    # Make request
    response = client.post("/api/v1/search", json={"query": "Tokyo", "limit": 10})

    # Validate structure
    data = response.json()
    assert 'results' in data
    assert isinstance(data['results'], list)

    # Validate each result
    for result in data['results']:
        assert 'id' in result
        assert 'name' in result
        assert 'entity_type' in result
```

---

## Code Style

### Python (Backend)

**Follow PEP 8 + Ruff:**

```python
# Good
async def get_entity_by_id(entity_id: UUID) -> EntityResponse:
    """Get entity by ID.

    Args:
        entity_id: UUID of entity to fetch

    Returns:
        EntityResponse with entity data

    Raises:
        HTTPException: If entity not found
    """
    entity = await db.fetch_one(...)
    if not entity:
        raise HTTPException(404, detail="Entity not found")

    return EntityResponse(**entity)


# Bad
def getEntity(id):  # No type hints, camelCase
    entity = db.execute(f"SELECT * FROM entities WHERE id='{id}'")  # SQL injection!
    return entity  # No validation
```

**Formatting:**

```bash
# Run before commit
ruff format api/
ruff check api/ --fix
mypy api/ --strict
```

---

### TypeScript (Frontend)

**Follow Airbnb Style + Strict TypeScript:**

```typescript
// Good
interface Props {
  entityId: string;
  onSelect?: (entity: EntityResponse) => void;
}

export function EntityCard({ entityId, onSelect }: Props) {
  const { data, isLoading } = useEntity(entityId);

  if (isLoading) return <Spinner />;
  if (!data) return <ErrorMessage />;

  return (
    <Card onClick={() => onSelect?.(data)}>
      <h3>{data.name}</h3>
      <p>{data.entity_type}</p>
    </Card>
  );
}


// Bad
export function EntityCard(props: any) {  // 'any' type!
  const entity = props.entity;  // No destructuring

  return <div onClick={props.onClick}>{entity.name}</div>;  // Inline styles missing
}
```

**Formatting:**

```bash
# Run before commit
cd frontend
npm run lint
npm run format
npm run type-check
```

---

## Common Patterns

### 1. Service Pattern (Backend)

**All services inherit from BaseService:**

```python
# api/services/search_service.py

from api.services.base import BaseService

class SearchService(BaseService):
    """Search service for full-text entity search."""

    async def start(self) -> None:
        """Initialize search indices."""
        await self._create_search_indices()
        self.is_running = True

    async def stop(self) -> None:
        """Cleanup resources."""
        self.is_running = False

    async def search(self, query: str, entity_types: list[str] | None = None, limit: int = 10) -> list[EntityResponse]:
        """Search entities by query."""
        # Implementation
        pass

    async def _create_search_indices(self) -> None:
        """Create PostgreSQL full-text search indices."""
        await db.execute("""
            CREATE INDEX IF NOT EXISTS entities_search_idx
            ON entities USING GIN (to_tsvector('english', name || ' ' || description))
        """)
```

---

### 2. Feature Flag Pattern (Frontend)

**Wrap new features with FeatureGate:**

```typescript
// frontend/src/components/Map/GeospatialView.tsx

import { FeatureGate } from '@/components/FeatureGate/FeatureGate';

export function GeospatialView() {
  return (
    <FeatureGate
      flag="ff.gpu_filtering"
      fallback={<CPUFilteredMap />}
    >
      <GPUFilteredMap />
    </FeatureGate>
  );
}
```

---

### 3. Error Handling Pattern

**Backend:**

```python
from fastapi import HTTPException
import sentry_sdk

try:
    entity = await entity_service.get(entity_id)
except EntityNotFoundError:
    raise HTTPException(404, detail="Entity not found")
except Exception as e:
    sentry_sdk.capture_exception(e)
    logger.error("Failed to get entity", exc_info=True, extra={"entity_id": entity_id})
    raise HTTPException(500, detail="Internal server error")
```

**Frontend:**

```typescript
import { reportError } from '@/utils/sentry';

try {
  const entity = await api.get(`/entities/${id}`);
  return entity.data;
} catch (error) {
  if (error.response?.status === 404) {
    return null;  // Not found
  }

  reportError(error as Error, { entityId: id });
  throw error;
}
```

---

## Performance Best Practices

### Backend

1. **Use database indices:**
```sql
CREATE INDEX entities_path_gist_idx ON entities USING GIST (path);
CREATE INDEX entities_location_gist_idx ON entities USING GIST (location);
```

2. **Cache expensive queries:**
```python
@cache_service.cached(ttl=300)  # 5 minutes
async def get_hierarchy(parent_path: str) -> HierarchyResponse:
    # Expensive query
    pass
```

3. **Use connection pooling:**
```python
# Already configured in database.py
DATABASE_URL = "postgresql://...?pool_size=20&max_overflow=10"
```

### Frontend

1. **Code splitting:**
```typescript
const HierarchyExplorer = lazy(() => import('./components/Sidebar/HierarchyExplorer'));
```

2. **Memoization:**
```typescript
const expensiveCalculation = useMemo(() => {
  return calculateCentroid(geometry);
}, [geometry]);
```

3. **Virtual scrolling:**
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: entities.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 50
});
```

---

## Debugging

### Backend

**Logging:**
```python
logger.debug("Processing request", extra={"entity_id": entity_id})
logger.info("Entity created", extra={"entity_id": new_entity.id})
logger.error("Database error", exc_info=True)
```

**Interactive debugging:**
```python
import pdb; pdb.set_trace()  # Set breakpoint
```

**Performance profiling:**
```bash
python -m cProfile -o profile.stats scripts/testing/direct_performance_test.py
python -m pstats profile.stats
```

### Frontend

**React DevTools:**
```bash
# Install extension
# Chrome: React Developer Tools
```

**Console logging:**
```typescript
console.log('Entity data:', entity);
console.error('Failed to load:', error);

// Production: logs go to Sentry
```

**Performance profiling:**
```typescript
// React DevTools Profiler tab
// Or programmatic:
import { Profiler } from 'react';

<Profiler id="map" onRender={(id, phase, actualDuration) => {
  console.log(`${id} took ${actualDuration}ms`);
}}>
  <GeospatialView />
</Profiler>
```

---

## Common Issues

### Issue: "ModuleNotFoundError: No module named 'api'"

**Solution:**
```bash
# Ensure virtual environment activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

---

### Issue: "psycopg2.OperationalError: could not connect to server"

**Solution:**
```bash
# Start PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux

# Verify connection
psql -U postgres -c "SELECT 1"
```

---

### Issue: "npm ERR! code ELIFECYCLE"

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

### Issue: "TypeScript compilation errors after contract regeneration"

**Solution:**
```bash
# Regenerate contracts
python scripts/dev/generate_contracts_v2.py

# Verify no 'any' types
grep -n ": any" frontend/src/types/contracts.generated.ts

# If any found, fix Pydantic contracts first
```

---

## Git Conventions

### Commit Messages

**Format:** `type(scope): subject`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**
```bash
feat(search): Add entity search with autocomplete
fix(hierarchy): Correct ancestor query for depth > 5
docs(api): Update API documentation for search endpoint
refactor(cache): Migrate to multi-tier caching strategy
test(contracts): Add contract tests for search endpoint
```

### Branch Naming

```bash
feature/short-description   # New features
fix/bug-description        # Bug fixes
refactor/component-name    # Refactoring
docs/section-name          # Documentation
```

---

## Resources

### Documentation
- API Docs: http://localhost:8000/docs (Swagger UI)
- Rebuild Dossier: `/REBUILD_DOSSIER/20251109-0521/00_INDEX.md`
- Architecture: `/REBUILD_DOSSIER/20251109-0521/04_TARGET_ARCHITECTURE.md`

### External
- FastAPI: https://fastapi.tiangolo.com/
- React Query: https://tanstack.com/query/latest
- deck.gl: https://deck.gl/
- PostgreSQL LTREE: https://www.postgresql.org/docs/current/ltree.html

---

## Getting Help

1. **Check documentation:** Start with `00_INDEX.md` in Rebuild Dossier
2. **Search issues:** GitHub Issues for known problems
3. **Ask team:** Slack #forecastin-dev channel
4. **Pair programming:** Schedule with senior dev

---

**Developer Handbook Complete**
**Comprehensive onboarding guide for new developers**
**Covers setup, workflow, patterns, debugging, conventions**
