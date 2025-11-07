#!/usr/bin/env python3
"""
User Feedback Collection System with WebSocket Integration
Captures real-time feedback correlated with feature flag rollouts (10% → 25% → 50% → 100%).
Implements orjson serialization, RLock thread safety, and exponential backoff patterns.
"""

import asyncio
import json
import time
import logging
import threading
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
from datetime import datetime, timedelta
import httpx

# Configure orjson serialization for WebSocket compatibility
try:
    import orjson
    def safe_serialize_message(obj: Any) -> bytes:
        """Safe serialization using orjson to prevent WebSocket crashes"""
        try:
            return orjson.dumps(obj)
        except (TypeError, ValueError) as e:
            logging.warning(f"Serialization error: {e}, falling back to str representation")
            return orjson.dumps(str(obj))
except ImportError:
    import json as stdlib_json
    def safe_serialize_message(obj: Any) -> bytes:
        """Fallback to stdlib json with error handling"""
        try:
            return stdlib_json.dumps(obj).encode('utf-8')
        except (TypeError, ValueError) as e:
            logging.warning(f"Serialization error: {e}")
            return stdlib_json.dumps(str(obj)).encode('utf-8')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class UserFeedback:
    """User feedback entry correlated with feature flag rollout"""
    feedback_id: str
    user_id: str
    feature_flag: str
    rollout_percentage: float
    feedback_type: str  # positive, negative, neutral, bug_report
    sentiment_score: float
    feedback_text: str
    metadata: Dict[str, Any]
    timestamp: float
    
@dataclass
class FeatureFlagRolloutContext:
    """Feature flag rollout context"""
    flag_name: str
    current_rollout_percentage: float
    rollout_stage: str  # 10%, 25%, 50%, 100%
    rollout_start_time: float
    active_users: int
    risk_conditions_triggered: List[str]
    timestamp: float

@dataclass
class FeedbackAnalytics:
    """Aggregated feedback analytics"""
    total_feedback_count: int
    positive_feedback_count: int
    negative_feedback_count: int
    neutral_feedback_count: int
    bug_reports_count: int
    average_sentiment_score: float
    feature_flag_correlation: Dict[str, Dict[str, int]]
    timestamp: float

@dataclass
class WebSocketMessage:
    """WebSocket message structure"""
    message_type: str
    payload: Dict[str, Any]
    timestamp: float

class UserFeedbackCollector:
    """Thread-safe user feedback collector with WebSocket integration"""
    
    def __init__(self, db_url: str = None, api_url: str = None, ws_url: str = None):
        self.db_url = db_url
        self.api_url = api_url
        self.ws_url = ws_url
        
        # Thread-safe operations with RLock
        self.feedback_lock = threading.RLock()
        self.rollout_lock = threading.RLock()
        
        # Exponential backoff configuration
        self.exponential_backoff = [(0.5, 1), (1.0, 2), (2.0, 4)]
        
        # TCP keepalives configuration
        self.tcp_keepalives = {
            'keepalives_idle': 30,
            'keepalives_interval': 10,
            'keepalives_count': 5
        }
        
        # In-memory storage (would be Redis/DB in production)
        self.feedback_storage: List[UserFeedback] = []
        self.rollout_contexts: Dict[str, FeatureFlagRolloutContext] = {}
        
        # WebSocket connection tracking
        self.ws_connections: Dict[str, Any] = {}
        self.ws_message_queue: asyncio.Queue = asyncio.Queue()
        
    async def collect_feedback(self, feedback_data: Dict[str, Any]) -> UserFeedback:
        """
        Collect user feedback with thread-safe operations.
        
        Args:
            feedback_data: Feedback data from user
            
        Returns:
            UserFeedback object
        """
        with self.feedback_lock:  # Thread-safe feedback collection
            feedback = UserFeedback(
                feedback_id=feedback_data.get('feedback_id', f"fb_{int(time.time() * 1000)}"),
                user_id=feedback_data.get('user_id', 'anonymous'),
                feature_flag=feedback_data.get('feature_flag', 'unknown'),
                rollout_percentage=feedback_data.get('rollout_percentage', 0.0),
                feedback_type=feedback_data.get('feedback_type', 'neutral'),
                sentiment_score=feedback_data.get('sentiment_score', 0.5),
                feedback_text=feedback_data.get('feedback_text', ''),
                metadata=feedback_data.get('metadata', {}),
                timestamp=time.time()
            )
            
            # Store feedback
            self.feedback_storage.append(feedback)
            
            # Broadcast via WebSocket
            await self._broadcast_feedback(feedback)
            
            logger.info(f"Collected feedback: {feedback.feedback_id} for {feedback.feature_flag}")
            
            return feedback
    
    async def track_feature_flag_rollout(self, flag_name: str, rollout_percentage: float) -> FeatureFlagRolloutContext:
        """
        Track feature flag rollout context with thread-safe operations.
        
        Args:
            flag_name: Feature flag name
            rollout_percentage: Current rollout percentage
            
        Returns:
            FeatureFlagRolloutContext object
        """
        with self.rollout_lock:  # Thread-safe rollout tracking
            # Determine rollout stage
            if rollout_percentage <= 10:
                rollout_stage = "10%"
            elif rollout_percentage <= 25:
                rollout_stage = "25%"
            elif rollout_percentage <= 50:
                rollout_stage = "50%"
            else:
                rollout_stage = "100%"
            
            context = FeatureFlagRolloutContext(
                flag_name=flag_name,
                current_rollout_percentage=rollout_percentage,
                rollout_stage=rollout_stage,
                rollout_start_time=time.time(),
                active_users=0,  # Would query actual active users
                risk_conditions_triggered=[],
                timestamp=time.time()
            )
            
            self.rollout_contexts[flag_name] = context
            
            # Broadcast rollout context via WebSocket
            await self._broadcast_rollout_context(context)
            
            logger.info(f"Tracking rollout: {flag_name} at {rollout_percentage}% ({rollout_stage})")
            
            return context
    
    async def analyze_feedback(self) -> FeedbackAnalytics:
        """
        Analyze collected feedback with correlation to feature flags.
        
        Returns:
            FeedbackAnalytics object
        """
        with self.feedback_lock:  # Thread-safe analytics computation
            if not self.feedback_storage:
                return FeedbackAnalytics(
                    total_feedback_count=0,
                    positive_feedback_count=0,
                    negative_feedback_count=0,
                    neutral_feedback_count=0,
                    bug_reports_count=0,
                    average_sentiment_score=0.0,
                    feature_flag_correlation={},
                    timestamp=time.time()
                )
            
            # Count feedback by type
            positive_count = sum(1 for fb in self.feedback_storage if fb.feedback_type == 'positive')
            negative_count = sum(1 for fb in self.feedback_storage if fb.feedback_type == 'negative')
            neutral_count = sum(1 for fb in self.feedback_storage if fb.feedback_type == 'neutral')
            bug_reports_count = sum(1 for fb in self.feedback_storage if fb.feedback_type == 'bug_report')
            
            # Calculate average sentiment
            avg_sentiment = sum(fb.sentiment_score for fb in self.feedback_storage) / len(self.feedback_storage)
            
            # Feature flag correlation
            feature_flag_correlation = {}
            for feedback in self.feedback_storage:
                flag = feedback.feature_flag
                if flag not in feature_flag_correlation:
                    feature_flag_correlation[flag] = {
                        'positive': 0,
                        'negative': 0,
                        'neutral': 0,
                        'bug_reports': 0,
                        'total': 0
                    }
                
                feature_flag_correlation[flag][feedback.feedback_type] += 1
                feature_flag_correlation[flag]['total'] += 1
            
            analytics = FeedbackAnalytics(
                total_feedback_count=len(self.feedback_storage),
                positive_feedback_count=positive_count,
                negative_feedback_count=negative_count,
                neutral_feedback_count=neutral_count,
                bug_reports_count=bug_reports_count,
                average_sentiment_score=avg_sentiment,
                feature_flag_correlation=feature_flag_correlation,
                timestamp=time.time()
            )
            
            logger.info(f"Feedback analytics: {analytics.total_feedback_count} total, avg sentiment: {avg_sentiment:.2f}")
            
            return analytics
    
    async def _broadcast_feedback(self, feedback: UserFeedback):
        """Broadcast feedback via WebSocket with safe serialization"""
        try:
            message = WebSocketMessage(
                message_type="user_feedback",
                payload=asdict(feedback),
                timestamp=time.time()
            )
            
            # Serialize with orjson (safe for WebSocket)
            serialized_message = safe_serialize_message(asdict(message))
            
            # Add to message queue for WebSocket broadcast
            await self.ws_message_queue.put(serialized_message)
            
            logger.debug(f"Broadcast feedback: {feedback.feedback_id}")
            
        except Exception as e:
            logger.error(f"Failed to broadcast feedback: {e}")
    
    async def _broadcast_rollout_context(self, context: FeatureFlagRolloutContext):
        """Broadcast rollout context via WebSocket with safe serialization"""
        try:
            message = WebSocketMessage(
                message_type="rollout_context",
                payload=asdict(context),
                timestamp=time.time()
            )
            
            # Serialize with orjson (safe for WebSocket)
            serialized_message = safe_serialize_message(asdict(message))
            
            # Add to message queue for WebSocket broadcast
            await self.ws_message_queue.put(serialized_message)
            
            logger.debug(f"Broadcast rollout context: {context.flag_name}")
            
        except Exception as e:
            logger.error(f"Failed to broadcast rollout context: {e}")
    
    async def check_risk_conditions(self, flag_name: str) -> List[str]:
        """
        Check 7 configurable risk conditions for automatic rollback.
        
        Args:
            flag_name: Feature flag name
            
        Returns:
            List of triggered risk conditions
        """
        triggered_conditions = []
        
        with self.feedback_lock:
            # Get feedback for this flag
            flag_feedback = [fb for fb in self.feedback_storage if fb.feature_flag == flag_name]
            
            if not flag_feedback:
                return triggered_conditions
            
            # Risk Condition 1: High negative feedback rate (>30%)
            negative_rate = sum(1 for fb in flag_feedback if fb.feedback_type == 'negative') / len(flag_feedback)
            if negative_rate > 0.30:
                triggered_conditions.append(f"high_negative_feedback_rate: {negative_rate:.2%}")
            
            # Risk Condition 2: Low average sentiment score (<0.3)
            avg_sentiment = sum(fb.sentiment_score for fb in flag_feedback) / len(flag_feedback)
            if avg_sentiment < 0.3:
                triggered_conditions.append(f"low_sentiment_score: {avg_sentiment:.2f}")
            
            # Risk Condition 3: High bug report rate (>10%)
            bug_rate = sum(1 for fb in flag_feedback if fb.feedback_type == 'bug_report') / len(flag_feedback)
            if bug_rate > 0.10:
                triggered_conditions.append(f"high_bug_report_rate: {bug_rate:.2%}")
            
            # Risk Condition 4: Rapid negative feedback spike (>5 in last minute)
            recent_negative = [fb for fb in flag_feedback 
                             if fb.feedback_type == 'negative' 
                             and (time.time() - fb.timestamp) < 60]
            if len(recent_negative) > 5:
                triggered_conditions.append(f"negative_feedback_spike: {len(recent_negative)} in last minute")
            
            # Risk Condition 5: Low positive feedback rate (<20%)
            positive_rate = sum(1 for fb in flag_feedback if fb.feedback_type == 'positive') / len(flag_feedback)
            if positive_rate < 0.20:
                triggered_conditions.append(f"low_positive_feedback_rate: {positive_rate:.2%}")
            
            # Risk Condition 6: High neutral feedback (>60%, indicates confusion)
            neutral_rate = sum(1 for fb in flag_feedback if fb.feedback_type == 'neutral') / len(flag_feedback)
            if neutral_rate > 0.60:
                triggered_conditions.append(f"high_neutral_rate: {neutral_rate:.2%}")
            
            # Risk Condition 7: Feedback volume anomaly (>3x normal rate)
            # Mock implementation - would compare to baseline
            if len(flag_feedback) > 100:  # Simplified threshold
                triggered_conditions.append(f"feedback_volume_anomaly: {len(flag_feedback)} feedbacks")
        
        if triggered_conditions:
            logger.warning(f"Risk conditions triggered for {flag_name}: {triggered_conditions}")
        
        return triggered_conditions
    
    async def recommend_rollback(self, flag_name: str) -> Dict[str, Any]:
        """
        Recommend automatic rollback based on risk conditions.
        
        Args:
            flag_name: Feature flag name
            
        Returns:
            Rollback recommendation
        """
        risk_conditions = await self.check_risk_conditions(flag_name)
        
        # Rollback recommendation logic
        should_rollback = len(risk_conditions) >= 2  # 2 or more conditions trigger rollback
        
        recommendation = {
            "flag_name": flag_name,
            "should_rollback": should_rollback,
            "risk_conditions": risk_conditions,
            "recommendation_reason": "Multiple risk conditions triggered" if should_rollback else "No critical issues",
            "timestamp": time.time()
        }
        
        if should_rollback:
            logger.warning(f"ROLLBACK RECOMMENDED for {flag_name}: {risk_conditions}")
            
            # Broadcast rollback recommendation via WebSocket
            await self._broadcast_rollback_recommendation(recommendation)
        
        return recommendation
    
    async def _broadcast_rollback_recommendation(self, recommendation: Dict[str, Any]):
        """Broadcast rollback recommendation via WebSocket"""
        try:
            message = WebSocketMessage(
                message_type="rollback_recommendation",
                payload=recommendation,
                timestamp=time.time()
            )
            
            # Serialize with orjson (safe for WebSocket)
            serialized_message = safe_serialize_message(asdict(message))
            
            # Add to message queue for WebSocket broadcast
            await self.ws_message_queue.put(serialized_message)
            
            logger.info(f"Broadcast rollback recommendation: {recommendation['flag_name']}")
            
        except Exception as e:
            logger.error(f"Failed to broadcast rollback recommendation: {e}")
    
    async def integrate_with_realtime_service(self):
        """
        Integrate with RealtimeService for WebSocket broadcasting.
        
        Uses exponential backoff for connection resilience.
        """
        for attempt, (delay, max_retries) in enumerate(self.exponential_backoff):
            try:
                if not self.api_url:
                    logger.warning("API URL not configured, skipping RealtimeService integration")
                    return
                
                async with httpx.AsyncClient(
                    timeout=10.0,
                    headers={'Content-Type': 'application/json'}
                ) as client:
                    # Register feedback collector with RealtimeService
                    response = await client.post(
                        f"{self.api_url}/api/realtime/register",
                        json={
                            "service_type": "user_feedback_collector",
                            "ws_endpoint": self.ws_url or "/ws/feedback"
                        }
                    )
                    
                    if response.status_code == 200:
                        logger.info("Successfully integrated with RealtimeService")
                        return
                    else:
                        raise httpx.HTTPStatusError(
                            f"HTTP {response.status_code}: {response.text}",
                            request=response.request,
                            response=response
                        )
                        
            except Exception as e:
                logger.warning(f"RealtimeService integration attempt {attempt + 1} failed: {e}")
                if attempt < len(self.exponential_backoff) - 1:
                    await asyncio.sleep(delay)
                else:
                    logger.error("Failed to integrate with RealtimeService after all attempts")
    
    def save_feedback_to_database(self, output_dir: str = "deliverables/compliance/evidence"):
        """
        Save collected feedback to database/file for compliance evidence.
        
        Args:
            output_dir: Output directory for compliance evidence
        """
        try:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            feedback_file = output_path / f"user_feedback_{timestamp}.json"
            
            with self.feedback_lock:
                feedback_data = {
                    "total_feedback": len(self.feedback_storage),
                    "feedback_entries": [asdict(fb) for fb in self.feedback_storage],
                    "analytics": asdict(asyncio.run(self.analyze_feedback())),
                    "rollout_contexts": {k: asdict(v) for k, v in self.rollout_contexts.items()},
                    "export_timestamp": datetime.utcnow().isoformat() + 'Z'
                }
            
            # Use orjson for safe serialization
            with open(feedback_file, 'wb') as f:
                f.write(safe_serialize_message(feedback_data))
            
            logger.info(f"Feedback data saved to {feedback_file}")
            
        except Exception as e:
            logger.error(f"Failed to save feedback data: {e}")

async def main():
    """Main function for user feedback collection demo"""
    
    # Configuration
    API_URL = "http://localhost:8000"
    WS_URL = "/ws/feedback"
    
    # Initialize feedback collector
    collector = UserFeedbackCollector(api_url=API_URL, ws_url=WS_URL)
    
    # Integrate with RealtimeService
    await collector.integrate_with_realtime_service()
    
    # Simulate feedback collection
    logger.info("Starting user feedback collection demo...")
    
    # Track feature flag rollouts
    await collector.track_feature_flag_rollout("ff.hierarchy_optimized", 25.0)
    await collector.track_feature_flag_rollout("ff.ws_v1", 50.0)
    await collector.track_feature_flag_rollout("ff.map_v1", 75.0)
    
    # Simulate user feedback
    feedback_samples = [
        {
            "user_id": "user_001",
            "feature_flag": "ff.hierarchy_optimized",
            "rollout_percentage": 25.0,
            "feedback_type": "positive",
            "sentiment_score": 0.8,
            "feedback_text": "Performance improvements are noticeable!",
            "metadata": {"device": "desktop", "browser": "chrome"}
        },
        {
            "user_id": "user_002",
            "feature_flag": "ff.ws_v1",
            "rollout_percentage": 50.0,
            "feedback_type": "negative",
            "sentiment_score": 0.3,
            "feedback_text": "Experiencing connection issues",
            "metadata": {"device": "mobile", "browser": "safari"}
        },
        {
            "user_id": "user_003",
            "feature_flag": "ff.map_v1",
            "rollout_percentage": 75.0,
            "feedback_type": "positive",
            "sentiment_score": 0.9,
            "feedback_text": "Love the new map features!",
            "metadata": {"device": "tablet", "browser": "firefox"}
        }
    ]
    
    for feedback_data in feedback_samples:
        feedback = await collector.collect_feedback(feedback_data)
        logger.info(f"Collected: {feedback.feedback_id}")
        await asyncio.sleep(0.5)
    
    # Analyze feedback
    analytics = await collector.analyze_feedback()
    logger.info(f"Analytics: {analytics.total_feedback_count} feedbacks, avg sentiment: {analytics.average_sentiment_score:.2f}")
    
    # Check risk conditions
    for flag_name in ["ff.hierarchy_optimized", "ff.ws_v1", "ff.map_v1"]:
        recommendation = await collector.recommend_rollback(flag_name)
        if recommendation["should_rollback"]:
            logger.warning(f"Rollback recommended for {flag_name}")
    
    # Save feedback data
    collector.save_feedback_to_database()
    
    logger.info("User feedback collection demo completed")

if __name__ == "__main__":
    asyncio.run(main())