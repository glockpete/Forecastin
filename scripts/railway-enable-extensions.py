#!/usr/bin/env python3
"""
Railway PostgreSQL Extension Setup Script
Enables required extensions (PostGIS, LTREE) for Forecastin

This script can be run from within Railway environment or locally with proper credentials.
"""

import asyncio
import os
import sys
from typing import Optional

import asyncpg


async def enable_extensions(database_url: str) -> bool:
    """
    Enable required PostgreSQL extensions for Forecastin.

    Args:
        database_url: PostgreSQL connection URL

    Returns:
        True if successful, False otherwise
    """
    print("=" * 80)
    print("Railway PostgreSQL Extension Setup for Forecastin")
    print("=" * 80)
    print()

    try:
        # Connect to PostgreSQL
        print("Step 1: Connecting to PostgreSQL...")
        conn = await asyncpg.connect(database_url)
        print("✓ Connection successful")
        print()

        # Get PostgreSQL version
        version = await conn.fetchval("SELECT version();")
        print(f"PostgreSQL Version: {version}")
        print()

        # Enable PostGIS extension
        print("Step 2: Enabling PostGIS extension...")
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            print("✓ PostGIS extension enabled")
        except Exception as e:
            print(f"⚠ PostGIS warning: {e}")
        print()

        # Enable LTREE extension
        print("Step 3: Enabling LTREE extension...")
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS ltree;")
            print("✓ LTREE extension enabled")
        except Exception as e:
            print(f"⚠ LTREE warning: {e}")
        print()

        # Verify extensions
        print("Step 4: Verifying installed extensions...")
        extensions = await conn.fetch("""
            SELECT extname, extversion
            FROM pg_extension
            WHERE extname IN ('postgis', 'ltree')
            ORDER BY extname;
        """)

        if extensions:
            print("\nInstalled Extensions:")
            for ext in extensions:
                print(f"  - {ext['extname']}: v{ext['extversion']}")
        else:
            print("⚠ Warning: No required extensions found!")
            await conn.close()
            return False

        print()

        # Test PostGIS
        print("Step 5: Testing PostGIS functionality...")
        try:
            result = await conn.fetchval(
                "SELECT ST_AsText(ST_GeomFromText('POINT(0 0)', 4326));"
            )
            print(f"✓ PostGIS test successful: {result}")
        except Exception as e:
            print(f"✗ PostGIS test failed: {e}")
            await conn.close()
            return False

        # Test LTREE
        print("Step 6: Testing LTREE functionality...")
        try:
            result = await conn.fetchval("SELECT 'Top.Science.Astronomy'::ltree;")
            print(f"✓ LTREE test successful: {result}")
        except Exception as e:
            print(f"✗ LTREE test failed: {e}")
            await conn.close()
            return False

        await conn.close()

        print()
        print("=" * 80)
        print("✓ PostgreSQL extensions configured successfully!")
        print("=" * 80)
        print()
        print("Extensions enabled:")
        print("  - PostGIS (geospatial features)")
        print("  - LTREE (hierarchical data)")
        print()
        print("Next steps:")
        print("1. Configure Railway API service environment variables")
        print("2. Deploy the application")
        print("3. Run database migrations if needed")
        print()

        return True

    except asyncpg.PostgresConnectionError as e:
        print(f"\n✗ ERROR: Cannot connect to PostgreSQL")
        print(f"Details: {e}")
        print()
        print("Troubleshooting:")
        print("1. Verify DATABASE_URL is correct")
        print("2. Ensure PostgreSQL service is running in Railway")
        print("3. Check network connectivity")
        print()
        print("Alternative: Use Railway Dashboard PostgreSQL Console")
        print("1. Go to Railway Dashboard → meticulous-unity → PostgreSQL")
        print("2. Click 'Data' tab → 'Query' button")
        print("3. Run: CREATE EXTENSION IF NOT EXISTS postgis;")
        print("4. Run: CREATE EXTENSION IF NOT EXISTS ltree;")
        print()
        return False

    except Exception as e:
        print(f"\n✗ ERROR: Unexpected error occurred")
        print(f"Details: {e}")
        print()
        return False


async def main():
    """Main entry point."""
    # Get database URL from environment or command line
    database_url: Optional[str] = os.getenv('DATABASE_URL')

    if len(sys.argv) > 1:
        database_url = sys.argv[1]

    if not database_url:
        print("ERROR: DATABASE_URL not provided")
        print()
        print("Usage:")
        print("  python railway-enable-extensions.py <DATABASE_URL>")
        print()
        print("Or set DATABASE_URL environment variable:")
        print("  export DATABASE_URL='postgresql://user:pass@host:5432/database'")
        print("  python railway-enable-extensions.py")
        print()
        print("For Railway (meticulous-unity project):")
        print("  DATABASE_URL='postgresql://postgres:VKusmUGwgttBbItCsbeearDdCKfcwqci@postgres.railway.internal:5432/railway'")
        print()
        sys.exit(1)

    # Mask password in output
    masked_url = database_url
    if '@' in database_url:
        parts = database_url.split('@')
        if ':' in parts[0]:
            user_pass = parts[0].split(':')
            masked_url = f"{user_pass[0]}:****@{parts[1]}"

    print(f"Using DATABASE_URL: {masked_url}")
    print()

    # Enable extensions
    success = await enable_extensions(database_url)

    if success:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    # Check if asyncpg is installed
    try:
        import asyncpg
    except ImportError:
        print("ERROR: asyncpg package not found")
        print()
        print("Install it with:")
        print("  pip install asyncpg")
        print()
        sys.exit(1)

    # Run main
    asyncio.run(main())
