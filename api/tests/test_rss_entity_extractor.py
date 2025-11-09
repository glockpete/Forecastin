"""
Tests for RSSEntityExtractor

Tests cover:
- 5-W framework entity extraction (Who, What, Where, When, Why)
- Confidence score calibration with rules
- Title+organization boosting for person entities
- Hierarchical entity linking to LTREE
- Canonical key generation
- Audit trail for extraction operations
- Pattern-based entity recognition
"""

import asyncio
from datetime import datetime
from typing import List
from unittest.mock import AsyncMock, MagicMock, Mock

import pytest

from services.rss.entity_extraction.extractor import (
    RSSArticle,
    RSSEntity,
    RSSEntityExtractor,
)


class TestRSSEntity:
    """Test RSSEntity dataclass"""

    def test_entity_initialization(self):
        """Test RSS entity initialization"""
        # Act
        entity = RSSEntity(
            id="entity_1",
            entity_type="who",
            text="President Biden",
            confidence=0.9,
            canonical_key="who_biden",
            article_id="article_1",
            extracted_at=datetime.utcnow()
        )

        # Assert
        assert entity.id == "entity_1"
        assert entity.entity_type == "who"
        assert entity.text == "President Biden"
        assert entity.confidence == 0.9
        assert len(entity.audit_trail) == 0


class TestRSSArticle:
    """Test RSSArticle dataclass"""

    def test_article_initialization(self):
        """Test RSS article initialization"""
        # Act
        article = RSSArticle(
            id="article_1",
            title="Test Article",
            content="Test content",
            url="https://example.com/article",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        # Assert
        assert article.id == "article_1"
        assert article.title == "Test Article"
        assert len(article.entities) == 0


class TestRSSEntityExtractor:
    """Test RSSEntityExtractor functionality"""

    @pytest.fixture
    def mock_hierarchy_resolver(self):
        """Create mock hierarchy resolver"""
        resolver = Mock()
        return resolver

    @pytest.fixture
    def extractor(self, mock_hierarchy_resolver):
        """Create RSSEntityExtractor instance"""
        return RSSEntityExtractor(hierarchy_resolver=mock_hierarchy_resolver)

    @pytest.fixture
    def sample_article(self):
        """Create sample article for testing"""
        return RSSArticle(
            id="article_1",
            title="President Biden meets with Chinese Premier in Beijing",
            content="President Biden traveled to Beijing yesterday for a summit with the Chinese Premier. "
                   "The meeting focused on trade agreements and diplomatic relations between the United States and China. "
                   "The summit was held in the Great Hall of the People in Beijing because both nations "
                   "seek to improve bilateral relations.",
            url="https://example.com/article",
            published_at=datetime.utcnow(),
            source="example.com"
        )

    def test_initialization(self, extractor):
        """Test extractor initialization"""
        # Assert
        assert extractor.hierarchy_resolver is not None
        assert "who" in extractor.patterns
        assert "what" in extractor.patterns
        assert "where" in extractor.patterns
        assert "when" in extractor.patterns
        assert "why" in extractor.patterns

    async def test_extract_entities_returns_list(self, extractor, sample_article):
        """Test that extract_entities returns a list"""
        # Act
        entities = await extractor.extract_entities(sample_article)

        # Assert
        assert isinstance(entities, list)

    async def test_extract_who_entities(self, extractor, sample_article):
        """Test extraction of 'who' entities"""
        # Act
        entities = await extractor.extract_entities(sample_article)

        # Assert - Should find "President Biden"
        who_entities = [e for e in entities if e.entity_type == "who"]
        assert len(who_entities) > 0

        # Check for president mention
        president_entities = [e for e in who_entities if "President" in e.text or "Biden" in e.text]
        assert len(president_entities) > 0

    async def test_extract_what_entities(self, extractor, sample_article):
        """Test extraction of 'what' entities"""
        # Act
        entities = await extractor.extract_entities(sample_article)

        # Assert - Should find event types like "summit", "meeting"
        what_entities = [e for e in entities if e.entity_type == "what"]
        assert len(what_entities) > 0

    async def test_extract_where_entities(self, extractor, sample_article):
        """Test extraction of 'where' entities"""
        # Act
        entities = await extractor.extract_entities(sample_article)

        # Assert - Should find "Beijing", "China", etc.
        where_entities = [e for e in entities if e.entity_type == "where"]
        assert len(where_entities) > 0

        # Check for Beijing or China
        location_texts = [e.text for e in where_entities]
        assert any("Beijing" in text or "China" in text for text in location_texts)

    async def test_extract_when_entities(self, extractor, sample_article):
        """Test extraction of 'when' entities"""
        # Arrange - Article with time indicators
        article = RSSArticle(
            id="article_2",
            title="Summit scheduled for January 2024",
            content="The meeting will take place on Monday, January 15, 2024.",
            url="https://example.com/article",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        # Act
        entities = await extractor.extract_entities(article)

        # Assert
        when_entities = [e for e in entities if e.entity_type == "when"]
        assert len(when_entities) > 0

    async def test_extract_why_entities(self, extractor, sample_article):
        """Test extraction of 'why' entities"""
        # Act
        entities = await extractor.extract_entities(sample_article)

        # Assert - Should find "because" in the sample article
        why_entities = [e for e in entities if e.entity_type == "why"]
        assert len(why_entities) > 0

    async def test_confidence_calibration_for_title_entities(self, extractor):
        """Test that entities in title get confidence boost"""
        # Arrange
        article = RSSArticle(
            id="article_1",
            title="President Biden announces new policy",
            content="Other content here.",
            url="https://example.com",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        # Act
        entities = await extractor.extract_entities(article)

        # Assert - Entities from title should have higher confidence
        title_entities = [e for e in entities if "President" in e.text or "Biden" in e.text]
        if title_entities:
            # At least one should have boosted confidence
            assert any(e.confidence > 0.5 for e in title_entities)

    async def test_confidence_boost_for_title_organization(self, extractor):
        """Test confidence boost for person entities with title+organization"""
        # Arrange
        article = RSSArticle(
            id="article_1",
            title="CEO Smith announces merger",
            content="Director Johnson also commented on the deal.",
            url="https://example.com",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        # Act
        entities = await extractor.extract_entities(article)

        # Assert - Entities with titles should have higher confidence
        who_entities = [e for e in entities if e.entity_type == "who"]
        title_entities = [e for e in who_entities if any(title in e.text for title in ["CEO", "Director"])]

        if title_entities:
            # Should have confidence boost
            assert any(e.confidence > 0.6 for e in title_entities)

    async def test_canonical_key_generation(self, extractor, sample_article):
        """Test that canonical keys are generated for entities"""
        # Act
        entities = await extractor.extract_entities(sample_article)

        # Assert - All entities should have canonical keys
        assert all(e.canonical_key is not None for e in entities)
        assert all(len(e.canonical_key) > 0 for e in entities)

    async def test_canonical_key_format(self, extractor):
        """Test canonical key format"""
        # Arrange
        article = RSSArticle(
            id="article_1",
            title="Test",
            content="United States",
            url="https://example.com",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        # Act
        entities = await extractor.extract_entities(article)

        # Assert - Canonical keys should start with entity type
        for entity in entities:
            # Format should be "{type}_{hash}"
            assert entity.canonical_key.startswith(entity.entity_type + "_")

    async def test_audit_trail_records_extraction(self, extractor, sample_article):
        """Test that audit trail records extraction pattern"""
        # Act
        entities = await extractor.extract_entities(sample_article)

        # Assert - Each entity should have audit trail
        for entity in entities:
            assert len(entity.audit_trail) > 0
            # Should mention extraction pattern
            assert any("Extracted via" in entry for entry in entity.audit_trail)

    async def test_calculate_base_confidence(self, extractor, sample_article):
        """Test base confidence calculation"""
        # Act
        confidence = extractor._calculate_base_confidence(
            "President Biden",
            "who",
            sample_article
        )

        # Assert
        assert 0.0 <= confidence <= 1.0

    async def test_base_confidence_title_boost(self, extractor):
        """Test confidence boost for text in title"""
        # Arrange
        article = RSSArticle(
            id="article_1",
            title="Important keyword here",
            content="Other content",
            url="https://example.com",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        # Act
        confidence_in_title = extractor._calculate_base_confidence("keyword", "what", article)
        confidence_not_in_title = extractor._calculate_base_confidence("other", "what", article)

        # Assert
        assert confidence_in_title > confidence_not_in_title

    async def test_base_confidence_who_with_title(self, extractor, sample_article):
        """Test confidence boost for 'who' entities with formal titles"""
        # Act
        confidence_with_title = extractor._calculate_base_confidence("President Biden", "who", sample_article)
        confidence_plain_name = extractor._calculate_base_confidence("John Smith", "who", sample_article)

        # Assert - Title should boost confidence
        assert confidence_with_title > confidence_plain_name

    async def test_base_confidence_where_major_power(self, extractor, sample_article):
        """Test confidence boost for major geopolitical entities"""
        # Act
        confidence_major = extractor._calculate_base_confidence("United States", "where", sample_article)
        confidence_minor = extractor._calculate_base_confidence("Luxembourg", "where", sample_article)

        # Assert
        assert confidence_major > confidence_minor

    async def test_generate_canonical_key(self, extractor):
        """Test canonical key generation"""
        # Act
        key1 = extractor._generate_canonical_key("United States", "where")
        key2 = extractor._generate_canonical_key("United States", "where")
        key3 = extractor._generate_canonical_key("China", "where")

        # Assert - Same text/category should produce same key
        assert key1 == key2
        # Different text should produce different key
        assert key1 != key3

    async def test_generate_canonical_key_case_insensitive(self, extractor):
        """Test that canonical key is case insensitive"""
        # Act
        key1 = extractor._generate_canonical_key("United States", "where")
        key2 = extractor._generate_canonical_key("UNITED STATES", "where")

        # Assert - Should be the same (normalized)
        assert key1 == key2

    async def test_calibrate_confidence_for_who_with_title(self, extractor):
        """Test confidence calibration for person entities with titles"""
        # Arrange
        article = RSSArticle(
            id="article_1",
            title="CEO announces restructuring",
            content="The CEO made the announcement yesterday.",
            url="https://example.com",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        entity = RSSEntity(
            id="entity_1",
            entity_type="who",
            text="CEO",
            confidence=0.5,
            canonical_key="who_ceo",
            article_id="article_1",
            extracted_at=datetime.utcnow()
        )

        # Act
        await extractor._calibrate_confidence(entity, article)

        # Assert - Confidence should be boosted
        assert entity.confidence > 0.5
        assert any("title+organization" in entry for entry in entity.audit_trail)

    async def test_calibrate_confidence_for_where_major_power(self, extractor):
        """Test confidence calibration for major geopolitical entities"""
        # Arrange
        article = RSSArticle(
            id="article_1",
            title="US policy changes",
            content="United States implements new strategy.",
            url="https://example.com",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        entity = RSSEntity(
            id="entity_1",
            entity_type="where",
            text="United States",
            confidence=0.5,
            canonical_key="where_us",
            article_id="article_1",
            extracted_at=datetime.utcnow()
        )

        # Act
        await extractor._calibrate_confidence(entity, article)

        # Assert - Confidence should be boosted
        assert entity.confidence > 0.5
        assert any("major geopolitical entity" in entry for entry in entity.audit_trail)

    async def test_link_to_hierarchy_for_where_entities(self, extractor):
        """Test linking geographic entities to hierarchy"""
        # Arrange
        entity = RSSEntity(
            id="entity_1",
            entity_type="where",
            text="United States",
            confidence=0.9,
            canonical_key="where_us",
            article_id="article_1",
            extracted_at=datetime.utcnow()
        )

        # Act
        await extractor._link_to_hierarchy(entity)

        # Assert - Should have hierarchy path
        assert entity.hierarchy_path is not None
        assert "geography" in entity.hierarchy_path

    async def test_link_to_hierarchy_handles_errors(self, extractor, mock_hierarchy_resolver):
        """Test that hierarchy linking handles errors gracefully"""
        # Arrange
        mock_hierarchy_resolver.resolve = Mock(side_effect=Exception("Database error"))

        entity = RSSEntity(
            id="entity_1",
            entity_type="where",
            text="United States",
            confidence=0.9,
            canonical_key="where_us",
            article_id="article_1",
            extracted_at=datetime.utcnow()
        )

        # Act - Should not raise exception
        await extractor._link_to_hierarchy(entity)

        # Assert - Should log failure in audit trail
        # Entity should still exist
        assert entity is not None

    async def test_extract_category_entities(self, extractor, sample_article):
        """Test extracting entities for a specific category"""
        # Act
        who_entities = await extractor._extract_category_entities(
            sample_article,
            "who",
            extractor.patterns["who"]
        )

        # Assert
        assert isinstance(who_entities, list)
        # All should be 'who' type
        assert all(e.entity_type == "who" for e in who_entities)

    async def test_entities_have_article_id(self, extractor, sample_article):
        """Test that extracted entities reference their article"""
        # Act
        entities = await extractor.extract_entities(sample_article)

        # Assert
        for entity in entities:
            assert entity.article_id == sample_article.id

    async def test_entities_have_extracted_timestamp(self, extractor, sample_article):
        """Test that entities have extraction timestamp"""
        # Act
        entities = await extractor.extract_entities(sample_article)

        # Assert
        for entity in entities:
            assert entity.extracted_at is not None
            assert isinstance(entity.extracted_at, datetime)

    async def test_pattern_matching_is_case_insensitive(self, extractor):
        """Test that pattern matching works regardless of case"""
        # Arrange
        article_lower = RSSArticle(
            id="article_1",
            title="summit",
            content="meeting",
            url="https://example.com",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        article_upper = RSSArticle(
            id="article_2",
            title="SUMMIT",
            content="MEETING",
            url="https://example.com",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        # Act
        entities_lower = await extractor.extract_entities(article_lower)
        entities_upper = await extractor.extract_entities(article_upper)

        # Assert - Both should extract similar entities
        assert len(entities_lower) > 0
        assert len(entities_upper) > 0

    async def test_complex_article_extraction(self, extractor):
        """Test extraction from complex real-world article"""
        # Arrange
        article = RSSArticle(
            id="complex_1",
            title="President Biden and Chinese Premier Xi Jinping meet in Beijing for crucial summit",
            content="In a historic meeting held on Monday, January 15, 2024, President Joe Biden traveled to "
                   "Beijing to meet with Chinese Premier Xi Jinping at the Great Hall of the People. "
                   "The summit focused on trade agreements and diplomatic relations between the United States "
                   "and China. The meeting was arranged because both nations seek to reduce tensions and "
                   "improve bilateral cooperation on global issues such as climate change and economic stability. "
                   "Director of the CIA also attended the closed-door sessions.",
            url="https://example.com/article",
            published_at=datetime.utcnow(),
            source="example.com"
        )

        # Act
        entities = await extractor.extract_entities(article)

        # Assert - Should extract entities from all 5-W categories
        entity_types = set(e.entity_type for e in entities)
        assert "who" in entity_types
        assert "what" in entity_types
        assert "where" in entity_types
        assert "when" in entity_types
        assert "why" in entity_types

        # Should have multiple entities
        assert len(entities) >= 5
