# Phase 7: User Interface and Experience Enhancement Architecture
**Focus:** Advanced UI patterns, mobile optimization, accessibility (WCAG 2.1 AA), State management optimization

## Executive Summary

Phase 7 focuses on refining the user experience to meet advanced usability and accessibility standards while maintaining the platform's high-performance baseline. The core effort involves extending the Miller's Columns pattern for deeper hierarchy navigation, implementing robust mobile responsiveness, achieving WCAG 2.1 AA compliance, and optimizing the hybrid state management system for instantaneous UI feedback.

## Core Architectural Principles

### Performance Maintenance (SLOs)
- **FCP Target:** <1.5s
- **TTI Target:** <3.0s
- **CLS Target:** <0.1
- **Latency/Throughput/Cache Hit Rate:** Must maintain Phase 0-5 validated metrics (1.25ms Ancestor Resolution, 42,726 RPS, 99.2% Cache Hit Rate).

### Architectural Constraints (from AGENTS.md)
- **Hybrid State Management:** Seamless coordination between React Query, Zustand, and WebSocket.
- **Miller's Columns:** Required pattern for hierarchical navigation, must support responsive collapse.
- **WebSocket Resilience:** Use of `orjson` and `safe_serialize_message()` for all real-time state updates.
- **Caching Coordination:** Cache invalidation must propagate across L1 (RLock) $\rightarrow$ L4 Materialized Views.

## System Architecture

### 1. Advanced Miller's Columns Component Architecture

The existing `frontend/src/components/MillerColumns/MillerColumns.tsx` will be extended to support deeper nesting and dynamic metric display.

#### 1.1 Deep Hierarchy Support
- **Mechanism:** Implement dynamic column rendering based on the depth of the selected entity path, fetching subsequent column data lazily via the Navigation API.
- **Data Fetching:** Subsequent columns are populated by calling the optimized hierarchy endpoint, e.g., `GET /api/v3/hierarchy/{parent_path}`.
- **Performance Gate:** Column data fetching must be gated by the `ff.hierarchy_optimized` feature flag, ensuring the 1.25ms latency target is met for each column load.

#### 1.2 Mobile Responsive Collapse
- **Constraint:** Miller's Columns must collapse to a single-column view on mobile devices (viewport width < 768px).
- **Implementation:** Use Tailwind CSS responsive utilities (`md:`, `lg:`) within `MillerColumns.tsx`.
- **Navigation Flow:** The collapse triggers a transition to a standard "drill-down" view where selecting an item navigates to a new screen showing its children, utilizing a persistent "Back" button managed by Zustand (Global UI State).

### 2. Accessibility Implementation Strategy (WCAG 2.1 AA)

Accessibility is treated as a core requirement, not an afterthought.

#### 2.1 Keyboard Navigation & Focus Management
- **Requirement:** Full keyboard operability for all navigation and interaction elements.
- **Implementation:** Utilize Radix UI primitives (as noted in `GOLDEN_SOURCE.md`) which provide built-in focus management. Custom logic in `NavigationPanel.tsx` must ensure focus moves logically between columns and within list items.
- **ARIA Roles:** Ensure all dynamic elements (like column headers and selected items) use appropriate ARIA roles (`role="treegrid"` or similar hierarchical roles).

#### 2.2 Visual & Auditory Feedback
- **Color Contrast:** All text and interactive elements must meet WCAG 2.1 AA contrast ratios (4.5:1). This requires auditing the Tailwind configuration in `frontend/src/index.css` and theme definitions in Zustand.
- **Screen Reader Support:** All dynamic content updates (e.g., entity counts changing, new signals appearing) must trigger ARIA live regions, managed via Zustand state updates that propagate to the root component.

### 3. State Management Optimization

The hybrid state model (`React Query` + `Zustand` + `WebSocket`) must be optimized for UI responsiveness (FCP/TTI targets).

#### 3.1 WebSocket $\rightarrow$ React Query Synchronization
- **Goal:** Ensure real-time data from WebSockets updates server state caches instantly, minimizing perceived latency.
- **Mechanism:** Enhance `frontend/src/hooks/useHybridState.ts` to process incoming WebSocket messages (`entity_update`, `hierarchy_change`) and immediately call `queryClient.invalidateQueries()` or `queryClient.setQueryData()` for relevant hierarchy keys (`hierarchyKeys.all`, `hierarchyKeys.entity(id)`).
- **Optimistic Updates:** Leverage `updateCacheOptimistically` to show changes immediately before cache invalidation completes, adhering to the `optimisticUpdates: true` setting in `useHybridState.ts`.

#### 3.2 Batching and Debouncing
- **Constraint:** To prevent UI thrashing from high-frequency updates (e.g., during agent processing), batching is critical.
- **Implementation:** Utilize the existing debounce mechanism (`debounceMs: 100` in `useHybridState.ts`) for non-critical updates. For critical hierarchy changes, use immediate invalidation but ensure the backend sends batched WebSocket messages (as per `api/services/realtime_service.py`).

### 4. Performance Validation

New UI complexity must not introduce layout shifts or slow initial rendering.

- **FCP/TTI Monitoring:** Integrate performance monitoring hooks (`performance-monitor.ts`) to specifically track the rendering time of the Miller's Columns component and the time until the first interactive element is available.
- **GPU Layer Integration:** Ensure that the rendering of geospatial layers (which rely on GPU filtering) remains decoupled from the main UI thread rendering path, maintaining the 1.25ms geospatial render time SLO.

## API Contract Changes

No new major API endpoints are required, but existing endpoints must handle new query parameters for advanced filtering based on scenario context.

- `GET /api/v3/signals?path={path}&scenario_context={scenario_id}`: Signals retrieved must now be filtered based on the active scenario's parameters.

## Compliance and Monitoring

- **Evidence Collection:** Scripts like [`gather_metrics.py`](scripts/gather_metrics.py:626) must be updated to capture UI performance metrics (FCP, TTI, CLS) alongside backend metrics.
- **Audit Trail:** All user interactions within the Miller's Columns (selection, expansion, collapse) must be logged to the collaboration audit trail.

## Implementation Roadmap

### Phase 7a: Core UI Refinement (Weeks 1-4)
- [ ] Audit and enforce WCAG 2.1 AA compliance across all navigation components.
- [ ] Implement responsive collapse logic for Miller's Columns.
- [ ] Refine `useHybridState.ts` to handle real-time invalidation of hierarchy queries based on WebSocket messages.

### Phase 7b: Advanced Interaction (Weeks 5-8)
- [ ] Implement deep hierarchy navigation logic (lazy loading subsequent columns).
- [ ] Integrate performance monitoring hooks for FCP/TTI tracking.
- [ ] Finalize Zustand integration for global UI state (e.g., mobile navigation state).

### Phase 7c: Polish and Validation (Weeks 9-12)
- [ ] Comprehensive cross-browser and device testing.
- [ ] Load testing to ensure UI responsiveness holds under high WebSocket load.
- [ ] Final validation against FCP <1.5s and TTI <3.0s targets.

## Success Metrics

### Usability Metrics
- **Navigation Depth Success:** 95% of users can reach a leaf node entity in $\le 3$ clicks.
- **Mobile Usability Score:** >4.0/5.0 in user testing.

### Quality Metrics
- **WCAG Compliance Score:** 100% automated check pass rate.
- **CLS Score:** Consistently <0.1 in production monitoring.
- **State Sync Latency:** WebSocket-to-UI update time < 500ms (P95).