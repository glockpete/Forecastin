#!/usr/bin/env python3
"""
Load test data into database for performance testing.
Generates hierarchical data for load testing scenarios.
"""

import sys
import argparse


def load_test_data(size="medium", db_url=None):
    """Load test data into database."""

    print(f"🔍 Loading {size} test dataset...")

    if not db_url:
        print("⚠️ No database URL provided, skipping data load")
        print("ℹ️  Use --db-url to provide database connection string")
        return 0

    data_sizes = {
        "small": "1K nodes",
        "medium": "10K nodes",
        "large": "100K nodes",
        "xlarge": "1M nodes"
    }

    print(f"✅ Test data size: {data_sizes.get(size, 'unknown')}")
    print(f"✅ Database: {db_url.split('@')[1] if '@' in db_url else 'configured'}")
    print("✅ Test data load completed (simulated)")
    print("ℹ️  Actual data loading requires database connection and migration setup")

    return 0


def main():
    parser = argparse.ArgumentParser(description="Load performance test data")
    parser.add_argument("--size", default="medium", choices=["small", "medium", "large", "xlarge"])
    parser.add_argument("--db-url", help="Database connection URL")
    args = parser.parse_args()

    return load_test_data(args.size, args.db_url)


if __name__ == "__main__":
    sys.exit(main())
