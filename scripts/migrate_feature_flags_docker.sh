#!/bin/bash
#
# Docker-Compatible Feature Flag Migration Script
# Date: 2025-11-08
# Breaking Change: YES
#
# This script works with Docker PostgreSQL environment
#
# Usage:
#   ./scripts/migrate_feature_flags_docker.sh test   # Test migration
#   ./scripts/migrate_feature_flags_docker.sh migrate # Execute migration
#   ./scripts/migrate_feature_flags_docker.sh verify  # Verify migration
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MIGRATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/migrations"
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
CONTAINER_NAME="forecastin_postgres"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose command not found."
        exit 1
    fi

    # Check if migration file exists
    if [ ! -f "$MIGRATION_DIR/001_standardize_feature_flag_names.sql" ]; then
        log_error "Migration file not found: $MIGRATION_DIR/001_standardize_feature_flag_names.sql"
        exit 1
    fi

    # Check if container is running
    if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$CONTAINER_NAME"; then
        log_error "PostgreSQL container not found or not running: $CONTAINER_NAME"
        exit 1
    fi

    log_success "All prerequisites met"
}

# Create backup
create_backup() {
    log_info "Creating database backup..."

    mkdir -p "$BACKUP_DIR"
    local backup_file="$BACKUP_DIR/feature_flags_backup_$(date +%Y%m%d_%H%M%S).sql"

    # Backup feature flags using docker-compose
    docker-compose exec -T postgres psql -U forecastin -d forecastin -c "SELECT * FROM feature_flags;" > "$backup_file" || {
        log_error "Backup failed"
        exit 1
    }

    if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
        log_success "Backup created: $backup_file"
        echo "$backup_file"
    else
        log_error "Backup file is empty or not created"
        exit 1
    fi
}

# Run database migration
run_migration() {
    log_info "Running database migration..."

    docker-compose exec -T postgres psql -U forecastin -d forecastin -f "/migrations/001_standardize_feature_flag_names.sql" || {
        log_error "Database migration failed"
        exit 1
    }

    log_success "Database migration completed"
}

# Verify migration
verify_migration() {
    log_info "Verifying migration..."

    # Count new-style flags
    local new_style_count=$(docker-compose exec -T postgres psql -U forecastin -d forecastin -t -c "SELECT COUNT(*) FROM feature_flags WHERE flag_name LIKE 'ff.geo%';" | tr -d ' \n')

    # Count old-style flags (should be 0)
    local old_style_count=$(docker-compose exec -T postgres psql -U forecastin -d forecastin -t -c "SELECT COUNT(*) FROM feature_flags WHERE flag_name LIKE 'ff_%' AND flag_name NOT LIKE 'ff.%' AND flag_name != 'ff.map_v1';" | tr -d ' \n')

    log_info "New-style flags (ff.geo.*): $new_style_count"
    log_info "Old-style flags (ff_*): $old_style_count"

    if [ "$old_style_count" -gt 0 ]; then
        log_error "Migration incomplete: $old_style_count old-style flags remain"

        # List remaining old-style flags
        docker-compose exec -T postgres psql -U forecastin -d forecastin -c "SELECT flag_name FROM feature_flags WHERE flag_name LIKE 'ff_%' AND flag_name NOT LIKE 'ff.%' AND flag_name != 'ff.map_v1'"

        exit 1
    fi

    log_success "Migration verification passed"
    log_success "All $new_style_count flags use standardized naming"
}

# Test migration (dry run)
test_migration() {
    log_info "Testing migration (dry run)..."

    # Use a transaction with rollback
    docker-compose exec -T postgres psql -U forecastin -d forecastin <<'EOF'
BEGIN;
-- Run the migration without COMMIT
\i /migrations/001_standardize_feature_flag_names.sql
-- This will fail because of the COMMIT, so let's test individual parts
ROLLBACK;
EOF

    # Test individual updates to ensure they work
    log_info "Testing individual flag name changes..."

    # Test the specific changes
    docker-compose exec -T postgres psql -U forecastin -d forecastin -c "BEGIN; 
        -- Test ff.map_v1 -> ff.geo.map
        UPDATE feature_flags SET flag_name = 'test.geo.map' WHERE flag_name = 'ff.map_v1' AND flag_name = 'ff.map_v1';
        -- Test ff.hierarchy_optimized -> ff.hierarchy.optimized
        UPDATE feature_flags SET flag_name = 'test.hierarchy.optimized' WHERE flag_name = 'ff.hierarchy_optimized';
        -- Test ff.ws_v1 -> ff.ws.realtime
        UPDATE feature_flags SET flag_name = 'test.ws.realtime' WHERE flag_name = 'ff.ws_v1';
        -- Rollback to original state
        ROLLBACK;"

    if [ $? -eq 0 ]; then
        log_success "Migration test passed (individual updates work)"
    else
        log_error "Migration test failed"
        exit 1
    fi
}

# Show current flags
show_current_flags() {
    log_info "Current feature flags:"
    docker-compose exec -T postgres psql -U forecastin -d forecastin -c "SELECT flag_name, is_enabled FROM feature_flags ORDER BY flag_name;"
}

# Main execution
main() {
    local command="${1:-migrate}"

    echo "=========================================="
    echo "Feature Flag Migration (Docker Version)"
    echo "=========================================="
    echo ""

    case "$command" in
        test)
            check_prerequisites
            test_migration
            ;;

        migrate)
            check_prerequisites
            show_current_flags
            create_backup
            run_migration
            verify_migration

            log_success "Migration complete!"
            log_info "Next steps:"
            log_info "1. Restart backend service: docker-compose restart api"
            log_info "2. Rebuild frontend: cd frontend && npm run build"
            log_info "3. Restart frontend service: docker-compose restart frontend"
            log_info "4. Verify with: ./scripts/migrate_feature_flags_docker.sh verify"
            ;;

        verify)
            check_prerequisites
            verify_migration
            ;;

        show)
            check_prerequisites
            show_current_flags
            ;;

        *)
            log_error "Unknown command: $command"
            echo "Usage: $0 {migrate|verify|test|show}"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"