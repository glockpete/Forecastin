# ML Model A/B Testing Framework Architecture - Forecastin Platform

## Overview

This document outlines the ML model A/B testing framework for the Forecastin platform, designed to safely deploy and test new ML models (primarily for entity extraction) alongside existing ones. The framework implements a persistent Test Registry with automatic rollback capabilities and integrates with the existing feature flag system.

## Critical Architectural Constraints

### Non-Negotiable Requirements from AGENTS.md
- **Persistent Test Registry**: Must use Redis/DB storage - in-memory tracking fails on lookup
- **7 Configurable Risk Conditions**: Automatic rollback triggers for model safety
- **Gradual Rollout**: 10% → 25% → 50% → 100% traffic allocation
- **Performance Maintenance**: Must maintain validated metrics (1.25ms latency, 42,726 RPS, 99.2% cache hit rate)
- **Four-Tier Caching Integration**: L1 (RLock) → L2 (Redis) → L3 (DB) → L4 (Materialized Views)

## Core Architecture Components

### 1. Model Variant Management

#### Supported Model Variants (5 minimum)
- `baseline_rule_based`: Baseline rule-based entity extraction
- `llm_v1`: First-generation LLM-based extraction
- `llm_v2`: Enhanced LLM model with improved accuracy
- `llm_v2_enhanced`: LLM v2 with additional training data
- `hybrid_v1`: Hybrid approach combining rules and LLM

#### Model Registry Schema
```sql
-- Migration: 002_ml_ab_testing_framework.sql
CREATE TABLE model_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_name TEXT UNIQUE NOT NULL, -- 'baseline_rule_based', 'llm_v1', etc.
    model_type TEXT NOT NULL, -- 'rule_based', 'llm', 'hybrid'
    model_version TEXT NOT NULL,
    model_config JSONB NOT NULL, -- Model-specific configuration
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ab_test_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_name TEXT NOT NULL,
    champion_variant_id UUID REFERENCES model_variants(id),
    challenger_variant_id UUID REFERENCES model_variants(id),
    test_status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed', 'rolled_back'
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    risk_conditions JSONB NOT NULL, -- 7 configurable risk conditions
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE test_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID REFERENCES ab_test_registry(id),
    user_id TEXT NOT NULL, -- or session_id for anonymous users
    assigned_variant_id UUID REFERENCES model_variants(id),
    assignment_reason TEXT NOT NULL, -- 'random', 'user_based', 'sticky'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(test_id, user_id)
);

-- Materialized view for test performance analytics
CREATE MATERIALIZED VIEW mv_test_performance AS
SELECT 
    t.test_name,
    t.test_status,
    mv_champion.variant_name as champion_variant,
    mv_challenger.variant_name as challenger_variant,
    t.rollout_percentage,
    COUNT(ta.id) as assignments_count,
    AVG(pm.accuracy) as avg_accuracy,
    AVG(pm.latency_ms) as avg_latency_ms
FROM ab_test_registry t
LEFT JOIN model_variants mv_champion ON t.champion_variant_id = mv_champion.id
LEFT JOIN model_variants mv_challenger ON t.challenger_variant_id = mv_challenger.id
LEFT JOIN test_assignments ta ON t.id = ta.test_id
LEFT JOIN LATERAL (
    SELECT 
        (t.performance_metrics->>'accuracy')::DECIMAL as accuracy,
        (t.performance_metrics->>'latency_ms')::DECIMAL as latency_ms
) pm ON true
GROUP BY t.id, mv_champion.variant_name, mv_challenger.variant_name;
```

### 2. Persistent Test Registry Design

#### Redis Storage Structure
```python
# Redis key patterns for persistent test registry
TEST_REGISTRY_PREFIX = "ab_test:registry:"
TEST_ASSIGNMENTS_PREFIX = "ab_test:assignments:"
TEST_METRICS_PREFIX = "ab_test:metrics:"

# Example Redis keys
# ab_test:registry:{test_id} -> JSON test configuration
# ab_test:assignments:{test_id}:{user_id} -> assigned variant
# ab_test:metrics:{test_id}:{timestamp} -> performance metrics
```

#### Database Fallback Strategy
- **Primary**: Redis for fast lookups and assignments
- **Secondary**: PostgreSQL for persistent storage and analytics
- **Synchronization**: Real-time sync between Redis and PostgreSQL

### 3. 7 Configurable Risk Conditions

#### Automatic Rollback Triggers
1. **Accuracy Drop**: Model accuracy drops below threshold (configurable: default <0.85)
2. **Latency Spike**: Processing latency exceeds threshold (configurable: default >2ms)
3. **Confidence Drift**: Confidence score distribution shifts significantly
4. **Error Rate Increase**: Error rate exceeds threshold (configurable: default >5%)
5. **Cache Miss Spike**: Cache hit rate drops below threshold (configurable: default <98%)
6. **Throughput Degradation**: Throughput drops below threshold (configurable: default <30,000 RPS)
7. **Anomaly Detection**: Statistical anomaly in model output patterns

#### Risk Condition Configuration
```json
{
  "risk_conditions": {
    "accuracy_threshold": 0.85,
    "latency_threshold_ms": 2.0,
    "error_rate_threshold": 0.05,
    "cache_hit_threshold": 0.98,
    "throughput_threshold_rps": 30000,
    "confidence_drift_threshold": 0.1,
    "anomaly_detection_sensitivity": "high"
  }
}
```

## API Endpoint Specifications

### A/B Testing Management API

#### POST /api/ab-testing/tests
**Purpose**: Create new A/B test

**Request Body**:
```json
{
  "test_name": "llm_v2_vs_baseline",
  "champion_variant": "baseline_rule_based",
  "challenger_variant": "llm_v2",
  "rollout_strategy": "gradual", // or "immediate"
  "risk_conditions": {
    "accuracy_threshold": 0.85,
    "latency_threshold_ms": 2.0
  }
}
```

**Response**:
```json
{
  "test_id": "uuid",
  "status": "created",
  "assignment_endpoint": "/api/ab-testing/tests/{test_id}/assign"
}
```

#### GET /api/ab-testing/tests/{test_id}/assign
**Purpose**: Get model variant assignment for user/session

**Response**:
```json
{
  "variant": "llm_v2",
  "test_id": "uuid",
  "assignment_reason": "random",
  "confidence_threshold": 0.7
}
```

#### POST /api/ab-testing/tests/{test_id}/metrics
**Purpose**: Submit performance metrics for test evaluation

**Request Body**:
```json
{
  "variant": "llm_v2",
  "metrics": {
    "accuracy": 0.92,
    "latency_ms": 1.25,
    "entities_processed": 150,
    "cache_hit_rate": 0.992
  },
  "timestamp": "2025-11-04T19:17:51Z"
}
```

#### GET /api/ab-testing/tests/{test_id}/status
**Purpose**: Get test status and risk assessment

**Response**:
```json
{
  "test_status": "active",
  "rollout_percentage": 25,
  "risk_assessment": {
    "triggered_conditions": [],
    "overall_risk": "low",
    "recommendation": "continue"
  },
  "performance_comparison": {
    "champion": {"accuracy": 0.88, "latency_ms": 1.25},
    "challenger": {"accuracy": 0.92, "latency_ms": 1.28}
  }
}
```

## Integration with Existing Systems

### Feature Flag Integration
```python
class ABTestingFeatureFlags:
    def __init__(self, feature_flag_service: FeatureFlagService):
        self.ff_service = feature_flag_service
    
    async def is_ab_testing_enabled(self, user_id: str) -> bool:
        """Check if A/B testing is enabled for user"""
        return await self.ff_service.is_enabled("ff.ab_routing", user_id)
    
    async def get_rollout_percentage(self, test_id: str) -> int:
        """Get current rollout percentage for test"""
        # Integrate with gradual rollout: 10% → 25% → 50% → 100%
        test_config = await self.get_test_config(test_id)
        return test_config.get('rollout_percentage', 0)
```

### Entity Extraction Pipeline Integration
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
    
    async def extract_entities_with_ab_testing(self, content: str, user_id: str):
        """Perform entity extraction with A/B testing assignment"""
        # Get model variant assignment
        assignment = await self.ab_testing_service.get_assignment(user_id)
        variant = self.model_variants[assignment.variant]
        
        # Perform extraction with performance monitoring
        start_time = time.time()
        entities = await variant.extract_entities(content)
        extraction_time = time.time() - start_time
        
        # Submit metrics for risk assessment
        await self.ab_testing_service.submit_metrics(assignment.test_id, {
            'variant': assignment.variant,
            'latency_ms': extraction_time * 1000,
            'entities_processed': len(entities),
            'average_confidence': self.calculate_average_confidence(entities)
        })
        
        return entities
```

### Four-Tier Caching Integration
```python
class ABTestingCache:
    def __init__(self, cache_service: CacheService):
        self.cache_service = cache_service
        self.test_assignments = {}  # L1: Thread-safe with RLock
        self.performance_metrics = {}  # L1: Recent metrics cache
    
    async def get_assignment(self, test_id: str, user_id: str):
        """Get cached assignment with four-tier fallback"""
        # L1: Memory cache (RLock synchronized)
        with self.cache_service.rlock:
            key = f"{test_id}:{user_id}"
            if key in self.test_assignments:
                return self.test_assignments[key]
        
        # L2: Redis cache
        redis_key = f"ab_test:assignments:{test_id}:{user_id}"
        assignment = await self.cache_service.redis_pool.get(redis_key)
        if assignment:
            # Cache in L1
            with self.cache_service.rlock:
                self.test_assignments[key] = orjson.loads(assignment)
            return orjson.loads(assignment)
        
        # L3/L4: Database fallback
        assignment = await self.get_assignment_from_db(test_id, user_id)
        if assignment:
            # Cache in L2 and L1
            await self.cache_service.redis_pool.set(redis_key, orjson.dumps(assignment))
            with self.cache_service.rlock:
                self.test_assignments[key] = assignment
        
        return assignment
```

## Risk Management and Automatic Rollback

### Rollback Decision Engine
```python
class RollbackDecisionEngine:
    def __init__(self, risk_conditions: Dict):
        self.risk_conditions = risk_conditions
    
    async def assess_risk(self, test_id: str, metrics: Dict) -> Dict:
        """Assess risk based on 7 configurable conditions"""
        triggered_conditions = []
        
        # Condition 1: Accuracy drop
        if metrics.get('accuracy', 1.0) < self.risk_conditions['accuracy_threshold']:
            triggered_conditions.append('accuracy_drop')
        
        # Condition 2: Latency spike
        if metrics.get('latency_ms', 0) > self.risk_conditions['latency_threshold_ms']:
            triggered_conditions.append('latency_spike')
        
        # Condition 3-7: Other risk assessments...
        
        risk_level = self.calculate_risk_level(triggered_conditions)
        
        return {
            'triggered_conditions': triggered_conditions,
            'risk_level': risk_level,
            'recommendation': self.get_recommendation(risk_level)
        }
    
    async def trigger_rollback(self, test_id: str, reason: str):
        """Execute automatic rollback procedure"""
        # 1. Disable feature flag first
        await feature_flag_service.disable_flag(f"ff.ab_testing_{test_id}")
        
        # 2. Update test status
        await self.update_test_status(test_id, 'rolled_back', reason)
        
        # 3. Clear relevant cache layers
        await self.clear_test_caches(test_id)
        
        # 4. Notify via WebSocket
        await self.notify_rollback(test_id, reason)
```

### WebSocket Integration for Real-time Updates
```python
class ABTestingWebSocketHandler:
    async def send_test_update(self, client_id: str, test_id: str, update: Dict):
        """Send real-time A/B test updates"""
        message = {
            "type": "ab_test_update",
            "test_id": test_id,
            "update": update,
            "timestamp": time.time()
        }
        await connection_manager.send_personal_message(
            safe_serialize_message(message), client_id
        )
    
    async def broadcast_rollback_notification(self, test_id: str, reason: str):
        """Broadcast rollback notifications to all clients"""
        message = {
            "type": "ab_test_rollback",
            "test_id": test_id,
            "reason": reason,
            "timestamp": time.time()
        }
        await connection_manager.broadcast_message(
            safe_serialize_message(message)
        )
```

## Performance Considerations

### Maintaining Validated Metrics
- **Target**: Entity extraction latency <1.25ms (achieved: 1.25ms)
- **Target**: Throughput >10,000 RPS (achieved: 42,726 RPS)  
- **Target**: Cache hit rate >90% (achieved: 99.2%)

### Optimization Strategies
- **Batch Assignment Lookups**: Group user assignments to reduce Redis calls
- **Predictive Caching**: Pre-cache likely assignments based on user patterns
- **Materialized Views**: Use for test performance analytics
- **Connection Pooling**: TCP keepalives for database connections

## Compliance and Audit Requirements

### Automated Evidence Collection
```python
# Integration with existing compliance scripts
async def gather_ab_testing_evidence():
    """Collect A/B testing evidence for compliance"""
    evidence = {
        "test_registry": await get_all_active_tests(),
        "risk_assessments": await get_recent_risk_assessments(),
        "rollback_events": await get_rollback_history(),
        "performance_metrics": await get_performance_comparisons()
    }
    
    # Store in deliverables/compliance/evidence/
    await store_evidence("ab_testing", evidence)
```

### Audit Trail Requirements
- All test configuration changes
- Risk condition evaluations
- Rollback decisions and executions
- Performance metric submissions

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema for model variants and test registry
- [ ] Basic A/B testing service with Redis persistence
- [ ] Integration with existing feature flag system

### Phase 2: Risk Management (Week 3-4)
- [ ] Implement 7 configurable risk conditions
- [ ] Automatic rollback decision engine
- [ ] Real-time WebSocket notifications

### Phase 3: Performance Optimization (Week 5-6)
- [ ] Four-tier caching integration
- [ ] Materialized views for analytics
- [ ] Performance validation against SLOs

### Phase 4: Production Readiness (Week 7-8)
- [ ] Comprehensive testing and validation
- [ ] Compliance evidence collection
- [ ] Gradual rollout strategy implementation

## Risk Mitigation

### Performance Risks
- **Risk**: A/B testing overhead impacting 1.25ms latency
- **Mitigation**: Optimized assignment caching and batch processing
- **Fallback**: Disable A/B testing via feature flags if performance degrades

### Data Consistency Risks
- **Risk**: Test assignment inconsistencies between Redis and DB
- **Mitigation**: Real-time synchronization and conflict resolution
- **Fallback**: Database-first fallback strategy

### Model Safety Risks
- **Risk**: Faulty model variants causing system instability
- **Mitigation**: Comprehensive risk conditions and automatic rollback
- **Fallback**: Immediate fallback to baseline model

## Key Integration Points

### Existing Infrastructure Integration
- **Feature Flag Service**: Gradual rollout control
- **Entity Extraction Pipeline**: Model variant execution
- **Four-Tier Caching**: Performance optimization
- **WebSocket Infrastructure**: Real-time notifications
- **Compliance Framework**: Automated evidence collection

### Critical Dependencies
- Redis for persistent test registry
- PostgreSQL for analytics and fallback
- Existing performance monitoring infrastructure
- Feature flag management system

This architecture ensures the ML model A/B testing framework integrates seamlessly with the existing Forecastin platform while maintaining the validated performance metrics and architectural constraints.