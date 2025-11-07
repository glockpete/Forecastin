#!/bin/bash
#
# Feature Flag Name Standardization Migration Script
# Date: 2025-11-07
# Breaking Change: YES
#
# This script automates the complete migration from old flag names to ff.geo.* pattern
#
# Usage:
#   ./scripts/migrate_feature_flags.sh         # Run migration
#   ./scripts/migrate_feature_flags.sh verify  # Verify migration
#   ./scripts/migrate_feature_flags.sh rollback # Rollback migration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-forecastin}"
DB_USER="${DB_USER:-postgres}"
MIGRATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/migrations"
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"

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

    # Check if PostgreSQL client is installed
    if ! command -v psql &> /dev/null; then
        log_error "psql command not found. Please install PostgreSQL client."
        exit 1
    fi

    # Check if migration files exist
    if [ ! -f "$MIGRATION_DIR/001_standardize_feature_flag_names.sql" ]; then
        log_error "Migration file not found: $MIGRATION_DIR/001_standardize_feature_flag_names.sql"
        exit 1
    fi

    # Check database connectivity
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
        log_error "Cannot connect to database. Please check connection parameters."
        exit 1
    fi

    log_success "All prerequisites met"
}

# Create backup
create_backup() {
    log_info "Creating database backup..."

    mkdir -p "$BACKUP_DIR"

    local backup_file="$BACKUP_DIR/feature_flags_backup_$(date +%Y%m%d_%H%M%S).sql"

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        COPY (SELECT * FROM feature_flags)
        TO STDOUT WITH CSV HEADER
    " > "$backup_file"

    if [ $? -eq 0 ]; then
        log_success "Backup created: $backup_file"
        echo "$backup_file"
    else
        log_error "Backup failed"
        exit 1
    fi
}

# Run database migration
run_migration() {
    log_info "Running database migration..."

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -f "$MIGRATION_DIR/001_standardize_feature_flag_names.sql"

    if [ $? -eq 0 ]; then
        log_success "Database migration completed"
    else
        log_error "Database migration failed"
        exit 1
    fi
}

# Verify migration
verify_migration() {
    log_info "Verifying migration..."

    # Count new-style flags
    local new_style_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM feature_flags WHERE flag_name LIKE 'ff.geo%'")

    # Count old-style flags (should be 0)
    local old_style_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM feature_flags
               WHERE flag_name LIKE 'ff_%'
               AND flag_name NOT LIKE 'ff.%'
               AND flag_name != 'ff.map_v1'")

    log_info "New-style flags (ff.geo.*): $new_style_count"
    log_info "Old-style flags (ff_*): $old_style_count"

    if [ "$old_style_count" -gt 0 ]; then
        log_error "Migration incomplete: $old_style_count old-style flags remain"

        # List remaining old-style flags
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -c "SELECT flag_name FROM feature_flags
                WHERE flag_name LIKE 'ff_%'
                AND flag_name NOT LIKE 'ff.%'
                AND flag_name != 'ff.map_v1'"

        exit 1
    fi

    log_success "Migration verification passed"
    log_success "All $new_style_count flags use ff.geo.* naming"
}

# Rollback migration
rollback_migration() {
    log_warning "Rolling back migration..."

    read -p "Are you sure you want to rollback? This will restore old flag names. (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "Rollback cancelled"
        exit 0
    fi

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -f "$MIGRATION_DIR/001_standardize_feature_flag_names_ROLLBACK.sql"

    if [ $? -eq 0 ]; then
        log_success "Rollback completed"
    else
        log_error "Rollback failed"
        exit 1
    fi
}

# Test migration on staging
test_migration() {
    log_info "Testing migration (dry run)..."

    # Create test transaction
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
BEGIN;
$(cat "$MIGRATION_DIR/001_standardize_feature_flag_names.sql" | sed '/^COMMIT;/d')
ROLLBACK;
EOF

    if [ $? -eq 0 ]; then
        log_success "Migration test passed (changes rolled back)"
    else
        log_error "Migration test failed"
        exit 1
    fi
}

# Main execution
main() {
    local command="${1:-migrate}"

    echo "=========================================="
    echo "Feature Flag Name Standardization"
    echo "=========================================="
    echo ""

    case "$command" in
        migrate)
            check_prerequisites
            create_backup
            run_migration
            verify_migration

            log_success "Migration complete!"
            log_info "Next steps:"
            log_info "1. Restart backend service: docker-compose restart api"
            log_info "2. Rebuild frontend: cd frontend && npm run build"
            log_info "3. Restart frontend service: docker-compose restart frontend"
            log_info "4. Verify with: ./scripts/migrate_feature_flags.sh verify"
            ;;

        verify)
            check_prerequisites
            verify_migration
            ;;

        rollback)
            check_prerequisites
            rollback_migration
            ;;

        test)
            check_prerequisites
            test_migration
            ;;

        *)
            log_error "Unknown command: $command"
            echo "Usage: $0 {migrate|verify|rollback|test}"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
