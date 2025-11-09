"""
Anti-Crawler Manager with Exponential Backoff Strategies

Intelligent anti-crawler management for RSS ingestion:
- Exponential backoff retry strategies
- User agent rotation and customization
- Domain-specific delay tracking
- Intelligent failure recovery

Following AGENTS.md patterns for reliability and performance.
"""

import asyncio
import logging
import random
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class DomainStats:
    """Statistics for domain-specific crawling behavior"""

    success_count: int = 0
    failure_count: int = 0
    last_success: float = 0.0
    last_failure: float = 0.0
    current_delay: float = 2.0  # Starting delay in seconds
    consecutive_failures: int = 0


@dataclass
class UserAgent:
    """User agent configuration for crawling"""

    value: str
    description: str
    success_rate: float = 1.0
    last_used: float = 0.0


class AntiCrawlerManager:
    """
    Intelligent anti-crawler manager with exponential backoff

    This manager implements sophisticated anti-crawler strategies:
    - Domain-specific delay tracking
    - Exponential backoff based on failure history
    - User agent rotation to avoid detection
    - Intelligent recovery after successful requests
    """

    def __init__(self):
        # Domain-specific statistics
        self.domain_stats: Dict[str, DomainStats] = defaultdict(DomainStats)

        # User agent pool with rotation
        self.user_agents = self._initialize_user_agents()
        self.current_agent_index = 0

        # Configuration
        self.min_delay = 2.0  # Minimum delay between requests
        self.max_delay = 60.0  # Maximum delay (1 minute)
        self.base_delay = 2.0  # Base delay for new domains

        # Retry configuration
        self.max_consecutive_failures = 5
        self.backoff_factor = 2.0  # Exponential backoff factor

        logger.info("Anti-crawler manager initialized")

    def _initialize_user_agents(self) -> List[UserAgent]:
        """Initialize pool of user agents for rotation"""

        return [
            UserAgent(
                value="Mozilla/5.0 (compatible; Forecastin-Geopolitical-Bot/1.0; +https://forecastin.com/bot)",
                description="Forecastin official bot"
            ),
            UserAgent(
                value="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                description="Chrome on Linux"
            ),
            UserAgent(
                value="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                description="Chrome on Windows"
            ),
            UserAgent(
                value="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
                description="Safari on Mac"
            ),
            UserAgent(
                value="Forecastin-Research-Bot/1.0 (https://forecastin.com/research; research@forecastin.com)",
                description="Research bot variant"
            )
        ]

    async def apply_delay(self, domain: str, route_config: Optional[Dict] = None) -> None:
        """
        Apply intelligent delay based on domain history and route configuration

        Args:
            domain: Domain being crawled
            route_config: Optional route-specific configuration
        """
        stats = self.domain_stats[domain]

        # Calculate appropriate delay
        delay = self._calculate_delay(stats, route_config)

        # Apply jitter to avoid predictable patterns
        jittered_delay = self._apply_jitter(delay)

        logger.debug(f"Applying {jittered_delay:.2f}s delay for domain {domain} "
                    f"(base: {delay:.2f}s, failures: {stats.consecutive_failures})")

        await asyncio.sleep(jittered_delay)

    def _calculate_delay(self, stats: DomainStats, route_config: Optional[Dict]) -> float:
        """Calculate appropriate delay based on domain statistics"""

        # Start with base delay or route-specific delay
        if route_config and "anti_crawler" in route_config:
            base_delay = route_config["anti_crawler"].get("delay", {}).get("min", self.base_delay)
        else:
            base_delay = self.base_delay

        # Apply exponential backoff for consecutive failures
        if stats.consecutive_failures > 0:
            backoff_delay = base_delay * (self.backoff_factor ** stats.consecutive_failures)
            delay = min(backoff_delay, self.max_delay)
        else:
            # Gradual reduction after successes
            if stats.success_count > 0:
                # Reduce delay based on success rate
                success_ratio = stats.success_count / (stats.success_count + stats.failure_count)
                reduction_factor = 0.5 + (success_ratio * 0.5)  # 0.5 to 1.0
                delay = base_delay * reduction_factor
            else:
                delay = base_delay

        # Ensure delay is within bounds
        delay = max(self.min_delay, min(delay, self.max_delay))

        # Update domain statistics
        stats.current_delay = delay

        return delay

    def _apply_jitter(self, delay: float) -> float:
        """Apply random jitter to avoid predictable patterns"""
        jitter_range = delay * 0.2  # ±20% jitter
        jitter = random.uniform(-jitter_range, jitter_range)
        return max(self.min_delay, delay + jitter)

    async def rotate_user_agent(self, route_config: Optional[Dict] = None) -> str:
        """
        Rotate to next user agent in pool

        Args:
            route_config: Optional route configuration

        Returns:
            New user agent string
        """
        if route_config and "anti_crawler" in route_config:
            # Use route-specific user agent if configured
            custom_agent = route_config["anti_crawler"].get("user_agent")
            if custom_agent:
                return custom_agent

        # Rotate through user agent pool
        self.current_agent_index = (self.current_agent_index + 1) % len(self.user_agents)
        agent = self.user_agents[self.current_agent_index]
        agent.last_used = time.time()

        logger.debug(f"Rotated to user agent: {agent.description}")

        return agent.value

    def get_current_user_agent(self) -> str:
        """Get current user agent"""
        return self.user_agents[self.current_agent_index].value

    def record_success(self, domain: str) -> None:
        """Record successful request for a domain"""
        stats = self.domain_stats[domain]
        stats.success_count += 1
        stats.last_success = time.time()
        stats.consecutive_failures = 0

        # Gradually reduce delay after successes
        if stats.current_delay > self.min_delay:
            stats.current_delay = max(self.min_delay, stats.current_delay * 0.9)  # 10% reduction

        logger.debug(f"Recorded success for {domain} (successes: {stats.success_count})")

    def record_failure(self, domain: str, error: Optional[str] = None) -> None:
        """Record failed request for a domain"""
        stats = self.domain_stats[domain]
        stats.failure_count += 1
        stats.last_failure = time.time()
        stats.consecutive_failures += 1

        # Check if we should temporarily blacklist the domain
        if stats.consecutive_failures >= self.max_consecutive_failures:
            logger.warning(f"Domain {domain} has {stats.consecutive_failures} consecutive failures - considering temporary blacklist")

        error_msg = f" - {error}" if error else ""
        logger.debug(f"Recorded failure for {domain} (consecutive: {stats.consecutive_failures}{error_msg})")

    def should_blacklist(self, domain: str, duration: float = 3600) -> bool:
        """
        Check if a domain should be temporarily blacklisted

        Args:
            domain: Domain to check
            duration: Blacklist duration in seconds

        Returns:
            True if domain should be blacklisted
        """
        stats = self.domain_stats[domain]

        # Blacklist if too many consecutive failures
        if stats.consecutive_failures >= self.max_consecutive_failures:
            # Check if blacklist duration has passed
            if time.time() - stats.last_failure > duration:
                # Reset after blacklist duration
                stats.consecutive_failures = 0
                return False
            return True

        return False

    async def handle_rate_limit(self, domain: str, retry_after: Optional[int] = None) -> None:
        """
        Handle rate limiting response from a domain

        Args:
            domain: Domain that rate limited us
            retry_after: Optional Retry-After header value in seconds
        """
        if retry_after:
            # Use server-suggested delay
            delay = retry_after
            logger.warning(f"Rate limited by {domain}, waiting {delay}s (server-suggested)")
        else:
            # Apply aggressive backoff
            stats = self.domain_stats[domain]
            delay = stats.current_delay * self.backoff_factor * 2  # Extra aggressive
            delay = min(delay, self.max_delay)
            logger.warning(f"Rate limited by {domain}, waiting {delay:.2f}s (aggressive backoff)")

        await asyncio.sleep(delay)

        # Record this as a failure for backoff calculation
        self.record_failure(domain, "rate_limit")

    def get_domain_stats(self, domain: str) -> Optional[DomainStats]:
        """Get statistics for a specific domain"""
        return self.domain_stats.get(domain)

    def get_all_domain_stats(self) -> Dict[str, DomainStats]:
        """Get statistics for all domains"""
        return dict(self.domain_stats)

    def reset_domain_stats(self, domain: str) -> None:
        """Reset statistics for a domain"""
        if domain in self.domain_stats:
            self.domain_stats[domain] = DomainStats()
            logger.info(f"Reset statistics for domain {domain}")

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get anti-crawler performance metrics"""

        total_requests = 0
        total_successes = 0
        total_failures = 0
        domains_with_issues = 0

        for domain, stats in self.domain_stats.items():
            total_requests += stats.success_count + stats.failure_count
            total_successes += stats.success_count
            total_failures += stats.failure_count

            if stats.consecutive_failures > 0:
                domains_with_issues += 1

        success_rate = total_successes / total_requests if total_requests > 0 else 0.0

        return {
            "total_domains_monitored": len(self.domain_stats),
            "total_requests": total_requests,
            "successful_requests": total_successes,
            "failed_requests": total_failures,
            "success_rate": success_rate,
            "domains_with_issues": domains_with_issues,
            "current_user_agent": self.user_agents[self.current_agent_index].description,
            "user_agent_pool_size": len(self.user_agents)
        }

    async def health_check(self) -> Dict[str, Any]:
        """Perform anti-crawler health check"""

        metrics = self.get_performance_metrics()

        health_status = {
            "status": "healthy",
            "metrics": metrics,
            "issues": []
        }

        # Check for domains with excessive failures
        for domain, stats in self.domain_stats.items():
            if stats.consecutive_failures >= 3:  # Warning threshold
                health_status["issues"].append({
                    "domain": domain,
                    "issue": f"{stats.consecutive_failures} consecutive failures",
                    "severity": "warning" if stats.consecutive_failures < 5 else "error"
                })

        if health_status["issues"]:
            health_status["status"] = "degraded"

        return health_status


# Convenience functions for common anti-crawler patterns

async def create_anti_crawler_manager() -> AntiCrawlerManager:
    """Create and initialize anti-crawler manager"""
    manager = AntiCrawlerManager()
    logger.info("Anti-crawler manager created successfully")
    return manager


async def apply_intelligent_delay(domain: str, manager: AntiCrawlerManager,
                                 min_delay: float = 2.0, max_delay: float = 30.0) -> None:
    """
    Convenience function for applying intelligent delay

    Args:
        domain: Domain to apply delay for
        manager: Anti-crawler manager instance
        min_delay: Minimum delay in seconds
        max_delay: Maximum delay in seconds
    """
    # Create temporary route config if needed
    route_config = {
        "anti_crawler": {
            "delay": {
                "min": min_delay,
                "max": max_delay
            }
        }
    }

    await manager.apply_delay(domain, route_config)


class SmartRetryStrategy:
    """
    Smart retry strategy with exponential backoff and circuit breaker pattern
    """

    def __init__(self, max_retries: int = 3, base_delay: float = 1.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.retry_history = defaultdict(list)

    async def execute_with_retry(self, coro, domain: str, description: str = "operation"):
        """
        Execute coroutine with smart retry logic

        Args:
            coro: Coroutine to execute
            domain: Domain for tracking
            description: Description for logging

        Returns:
            Coroutine result

        Raises:
            Exception: If all retries fail
        """
        last_exception = None

        for attempt in range(self.max_retries):
            try:
                result = await coro

                # Record success
                self.retry_history[domain].append({
                    "attempt": attempt + 1,
                    "success": True,
                    "timestamp": time.time(),
                    "description": description
                })

                return result

            except Exception as e:
                last_exception = e

                # Record failure
                self.retry_history[domain].append({
                    "attempt": attempt + 1,
                    "success": False,
                    "error": str(e),
                    "timestamp": time.time(),
                    "description": description
                })

                if attempt == self.max_retries - 1:
                    break

                # Exponential backoff
                delay = self.base_delay * (2 ** attempt)
                logger.warning(f"Retry attempt {attempt + 1} failed for {description} on {domain}, "
                              f"waiting {delay:.2f}s: {e}")

                await asyncio.sleep(delay)

        # All attempts failed
        logger.error(f"All {self.max_retries} retry attempts failed for {description} on {domain}")
        raise last_exception
