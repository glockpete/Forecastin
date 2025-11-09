# 06 Database Migrations Strategy

**Repository:** Forecastin
**Date:** 2025-11-09 05:21 UTC
**Purpose:** Database migration strategy for rebuild
**Evidence:** F-0015 (no migration framework)

---

## Current State

**Migration Files:** 6 SQL files in `/migrations/`
**Issue:** No migration framework - unclear execution order and state
**Evidence:** F-0015, PATH: `/home/user/Forecastin/migrations/`

**Current Files:**
```
001_initial_schema.sql
001_standardize_feature_flag_names.sql
001_standardize_feature_flag_names_ROLLBACK.sql
002_ml_ab_testing_framework.sql
004_automated_materialized_view_refresh.sql
004_rss_entity_extraction_schema.sql
```

**Problems:**
1. Multiple files with same prefix (001, 004)
2. No tracking of which migrations applied
3. Manual execution error-prone
4. Rollback migrations in separate files
5. No migration framework (Alembic/Flyway)

---

## Target State: Alembic Migration Framework

**Recommendation:** Adopt Alembic for Python-based migration management

**Benefits:**
- Tracks applied migrations in `alembic_version` table
- Sequential execution enforced
- Up/down migrations in single file
- Auto-generation from SQLAlchemy models
- CI/CD integration

**Installation:**
```bash
pip install alembic
alembic init migrations
```

---

## Migration Strategy

### Phase 1: Baseline Current Schema

**Task:** Create initial Alembic migration from current state

```bash
# Generate initial migration
alembic revision --autogenerate -m "baseline_current_schema"

# Review generated migration
# Edit to match current production schema exactly

# Mark as applied (don't run)
alembic stamp head
```

**Exit Criteria:** Alembic knows current production state

---

### Phase 2: Convert Existing Migrations

For each existing migration file, create corresponding Alembic migration:

```python
# migrations/versions/001_initial_schema.py
"""Initial schema with LTREE and PostGIS

Revision ID: 001
Revises: None
Create Date: 2023-Q2
"""

def upgrade():
    # Enable extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS ltree')
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')

    # Create entities table
    op.create_table(
        'entities',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v4()'), primary_key=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('entity_type', sa.Text(), nullable=False),
        sa.Column('path', postgresql.LTREE(), nullable=False),
        sa.Column('path_depth', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('location', Geometry('POINT', 4326), nullable=True),
        # ... more columns
    )

    # Create indexes
    op.create_index('entities_path_gist_idx', 'entities', ['path'], postgresql_using='gist')
    op.create_index('entities_location_gist_idx', 'entities', ['location'], postgresql_using='gist')

def downgrade():
    op.drop_table('entities')
    op.execute('DROP EXTENSION IF EXISTS ltree CASCADE')
    op.execute('DROP EXTENSION IF EXISTS postgis CASCADE')
```

---

### Phase 3: New Migrations

All new migrations use Alembic:

```bash
# Create new migration
alembic revision --autogenerate -m "add_user_preferences_table"

# Review generated migration
vim migrations/versions/xxx_add_user_preferences_table.py

# Apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

---

## Materialized View Strategy

**Current:** Materialized views for LTREE hierarchy optimization
**File:** `004_automated_materialized_view_refresh.sql`

**Strategy:**

### 1. Create Materialized View

```sql
-- In Alembic migration
CREATE MATERIALIZED VIEW hierarchy_mv AS
SELECT
    e.id,
    e.name,
    e.path,
    e.path_depth,
    nlevel(e.path) as computed_depth,
    (SELECT COUNT(*) FROM entities WHERE path <@ e.path) as descendant_count
FROM entities e
WHERE e.is_active = true;

-- Create indexes on materialized view
CREATE INDEX hierarchy_mv_path_gist_idx ON hierarchy_mv USING GIST (path);
CREATE INDEX hierarchy_mv_depth_idx ON hierarchy_mv (path_depth);
```

### 2. Refresh Strategy

**Trigger-based (Recommended):**
```sql
-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_hierarchy_mv()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hierarchy_mv;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on entity changes
CREATE TRIGGER entity_hierarchy_refresh
AFTER INSERT OR UPDATE OR DELETE ON entities
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_hierarchy_mv();
```

**Scheduled (Alternative):**
```python
# In automated_refresh_service.py
async def scheduled_refresh():
    await db.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY hierarchy_mv")
    logger.info("Materialized view refreshed")
```

### 3. Concurrency

Use `CONCURRENTLY` to allow reads during refresh:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY hierarchy_mv;
```

**Requirements:**
- Materialized view must have unique index
- Slightly slower but non-blocking

---

## Data Migration Scripts

For complex data transformations:

```python
# migrations/data/backfill_confidence_scores.py
"""
Backfill confidence scores for entities missing them.
Idempotent - safe to run multiple times.
"""

async def backfill_confidence_scores(conn):
    # Get entities without confidence scores
    entities = await conn.fetch("""
        SELECT id FROM entities
        WHERE confidence_score IS NULL OR confidence_score = 0
    """)

    logger.info(f"Backfilling {len(entities)} entities")

    for entity in entities:
        # Calculate confidence score
        score = calculate_confidence(entity)

        # Update (idempotent)
        await conn.execute("""
            UPDATE entities
            SET confidence_score = $1
            WHERE id = $2
        """, score, entity['id'])

    logger.info("Backfill complete")

if __name__ == "__main__":
    asyncio.run(backfill_confidence_scores(get_connection()))
```

---

## Testing Migrations

### Unit Tests

```python
# tests/migrations/test_migrations.py
def test_migration_001_creates_entities_table():
    """Test that migration 001 creates entities table."""
    # Apply migration
    alembic.upgrade('+1')

    # Verify table exists
    result = db.execute("SELECT to_regclass('public.entities')")
    assert result is not None

    # Verify columns
    columns = db.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'entities'
    """)
    assert 'path' in [col['column_name'] for col in columns]
    assert 'path_depth' in [col['column_name'] for col in columns]

    # Rollback
    alembic.downgrade('-1')
```

### Integration Tests

```python
def test_full_migration_cycle():
    """Test complete migration from scratch to current."""
    # Start with empty database
    alembic.downgrade('base')

    # Apply all migrations
    alembic.upgrade('head')

    # Verify final state
    tables = get_all_tables()
    assert 'entities' in tables
    assert 'feature_flags' in tables
    assert 'hierarchy_mv' in tables (materialized view)
```

---

## Rollback Procedures

### Automated Rollback

```bash
# Rollback last migration
alembic downgrade -1

# Rollback to specific version
alembic downgrade abc123

# Rollback all
alembic downgrade base
```

### Manual Rollback

If automated rollback fails:

```sql
-- 1. Check current version
SELECT * FROM alembic_version;

-- 2. Manually undo changes
DROP TABLE IF EXISTS new_table;
-- ... undo other changes

-- 3. Update alembic_version
UPDATE alembic_version SET version_num = 'previous_version';
```

---

## CI/CD Integration

### Pre-deployment Check

```yaml
# .github/workflows/migration-check.yml
- name: Check Migrations
  run: |
    # Verify all migrations can be applied to fresh database
    docker run -d --name postgres-test postgres:13
    alembic upgrade head

    # Verify rollback works
    alembic downgrade base

    docker stop postgres-test
```

### Deployment

```yaml
# Deploy with migrations
- name: Run Migrations
  run: |
    alembic upgrade head

- name: Verify Migration
  run: |
    python scripts/verify_schema.py
```

---

## Appendix: Migration File Template

```python
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision}
Create Date: ${create_date}
"""

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade():
    ${upgrades if upgrades else "pass"}


def downgrade():
    ${downgrades if downgrades else "pass"}
```

---

**Migration Strategy Complete**
**Addresses F-0015: No migration framework**
**Alembic provides tracking, rollback, CI/CD integration**
