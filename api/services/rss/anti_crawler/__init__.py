"""
Anti-Crawler Management Module

Intelligent anti-crawler strategies with exponential backoff.
"""

from .manager import AntiCrawlerManager, create_anti_crawler_manager, SmartRetryStrategy

__all__ = [
    "AntiCrawlerManager",
    "create_anti_crawler_manager",
    "SmartRetryStrategy",
]
