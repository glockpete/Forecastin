#!/usr/bin/env python3
"""
Load RSS Sources from YAML Configuration to Database

This script reads the rss_sources.yaml configuration file and populates
the rss_feed_sources and rss_route_configs tables in the database.

Usage:
    python scripts/load_rss_sources.py [--dry-run] [--clear-existing]

Options:
    --dry-run         Show what would be loaded without actually loading
    --clear-existing  Clear existing sources before loading (use with caution)
    --config-file     Path to RSS sources YAML file (default: api/config/rss_sources.yaml)

Example:
    python scripts/load_rss_sources.py --dry-run
    python scripts/load_rss_sources.py
    python scripts/load_rss_sources.py --clear-existing
"""

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Dict, Any

import yaml
import asyncpg
from asyncpg import Connection

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "api"))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RSSSourceLoader:
    """Loader for RSS sources from YAML to PostgreSQL database"""

    def __init__(self, config_file: str, db_connection_string: str):
        self.config_file = Path(config_file)
        self.db_connection_string = db_connection_string
        self.conn: Connection = None

    async def connect(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = await asyncpg.connect(self.db_connection_string)
            logger.info("Connected to database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    async def close(self):
        """Close database connection"""
        if self.conn:
            await self.conn.close()
            logger.info("Closed database connection")

    def load_yaml_config(self) -> Dict[str, Any]:
        """Load RSS sources from YAML file"""
        try:
            if not self.config_file.exists():
                raise FileNotFoundError(f"Config file not found: {self.config_file}")

            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)

            sources = config.get('sources', [])
            logger.info(f"Loaded {len(sources)} sources from {self.config_file}")
            return config

        except Exception as e:
            logger.error(f"Failed to load YAML config: {e}")
            raise

    async def get_or_create_route_config(
        self,
        route_config: Dict[str, Any]
    ) -> str:
        """
        Get or create route configuration and return its ID

        Args:
            route_config: Route configuration dictionary

        Returns:
            UUID of the route configuration
        """
        if not route_config:
            # Use default standard_news route
            route_name = 'standard_news'
        else:
            # For now, use route name from config or generate one
            route_name = route_config.get('name', 'standard_news')

        # Check if route exists
        existing_route = await self.conn.fetchrow(
            "SELECT id FROM rss_route_configs WHERE route_name = $1",
            route_name
        )

        if existing_route:
            return existing_route['id']

        # If custom route config provided, create it
        if route_config and route_config.get('selectors'):
            route_id = await self.conn.fetchval(
                """
                INSERT INTO rss_route_configs
                (route_name, css_selectors, anti_crawler_config, confidence_factors, description)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (route_name) DO UPDATE
                SET css_selectors = EXCLUDED.css_selectors,
                    anti_crawler_config = EXCLUDED.anti_crawler_config,
                    confidence_factors = EXCLUDED.confidence_factors
                RETURNING id
                """,
                route_name,
                route_config.get('selectors', {}),
                route_config.get('anti_crawler', {}),
                route_config.get('confidence_factors', {}),
                f"Route for {route_name}"
            )
            logger.debug(f"Created route config: {route_name}")
            return route_id
        else:
            # Use default route
            default_route = await self.conn.fetchrow(
                "SELECT id FROM rss_route_configs WHERE route_name = $1",
                'standard_news'
            )
            return default_route['id'] if default_route else None

    async def insert_source(
        self,
        source: Dict[str, Any],
        dry_run: bool = False
    ) -> bool:
        """
        Insert a single RSS source into the database

        Args:
            source: Source configuration dictionary
            dry_run: If True, only log what would be inserted

        Returns:
            True if successful, False otherwise
        """
        try:
            name = source['name']
            url = source['url']
            region = source['region']
            language = source['language']
            political_orientation = source['political_orientation']
            source_type = source['source_type']
            reliability_score = source.get('reliability_score', 0.75)

            if dry_run:
                logger.info(
                    f"[DRY RUN] Would insert: {name} | {region} | {language} | "
                    f"{political_orientation} | {source_type} | {reliability_score:.2f}"
                )
                return True

            # Get or create route config
            route_config_id = await self.get_or_create_route_config(
                source.get('route_config')
            )

            # Insert source
            await self.conn.execute(
                """
                INSERT INTO rss_feed_sources
                (name, url, region, language, political_orientation, source_type,
                 reliability_score, route_config_id, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (name) DO UPDATE
                SET url = EXCLUDED.url,
                    region = EXCLUDED.region,
                    language = EXCLUDED.language,
                    political_orientation = EXCLUDED.political_orientation,
                    source_type = EXCLUDED.source_type,
                    reliability_score = EXCLUDED.reliability_score,
                    route_config_id = EXCLUDED.route_config_id,
                    updated_at = NOW()
                """,
                name, url, region, language, political_orientation,
                source_type, reliability_score, route_config_id, True
            )

            logger.debug(f"Inserted source: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to insert source {source.get('name')}: {e}")
            return False

    async def clear_existing_sources(self):
        """Clear all existing RSS feed sources (use with caution)"""
        try:
            count = await self.conn.fetchval(
                "SELECT COUNT(*) FROM rss_feed_sources"
            )
            logger.warning(f"Clearing {count} existing RSS feed sources...")

            await self.conn.execute("DELETE FROM rss_feed_sources")
            logger.info("Cleared all existing RSS feed sources")

        except Exception as e:
            logger.error(f"Failed to clear existing sources: {e}")
            raise

    async def load_sources(
        self,
        dry_run: bool = False,
        clear_existing: bool = False
    ):
        """
        Main method to load all RSS sources from YAML to database

        Args:
            dry_run: If True, only show what would be loaded
            clear_existing: If True, clear existing sources first
        """
        try:
            # Load YAML configuration
            config = self.load_yaml_config()
            sources = config.get('sources', [])

            if not sources:
                logger.warning("No sources found in configuration file")
                return

            # Connect to database
            await self.connect()

            # Clear existing if requested
            if clear_existing and not dry_run:
                confirm = input(
                    "⚠️  This will DELETE all existing RSS sources. "
                    "Type 'yes' to confirm: "
                )
                if confirm.lower() == 'yes':
                    await self.clear_existing_sources()
                else:
                    logger.info("Clearing cancelled by user")
                    return

            # Insert sources
            logger.info(f"Loading {len(sources)} RSS sources...")
            success_count = 0
            failure_count = 0

            for i, source in enumerate(sources, 1):
                if await self.insert_source(source, dry_run):
                    success_count += 1
                else:
                    failure_count += 1

                if i % 50 == 0:
                    logger.info(f"Progress: {i}/{len(sources)} sources processed")

            # Summary
            logger.info(
                f"\n{'DRY RUN ' if dry_run else ''}Summary:\n"
                f"  Total sources: {len(sources)}\n"
                f"  Successfully loaded: {success_count}\n"
                f"  Failed: {failure_count}"
            )

            if not dry_run:
                # Refresh statistics materialized view
                logger.info("Refreshing source statistics...")
                await self.conn.execute("SELECT refresh_rss_source_statistics()")

                # Show statistics
                stats = await self.conn.fetch(
                    """
                    SELECT region, COUNT(*) as count,
                           AVG(reliability_score) as avg_reliability
                    FROM rss_feed_sources
                    WHERE is_active = true
                    GROUP BY region
                    ORDER BY count DESC
                    """
                )

                logger.info("\nSource Distribution by Region:")
                for stat in stats:
                    logger.info(
                        f"  {stat['region']:15} {stat['count']:4} sources "
                        f"(avg reliability: {stat['avg_reliability']:.2f})"
                    )

        except Exception as e:
            logger.error(f"Failed to load sources: {e}")
            raise
        finally:
            await self.close()


def get_database_url() -> str:
    """Get database connection URL from environment or default"""
    # Try to load from .env file if it exists
    env_file = Path(__file__).parent.parent / '.env'
    if env_file.exists():
        try:
            with open(env_file, 'r') as f:
                for line in f:
                    if line.startswith('DATABASE_URL='):
                        return line.split('=', 1)[1].strip()
        except Exception as e:
            logger.warning(f"Failed to read .env file: {e}")

    # Get from environment variable
    db_url = os.getenv('DATABASE_URL')
    if db_url:
        return db_url

    # If no DATABASE_URL found, require it explicitly
    logger.error(
        "DATABASE_URL not set in environment or .env file. "
        "Please set it securely before running this script."
    )
    logger.error("Example: export DATABASE_URL='postgresql://user:password@localhost:5432/forecastin'")
    sys.exit(1)


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Load RSS sources from YAML configuration to database'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be loaded without actually loading'
    )
    parser.add_argument(
        '--clear-existing',
        action='store_true',
        help='Clear existing sources before loading (CAUTION: destructive)'
    )
    parser.add_argument(
        '--config-file',
        default='api/config/rss_sources.yaml',
        help='Path to RSS sources YAML file'
    )

    args = parser.parse_args()

    # Get database URL
    db_url = get_database_url()

    # Create loader and run
    loader = RSSSourceLoader(args.config_file, db_url)

    try:
        await loader.load_sources(
            dry_run=args.dry_run,
            clear_existing=args.clear_existing
        )
    except Exception as e:
        logger.error(f"Error during load: {e}")
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
