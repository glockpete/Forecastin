"""
RSS Data Models - Canonical Definitions

This module provides the single source of truth for RSS-related data models.
All RSS components should import from this module to ensure type consistency.

Following AGENTS.md patterns:
- Pydantic BaseModel for automatic serialization (.model_dump())
- Type safety and validation
- Support for four-tier cache integration
- Compatible with WebSocket serialization (orjson)
"""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import uuid4
import hashlib


class RSSEntity(BaseModel):
    """
    RSS entity following 5-W framework with confidence scoring

    Entity types: who, what, where, when, why

    CRITICAL: Confidence scores are calibrated by rules, not just base model confidence
    - PersonEntity with title+organization gets higher score than name alone
    - Uses 0.8 similarity threshold for deduplication with canonical_key assignment
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    entity_type: str  # who, what, where, when, why
    text: str
    confidence: float = Field(ge=0.0, le=1.0)
    canonical_key: str
    article_id: str
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
    hierarchy_path: Optional[str] = None
    audit_trail: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator('entity_type')
    @classmethod
    def validate_entity_type(cls, v: str) -> str:
        """Validate that entity_type is one of 5-W types"""
        valid_types = {'who', 'what', 'where', 'when', 'why'}
        if v not in valid_types:
            raise ValueError(f"entity_type must be one of {valid_types}, got '{v}'")
        return v

    @field_validator('confidence')
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        """Ensure confidence is between 0.0 and 1.0"""
        if not 0.0 <= v <= 1.0:
            raise ValueError(f"confidence must be between 0.0 and 1.0, got {v}")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "entity_type": "who",
                "text": "President Biden",
                "confidence": 0.92,
                "canonical_key": "person:biden_joseph",
                "article_id": "article-123",
                "extracted_at": "2025-11-09T12:00:00",
                "hierarchy_path": None,
                "audit_trail": ["extracted", "confidence_calibrated"]
            }
        }


class RSSArticle(BaseModel):
    """
    RSS article with extracted content and metadata

    This is the canonical data structure for RSS articles across all components.

    Key features:
    - Automatic content hash generation for deduplication
    - Confidence scoring for content quality
    - Support for entity extraction (entities field)
    - Metadata for extensibility

    CRITICAL: Uses Pydantic BaseModel for .model_dump() serialization
    required by cache_service and WebSocket notifications
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    url: str
    title: str
    content: str
    published_at: datetime
    feed_source: str
    author: Optional[str] = None
    language: str = "en"
    content_hash: Optional[str] = None
    confidence_scores: Dict[str, float] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    entities: List[RSSEntity] = Field(default_factory=list)

    def model_post_init(self, __context: Any) -> None:
        """
        Post-initialization hook to generate content hash

        CRITICAL: This is Pydantic v2 approach (replaces __post_init__ from dataclass)
        """
        # Generate content hash for deduplication if not provided
        if self.content and not self.content_hash:
            self.content_hash = hashlib.sha256(self.content.encode()).hexdigest()

    @field_validator('url')
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Basic URL validation"""
        if not v.startswith(('http://', 'https://')):
            raise ValueError(f"URL must start with http:// or https://, got '{v}'")
        return v

    def add_entity(self, entity: RSSEntity) -> None:
        """
        Add an entity to this article

        Convenience method for entity extraction process
        """
        entity.article_id = self.id
        self.entities.append(entity)

    def get_overall_confidence(self) -> float:
        """
        Calculate overall confidence score

        Returns the 'overall' confidence score if available,
        otherwise calculates average of all confidence scores
        """
        if 'overall' in self.confidence_scores:
            return self.confidence_scores['overall']

        if self.confidence_scores:
            return sum(self.confidence_scores.values()) / len(self.confidence_scores)

        return 0.0

    class Config:
        json_schema_extra = {
            "example": {
                "id": "article-123",
                "url": "https://www.reuters.com/world/example",
                "title": "Breaking: Major Geopolitical Event",
                "content": "Article content here...",
                "published_at": "2025-11-09T12:00:00",
                "feed_source": "reuters_world",
                "author": "John Smith",
                "language": "en",
                "content_hash": "abc123...",
                "confidence_scores": {
                    "content_structure": 0.9,
                    "source_reliability": 0.95,
                    "overall": 0.92
                },
                "metadata": {
                    "route": "geopolitical_news",
                    "extraction_time_ms": 45
                },
                "entities": []
            }
        }


class ExtractionResult(BaseModel):
    """
    Result of CSS selector extraction with confidence

    Used by RSSRouteProcessor for tracking extraction quality
    """

    value: str
    selector_used: str
    confidence: float = Field(ge=0.0, le=1.0)
    fallback_used: bool = False

    class Config:
        json_schema_extra = {
            "example": {
                "value": "Breaking News Title",
                "selector_used": "h1.article-title",
                "confidence": 0.95,
                "fallback_used": False
            }
        }


class RSSIngestionJob(BaseModel):
    """
    RSS ingestion job tracking for batch processing

    Used to track progress of batch ingestion operations
    for WebSocket notifications and job status queries
    """

    job_id: str = Field(default_factory=lambda: str(uuid4()))
    feed_urls: List[str]
    status: str = "pending"  # pending, in_progress, completed, failed
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    total_feeds: int = 0
    successful_feeds: int = 0
    failed_feeds: int = 0
    total_articles: int = 0
    total_entities: int = 0
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate job status"""
        valid_statuses = {'pending', 'in_progress', 'completed', 'failed'}
        if v not in valid_statuses:
            raise ValueError(f"status must be one of {valid_statuses}, got '{v}'")
        return v

    def mark_completed(self) -> None:
        """Mark job as completed"""
        self.status = "completed"
        self.completed_at = datetime.utcnow()

    def mark_failed(self, error: str) -> None:
        """Mark job as failed with error message"""
        self.status = "failed"
        self.completed_at = datetime.utcnow()
        self.error_message = error

    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "job-123",
                "feed_urls": ["https://example.com/rss"],
                "status": "in_progress",
                "started_at": "2025-11-09T12:00:00",
                "total_feeds": 5,
                "successful_feeds": 3,
                "failed_feeds": 1,
                "total_articles": 47,
                "total_entities": 156
            }
        }


# Type aliases for clarity
RSSArticleList = List[RSSArticle]
RSSEntityList = List[RSSEntity]
