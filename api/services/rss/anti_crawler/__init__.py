"""
Anti-Crawler Management Module

Intelligent anti-crawler strategies with exponential backoff.
"""

from .manager import AntiCrawlerManager, SmartRetryStrategy, create_anti_crawler_manager

__all__ = [
    "AntiCrawlerManager",
    "create_anti_crawler_manager",
    "SmartRetryStrategy",
]
