# Patch: Add Validators to Entity Forms (Example)

**Priority**: MEDIUM
**Effort**: 0.5-1 hour per form
**ROI**: 60
**Risk**: LOW
**Reversible**: YES

## Problem
Forms accept invalid entity data (invalid LTREE paths, malformed dates, etc.) and send it to backend, causing server errors.

## Solution
Use validators from `types/contracts.generated.ts` (already created) for client-side validation.

## Available Validators (Already Created)

```typescript
// From types/contracts.generated.ts

/**
 * Validates LTREE path format
 * Valid: "root", "root.child", "root.child.grandchild"
 * Invalid: ".root", "root.", "root..child", "root child"
 */
export function isValidLTreePath(path: string): path is LTreePath {
  return /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(path);
}

/**
 * Validates ISO 8601 datetime string
 */
export function isValidISODateTime(dateStr: string): dateStr is ISODateTimeString {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && dateStr === date.toISOString();
}

/**
 * Validates UUID string format
 */
export function isValidUUID(uuid: string): uuid is UUIDString {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}
```

## Example: Entity Form Component

```typescript
// EntityForm.tsx (example - file may not exist)
import React, { useState } from 'react';
import { isValidLTreePath, isValidUUID } from '../types/contracts.generated';

interface EntityFormProps {
  onSubmit: (data: any) => void;
}

export const EntityForm: React.FC<EntityFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    type: '',
    path: '',
    parentId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate ID (UUID)
    if (formData.id && !isValidUUID(formData.id)) {
      newErrors.id = 'Invalid UUID format';
    }

    // Validate path (LTREE)
    if (!isValidLTreePath(formData.path)) {
      newErrors.path = 'Invalid path format. Use: root.child.grandchild';
    }

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Validate parent ID if provided
    if (formData.parentId && !isValidUUID(formData.parentId)) {
      newErrors.parentId = 'Invalid parent UUID format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      onSubmit(formData);
    }
  };

  const handlePathBlur = () => {
    // Real-time validation on blur
    if (formData.path && !isValidLTreePath(formData.path)) {
      setErrors(prev => ({
        ...prev,
        path: 'Invalid path. Examples: "root", "root.companies", "root.companies.acme"'
      }));
    } else {
      setErrors(prev => {
        const { path, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="id">ID (UUID):</label>
        <input
          id="id"
          type="text"
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          placeholder="550e8400-e29b-41d4-a716-446655440000"
        />
        {errors.id && <span className="error">{errors.id}</span>}
      </div>

      <div>
        <label htmlFor="name">Name *:</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>

      <div>
        <label htmlFor="path">Path (LTREE) *:</label>
        <input
          id="path"
          type="text"
          value={formData.path}
          onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          onBlur={handlePathBlur}
          placeholder="root.companies.acme"
          required
        />
        {errors.path && <span className="error">{errors.path}</span>}
        <small>Use dots to separate levels: root.child.grandchild</small>
      </div>

      <div>
        <label htmlFor="parentId">Parent ID (optional):</label>
        <input
          id="parentId"
          type="text"
          value={formData.parentId}
          onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
          placeholder="Parent entity UUID"
        />
        {errors.parentId && <span className="error">{errors.parentId}</span>}
      </div>

      <button type="submit">Submit</button>
    </form>
  );
};
```

## Pattern: Real-Time Validation

```typescript
// Validate on blur for better UX
const handleFieldBlur = (field: string, validator: (v: string) => boolean, errorMsg: string) => {
  if (formData[field] && !validator(formData[field])) {
    setErrors(prev => ({ ...prev, [field]: errorMsg }));
  } else {
    setErrors(prev => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }
};

// Usage:
<input
  onBlur={() => handleFieldBlur(
    'path',
    isValidLTreePath,
    'Invalid LTREE path format'
  )}
/>
```

## Pattern: Custom Hooks for Validation

```typescript
// useEntityFormValidation.ts
import { useState } from 'react';
import { isValidLTreePath, isValidUUID } from '../types/contracts.generated';

export function useEntityFormValidation() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePath = (path: string): boolean => {
    if (!isValidLTreePath(path)) {
      setErrors(prev => ({ ...prev, path: 'Invalid LTREE path' }));
      return false;
    }
    clearError('path');
    return true;
  };

  const validateUUID = (field: string, uuid: string): boolean => {
    if (uuid && !isValidUUID(uuid)) {
      setErrors(prev => ({ ...prev, [field]: 'Invalid UUID' }));
      return false;
    }
    clearError(field);
    return true;
  };

  const clearError = (field: string) => {
    setErrors(prev => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  };

  const clearAllErrors = () => setErrors({});

  return {
    errors,
    validatePath,
    validateUUID,
    clearError,
    clearAllErrors,
  };
}

// Usage:
const { errors, validatePath, validateUUID } = useEntityFormValidation();
```

## Pattern: Schema Validation with Zod (Optional)

For more complex forms, consider using zod schemas:

```typescript
import { z } from 'zod';

const EntitySchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  path: z.string().regex(
    /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/,
    'Invalid LTREE path format'
  ),
  parentId: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

type EntityFormData = z.infer<typeof EntitySchema>;

// In component:
const handleSubmit = (data: any) => {
  const result = EntitySchema.safeParse(data);

  if (!result.success) {
    // Show validation errors
    const formattedErrors = result.error.format();
    setErrors(formattedErrors);
    return;
  }

  // Data is valid, submit
  onSubmit(result.data);
};
```

## How to Apply

1. **Identify forms that create/edit entities**:
```bash
cd frontend/src

# Find form components
find . -name "*Form*.tsx" -o -name "*form*.tsx"

# Find entity input fields
grep -r "path.*input\|parentId.*input" --include="*.tsx"
```

2. **Import validators**:
```typescript
import {
  isValidLTreePath,
  isValidUUID,
  isValidISODateTime
} from '../types/contracts.generated';
```

3. **Add validation logic**:
- On blur (real-time feedback)
- On submit (final check)
- Clear errors when field becomes valid

## Expected Impact

**Before**:
```typescript
// ❌ Invalid data reaches backend
const entity = {
  path: '.root..child.',  // Invalid LTREE
  parentId: 'not-a-uuid',  // Invalid UUID
};
submitEntity(entity);  // Server error 400
```

**After**:
```typescript
// ✅ Client-side validation prevents submission
if (!isValidLTreePath(path)) {
  showError('Invalid path format');
  return;  // Don't submit
}
if (parentId && !isValidUUID(parentId)) {
  showError('Invalid parent ID');
  return;
}
submitEntity(entity);  // ✅ Valid data only
```

**Benefits**:
- Better UX: Immediate feedback
- Reduces server errors
- Cleaner error logs
- Consistent validation rules

## Verification (Code-Only)

```typescript
// Test validators
import { isValidLTreePath, isValidUUID } from './types/contracts.generated';

// Valid LTREE paths
console.assert(isValidLTreePath('root'));
console.assert(isValidLTreePath('root.child'));
console.assert(isValidLTreePath('root.child.grandchild'));
console.assert(isValidLTreePath('root_123.child_456'));

// Invalid LTREE paths
console.assert(!isValidLTreePath('.root'));
console.assert(!isValidLTreePath('root.'));
console.assert(!isValidLTreePath('root..child'));
console.assert(!isValidLTreePath('root child'));
console.assert(!isValidLTreePath(''));

// Valid UUIDs
console.assert(isValidUUID('550e8400-e29b-41d4-a716-446655440000'));

// Invalid UUIDs
console.assert(!isValidUUID('not-a-uuid'));
console.assert(!isValidUUID(''));

// ✅ All assertions pass
```

## Notes

- **No breaking changes**: Forms continue to work, just with validation
- **Progressive enhancement**: Add validation where most needed first
- **Consistent with backend**: Uses same regex patterns
- **Better UX**: Immediate feedback prevents frustration
