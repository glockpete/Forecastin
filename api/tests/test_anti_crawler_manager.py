"""
Tests for AntiCrawlerManager

Tests cover:
- Exponential backoff strategies based on failure history
- Domain-specific delay tracking
- User agent rotation and customization
- Intelligent failure recovery
- Success/failure recording and statistics
- Rate limit handling with Retry-After
- Domain blacklisting logic
- Jitter application to avoid patterns
- Performance metrics and health checks
"""

import asyncio
import time

import pytest

from services.rss.anti_crawler.manager import (
    AntiCrawlerManager,
    DomainStats,
    SmartRetryStrategy,
    UserAgent,
    apply_intelligent_delay,
    create_anti_crawler_manager,
)


class TestDomainStats:
    """Test DomainStats dataclass"""

    def test_domain_stats_initialization(self):
        """Test domain stats initialization with defaults"""
        # Act
        stats = DomainStats()

        # Assert
        assert stats.success_count == 0
        assert stats.failure_count == 0
        assert stats.current_delay == 2.0
        assert stats.consecutive_failures == 0

    def test_domain_stats_custom_values(self):
        """Test domain stats with custom values"""
        # Act
        stats = DomainStats(
            success_count=10,
            failure_count=2,
            current_delay=5.0,
            consecutive_failures=1
        )

        # Assert
        assert stats.success_count == 10
        assert stats.failure_count == 2
        assert stats.current_delay == 5.0
        assert stats.consecutive_failures == 1


class TestUserAgent:
    """Test UserAgent dataclass"""

    def test_user_agent_initialization(self):
        """Test user agent initialization"""
        # Act
        agent = UserAgent(
            value="Mozilla/5.0 Test",
            description="Test agent"
        )

        # Assert
        assert agent.value == "Mozilla/5.0 Test"
        assert agent.description == "Test agent"
        assert agent.success_rate == 1.0
        assert agent.last_used == 0.0


class TestAntiCrawlerManager:
    """Test AntiCrawlerManager functionality"""

    @pytest.fixture
    def manager(self):
        """Create AntiCrawlerManager instance"""
        return AntiCrawlerManager()

    def test_initialization(self, manager):
        """Test manager initialization"""
        # Assert
        assert manager.min_delay == 2.0
        assert manager.max_delay == 60.0
        assert manager.base_delay == 2.0
        assert manager.max_consecutive_failures == 5
        assert manager.backoff_factor == 2.0
        assert len(manager.user_agents) > 0

    def test_user_agent_pool_initialization(self, manager):
        """Test that user agent pool is properly initialized"""
        # Assert
        assert len(manager.user_agents) >= 3
        # Should have Forecastin bot
        assert any("Forecastin" in ua.value for ua in manager.user_agents)

    async def test_apply_delay_basic(self, manager):
        """Test basic delay application"""
        # Arrange
        domain = "example.com"
        start_time = time.time()

        # Act
        await manager.apply_delay(domain)
        elapsed = time.time() - start_time

        # Assert - Should delay at least min_delay
        assert elapsed >= manager.min_delay * 0.8  # Allow some variance

    async def test_calculate_delay_no_failures(self, manager):
        """Test delay calculation with no failures"""
        # Arrange
        stats = DomainStats(success_count=5, failure_count=0)

        # Act
        delay = manager._calculate_delay(stats, None)

        # Assert - Should use base delay or less
        assert delay >= manager.min_delay
        assert delay <= manager.base_delay

    async def test_calculate_delay_with_consecutive_failures(self, manager):
        """Test delay calculation with consecutive failures (exponential backoff)"""
        # Arrange
        stats = DomainStats(consecutive_failures=3)

        # Act
        delay = manager._calculate_delay(stats, None)

        # Assert - Should apply exponential backoff
        expected_delay = manager.base_delay * (manager.backoff_factor ** 3)
        assert delay >= expected_delay * 0.9  # Allow some variance
        assert delay <= manager.max_delay

    async def test_calculate_delay_respects_max_delay(self, manager):
        """Test that delay never exceeds max_delay"""
        # Arrange
        stats = DomainStats(consecutive_failures=10)  # Very high

        # Act
        delay = manager._calculate_delay(stats, None)

        # Assert
        assert delay <= manager.max_delay

    async def test_calculate_delay_with_route_config(self, manager):
        """Test delay calculation with route-specific config"""
        # Arrange
        stats = DomainStats()
        route_config = {
            "anti_crawler": {
                "delay": {
                    "min": 5.0
                }
            }
        }

        # Act
        delay = manager._calculate_delay(stats, route_config)

        # Assert - Should use route-specific delay
        assert delay >= 5.0

    async def test_apply_jitter(self, manager):
        """Test jitter application to delays"""
        # Arrange
        base_delay = 10.0

        # Act - Apply jitter multiple times
        jittered_delays = [manager._apply_jitter(base_delay) for _ in range(10)]

        # Assert - Jittered values should vary
        assert len(set(jittered_delays)) > 1  # Should have variation
        # All should be within ±20% of base
        for delay in jittered_delays:
            assert delay >= base_delay * 0.8 - 1
            assert delay <= base_delay * 1.2 + 1

    async def test_rotate_user_agent(self, manager):
        """Test user agent rotation"""
        # Arrange
        manager.get_current_user_agent()

        # Act
        new_agent = await manager.rotate_user_agent()

        # Assert - Should get different agent (after full rotation)
        assert new_agent is not None
        # After rotation, index should change
        assert manager.current_agent_index == 1

    async def test_rotate_user_agent_with_custom_config(self, manager):
        """Test user agent rotation with custom route config"""
        # Arrange
        custom_agent = "Custom-Bot/1.0"
        route_config = {
            "anti_crawler": {
                "user_agent": custom_agent
            }
        }

        # Act
        agent = await manager.rotate_user_agent(route_config)

        # Assert - Should use custom agent
        assert agent == custom_agent

    def test_get_current_user_agent(self, manager):
        """Test getting current user agent"""
        # Act
        agent = manager.get_current_user_agent()

        # Assert
        assert agent is not None
        assert isinstance(agent, str)
        assert len(agent) > 0

    def test_record_success(self, manager):
        """Test recording successful request"""
        # Arrange
        domain = "example.com"
        manager.domain_stats[domain] = DomainStats(consecutive_failures=3)

        # Act
        manager.record_success(domain)

        # Assert
        stats = manager.domain_stats[domain]
        assert stats.success_count == 1
        assert stats.consecutive_failures == 0
        assert stats.last_success > 0

    def test_record_success_reduces_delay(self, manager):
        """Test that successful requests gradually reduce delay"""
        # Arrange
        domain = "example.com"
        manager.domain_stats[domain] = DomainStats(current_delay=10.0)

        # Act
        manager.record_success(domain)

        # Assert - Delay should be reduced
        assert manager.domain_stats[domain].current_delay < 10.0

    def test_record_failure(self, manager):
        """Test recording failed request"""
        # Arrange
        domain = "example.com"

        # Act
        manager.record_failure(domain, "Connection timeout")

        # Assert
        stats = manager.domain_stats[domain]
        assert stats.failure_count == 1
        assert stats.consecutive_failures == 1
        assert stats.last_failure > 0

    def test_record_failure_increments_consecutive(self, manager):
        """Test that failures increment consecutive counter"""
        # Arrange
        domain = "example.com"

        # Act
        manager.record_failure(domain)
        manager.record_failure(domain)
        manager.record_failure(domain)

        # Assert
        assert manager.domain_stats[domain].consecutive_failures == 3

    def test_should_blacklist_with_many_failures(self, manager):
        """Test blacklist decision with many consecutive failures"""
        # Arrange
        domain = "example.com"
        manager.domain_stats[domain] = DomainStats(
            consecutive_failures=5,
            last_failure=time.time()
        )

        # Act
        should_blacklist = manager.should_blacklist(domain)

        # Assert
        assert should_blacklist is True

    def test_should_not_blacklist_with_few_failures(self, manager):
        """Test blacklist decision with few failures"""
        # Arrange
        domain = "example.com"
        manager.domain_stats[domain] = DomainStats(consecutive_failures=2)

        # Act
        should_blacklist = manager.should_blacklist(domain)

        # Assert
        assert should_blacklist is False

    def test_should_not_blacklist_after_duration(self, manager):
        """Test blacklist resets after duration"""
        # Arrange
        domain = "example.com"
        old_time = time.time() - 7200  # 2 hours ago
        manager.domain_stats[domain] = DomainStats(
            consecutive_failures=5,
            last_failure=old_time
        )

        # Act
        should_blacklist = manager.should_blacklist(domain, duration=3600)

        # Assert - Duration exceeded, should reset
        assert should_blacklist is False
        assert manager.domain_stats[domain].consecutive_failures == 0

    async def test_handle_rate_limit_with_retry_after(self, manager):
        """Test handling rate limit with Retry-After header"""
        # Arrange
        domain = "example.com"
        retry_after = 5  # seconds
        start_time = time.time()

        # Act
        await manager.handle_rate_limit(domain, retry_after)
        elapsed = time.time() - start_time

        # Assert - Should wait for retry_after duration
        assert elapsed >= retry_after * 0.9  # Allow small variance

    async def test_handle_rate_limit_without_retry_after(self, manager):
        """Test handling rate limit without Retry-After header"""
        # Arrange
        domain = "example.com"
        manager.domain_stats[domain] = DomainStats(current_delay=2.0)

        # Act
        start_time = time.time()
        await manager.handle_rate_limit(domain, None)
        elapsed = time.time() - start_time

        # Assert - Should apply aggressive backoff
        expected = 2.0 * manager.backoff_factor * 2
        assert elapsed >= expected * 0.8

    async def test_handle_rate_limit_records_failure(self, manager):
        """Test that rate limit handling records a failure"""
        # Arrange
        domain = "example.com"

        # Act
        await manager.handle_rate_limit(domain, 1)

        # Assert
        assert manager.domain_stats[domain].failure_count > 0

    def test_get_domain_stats(self, manager):
        """Test getting stats for specific domain"""
        # Arrange
        domain = "example.com"
        manager.record_success(domain)

        # Act
        stats = manager.get_domain_stats(domain)

        # Assert
        assert stats is not None
        assert stats.success_count == 1

    def test_get_all_domain_stats(self, manager):
        """Test getting all domain statistics"""
        # Arrange
        manager.record_success("example.com")
        manager.record_success("test.com")

        # Act
        all_stats = manager.get_all_domain_stats()

        # Assert
        assert len(all_stats) == 2
        assert "example.com" in all_stats
        assert "test.com" in all_stats

    def test_reset_domain_stats(self, manager):
        """Test resetting domain statistics"""
        # Arrange
        domain = "example.com"
        manager.record_failure(domain)
        manager.record_failure(domain)

        # Act
        manager.reset_domain_stats(domain)

        # Assert
        stats = manager.domain_stats[domain]
        assert stats.failure_count == 0
        assert stats.success_count == 0
        assert stats.consecutive_failures == 0

    def test_get_performance_metrics(self, manager):
        """Test getting performance metrics"""
        # Arrange
        manager.record_success("example.com")
        manager.record_success("test.com")
        manager.record_failure("failed.com")

        # Act
        metrics = manager.get_performance_metrics()

        # Assert
        assert "total_domains_monitored" in metrics
        assert metrics["total_domains_monitored"] == 3
        assert "total_requests" in metrics
        assert metrics["total_requests"] == 3
        assert "successful_requests" in metrics
        assert metrics["successful_requests"] == 2
        assert "failed_requests" in metrics
        assert metrics["failed_requests"] == 1
        assert "success_rate" in metrics
        assert abs(metrics["success_rate"] - 0.666) < 0.01

    async def test_health_check_healthy(self, manager):
        """Test health check with healthy state"""
        # Arrange
        manager.record_success("example.com")

        # Act
        health = await manager.health_check()

        # Assert
        assert health["status"] == "healthy"
        assert "metrics" in health
        assert "issues" in health

    async def test_health_check_degraded(self, manager):
        """Test health check with degraded state"""
        # Arrange - Create domain with failures
        domain = "problem.com"
        for _ in range(4):
            manager.record_failure(domain)

        # Act
        health = await manager.health_check()

        # Assert
        assert health["status"] == "degraded"
        assert len(health["issues"]) > 0

    def test_exponential_backoff_progression(self, manager):
        """Test exponential backoff progression with multiple failures"""
        # Arrange
        domain = "example.com"
        delays = []

        # Act - Record failures and track delays
        for i in range(5):
            manager.record_failure(domain)
            stats = manager.domain_stats[domain]
            delay = manager._calculate_delay(stats, None)
            delays.append(delay)

        # Assert - Delays should increase exponentially
        for i in range(1, len(delays)):
            # Each delay should be larger than previous (allowing for cap at max)
            assert delays[i] >= delays[i-1] or delays[i] == manager.max_delay

    async def test_concurrent_domain_access(self, manager):
        """Test concurrent access to different domains"""
        # Arrange
        domains = ["domain1.com", "domain2.com", "domain3.com"]

        async def access_domain(domain):
            manager.record_success(domain)
            await manager.apply_delay(domain)
            return domain

        # Act - Access multiple domains concurrently
        tasks = [access_domain(d) for d in domains]
        results = await asyncio.gather(*tasks)

        # Assert
        assert len(results) == 3
        assert all(manager.domain_stats[d].success_count == 1 for d in domains)


class TestSmartRetryStrategy:
    """Test SmartRetryStrategy functionality"""

    @pytest.fixture
    def retry_strategy(self):
        """Create SmartRetryStrategy instance"""
        return SmartRetryStrategy(max_retries=3, base_delay=0.1)

    async def test_execute_with_retry_success_first_try(self, retry_strategy):
        """Test successful execution on first try"""
        # Arrange
        async def successful_operation():
            return "success"

        # Act
        result = await retry_strategy.execute_with_retry(
            successful_operation(),
            "example.com",
            "test operation"
        )

        # Assert
        assert result == "success"
        assert len(retry_strategy.retry_history["example.com"]) == 1

    async def test_execute_with_retry_success_after_failures(self, retry_strategy):
        """Test successful execution after some failures"""
        # Arrange
        attempt_count = 0

        async def flaky_operation():
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 2:
                raise Exception("Temporary failure")
            return "success"

        # Act
        result = await retry_strategy.execute_with_retry(
            flaky_operation(),
            "example.com",
            "flaky operation"
        )

        # Assert
        assert result == "success"
        assert attempt_count == 2

    async def test_execute_with_retry_all_failures(self, retry_strategy):
        """Test execution with all retries failing"""
        # Arrange
        async def failing_operation():
            raise Exception("Persistent failure")

        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            await retry_strategy.execute_with_retry(
                failing_operation(),
                "example.com",
                "failing operation"
            )

        assert "Persistent failure" in str(exc_info.value)

    async def test_retry_history_tracking(self, retry_strategy):
        """Test that retry history is properly tracked"""
        # Arrange
        attempt_count = 0

        async def operation():
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 3:
                raise Exception(f"Attempt {attempt_count} failed")
            return "success"

        # Act
        await retry_strategy.execute_with_retry(
            operation(),
            "example.com",
            "test operation"
        )

        # Assert
        history = retry_strategy.retry_history["example.com"]
        assert len(history) == 3  # 2 failures + 1 success
        assert history[-1]["success"] is True
        assert history[0]["success"] is False


class TestConvenienceFunctions:
    """Test convenience functions"""

    async def test_create_anti_crawler_manager(self):
        """Test creating manager via convenience function"""
        # Act
        manager = await create_anti_crawler_manager()

        # Assert
        assert isinstance(manager, AntiCrawlerManager)
        assert len(manager.user_agents) > 0

    async def test_apply_intelligent_delay(self):
        """Test applying intelligent delay via convenience function"""
        # Arrange
        manager = AntiCrawlerManager()
        start_time = time.time()

        # Act
        await apply_intelligent_delay("example.com", manager, min_delay=0.5, max_delay=10.0)
        elapsed = time.time() - start_time

        # Assert
        assert elapsed >= 0.4  # Allow small variance


class TestIntegrationScenarios:
    """Test realistic integration scenarios"""

    @pytest.fixture
    def manager(self):
        """Create manager for integration tests"""
        return AntiCrawlerManager()

    async def test_domain_recovery_after_failures(self, manager):
        """Test that domain recovers after successful requests"""
        # Arrange
        domain = "recovery.com"

        # Simulate failures
        for _ in range(3):
            manager.record_failure(domain)

        initial_delay = manager.domain_stats[domain].current_delay

        # Act - Now have successes
        for _ in range(5):
            manager.record_success(domain)

        final_delay = manager.domain_stats[domain].current_delay

        # Assert
        assert manager.domain_stats[domain].consecutive_failures == 0
        assert final_delay < initial_delay  # Delay should reduce

    async def test_multiple_domains_independent_tracking(self, manager):
        """Test that different domains are tracked independently"""
        # Arrange
        domain1 = "stable.com"
        domain2 = "unstable.com"

        # Act
        manager.record_success(domain1)
        manager.record_success(domain1)
        manager.record_failure(domain2)
        manager.record_failure(domain2)
        manager.record_failure(domain2)

        # Assert
        assert manager.domain_stats[domain1].consecutive_failures == 0
        assert manager.domain_stats[domain2].consecutive_failures == 3

    async def test_rate_limit_recovery_flow(self, manager):
        """Test complete flow of rate limiting and recovery"""
        # Arrange
        domain = "ratelimited.com"

        # Act - Hit rate limit
        await manager.handle_rate_limit(domain, retry_after=1)

        # Record recovery
        manager.record_success(domain)

        # Assert
        stats = manager.domain_stats[domain]
        assert stats.failure_count > 0  # Rate limit recorded as failure
        assert stats.success_count > 0  # But recovered
        assert stats.consecutive_failures == 0  # Reset on success
