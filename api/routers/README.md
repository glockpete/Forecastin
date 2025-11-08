# API Routers

This directory contains modular FastAPI routers split from `api/main.py`.

## Structure

- `hierarchy.py` - Entity hierarchy navigation (root, children, breadcrumbs, search, stats, move)
- `entities.py` - Entity CRUD operations (create, read, update, delete)
- `feature_flags.py` - Feature flag management
- `scenarios.py` - Scenario analysis and forecasting
- `websocket.py` - WebSocket connections for real-time updates

## Migration Status

**TODO**: Complete migration from `api/main.py`

Each router currently contains stub endpoints with TODO comments. To complete the migration:

1. Move actual implementation from `main.py` to respective router
2. Import required dependencies (database managers, services)
3. Update `main.py` to include routers with `app.include_router()`
4. Test each endpoint after migration
5. Remove old implementations from `main.py`

## Usage in main.py

```python
from routers import hierarchy, entities, feature_flags, scenarios

app.include_router(hierarchy.router)
app.include_router(entities.router)
app.include_router(feature_flags.router)
app.include_router(scenarios.router)
```

## Next Steps

1. Incrementally move routes from `main.py` to routers
2. Update imports and dependencies
3. Add tests for each router module
4. Document API endpoints with OpenAPI schemas
5. Remove monolithic `main.py` route definitions
