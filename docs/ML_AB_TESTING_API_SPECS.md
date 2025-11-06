# ML Model A/B Testing Framework API Specifications

## Overview

This document defines the REST API endpoints for managing ML model A/B tests in the Forecastin platform. The API integrates with the existing feature flag system, entity extraction pipeline, and maintains the validated performance metrics.

## Base Configuration

- **Base URL**: `/api/ab-testing`
- **Authentication**: Bearer token (existing auth system)
- **Response Format**: JSON with orjson serialization for complex objects
- **Error Handling**: Structured error responses with audit trail logging

## Core Data Models

### Test Configuration
```json
{
  "test_name": "llm_v2_vs_baseline",
  "test_description": "Compare LLM v2 with baseline rule-based extraction",
  "champion_variant": "baseline_rule_based",
  "challenger_variant": "llm_v2",
  "rollout_strategy": "gradual",
  "rollout_percentage": 25,
  "target_sample_size": 1000,
  "auto_rollback_enabled": true,
  "risk_conditions": {
    "accuracy_threshold": 0.85,
    "latency_threshold_ms": 2.0,
    "confidence_drift_threshold": 0.1,
    "error_rate_threshold": 0.05,
    "cache_hit_threshold": 0.98,
    "throughput_threshold_rps": 30000,
    "anomaly_detection_sensitivity": "high"
  }
}
```

### Test Assignment
```json
{
  "test_id": "uuid",
  "variant": "llm_v2",
  "assignment_reason": "percentage_based",
  "confidence_threshold": 0.7,
  "is_champion": false
}
```

### Performance Metrics
```json
{
  "variant": "llm_v2",
  "metrics": {
    "accuracy": 0.92,
    "latency_ms": 1.28,
    "throughput_rps": 41250,
    "cache_hit_rate": 0.991,
    "entities_processed": 150,
    "average_confidence": 0.84,
    "deduplication_rate": 0.12,
    "error_rate": 0.02
  },
  "timestamp": "2025-11-04T19:20:50Z",
  "sample_size": 500,
  "geographic_distribution": {
    "north_america": 0.35,
    "europe": 0.28,
    "asia": 0.22,
    "other": 0.15
  }
}
```

## API Endpoints

### Test Management

#### POST /api/ab-testing/tests
**Purpose**: Create new A/B test

**Request Body**:
```json
{
  "test_name": "string (required, unique)",
  "test_description": "string (optional)",
  "champion_variant": "string (required, must exist)",
  "challenger_variant": "string (required, must exist, different from champion)",
  "rollout_strategy": "immediate|gradual|user_based",
  "rollout_percentage": "integer (0-100, default 0)",
  "target_sample_size": "integer (optional)",
  "auto_rollback_enabled": "boolean (default true)",
  "risk_conditions": {
    "accuracy_threshold": "float (0.0-1.0, default 0.85)",
    "latency_threshold_ms": "float (default 2.0)",
    "confidence_drift_threshold": "float (default 0.1)",
    "error_rate_threshold": "float (0.0-1.0, default 0.05)",
    "cache_hit_threshold": "float (0.0-1.0, default 0.98)",
    "throughput_threshold_rps": "float (default 30000)",
    "anomaly_detection_sensitivity": "low|medium|high (default high)"
  }
}
```

**Success Response** (201 Created):
```json
{
  "test_id": "uuid",
  "status": "draft",
  "created_at": "2025-11-04T19:20:50Z",
  "assignment_endpoint": "/api/ab-testing/tests/test_id/assign",
  "metrics_endpoint": "/api/ab-testing/tests/test_id/metrics",
  "status_endpoint": "/api/ab-testing/tests/test_id/status"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid test configuration
- `409 Conflict`: Test name already exists
- `422 Unprocessable Entity`: Variant not found or invalid
- `503 Service Unavailable`: A/B testing service not available

#### GET /api/ab-testing/tests
**Purpose**: List all A/B tests with filtering

**Query Parameters**:
- `status`: Filter by test status (draft|active|paused|completed|rolled_back|cancelled)
- `variant`: Filter tests involving specific variant
- `page`: Page number (default 1)
- `limit`: Items per page (default 20, max 100)
- `sort`: Sort field (created_at|updated_at|test_name|status)
- `order`: Sort order (asc|desc, default desc)

**Success Response** (200 OK):
```json
{
  "tests": [
    {
      "test_id": "uuid",
      "test_name": "llm_v2_vs_baseline",
      "status": "active",
      "champion_variant": "baseline_rule_based",
      "challenger_variant": "llm_v2",
      "rollout_percentage": 25,
      "assignments_count": 150,
      "performance_comparison": {
        "champion": {"accuracy": 0.88, "latency_ms": 1.25},
        "challenger": {"accuracy": 0.92, "latency_ms": 1.28}
      },
      "risk_assessment": {
        "risk_level": "low",
        "recommendation": "continue"
      },
      "created_at": "2025-11-04T19:20:50Z",
      "updated_at": "2025-11-04T19:20:50Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

#### GET /api/ab-testing/tests/{test_id}
**Purpose**: Get detailed test information

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "test_name": "llm_v2_vs_baseline",
  "test_description": "Compare LLM v2 with baseline rule-based extraction",
  "status": "active",
  "champion_variant": {
    "variant_name": "baseline_rule_based",
    "model_type": "rule_based",
    "model_version": "1.0.0",
    "is_champion": true,
    "performance_baseline": {"accuracy": 0.88, "latency_ms": 1.25}
  },
  "challenger_variant": {
    "variant_name": "llm_v2",
    "model_type": "llm",
    "model_version": "2.0.0",
    "is_champion": false,
    "performance_baseline": {"accuracy": 0.91, "latency_ms": 1.30}
  },
  "rollout_strategy": "gradual",
  "rollout_percentage": 25,
  "target_sample_size": 1000,
  "current_sample_size": 150,
  "risk_conditions": { /* configured risk thresholds */ },
  "performance_metrics": {
    "champion": {
      "accuracy": 0.88,
      "latency_ms": 1.25,
      "throughput_rps": 42726,
      "cache_hit_rate": 0.992
    },
    "challenger": {
      "accuracy": 0.92,
      "latency_ms": 1.28,
      "throughput_rps": 41250,
      "cache_hit_rate": 0.991
    }
  },
  "risk_assessment": {
    "triggered_conditions": [],
    "risk_level": "low",
    "recommendation": "continue",
    "last_evaluation": "2025-11-04T19:20:50Z"
  },
  "start_time": "2025-11-04T19:20:50Z",
  "created_at": "2025-11-04T19:20:50Z",
  "updated_at": "2025-11-04T19:20:50Z"
}
```

#### PATCH /api/ab-testing/tests/{test_id}
**Purpose**: Update test configuration

**Request Body**:
```json
{
  "test_description": "Updated description",
  "rollout_percentage": 50,
  "auto_rollback_enabled": false,
  "risk_conditions": {
    "accuracy_threshold": 0.87,
    "latency_threshold_ms": 1.8
  }
}
```

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "status": "updated",
  "updated_at": "2025-11-04T19:20:50Z"
}
```

#### POST /api/ab-testing/tests/{test_id}/start
**Purpose**: Start A/B test

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "status": "active",
  "start_time": "2025-11-04T19:20:50Z",
  "rollout_percentage": 25,
  "message": "A/B test started with 25% rollout"
}
```

#### POST /api/ab-testing/tests/{test_id}/pause
**Purpose**: Pause A/B test

**Request Body** (optional):
```json
{
  "pause_reason": "Manual pause for investigation"
}
```

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "status": "paused",
  "message": "A/B test paused"
}
```

#### POST /api/ab-testing/tests/{test_id}/complete
**Purpose**: Complete A/B test manually

**Request Body**:
```json
{
  "completion_reason": "Statistical significance achieved",
  "winner": "challenger", // "champion" or "challenger"
  "performance_summary": {
    "accuracy_improvement": 0.04,
    "latency_impact": 0.03,
    "recommendation": "promote_challenger"
  }
}
```

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "status": "completed",
  "winner": "challenger",
  "completed_at": "2025-11-04T19:20:50Z"
}
```

### Traffic Assignment

#### GET /api/ab-testing/tests/{test_id}/assign
**Purpose**: Get model variant assignment for user/session

**Query Parameters**:
- `user_id`: User identifier (optional, for authenticated users)
- `session_id`: Session identifier (required if no user_id)
- `force_assignment`: Force assignment even if test inactive (default false)

**Headers**:
- `X-User-ID`: Alternative to user_id query parameter
- `X-Session-ID`: Alternative to session_id query parameter

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "assignment": {
    "variant": "llm_v2",
    "assignment_reason": "percentage_based",
    "confidence_threshold": 0.7,
    "is_champion": false,
    "assigned_at": "2025-11-04T19:20:50Z"
  },
  "test_status": "active",
  "rollout_percentage": 25
}
```

**Error Responses**:
- `404 Not Found`: Test not found or inactive
- `400 Bad Request`: Missing user/session identification
- `503 Service Unavailable`: Assignment service unavailable

### Performance Metrics

#### POST /api/ab-testing/tests/{test_id}/metrics
**Purpose**: Submit performance metrics for test evaluation

**Request Body**:
```json
{
  "variant": "llm_v2",
  "metrics": {
    "accuracy": 0.92,
    "latency_ms": 1.28,
    "throughput_rps": 41250,
    "cache_hit_rate": 0.991,
    "entities_processed": 150,
    "average_confidence": 0.84,
    "deduplication_rate": 0.12,
    "error_rate": 0.02
  },
  "timestamp": "2025-11-04T19:20:50Z",
  "sample_size": 500,
  "geographic_distribution": {
    "north_america": 0.35,
    "europe": 0.28,
    "asia": 0.22,
    "other": 0.15
  }
}
```

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "metrics_submitted": true,
  "evaluation_result": {
    "risk_level": "low",
    "recommendation": "continue",
    "triggered_conditions": [],
    "evaluated_at": "2025-11-04T19:20:50Z"
  },
  "performance_summary": {
    "current_accuracy": 0.92,
    "baseline_accuracy": 0.88,
    "improvement": 0.04,
    "statistical_significance": false
  }
}
```

#### GET /api/ab-testing/tests/{test_id}/metrics
**Purpose**: Get performance metrics history

**Query Parameters**:
- `variant`: Filter by variant (champion|challenger or specific variant name)
- `start_time`: Start time filter (ISO 8601)
- `end_time`: End time filter (ISO 8601)
- `metric_type`: Filter by metric type (accuracy|latency|throughput|cache_hit_rate)
- `interval`: Aggregation interval (1m|5m|15m|1h|1d)

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "metrics": [
    {
      "timestamp": "2025-11-04T19:20:50Z",
      "variant": "llm_v2",
      "accuracy": 0.92,
      "latency_ms": 1.28,
      "throughput_rps": 41250,
      "cache_hit_rate": 0.991,
      "sample_size": 500
    }
  ],
  "aggregated_metrics": {
    "champion": {
      "avg_accuracy": 0.88,
      "avg_latency_ms": 1.25,
      "avg_throughput_rps": 42726
    },
    "challenger": {
      "avg_accuracy": 0.92,
      "avg_latency_ms": 1.28,
      "avg_throughput_rps": 41250
    }
  },
  "performance_comparison": {
    "accuracy_improvement": 0.04,
    "latency_impact": 0.03,
    "throughput_impact": -1476
  }
}
```

### Test Status and Monitoring

#### GET /api/ab-testing/tests/{test_id}/status
**Purpose**: Get comprehensive test status and risk assessment

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "status": "active",
  "rollout_percentage": 25,
  "current_sample_size": 150,
  "target_sample_size": 1000,
  "progress_percentage": 15,
  
  "risk_assessment": {
    "overall_risk_level": "low",
    "recommendation": "continue",
    "triggered_conditions": [],
    "last_evaluation": "2025-11-04T19:20:50Z",
    "risk_score": 0,
    "max_risk_observed": "low"
  },
  
  "performance_comparison": {
    "champion": {
      "accuracy": 0.88,
      "latency_ms": 1.25,
      "throughput_rps": 42726,
      "cache_hit_rate": 0.992,
      "sample_size": 75
    },
    "challenger": {
      "accuracy": 0.92,
      "latency_ms": 1.28,
      "throughput_rps": 41250,
      "cache_hit_rate": 0.991,
      "sample_size": 75
    }
  },
  
  "statistical_significance": {
    "achieved": false,
    "confidence_level": 0.95,
    "required_sample_size": 1000,
    "current_sample_size": 150
  },
  
  "assignment_statistics": {
    "total_assignments": 150,
    "champion_assignments": 75,
    "challenger_assignments": 75,
    "assignment_ratio": "balanced"
  },
  
  "auto_rollback_status": {
    "enabled": true,
    "armed": false,
    "triggered_conditions": [],
    "rollback_threshold": "critical_risk"
  }
}
```

### Risk Management

#### GET /api/ab-testing/tests/{test_id}/risk-evaluation
**Purpose**: Get detailed risk evaluation history

**Query Parameters**:
- `limit`: Number of evaluations to return (default 50, max 200)
- `risk_level`: Filter by risk level (low|medium|high|critical)

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "evaluations": [
    {
      "evaluation_id": "uuid",
      "evaluation_timestamp": "2025-11-04T19:20:50Z",
      "risk_level": "low",
      "recommendation": "continue",
      "triggered_conditions": [],
      "current_metrics": {
        "accuracy": 0.92,
        "latency_ms": 1.28,
        "error_rate": 0.02,
        "cache_hit_rate": 0.991,
        "throughput_rps": 41250
      },
      "threshold_config": {
        "accuracy_threshold": 0.85,
        "latency_threshold_ms": 2.0,
        "error_rate_threshold": 0.05,
        "cache_hit_threshold": 0.98,
        "throughput_threshold_rps": 30000
      },
      "risk_score": 0
    }
  ],
  "risk_trends": {
    "risk_level_distribution": {
      "low": 45,
      "medium": 5,
      "high": 0,
      "critical": 0
    },
    "most_common_triggers": [],
    "average_risk_score": 0.2
  }
}
```

#### POST /api/ab-testing/tests/{test_id}/manual-rollback
**Purpose**: Manually trigger rollback

**Request Body**:
```json
{
  "rollback_reason": "Manual intervention required",
  "force_rollback": false,
  "notify_stakeholders": true
}
```

**Success Response** (200 OK):
```json
{
  "test_id": "uuid",
  "rollback_initiated": true,
  "rollback_reason": "Manual intervention required",
  "rollback_timestamp": "2025-11-04T19:20:50Z",
  "affected_assignments": 150,
  "rollback_status": "in_progress",
  "estimated_completion": "2025-11-04T19:21:00Z"
}
```

### Model Variants Management

#### GET /api/ab-testing/variants
**Purpose**: List all available model variants

**Success Response** (200 OK):
```json
{
  "variants": [
    {
      "variant_name": "baseline_rule_based",
      "model_type": "rule_based",
      "model_version": "1.0.0",
      "is_active": true,
      "is_champion": true,
      "performance_baseline": {
        "accuracy": 0.88,
        "latency_ms": 1.25,
        "throughput_rps": 42726,
        "cache_hit_rate": 0.992
      },
      "model_config": {
        "confidence_threshold": 0.7,
        "similarity_threshold": 0.8,
        "max_entities_per_text": 100
      },
      "deployment_statistics": {
        "active_tests": 2,
        "total_assignments": 1250,
        "success_rate": 0.995
      }
    }
  ]
}
```

#### GET /api/ab-testing/variants/{variant_name}
**Purpose**: Get detailed variant information

**Success Response** (200 OK):
```json
{
  "variant_name": "llm_v2",
  "model_type": "llm",
  "model_version": "2.0.0",
  "is_active": true,
  "is_champion": false,
  "performance_baseline": {
    "accuracy": 0.91,
    "latency_ms": 1.30,
    "throughput_rps": 41000,
    "cache_hit_rate": 0.990
  },
  "model_config": {
    "model_name": "gpt-4",
    "confidence_threshold": 0.85,
    "max_tokens": 1500,
    "temperature": 0.05,
    "rule_based_calibration": true,
    "enhanced_prompting": true
  },
  "test_history": [
    {
      "test_id": "uuid",
      "test_name": "llm_v2_vs_baseline",
      "status": "active",
      "performance_comparison": {
        "accuracy_improvement": 0.04,
        "latency_impact": 0.05
      }
    }
  ],
  "deployment_statistics": {
    "total_tests": 3,
    "successful_promotions": 1,
    "total_assignments": 2500,
    "average_performance": {
      "accuracy": 0.925,
      "latency_ms": 1.27,
      "user_satisfaction": 0.88
    }
  }
}
```

### System Integration

#### GET /api/ab-testing/health
**Purpose**: Health check for A/B testing service

**Success Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2025-11-04T19:20:50Z",
  "services": {
    "redis_connection": "healthy",
    "database_connection": "healthy",
    "risk_evaluation_engine": "healthy",
    "assignment_service": "healthy"
  },
  "performance_metrics": {
    "average_assignment_latency_ms": 1.25,
    "risk_evaluation_time_ms": 2.1,
    "cache_hit_rate": 0.995,
    "active_tests": 3,
    "total_assignments_today": 1250
  },
  "validated_slos": {
    "ancestor_resolution_ms": 1.25,
    "throughput_rps": 42726,
    "cache_hit_rate": 0.992
  }
}
```

#### GET /api/ab-testing/stats
**Purpose**: Get system-wide A/B testing statistics

**Success Response** (200 OK):
```json
{
  "overview": {
    "total_tests": 5,
    "active_tests": 3,
    "completed_tests": 2,
    "total_assignments": 3500,
    "automatic_rollbacks": 0,
    "manual_rollbacks": 1
  },
  "variant_performance": {
    "baseline_rule_based": {
      "tests_participated": 3,
      "win_rate": 0.33,
      "avg_accuracy": 0.88,
      "avg_latency_ms": 1.25
    },
    "llm_v2": {
      "tests_participated": 2,
      "win_rate": 0.67,
      "avg_accuracy": 0.92,
      "avg_latency_ms": 1.28
    }
  },
  "risk_assessment_summary": {
    "total_evaluations": 150,
    "low_risk": 135,
    "medium_risk": 12,
    "high_risk": 3,
    "critical_risk": 0,
    "automatic_rollbacks_triggered": 0
  }
}
```

## Integration Patterns

### Feature Flag Integration ✅ **IMPLEMENTED**
```python
# Example: Gradual rollout with feature flags
async def get_model_assignment(user_id: str, session_id: str):
    # Check if A/B testing is enabled for user
    if await feature_flag_service.is_enabled("ff.ab_routing", user_id):
        # Get active A/B tests
        tests = await ab_testing_service.get_active_tests()
        
        for test in tests:
            # Check rollout percentage
            if await ab_testing_service.should_include_user(test.id, user_id):
                assignment = await ab_testing_service.get_assignment(
                    test.id, user_id, session_id
                )
                return assignment
    
    # Fallback to champion model
    return await ab_testing_service.get_champion_assignment()
```

**Implementation Status**: ✅ **COMPLETED** - FeatureFlagService with multi-tier caching and WebSocket notifications

### Entity Extraction Integration
```python
# Example: Entity extraction with A/B testing
async def extract_entities_with_ab_testing(content: str, user_id: str, session_id: str):
    # Get model variant assignment
    assignment = await ab_testing_service.get_assignment_for_extraction(
        user_id, session_id
    )
    
    # Select appropriate extractor
    extractor = model_variants[assignment.variant]
    
    # Perform extraction with performance monitoring
    start_time = time.time()
    entities = await extractor.extract_entities(content)
    extraction_time = time.time() - start_time
    
    # Submit metrics for risk assessment
    await ab_testing_service.submit_metrics(assignment.test_id, {
        'variant': assignment.variant,
        'latency_ms': extraction_time * 1000,
        'entities_processed': len(entities),
        'average_confidence': calculate_average_confidence(entities),
        'error_rate': calculate_error_rate(entities)
    })
    
    return entities
```

### WebSocket Integration
```python
# Example: Real-time A/B test updates
async def send_ab_test_update(client_id: str, test_id: str, update_type: str, data: dict):
    message = {
        "type": "ab_test_update",
        "test_id": test_id,
        "update_type": update_type,
        "data": data,
        "timestamp": time.time()
    }
    
    # Use safe_serialize_message for WebSocket
    serialized_message = safe_serialize_message(message)
    await connection_manager.send_personal_message(serialized_message, client_id)
```

## Error Handling

### Standard Error Response Format
```json
{
  "error": {
    "code": "INVALID_TEST_CONFIGURATION",
    "message": "The provided test configuration is invalid",
    "details": {
      "field": "challenger_variant",
      "reason": "Variant does not exist"
    },
    "timestamp": "2025-11-04T19:20:50Z",
    "request_id": "uuid"
  }
}
```

### Common Error Codes
- `INVALID_TEST_CONFIGURATION`: Test configuration validation failed
- `VARIANT_NOT_FOUND`: Requested model variant does not exist
- `TEST_NOT_FOUND`: A/B test not found
- `TEST_INACTIVE`: Test is not in active status
- `ASSIGNMENT_FAILED`: Unable to assign user to test variant
- `METRICS_SUBMISSION_FAILED`: Failed to submit performance metrics
- `RISK_EVALUATION_FAILED`: Risk condition evaluation failed
- `ROLLBACK_FAILED`: Automatic or manual rollback failed
- `SERVICE_UNAVAILABLE`: A/B testing service temporarily unavailable
- `PERFORMANCE_DEGRADATION`: Operation would impact validated performance metrics

## Performance Considerations

### Validated Performance Metrics Maintained
- **Assignment Latency**: <1.25ms (target: maintain existing performance)
- **Risk Evaluation**: <2ms (target: <2ms)
- **Throughput**: >42,000 RPS (target: maintain existing 42,726 RPS)
- **Cache Hit Rate**: >99% (target: maintain existing 99.2%)

### Optimization Strategies
- **Batch Processing**: Group assignment requests for Redis efficiency
- **Predictive Caching**: Pre-cache likely assignments based on user patterns
- **Asynchronous Processing**: Non-blocking metric submission and risk evaluation
- **Connection Pooling**: Reuse database and Redis connections

This API specification ensures seamless integration with the existing Forecastin platform while maintaining the validated performance metrics and architectural constraints.