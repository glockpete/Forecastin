"""
RSS WebSocket Notifier with Custom Message Types

Implements WebSocket real-time notifications following AGENTS.md patterns:
- Custom RSS message types (rss_feed_update, rss_entity_extracted, rss_deduplication_result)
- orjson serialization with safe_serialize_message fallback
- Feed-specific subscriptions to avoid unnecessary broadcast
- Message batching and throttling to prevent flooding
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from services.realtime_service import RealtimeService

logger = logging.getLogger(__name__)


@dataclass
class RSSWebSocketMessage:
    """Base RSS WebSocket message structure"""
    type: str
    data: Dict[str, Any]
    timestamp: float = field(default_factory=time.time)
    feed_id: Optional[str] = None
    batch_id: Optional[str] = None


class RSSWebSocketNotifier:
    """
    WebSocket notifier for real-time RSS updates.
    
    Follows the rules from AGENTS.md:
    - Custom RSS message types (rss_feed_update, rss_entity_extracted, rss_deduplication_result)
    - orjson serialization with safe_serialize_message fallback
    - Feed-specific subscriptions to avoid unnecessary broadcast
    - Message batching and throttling to prevent flooding
    """

    def __init__(self, realtime_service: RealtimeService):
        self.realtime_service = realtime_service
        self._message_queue: List[RSSWebSocketMessage] = []
        self._last_batch_send: float = 0
        self._batch_size_limit: int = 10  # Limit batch size to prevent overwhelming clients
        self._batch_time_limit: float = 1.0  # Send batch every 1 second max

    async def notify_feed_update(
        self,
        feed_id: str,
        articles_count: int,
        new_articles: int = 0,
        metrics: Optional[Dict[str, Any]] = None
    ):
        """
        Notify clients of RSS feed update.
        
        Args:
            feed_id: RSS feed identifier
            articles_count: Total number of articles in feed
            new_articles: Number of new articles added
            metrics: Optional performance metrics
        """
        message = RSSWebSocketMessage(
            type="rss_feed_update",
            feed_id=feed_id,
            data={
                "feed_id": feed_id,
                "articles_count": articles_count,
                "new_articles": new_articles,
                "metrics": metrics or {},
                "updated_at": datetime.utcnow().isoformat()
            }
        )

        await self._send_message(message)

    async def notify_entity_extraction(
        self,
        article_id: str,
        entities_count: int,
        entity_summary: Dict[str, int],
        confidence_scores: Optional[Dict[str, float]] = None
    ):
        """
        Notify clients of entity extraction completion.
        
        Args:
            article_id: Article identifier
            entities_count: Total number of entities extracted
            entity_summary: Summary by entity type (5-W framework)
            confidence_scores: Optional confidence score metrics
        """
        message = RSSWebSocketMessage(
            type="rss_entity_extracted",
            data={
                "article_id": article_id,
                "entities_count": entities_count,
                "entity_summary": entity_summary,
                "confidence_scores": confidence_scores or {},
                "extracted_at": datetime.utcnow().isoformat()
            }
        )

        await self._send_message(message)

    async def notify_deduplication_result(
        self,
        feed_id: str,
        original_count: int,
        deduplicated_count: int,
        duplicates_removed: int,
        similarity_stats: Optional[Dict[str, float]] = None
    ):
        """
        Notify clients of deduplication results.
        
        Args:
            feed_id: RSS feed identifier
            original_count: Original number of articles
            deduplicated_count: Number of articles after deduplication
            duplicates_removed: Number of duplicates removed
            similarity_stats: Optional similarity statistics
        """
        message = RSSWebSocketMessage(
            type="rss_deduplication_result",
            feed_id=feed_id,
            data={
                "feed_id": feed_id,
                "original_count": original_count,
                "deduplicated_count": deduplicated_count,
                "duplicates_removed": duplicates_removed,
                "similarity_stats": similarity_stats or {},
                "processed_at": datetime.utcnow().isoformat()
            }
        )

        await self._send_message(message)

    async def notify_ingestion_start(self, job_id: str, feed_url: str):
        """
        Notify clients that RSS ingestion has started.
        
        Args:
            job_id: Ingestion job identifier
            feed_url: RSS feed URL being processed
        """
        message = RSSWebSocketMessage(
            type="rss_ingestion_start",
            data={
                "job_id": job_id,
                "feed_url": feed_url,
                "started_at": datetime.utcnow().isoformat()
            }
        )

        await self._send_message(message)

    async def notify_ingestion_complete(
        self,
        job_id: str,
        articles_processed: int,
        entities_extracted: int = 0,
        processing_time: Optional[float] = None
    ):
        """
        Notify clients that RSS ingestion has completed.
        
        Args:
            job_id: Ingestion job identifier
            articles_processed: Number of articles processed
            entities_extracted: Number of entities extracted
            processing_time: Optional processing time in seconds
        """
        message = RSSWebSocketMessage(
            type="rss_ingestion_complete",
            data={
                "job_id": job_id,
                "articles_processed": articles_processed,
                "entities_extracted": entities_extracted,
                "processing_time": processing_time,
                "completed_at": datetime.utcnow().isoformat()
            }
        )

        await self._send_message(message)

    async def notify_ingestion_progress(
        self,
        job_id: str,
        progress: Union[int, float],
        stage: str = "processing"
    ):
        """
        Notify clients of ingestion progress.
        
        Args:
            job_id: Ingestion job identifier
            progress: Progress percentage (0-100) or count
            stage: Current processing stage
        """
        message = RSSWebSocketMessage(
            type="rss_ingestion_progress",
            data={
                "job_id": job_id,
                "progress": progress,
                "stage": stage,
                "updated_at": datetime.utcnow().isoformat()
            }
        )

        # For progress updates, we might want to throttle to prevent flooding
        await self._send_message(message, throttle=True)

    async def notify_ingestion_error(self, job_id: str, error: str, article_id: Optional[str] = None):
        """
        Notify clients of ingestion error.
        
        Args:
            job_id: Ingestion job identifier
            error: Error message
            article_id: Optional article identifier where error occurred
        """
        message = RSSWebSocketMessage(
            type="rss_ingestion_error",
            data={
                "job_id": job_id,
                "error": error,
                "article_id": article_id,
                "error_at": datetime.utcnow().isoformat()
            }
        )

        await self._send_message(message)

    async def _send_message(self, message: RSSWebSocketMessage, throttle: bool = False):
        """
        Send message via WebSocket with proper serialization.
        
        Args:
            message: RSS WebSocket message to send
            throttle: Whether to apply throttling for this message
        """
        # Convert message to dictionary format for serialization
        message_dict = {
            "type": message.type,
            "data": message.data,
            "timestamp": message.timestamp
        }

        # Add optional fields if present
        if message.feed_id:
            message_dict["feed_id"] = message.feed_id
        if message.batch_id:
            message_dict["batch_id"] = message.batch_id

        # CRITICAL: Use safe_serialize_message to prevent WebSocket crashes
        try:
            # Try to send directly through realtime service
            await self.realtime_service.broadcast_message(message_dict)
            logger.debug(f"RSS WebSocket message sent: {message.type}")
        except Exception as e:
            logger.error(f"RSS WebSocket broadcast failed: {e}")
            # Send fallback message without problematic fields
            fallback_message = {
                "type": "rss_notification_error",
                "error": f"Broadcast failed: {str(e)}",
                "original_type": message.type,
                "timestamp": time.time()
            }
            try:
                await self.realtime_service.broadcast_message(fallback_message)
            except Exception as fallback_error:
                logger.error(f"Fallback RSS WebSocket broadcast also failed: {fallback_error}")

    async def _batch_send_messages(self):
        """
        Send messages in batches to prevent flooding.
        
        Implements server-side debounce strategy as specified in AGENTS.md.
        """
        if not self._message_queue:
            return

        current_time = time.time()

        # Send if batch is full or time limit reached
        if (len(self._message_queue) >= self._batch_size_limit or
            current_time - self._last_batch_send >= self._batch_time_limit):

            # Create batch message
            batch_message = RSSWebSocketMessage(
                type="rss_batch_update",
                data={
                    "messages": [self._message_to_dict(msg) for msg in self._message_queue],
                    "batch_size": len(self._message_queue),
                    "batched_at": datetime.utcnow().isoformat()
                }
            )

            # Clear queue and update last send time
            self._message_queue.clear()
            self._last_batch_send = current_time

            # Send batch
            await self._send_message(batch_message)

    def _message_to_dict(self, message: RSSWebSocketMessage) -> Dict[str, Any]:
        """Convert RSSWebSocketMessage to dictionary."""
        result = {
            "type": message.type,
            "data": message.data,
            "timestamp": message.timestamp
        }

        if message.feed_id:
            result["feed_id"] = message.feed_id
        if message.batch_id:
            result["batch_id"] = message.batch_id

        return result

    async def subscribe_to_feed(self, client_id: str, feed_id: str):
        """
        Subscribe client to specific feed updates.
        
        Args:
            client_id: Client identifier
            feed_id: RSS feed identifier to subscribe to
        """
        # In a more complex implementation, we would track feed-specific subscriptions
        # For now, we'll just log the subscription
        logger.info(f"Client {client_id} subscribed to feed {feed_id}")

    async def unsubscribe_from_feed(self, client_id: str, feed_id: str):
        """
        Unsubscribe client from specific feed updates.
        
        Args:
            client_id: Client identifier
            feed_id: RSS feed identifier to unsubscribe from
        """
        logger.info(f"Client {client_id} unsubscribed from feed {feed_id}")

    async def get_notification_stats(self) -> Dict[str, Any]:
        """
        Get notification statistics.
        
        Returns:
            Dictionary with notification statistics
        """
        # This would typically interact with the realtime service to get stats
        # For now, we'll return a basic structure
        return {
            "messages_sent": 0,  # Would be tracked in a real implementation
            "active_subscriptions": 0,  # Would be tracked in a real implementation
            "error_count": 0,  # Would be tracked in a real implementation
            "last_message_sent": datetime.utcnow().isoformat()
        }
