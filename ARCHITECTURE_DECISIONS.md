# Architectural Decisions - CRA to Vite Migration & Backend Refactoring

## Overview
This document addresses Copilot's architectural suggestions and explains design decisions made during the refactoring.

---

## 1. Service Imports in Routers (Tight Coupling)

**Copilot Concern:** Routers import services directly from `main.py`, creating tight coupling.

**Decision:** Accept this pattern for now.

**Rationale:**
- This is a common FastAPI pattern where services are initialized in `main.py`
- Services are global singletons (database manager, cache service, etc.)
- Changing to dependency injection would require:
  - Rewriting all router functions to accept service dependencies
  - Major refactor across 8+ router files
  - Minimal benefit for current codebase size

**Future Consideration:**
If the application grows significantly, consider implementing FastAPI's dependency injection system using `Depends()`.

---

## 2. Re-exports from main.py (Backward Compatibility)

**Copilot Concern:** Re-exporting `WS_PING_INTERVAL`, `WS_PING_TIMEOUT`, and `ConnectionManager` from routers creates circular dependency risk.

**Decision:** Keep re-exports temporarily for backward compatibility.

**Rationale:**
- Tests import these from `main.py`: `from main import WS_PING_INTERVAL, ...`
- Changing would break existing test suite
- No actual circular dependency exists (routers don't import from main)
- This is a **transitional pattern** during refactoring

**Migration Path:**
1. Update all test files to import from `routers.websocket` directly
2. Remove re-exports from `main.py`
3. Timeline: Next refactoring sprint

**Files affected:**
- `api/tests/test_ws_health.py` (line 27)
- `api/tests/test_connection_manager.py`

---

## 3. Deprecated Environment Variables

**Copilot Concern:** No clear migration timeline for `REACT_APP_*` variables.

**Decision:** Comment out deprecated variables and add migration documentation.

**Status:** ✅ Fixed in commit

**Changes:**
- Commented out `REACT_APP_API_URL` and `REACT_APP_WS_URL` in `.env.example`
- Added migration timeline comments
- Documented removal plan (next major version)

---

## 4. WebSocket Endpoint Consistency

**Copilot Concern:** `/ws/v3/scenarios/{path}/forecasts` doesn't use ConnectionManager.

**Analysis:** **Copilot is incorrect** - this endpoint DOES use ConnectionManager:
- Line 554: `await connection_manager.connect(websocket, client_id)`
- Line 591: `await connection_manager.send_personal_message(response, client_id)`
- Lines 597, 600: `connection_manager.disconnect(client_id)`

**Decision:** No changes needed.

---

## Summary

| Suggestion | Status | Action |
|------------|--------|--------|
| 1. Tight coupling | Accepted | Defer to future sprint |
| 2. Re-exports | Temporary | Remove after test migration |
| 3. Deprecated env vars | ✅ Fixed | Documented & commented out |
| 4. ConnectionManager | Invalid | Already uses it correctly |

---

## Related Commits
- Backend refactoring: Multiple commits splitting main.py into routers
- Environment variable migration: Updated .env.example with VITE_ prefix
- Backward compatibility: Re-exports maintained for test compatibility
