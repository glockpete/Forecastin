# ML A/B Testing Framework Integration Plan

## Overview

This document outlines the integration strategy for the ML model A/B testing framework with the existing Forecastin platform infrastructure, focusing on seamless integration with the feature flag service and entity extraction pipeline while maintaining validated performance metrics.

## Integration Architecture

### System Components Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                    Forecastin Platform                           │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React Query + Zustand + WebSocket)                  │
├─────────────────────────────────────────────────────────────────┤
│  API Layer (FastAPI with orjson serialization)                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Feature Flag    │ │ Entity Extract  │ │ A/B Testing     │    │
│  │ Service         │ │ Pipeline        │ │ Service         │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Redis Cache     │ │ PostgreSQL DB   │ │ WebSocket       │    │
│  │ (L2 Cache)      │ │ (L3/L4 Cache)   │ │ Manager         │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ L1 Cache        │ │ LTREE Material  │ │ Risk Evaluation │    │
│  │ (Memory LRU)    │ │ Views           │ │ Engine          │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Feature Flag Service Integration

### Existing Feature Flag Architecture
The Forecastin platform uses a centralized feature flag service with the following characteristics:
- **Rollout Strategy**: 10% → 25% → 50% → 100% gradual rollout
- **Key Flags**: `ff.hierarchy_optimized`, `ff.ws_v1`, `ff.map_v1`, `ff.ab_routing`
- **Storage**: PostgreSQL with Redis caching
- **API**: RESTful endpoints with user-based targeting

### A/B Testing Integration Points

#### 1.1 Flag Dependency Management
```python
class ABTestingFeatureFlags:
    def __init__(self, feature_flag_service: FeatureFlagService):
        self.ff_service = feature_flag_service
    
    async def is_ab_testing_enabled(self, user_id: str) -> bool:
        """Check if A/B testing is enabled for user"""
        # Primary flag check
        ab_enabled = await self.ff_service.is_enabled("ff.ab_routing", user_id)
        
        # Dependency chain validation
        if ab_enabled:
            # Ensure entity extraction is also enabled
            extraction_enabled = await self.ff_service.is_enabled("ff.entity_extraction_v1", user_id)
            if not extraction_enabled:
                logger.warning("A/B testing requires entity extraction to be enabled")
                return False
        
        return ab_enabled
    
    async def get_rollout_percentage(self, test_id: str) -> int:
        """Get current rollout percentage with dependency validation"""
        # Get base rollout from test configuration
        test_config = await self.get_test_config(test_id)
        base_percentage = test_config.get('rollout_percentage', 0)
        
        # Apply feature flag constraints
        global_rollout = await self.ff_service.get_rollout_percentage("ff.ab_routing")
        
        # Return minimum to ensure safety
        return min(base_percentage, global_rollout)
```

#### 1.2 Gradual Rollout Integration
```python
class GradualRolloutManager:
    def __init__(self, feature_flag_service: FeatureFlagService):
        self.ff_service = feature_flag_service
        self.rollout_stages = [10, 25, 50, 100]
    
    async def progress_rollout_stage(self, test_id: str) -> Dict:
        """Progress test through rollout stages"""
        current_stage = await self.get_current_rollout_stage(test_id)
        next_stage = self.get_next_rollout_stage(current_stage)
        
        if next_stage is None:
            return {"status": "completed", "message": "Test already at maximum rollout"}
        
        # Update feature flag for controlled rollout
        await self.ff_service.update_rollout_percentage(
            f"ff.ab_test_{test_id}", next_stage
        )
        
        # Update test registry
        await self.update_test_rollout_percentage(test_id, next_stage)
        
        # Notify via WebSocket
        await self.broadcast_rollout_update(test_id, next_stage)
        
        return {
            "status": "progressed",
            "from_stage": current_stage,
            "to_stage": next_stage,
            "test_id": test_id
        }
    
    def get_next_rollout_stage(self, current_stage: int) -> Optional[int]:
        """Get next rollout stage in progression"""
        try:
            current_index = self.rollout_stages.index(current_stage)
            return self.rollout_stages[current_index + 1] if current_index + 1 < len(self.rollout_stages) else None
        except ValueError:
            return self.rollout_stages[0]  # Start from beginning if invalid stage
```

#### 1.3 Flag-Based Test Lifecycle Management
```python
class FlagBasedTestLifecycle:
    async def start_test_with_flags(self, test_id: str) -> Dict:
        """Start test with proper feature flag setup"""
        try:
            # 1. Create test-specific feature flag
            await self.ff_service.create_flag(
                flag_name=f"ff.ab_test_{test_id}",
                description=f"A/B test {test_id} traffic routing",
                rollout_percentage=0  # Start with 0% rollout
            )
            
            # 2. Enable test in registry
            await self.update_test_status(test_id, "active")
            
            # 3. Begin gradual rollout
            await self.gradual_rollout_manager.progress_rollout_stage(test_id)
            
            return {"status": "started", "test_id": test_id}
        
        except Exception as e:
            logger.error(f"Failed to start test {test_id}: {e}")
            # Cleanup on failure
            await self.cleanup_failed_test_start(test_id)
            raise
    
    async def rollback_with_flags(self, test_id: str, reason: str) -> Dict:
        """Execute rollback with proper flag management"""
        try:
            # 1. CRITICAL: Disable feature flags FIRST
            await self.ff_service.disable_flag(f"ff.ab_test_{test_id}")
            
            # 2. Update test registry
            await self.update_test_status(test_id, "rolled_back", reason)
            
            # 3. Clear caches
            await self.clear_test_caches(test_id)
            
            # 4. Notify stakeholders
            await self.notify_rollback(test_id, reason)
            
            return {"status": "rolled_back", "test_id": test_id, "reason": reason}
        
        except Exception as e:
            logger.error(f"Rollback failed for test {test_id}: {e}")
            # Force cleanup even if rollback fails
            await self.force_cleanup_test(test_id)
            raise
```

## 2. Entity Extraction Pipeline Integration

### Existing Entity Extraction Architecture
The entity extraction system implements:
- **5-W Framework**: Who, What, Where, When, Why entity types
- **Confidence Scoring**: Rule-based calibration (not just model confidence)
- **Deduplication**: Similarity threshold (0.8) with canonical key assignment
- **Performance**: <1.25ms extraction latency, 42,726 RPS throughput

### A/B Testing Integration Points

#### 2.1 Model Variant Selection
```python
class ABTestingEntityExtractor:
    def __init__(self, ab_testing_service: ABTestingService):
        self.ab_testing_service = ab_testing_service
        self.model_variants = {
            'baseline_rule_based': BaselineRuleBasedExtractor(),
            'llm_v1': LLMExtractorV1(),
            'llm_v2': LLMExtractorV2(),
            'llm_v2_enhanced': LLMExtractorV2Enhanced(),
            'hybrid_v1': HybridExtractorV1()
        }
    
    async def extract_entities_with_ab_testing(
        self, 
        content: str, 
        user_id: str, 
        session_id: str,
        source_id: Optional[str] = None
    ) -> Dict:
        """Perform entity extraction with A/B testing integration"""
        
        start_time = time.time()
        assignment = None
        
        try:
            # 1. Get model variant assignment
            assignment = await self.ab_testing_service.get_assignment(
                user_id=user_id, 
                session_id=session_id
            )
            
            if not assignment:
                # Fallback to champion model
                assignment = await self.ab_testing_service.get_champion_assignment()
            
            # 2. Select appropriate extractor
            extractor = self.model_variants[assignment.variant]
            
            # 3. Perform extraction with monitoring
            entities = await extractor.extract_entities(
                content=content,
                config={
                    'confidence_threshold': assignment.confidence_threshold,
                    'similarity_threshold': 0.8,
                    'source_id': source_id
                }
            )
            
            extraction_time = time.time() - start_time
            
            # 4. Apply 5-W framework enrichment
            entities = await self.apply_5w_framework(entities)
            
            # 5. Apply rule-based confidence calibration
            entities = await self.apply_confidence_calibration(entities)
            
            # 6. Perform deduplication
            entities = await self.apply_deduplication(entities)
            
            # 7. Submit performance metrics for A/B test evaluation
            await self.submit_extraction_metrics(
                assignment.test_id,
                assignment.variant,
                {
                    'latency_ms': extraction_time * 1000,
                    'entities_processed': len(entities),
                    'average_confidence': self.calculate_average_confidence(entities),
                    'deduplication_rate': self.calculate_deduplication_rate(entities),
                    'extraction_success_rate': 1.0 if entities else 0.0
                }
            )
            
            return {
                'extraction_id': self.generate_extraction_id(),
                'variant_used': assignment.variant,
                'entities_extracted': entities,
                'processing_metrics': {
                    'extraction_time_ms': extraction_time * 1000,
                    'entities_processed': len(entities),
                    'cache_hit_rate': await self.get_cache_hit_rate(),
                    'test_id': assignment.test_id
                }
            }
        
        except Exception as e:
            extraction_time = time.time() - start_time
            
            # Submit error metrics
            if assignment:
                await self.submit_error_metrics(
                    assignment.test_id,
                    assignment.variant,
                    {
                        'error_type': type(e).__name__,
                        'error_message': str(e),
                        'extraction_time_ms': extraction_time * 1000,
                        'content_length': len(content)
                    }
                )
            
            # Log error with context
            logger.error(
                f"Entity extraction failed for user {user_id}, "
                f"variant {assignment.variant if assignment else 'unknown'}: {e}"
            )
            
            raise
```

#### 2.2 5-W Framework Integration
```python
class FiveWFrameworkIntegration:
    def __init__(self, hierarchy_resolver: OptimizedHierarchyResolver):
        self.hierarchy_resolver = hierarchy_resolver
        self.entity_types = ['who', 'what', 'where', 'when', 'why']
    
    async def apply_5w_framework(self, entities: List[Entity]) -> List[Entity]:
        """Apply 5-W framework classification and enrichment"""
        
        for entity in entities:
            # Classify entity into 5-W framework
            entity_type = self.classify_entity_type(entity)
            entity.metadata['type'] = entity_type
            
            # Enrich with 5-W specific attributes
            if entity_type == 'who':
                entity = await self.enrich_person_organization_entity(entity)
            elif entity_type == 'what':
                entity = await self.enrich_event_entity(entity)
            elif entity_type == 'where':
                entity = await self.enrich_location_entity(entity)
            elif entity_type == 'when':
                entity = await self.enrich_temporal_entity(entity)
            elif entity_type == 'why':
                entity = await self.enrich_causal_entity(entity)
            
            # Integrate with LTREE hierarchy
            if hasattr(entity, 'hierarchy_path'):
                entity = await self.integrate_with_hierarchy(entity)
        
        return entities
    
    def classify_entity_type(self, entity: Entity) -> str:
        """Classify entity into 5-W framework type"""
        # Implement classification logic based on entity attributes
        if entity.entity_type in ['person', 'organization']:
            return 'who'
        elif entity.entity_type in ['event', 'action']:
            return 'what'
        elif entity.entity_type in ['location', 'place', 'country', 'city']:
            return 'where'
        elif entity.entity_type in ['time', 'date', 'temporal']:
            return 'when'
        elif entity.entity_type in ['cause', 'motive', 'reason']:
            return 'why'
        else:
            return 'what'  # Default fallback
```

#### 2.3 Rule-Based Confidence Calibration
```python
class RuleBasedConfidenceCalibration:
    def __init__(self, hierarchy_resolver: OptimizedHierarchyResolver):
        self.hierarchy_resolver = hierarchy_resolver
        self.calibration_rules = self.load_calibration_rules()
    
    async def apply_confidence_calibration(self, entities: List[Entity]) -> List[Entity]:
        """Apply rule-based confidence calibration"""
        
        for entity in entities:
            # Calculate base confidence
            base_confidence = entity.confidence_score
            
            # Apply calibration factors
            calibrated_confidence = await self.calculate_calibrated_confidence(
                entity, base_confidence
            )
            
            entity.confidence_score = calibrated_confidence
            
            # Add confidence factors to metadata
            entity.metadata['confidence_factors'] = await self.get_confidence_factors(
                entity
            )
        
        return entities
    
    async def calculate_calibrated_confidence(self, entity: Entity, base_confidence: float) -> float:
        """Calculate calibrated confidence using rule-based factors"""
        
        factors = {
            'base_confidence': base_confidence * 0.4,
            'source_reliability': await self.calculate_source_reliability(entity) * 0.2,
            'contextual_consistency': await self.calculate_contextual_consistency(entity) * 0.15,
            'temporal_coherence': await self.calculate_temporal_coherence(entity) * 0.15,
            'geographic_plausibility': await self.calculate_geographic_plausibility(entity) * 0.1
        }
        
        calibrated_confidence = sum(factors.values())
        return min(calibrated_confidence, 1.0)  # Cap at 1.0
```

## 3. Performance Optimization Integration

### Validated Performance Maintenance
The integration must maintain the validated performance metrics:
- **Ancestor Resolution**: 1.25ms (P95: 1.87ms)
- **Throughput**: 42,726 RPS
- **Cache Hit Rate**: 99.2%

### 3.1 Four-Tier Cache Coordination
```python
class ABTestingCacheCoordinator:
    def __init__(self, cache_service: CacheService):
        self.cache_service = cache_service
        self.test_assignment_cache = {}  # L1: Thread-safe with RLock
        self.variant_performance_cache = {}  # L1: Recent performance data
    
    async def get_assignment_with_caching(self, test_id: str, user_id: str) -> Dict:
        """Get assignment with four-tier caching"""
        
        # L1: Memory cache (RLock synchronized)
        with self.cache_service.rlock:
            cache_key = f"{test_id}:{user_id}"
            if cache_key in self.test_assignment_cache:
                return self.test_assignment_cache[cache_key]
        
        # L2: Redis cache
        redis_key = f"ab_test:assignments:{test_id}:{user_id}"
        assignment = await self.cache_service.redis_pool.get(redis_key)
        if assignment:
            # Cache in L1
            with self.cache_service.rlock:
                self.test_assignment_cache[cache_key] = orjson.loads(assignment)
            return orjson.loads(assignment)
        
        # L3: PostgreSQL cache (materialized views)
        assignment = await self.get_assignment_from_database(test_id, user_id)
        if assignment:
            # Cache in L2 and L1
            await self.cache_service.redis_pool.set(redis_key, orjson.dumps(assignment))
            with self.cache_service.rlock:
                self.test_assignment_cache[cache_key] = assignment
        
        return assignment
    
    async def invalidate_test_caches(self, test_id: str):
        """Invalidate caches across all tiers for specific test"""
        
        # L1: Clear memory cache
        with self.cache_service.rlock:
            keys_to_remove = [k for k in self.test_assignment_cache.keys() if k.startswith(f"{test_id}:")]
            for key in keys_to_remove:
                del self.test_assignment_cache[key]
        
        # L2: Clear Redis cache
        redis_pattern = f"ab_test:assignments:{test_id}:*"
        await self.cache_service.redis_pool.delete_pattern(redis_pattern)
        
        # L3: Invalidate materialized views (L4)
        await self.refresh_materialized_views()
```

### 3.2 Connection Pool Integration
```python
class ABTestingConnectionManager:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.connection_pool = db_manager.get_pool()
    
    async def execute_with_retry(self, query: str, params: tuple) -> Any:
        """Execute query with exponential backoff retry"""
        
        max_attempts = 3
        base_delay = 0.5
        
        for attempt in range(max_attempts):
            try:
                # Test connection health before use
                if not await self.health_check_connection():
                    raise Exception("Connection health check failed")
                
                # Execute query
                result = await self.db_manager.execute_query(query, params)
                return result
                
            except Exception as e:
                if attempt == max_attempts - 1:
                    logger.error(f"Query failed after {max_attempts} attempts: {e}")
                    raise
                
                # Exponential backoff
                delay = base_delay * (2 ** attempt)
                logger.warning(f"Query attempt {attempt + 1} failed, retrying in {delay}s: {e}")
                await asyncio.sleep(delay)
    
    async def health_check_connection(self) -> bool:
        """Check connection pool health with TCP keepalives"""
        try:
            # Use pool_pre_ping to test connection
            async with self.connection_pool.acquire() as conn:
                await conn.execute("SELECT 1")
            return True
        except Exception:
            return False
```

## 4. WebSocket Integration

### Real-time Updates with orjson
```python
class ABTestingWebSocketHandler:
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.client_subscriptions = {}  # Track client subscriptions to tests
    
    async def subscribe_to_test_updates(self, client_id: str, test_id: str):
        """Subscribe client to test-specific updates"""
        if test_id not in self.client_subscriptions:
            self.client_subscriptions[test_id] = set()
        self.client_subscriptions[test_id].add(client_id)
        
        # Send initial test state
        await self.send_test_status_update(client_id, test_id)
    
    async def broadcast_test_update(self, test_id: str, update_type: str, data: Dict):
        """Broadcast test updates to subscribed clients"""
        
        if test_id not in self.client_subscriptions:
            return
        
        message = {
            "type": "ab_test_update",
            "test_id": test_id,
            "update_type": update_type,
            "data": data,
            "timestamp": time.time()
        }
        
        # Use safe_serialize_message for WebSocket
        serialized_message = safe_serialize_message(message)
        
        disconnected_clients = []
        for client_id in self.client_subscriptions[test_id]:
            try:
                await self.connection_manager.send_personal_message(
                    serialized_message, client_id
                )
            except Exception as e:
                logger.error(f"Failed to send update to client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Cleanup disconnected clients
        for client_id in disconnected_clients:
            await self.unsubscribe_client(client_id, test_id)
    
    async def send_risk_alert(self, test_id: str, risk_level: str, triggered_conditions: List[str]):
        """Send immediate risk alert via WebSocket"""
        
        alert_message = {
            "type": "risk_alert",
            "test_id": test_id,
            "risk_level": risk_level,
            "triggered_conditions": triggered_conditions,
            "timestamp": time.time(),
            "requires_action": risk_level in ["high", "critical"]
        }
        
        await self.broadcast_test_update(
            test_id, 
            "risk_alert", 
            alert_message
        )
```

## 5. Integration Testing Strategy

### 5.1 Performance Testing
```python
class ABTestingPerformanceTests:
    async def validate_extraction_performance(self):
        """Validate entity extraction maintains <1.25ms latency"""
        
        test_scenarios = [
            {"content": "short_text", "expected_time": 0.5},
            {"content": "medium_text", "expected_time": 1.0},
            {"content": "long_text", "expected_time": 1.25}
        ]
        
        for scenario in test_scenarios:
            start_time = time.time()
            
            # Test with A/B testing enabled
            entities = await self.entity_extractor.extract_entities_with_ab_testing(
                content=scenario["content"],
                user_id="test_user",
                session_id="test_session"
            )
            
            extraction_time = time.time() - start_time
            
            assert extraction_time <= scenario["expected_time"], \
                f"Extraction time {extraction_time}s exceeded {scenario['expected_time']}s"
            
            # Validate entities extracted
            assert len(entities) > 0, "No entities extracted"
    
    async def validate_cache_performance(self):
        """Validate cache hit rate remains >99%"""
        
        # Clear cache
        await self.cache_service.clear_all()
        
        # Perform 1000 extractions
        for i in range(1000):
            await self.entity_extractor.extract_entities_with_ab_testing(
                content=f"test content {i}",
                user_id=f"user_{i}",
                session_id=f"session_{i}"
            )
        
        # Check cache hit rate
        cache_stats = await self.cache_service.get_stats()
        hit_rate = cache_stats.get('hit_rate', 0)
        
        assert hit_rate >= 0.99, f"Cache hit rate {hit_rate} below 99%"
```

### 5.2 Integration Test Suite
```python
class ABTestingIntegrationTests:
    async def test_full_integration_flow(self):
        """Test complete A/B testing integration flow"""
        
        # 1. Create test
        test_config = {
            "test_name": "integration_test",
            "champion_variant": "baseline_rule_based",
            "challenger_variant": "llm_v2"
        }
        
        test_response = await self.ab_testing_client.create_test(test_config)
        test_id = test_response["test_id"]
        
        # 2. Start test
        await self.ab_testing_client.start_test(test_id)
        
        # 3. Perform entity extraction
        extraction_result = await self.entity_extractor.extract_entities_with_ab_testing(
            content="President Biden announced new climate policies in Washington DC yesterday",
            user_id="integration_test_user",
            session_id="integration_test_session"
        )
        
        # 4. Validate results
        assert extraction_result["variant_used"] in ["baseline_rule_based", "llm_v2"]
        assert len(extraction_result["entities_extracted"]) > 0
        
        # 5. Check metrics submission
        await asyncio.sleep(1)  # Wait for metrics processing
        metrics = await self.ab_testing_client.get_test_metrics(test_id)
        assert len(metrics["metrics"]) > 0
        
        # 6. Cleanup
        await self.ab_testing_client.delete_test(test_id)
```

## 6. Deployment Strategy

### 6.1 Phased Rollout
```python
class IntegrationDeploymentManager:
    async def deploy_with_phased_rollout(self):
        """Deploy A/B testing integration with phased rollout"""
        
        phases = [
            {"name": "foundation", "percentage": 10, "duration": "1 day"},
            {"name": "core_integration", "percentage": 25, "duration": "2 days"},
            {"name": "performance_validation", "percentage": 50, "duration": "3 days"},
            {"name": "full_deployment", "percentage": 100, "duration": "ongoing"}
        ]
        
        for phase in phases:
            logger.info(f"Starting deployment phase: {phase['name']}")
            
            # Update rollout percentage
            await self.feature_flag_service.update_rollout_percentage(
                "ff.ab_routing", phase["percentage"]
            )
            
            # Run validation tests
            if phase["name"] != "full_deployment":
                await self.run_phase_validation_tests(phase["percentage"])
            
            # Monitor for issues
            await self.monitor_deployment_phase(phase)
            
            if phase["name"] != "full_deployment":
                # Wait before next phase
                await asyncio.sleep(self.parse_duration(phase["duration"]))
        
        logger.info("A/B testing integration deployment completed")
```

### 6.2 Rollback Procedures
```python
class IntegrationRollbackManager:
    async def execute_integration_rollback(self, reason: str):
        """Execute complete integration rollback"""
        
        logger.info(f"Executing integration rollback: {reason}")
        
        # 1. Disable all A/B testing flags
        await self.feature_flag_service.disable_flags([
            "ff.ab_routing",
            "ff.ab_auto_rollback",
            "ff.ab_risk_monitoring"
        ])
        
        # 2. Stop all active tests
        active_tests = await self.ab_testing_service.get_active_tests()
        for test in active_tests:
            await self.ab_testing_service.pause_test(test.id, "integration_rollback")
        
        # 3. Clear all caches
        await self.cache_service.clear_all()
        
        # 4. Reset connection pools
        await self.connection_manager.reset_pools()
        
        # 5. Refresh materialized views
        await self.refresh_materialized_views()
        
        # 6. Notify stakeholders
        await self.notify_rollback(reason)
        
        logger.info("Integration rollback completed")
```

## 7. Monitoring and Observability

### 7.1 Integration Health Dashboard
```python
class IntegrationHealthMonitor:
    async def get_integration_health_status(self) -> Dict:
        """Get comprehensive integration health status"""
        
        health_status = {
            "overall_status": "healthy",
            "components": {},
            "performance_metrics": {},
            "integration_points": {}
        }
        
        # Check individual component health
        components = [
            ("feature_flag_service", self.check_feature_flag_health),
            ("entity_extraction", self.check_entity_extraction_health),
            ("ab_testing_service", self.check_ab_testing_health),
            ("cache_service", self.check_cache_health),
            ("websocket_service", self.check_websocket_health)
        ]
        
        for component_name, health_check in components:
            try:
                health = await health_check()
                health_status["components"][component_name] = health
                if health["status"] != "healthy":
                    health_status["overall_status"] = "degraded"
            except Exception as e:
                health_status["components"][component_name] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                health_status["overall_status"] = "unhealthy"
        
        # Check integration performance
        health_status["performance_metrics"] = await self.get_integration_metrics()
        
        # Check integration points
        health_status["integration_points"] = await self.check_integration_points()
        
        return health_status
```

### 7.2 Automated Alerting
```python
class IntegrationAlertManager:
    def __init__(self, monitoring_service: MonitoringService):
        self.monitoring_service = monitoring_service
        self.alert_thresholds = self.load_alert_thresholds()
    
    async def check_integration_alerts(self):
        """Check for integration-specific alerts"""
        
        # Performance degradation alerts
        perf_metrics = await self.get_integration_performance_metrics()
        
        if perf_metrics["extraction_latency_ms"] > self.alert_thresholds["latency_threshold"]:
            await self.send_alert(
                "performance_degradation",
                f"Entity extraction latency: {perf_metrics['extraction_latency_ms']}ms"
            )
        
        # Cache performance alerts
        if perf_metrics["cache_hit_rate"] < self.alert_thresholds["cache_hit_threshold"]:
            await self.send_alert(
                "cache_performance",
                f"Cache hit rate degraded: {perf_metrics['cache_hit_rate']}"
            )
        
        # Integration failure alerts
        integration_health = await self.integration_health_monitor.get_integration_health_status()
        if integration_health["overall_status"] == "unhealthy":
            await self.send_alert(
                "integration_failure",
                "Critical integration component failure detected"
            )
```

This integration plan ensures seamless coordination between the ML A/B testing framework and existing Forecastin platform infrastructure while maintaining validated performance metrics and architectural constraints.