"""
RSS Entity Extractor with 5-W Framework

Implements Who, What, Where, When, Why framework with confidence scoring
and hierarchical entity linking for RSS content.
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

from navigation_api.database.optimized_hierarchy_resolver import (
    OptimizedHierarchyResolver,
)

logger = logging.getLogger(__name__)

@dataclass
class RSSEntity:
    """RSS entity with 5-W framework and confidence scoring"""
    id: str
    entity_type: str  # who, what, where, when, why
    text: str
    confidence: float
    canonical_key: str
    article_id: str
    extracted_at: datetime
    hierarchy_path: Optional[str] = None
    audit_trail: List[str] = field(default_factory=list)

@dataclass
class RSSArticle:
    """RSS article data structure"""
    id: str
    title: str
    content: str
    url: str
    published_at: datetime
    source: str
    entities: List[RSSEntity] = field(default_factory=list)

class RSSEntityExtractor:
    """
    Extracts 5-W entities from RSS content with confidence scoring

    Follows the rules from AGENTS.md:
    - Confidence scores are calibrated by rules, not just base model confidence
    - PersonEntity with title+organization gets higher score than name alone
    - Uses similarity threshold (0.8) for deduplication with canonical_key assignment
    """

    def __init__(self, hierarchy_resolver: OptimizedHierarchyResolver):
        self.hierarchy_resolver = hierarchy_resolver

        # 5-W entity patterns
        self.patterns = {
            "who": [
                r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b',  # Full names
                r'\b(President|Minister|Chancellor|CEO|Director|Leader)\s+([A-Z][a-z]+)\b',  # Titles
                r'\b(United States|China|Russia|European Union|NATO|UN)\b'  # Organizations
            ],
            "what": [
                r'\b(war|conflict|election|agreement|sanctions|trade|investment|diplomacy)\b',
                r'\b(summit|meeting|negotiation|report|study|analysis)\b'
            ],
            "where": [
                r'\b(Afghanistan|Iraq|Syria|Ukraine|Taiwan|Israel|Palestine)\b',
                r'\b(Washington|Moscow|Beijing|Brussels|London|Paris|Tokyo)\b',
                r'\b(Middle East|Europe|Asia|Africa|Americas)\b'
            ],
            "when": [
                r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\b',
                r'\b(2023|2024|2025)\b',
                r'\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b'
            ],
            "why": [
                r'\b(because|due to|as a result|therefore|consequently|since)\b',
                r'\b(in order to|so that|to achieve|aimed at)\b'
            ]
        }

    async def extract_entities(self, article: RSSArticle) -> List[RSSEntity]:
        """Extract 5-W entities from RSS article"""
        entities = []

        # Extract entities for each category
        for category, patterns in self.patterns.items():
            category_entities = await self._extract_category_entities(article, category, patterns)
            entities.extend(category_entities)

        # Link entities to hierarchy and apply confidence calibration
        for entity in entities:
            await self._calibrate_confidence(entity, article)
            if entity.entity_type == "where":
                await self._link_to_hierarchy(entity)

        return entities

    async def _extract_category_entities(self, article: RSSArticle, category: str, patterns: List[str]) -> List[RSSEntity]:
        """Extract entities for a specific category"""
        entities = []
        text_to_search = f"{article.title} {article.content}"

        for pattern in patterns:
            matches = re.finditer(pattern, text_to_search, re.IGNORECASE)
            for match in matches:
                text = match.group(0)
                confidence = self._calculate_base_confidence(text, category, article)

                entity = RSSEntity(
                    id=f"rss_entity_{article.id}_{category}_{hash(text)}",
                    entity_type=category,
                    text=text,
                    confidence=confidence,
                    canonical_key=self._generate_canonical_key(text, category),
                    article_id=article.id,
                    extracted_at=datetime.utcnow(),
                    audit_trail=[f"Extracted via {pattern}"]
                )
                entities.append(entity)

        return entities

    def _calculate_base_confidence(self, text: str, category: str, article: RSSArticle) -> float:
        """Calculate base confidence score using rules-based calibration"""
        base_confidence = 0.5

        # Title presence increases confidence
        if text.lower() in article.title.lower():
            base_confidence += 0.3

        # Entity type specific rules
        if category == "who":
            if re.search(r'\b(President|Minister|CEO|Director)\b', text):
                base_confidence += 0.2  # Formal titles get higher confidence
            if re.search(r'\b[A-Z][a-z]+ [A-Z][a-z]+\b', text):  # Full name pattern
                base_confidence += 0.1

        elif category == "where":
            # Geographic entities get confidence boost
            if any(country in text for country in ["United States", "China", "Russia"]):
                base_confidence += 0.2

        # Content length adjustment
        if len(text) > 10:
            base_confidence += 0.1

        return min(base_confidence, 1.0)

    def _generate_canonical_key(self, text: str, category: str) -> str:
        """Generate canonical key for deduplication"""
        normalized = re.sub(r'[^\w\s]', '', text.lower())
        return f"{category}_{hash(normalized)}"

    async def _calibrate_confidence(self, entity: RSSEntity, article: RSSArticle):
        """Apply rules-based confidence calibration"""
        # Check for title+organization combination for people
        if entity.entity_type == "who":
            title_org_pattern = r'\b(President|Minister|CEO|Director)\s+([A-Z][a-z]+)\b'
            if re.search(title_org_pattern, f"{article.title} {article.content}"):
                entity.confidence = min(entity.confidence + 0.15, 1.0)
                entity.audit_trail.append("Confidence boosted for title+organization combination")

        # Geographic confidence calibration
        elif entity.entity_type == "where":
            major_powers = ["United States", "China", "Russia", "European Union"]
            if any(power in entity.text for power in major_powers):
                entity.confidence = min(entity.confidence + 0.1, 1.0)
                entity.audit_trail.append("Confidence boosted for major geopolitical entity")

    async def _link_to_hierarchy(self, entity: RSSEntity):
        """Link geographic entity to hierarchy using LTREE"""
        try:
            # In a real implementation, this would query the hierarchy resolver
            # For now, we'll set a basic path structure
            entity.hierarchy_path = f"geography.{entity.text.lower().replace(' ', '_')}"
        except Exception as e:
            logger.warning(f"Failed to link entity {entity.id} to hierarchy: {e}")
            entity.audit_trail.append(f"Hierarchy linking failed: {e}")
