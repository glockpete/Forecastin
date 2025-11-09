#!/usr/bin/env python3
"""
Initialize Geospatial Feature Flags

Creates the three specific geospatial feature flags required for the
geospatial layer system rollout:
1. ff.geo.layers_enabled (master switch)
2. ff.geo.gpu_rendering_enabled (GPU acceleration)
3. ff.geo.point_layer_active (PointLayer visibility)

Usage:
    python init_geospatial_flags.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.database_manager import DatabaseManager
from services.feature_flag_service import CreateFeatureFlagRequest, FeatureFlagService


async def init_geospatial_flags():
    """Initialize the three required geospatial feature flags."""
    print("=" * 60)
    print("GEOSPATIAL FEATURE FLAGS INITIALIZATION")
    print("=" * 60)

    # Initialize services
    db_manager = DatabaseManager()
    await db_manager.initialize()

    # Optional: Initialize cache and realtime services
    cache_service = None  # CacheService() if available
    realtime_service = None  # RealtimeService() if available

    try:
        # Initialize feature flag service
        ff_service = FeatureFlagService(
            database_manager=db_manager,
            cache_service=cache_service,
            realtime_service=realtime_service
        )

        await ff_service.initialize()

        # Define the three required geospatial flags
        geospatial_flags = [
            CreateFeatureFlagRequest(
                flag_name="ff.geo.layers_enabled",
                description="Master switch for geospatial layer system (requires ff.map_v1)",
                is_enabled=False,
                rollout_percentage=0,
                flag_category="geospatial",
                dependencies=["ff.map_v1"]
            ),
            CreateFeatureFlagRequest(
                flag_name="ff.geo.gpu_rendering_enabled",
                description="Enable GPU-accelerated filtering and rendering for geospatial layers",
                is_enabled=False,
                rollout_percentage=0,
                flag_category="geospatial",
                dependencies=["ff.geo.layers_enabled"]
            ),
            CreateFeatureFlagRequest(
                flag_name="ff.geo.point_layer_active",
                description="Control visibility of PointLayer implementation",
                is_enabled=False,
                rollout_percentage=0,
                flag_category="geospatial",
                dependencies=["ff.geo.layers_enabled"]
            )
        ]

        created_count = 0
        skipped_count = 0

        # Create each flag
        for flag_request in geospatial_flags:
            try:
                # Check if flag already exists
                existing = await ff_service.get_flag(flag_request.flag_name)

                if existing:
                    print(f"⏭️  Skipped: {flag_request.flag_name} (already exists)")
                    skipped_count += 1
                else:
                    # Create the flag
                    flag = await ff_service.create_flag(flag_request)
                    print(f"✅ Created: {flag.flag_name}")
                    created_count += 1

            except Exception as e:
                print(f"❌ Failed to create {flag_request.flag_name}: {e}")

        # Display summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"Created: {created_count}")
        print(f"Skipped: {skipped_count}")
        print(f"Total:   {created_count + skipped_count}")

        # Display current status
        print("\n" + "=" * 60)
        print("CURRENT STATUS")
        print("=" * 60)

        for flag_request in geospatial_flags:
            flag = await ff_service.get_flag(flag_request.flag_name)
            if flag:
                deps = flag_request.dependencies or []
                deps_str = ", ".join(deps) if deps else "none"
                print(f"\n{flag.flag_name}")
                print(f"  Enabled: {flag.is_enabled}")
                print(f"  Rollout: {flag.rollout_percentage}%")
                print(f"  Dependencies: {deps_str}")

        print("\n" + "=" * 60)
        print("✅ INITIALIZATION COMPLETE")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Enable ff.map_v1 first (dependency)")
        print("2. Enable ff.geo.layers_enabled with 10% rollout")
        print("3. Monitor performance and gradually increase rollout")
        print("4. Enable GPU rendering and point layer features")

    finally:
        await ff_service.cleanup()
        await db_manager.cleanup()


if __name__ == "__main__":
    asyncio.run(init_geospatial_flags())
