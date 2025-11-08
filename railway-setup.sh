#!/bin/bash
# Railway PostgreSQL Extension Setup Script
# Run this script to enable required PostgreSQL extensions for Forecastin

set -e

echo "=================================================="
echo "Railway PostgreSQL Extension Setup for Forecastin"
echo "=================================================="
echo ""

# PostgreSQL connection details
export DATABASE_URL="postgresql://postgres:VKusmUGwgttBbItCsbeearDdCKfcwqci@postgres.railway.internal:5432/railway"

echo "Step 1: Testing PostgreSQL connection..."
psql "$DATABASE_URL" -c "SELECT version();" || {
    echo "ERROR: Cannot connect to PostgreSQL"
    echo "This script must be run from within Railway environment"
    echo ""
    echo "Alternative: Use Railway Dashboard PostgreSQL Console"
    echo "1. Go to Railway Dashboard → meticulous-unity → PostgreSQL service"
    echo "2. Click 'Data' tab → 'Query' button"
    echo "3. Run the SQL commands shown below"
    echo ""
    exit 1
}

echo "✓ PostgreSQL connection successful"
echo ""

echo "Step 2: Enabling PostGIS extension..."
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS postgis;" && echo "✓ PostGIS enabled" || echo "⚠ PostGIS already exists or failed"

echo "Step 3: Enabling LTREE extension..."
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS ltree;" && echo "✓ LTREE enabled" || echo "⚠ LTREE already exists or failed"

echo ""
echo "Step 4: Verifying extensions..."
psql "$DATABASE_URL" -c "\dx"

echo ""
echo "=================================================="
echo "✓ PostgreSQL extensions configured successfully!"
echo "=================================================="
echo ""
echo "Extensions enabled:"
echo "  - PostGIS (geospatial features)"
echo "  - LTREE (hierarchical data)"
echo ""
echo "Next steps:"
echo "1. Configure Railway API service environment variables"
echo "2. Deploy the application"
echo "3. Run database migrations if needed"
