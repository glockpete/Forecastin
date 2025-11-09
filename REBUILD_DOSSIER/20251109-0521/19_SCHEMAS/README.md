# JSON Schema Definitions

**Purpose:** Machine-readable contract schemas for validation and code generation

---

## Available Schemas

| Schema | File | Description |
|--------|------|-------------|
| EntityResponse | `entity_response.schema.json` | Single entity response |
| HierarchyResponse | `hierarchy_response.schema.json` | Paginated hierarchy query response |
| LayerUpdateEvent | `layer_update_event.schema.json` | WebSocket layer update event |

---

## Usage

### Backend Validation

```python
import json
from jsonschema import validate

# Load schema
with open('REBUILD_DOSSIER/20251109-0521/19_SCHEMAS/entity_response.schema.json') as f:
    schema = json.load(f)

# Validate data
data = {"id": "123", "name": "Tokyo", ...}
validate(instance=data, schema=schema)  # Raises ValidationError if invalid
```

### Frontend Validation

```typescript
import Ajv from 'ajv';
import entitySchema from './entity_response.schema.json';

const ajv = new Ajv();
const validate = ajv.compile(entitySchema);

const data = { id: '123', name: 'Tokyo', ... };

if (!validate(data)) {
  console.error('Validation errors:', validate.errors);
}
```

### Code Generation

```bash
# Generate TypeScript types from JSON Schema
npx quicktype --src-lang schema --lang typescript \
  --src entity_response.schema.json \
  --out entity_response.ts
```

---

## Schema Compliance

**All schemas MUST:**
- Follow JSON Schema Draft 07
- Include `$schema` and `$id`
- Document all required fields
- Include descriptions
- Define validation rules (min/max, pattern, enum)

**Validation in CI:**
```bash
# Validate schemas are valid JSON Schema
npx ajv compile -s entity_response.schema.json
```

---

## Relationship to Contracts

**Source of Truth:** Pydantic models (`api/contracts/`)

**Generation Flow:**
```
Pydantic models
    ↓
Python contracts (api/contracts/*.py)
    ↓
TypeScript contracts (frontend/src/types/contracts.generated.ts)
    ↓
JSON Schemas (REBUILD_DOSSIER/.../19_SCHEMAS/*.json)
```

**Update Process:**
1. Update Pydantic model
2. Run `python scripts/dev/generate_contracts_v2.py`
3. Generate JSON Schema (if needed for external integrations)

---

## Evidence References

- **F-0003:** `layer_update_event.schema.json` includes required `layer_id` property
- **F-0005:** `hierarchy_response.schema.json` includes required `entities` array
- **F-0005:** `entity_response.schema.json` includes required `children_count` property
