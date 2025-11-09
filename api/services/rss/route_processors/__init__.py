"""
RSS Route Processors Module

RSSHub-inspired route processing with CSS selector extraction.
"""

from .base_processor import (
    ExtractionResult,
    RSSArticle,
    RSSRouteProcessor,
    process_article_url,
)

__all__ = [
    "RSSRouteProcessor",
    "RSSArticle",
    "ExtractionResult",
    "process_article_url",
]
