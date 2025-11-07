# 🚀 EXECUTE MIGRATION - Your Specific Setup

## Your Database Configuration (from docker-compose.yml)

```yaml
Database: forecastin
User: forecastin
Password: forecastin_password
Container: forecastin_postgres
Port: 5432
```

---

## ⚡ Quick Start (Copy-Paste These Commands)

### Option 1: Using the Automated Script (Recommended)

```bash
# Navigate to project root
cd /home/user/Forecastin

# Make script executable (if not already)
chmod +x scripts/migrate_feature_flags.sh

# Set your database credentials
export DB_HOST=postgres
export DB_PORT=5432
export DB_NAME=forecastin
export DB_USER=forecastin
export PGPASSWORD=forecastin_password

# Test migration first (safe - no changes)
./scripts/migrate_feature_flags.sh test

# If test passes, run the migration
./scripts/migrate_feature_flags.sh migrate

# Verify success
./scripts/migrate_feature_flags.sh verify
```

---

### Option 2: Using Docker Exec (Easiest if Docker Running)

```bash
# 1. Navigate to project
cd /home/user/Forecastin

# 2. Start database if not running
docker-compose up -d postgres

# 3. Run migration using Docker
docker-compose exec postgres psql -U forecastin -d forecastin -f /docker-entrypoint-initdb.d/001_standardize_feature_flag_names.sql

# 4. Verify migration
docker-compose exec postgres psql -U forecastin -d forecastin -c "SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff.geo%';"

# Expected output: 11 rows with ff.geo.* pattern

# 5. Restart services
docker-compose restart api frontend
```

---

### Option 3: Manual SQL Execution (Most Control)

```bash
# 1. Navigate to project
cd /home/user/Forecastin

# 2. Connect to database
docker-compose exec -it postgres psql -U forecastin -d forecastin

# 3. In psql prompt, run:
\i /docker-entrypoint-initdb.d/001_standardize_feature_flag_names.sql

# 4. Verify
SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff.geo%';
-- Should show 11 rows

# 5. Exit psql
\q

# 6. Restart services
docker-compose restart api frontend
```

---

## 🎯 Which Option Should You Use?

| Option | When to Use | Difficulty |
|--------|-------------|------------|
| **Option 1** | Docker not running, need automation | Easy |
| **Option 2** | Docker is running, want quickest | Easiest ✅ |
| **Option 3** | Want to see each step, troubleshoot | Medium |

**Recommendation**: Use **Option 2** if you have Docker running.

---

## 📋 Pre-Flight Checklist

Run these commands to verify you're ready:

```bash
# 1. Check you're in the right directory
pwd
# Should output: /home/user/Forecastin

# 2. Check migration files exist
ls -la migrations/001_standardize_feature_flag_names.sql
# Should show the file

# 3. Check Docker is running
docker-compose ps
# Should show postgres container running

# 4. Check database connectivity
docker-compose exec postgres psql -U forecastin -d forecastin -c "SELECT 1"
# Should return "1"

# 5. Check feature_flags table exists
docker-compose exec postgres psql -U forecastin -d forecastin -c "\dt feature_flags"
# Should show feature_flags table
```

If ALL checks pass ✅, you're ready to migrate!

---

## 🚨 What You'll See During Migration

### Successful Migration Output:

```
BEGIN
CREATE TABLE
UPDATE 8
UPDATE 3
...
NOTICE: Migration successful: All feature flags standardized to ff.geo.* pattern
COMMIT
INSERT 0 1
```

### What This Means:

- `BEGIN` = Started transaction
- `CREATE TABLE` = Created backup table
- `UPDATE X` = Renamed X flags
- `NOTICE` = Migration verification passed
- `COMMIT` = Changes saved
- `INSERT` = Logged migration completion

---

## ✅ Post-Migration Verification

After running migration, verify everything worked:

```bash
# 1. Check new flag names exist
docker-compose exec postgres psql -U forecastin -d forecastin -c \
  "SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff.geo%';"

# Expected: 11 rows like:
# ff.geo.layers_enabled
# ff.geo.gpu_rendering_enabled
# ff.geo.point_layer_active
# ...

# 2. Check no old flag names remain
docker-compose exec postgres psql -U forecastin -d forecastin -c \
  "SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff_%' AND flag_name NOT LIKE 'ff.%' AND flag_name != 'ff.map_v1';"

# Expected: 0 rows (empty result)

# 3. Check backup table was created
docker-compose exec postgres psql -U forecastin -d forecastin -c \
  "\dt *backup*"

# Expected: feature_flags_backup_20251107 table

# 4. Check services are running
docker-compose ps

# Expected: api and frontend showing "Up"

# 5. Test API
curl http://localhost:9000/api/feature-flags 2>/dev/null | jq '.[].flag_name' | head

# Expected: Flag names with ff.geo.* pattern
```

---

## 🔄 If You Need to Rollback

If something goes wrong:

```bash
# Using Docker (Fastest)
docker-compose exec postgres psql -U forecastin -d forecastin -f /docker-entrypoint-initdb.d/001_standardize_feature_flag_names_ROLLBACK.sql

# Using Script
./scripts/migrate_feature_flags.sh rollback

# Restart services
docker-compose restart api frontend
```

---

## 📊 Current Status

**Files Ready**:
- ✅ `migrations/001_standardize_feature_flag_names.sql`
- ✅ `migrations/001_standardize_feature_flag_names_ROLLBACK.sql`
- ✅ `scripts/migrate_feature_flags.sh`

**Your Database**:
- Container: `forecastin_postgres`
- Database: `forecastin`
- User: `forecastin`
- Port: `5432`

**Services to Restart After**:
- `api` (backend)
- `frontend` (frontend)

---

## 🎬 Copy-Paste Full Command Sequence

**For your exact setup, here's the complete sequence:**

```bash
# Navigate to project
cd /home/user/Forecastin

# Start database (if not running)
docker-compose up -d postgres

# Wait 5 seconds for database to be ready
sleep 5

# Run migration
docker-compose exec postgres psql -U forecastin -d forecastin -f /docker-entrypoint-initdb.d/001_standardize_feature_flag_names.sql

# Verify (should show 11 rows)
docker-compose exec postgres psql -U forecastin -d forecastin -c "SELECT COUNT(*) FROM feature_flags WHERE flag_name LIKE 'ff.geo%';"

# Restart services
docker-compose restart api frontend

# Check logs for errors
docker-compose logs --tail=50 api | grep -i "error\|flag"
```

**Expected time**: 2-3 minutes

---

## ❓ Common Issues

### Issue: "No such file or directory: /docker-entrypoint-initdb.d/..."

**Fix**: The migration file isn't mounted in Docker. Use this instead:

```bash
# Copy migration into container
docker cp migrations/001_standardize_feature_flag_names.sql forecastin_postgres:/tmp/

# Run migration
docker-compose exec postgres psql -U forecastin -d forecastin -f /tmp/001_standardize_feature_flag_names.sql
```

### Issue: "Cannot connect to database"

**Fix**: Start the database first:

```bash
docker-compose up -d postgres
docker-compose ps postgres  # Wait until "healthy"
```

### Issue: "permission denied: ./scripts/migrate_feature_flags.sh"

**Fix**: Make executable:

```bash
chmod +x scripts/migrate_feature_flags.sh
```

---

## 🎯 Ready to Go?

**Run this ONE command to test everything:**

```bash
docker-compose exec postgres psql -U forecastin -d forecastin -c "SELECT version();"
```

If that works, you're ready! Use **Option 2** above.

---

## 🆘 Still Stuck?

Run this diagnostic:

```bash
echo "=== Docker Status ==="
docker-compose ps

echo ""
echo "=== Database Connectivity ==="
docker-compose exec postgres psql -U forecastin -d forecastin -c "SELECT 1"

echo ""
echo "=== Migration Files ==="
ls -la migrations/001_*.sql

echo ""
echo "=== Feature Flags Table ==="
docker-compose exec postgres psql -U forecastin -d forecastin -c "SELECT COUNT(*) FROM feature_flags"
```

Share the output if you need help!

---

**Next Step**: Choose Option 1, 2, or 3 above and execute! 🚀
