# Feature Flag Migration Execution Guide

**Migration:** Standardize Feature Flag Naming (P1 - High Priority)
**Target Date:** TBD
**Estimated Time:** 30-45 minutes (including verification)
**Downtime Required:** ~5 minutes (service restart only)
**Risk Level:** Low (fully reversible with rollback script)

---

## Overview

This migration renames feature flags in the PostgreSQL database from the old naming pattern to the standardized dot-notation pattern.

**Example Changes:**
- `ff_geospatial_layers` → `ff.geo.layers_enabled`
- `ff_point_layer` → `ff.geo.point_layer_active`
- `ff_clustering_enabled` → `ff.geo.clustering_enabled`

**Why This Is Needed:**
- Code has already been updated to use new names (commit `7f06740`)
- Database still has old names
- This creates a mismatch that needs to be resolved

---

## Prerequisites Checklist

Before starting, verify you have:

### Access Requirements
- [ ] SSH/terminal access to the server running PostgreSQL
- [ ] Database credentials (username/password for PostgreSQL)
- [ ] Sudo/admin access to restart services
- [ ] Write permissions to `/home/user/Forecastin/backups/` directory

### Software Requirements
- [ ] PostgreSQL client (`psql`) installed
- [ ] Git repository at `/home/user/Forecastin` is up to date
- [ ] Latest code pulled (commit `7f06740` or later)

### Environment Requirements
- [ ] PostgreSQL database is running
- [ ] Database name: `forecastin` (or note your database name)
- [ ] Services (API/Frontend) are currently running normally

### Test Connection
```bash
# Test database connectivity
psql -h localhost -U postgres -d forecastin -c "SELECT COUNT(*) FROM feature_flags;"

# Expected output: A number (like 10-20 flags)
# If this fails, resolve connection issues before proceeding
```

---

## Step 1: Pre-Migration Preparation (5 minutes)

### 1.1 Navigate to Project Directory
```bash
cd /home/user/Forecastin
```

### 1.2 Verify Migration Files Exist
```bash
# Check migration script
ls -lh scripts/migrate_feature_flags.sh
# Expected: -rwxr-xr-x ... 6387 ... migrate_feature_flags.sh

# Check SQL migration
ls -lh migrations/001_standardize_feature_flag_names.sql
# Expected: -rw-r--r-- ... 4814 ... 001_standardize_feature_flag_names.sql

# Check rollback script
ls -lh migrations/001_standardize_feature_flag_names_ROLLBACK.sql
# Expected: -rw-r--r-- ... 1745 ... 001_standardize_feature_flag_names_ROLLBACK.sql
```

### 1.3 Review Current Database State
```bash
# Show current feature flags
psql -h localhost -U postgres -d forecastin -c "
SELECT flag_name, is_enabled
FROM feature_flags
ORDER BY flag_name;
"
```

**Save this output** - you'll compare it after migration.

### 1.4 Set Environment Variables (if needed)
```bash
# Only if your database is NOT using default settings
export DB_HOST="localhost"      # Change if remote
export DB_PORT="5432"           # Change if non-standard
export DB_NAME="forecastin"     # Change if different
export DB_USER="postgres"       # Change if different

# You may be prompted for password during execution
```

---

## Step 2: Run Pre-Migration Test (5 minutes)

This verifies the migration **without making changes**.

```bash
# Dry-run mode - checks everything but doesn't modify database
./scripts/migrate_feature_flags.sh test
```

**Expected Output:**
```
[INFO] Running in TEST MODE - no changes will be made
[INFO] Checking prerequisites...
[SUCCESS] psql command found
[SUCCESS] Migration SQL files found
[SUCCESS] Database connection successful
[INFO] Current feature flags count: 15
[INFO] Would migrate 12 flags from old to new naming
[INFO] TEST MODE COMPLETE - Ready for actual migration
```

**If you see errors:**
- ❌ `psql: command not found` → Install PostgreSQL client
- ❌ `connection refused` → Check database is running
- ❌ `authentication failed` → Check database credentials
- ❌ `Permission denied` → Check file permissions

**Do not proceed until test passes successfully.**

---

## Step 3: Create Manual Backup (5 minutes)

**IMPORTANT:** Always create a backup before migrations.

```bash
# Create backup directory
mkdir -p /home/user/Forecastin/backups

# Manual backup of feature_flags table
pg_dump -h localhost -U postgres -d forecastin \
  --table=feature_flags \
  --data-only \
  --column-inserts \
  > /home/user/Forecastin/backups/feature_flags_manual_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup was created
ls -lh /home/user/Forecastin/backups/
```

**Expected:** You should see a `.sql` file with today's date, size > 0 bytes.

---

## Step 4: Execute Migration (10-15 minutes)

### 4.1 Run Migration Script
```bash
# Execute the migration
./scripts/migrate_feature_flags.sh migrate
```

### 4.2 Monitor Output

**You should see:**
```
[INFO] Starting Feature Flag Migration
[INFO] Checking prerequisites...
[SUCCESS] All prerequisites met
[INFO] Creating database backup...
[SUCCESS] Backup created: backups/feature_flags_backup_20251108_143022.sql
[INFO] Executing migration SQL...
BEGIN
UPDATE feature_flags (12 rows)
UPDATE feature_flags (8 rows)
...
COMMIT
[SUCCESS] Migration SQL executed successfully
[INFO] Verifying migration...
[SUCCESS] Found 17 new-style flags (ff.geo.*, ff.ml.*, etc.)
[SUCCESS] Found 0 old-style flags remaining
[SUCCESS] Migration completed successfully!
```

**Next Steps Output:**
```
[INFO] Next steps:
1. Restart API service
2. Restart Frontend service
3. Clear browser caches
4. Verify feature flags in application
```

### 4.3 Handle Errors

**If migration fails:**

The script is wrapped in a database transaction, so **failed migrations automatically roll back**.

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `duplicate key value` | Migration already run | Run verify command to check state |
| `column "flag_name" does not exist` | Wrong database/table | Check DB_NAME environment variable |
| `permission denied` | Insufficient privileges | Use database admin user |
| `deadlock detected` | Concurrent database access | Retry after stopping services |

**If migration fails, the database is unchanged** - you can fix the issue and retry.

---

## Step 5: Verify Migration Success (5 minutes)

### 5.1 Run Verification Command
```bash
# Verify migration status
./scripts/migrate_feature_flags.sh verify
```

**Expected Output:**
```
[INFO] Verifying feature flag migration status...
[SUCCESS] Migration has been applied
[INFO] New-style flags found: 17
[INFO] Old-style flags found: 0
[INFO] Flag names:
  - ff.geo.layers_enabled
  - ff.geo.point_layer_active
  - ff.geo.clustering_enabled
  - ff.geo.websocket_layers_enabled
  - ff.ml.prophet_forecasting
  - ff.ml.ab_routing
  ...
[SUCCESS] Migration verification complete
```

### 5.2 Check Database Directly
```bash
# Show all feature flags with new names
psql -h localhost -U postgres -d forecastin -c "
SELECT flag_name, is_enabled, updated_at
FROM feature_flags
WHERE flag_name LIKE 'ff.%'
ORDER BY flag_name;
"
```

**Verify:**
- All flags start with `ff.` (not `ff_`)
- Flag count matches pre-migration count
- `is_enabled` states are preserved
- `updated_at` timestamps are recent (just updated)

### 5.3 Check Backup Table Was Created
```bash
# Verify backup table exists
psql -h localhost -U postgres -d forecastin -c "
SELECT COUNT(*) FROM feature_flags_backup_20251107;
"
```

**Expected:** Count matches your original feature flags count.

---

## Step 6: Restart Services (5-10 minutes)

Services need to be restarted to pick up the new flag names.

### Option A: Docker Deployment

```bash
# Navigate to project root
cd /home/user/Forecastin

# Restart all services
docker-compose restart

# Or restart individual services
docker-compose restart api
docker-compose restart frontend

# Verify services are running
docker-compose ps
```

**Expected:** All services should show status `Up`.

### Option B: PM2 Deployment

```bash
# Restart API service
pm2 restart forecastin-api

# Restart Frontend service
pm2 restart forecastin-frontend

# Check status
pm2 status
```

**Expected:** All services should show status `online`.

### Option C: Systemd Services

```bash
# Restart API
sudo systemctl restart forecastin-api

# Restart Frontend
sudo systemctl restart forecastin-frontend

# Check status
sudo systemctl status forecastin-api
sudo systemctl status forecastin-frontend
```

**Expected:** Both services should show `active (running)`.

---

## Step 7: Post-Migration Verification (5 minutes)

### 7.1 Check API Health
```bash
# Test API is responding
curl http://localhost:8000/health

# Expected: {"status": "ok", ...}
```

### 7.2 Check Feature Flags Endpoint
```bash
# Fetch feature flags from API
curl http://localhost:8000/api/v1/feature-flags

# Expected: JSON response with new flag names like:
# {
#   "ff.geo.layers_enabled": false,
#   "ff.geo.point_layer_active": false,
#   ...
# }
```

**Verify:**
- All flag names use dot notation (`ff.geo.*`, `ff.ml.*`, etc.)
- No underscore-based names (`ff_*`)
- Values match database state

### 7.3 Check Frontend
```bash
# Check frontend is serving
curl http://localhost:3000

# Expected: HTML response with React app
```

### 7.4 Browser Testing

1. **Open application in browser** (use incognito/private mode to avoid cache)
2. **Open browser DevTools** (F12) → Network tab
3. **Reload page** and check:
   - API request to `/api/v1/feature-flags` succeeds
   - Response contains new flag names
   - No console errors about missing flags

### 7.5 Check Logs for Errors

```bash
# Check API logs
docker-compose logs api --tail=100
# or: pm2 logs forecastin-api --lines 100
# or: sudo journalctl -u forecastin-api -n 100

# Look for errors related to feature flags
# Expected: No errors about "flag not found" or "unknown flag"
```

---

## Step 8: Clear Caches (5 minutes)

### 8.1 Clear Application Caches

```bash
# If using Redis for caching
redis-cli FLUSHDB

# If using application-level caching, restart cache service
docker-compose restart redis  # or your cache service
```

### 8.2 Clear Browser Caches

**For end users:**
- Send notification to clear browser cache
- Or perform hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

**For testing:**
- Use incognito/private browsing mode
- Or manually clear cache in browser settings

---

## Step 9: Update Documentation (5 minutes)

### 9.1 Mark Migration as Complete

```bash
# Edit your migration tracking document
nano /home/user/Forecastin/docs/MIGRATION_STATUS.md
```

Add entry:
```markdown
## Feature Flag Name Standardization

- **Date Executed:** [Today's date]
- **Executed By:** [Your name]
- **Migration File:** 001_standardize_feature_flag_names.sql
- **Status:** ✅ COMPLETED
- **Flags Migrated:** 17
- **Backup Location:** /home/user/Forecastin/backups/feature_flags_backup_[timestamp].sql
- **Rollback Available:** Yes
- **Issues Encountered:** None / [List any issues]
```

### 9.2 Notify Team

Send notification to team:
```
Subject: Feature Flag Migration Completed

The feature flag naming standardization migration has been completed successfully.

Changes:
- 17 feature flags renamed from ff_* to ff.geo.* pattern
- All services restarted
- Verification passed

Action Required:
- Clear browser cache (hard refresh: Ctrl+Shift+R)
- Report any issues with feature flag functionality

Rollback available if needed.
```

---

## Rollback Procedure (If Needed)

**If you need to undo the migration:**

### Automatic Rollback (Recommended)

```bash
# Run rollback script
./scripts/migrate_feature_flags.sh rollback

# Follow prompts to select backup file
# Script will restore old flag names
```

### Manual Rollback

```bash
# List available backups
ls -lh /home/user/Forecastin/backups/

# Restore from backup
psql -h localhost -U postgres -d forecastin < /home/user/Forecastin/backups/feature_flags_backup_[timestamp].sql

# Or use the rollback SQL
psql -h localhost -U postgres -d forecastin < /home/user/Forecastin/migrations/001_standardize_feature_flag_names_ROLLBACK.sql

# Restart services
docker-compose restart  # or pm2 restart all
```

**After rollback:**
1. Verify old flag names are restored
2. Restart services
3. Investigate why rollback was needed
4. Fix issues before re-attempting migration

---

## Troubleshooting Guide

### Issue: "Migration script not executable"

**Error:**
```
bash: ./scripts/migrate_feature_flags.sh: Permission denied
```

**Solution:**
```bash
chmod +x scripts/migrate_feature_flags.sh
```

---

### Issue: "Database connection refused"

**Error:**
```
psql: could not connect to server: Connection refused
```

**Solutions:**
1. Check PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   # or: sudo systemctl status postgresql
   ```

2. Verify connection parameters:
   ```bash
   echo $DB_HOST $DB_PORT $DB_NAME $DB_USER
   ```

3. Test connection manually:
   ```bash
   psql -h localhost -U postgres -d forecastin -c "SELECT 1"
   ```

---

### Issue: "Old flag names still appearing in API"

**Possible Causes:**
1. Services not restarted → Restart services
2. Code not updated → Pull latest code (commit `7f06740`)
3. Browser cache → Clear browser cache
4. Application cache → Clear Redis/cache service

**Verify:**
```bash
# Check database has new names
psql -h localhost -U postgres -d forecastin -c "SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff_%';"
# Should return 0 rows

# Check API is using new names
curl http://localhost:8000/api/v1/feature-flags | jq 'keys'
# Should show dot-notation names
```

---

### Issue: "Migration already applied" error

**Error:**
```
ERROR: duplicate key value violates unique constraint
```

**This means migration already ran successfully.**

**Verify:**
```bash
./scripts/migrate_feature_flags.sh verify
```

If verification shows migration is complete, no further action needed.

---

### Issue: "Frontend requests fail with 404 for feature flags"

**Cause:** Frontend code cache or bundling issue

**Solution:**
```bash
# Rebuild frontend
cd /home/user/Forecastin/frontend
npm run build

# Restart frontend service
docker-compose restart frontend
# or: pm2 restart forecastin-frontend

# Clear browser cache completely
```

---

## Success Criteria

✅ Migration is successful when:

- [ ] `./scripts/migrate_feature_flags.sh verify` reports "Migration has been applied"
- [ ] Database query shows 0 old-style flags (`ff_*`)
- [ ] Database query shows 17+ new-style flags (`ff.*`)
- [ ] API endpoint `/api/v1/feature-flags` returns dot-notation names
- [ ] Frontend loads without errors in browser console
- [ ] No "flag not found" errors in API logs
- [ ] Services are running normally
- [ ] Backup files exist in `/home/user/Forecastin/backups/`

---

## Timeline Summary

| Step | Duration | Can Run in Parallel |
|------|----------|-------------------|
| 1. Pre-migration prep | 5 min | - |
| 2. Test migration | 5 min | - |
| 3. Create backup | 5 min | - |
| 4. Execute migration | 10-15 min | - |
| 5. Verify migration | 5 min | - |
| 6. Restart services | 5-10 min | - |
| 7. Post-migration verification | 5 min | - |
| 8. Clear caches | 5 min | ✅ Can do while services restart |
| 9. Update documentation | 5 min | ✅ Can do anytime after |
| **Total** | **30-45 min** | |

**Actual Downtime:** ~5 minutes (only during service restart in Step 6)

---

## Quick Reference Commands

```bash
# 1. Navigate to project
cd /home/user/Forecastin

# 2. Test migration (dry run)
./scripts/migrate_feature_flags.sh test

# 3. Create manual backup
mkdir -p backups
pg_dump -h localhost -U postgres -d forecastin --table=feature_flags --data-only --column-inserts > backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Run migration
./scripts/migrate_feature_flags.sh migrate

# 5. Verify
./scripts/migrate_feature_flags.sh verify

# 6. Restart services (Docker)
docker-compose restart

# 7. Check API
curl http://localhost:8000/api/v1/feature-flags

# 8. Rollback (if needed)
./scripts/migrate_feature_flags.sh rollback
```

---

## Support & Questions

**Migration Script Location:** `/home/user/Forecastin/scripts/migrate_feature_flags.sh`

**Documentation:**
- Migration Guide: `/home/user/Forecastin/docs/MIGRATION_GUIDE_FF_NAMES.md`
- Execution Details: `/home/user/Forecastin/docs/WHERE_TO_EXECUTE_MIGRATION.md`
- Naming Standard: `/home/user/Forecastin/docs/FEATURE_FLAG_NAMING_STANDARD.md`

**Git Commits:**
- Code update: `7f06740` (Nov 8, 2025)
- Migration script: `7f06740`

**Before starting, ensure:**
- You have read this entire guide
- You have tested database connectivity
- You have backup capabilities
- You have scheduled a maintenance window (5-10 min downtime)

---

**Good luck with the migration! 🚀**
