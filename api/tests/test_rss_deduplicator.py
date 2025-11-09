"""
Tests for RSSDeduplicator

Tests cover:
- CRITICAL: 0.8 similarity threshold validation
- Article deduplication with canonical key assignment
- Entity deduplication across multiple articles
- Audit trail logging for all deduplication operations
- Thread-safe operations with RLock
- Similarity calculation algorithms
- Content hash-based exact duplicate detection
- Confidence-based entity merging
"""

import asyncio
from unittest.mock import AsyncMock

import pytest

from services.rss.deduplication.deduplicator import (
    DeduplicationAuditEntry,
    RSSDeduplicator,
)


class MockArticle:
    """Mock RSS article for testing"""
    def __init__(self, id: str, content: str):
        self.id = id
        self.content = content


class MockEntity:
    """Mock RSS entity for testing"""
    def __init__(self, id: str, text: str, entity_type: str, confidence: float = 0.8, canonical_key: str = None):
        self.id = id
        self.text = text
        self.entity_type = entity_type
        self.confidence = confidence
        self.canonical_key = canonical_key


class TestDeduplicationAuditEntry:
    """Test DeduplicationAuditEntry dataclass"""

    def test_audit_entry_initialization(self):
        """Test audit entry initialization"""
        # Act
        entry = DeduplicationAuditEntry(
            event_type="deduplication",
            duplicate_article_id="article_1",
            canonical_article_id="article_2",
            similarity_score=0.85,
            threshold_used=0.8,
            timestamp="2024-01-01T12:00:00"
        )

        # Assert
        assert entry.event_type == "deduplication"
        assert entry.duplicate_article_id == "article_1"
        assert entry.canonical_article_id == "article_2"
        assert entry.similarity_score == 0.85
        assert entry.threshold_used == 0.8


class TestRSSDeduplicator:
    """Test RSSDeduplicator functionality"""

    @pytest.fixture
    def deduplicator(self):
        """Create RSSDeduplicator instance"""
        return RSSDeduplicator()

    @pytest.fixture
    def mock_cache_service(self):
        """Create mock cache service"""
        cache = AsyncMock()
        cache.set = AsyncMock()
        return cache

    @pytest.fixture
    def deduplicator_with_cache(self, mock_cache_service):
        """Create RSSDeduplicator with cache service"""
        return RSSDeduplicator(cache_service=mock_cache_service)

    def test_initialization(self, deduplicator):
        """Test deduplicator initialization"""
        # Assert
        assert deduplicator.SIMILARITY_THRESHOLD == 0.8  # CRITICAL threshold
        assert len(deduplicator.audit_trail) == 0
        assert deduplicator._lock is not None

    def test_critical_similarity_threshold_is_08(self, deduplicator):
        """CRITICAL: Test that similarity threshold is exactly 0.8"""
        # Assert - This is a critical requirement from AGENTS.md
        assert deduplicator.SIMILARITY_THRESHOLD == 0.8

    async def test_deduplicate_empty_list(self, deduplicator):
        """Test deduplication with empty article list"""
        # Act
        result = await deduplicator.deduplicate_articles([])

        # Assert
        assert result == []

    async def test_deduplicate_single_article(self, deduplicator):
        """Test deduplication with single article"""
        # Arrange
        article = MockArticle("1", "This is a test article")

        # Act
        result = await deduplicator.deduplicate_articles([article])

        # Assert
        assert len(result) == 1
        assert result[0].id == "1"

    async def test_deduplicate_exact_duplicates(self, deduplicator):
        """Test deduplication of exact duplicate articles"""
        # Arrange
        articles = [
            MockArticle("1", "Exact same content"),
            MockArticle("2", "Exact same content"),
            MockArticle("3", "Different content")
        ]

        # Act
        result = await deduplicator.deduplicate_articles(articles)

        # Assert
        assert len(result) == 2  # One duplicate removed
        ids = [a.id for a in result]
        assert "1" in ids
        assert "3" in ids

    async def test_deduplicate_similar_articles_above_threshold(self, deduplicator):
        """Test deduplication of similar articles above 0.8 threshold"""
        # Arrange - Articles with high similarity (>0.8)
        articles = [
            MockArticle("1", "The quick brown fox jumps over the lazy dog"),
            MockArticle("2", "The quick brown fox jumps over the lazy cat"),  # Very similar
            MockArticle("3", "Completely different content about politics")
        ]

        # Act
        result = await deduplicator.deduplicate_articles(articles)

        # Assert
        assert len(result) == 2  # Should merge similar ones
        assert len(deduplicator.audit_trail) > 0  # Should log deduplication

    async def test_deduplicate_similar_articles_below_threshold(self, deduplicator):
        """Test that articles below 0.8 threshold are NOT deduplicated"""
        # Arrange - Articles with moderate similarity (<0.8)
        articles = [
            MockArticle("1", "The weather is sunny today"),
            MockArticle("2", "Today it is raining heavily"),
            MockArticle("3", "A completely unrelated topic about technology")
        ]

        # Act
        result = await deduplicator.deduplicate_articles(articles)

        # Assert - All should remain (similarity < 0.8)
        assert len(result) == 3

    async def test_deduplicate_articles_logs_to_audit_trail(self, deduplicator):
        """CRITICAL: Test that deduplication logs to audit trail"""
        # Arrange
        articles = [
            MockArticle("1", "This is a test article about geopolitics"),
            MockArticle("2", "This is a test article about geopolitics")  # Exact duplicate
        ]

        # Act
        await deduplicator.deduplicate_articles(articles)

        # Assert
        assert len(deduplicator.audit_trail) >= 1
        entry = deduplicator.audit_trail[0]
        assert entry.event_type == "deduplication"
        assert entry.threshold_used == 0.8

    async def test_similarity_calculation_identical_content(self, deduplicator):
        """Test similarity calculation with identical content"""
        # Act
        similarity = await deduplicator._calculate_similarity(
            "Same content",
            "Same content"
        )

        # Assert
        assert similarity == 1.0

    async def test_similarity_calculation_empty_content(self, deduplicator):
        """Test similarity calculation with empty content"""
        # Act
        similarity = await deduplicator._calculate_similarity("", "")

        # Assert
        assert similarity == 1.0  # Both empty considered identical

    async def test_similarity_calculation_one_empty(self, deduplicator):
        """Test similarity calculation with one empty string"""
        # Act
        similarity = await deduplicator._calculate_similarity("content", "")

        # Assert
        assert similarity == 0.0

    async def test_similarity_calculation_high_similarity(self, deduplicator):
        """Test similarity calculation with high similarity content"""
        # Arrange
        content1 = "The United States and China are discussing trade agreements"
        content2 = "The United States and China are negotiating trade agreements"

        # Act
        similarity = await deduplicator._calculate_similarity(content1, content2)

        # Assert
        assert similarity > 0.7  # Should be high similarity

    async def test_similarity_calculation_low_similarity(self, deduplicator):
        """Test similarity calculation with low similarity content"""
        # Arrange
        content1 = "The weather is sunny today"
        content2 = "Technology innovations in artificial intelligence"

        # Act
        similarity = await deduplicator._calculate_similarity(content1, content2)

        # Assert
        assert similarity < 0.3  # Should be low similarity

    async def test_threshold_boundary_exactly_08(self, deduplicator):
        """Test behavior at exact 0.8 threshold boundary"""
        # This test uses mocking to force exact 0.8 similarity
        # Arrange
        articles = [
            MockArticle("1", "content one"),
            MockArticle("2", "content two")
        ]

        # Mock the similarity calculation to return exactly 0.8
        original_calc = deduplicator._calculate_similarity
        async def mock_calc(c1, c2):
            if c1 != c2:  # Not identical
                return 0.8
            return 1.0

        deduplicator._calculate_similarity = mock_calc

        # Act
        result = await deduplicator.deduplicate_articles(articles)

        # Assert - At exactly 0.8, should deduplicate
        assert len(result) == 1
        assert len(deduplicator.audit_trail) >= 1

        # Restore original method
        deduplicator._calculate_similarity = original_calc

    async def test_threshold_boundary_just_below_08(self, deduplicator):
        """Test behavior just below 0.8 threshold"""
        # Arrange
        articles = [
            MockArticle("1", "content one"),
            MockArticle("2", "content two")
        ]

        # Mock to return 0.79
        async def mock_calc(c1, c2):
            if c1 != c2:
                return 0.79
            return 1.0

        deduplicator._calculate_similarity = mock_calc

        # Act
        result = await deduplicator.deduplicate_articles(articles)

        # Assert - Below 0.8, should NOT deduplicate
        assert len(result) == 2
        assert len(deduplicator.audit_trail) == 0

    async def test_deduplicate_entities_empty_list(self, deduplicator):
        """Test entity deduplication with empty list"""
        # Act
        result = await deduplicator.deduplicate_entities([])

        # Assert
        assert result == []

    async def test_deduplicate_entities_with_same_canonical_key(self, deduplicator):
        """Test entity deduplication with same canonical key"""
        # Arrange
        entities = [
            MockEntity("1", "United States", "location", 0.9, "location_usa"),
            MockEntity("2", "United States", "location", 0.8, "location_usa"),
            MockEntity("3", "China", "location", 0.9, "location_china")
        ]

        # Act
        result = await deduplicator.deduplicate_entities(entities)

        # Assert
        assert len(result) == 2  # Should merge entities with same canonical key
        # Should keep the one with higher confidence
        usa_entity = [e for e in result if e.canonical_key == "location_usa"][0]
        assert usa_entity.confidence == 0.9

    async def test_deduplicate_entities_generates_canonical_key(self, deduplicator):
        """Test that canonical keys are generated if missing"""
        # Arrange
        entities = [
            MockEntity("1", "Test Entity", "person", 0.9, None)
        ]

        # Act
        result = await deduplicator.deduplicate_entities(entities)

        # Assert
        assert len(result) == 1
        # Canonical key should be set (generated using hash)

    async def test_deduplicate_entities_keeps_higher_confidence(self, deduplicator):
        """Test that entity deduplication keeps higher confidence version"""
        # Arrange
        entities = [
            MockEntity("1", "Person A", "person", 0.7, "person_a"),
            MockEntity("2", "Person A", "person", 0.95, "person_a"),
            MockEntity("3", "Person A", "person", 0.8, "person_a")
        ]

        # Act
        result = await deduplicator.deduplicate_entities(entities)

        # Assert
        assert len(result) == 1
        assert result[0].confidence == 0.95
        assert len(deduplicator.audit_trail) >= 1  # Should log merges

    async def test_log_deduplication_creates_audit_entry(self, deduplicator):
        """Test that logging creates proper audit entry"""
        # Act
        await deduplicator._log_deduplication("dup_1", "canonical_1", 0.85)

        # Assert
        assert len(deduplicator.audit_trail) == 1
        entry = deduplicator.audit_trail[0]
        assert entry.duplicate_article_id == "dup_1"
        assert entry.canonical_article_id == "canonical_1"
        assert entry.similarity_score == 0.85
        assert entry.threshold_used == 0.8

    async def test_log_deduplication_with_cache(self, deduplicator_with_cache, mock_cache_service):
        """Test that deduplication logging uses cache if available"""
        # Act
        await deduplicator_with_cache._log_deduplication("dup_1", "canonical_1", 0.85)

        # Assert
        mock_cache_service.set.assert_called_once()
        call_args = mock_cache_service.set.call_args
        assert "rss:dedup:audit:dup_1" in call_args[0]

    async def test_audit_trail_size_limit(self, deduplicator):
        """Test that audit trail is limited in size"""
        # Arrange - Add more than 1000 entries
        for i in range(1100):
            await deduplicator._log_deduplication(f"dup_{i}", "canonical", 0.85)

        # Assert - Should be trimmed to 500
        assert len(deduplicator.audit_trail) == 500

    def test_get_audit_trail(self, deduplicator):
        """Test getting audit trail"""
        # Arrange
        entry = DeduplicationAuditEntry(
            event_type="deduplication",
            duplicate_article_id="1",
            canonical_article_id="2",
            similarity_score=0.85,
            threshold_used=0.8,
            timestamp="2024-01-01T12:00:00"
        )
        deduplicator.audit_trail.append(entry)

        # Act
        trail = deduplicator.get_audit_trail()

        # Assert
        assert len(trail) == 1
        assert trail[0].duplicate_article_id == "1"

    def test_clear_audit_trail(self, deduplicator):
        """Test clearing audit trail"""
        # Arrange
        entry = DeduplicationAuditEntry(
            event_type="deduplication",
            duplicate_article_id="1",
            canonical_article_id="2",
            similarity_score=0.85,
            threshold_used=0.8,
            timestamp="2024-01-01T12:00:00"
        )
        deduplicator.audit_trail.append(entry)

        # Act
        deduplicator.clear_audit_trail()

        # Assert
        assert len(deduplicator.audit_trail) == 0

    async def test_get_deduplication_stats(self, deduplicator):
        """Test getting deduplication statistics"""
        # Arrange
        await deduplicator._log_deduplication("dup_1", "canonical_1", 0.85)
        await deduplicator._log_deduplication("dup_2", "canonical_2", 0.90)
        await deduplicator._log_entity_merge("entity_1", "entity_2")

        # Act
        stats = await deduplicator.get_deduplication_stats()

        # Assert
        assert stats["total_audit_entries"] == 3
        assert stats["deduplication_events"] == 2
        assert stats["entity_merges"] == 1
        assert stats["threshold_used"] == 0.8
        assert stats["average_similarity"] == 0.875  # (0.85 + 0.90) / 2

    async def test_thread_safety_concurrent_deduplication(self, deduplicator):
        """Test thread-safe deduplication operations"""
        # Arrange

        articles_set1 = [
            MockArticle("1", "Content A"),
            MockArticle("2", "Content B")
        ]
        articles_set2 = [
            MockArticle("3", "Content C"),
            MockArticle("4", "Content D")
        ]

        results = []

        async def dedupe_worker(articles):
            result = await deduplicator.deduplicate_articles(articles)
            results.append(result)

        # Act - Run concurrent deduplication
        loop = asyncio.get_event_loop()
        tasks = [
            loop.create_task(dedupe_worker(articles_set1)),
            loop.create_task(dedupe_worker(articles_set2))
        ]
        await asyncio.gather(*tasks)

        # Assert - Should complete without errors
        assert len(results) == 2

    async def test_log_entity_merge(self, deduplicator):
        """Test logging entity merge operations"""
        # Act
        await deduplicator._log_entity_merge("old_entity", "new_entity")

        # Assert
        assert len(deduplicator.audit_trail) == 1
        entry = deduplicator.audit_trail[0]
        assert entry.event_type == "entity_merge"
        assert entry.duplicate_article_id == "old_entity"
        assert entry.canonical_article_id == "new_entity"
        assert entry.similarity_score == 1.0

    async def test_confidence_scores_in_audit_trail(self, deduplicator):
        """Test that confidence scores are recorded in audit trail"""
        # Act
        await deduplicator._log_deduplication("dup_1", "canonical_1", 0.87)

        # Assert
        entry = deduplicator.audit_trail[0]
        assert "confidence_scores" in entry.__dict__
        assert entry.confidence_scores["similarity"] == 0.87
        assert entry.confidence_scores["threshold"] == 0.8
        assert entry.confidence_scores["exceeded_by"] == 0.07

    async def test_deduplication_preserves_first_article(self, deduplicator):
        """Test that deduplication keeps the first article in duplicates"""
        # Arrange
        articles = [
            MockArticle("first", "Same content here"),
            MockArticle("second", "Same content here"),
            MockArticle("third", "Same content here")
        ]

        # Act
        result = await deduplicator.deduplicate_articles(articles)

        # Assert
        assert len(result) == 1
        assert result[0].id == "first"  # Should keep first one
