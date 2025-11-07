# WHERE AND HOW TO EXECUTE THE MIGRATION

## Quick Answer

**Where**: On your **server** or **local machine** where PostgreSQL database is running

**Requirements**:
- Access to PostgreSQL database (via `psql` command)
- Repository cloned at `/path/to/Forecastin`
- Services running (or ability to restart them)

---

## 🎯 Step-by-Step Instructions

### SCENARIO 1: Production Server with Docker (Most Common)

#### Step 1: Connect to Your Server

```bash
# SSH into your production server
ssh user@your-server.com

# Or if using a cloud provider:
# AWS: ssh -i your-key.pem ec2-user@your-instance-ip
# Digital Ocean: ssh root@your-droplet-ip
# Railway/Heroku: Use their CLI tools
```

#### Step 2: Navigate to Project

```bash
cd /path/to/Forecastin

# Verify you're in the right place
ls scripts/migrate_feature_flags.sh
# Should show the script exists
```

#### Step 3: Check Prerequisites

```bash
# Check database is running
docker-compose ps | grep postgres
# Should show postgres container running

# Check database connectivity
docker-compose exec postgres psql -U postgres -d forecastin -c "SELECT 1"
# Should return "1" if connected
```

#### Step 4: Run Migration

```bash
# First, test it (dry-run - no changes)
./scripts/migrate_feature_flags.sh test

# If test passes, run the migration
./scripts/migrate_feature_flags.sh migrate

# Restart services
docker-compose restart api frontend

# Verify success
./scripts/migrate_feature_flags.sh verify
```

---

### SCENARIO 2: Local Development Machine

#### Step 1: Open Terminal

```bash
# Navigate to your project
cd ~/Projects/Forecastin
# Or wherever you cloned the repo
```

#### Step 2: Check Database is Running

```bash
# If using Docker locally
docker-compose up -d postgres

# If using local PostgreSQL
pg_isready -h localhost -p 5432
```

#### Step 3: Set Database Connection

```bash
# Set environment variables (if needed)
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=forecastin
export DB_USER=postgres

# Or create .env file
cat > .env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=forecastin
DB_USER=postgres
PGPASSWORD=your_password
EOF
```

#### Step 4: Run Migration

```bash
# Test first
./scripts/migrate_feature_flags.sh test

# Run migration
./scripts/migrate_feature_flags.sh migrate

# Restart services (choose one)
docker-compose restart api frontend    # If using Docker
# OR
pm2 restart all                        # If using PM2
# OR
supervisorctl restart all              # If using Supervisor
```

---

### SCENARIO 3: Manual Execution (No Script)

If the script doesn't work, run manually:

```bash
# 1. Connect to database
psql -h localhost -U postgres -d forecastin

# 2. Run migration SQL
\i migrations/001_standardize_feature_flag_names.sql

# 3. Verify
SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff.geo%';

# 4. Exit
\q

# 5. Restart services
docker-compose restart api frontend
```

---

### SCENARIO 4: Remote Database (Cloud Provider)

#### For Railway/Heroku/AWS RDS:

```bash
# 1. Get database connection string
# Railway: railway variables | grep DATABASE_URL
# Heroku: heroku config:get DATABASE_URL
# AWS: Check RDS console

# 2. Connect directly
psql "postgresql://user:password@host:port/database"

# 3. Run migration
\i migrations/001_standardize_feature_flag_names.sql

# 4. Verify
SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff.geo%';

# 5. Restart your app
# Railway: railway up
# Heroku: heroku restart
# AWS: Redeploy via your CI/CD
```

---

## 🔍 How to Find Your Setup

### Find Where Database is Running

```bash
# Check Docker
docker ps | grep postgres

# Check local PostgreSQL
ps aux | grep postgres

# Check remote connections
netstat -an | grep 5432
```

### Find Database Credentials

```bash
# Check environment variables
env | grep -E "DB_|DATABASE_|POSTGRES"

# Check .env file
cat .env | grep -E "DB_|DATABASE_|POSTGRES"

# Check docker-compose.yml
cat docker-compose.yml | grep -A 10 "postgres"
```

### Example Output from docker-compose.yml:

```yaml
postgres:
  image: postgres:15
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: your_password
    POSTGRES_DB: forecastin
  ports:
    - "5432:5432"
```

**Use these values** in the migration script.

---

## 🚨 Common Issues & Solutions

### Issue 1: "psql: command not found"

**Solution**: Install PostgreSQL client

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Windows
# Download from: https://www.postgresql.org/download/windows/
```

### Issue 2: "Permission denied: ./scripts/migrate_feature_flags.sh"

**Solution**: Make script executable

```bash
chmod +x scripts/migrate_feature_flags.sh
```

### Issue 3: "Cannot connect to database"

**Solution**: Check connection parameters

```bash
# Test connection manually
psql -h localhost -U postgres -d forecastin -c "SELECT 1"

# If that works, update script variables:
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=forecastin
export DB_USER=postgres
```

### Issue 4: "Database 'forecastin' does not exist"

**Solution**: Check actual database name

```bash
# List all databases
psql -h localhost -U postgres -c "\l"

# Use the correct database name
export DB_NAME=your_actual_database_name
```

### Issue 5: Docker not running

**Solution**: Start Docker

```bash
# Start Docker services
docker-compose up -d

# Or start just database
docker-compose up -d postgres
```

---

## 📝 Pre-Migration Checklist

Before running migration, verify:

- [ ] You have SSH/terminal access to server
- [ ] PostgreSQL database is running
- [ ] You can connect with `psql` command
- [ ] Database has `feature_flags` table
- [ ] You have write access to database
- [ ] You have permission to restart services
- [ ] You have a backup (or can create one)

### Quick Verification Commands:

```bash
# 1. Can I connect to database?
psql -h localhost -U postgres -d forecastin -c "SELECT 1"

# 2. Does feature_flags table exist?
psql -h localhost -U postgres -d forecastin -c "\dt feature_flags"

# 3. Are there existing flags?
psql -h localhost -U postgres -d forecastin -c "SELECT COUNT(*) FROM feature_flags"

# 4. Can I restart services?
docker-compose restart api --dry-run 2>/dev/null && echo "Yes" || echo "No"
```

---

## 🎬 Complete Example (Copy-Paste)

### For Docker Setup:

```bash
# 1. SSH to server
ssh user@your-server.com

# 2. Go to project
cd /path/to/Forecastin

# 3. Pull latest code
git pull origin claude/codebase-audit-and-fixes-011CUtPZZvGBYFe9mD7ehTT4

# 4. Test migration (safe - no changes)
./scripts/migrate_feature_flags.sh test

# 5. If test passes, run migration
./scripts/migrate_feature_flags.sh migrate

# 6. Restart services
docker-compose restart api frontend

# 7. Verify success
./scripts/migrate_feature_flags.sh verify

# 8. Check logs for errors
docker-compose logs -f api | grep -i "feature.*flag"
```

### For Local Development:

```bash
# 1. Open terminal
cd ~/Projects/Forecastin

# 2. Pull latest code
git checkout claude/codebase-audit-and-fixes-011CUtPZZvGBYFe9mD7ehTT4
git pull

# 3. Start database
docker-compose up -d postgres

# 4. Test migration
./scripts/migrate_feature_flags.sh test

# 5. Run migration
./scripts/migrate_feature_flags.sh migrate

# 6. Restart app
docker-compose restart api frontend

# 7. Test in browser
open http://localhost:3000
```

---

## 💡 What Happens When You Run It?

### Terminal Output You'll See:

```
==========================================
Feature Flag Name Standardization
==========================================

[INFO] Checking prerequisites...
[SUCCESS] All prerequisites met
[INFO] Creating database backup...
[SUCCESS] Backup created: /path/to/backups/feature_flags_backup_20251107_123456.sql
[INFO] Running database migration...
NOTICE: Migration successful: All feature flags standardized to ff.geo.* pattern
[SUCCESS] Database migration completed
[INFO] Verifying migration...
[INFO] New-style flags (ff.geo.*): 11
[INFO] Old-style flags (ff_*): 0
[SUCCESS] Migration verification passed
[SUCCESS] All 11 flags use ff.geo.* naming
[SUCCESS] Migration complete!
[INFO] Next steps:
[INFO] 1. Restart backend service: docker-compose restart api
[INFO] 2. Rebuild frontend: cd frontend && npm run build
[INFO] 3. Restart frontend service: docker-compose restart frontend
[INFO] 4. Verify with: ./scripts/migrate_feature_flags.sh verify
```

---

## ❓ Still Not Sure?

### Tell me your setup:

1. **Where is your database?**
   - [ ] Docker on my laptop
   - [ ] Docker on a server
   - [ ] Cloud provider (Railway, Heroku, AWS RDS)
   - [ ] Local PostgreSQL
   - [ ] Not sure

2. **How do you normally access it?**
   - [ ] `docker-compose up`
   - [ ] SSH to a server
   - [ ] Cloud dashboard
   - [ ] pgAdmin or database GUI
   - [ ] Not sure

3. **Can you run this command?**
   ```bash
   psql --version
   ```
   - If YES: You have PostgreSQL client installed ✅
   - If NO: You need to install it first

**Reply with your answers** and I'll give you exact commands for your specific setup!

---

## 🆘 Need Help?

If you're stuck, run this diagnostic and share the output:

```bash
# Save to file
./scripts/migration_diagnostics.sh > diagnostics.txt

# Or run these manually:
echo "=== System Info ==="
uname -a

echo "=== Docker Status ==="
docker ps 2>&1

echo "=== PostgreSQL Client ==="
psql --version 2>&1

echo "=== Database Connection ==="
psql -h localhost -U postgres -l 2>&1

echo "=== Project Files ==="
ls -la scripts/migrate_feature_flags.sh migrations/*.sql 2>&1

# Share the diagnostics.txt output
```

---

**Bottom Line**: You need to run this wherever your PostgreSQL database is running. Most likely that's on a server you SSH into, or your local machine if developing.
