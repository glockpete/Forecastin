# BUG-005: api/main.py Exceeds Maintainability Threshold

**Severity:** P0 - CRITICAL (Architecture)  
**Priority:** High  
**Type:** Refactor  
**Status:** Open  
**Assignee:** TBD  
**Labels:** `refactor`, `critical`, `architecture`, `maintainability`

## Description

`api/main.py` contains 2,014 lines combining FastAPI app initialization, route handlers, middleware, startup/shutdown logic, and configuration. This violates the single responsibility principle and makes the codebase difficult to maintain and test.

## Impact

- **Maintenance burden:** Difficult to navigate and modify
- **Testing challenges:** Hard to isolate and test individual components
- **Architecture violation:** Mixed concerns violate single responsibility principle
- **Category:** Architecture / Code Organization

## Affected Components

- `api/main.py` (2,014 LOC) - Primary application file

## Reproduction Steps

1. Open `api/main.py`
2. Observe file length: `wc -l api/main.py` → 2,014
3. Observe mixed concerns: routes, middleware, configuration all in one file
4. Note difficulty in locating specific functionality

## Expected Behavior

FastAPI application should be organized into modular components:

```
api/
├── main.py (200-300 LOC) - App initialization only
├── routers/
│   ├── hierarchy.py - Hierarchy endpoints
│   ├── entities.py - Entity CRUD
│   ├── scenarios.py - Scenario endpoints
│   ├── websocket.py - WebSocket endpoints
│   └── feature_flags.py - Feature flag endpoints
└── middleware/
    ├── auth.py
    ├── cors.py
    └── error_handlers.py
```

## Actual Behavior

All application concerns are mixed in a single 2,014-line file, making it difficult to maintain and extend.

## Proposed Fix

Refactor into modular structure following FastAPI best practices:

### Phase 1: Extract Routers
- Move route handlers to dedicated router modules
- Group routes by domain (hierarchy, entities, scenarios, etc.)

### Phase 2: Extract Middleware
- Move middleware functions to separate modules
- Organize by functionality (auth, CORS, error handling)

### Phase 3: Extract Configuration
- Move configuration logic to `config.py`
- Separate environment-specific settings

### Phase 4: Extract Startup/Shutdown Logic
- Move lifecycle events to dedicated modules
- Improve testability of initialization code

## Code References

- **File:** `api/main.py`
- **Related:** SCOUT_LOG.md Section 4, Critical Issue 1
- **Estimated Fix Time:** 4-6 hours with full test coverage

## Acceptance Criteria

- [ ] `main.py` reduced to 200-300 lines (app initialization only)
- [ ] All route handlers moved to dedicated router modules
- [ ] Middleware extracted to separate modules
- [ ] Configuration logic separated from application code
- [ ] All existing functionality preserved
- [ ] Test coverage maintained or improved
- [ ] Code follows FastAPI best practices

## Additional Context

This refactor is critical for long-term maintainability and will make the codebase more approachable for new developers. The modular structure will also improve testability and deployment flexibility.