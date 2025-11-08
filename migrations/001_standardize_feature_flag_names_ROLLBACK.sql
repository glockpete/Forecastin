-- Rollback Migration: Standardize Feature Flag Names
-- Date: 2025-11-07
-- Updated: 2025-11-08
--
-- This script rolls back the comprehensive feature flag name standardization
-- by restoring from the backup table created during migration
--
-- Reverts namespaced flags (ff.geo.*, ff.ml.*, ff.ws.*, etc.) back to original names
--
-- CAUTION: Only use if migration causes issues. This will lose any
-- flag changes made AFTER the migration was applied.

BEGIN;

-- Verify backup table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_name = 'feature_flags_backup_20251107') THEN
        RAISE EXCEPTION 'Backup table feature_flags_backup_20251107 not found. Cannot rollback.';
    END IF;
END $$;

-- Restore from backup
TRUNCATE TABLE feature_flags;

INSERT INTO feature_flags
SELECT * FROM feature_flags_backup_20251107;

-- Verify rollback
DO $$
DECLARE
    restored_count INTEGER;
    backup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO restored_count FROM feature_flags;
    SELECT COUNT(*) INTO backup_count FROM feature_flags_backup_20251107;

    IF restored_count != backup_count THEN
        RAISE EXCEPTION 'Rollback verification failed: row count mismatch';
    END IF;

    RAISE NOTICE 'Rollback successful: Restored % feature flags', restored_count;
END $$;

COMMIT;

-- Log rollback
INSERT INTO migration_log (migration_name, applied_at, description)
VALUES (
    '001_standardize_feature_flag_names_ROLLBACK',
    NOW(),
    'Rolled back feature flag name standardization'
);

-- Note: Keep backup table for audit trail
-- To clean up backup: DROP TABLE IF EXISTS feature_flags_backup_20251107;
