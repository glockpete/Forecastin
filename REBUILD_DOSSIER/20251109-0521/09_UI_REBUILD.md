# 09 Frontend Rebuild Strategy

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Frontend rebuild strategy addressing TypeScript and React issues
**Evidence:** F-0001, F-0004, F-0008, F-0009, F-0012, F-0013 (frontend findings)

---

## Executive Summary

**Problems:**
- Missing TypeScript exports cause compilation failures (F-0001)
- Contract generator loses type fidelity → `any` types everywhere (F-0004)
- 88% of feature flags unused in frontend (F-0008)
- 50-80 `any` types reduce type safety (F-0009)
- Deep relative imports (`../../../../`) harm maintainability (F-0012)
- Deprecated `REACT_APP_*` env variables (F-0013)

**Solution:** Phased frontend refactoring with zero downtime
1. Fix critical compilation errors (T-0002)
2. Implement FeatureGate HOC for flag integration (T-0301)
3. Refactor `any` types systematically (T-0502)
4. Migrate to path aliases (T-0503)
5. Update environment variables (T-0501)

**Timeline:** 4 weeks (Phase 3 + Phase 5 in rebuild plan)

---

## Current Frontend Architecture

**PATH:** `/home/user/Forecastin/frontend/src/`

```
frontend/src/
├── components/
│   ├── Map/
│   │   └── GeospatialView.tsx         # Main map component
│   ├── Sidebar/
│   │   └── HierarchyExplorer.tsx      # Entity hierarchy navigation
│   └── FeatureGate/                    # NEW - feature flag wrapper
│       └── FeatureGate.tsx
├── layers/
│   ├── implementations/
│   │   ├── PointLayer.ts               # F-0008: needs ff.point_layer
│   │   ├── PolygonLayer.ts             # F-0008: needs ff.polygon_layer
│   │   ├── HeatmapLayer.ts             # F-0008: needs ff.heatmap_layer
│   │   └── ClusterLayer.ts
│   ├── registry/
│   │   └── LayerRegistry.ts            # F-0008: needs ff.geospatial_layers
│   └── utils/
│       └── clustering.ts               # F-0008: needs ff.clustering_enabled
├── hooks/
│   ├── useWebSocket.ts                 # F-0008: needs ff.realtime_updates
│   ├── useFeatureFlag.ts               # NEW - feature flag hook
│   └── useHierarchy.ts
├── integrations/
│   └── LayerWebSocketIntegration.ts    # F-0008: needs ff.websocket_layers
├── types/
│   ├── contracts.generated.ts          # F-0001, F-0004: critical issues
│   └── zod/
│       └── messages.ts.deprecated      # F-0017: DELETE
├── utils/
│   ├── api.ts
│   ├── validateContract.ts             # NEW - runtime validation
│   └── sentry.ts                       # NEW - error monitoring
└── App.tsx
```

---

## Phase 1: Fix Critical Compilation Errors (Week 1)

### T-0002: Export Missing Contract Functions

**PATH:** `/home/user/Forecastin/frontend/src/types/contracts.generated.ts:359-363`

**Current (Broken):**
```typescript
// NOT EXPORTED - causes compilation failure
function getConfidence(entity: any): number {
  return entity.confidence ?? entity.confidenceScore ?? 0;
}

function getChildrenCount(entity: any): number {
  return entity.children_count ?? entity.childrenCount ?? 0;
}
```

**Fixed:**
```typescript
// PROPERLY EXPORTED with specific types
export function getConfidence(entity: EntityResponse): number {
  return entity.confidence_score;
}

export function getChildrenCount(entity: EntityResponse): number {
  return entity.children_count;
}

// Add type guards for geometry types
export function isPointGeometry(geom: Geometry): geom is PointGeometry {
  return geom.type === 'Point';
}

export function isPolygonGeometry(geom: Geometry): geom is PolygonGeometry {
  return geom.type === 'Polygon';
}
```

**Acceptance Test:**
```bash
cd frontend
npm run build  # MUST succeed (currently fails)
```

**Effort:** 15 minutes

---

### T-0003: Delete Deprecated File

**PATH:** `/home/user/Forecastin/frontend/src/types/zod/messages.ts.deprecated`

**Action:**
```bash
git rm frontend/src/types/zod/messages.ts.deprecated
```

**Effort:** 2 minutes

---

### T-0501: Remove Deprecated Environment Variables

**PATH:** `/home/user/Forecastin/frontend/.env.example`

**Current (Deprecated):**
```bash
# Deprecated REACT_APP_* variables (F-0013)
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

**Target (Vite):**
```bash
# Vite environment variables
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

**Migration:**
```typescript
// Before
const apiUrl = process.env.REACT_APP_API_URL;

// After
const apiUrl = import.meta.env.VITE_API_URL;
```

**Effort:** 2 hours (search/replace across 10-15 files)

---

## Phase 2: Feature Flag Integration (Week 2)

### T-0301: Create FeatureGate HOC

**File:** `frontend/src/components/FeatureGate/FeatureGate.tsx`

```typescript
import React, { ReactNode } from 'react';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

interface FeatureGateProps {
  /** Feature flag key (e.g., 'ff.point_layer') */
  flag: string;

  /** Children to render if flag enabled */
  children: ReactNode;

  /** Fallback to render if flag disabled */
  fallback?: ReactNode;

  /** Minimum rollout percentage required (0-100) */
  minRollout?: number;
}

/**
 * FeatureGate HOC - Conditionally render based on feature flags
 *
 * Addresses F-0008: 88% feature flags unused in frontend
 *
 * @example
 * ```tsx
 * <FeatureGate flag="ff.point_layer" fallback={<LegacyPointLayer />}>
 *   <NewPointLayer />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  flag,
  children,
  fallback = null,
  minRollout = 0
}: FeatureGateProps) {
  const { enabled, rolloutPercentage, loading, error } = useFeatureFlag(flag);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    console.error(`[FeatureGate] Error loading flag ${flag}:`, error);
    return <>{fallback}</>;
  }

  if (!enabled || rolloutPercentage < minRollout) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

**Hook Implementation:**
```typescript
// frontend/src/hooks/useFeatureFlag.ts

import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
}

export function useFeatureFlag(flagKey: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['feature-flag', flagKey],
    queryFn: async () => {
      const response = await api.get<FeatureFlag>(`/api/v1/feature-flags/${flagKey}`);
      return response.data;
    },
    staleTime: 60000, // Cache for 1 minute
    retry: 3
  });

  return {
    enabled: data?.enabled ?? false,
    rolloutPercentage: data?.rolloutPercentage ?? 0,
    loading: isLoading,
    error
  };
}
```

**Acceptance Test:**
```typescript
// frontend/src/components/FeatureGate/FeatureGate.test.tsx

import { render, screen } from '@testing-library/react';
import { FeatureGate } from './FeatureGate';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

test('renders children when flag enabled', async () => {
  // Mock feature flag API
  vi.mock('../../hooks/useFeatureFlag', () => ({
    useFeatureFlag: () => ({ enabled: true, rolloutPercentage: 100, loading: false })
  }));

  render(
    <FeatureGate flag="ff.test_flag">
      <div>New Feature</div>
    </FeatureGate>
  );

  expect(screen.getByText('New Feature')).toBeInTheDocument();
});

test('renders fallback when flag disabled', () => {
  vi.mock('../../hooks/useFeatureFlag', () => ({
    useFeatureFlag: () => ({ enabled: false, rolloutPercentage: 0, loading: false })
  }));

  render(
    <FeatureGate flag="ff.test_flag" fallback={<div>Legacy Feature</div>}>
      <div>New Feature</div>
    </FeatureGate>
  );

  expect(screen.getByText('Legacy Feature')).toBeInTheDocument();
});
```

**Effort:** 4 hours

---

### T-0302 to T-0309: Integrate Feature Flags

**Integrate 8 existing feature flags into frontend components:**

#### Example: Point Layer (T-0302)

**File:** `frontend/src/layers/implementations/PointLayer.ts`

**Before:**
```typescript
export class PointLayer {
  render(data: PointData[]) {
    // Always use new rendering
    return this.renderWithGPU(data);
  }
}
```

**After:**
```typescript
import { FeatureGate } from '../../components/FeatureGate/FeatureGate';

export function PointLayerWithFlag({ data }: { data: PointData[] }) {
  return (
    <FeatureGate
      flag="ff.point_layer"
      fallback={<LegacyPointLayer data={data} />}
    >
      <NewPointLayer data={data} />
    </FeatureGate>
  );
}
```

**Rollout Strategy:**
```
Week 1: 10% rollout (internal testing)
Week 2: 25% rollout (early adopters)
Week 3: 50% rollout (half of users)
Week 4: 100% rollout (all users)
```

**Effort per flag:** 2 hours × 8 flags = 16 hours

---

## Phase 3: Type Safety Improvements (Week 3)

### T-0502: Refactor `any` Types

**Current State:** 50-80 `any` types in frontend (F-0009)

**Strategy:**

1. **Identify all `any` types:**
```bash
cd frontend
grep -rn ": any" src/ --include="*.ts" --include="*.tsx" > any_types.txt
```

2. **Categorize by difficulty:**
   - Easy: 30% (explicit types available, just lazy)
   - Medium: 50% (requires type inference or narrowing)
   - Hard: 20% (requires refactoring or Pydantic contract changes)

3. **Systematic replacement:**

**Example 1: Easy - Explicit Type Available**
```typescript
// Before (F-0009)
function getConfidence(entity: any): number {
  return entity.confidence_score;
}

// After
import { EntityResponse } from '../types/contracts.generated';

function getConfidence(entity: EntityResponse): number {
  return entity.confidence_score;
}
```

**Example 2: Medium - Type Narrowing Required**
```typescript
// Before
function renderGeometry(geom: any) {
  if (geom.type === 'Point') {
    return renderPoint(geom);
  }
  // ...
}

// After
import { Geometry, isPointGeometry, isPolygonGeometry } from '../types/contracts.generated';

function renderGeometry(geom: Geometry) {
  if (isPointGeometry(geom)) {
    return renderPoint(geom);  // TypeScript knows geom is PointGeometry
  } else if (isPolygonGeometry(geom)) {
    return renderPolygon(geom);  // TypeScript knows geom is PolygonGeometry
  }
}
```

**Example 3: Hard - Refactoring Required**
```typescript
// Before
function processData(data: any) {
  // Complex processing with unknown structure
}

// After - Define proper type
interface ProcessableData {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

function processData(data: ProcessableData) {
  // Now type-safe
}
```

**Target:** Reduce from 50-80 `any` types to <20 (75% reduction)

**Effort:** 16 hours (30 minutes per `any` type × ~30 types)

---

### T-0503: Add ESLint Rule for Path Aliases

**Problem:** Deep relative imports (F-0012)

**Current:**
```typescript
import { api } from '../../../../utils/api';
import { EntityResponse } from '../../../types/contracts.generated';
```

**Target:**
```typescript
import { api } from '@/utils/api';
import { EntityResponse } from '@/types/contracts.generated';
```

**Configuration:**

**File:** `frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/layers/*": ["src/layers/*"]
    }
  }
}
```

**File:** `frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

**File:** `frontend/.eslintrc.js`
```javascript
module.exports = {
  rules: {
    // Enforce path aliases, ban deep relative imports
    'no-restricted-imports': ['error', {
      patterns: [
        '../../../*',  // Ban 3+ levels of '../'
        '../../../../*'
      ]
    }]
  }
};
```

**Migration:**
```bash
# Automated refactoring
cd frontend
npx jscodeshift -t scripts/codemods/migrate-to-path-aliases.ts src/
```

**Effort:** 2 hours

---

## Phase 4: Runtime Contract Validation (Week 4)

### Add Runtime Validation Layer

**File:** `frontend/src/utils/validateContract.ts`

```typescript
import { z } from 'zod';
import type { EntityResponse, HierarchyResponse } from '@/types/contracts.generated';

// Runtime validation schemas
const EntityResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  entity_type: z.string(),
  path: z.string(),
  path_depth: z.number(),
  confidence_score: z.number().min(0).max(1),
  children_count: z.number().min(0),  // F-0005
  created_at: z.string(),
  updated_at: z.string()
});

const HierarchyResponseSchema = z.object({
  entities: z.array(EntityResponseSchema),  // F-0005
  total: z.number(),
  has_more: z.boolean(),
  offset: z.number(),
  limit: z.number()
});

export function validateEntityResponse(data: unknown): EntityResponse {
  return EntityResponseSchema.parse(data);
}

export function validateHierarchyResponse(data: unknown): HierarchyResponse {
  return HierarchyResponseSchema.parse(data);
}
```

**Integration with API Client:**
```typescript
// frontend/src/utils/api.ts

import axios from 'axios';
import { validateEntityResponse, validateHierarchyResponse } from './validateContract';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
});

// Add response interceptor for validation
api.interceptors.response.use(
  (response) => {
    // Validate response against contract in development
    if (import.meta.env.DEV) {
      const endpoint = response.config.url;

      if (endpoint?.includes('/entities/')) {
        validateEntityResponse(response.data);
      } else if (endpoint?.includes('/hierarchy')) {
        validateHierarchyResponse(response.data);
      }
    }

    return response;
  },
  (error) => {
    // Log contract violations
    console.error('[API Contract Violation]', error);
    return Promise.reject(error);
  }
);
```

**Effort:** 6 hours

---

## Component Modernization

### Convert to Modern React Patterns

**Anti-pattern: Class Components**
```typescript
// OLD - class component
class HierarchyExplorer extends React.Component {
  state = { data: [] };

  componentDidMount() {
    this.fetchData();
  }

  fetchData() {
    // ...
  }

  render() {
    return <div>{this.state.data.map(...)}</div>;
  }
}
```

**Modern: Functional Component with Hooks**
```typescript
// NEW - functional component
import { useQuery } from '@tanstack/react-query';
import { validateHierarchyResponse } from '@/utils/validateContract';

export function HierarchyExplorer() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hierarchy'],
    queryFn: async () => {
      const response = await api.get('/api/v1/hierarchy');
      return validateHierarchyResponse(response.data);
    }
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {data.entities.map((entity) => (
        <EntityCard key={entity.id} entity={entity} />
      ))}
    </div>
  );
}
```

---

## Performance Optimization

### Code Splitting

```typescript
// frontend/src/App.tsx

import { lazy, Suspense } from 'react';

// Code-split heavy components
const GeospatialView = lazy(() => import('./components/Map/GeospatialView'));
const HierarchyExplorer = lazy(() => import('./components/Sidebar/HierarchyExplorer'));

export function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <GeospatialView />
      <HierarchyExplorer />
    </Suspense>
  );
}
```

**Bundle Size Targets:**
- Initial bundle: <300 KB (gzipped)
- Lazy-loaded chunks: <100 KB each
- Total JS: <1 MB

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// frontend/src/components/EntityCard/EntityCard.test.tsx

import { render, screen } from '@testing-library/react';
import { EntityCard } from './EntityCard';

test('renders entity with children count', () => {
  const entity = {
    id: '123',
    name: 'Tokyo',
    entity_type: 'city',
    path: 'world.asia.japan.tokyo',
    path_depth: 4,
    confidence_score: 0.95,
    children_count: 23,  // F-0005
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  };

  render(<EntityCard entity={entity} />);

  expect(screen.getByText('Tokyo')).toBeInTheDocument();
  expect(screen.getByText('23 children')).toBeInTheDocument();
});
```

### Integration Tests (React Testing Library)

```typescript
// frontend/src/App.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

test('loads and displays hierarchy', async () => {
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(screen.getByText('Tokyo')).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

```typescript
// frontend/e2e/hierarchy-navigation.spec.ts

import { test, expect } from '@playwright/test';

test('navigate hierarchy tree', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Click on Asia node
  await page.click('text=Asia');

  // Verify Japan appears
  await expect(page.locator('text=Japan')).toBeVisible();

  // Click on Japan
  await page.click('text=Japan');

  // Verify Tokyo appears
  await expect(page.locator('text=Tokyo')).toBeVisible();
});
```

---

## Migration Checklist

### Week 1: Critical Fixes
- [ ] T-0002: Export missing contract functions
- [ ] T-0003: Delete deprecated file
- [ ] T-0501: Update environment variables
- [ ] Verify: `npm run build` succeeds

### Week 2: Feature Flags
- [ ] T-0301: Create FeatureGate HOC
- [ ] T-0302 to T-0309: Integrate 8 feature flags
- [ ] Test rollout at 10%, 25%, 50%, 100%

### Week 3: Type Safety
- [ ] T-0502: Refactor 30 `any` types
- [ ] T-0503: Add path aliases
- [ ] Add ESLint rules to prevent regressions

### Week 4: Validation & Polish
- [ ] Add runtime contract validation
- [ ] Modernize class components to hooks
- [ ] Implement code splitting
- [ ] Performance testing

---

**Frontend Rebuild Strategy Complete**
**Addresses F-0001, F-0004, F-0008, F-0009, F-0012, F-0013**
**Timeline: 4 weeks, 100% backward compatible**
