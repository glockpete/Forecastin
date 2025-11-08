# Feature Flag Migration - Quick Start Guide

**⏱️ Total Time:** 30-45 minutes | **⬇️ Downtime:** ~5 minutes

---

## Prerequisites Check

```bash
# 1. Test database connection
psql -h localhost -U postgres -d forecastin -c "SELECT COUNT(*) FROM feature_flags;"

# 2. Verify migration files exist
ls -lh scripts/migrate_feature_flags.sh migrations/001_standardize_feature_flag_names.sql

# 3. Navigate to project
cd /home/user/Forecastin
```

✅ All commands should succeed before proceeding.

---

## Execution Steps

### Step 1: Test (Dry Run)
```bash
./scripts/migrate_feature_flags.sh test
```
**Expected:** `TEST MODE COMPLETE - Ready for actual migration`

---

### Step 2: Backup
```bash
mkdir -p backups
pg_dump -h localhost -U postgres -d forecastin \
  --table=feature_flags --data-only --column-inserts \
  > backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql
```
**Expected:** Backup file created in `backups/` directory

---

### Step 3: Execute Migration
```bash
./scripts/migrate_feature_flags.sh migrate
```
**Expected:** `Migration completed successfully!`

---

### Step 4: Verify
```bash
./scripts/migrate_feature_flags.sh verify
```
**Expected:** `Migration has been applied` + `0 old-style flags found`

---

### Step 5: Restart Services

**Docker:**
```bash
docker-compose restart
docker-compose ps  # Verify all services are "Up"
```

**PM2:**
```bash
pm2 restart all
pm2 status  # Verify all services are "online"
```

**Systemd:**
```bash
sudo systemctl restart forecastin-api forecastin-frontend
sudo systemctl status forecastin-api forecastin-frontend
```

---

### Step 6: Verify Application

```bash
# Test API health
curl http://localhost:8000/health

# Check new flag names
curl http://localhost:8000/api/v1/feature-flags | jq 'keys'
```

**Expected:** JSON with dot-notation flag names (`ff.geo.*`, `ff.ml.*`, etc.)

---

## Success Checklist

- [ ] Test command completed successfully
- [ ] Backup file created (check `backups/` directory)
- [ ] Migration reported success
- [ ] Verify command shows 0 old flags, 17+ new flags
- [ ] Services restarted successfully
- [ ] API returns new flag names
- [ ] No errors in application logs

---

## If Something Goes Wrong

### Rollback
```bash
./scripts/migrate_feature_flags.sh rollback
```

### Manual Rollback
```bash
# Find your backup
ls -lh backups/

# Restore
psql -h localhost -U postgres -d forecastin < backups/feature_flags_backup_[timestamp].sql

# Restart services
docker-compose restart  # or: pm2 restart all
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Permission denied | `chmod +x scripts/migrate_feature_flags.sh` |
| Connection refused | Check PostgreSQL is running: `docker-compose ps postgres` |
| Old flags still showing | Restart services + clear browser cache (Ctrl+Shift+R) |
| Already applied error | Run `./scripts/migrate_feature_flags.sh verify` to check status |

---

## Environment Variables (if needed)

```bash
export DB_HOST="localhost"      # Change if remote
export DB_PORT="5432"           # Default PostgreSQL port
export DB_NAME="forecastin"     # Your database name
export DB_USER="postgres"       # Your database user
```

---

## Complete Guide

For detailed instructions, troubleshooting, and explanations:
📖 **See:** `/home/user/Forecastin/docs/FEATURE_FLAG_MIGRATION_EXECUTION_GUIDE.md`

---

## Flag Name Changes

| Old Name | New Name |
|----------|----------|
| `ff_geospatial_layers` | `ff.geo.layers_enabled` |
| `ff_point_layer` | `ff.geo.point_layer_active` |
| `ff_polygon_layer` | `ff.geo.polygon_layer_active` |
| `ff_heatmap_layer` | `ff.geo.heatmap_layer_active` |
| `ff_clustering_enabled` | `ff.geo.clustering_enabled` |
| `ff_websocket_layers` | `ff.geo.websocket_layers_enabled` |
| `ff_gpu_filtering` | `ff.geo.gpu_rendering_enabled` |
| `ff.map_v1` | `ff.geo.map` |
| `ff.hierarchy_optimized` | `ff.hierarchy.optimized` |
| `ff.ws_v1` | `ff.ws.realtime` |
| `ff.prophet_forecasting` | `ff.ml.prophet_forecasting` |
| `ff.ab_routing` | `ff.ml.ab_routing` |

---

**Ready to start?** Run Step 1 (test) to verify your environment.
