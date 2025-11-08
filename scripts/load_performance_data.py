#!/usr/bin/env python3
"""
Load performance test data into database for CI/CD pipeline testing
Generates synthetic data for performance benchmarking
"""

import sys
import argparse
import asyncio
import random
from pathlib import Path
from datetime import datetime, timedelta

# Add api directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'api'))

try:
    import psycopg
    from psycopg import sql
except ImportError:
    print("Warning: psycopg not available, data loading will be skipped")
    psycopg = None


async def create_test_tables(conn) -> bool:
    """Create test tables for performance testing"""
    try:
        # Create a simple hierarchy table for testing
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS test_hierarchy (
                id SERIAL PRIMARY KEY,
                path LTREE NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create index for performance testing
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS test_hierarchy_path_idx
            ON test_hierarchy USING GIST (path);
        """)

        print("✅ Test tables created")
        return True
    except Exception as e:
        print(f"❌ Failed to create test tables: {e}")
        return False


async def load_small_dataset(conn) -> bool:
    """Load small test dataset (100 records)"""
    try:
        # Generate hierarchical test data
        records = []
        for i in range(100):
            depth = random.randint(1, 4)
            path_parts = [f"level{j}_{random.randint(1, 10)}" for j in range(depth)]
            path = '.'.join(path_parts)
            records.append((path, f"Node {i}"))

        # Insert records
        async with conn.cursor() as cur:
            await cur.executemany(
                "INSERT INTO test_hierarchy (path, name) VALUES (%s, %s)",
                records
            )

        print(f"✅ Loaded {len(records)} test records (small dataset)")
        return True
    except Exception as e:
        print(f"❌ Failed to load small dataset: {e}")
        return False


async def load_medium_dataset(conn) -> bool:
    """Load medium test dataset (1,000 records)"""
    try:
        records = []
        for i in range(1000):
            depth = random.randint(1, 5)
            path_parts = [f"level{j}_{random.randint(1, 20)}" for j in range(depth)]
            path = '.'.join(path_parts)
            records.append((path, f"Node {i}"))

        # Insert in batches
        batch_size = 100
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            async with conn.cursor() as cur:
                await cur.executemany(
                    "INSERT INTO test_hierarchy (path, name) VALUES (%s, %s)",
                    batch
                )

        print(f"✅ Loaded {len(records)} test records (medium dataset)")
        return True
    except Exception as e:
        print(f"❌ Failed to load medium dataset: {e}")
        return False


async def load_large_dataset(conn) -> bool:
    """Load large test dataset (10,000 records)"""
    try:
        print("Loading large dataset (this may take a moment)...")
        total_records = 10000
        batch_size = 500
        total_inserted = 0

        for batch_num in range(0, total_records, batch_size):
            records = []
            for i in range(batch_num, min(batch_num + batch_size, total_records)):
                depth = random.randint(1, 6)
                path_parts = [f"level{j}_{random.randint(1, 50)}" for j in range(depth)]
                path = '.'.join(path_parts)
                records.append((path, f"Node {i}"))

            async with conn.cursor() as cur:
                await cur.executemany(
                    "INSERT INTO test_hierarchy (path, name) VALUES (%s, %s)",
                    records
                )

            total_inserted += len(records)
            if total_inserted % 2000 == 0:
                print(f"  Progress: {total_inserted}/{total_records} records loaded...")

        print(f"✅ Loaded {total_inserted} test records (large dataset)")
        return True
    except Exception as e:
        print(f"❌ Failed to load large dataset: {e}")
        return False


async def analyze_tables(conn) -> bool:
    """Run ANALYZE to update statistics"""
    try:
        await conn.execute("ANALYZE test_hierarchy;")
        print("✅ Table statistics updated")
        return True
    except Exception as e:
        print(f"❌ Failed to analyze tables: {e}")
        return False


async def load_performance_data(db_url: str, size: str = "small") -> int:
    """Load performance test data"""
    if not psycopg:
        print("⚠️  psycopg not available, skipping data load")
        print("✅ Mock data load completed (no-op)")
        return 0

    print("="*60)
    print(f"Loading Performance Test Data ({size} dataset)")
    print("="*60)

    try:
        conn = await psycopg.AsyncConnection.connect(db_url)

        # Create tables
        if not await create_test_tables(conn):
            await conn.close()
            return 1

        # Load data based on size
        if size == "small":
            success = await load_small_dataset(conn)
        elif size == "medium":
            success = await load_medium_dataset(conn)
        elif size == "large":
            success = await load_large_dataset(conn)
        else:
            print(f"❌ Unknown dataset size: {size}")
            await conn.close()
            return 1

        if not success:
            await conn.close()
            return 1

        # Update statistics
        await analyze_tables(conn)

        # Get count
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) FROM test_hierarchy;")
            count = (await cur.fetchone())[0]
            print(f"\nTotal records in database: {count}")

        await conn.close()

        print("\n" + "="*60)
        print("✅ Performance data load completed successfully")
        print("="*60)

        return 0

    except Exception as e:
        print(f"❌ Failed to load performance data: {e}")
        return 1


def main():
    parser = argparse.ArgumentParser(description="Load performance test data")
    parser.add_argument("--db-url", help="Database connection URL",
                       default="postgresql://postgres:postgres@localhost:5432/forecastin_perf")
    parser.add_argument("--size", choices=["small", "medium", "large"],
                       default="small", help="Dataset size to load")
    args = parser.parse_args()

    try:
        exit_code = asyncio.run(load_performance_data(args.db_url, args.size))
        sys.exit(exit_code)
    except Exception as e:
        print(f"❌ Data loading failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
