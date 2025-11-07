# Feature Flag Name Standardization - Quick Start

## TL;DR - What You Need to Know

**Problem**: Frontend requests feature flags with names that don't exist in the database, causing silent failures.

**Solution**: Standardize all flag names to `ff.geo.*` pattern per documentation.

**Time**: 5 minutes

**Risk**: LOW (fully reversible with tested rollback)

---

## Quick Start Guide

### For Production Deployment

```bash
# 1. Run automated migration
./scripts/migrate_feature_flags.sh migrate

# 2. Restart services
docker-compose restart api frontend

# 3. Verify everything works
./scripts/migrate_feature_flags.sh verify
```

Done! ✅

---

### For Local Development

```bash
# 1. Pull latest code
git pull origin claude/codebase-audit-and-fixes-011CUtPZZvGBYFe9mD7ehTT4

# 2. Run migration on local database
./scripts/migrate_feature_flags.sh migrate

# 3. Restart your local services
# (docker-compose, pm2, or however you run locally)

# 4. Clear browser cache
# Chrome: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
```

---

## What Changed?

### Before Migration

```javascript
// Frontend requests this:
useFeatureFlag('ff.geospatial_layers')

// Database has this:
ff_geospatial_layers  ❌ NAME MISMATCH
```

**Result**: Feature appears disabled even when enabled. Silent failure.

### After Migration

```javascript
// Frontend requests this:
useFeatureFlag('ff.geo.layers_enabled')

// Database has this:
ff.geo.layers_enabled  ✅ MATCH
```

**Result**: Feature flags work as documented.

---

## Complete Flag Name Mapping

| Old Name | New Name |
|----------|----------|
| `ff_geospatial_layers` | `ff.geo.layers_enabled` |
| `ff_gpu_filtering` | `ff.geo.gpu_rendering_enabled` |
| `ff_point_layer` | `ff.geo.point_layer_active` |
| `ff_polygon_layer` | `ff.geo.polygon_layer_active` |
| `ff_heatmap_layer` | `ff.geo.heatmap_layer_active` |
| `ff_clustering_enabled` | `ff.geo.clustering_enabled` |
| `ff_websocket_layers` | `ff.geo.websocket_layers_enabled` |
| `ff_realtime_updates` | `ff.geo.realtime_updates_enabled` |

---

## If Something Goes Wrong

### Emergency Rollback (< 2 minutes)

```bash
# Rollback database AND code
./scripts/migrate_feature_flags.sh rollback

# Restart services
docker-compose restart api frontend
```

### Get Help

1. Check logs: `docker-compose logs -f api`
2. Check Slack: #engineering
3. Check runbook: `docs/MIGRATION_GUIDE_FF_NAMES.md`

---

## Testing Before Migration (Recommended)

```bash
# Run dry-run test
./scripts/migrate_feature_flags.sh test

# Expected output: "Migration test passed (changes rolled back)"
```

---

## Detailed Documentation

- **Full Migration Guide**: [`docs/MIGRATION_GUIDE_FF_NAMES.md`](./MIGRATION_GUIDE_FF_NAMES.md)
- **SQL Migration**: [`migrations/001_standardize_feature_flag_names.sql`](../migrations/001_standardize_feature_flag_names.sql)
- **Rollback SQL**: [`migrations/001_standardize_feature_flag_names_ROLLBACK.sql`](../migrations/001_standardize_feature_flag_names_ROLLBACK.sql)
- **Migration Script**: [`scripts/migrate_feature_flags.sh`](../scripts/migrate_feature_flags.sh)

---

## FAQ

**Q: Will this break my local environment?**
A: No. Just pull latest code and run the migration on your local database.

**Q: Do I need to update my feature flag checks in code?**
A: No. The migration updates all code references automatically.

**Q: What if I have uncommitted changes?**
A: Commit or stash them first. The migration updates several files.

**Q: Can I run this on staging first?**
A: Yes! Highly recommended. Run the test command first: `./scripts/migrate_feature_flags.sh test`

---

**Created**: 2025-11-07
**Status**: Ready for deployment
**Approved by**: [Pending]
