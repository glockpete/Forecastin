# ML Model A/B Testing Framework - Comprehensive Architecture Design

## Executive Summary

This document presents the complete architecture design for the ML Model A/B Testing Framework in the Forecastin platform. The framework implements a persistent Test Registry with automatic rollback capabilities, integrating seamlessly with existing infrastructure while maintaining validated performance metrics.

## Architecture Overview

### System Context
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

## Core Architectural Components

### 1. Persistent Test Registry Design

#### Database Schema
The framework implements a comprehensive database schema with the following key tables:

- **model_variants**: Registry of ML model variants (5 minimum: baseline_rule_based, llm_v1, llm_v2, llm_v2_enhanced, hybrid_v1)
- **ab_test_registry**: Persistent test tracking with 7 configurable risk conditions
- **test_assignments**: User/session routing assignments with sticky sessions
- **test_performance_metrics**: Real-time performance tracking
- **risk_evaluations**: Risk condition evaluation history
- **rollback_events**: Complete audit trail of rollback operations

#### Materialized Views for Performance
- **mv_test_performance**: Aggregated test analytics for dashboard monitoring
- **mv_risk_assessment**: Real-time risk assessment data
- Integrated with existing `refresh_hierarchy_views()` function for coordinated refresh

### 2. 7 Configurable Risk Conditions

The framework implements comprehensive risk management with automatic rollback triggers:

1. **Accuracy Threshold**: Model accuracy drops below configurable threshold (default: <0.85)
2. **Latency Spike**: Processing latency exceeds threshold (default: >2.0ms)
3. **Confidence Drift**: Significant shifts in model confidence distribution
4. **Error Rate Increase**: Error rate exceeds threshold (default: >5%)
5. **Cache Performance Degradation**: Cache hit rate drops below threshold (default: <98%)
6. **Throughput Degradation**: Throughput drops below threshold (default: <30,000 RPS)
7. **Anomaly Detection**: Statistical anomaly in model output patterns

### 3. Four-Tier Caching Integration

The framework integrates with the existing four-tier caching strategy:

- **L1 (Memory)**: Thread-safe LRU with RLock synchronization
- **L2 (Redis)**: Shared across instances with connection pooling
- **L3 (Database)**: PostgreSQL buffer cache
- **L4 (Materialized Views)**: Database-level pre-computation cache

## API Design Specifications

### Core Endpoints

#### Test Management
- `POST /api/ab-testing/tests` - Create new A/B test
- `GET /api/ab-testing/tests/{test_id}` - Get test details
- `PATCH /api/ab-testing/tests/{test_id}` - Update test configuration
- `POST /api/ab-testing/tests/{test_id}/start` - Start test
- `POST /api/ab-testing/tests/{test_id}/pause` - Pause test
- `POST /api/ab-testing/tests/{test_id}/complete` - Complete test

#### Traffic Assignment
- `GET /api/ab-testing/tests/{test_id}/assign` - Get model variant assignment

#### Performance Metrics
- `POST /api/ab-testing/tests/{test_id}/metrics` - Submit performance metrics
- `GET /api/ab-testing/tests/{test_id}/metrics` - Get metrics history

#### Risk Management
- `GET /api/ab-testing/tests/{test_id}/status` - Comprehensive test status
- `GET /api/ab-testing/tests/{test_id}/risk-evaluation` - Risk evaluation history
- `POST /api/ab-testing/tests/{test_id}/manual-rollback` - Manual rollback trigger

### Data Models

#### Test Configuration
```json
{
  "test_name": "llm_v2_vs_baseline",
  "champion_variant": "baseline_rule_based",
  "challenger_variant": "llm_v2",
  "rollout_strategy": "gradual",
  "risk_conditions": {
    "accuracy_threshold": 0.85,
    "latency_threshold_ms": 2.0,
    "error_rate_threshold": 0.05,
    "cache_hit_threshold": 0.98,
    "throughput_threshold_rps": 30000
  }
}
```

#### Performance Metrics
```json
{
  "variant": "llm_v2",
  "metrics": {
    "accuracy": 0.92,
    "latency_ms": 1.28,
    "throughput_rps": 41250,
    "cache_hit_rate": 0.991,
    "entities_processed": 150
  }
}
```

## Integration Architecture

### 1. Feature Flag Service Integration

The framework integrates with the existing feature flag system for gradual rollout:

- **Gradual Rollout**: 10% → 25% → 50% → 100% traffic allocation
- **Flag Dependencies**: A/B testing requires entity extraction to be enabled
- **Rollback Safety**: Feature flags disabled first during rollback procedures

### 2. Entity Extraction Pipeline Integration

The framework extends the existing 5-W entity extraction framework:

- **Model Variant Selection**: Dynamic assignment based on A/B test configuration
- **5-W Framework**: Who, What, Where, When, Why entity classification
- **Rule-Based Confidence Calibration**: Multi-factor confidence scoring
- **Deduplication**: Similarity threshold (0.8) with canonical key assignment

### 3. WebSocket Integration

Real-time updates using the existing WebSocket infrastructure:

- **Safe Serialization**: `orjson` with custom `safe_serialize_message()` function
- **Real-time Notifications**: Test status updates, risk alerts, rollback notifications
- **Client Subscriptions**: Per-test subscription management

## Risk Management Framework

### Automatic Rollback Decision Engine

The framework implements a sophisticated risk assessment system:

```python
class RollbackDecisionEngine:
    async def assess_risk(self, test_id: str, metrics: Dict) -> Dict:
        # Evaluate 7 risk conditions
        triggered_conditions = self.evaluate_conditions(metrics)
        
        # Calculate weighted risk score
        risk_score = self.calculate_risk_score(triggered_conditions)
        
        # Determine rollback recommendation
        recommendation = self.get_recommendation(risk_score)
        
        return {
            'triggered_conditions': triggered_conditions,
            'risk_score': risk_score,
            'recommendation': recommendation
        }
```

### Rollback Execution Process

1. **Immediate Actions (0-30 seconds)**
   - Traffic cutoff to challenger variant
   - Assignment freeze
   - Cache invalidation
   - Status update

2. **Safe Transition (30-60 seconds)**
   - Champion restoration
   - Feature flag updates
   - Database synchronization
   - Stakeholder notification

3. **Cleanup (60-120 seconds)**
   - Cache layer cleanup
   - Connection pool reset
   - Metrics reset
   - Audit trail documentation

## Performance Considerations

### Validated Performance Metrics Maintained

The framework is designed to maintain the existing validated performance metrics:

- **Entity Extraction Latency**: <1.25ms (achieved: 1.25ms, P95: 1.87ms)
- **Throughput**: >42,000 RPS (achieved: 42,726 RPS)
- **Cache Hit Rate**: >99% (achieved: 99.2%)

### Optimization Strategies

- **Batch Assignment Lookups**: Group user assignments to reduce Redis calls
- **Predictive Caching**: Pre-cache likely assignments based on user patterns
- **Asynchronous Processing**: Non-blocking metric submission and risk evaluation
- **Connection Pooling**: TCP keepalives for database connections

## Compliance and Audit Requirements

### Automated Evidence Collection

The framework integrates with the existing compliance infrastructure:

- **Evidence Storage**: `deliverables/compliance/evidence/`
- **Automated Scripts**: Integration with `gather_metrics.py`, `check_consistency.py`, `fix_roadmap.py`
- **Audit Trail**: Complete logging of all test operations and rollback events

### Documentation Consistency

- **Machine-Readable Content**: Embedded JSON blocks in markdown documentation
- **Automated Validation**: Pre-commit hooks and CI/CD pipeline integration
- **Evidence Reporting**: Weekly/monthly/quarterly compliance reporting

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- Database schema implementation
- Basic A/B testing service with Redis persistence
- Feature flag system integration

### Phase 2: Risk Management (Week 3-4)
- 7 configurable risk conditions implementation
- Automatic rollback decision engine
- Real-time WebSocket notifications

### Phase 3: Performance Optimization (Week 5-6)
- Four-tier caching integration
- Materialized views for analytics
- Performance validation against SLOs

### Phase 4: Production Readiness (Week 7-8)
- Comprehensive testing and validation
- Compliance evidence collection
- Gradual rollout strategy implementation

## Risk Mitigation Strategies

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

## Critical Integration Points

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

## Monitoring and Observability

### Health Dashboard
The framework provides comprehensive monitoring capabilities:

- **Component Health**: Individual service status monitoring
- **Performance Metrics**: Real-time performance tracking
- **Integration Points**: Cross-system integration validation
- **Risk Assessment**: Continuous risk condition evaluation

### Alerting System
- **Warning Alerts**: Medium risk conditions or sustained medium risk
- **Critical Alerts**: High risk conditions or performance degradation
- **Emergency Alerts**: Critical risk conditions requiring immediate attention
- **Rollback Alerts**: Automatic or manual rollback execution

## Conclusion

The ML Model A/B Testing Framework represents a comprehensive solution for safely deploying and testing ML models in the Forecastin platform. By leveraging existing infrastructure and maintaining validated performance metrics, the framework provides:

1. **Safety**: Comprehensive risk management with automatic rollback
2. **Performance**: Maintains existing 1.25ms latency and 42,726 RPS throughput
3. **Integration**: Seamless coordination with feature flags, entity extraction, and caching
4. **Compliance**: Automated evidence collection and audit trail
5. **Scalability**: Designed to support 10,000+ geopolitical entities

This architecture ensures that ML model experimentation can proceed safely while maintaining the high-performance standards required for geopolitical intelligence analysis.

## Appendices

### Appendix A: Database Schema Reference
See [`migrations/002_ml_ab_testing_framework.sql`](migrations/002_ml_ab_testing_framework.sql) for complete schema definition.

### Appendix B: API Specifications
See [`docs/ML_AB_TESTING_API_SPECS.md`](docs/ML_AB_TESTING_API_SPECS.md) for detailed API documentation.

### Appendix C: Risk Management Details
See [`docs/ML_AB_TESTING_RISK_MANAGEMENT.md`](docs/ML_AB_TESTING_RISK_MANAGEMENT.md) for comprehensive risk management framework.

### Appendix D: Integration Plan
See [`docs/ML_AB_TESTING_INTEGRATION_PLAN.md`](docs/ML_AB_TESTING_INTEGRATION_PLAN.md) for detailed integration strategy.