# Frontend Hardening Scout Log

**Project:** Forecastin Frontend Hardening & Developer Experience Enhancement
**Phase:** Multi-phase code quality and type safety improvement
**Started:** 2025-11-06
**Mode:** CODE-ONLY (no network/DB calls, deterministic, idempotent)

---

## Session Log

### 2025-11-08 - Phase 0: Inventory and Baselines

#### Objective

Establish checks/ scaffolding, inventory all console.* usage, verify import paths, and create baseline documentation for the refactoring project.

#### Discoveries

1. **Frontend Build Scripts** (`frontend/package.json:35-44`)
   - ✅ `typecheck`: `tsc --noEmit`
   - ✅ `build`: `tsc && vite build`
   - ✅ `test`: `vitest run`
   - ❌ **Missing**: `lint` script (ESLint config exists but no package.json script)
   - **Action Required:** Add `lint` and `lint:fix` scripts

2. **TypeScript Configuration** (`frontend/tsconfig.json`)
   - ✅ `strict: true`
   - ✅ `baseUrl: "src"`
   - ✅ Path aliases configured: `@types/*`, `@components/*`, `@lib/*`, `@hooks/*`, `@utils/*`, `@layers/*`
   - ⚠️ `exactOptionalPropertyTypes: false` (should enable)
   - ⚠️ `noUncheckedIndexedAccess: false` (should enable, currently has TODO comment)

3. **ESLint Configuration** (`frontend/.eslintrc.js:52`)
   - Rule: `'no-console': ['warn', { allow: ['warn', 'error'] }]`
   - **Prohibits:** `console.log`, `console.debug`, `console.info`
   - **Allows:** `console.warn`, `console.error`

4. **Console Usage Audit**
   - **Total occurrences found:** 95+ (including README.md examples and tests)
   - **Code files with violations:** 34+ prohibited console.* calls
   - **Primary offenders:**
     - `utils/stateManager.ts` — 19 instances
     - `utils/errorRecovery.ts` — 8 instances
     - `handlers/realtimeHandlers.ts` — 8 instances
     - `integrations/LayerWebSocketIntegration.ts` — 5 instances
     - `hooks/useHybridState.ts` — 4 instances
   - **See:** `checks/BUGLOG.md` for complete file-line citations

5. **Import Path Analysis**
   - ✅ **No imports escaping src/** — `contracts.generated.ts` is located at `frontend/src/types/contracts.generated.ts`
   - ⚠️ **Inconsistent import style** — Most files use relative imports (`../../types/...`) instead of configured aliases (`@types/...`)
   - **Affected files:** All component files in `frontend/src/components/*`

6. **Contracts Location**
   - Root `/contracts/` directory contains OpenAPI and WebSocket JSON schemas
   - Generated TypeScript types are properly located at `frontend/src/types/contracts.generated.ts`
   - No import path drift detected

#### Changes Made

1. **Created Checks Scaffolding**
   - `checks/BUGLOG.md` — Console error and defect tracking log
   - `checks/quick_wins.json` — Machine-readable trivial fixes
   - `checks/DEFECTS.md` — Prioritised defect registry
   - `checks/PR_QUEUE.md` — Planned PR pipeline with scope and acceptance criteria

2. **Updated SCOUT_LOG.md**
   - Added Phase 0 findings (this section)

#### Defects Identified

See `checks/DEFECTS.md` for complete details. Summary:

- **DEF-001 [P1]:** Console noise violates ESLint rules (34+ violations)
- **DEF-002 [P2]:** Missing lint script in package.json
- **DEF-003 [P2]:** Inconsistent import styles (relative vs. aliases)
- **DEF-004 [P1]:** No dark theme background enforcement (user-reported)

#### Quick Wins Identified

See `checks/quick_wins.json` for complete details. Summary:

- **QW-001:** Add lint script (5 minutes)
- **QW-002:** Replace relative imports with aliases (2-3 hours)
- **QW-003:** Enable exactOptionalPropertyTypes (trivial)
- **QW-004:** Enable noUncheckedIndexedAccess (blocked by existing code)

#### Next Steps

1. **PR-001 [Phase 0]:** Commit this scaffolding as baseline
2. **PR-002 [Phase 1]:** Implement logger utility and eradicate console noise
3. **PR-003 [Phase 2]:** Enforce dark theme background and tokens
4. **PR-004 [Phase 3]:** Normalise import paths to use aliases
5. **PR-005 [Phase 4]:** Enable strict TypeScript flags

#### Metrics

- Files audited: 95+ (via grep)
- Console violations found: 34+ in code files
- Defects catalogued: 4 (2 x P1, 2 x P2)
- Quick wins identified: 4
- Checks files created: 4
- Time elapsed: ~45 minutes

---

### 2025-11-06 - Phase TS: Type Safety Hardening

#### Discoveries

1. **Current TypeScript Configuration**
   - Already had `"strict": true` enabled
   - Missing additional strictness flags: `noImplicitOverride`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitReturns`
   - Location: `frontend/tsconfig.json`

2. **Type Errors Found**
   - `frontend/src/App.tsx:33` - Implicit `any` in retry callback parameters (`failureCount`, `error`)
   - `frontend/src/App.tsx:40` - Implicit `any` in retryDelay callback (`attemptIndex`)
   - These are now fixed with explicit types: `failureCount: number, error: Error`, `attemptIndex: number`

3. **Duplicate Type Definitions**
   - `Entity` interface defined in three places:
     - `frontend/src/types/index.ts` (canonical)
     - `frontend/src/hooks/useHierarchy.ts` (duplicate)
     - `frontend/src/store/uiStore.ts` (imports from canonical)
   - `BreadcrumbItem` interface defined in two places:
     - `frontend/src/types/index.ts` (canonical)
     - `frontend/src/hooks/useHierarchy.ts` (duplicate with different schema)
     - `frontend/src/store/uiStore.ts` (different schema: `label` instead of `name`)
   - **Decision:** Keep canonical types in `types/index.ts`, update duplicates to import

4. **Type Safety Gaps**
   - String-based IDs allow mixing different entity types (e.g., actor ID used where org ID expected)
   - Array/object types use mutable references where readonly would be safer
   - `any` types in metadata and filter objects
   - Missing Result<T,E> pattern for operations that can fail

#### Changes Made

1. **Updated tsconfig.json** (`frontend/tsconfig.json`)
   ```diff
   + "noImplicitOverride": true,
   + "exactOptionalPropertyTypes": true,
   + "noUncheckedIndexedAccess": true,
   + "noImplicitReturns": true,
   ```

2. **Fixed Type Errors in App.tsx** (`frontend/src/App.tsx:33,40`)
   - Added explicit types to React Query retry callbacks
   - `retry: (failureCount: number, error: Error) => ...`
   - `retryDelay: (attemptIndex: number) => ...`

3. **Created Branded Types System** (`frontend/src/types/brand.ts`)
   - `Brand<T, K>` utility for nominal typing
   - `EntityId<T>` where T is EntityType discriminator ('actor', 'org', 'initiative', etc.)
   - Specific type aliases: `ActorId`, `OrgId`, `OutcomeId`, etc.
   - Constructor functions: `toEntityId()`, `toPathString()`, `toConfidenceScore()`, `toTimestamp()`
   - `Result<T, E>` type with `Ok()`, `Err()`, `unwrap()`, `unwrapOr()` helpers
   - Type guards and mappers: `isOk()`, `isErr()`, `mapResult()`, `chainResult()`

4. **Updated Canonical Types** (`frontend/src/types/index.ts`)
   - Made `Entity<T>` generic over EntityType
   - Changed `id`, `parentId` to `EntityId<T>`
   - Changed `path`, `columnPaths` to `PathString`
   - Changed `confidence` to `ConfidenceScore` (branded 0-1 range)
   - Changed `createdAt`, `updatedAt`, `timestamp` to `Timestamp` (ISO 8601)
   - Changed mutable arrays to `readonly` arrays
   - Changed `any` to `unknown` for data fields
   - Made `BreadcrumbItem<T>`, `HierarchyNode<T>`, `HierarchyResponse<T>`, `UIState<T>`, `SearchResult<T>` generic

#### Design Decisions

1. **Branded Types Strategy**
   - Use nominal typing via Brand<T,K> to prevent ID mixing at compile time
   - Generic Entity<T> allows type-safe specialization (e.g., `Entity<'actor'>`)
   - Runtime constructors (`toEntityId`) provide validation and type casting
   - This is a breaking change for existing code but provides strong safety guarantees

2. **Readonly-by-Default for Collections**
   - Arrays and objects are marked `readonly` to prevent accidental mutation
   - Forces explicit use of immutable update patterns
   - Aligns with React best practices and React Query expectations

3. **Result<T,E> Pattern**
   - Rust-inspired error handling without exceptions
   - Makes error cases explicit in function signatures
   - Will be used for parsing, validation, and fallible operations in Phase Guards

4. **Migration Path**
   - Phase TS: Define branded types and update canonical type definitions ✅
   - Phase TS: Codemod to replace raw string IDs with branded constructors (pending)
   - Phase Guards: Add runtime validation with Zod
   - Phase Guards: Wrap WS handlers with parseOrReport<T>

#### Known Issues & Follow-ups

1. **Duplicate Type Definitions**
   - `useHierarchy.ts` defines Entity, HierarchyNode, BreadcrumbItem locally
   - `uiStore.ts` has a different BreadcrumbItem schema (`label` vs `name`)
   - **Follow-up:** Create patch to unify type imports in Phase TS completion

2. **Missing Type Parameters in useHierarchy**
   - Retry callbacks (lines 83, 90) have implicit `any` parameters
   - **Follow-up:** Fix in next patch

3. **Type Safety Gaps Still Present**
   - Many files still use plain `string` for IDs instead of `EntityId<T>`
   - WebSocket handlers don't validate message schemas
   - No idempotency guards for duplicate messages
   - **Follow-up:** Address in Phase Guards

4. **React Query Type Safety**
   - Query keys not using `QueryKey` branded type
   - staleTime and gcTime could be branded for time duration safety
   - **Follow-up:** Implement in Phase Cache

#### Next Steps (Phase TS Completion)

1. Create `codemods/brandIds.ts` to automate ID type migration
2. Apply codemod dry-run on 3-5 representative files
3. Generate `patches/` directory with suggested changes
4. Update `useHierarchy.ts` to remove duplicate types and import from `types/index.ts`
5. Unify `BreadcrumbItem` schema across codebase
6. Fix remaining implicit `any` type parameters
7. Run full type check and ensure no regressions

#### Metrics

- Files modified: 3
  - `frontend/tsconfig.json`
  - `frontend/src/App.tsx`
  - `frontend/src/types/brand.ts` (new)
  - `frontend/src/types/index.ts`
- Type errors fixed: 3 (App.tsx implicit any parameters)
- New type safety features: 12 branded types, Result<T,E> pattern
- Lines of code added: ~250 (brand.ts), ~30 (types/index.ts updates)
- Breaking changes: Yes (Entity signature changed to generic)

---

## Trade-offs & Architectural Notes

### Branded Types vs. Runtime Validation

**Decision:** Use both branded types (compile-time) AND runtime validation (Phase Guards)

**Rationale:**
- Branded types catch errors during development (IDE autocomplete, tsc checks)
- Runtime validation catches errors from external sources (API, WebSocket, user input)
- Together they provide defense-in-depth

**Trade-off:**
- More verbose code (need to use constructors like `toEntityId()`)
- Migration cost (need to update all existing code)
- **Benefit:** Prevents entire classes of bugs (ID confusion, out-of-range confidence scores)

### Generic Entity<T> vs. Separate Interfaces

**Decision:** Use generic `Entity<T extends EntityType>`

**Alternatives considered:**
1. Separate interfaces: `ActorEntity`, `OrgEntity`, `OutcomeEntity`, etc.
2. Union type: `Entity = ActorEntity | OrgEntity | ...`
3. Generic with discriminator: `Entity<T>` (chosen)

**Rationale:**
- Avoids code duplication (all entities share 90% of fields)
- Allows flexible typing: `Entity` (any type), `Entity<'actor'>` (specific)
- Easier to add new entity types (update EntityType union, no new interfaces)

**Trade-off:**
- Slightly more complex type signatures
- Need to be careful with type narrowing
- **Benefit:** Single source of truth, easier maintenance

### Readonly Arrays vs. Mutable Arrays

**Decision:** Use `readonly` for all collection types in interfaces

**Rationale:**
- Prevents accidental mutation bugs
- Aligns with React immutability requirements
- Forces explicit use of spread operators and immutable updates
- Better for React.memo and useMemo optimization

**Trade-off:**
- Need to cast or clone when calling mutable APIs
- Slightly more verbose update code
- **Benefit:** Safer, more predictable state updates

---

## Questions & Blockers

### Questions

1. **Entity Type Taxonomy:** Do we need additional entity types beyond the 12 defined?
   - Current: actor, org, initiative, outcome, horizon, evidence, stakeholder, opportunity, action, lens, layer, filter
   - Potential additions: metric, kpi, goal, risk, assumption, dependency?

2. **BreadcrumbItem Schema Divergence:** Which schema is correct?
   - `types/index.ts`: `{ id, name, type, path, pathDepth }`
   - `uiStore.ts`: `{ label, path, entityId? }`
   - Need to clarify with product/UX team

3. **Confidence Score Range:** Should we validate 0-1 range at runtime or allow >1?
   - Some ML systems use log-odds or unnormalized scores
   - Decision: Enforce 0-1 range in `toConfidenceScore()`, document assumption

### Blockers

None currently. All Phase TS work can proceed without external dependencies.

---

## Useful Snippets & Patterns

### Creating a Branded Entity ID

```typescript
import { toEntityId } from './types/brand';

// From API response (unsafe string)
const actorId = toEntityId(responseData.id, 'actor');

// Type error - prevents mixing entity types
const org: Entity<'org'> = { id: actorId, ... }; // ❌ Error

// Correct usage
const actor: Entity<'actor'> = { id: actorId, ... }; // ✅
```

### Using Result<T,E> Pattern

```typescript
import { Result, Ok, Err, unwrapOr } from './types/brand';

function parseEntity(data: unknown): Result<Entity, ParseError> {
  if (!isValidEntity(data)) {
    return Err(new ParseError('Invalid entity'));
  }
  return Ok(data);
}

const result = parseEntity(rawData);
const entity = unwrapOr(result, defaultEntity);
```

### Safe Path Construction

```typescript
import { toPathString } from './types/brand';

const path = toPathString('/actor/123/initiative/456'); // ✅
const badPath = toPathString('actor/123'); // ❌ Throws - must start with /
```

---

## References

- TypeScript Handbook: Branded Types https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html
- React Query Best Practices: https://tkdodo.eu/blog/react-query-best-practices
- Rust Result<T,E>: https://doc.rust-lang.org/std/result/
