"""
RSS Route Processor with RSSHub-Inspired CSS Selector Patterns

Base route processor that implements RSSHub-inspired content extraction patterns:
- CSS selector-based content extraction
- Intelligent fallback strategies
- Content normalization and validation
- Integration with existing cache and real-time services

Following AGENTS.md patterns for performance and reliability.
"""

import asyncio
import hashlib
import logging
import re
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime

import aiohttp
from bs4 import BeautifulSoup

from services.cache_service import CacheService
from services.realtime_service import RealtimeService
from ..models import RSSArticle, ExtractionResult


logger = logging.getLogger(__name__)


class RSSRouteProcessor:
    """
    RSSHub-inspired route processor with CSS selector extraction
    
    This processor implements intelligent content extraction patterns:
    - Multiple CSS selector fallbacks
    - Content normalization and cleaning
    - Confidence scoring based on extraction quality
    - Cache integration for performance
    """
    
    def __init__(self, cache_service: CacheService, realtime_service: RealtimeService):
        self.cache_service = cache_service
        self.realtime_service = realtime_service
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Common CSS selector patterns for geopolitical content
        self.common_selectors = {
            "title": [
                "h1.article-title", "h1.headline", "h1.title",
                "h1", ".title", ".headline"
            ],
            "content": [
                "div.article-body", "div.story-content", "div.content",
                "article .content", ".article-content", "div.body"
            ],
            "author": [
                ".author-name", ".byline", ".author",
                "meta[name='author']", ".published-by"
            ],
            "published": [
                "time.published", ".timestamp", ".date-published",
                "meta[property='article:published_time']", ".publish-date"
            ],
            "geographic": [
                ".location", ".geo-tag", ".region",
                ".country", ".place", "[data-geo]"
            ]
        }
    
    async def initialize(self) -> None:
        """Initialize HTTP session"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
    
    async def close(self) -> None:
        """Close HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
    
    async def process_feed(self, feed_url: str, route_config: Dict) -> List[RSSArticle]:
        """
        Process RSS feed and extract articles using route configuration
        
        Args:
            feed_url: RSS feed URL
            route_config: RSSHub-inspired route configuration
            
        Returns:
            List of extracted RSS articles
        """
        await self.initialize()
        
        try:
            # Fetch RSS feed content
            feed_content = await self._fetch_content(feed_url)
            
            # Parse RSS feed
            articles_data = await self._parse_rss_feed(feed_content, feed_url)
            
            # Process each article through the route pipeline
            articles = []
            for article_data in articles_data:
                try:
                    article = await self.process_article(article_data, route_config)
                    articles.append(article)
                except Exception as e:
                    logger.warning(f"Failed to process article {article_data.get('url')}: {e}")
                    continue
            
            return articles
            
        except Exception as e:
            logger.error(f"Failed to process RSS feed {feed_url}: {e}")
            raise
    
    async def process_article(self, article_data: Dict, route_config: Dict) -> RSSArticle:
        """
        Process individual article using CSS selector extraction
        
        Args:
            article_data: Raw article data from RSS feed
            route_config: Route configuration with CSS selectors
            
        Returns:
            Processed RSS article with extracted content
        """
        await self.initialize()
        
        # Check cache first
        cache_key = f"rss:article_content:{hashlib.md5(article_data['url'].encode()).hexdigest()}"
        cached_article = await self.cache_service.get(cache_key)
        
        if cached_article:
            logger.debug(f"Cache hit for article: {article_data['url']}")
            return RSSArticle(**cached_article)
        
        try:
            # Fetch article content
            html_content = await self._fetch_content(article_data['url'])
            
            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract content using CSS selectors
            extracted_data = await self._extract_with_selectors(soup, route_config["selectors"])
            
            # Calculate confidence scores
            confidence_scores = self._calculate_confidence_scores(extracted_data, route_config)
            
            # Create RSS article
            article = RSSArticle(
                id=str(uuid.uuid4()),
                url=article_data['url'],
                title=extracted_data["title"].value,
                content=extracted_data["content"].value,
                published_at=self._parse_date(extracted_data["published"].value),
                feed_source=route_config.get("name", "unknown"),
                author=extracted_data.get("author", ExtractionResult("", "", 0.0)).value,
                confidence_scores=confidence_scores,
                metadata={
                    "geographic": extracted_data.get("geographic", ExtractionResult("", "", 0.0)).value,
                    "selector_confidence": {k: v.confidence for k, v in extracted_data.items()}
                }
            )
            
            # Cache the processed article
            await self.cache_service.set(cache_key, article.model_dump(), ttl=86400)
            
            return article
            
        except Exception as e:
            logger.error(f"Failed to process article {article_data['url']}: {e}")
            raise
    
    async def _extract_with_selectors(self, soup: BeautifulSoup, selectors_config: Dict) -> Dict[str, ExtractionResult]:
        """
        Extract content using CSS selectors with fallback strategies
        
        Args:
            soup: BeautifulSoup object
            selectors_config: CSS selector configuration
            
        Returns:
            Dictionary of extraction results with confidence
        """
        results = {}
        
        for field, selector_config in selectors_config.items():
            if isinstance(selector_config, str):
                # Single selector
                selectors = [selector_config]
            else:
                # List of selectors with fallbacks
                selectors = selector_config
            
            result = await self._extract_with_fallback(soup, field, selectors)
            results[field] = result
        
        return results
    
    async def _extract_with_fallback(self, soup: BeautifulSoup, field: str, selectors: List[str]) -> ExtractionResult:
        """
        Extract content using multiple selector fallbacks
        
        Args:
            soup: BeautifulSoup object
            field: Field being extracted
            selectors: List of CSS selectors to try
            
        Returns:
            Extraction result with confidence score
        """
        best_result = None
        best_confidence = 0.0
        selector_used = ""
        
        for selector in selectors:
            try:
                elements = soup.select(selector)
                
                if elements:
                    # Extract text content
                    content = self._extract_text_from_elements(elements)
                    
                    if content and self._validate_content(field, content):
                        confidence = self._calculate_selector_confidence(field, content, selector)
                        
                        if confidence > best_confidence:
                            best_confidence = confidence
                            best_result = content
                            selector_used = selector
                
            except Exception as e:
                logger.debug(f"Selector failed {selector} for {field}: {e}")
                continue
        
        if best_result:
            return ExtractionResult(
                value=best_result,
                selector_used=selector_used,
                confidence=best_confidence
            )
        else:
            # Try fallback extraction methods
            fallback_result = await self._extract_with_fallback_methods(soup, field)
            return fallback_result
    
    async def _extract_with_fallback_methods(self, soup: BeautifulSoup, field: str) -> ExtractionResult:
        """
        Extract content using fallback methods when CSS selectors fail
        
        Args:
            soup: BeautifulSoup object
            field: Field being extracted
            
        Returns:
            Extraction result with lower confidence
        """
        fallback_methods = {
            "title": [
                lambda s: s.find('title'),
                lambda s: s.find('h1'),
                lambda s: s.find('meta', property='og:title')
            ],
            "content": [
                lambda s: s.find('article'),
                lambda s: s.find('div', class_=re.compile(r'content|body|article')),
                lambda s: s.find('main')
            ],
            "author": [
                lambda s: s.find('meta', attrs={'name': 'author'}),
                lambda s: s.find(class_=re.compile(r'author|byline'))
            ],
            "published": [
                lambda s: s.find('time'),
                lambda s: s.find('meta', property='article:published_time'),
                lambda s: s.find(class_=re.compile(r'date|time|published'))
            ]
        }
        
        methods = fallback_methods.get(field, [])
        
        for method in methods:
            try:
                element = method(soup)
                if element:
                    content = self._extract_text_from_element(element)
                    if content and self._validate_content(field, content):
                        return ExtractionResult(
                            value=content,
                            selector_used="fallback",
                            confidence=0.3,  # Lower confidence for fallbacks
                            fallback_used=True
                        )
            except Exception as e:
                logger.debug(f"Fallback selector failed: {e}")
                continue
        
        # Return empty result if all fallbacks fail
        return ExtractionResult(value="", selector_used="none", confidence=0.0)
    
    def _extract_text_from_elements(self, elements: List) -> str:
        """Extract and clean text from BeautifulSoup elements"""
        texts = []
        for element in elements:
            text = self._extract_text_from_element(element)
            if text:
                texts.append(text)
        
        return " ".join(texts).strip()
    
    def _extract_text_from_element(self, element) -> str:
        """Extract and clean text from a single element"""
        if hasattr(element, 'get_text'):
            text = element.get_text(separator=' ', strip=True)
        else:
            text = str(element)
        
        # Clean the text
        text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
        text = text.strip()
        
        return text
    
    def _validate_content(self, field: str, content: str) -> bool:
        """Validate extracted content based on field type"""
        if not content or len(content.strip()) == 0:
            return False
        
        validation_rules = {
            "title": lambda c: 5 <= len(c) <= 500,  # Reasonable title length
            "content": lambda c: len(c) >= 50,      # Minimum content length
            "author": lambda c: 2 <= len(c) <= 100, # Reasonable author name length
            "published": lambda c: self._is_valid_date(c), # Valid date format
            "geographic": lambda c: 2 <= len(c) <= 100 # Reasonable location length
        }
        
        validator = validation_rules.get(field, lambda c: True)
        return validator(content)
    
    def _is_valid_date(self, date_str: str) -> bool:
        """Validate date string"""
        try:
            self._parse_date(date_str)
            return True
        except (ValueError, TypeError):
            return False
    
    def _parse_date(self, date_str: str) -> datetime:
        """Parse date string with multiple format support"""
        # Common date formats in RSS feeds
        formats = [
            "%Y-%m-%dT%H:%M:%SZ",  # ISO 8601
            "%Y-%m-%d %H:%M:%S",
            "%a, %d %b %Y %H:%M:%S %z",  # RFC 822
            "%d %b %Y %H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        # Fallback to current time if parsing fails
        logger.warning(f"Could not parse date: {date_str}")
        return datetime.utcnow()
    
    def _calculate_selector_confidence(self, field: str, content: str, selector: str) -> float:
        """Calculate confidence score for selector extraction"""
        base_confidence = 0.7  # Base confidence for successful extraction
        
        # Boost confidence for specific selector patterns
        selector_boosts = {
            "meta[property*='time']": 0.2,  # Meta tags are reliable
            "time.published": 0.2,           # Time elements are reliable
            "h1.article-title": 0.1,         # Specific class names
            "div.article-body": 0.1,
        }
        
        # Content quality boosts
        content_boosts = {
            "title": lambda c: min(len(c) / 100, 0.2),  # Longer titles are better
            "content": lambda c: min(len(c) / 1000, 0.3),  # Longer content is better
            "author": lambda c: 0.1 if len(c.split()) >= 2 else 0,  # Full names are better
        }
        
        # Apply boosts
        confidence = base_confidence
        
        for pattern, boost in selector_boosts.items():
            if pattern in selector:
                confidence += boost
        
        if field in content_boosts:
            confidence += content_boosts[field](content)
        
        return min(confidence, 1.0)  # Cap at 1.0
    
    def _calculate_confidence_scores(self, extracted_data: Dict[str, ExtractionResult], route_config: Dict) -> Dict[str, float]:
        """Calculate overall confidence scores for the extraction"""
        
        confidence_factors = route_config.get("confidence_factors", {})
        
        scores = {}
        for field, result in extracted_data.items():
            base_confidence = result.confidence
            
            # Apply route-specific confidence factors
            route_factor = confidence_factors.get(field, 1.0)
            calibrated_confidence = base_confidence * route_factor
            
            scores[field] = min(calibrated_confidence, 1.0)
        
        # Calculate overall confidence
        if scores:
            scores["overall"] = sum(scores.values()) / len(scores)
        else:
            scores["overall"] = 0.0
        
        return scores
    
    async def _fetch_content(self, url: str) -> str:
        """Fetch content from URL with error handling"""
        if not self.session:
            await self.initialize()
        
        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    return await response.text()
                else:
                    raise Exception(f"HTTP {response.status}: {response.reason}")
        except Exception as e:
            logger.error(f"Failed to fetch {url}: {e}")
            raise
    
    async def _parse_rss_feed(self, feed_content: str, feed_url: str) -> List[Dict]:
        """Parse RSS feed content and extract article data"""
        # This is a simplified RSS parser - in production, use a proper RSS library
        try:
            soup = BeautifulSoup(feed_content, 'xml')
            items = soup.find_all('item')
            
            articles = []
            for item in items:
                article_data = {
                    'url': item.find('link').text if item.find('link') else feed_url,
                    'title': item.find('title').text if item.find('title') else 'Untitled',
                    'description': item.find('description').text if item.find('description') else '',
                    'pubDate': item.find('pubDate').text if item.find('pubDate') else None
                }
                articles.append(article_data)
            
            return articles
        except Exception as e:
            logger.error(f"Failed to parse RSS feed {feed_url}: {e}")
            return []


# Convenience function for quick article processing
async def process_article_url(
    url: str, 
    route_config: Dict,
    cache_service: CacheService,
    realtime_service: RealtimeService
) -> RSSArticle:
    """Convenience function to process a single article URL"""
    
    processor = RSSRouteProcessor(cache_service, realtime_service)
    
    try:
        article_data = {"url": url, "title": "Processing..."}
        article = await processor.process_article(article_data, route_config)
        return article
    finally:
        await processor.close()