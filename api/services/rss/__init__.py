"""
RSS Ingestion Service Module

Main module for RSS feed ingestion with RSSHub-inspired patterns:
- Four-tier caching strategy
- 5-W entity extraction framework
- WebSocket real-time notifications
- Anti-crawler strategies
- Deduplication with 0.8 similarity threshold

Following AGENTS.md patterns for performance and reliability.
"""

from .rss_ingestion_service import RSSIngestionConfig, RSSIngestionService

__all__ = [
    "RSSIngestionService",
    "RSSIngestionConfig",
]
