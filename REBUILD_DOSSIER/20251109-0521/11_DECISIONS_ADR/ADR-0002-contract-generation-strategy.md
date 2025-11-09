# ADR-0002: Contract Generation Strategy

**Status:** Accepted
**Date:** 2025-11-09
**Deciders:** Engineering Team
**Evidence:** F-0001, F-0004, F-0005, Antipattern-3

---

## Context

Current contract generator (`generate_contracts_v2.py`) has critical issues:

**Problems:**
1. **Type Loss (F-0004):** `Literal['Point']` → `type: any`
2. **Missing Exports (F-0001):** Type guards not exported
3. **Incomplete Schemas (F-0005):** Missing properties (`entities`, `children_count`)
4. **No Validation:** Generator doesn't verify output

**PATH Evidence:**
- `/home/user/Forecastin/scripts/dev/generate_contracts_v2.py:50-100` - Type mapping logic
- `/home/user/Forecastin/frontend/src/types/contracts.generated.ts:359-363` - Missing exports

**Impact:**
- TypeScript compilation failures
- Loss of type safety (defeats purpose of TypeScript)
- Runtime errors from missing properties

---

## Decision

We will implement a new contract generation strategy with **full type fidelity**:

### 1. Preserve All Type Information

**Type Mapping Rules:**

| Python Type | TypeScript Type | Example |
|-------------|-----------------|---------|
| `Literal['Point']` | `'Point'` | NOT `any` |
| `Tuple[float, float]` | `[number, number]` | NOT `any[]` |
| `Union[A, B]` | `A \| B` | Discriminated unions |
| `list[str]` | `string[]` | Array of strings |
| `dict` | `Record<string, unknown>` | Generic object |

### 2. Export All Utilities

**Required exports:**
- Type guard functions for discriminated unions
- Utility functions (getConfidence, getChildrenCount)
- Validation functions
- Constants

### 3. Validate Generated Output

**CI/CD checks:**
```bash
# MUST NOT contain 'any' type
if grep -n ": any" frontend/src/types/contracts.generated.ts; then
  echo "ERROR: Generated contracts contain 'any' type (F-0004)"
  exit 1
fi

# MUST export required functions
required_exports=("isPointGeometry" "getConfidence" "getChildrenCount")
for export in "${required_exports[@]}"; do
  if ! grep -q "export function $export" frontend/src/types/contracts.generated.ts; then
    echo "ERROR: Missing required export: $export (F-0001)"
    exit 1
  fi
done
```

### 4. Implementation

```python
# scripts/dev/generate_contracts_v2.py

def pydantic_to_typescript(field_info: FieldInfo) -> str:
    """Convert Pydantic field to TypeScript WITH full fidelity."""

    annotation = field_info.annotation
    origin = get_origin(annotation)
    args = get_args(annotation)

    # CRITICAL: Preserve Literal types
    if origin is Literal:
        literal_values = [f"'{val}'" if isinstance(val, str) else str(val) for val in args]
        return ' | '.join(literal_values)  # 'Point' NOT 'any'

    # CRITICAL: Preserve Tuple types
    if origin is tuple:
        ts_types = [python_to_ts_type(arg) for arg in args]
        return f"[{', '.join(ts_types)}]"  # [number, number] NOT any[]

    # Handle Union, List, etc.
    # ...

    return python_to_ts_type(annotation)
```

---

## Consequences

**Positive:**
- Zero `any` types in generated contracts
- Full TypeScript type safety
- Compilation errors caught at build time
- Better IDE autocomplete
- Prevents runtime errors

**Negative:**
- More complex generator logic
- Requires careful type mapping maintenance
- CI/CD validation adds ~30 seconds

**Migration:**
- Update generator (T-0201)
- Regenerate all contracts
- Verify TypeScript compilation succeeds
- Add CI/CD validation

---

## Alternatives Considered

### Alternative 1: Manual TypeScript Definitions

**Pros:** Full control over types

**Cons:**
- Duplication between Python and TypeScript
- Easy to get out of sync
- More maintenance burden

**Rejected because:** Contract-first approach is core to architecture

### Alternative 2: JSON Schema Generation

**Pros:** Standard format, many tools support it

**Cons:**
- Extra step (Pydantic → JSON Schema → TypeScript)
- Type fidelity still at risk
- More dependencies

**Rejected because:** Direct Pydantic → TypeScript is simpler

---

## Related

- **Addresses:** F-0001, F-0004, F-0005, AP-3
- **Tasks:** T-0201, T-0202, T-0203
- **Files:** `scripts/dev/generate_contracts_v2.py`, `04_TARGET_ARCHITECTURE.contracts.ts`
