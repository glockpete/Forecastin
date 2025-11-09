"""
RSS Deduplicator with 0.8 Similarity Threshold

Implements deduplication system following AGENTS.md patterns:
- 0.8 similarity threshold with canonical key assignment
- Audit trail logging for all merges
- Thread-safe operations with RLock synchronization
"""

import hashlib
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from services.cache_service import CacheService

logger = logging.getLogger(__name__)


@dataclass
class DeduplicationAuditEntry:
    """Audit trail entry for deduplication operations"""
    event_type: str
    duplicate_article_id: str
    canonical_article_id: str
    similarity_score: float
    threshold_used: float
    timestamp: str
    confidence_scores: Dict[str, Any] = field(default_factory=dict)


class RSSDeduplicator:
    """
    Deduplication system with 0.8 similarity threshold for RSS content.

    Follows the rules from AGENTS.md:
    - Uses 0.8 similarity threshold for deduplication
    - Canonical key assignment with SHA-256 hashing
    - Audit trail logging for all deduplication operations
    - Thread-safe operations with RLock synchronization
    """

    # CRITICAL: 0.8 similarity threshold as specified in AGENTS.md
    SIMILARITY_THRESHOLD = 0.8

    def __init__(self, cache_service: Optional[CacheService] = None):
        self.cache_service = cache_service
        self._lock = threading.RLock()  # Thread-safe operations as specified
        self.audit_trail: List[DeduplicationAuditEntry] = []

    async def deduplicate_articles(self, articles: List[Any]) -> List[Any]:
        """
        Deduplicate RSS articles using 0.8 similarity threshold.

        Args:
            articles: List of RSS articles to deduplicate

        Returns:
            List of unique RSS articles
        """
        if not articles:
            return []

        with self._lock:
            unique_articles = []
            processed_hashes = set()

            for article in articles:
                # CRITICAL: Use content hash for exact duplicate detection
                content_hash = hashlib.sha256(
                    getattr(article, 'content', '').encode()
                ).hexdigest()

                if content_hash in processed_hashes:
                    logger.debug(f"Skipping exact duplicate article: {getattr(article, 'id', 'unknown')}")
                    continue  # Exact duplicate

                # Check similarity with existing articles (0.8 threshold)
                is_duplicate = False
                canonical_article = None

                for existing_article in unique_articles:
                    similarity = await self._calculate_similarity(
                        getattr(article, 'content', ''),
                        getattr(existing_article, 'content', '')
                    )

                    if similarity >= self.SIMILARITY_THRESHOLD:
                        is_duplicate = True
                        canonical_article = existing_article

                        # CRITICAL: Log to audit_trail as specified in AGENTS.md
                        await self._log_deduplication(
                            getattr(article, 'id', 'unknown'),
                            getattr(existing_article, 'id', 'unknown'),
                            similarity
                        )
                        break

                if not is_duplicate:
                    unique_articles.append(article)
                    processed_hashes.add(content_hash)
                else:
                    logger.debug(
                        f"Article {getattr(article, 'id', 'unknown')} deduplicated "
                        f"against {getattr(canonical_article, 'id', 'unknown')} "
                        f"(similarity: {similarity:.3f})"
                    )

            logger.info(f"Deduplication complete: {len(articles)} -> {len(unique_articles)} articles")
            return unique_articles

    async def deduplicate_entities(self, entities: List[Any]) -> List[Any]:
        """
        Deduplicate entities across multiple RSS articles using canonical keys.

        Args:
            entities: List of RSS entities to deduplicate

        Returns:
            List of unique RSS entities
        """
        if not entities:
            return []

        with self._lock:
            canonical_entities = {}

            for entity in entities:
                canonical_key = getattr(entity, 'canonical_key', None)
                if not canonical_key:
                    # Generate canonical key if not present
                    text = getattr(entity, 'text', '')
                    entity_type = getattr(entity, 'entity_type', 'unknown')
                    canonical_key = f"{entity_type}_{hashlib.sha256(text.encode()).hexdigest()}"
                    # Set the canonical key on the entity if possible
                    if hasattr(entity, 'canonical_key'):
                        entity.canonical_key = canonical_key

                if canonical_key in canonical_entities:
                    existing_entity = canonical_entities[canonical_key]

                    # Merge entities, keeping higher confidence version
                    existing_confidence = getattr(existing_entity, 'confidence', 0.0)
                    current_confidence = getattr(entity, 'confidence', 0.0)

                    if current_confidence > existing_confidence:
                        canonical_entities[canonical_key] = entity
                        logger.debug(
                            f"Entity {getattr(entity, 'id', 'unknown')} replaces "
                            f"{getattr(existing_entity, 'id', 'unknown')} (higher confidence)"
                        )

                        # Log entity merge
                        await self._log_entity_merge(
                            getattr(existing_entity, 'id', 'unknown'),
                            getattr(entity, 'id', 'unknown')
                        )
                else:
                    canonical_entities[canonical_key] = entity

            unique_entities = list(canonical_entities.values())
            logger.info(f"Entity deduplication complete: {len(entities)} -> {len(unique_entities)} entities")
            return unique_entities

    async def _calculate_similarity(self, content1: str, content2: str) -> float:
        """
        Calculate content similarity using a simple approach.

        For production, this would use TF-IDF or sentence embeddings.
        For this implementation, we'll use a basic approach based on:
        - Jaccard similarity of words
        - Length similarity
        - Common substring analysis

        Args:
            content1: First content string
            content2: Second content string

        Returns:
            Similarity score between 0.0 and 1.0
        """
        if not content1 or not content2:
            return 0.0

        if content1 == content2:
            return 1.0

        # Simple word-based Jaccard similarity
        words1 = set(content1.lower().split())
        words2 = set(content2.lower().split())

        if not words1 and not words2:
            return 1.0
        if not words1 or not words2:
            return 0.0

        intersection = words1.intersection(words2)
        union = words1.union(words2)

        jaccard_similarity = len(intersection) / len(union) if union else 0.0

        # Length similarity (penalize very different lengths)
        len1, len2 = len(content1), len(content2)
        length_similarity = 1.0 - abs(len1 - len2) / max(len1, len2, 1)

        # Combine metrics (weighted average)
        similarity = 0.7 * jaccard_similarity + 0.3 * length_similarity

        return min(max(similarity, 0.0), 1.0)

    async def _log_deduplication(self, duplicate_id: str, canonical_id: str, similarity: float):
        """
        CRITICAL: Audit trail logging as required by AGENTS.md.

        Args:
            duplicate_id: ID of the duplicate article
            canonical_id: ID of the canonical article
            similarity: Similarity score that triggered deduplication
        """
        audit_entry = DeduplicationAuditEntry(
            event_type="deduplication",
            duplicate_article_id=duplicate_id,
            canonical_article_id=canonical_id,
            similarity_score=similarity,
            threshold_used=self.SIMILARITY_THRESHOLD,
            timestamp=datetime.utcnow().isoformat(),
            confidence_scores={
                "similarity": similarity,
                "threshold": self.SIMILARITY_THRESHOLD,
                "exceeded_by": similarity - self.SIMILARITY_THRESHOLD
            }
        )

        with self._lock:
            self.audit_trail.append(audit_entry)

            # Limit audit trail size to prevent memory issues
            if len(self.audit_trail) > 1000:
                self.audit_trail = self.audit_trail[-500:]

        logger.debug(
            f"Deduplication logged: {duplicate_id} -> {canonical_id} "
            f"(similarity: {similarity:.3f}, threshold: {self.SIMILARITY_THRESHOLD})"
        )

        # Store in cache if available
        if self.cache_service:
            try:
                cache_key = f"rss:dedup:audit:{duplicate_id}"
                await self.cache_service.set(
                    cache_key,
                    {
                        "duplicate_id": duplicate_id,
                        "canonical_id": canonical_id,
                        "similarity": similarity,
                        "timestamp": audit_entry.timestamp
                    },
                    ttl=86400  # 24 hours
                )
            except Exception as e:
                logger.warning(f"Failed to cache deduplication audit entry: {e}")

    async def _log_entity_merge(self, old_id: str, new_id: str):
        """
        Log entity merge operations to audit trail.

        Args:
            old_id: ID of the entity being replaced
            new_id: ID of the entity replacing it
        """
        audit_entry = DeduplicationAuditEntry(
            event_type="entity_merge",
            duplicate_article_id=old_id,
            canonical_article_id=new_id,
            similarity_score=1.0,  # Entities with same canonical key are considered identical
            threshold_used=self.SIMILARITY_THRESHOLD,
            timestamp=datetime.utcnow().isoformat()
        )

        with self._lock:
            self.audit_trail.append(audit_entry)

            # Limit audit trail size
            if len(self.audit_trail) > 1000:
                self.audit_trail = self.audit_trail[-500:]

        logger.debug(f"Entity merge logged: {old_id} -> {new_id}")

    def get_audit_trail(self) -> List[DeduplicationAuditEntry]:
        """
        Get the complete audit trail of deduplication operations.

        Returns:
            List of audit trail entries
        """
        with self._lock:
            return self.audit_trail.copy()

    def clear_audit_trail(self):
        """Clear the audit trail."""
        with self._lock:
            self.audit_trail.clear()

    async def get_deduplication_stats(self) -> Dict[str, Any]:
        """
        Get deduplication statistics.

        Returns:
            Dictionary with deduplication statistics
        """
        with self._lock:
            total_entries = len(self.audit_trail)
            deduplication_events = [
                entry for entry in self.audit_trail
                if entry.event_type == "deduplication"
            ]
            merge_events = [
                entry for entry in self.audit_trail
                if entry.event_type == "entity_merge"
            ]

            avg_similarity = (
                sum(entry.similarity_score for entry in deduplication_events) / len(deduplication_events)
                if deduplication_events else 0.0
            )

            return {
                "total_audit_entries": total_entries,
                "deduplication_events": len(deduplication_events),
                "entity_merges": len(merge_events),
                "average_similarity": avg_similarity,
                "threshold_used": self.SIMILARITY_THRESHOLD,
                "audit_trail_size": len(self.audit_trail)
            }
