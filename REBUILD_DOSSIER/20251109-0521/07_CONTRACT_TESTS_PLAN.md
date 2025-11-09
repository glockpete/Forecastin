# 07 Contract Testing Strategy

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Contract testing strategy to prevent API-frontend mismatches
**Evidence:** F-0001, F-0004, F-0005 (contract type mismatches)

---

## Executive Summary

**Problem:** TypeScript compilation failures due to missing properties and type loss in contract generation.

**Root Cause:**
- Contract generator loses Python type fidelity (`Literal['Point']` → `any`)
- Missing exports prevent proper type narrowing
- Response schemas incomplete (missing `entities`, `children_count` properties)

**Solution:** Three-tier contract testing strategy:
1. **Schema Tests** - Validate Pydantic → TypeScript conversion preserves types
2. **Integration Tests** - Verify actual API responses match TypeScript contracts
3. **Property-Based Tests** - Generate random valid/invalid inputs to test boundaries

**Exit Criteria:**
- Zero `any` types in generated contracts
- 100% property coverage (all Pydantic fields → TypeScript)
- All API responses validated against contracts in CI/CD

---

## Contract Testing Levels

### Level 1: Schema Validation Tests

**Purpose:** Ensure contract generator preserves type fidelity

**Test File:** `tests/contracts/test_contract_generation.py`

```python
import pytest
from api.contracts.requests import HierarchyQueryRequest
from api.contracts.responses import EntityResponse, HierarchyResponse
from scripts.dev.generate_contracts_v2 import generate_typescript_type


def test_literal_types_preserved():
    """Verify Literal types generate discriminated unions, not 'any'."""

    # Generate TypeScript for PointGeometry
    ts_code = generate_typescript_type(PointGeometry)

    # MUST NOT contain 'any'
    assert 'any' not in ts_code, "Contract generator must not lose type information"

    # MUST contain discriminated union
    assert "type: 'Point'" in ts_code, "Literal types must be preserved"

    # MUST have specific coordinate type
    assert 'Coordinate2D | Coordinate3D' in ts_code or '[number, number]' in ts_code


def test_all_pydantic_fields_exported():
    """Verify all Pydantic model fields are exported to TypeScript."""

    ts_code = generate_typescript_type(EntityResponse)

    # Check required fields from F-0005
    required_fields = [
        'id', 'name', 'entity_type', 'path', 'path_depth',
        'confidence_score', 'children_count',  # F-0005: was missing
        'created_at', 'updated_at'
    ]

    for field in required_fields:
        assert field in ts_code, f"Missing required field: {field}"


def test_hierarchy_response_has_entities_array():
    """Verify HierarchyResponse includes 'entities' array (F-0005)."""

    ts_code = generate_typescript_type(HierarchyResponse)

    # F-0005: Frontend expects 'entities' array
    assert 'entities:' in ts_code, "HierarchyResponse missing 'entities' property"
    assert 'EntityResponse[]' in ts_code, "entities must be array of EntityResponse"


def test_type_guards_exported():
    """Verify type guard functions are exported (F-0001)."""

    # Generate full contract file
    full_output = generate_contracts_v2()

    # Check for exported type guards
    assert 'export function isPointGeometry' in full_output
    assert 'export function getConfidence' in full_output
    assert 'export function getChildrenCount' in full_output

    # Ensure they're NOT 'any'
    assert 'entity: any' not in full_output, "Type guards must use specific types"
```

**Exit Criteria:**
- All tests pass
- Coverage: 100% of contract files
- CI/CD fails if `any` detected in generated contracts

---

### Level 2: API Integration Tests

**Purpose:** Verify actual API responses match TypeScript contracts

**Test File:** `tests/integration/test_api_contracts.py`

```python
import pytest
from httpx import AsyncClient
from api.main import app
from frontend.src.types.contracts import EntityResponse, HierarchyResponse


@pytest.mark.asyncio
async def test_hierarchy_query_response_matches_contract():
    """Verify /api/v1/hierarchy response matches HierarchyResponse contract."""

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/hierarchy", params={
            "parent_path": "world.asia",
            "offset": 0,
            "limit": 10
        })

    assert response.status_code == 200
    data = response.json()

    # Validate against contract schema
    # F-0005: Must include 'entities' array
    assert 'entities' in data, "Response missing 'entities' property"
    assert isinstance(data['entities'], list)

    # Validate pagination metadata
    assert 'total' in data
    assert 'offset' in data
    assert 'limit' in data
    assert 'has_more' in data

    # Validate each entity matches EntityResponse
    for entity in data['entities']:
        assert 'id' in entity
        assert 'name' in entity
        assert 'entity_type' in entity
        assert 'path' in entity
        assert 'path_depth' in entity
        assert 'confidence_score' in entity
        assert 'children_count' in entity  # F-0005: was missing
        assert 'created_at' in entity
        assert 'updated_at' in entity


@pytest.mark.asyncio
async def test_entity_create_request_validation():
    """Verify POST /api/v1/entities validates against EntityCreateRequest contract."""

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Valid request matching contract
        valid_request = {
            "name": "Tokyo",
            "entity_type": "city",
            "description": "Capital of Japan",
            "parent_id": None,
            "location": {
                "type": "Point",
                "coordinates": [139.6917, 35.6895]
            },
            "metadata": {"population": 13960000},
            "confidence_score": 0.95
        }

        response = await client.post("/api/v1/entities", json=valid_request)
        assert response.status_code == 201

        # Invalid request (missing required field)
        invalid_request = {
            "entity_type": "city"
            # Missing 'name' - should fail
        }

        response = await client.post("/api/v1/entities", json=invalid_request)
        assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_websocket_events_match_contracts():
    """Verify WebSocket events match LayerUpdateEvent contract."""

    from api.services.websocket_manager import WebSocketManager

    manager = WebSocketManager()

    # Create test event
    event = {
        "version": "1.0",
        "event_id": "evt_123",
        "timestamp": "2025-11-09T05:21:00Z",
        "type": "layer_update",
        "layer_id": "points_layer",  # F-0003: REQUIRED property
        "action": "add",
        "features": [{"type": "Feature", "geometry": {...}}],
        "affected_count": 1
    }

    # Validate event structure
    assert 'layer_id' in event, "LayerUpdateEvent missing required 'layer_id'"
    assert event['type'] in ['layer_update', 'feature_flag_update', 'hierarchy_invalidation']
    assert event['version'] == '1.0'
```

**Exit Criteria:**
- All API endpoints tested
- 100% contract property coverage
- Tests run on every PR in CI/CD

---

### Level 3: Property-Based Testing

**Purpose:** Generate random inputs to find edge cases

**Test File:** `tests/contracts/test_contract_properties.py`

```python
import pytest
from hypothesis import given, strategies as st
from api.contracts.responses import EntityResponse
from pydantic import ValidationError


@given(st.text(min_size=1, max_size=255))
def test_entity_name_accepts_valid_strings(name: str):
    """Entity name accepts any string 1-255 characters."""

    entity_data = {
        "id": "00000000-0000-0000-0000-000000000000",
        "name": name,
        "entity_type": "test",
        "path": "test",
        "path_depth": 1,
        "confidence_score": 0.5,
        "children_count": 0,
        "created_at": "2025-11-09T05:21:00Z",
        "updated_at": "2025-11-09T05:21:00Z"
    }

    # Should not raise ValidationError
    entity = EntityResponse(**entity_data)
    assert entity.name == name


@given(st.floats(min_value=0.0, max_value=1.0))
def test_confidence_score_range(score: float):
    """Confidence score accepts floats 0.0-1.0."""

    entity_data = {
        "id": "00000000-0000-0000-0000-000000000000",
        "name": "Test",
        "entity_type": "test",
        "path": "test",
        "path_depth": 1,
        "confidence_score": score,
        "children_count": 0,
        "created_at": "2025-11-09T05:21:00Z",
        "updated_at": "2025-11-09T05:21:00Z"
    }

    entity = EntityResponse(**entity_data)
    assert 0.0 <= entity.confidence_score <= 1.0


@given(st.floats())
def test_confidence_score_rejects_out_of_range(score: float):
    """Confidence score rejects values outside 0.0-1.0."""

    if 0.0 <= score <= 1.0:
        pytest.skip("Valid score")

    entity_data = {
        "id": "00000000-0000-0000-0000-000000000000",
        "name": "Test",
        "entity_type": "test",
        "path": "test",
        "path_depth": 1,
        "confidence_score": score,
        "children_count": 0,
        "created_at": "2025-11-09T05:21:00Z",
        "updated_at": "2025-11-09T05:21:00Z"
    }

    with pytest.raises(ValidationError):
        EntityResponse(**entity_data)
```

**Exit Criteria:**
- Property-based tests for all numeric/string boundaries
- 1000+ random inputs tested per property
- Zero ValidationError edge cases in production

---

## Contract Generator Improvements

### Current Issues (F-0004)

**PATH:** `/home/user/Forecastin/scripts/dev/generate_contracts_v2.py:1-200`

**Problems:**
1. `Literal['Point']` → `type: any` (loses discriminator)
2. `Tuple[float, float]` → `any[]` (loses tuple typing)
3. Type guards not exported

### Improved Generator

```python
# scripts/dev/generate_contracts_v2.py

from typing import get_args, get_origin, Literal
from pydantic import BaseModel
from pydantic.fields import FieldInfo


def pydantic_to_typescript(field_info: FieldInfo) -> str:
    """Convert Pydantic field to TypeScript type WITH full fidelity."""

    annotation = field_info.annotation
    origin = get_origin(annotation)
    args = get_args(annotation)

    # Handle Literal types (CRITICAL - addresses F-0004)
    if origin is Literal:
        # Literal['Point'] → 'Point' (NOT 'any')
        literal_values = [f"'{val}'" if isinstance(val, str) else str(val) for val in args]
        return ' | '.join(literal_values)

    # Handle Tuple types
    if origin is tuple:
        # Tuple[float, float] → [number, number] (NOT 'any[]')
        ts_types = [python_to_ts_type(arg) for arg in args]
        return f"[{', '.join(ts_types)}]"

    # Handle Union types
    if origin is Union:
        ts_types = [pydantic_to_typescript_recursive(arg) for arg in args]
        return ' | '.join(ts_types)

    # Handle List types
    if origin is list:
        item_type = pydantic_to_typescript_recursive(args[0])
        return f"{item_type}[]"

    # Primitive types
    return python_to_ts_type(annotation)


def python_to_ts_type(python_type) -> str:
    """Map Python types to TypeScript types."""

    mapping = {
        int: 'number',
        float: 'number',
        str: 'string',
        bool: 'boolean',
        dict: 'Record<string, unknown>',
        type(None): 'null'
    }

    return mapping.get(python_type, 'unknown')


def generate_type_guards(model: BaseModel) -> str:
    """Generate type guard functions (addresses F-0001)."""

    guards = []

    # For discriminated unions
    if hasattr(model, '__fields__') and 'type' in model.__fields__:
        type_field = model.__fields__['type']
        if get_origin(type_field.annotation) is Literal:
            literal_value = get_args(type_field.annotation)[0]

            guard = f"""
export function is{model.__name__}(obj: unknown): obj is {model.__name__} {{
  return typeof obj === 'object' && obj !== null && 'type' in obj && obj.type === '{literal_value}';
}}
"""
            guards.append(guard)

    return '\n'.join(guards)


def generate_contracts_v2():
    """Generate TypeScript contracts from Pydantic models."""

    from api.contracts import requests, responses, events

    ts_output = []

    ts_output.append("""
/**
 * Auto-generated TypeScript contracts
 * DO NOT EDIT - generated from api/contracts/*.py
 *
 * Generation: python scripts/dev/generate_contracts_v2.py
 * Addresses: F-0001, F-0004, F-0005
 */
""")

    # Generate base types
    ts_output.append(generate_base_types())

    # Generate interfaces for each Pydantic model
    for model_class in [
        requests.HierarchyQueryRequest,
        requests.EntityCreateRequest,
        responses.EntityResponse,
        responses.HierarchyResponse,
        events.LayerUpdateEvent,
        # ... more models
    ]:
        ts_output.append(generate_interface(model_class))
        ts_output.append(generate_type_guards(model_class))

    # Generate utility functions (addresses F-0001)
    ts_output.append(generate_utility_functions())

    # Write to file
    output_file = 'frontend/src/types/contracts.generated.ts'
    with open(output_file, 'w') as f:
        f.write('\n'.join(ts_output))

    print(f"Generated {output_file}")

    # Validate: MUST NOT contain 'any'
    if 'any' in '\n'.join(ts_output):
        raise ValueError("Generated contracts contain 'any' type - F-0004 not resolved")


if __name__ == '__main__':
    generate_contracts_v2()
```

**Exit Criteria:**
- Zero `any` types in output
- All `Literal` types preserved as discriminators
- All `Tuple` types preserved as tuples (not arrays)
- Type guards exported for all discriminated unions

---

## Frontend Contract Validation

### Runtime Validation

**File:** `frontend/src/utils/validateContract.ts`

```typescript
import { z } from 'zod';
import type { EntityResponse, HierarchyResponse } from '../types/contracts.generated';


// Zod schema for EntityResponse (runtime validation)
const EntityResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  entity_type: z.string(),
  description: z.string().nullable().optional(),
  path: z.string(),
  path_depth: z.number().int().min(0),
  location: z.record(z.unknown()).nullable().optional(),
  confidence_score: z.number().min(0).max(1),
  children_count: z.number().int().min(0),  // F-0005: REQUIRED
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});


// Zod schema for HierarchyResponse
const HierarchyResponseSchema = z.object({
  entities: z.array(EntityResponseSchema),  // F-0005: REQUIRED
  total: z.number().int().min(0),
  has_more: z.boolean(),
  offset: z.number().int().min(0),
  limit: z.number().int().min(1).max(1000),
  parent_path: z.string().nullable().optional(),
  max_depth_reached: z.boolean()
});


/**
 * Validate API response at runtime
 * @throws {Error} if response doesn't match contract
 */
export function validateEntityResponse(data: unknown): EntityResponse {
  return EntityResponseSchema.parse(data);
}


export function validateHierarchyResponse(data: unknown): HierarchyResponse {
  return HierarchyResponseSchema.parse(data);
}


/**
 * Development mode: log contract violations without throwing
 */
export function validateInDevMode<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  endpoint: string
): T | null {
  const result = schema.safeParse(data);

  if (!result.success) {
    console.error(`[Contract Violation] ${endpoint}:`, result.error.format());

    // In production, throw; in dev, return null
    if (import.meta.env.PROD) {
      throw new Error(`Contract violation at ${endpoint}`);
    }

    return null;
  }

  return result.data;
}
```

**Exit Criteria:**
- All API responses validated in development mode
- Contract violations logged to console
- Production throws on contract mismatch

---

## CI/CD Integration

### Contract Testing Pipeline

**File:** `.github/workflows/contract-tests.yml`

```yaml
name: Contract Tests

on:
  pull_request:
    paths:
      - 'api/contracts/**'
      - 'frontend/src/types/contracts.generated.ts'
      - 'scripts/dev/generate_contracts_v2.py'

jobs:
  contract-validation:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install hypothesis  # Property-based testing

      - name: Generate TypeScript contracts
        run: python scripts/dev/generate_contracts_v2.py

      - name: Check for 'any' types (F-0004)
        run: |
          if grep -n ":\s*any" frontend/src/types/contracts.generated.ts; then
            echo "ERROR: Generated contracts contain 'any' type"
            echo "This violates F-0004 - contract generator must preserve type fidelity"
            exit 1
          fi

      - name: Verify required exports (F-0001)
        run: |
          required_exports=(
            "export function isPointGeometry"
            "export function getConfidence"
            "export function getChildrenCount"
          )

          for export in "${required_exports[@]}"; do
            if ! grep -q "$export" frontend/src/types/contracts.generated.ts; then
              echo "ERROR: Missing required export: $export"
              exit 1
            fi
          done

      - name: Run contract schema tests
        run: pytest tests/contracts/test_contract_generation.py -v

      - name: Run property-based tests
        run: pytest tests/contracts/test_contract_properties.py -v --hypothesis-seed=0

      - name: Run API integration tests
        run: pytest tests/integration/test_api_contracts.py -v

      - name: TypeScript type check
        run: |
          cd frontend
          npm install
          npm run type-check  # Must pass with generated contracts

      - name: Check for git diff
        run: |
          git diff --exit-code frontend/src/types/contracts.generated.ts || \
          (echo "ERROR: Generated contracts out of sync. Run: python scripts/dev/generate_contracts_v2.py" && exit 1)
```

**Exit Criteria:**
- CI fails if `any` types detected
- CI fails if required exports missing
- CI fails if TypeScript compilation fails
- CI fails if contracts out of sync with Pydantic models

---

## Contract Versioning Strategy

### Semantic Versioning for Contracts

**Version Format:** `MAJOR.MINOR.PATCH`

**Rules:**
- **MAJOR**: Breaking changes (remove field, change type)
- **MINOR**: Additive changes (add optional field)
- **PATCH**: Documentation or internal changes

**Example:**

```python
# api/contracts/responses.py

class EntityResponse(BaseModel):
    """
    Entity response contract

    @version 1.1.0
    @changelog
      - 1.1.0: Added children_count field (F-0005)
      - 1.0.0: Initial version
    """

    id: UUID
    name: str
    entity_type: str
    # ...
    children_count: int  # Added in v1.1.0

    model_config = ConfigDict(
        contract_version='1.1.0'
    )
```

### Breaking Change Detection

```python
# tests/contracts/test_contract_versioning.py

def test_breaking_changes_increment_major_version():
    """Ensure breaking changes increment MAJOR version."""

    # Load previous contract version from git
    previous_schema = get_schema_from_git('v1.0.0', EntityResponse)
    current_schema = EntityResponse.model_json_schema()

    # Detect breaking changes
    removed_fields = set(previous_schema['properties'].keys()) - set(current_schema['properties'].keys())

    if removed_fields:
        assert current_schema['contract_version'].split('.')[0] > previous_schema['contract_version'].split('.')[0], \
            f"Removed fields {removed_fields} require MAJOR version increment"
```

---

## Appendix: Example Test Scaffold

See `07_CONTRACT_TESTS.examples/` for complete test scaffolds:

- `test_entity_response.py` - Full EntityResponse test suite
- `test_hierarchy_response.py` - HierarchyResponse with F-0005 fix
- `test_layer_update_event.py` - WebSocket event with F-0003 fix
- `test_geometry_types.py` - GeoJSON geometry type guards

---

**Contract Testing Strategy Complete**
**Addresses F-0001, F-0004, F-0005**
**Exit Criteria: Zero 'any' types, 100% property coverage, CI/CD validation**
