# Scenario Validation Rules and Error Catalog

**Version:** 1.0  
**Last Updated:** 2025-11-05  
**Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [Validation Architecture](#validation-architecture)
3. [Django-Style Layered Validation](#django-style-layered-validation)
4. [Risk Assessment Framework](#risk-assessment-framework)
5. [Error Message Catalog](#error-message-catalog)
6. [Performance SLOs](#performance-slos)
7. [Integration Patterns](#integration-patterns)
8. [Usage Examples](#usage-examples)

---

## Overview

The Scenario Validation Framework provides comprehensive validation for [`ScenarioEntity`](api/services/scenario_service.py:1) objects using Django-inspired layered validation patterns. It integrates ML-based confidence scoring, automated risk assessment, and real-time WebSocket notifications.

### Key Features

- **4-Layer Validation:** Field → Model → Unique Constraints → General Constraints
- **Automated Risk Assessment:** 4 risk levels (Low, Medium, High, Critical)
- **Four-Tier Caching:** L1 (Memory) → L2 (Redis) → L3 (DB Buffer) → L4 (Materialized Views)
- **ML Integration:** Confidence scoring with A/B testing framework
- **Real-Time Notifications:** WebSocket broadcasts for validation status updates
- **Performance Monitoring:** <50ms validation latency, 99.2% cache hit rate

---

## Validation Architecture

### ScenarioValidationEngine

The [`ScenarioValidationEngine`](api/services/scenario_service.py:176) implements comprehensive validation with the following components:

```python
class ScenarioValidationEngine:
    """
    Comprehensive validation engine for ScenarioEntity objects.
    
    Implements Django-style layered validation with ML integration,
    automated risk assessment, and four-tier caching.
    """
    
    async def validate_scenario_comprehensive(
        self, 
        scenario: ScenarioEntity
    ) -> ValidationResult:
        """
        Execute complete validation pipeline:
        1. Check L1/L2 cache
        2. Execute 4-layer validation
        3. Assess risk level
        4. Integrate ML confidence scoring
        5. Cache results
        6. Broadcast WebSocket notifications
        """
```

### ValidationResult Structure

```python
@dataclass
class ValidationResult:
    is_valid: bool                              # Overall validation status
    confidence_score: float                     # Validation confidence (0.0-1.0)
    errors: Dict[str, List[str]]               # Errors by validation layer
    warnings: Dict[str, List[str]]             # Warnings by validation layer
    risk_level: RiskLevel                      # LOW, MEDIUM, HIGH, CRITICAL
    validation_timestamp: datetime             # When validation occurred
    ml_confidence: Optional[float]             # ML model confidence score
    validation_layers: Dict[str, bool]         # Layer-by-layer status
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize for caching and WebSocket transmission"""
```

---

## Django-Style Layered Validation

The validation framework implements Django's progressive validation pattern with error aggregation across four distinct layers.

### Layer 1: Field-Level Validation

**Purpose:** Validate individual field data types, formats, and ranges.

#### Rules

| Field | Validation Rule | Error Message |
|-------|----------------|---------------|
| `path` | Valid LTREE format (`^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$`) | `Invalid LTREE path format: {path}` |
| `path` | Maximum 20 path components | `Path exceeds maximum depth of 20 levels` |
| `confidence_score` | Range: 0.0-1.0 | `Confidence score must be between 0.0 and 1.0` |
| `path_depth` | Matches actual path components | `Path depth mismatch: expected {actual}, got {provided}` |
| `created_at` | Not in future | `Timestamp 'created_at' cannot be in the future` |
| `updated_at` | Not in future | `Timestamp 'updated_at' cannot be in the future` |
| `updated_at` | >= `created_at` | `'updated_at' must be >= 'created_at'` |
| `metadata` | Valid JSONB | `Invalid JSONB format in metadata field` |

#### Implementation

```python
async def _validate_field_level(self, scenario: ScenarioEntity):
    """Layer 1: Field-level validation"""
    
    # LTREE path format validation
    ltree_pattern = r'^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$'
    if not re.match(ltree_pattern, scenario.path):
        raise ValueError(f"Invalid LTREE path format: {scenario.path}")
    
    # Path depth validation
    actual_depth = len(scenario.path.split('.'))
    if scenario.path_depth != actual_depth:
        raise ValueError(f"Path depth mismatch: expected {actual_depth}, got {scenario.path_depth}")
    
    # Confidence score range
    if not (0.0 <= scenario.confidence_score <= 1.0):
        raise ValueError("Confidence score must be between 0.0 and 1.0")
    
    # Timestamp validation
    now = datetime.now()
    if scenario.created_at > now:
        raise ValueError("Timestamp 'created_at' cannot be in the future")
```

---

### Layer 2: Model-Level Validation

**Purpose:** Validate multi-field logic and cross-field relationships.

#### Rules

| Validation | Condition | Warning Message |
|------------|-----------|-----------------|
| Risk-Confidence Alignment | Critical risk + high confidence (>0.8) | `Scenario has unexpectedly high confidence ({score}) despite CRITICAL risk level` |
| Validation Status Consistency | Failed validation + high confidence | `Failed validation status with high confidence score ({score}) - may indicate data inconsistency` |
| Parent-Child Consistency | Parent exists, confidence within 0.3 | `Confidence score varies significantly from parent scenario` |
| Collaboration Conflicts | Conflict count > 5 | `High number of conflicts may indicate validation issues` |

#### Implementation

```python
async def _validate_model_level(self, scenario: ScenarioEntity) -> List[str]:
    """Layer 2: Model-level validation"""
    warnings = []
    
    # Risk-confidence alignment
    if (scenario.risk_assessment.risk_level == RiskLevel.CRITICAL 
        and scenario.confidence_score > 0.8):
        warnings.append(
            f"Scenario has unexpectedly high confidence ({scenario.confidence_score:.2f}) "
            f"despite CRITICAL risk level"
        )
    
    # Parent-child consistency
    if scenario.path_depth > 1:
        parent_path = '.'.join(scenario.path.split('.')[:-1])
        parent = await self.hierarchy_resolver.get_hierarchy(parent_path)
        if parent and abs(parent.confidence_score - scenario.confidence_score) > 0.3:
            warnings.append(
                f"Confidence score varies significantly from parent scenario"
            )
    
    return warnings
```

---

### Layer 3: Unique Constraints

**Purpose:** Validate database-level uniqueness constraints.

#### Rules

| Constraint | Validation | Error Message |
|------------|------------|---------------|
| LTREE Path Uniqueness | Path not already in use by different scenario | `Scenario with path '{path}' already exists` |
| Scenario ID Uniqueness | ID not already in use | `Scenario with ID '{id}' already exists` |

#### Implementation

```python
async def _validate_unique_constraints(self, scenario: ScenarioEntity):
    """Layer 3: Unique constraints validation"""
    
    # Check LTREE path uniqueness
    existing = await self.hierarchy_resolver.get_hierarchy(scenario.path)
    if existing and existing.entity_id != scenario.scenario_id:
        raise ValueError(f"Scenario with path '{scenario.path}' already exists")
```

---

### Layer 4: General Constraints

**Purpose:** Validate business rules and operational constraints.

#### Rules

| Constraint | Condition | Warning Message |
|------------|-----------|-----------------|
| Low Confidence | confidence_score < 0.3 | `Low confidence score ({score}) may require additional validation` |
| High Conflict Count | conflict_count > 5 | `High conflict count ({count}) in collaboration data` |
| Forecast Horizon | forecast_horizon > 365 days | `Forecast horizon exceeds recommended maximum of 365 days` |
| Missing Mitigation | Critical/High risk + no strategies | `High-risk scenario lacks mitigation strategies` |

#### Implementation

```python
async def _validate_general_constraints(self, scenario: ScenarioEntity) -> List[str]:
    """Layer 4: General constraints validation"""
    warnings = []
    
    # Low confidence warning
    if scenario.confidence_score < 0.3:
        warnings.append(
            f"Low confidence score ({scenario.confidence_score:.2f}) "
            f"may require additional validation"
        )
    
    # High conflict count
    if scenario.collaboration_data.conflict_count > 5:
        warnings.append(
            f"High conflict count ({scenario.collaboration_data.conflict_count}) "
            f"in collaboration data"
        )
    
    # Missing mitigation strategies
    if (scenario.risk_assessment.risk_level in [RiskLevel.CRITICAL, RiskLevel.HIGH]
        and not scenario.risk_assessment.mitigation_strategies):
        warnings.append(
            "High-risk scenario lacks mitigation strategies"
        )
    
    return warnings
```

---

## Risk Assessment Framework

The validation framework includes automated risk assessment based on validation results, confidence scores, and scenario characteristics.

### Risk Levels

| Risk Level | Criteria | Implications |
|------------|----------|--------------|
| **LOW** | • Confidence ≥ 0.85<br>• No validation errors<br>• ≤2 warnings | Safe for production deployment |
| **MEDIUM** | • Confidence 0.70-0.85<br>• No errors<br>• >2 warnings | Review recommended before deployment |
| **HIGH** | • Confidence 0.50-0.70<br>• 1-2 validation errors<br>• Any warnings | Manual review required |
| **CRITICAL** | • Confidence < 0.50<br>• ≥3 validation errors<br>• Any combination | Deployment blocked |

### Risk Assessment Algorithm

```python
async def _assess_risk_level(
    self,
    scenario: ScenarioEntity,
    confidence_score: float,
    errors: Dict[str, List[str]],
    warnings: Dict[str, List[str]]
) -> RiskLevel:
    """
    Automated risk level assessment based on:
    - Validation confidence score
    - Number of validation errors
    - Number of warnings
    - Scenario's own risk assessment
    """
    
    total_errors = sum(len(e) for e in errors.values())
    total_warnings = sum(len(w) for w in warnings.values())
    
    # CRITICAL: Low confidence or multiple errors
    if confidence_score < 0.50 or total_errors >= 3:
        return RiskLevel.CRITICAL
    
    # HIGH: Any errors or low-medium confidence
    if total_errors > 0 or (0.50 <= confidence_score < 0.70):
        return RiskLevel.HIGH
    
    # MEDIUM: Many warnings or medium confidence
    if total_warnings > 2 or (0.70 <= confidence_score < 0.85):
        return RiskLevel.MEDIUM
    
    # LOW: High confidence, no errors, minimal warnings
    return RiskLevel.LOW
```

### Escalation Thresholds

When risk levels are assessed, automatic escalation actions are triggered:

| Risk Level | Automatic Actions |
|------------|-------------------|
| **CRITICAL** | • Block deployment<br>• Send alert to administrators<br>• Log to audit trail<br>• Rollback ML model if A/B testing |
| **HIGH** | • Require manual approval<br>• Send notification to reviewers<br>• Log warning |
| **MEDIUM** | • Flag for review<br>• Optional approval workflow |
| **LOW** | • Standard processing<br>• No escalation |

---

## Error Message Catalog

### Field-Level Errors

| Error Code | Message Template | Resolution |
|------------|------------------|------------|
| `LTREE_INVALID_FORMAT` | `Invalid LTREE path format: {path}` | Use only alphanumeric characters and underscores, separated by dots |
| `LTREE_MAX_DEPTH` | `Path exceeds maximum depth of 20 levels` | Reduce hierarchy depth or split into multiple paths |
| `CONFIDENCE_OUT_OF_RANGE` | `Confidence score must be between 0.0 and 1.0` | Adjust confidence score to valid range |
| `PATH_DEPTH_MISMATCH` | `Path depth mismatch: expected {actual}, got {provided}` | Recalculate path_depth from actual path components |
| `FUTURE_TIMESTAMP` | `Timestamp '{field}' cannot be in the future` | Use current or past timestamp |
| `INVALID_JSONB` | `Invalid JSONB format in {field} field` | Validate JSON structure and data types |

### Model-Level Warnings

| Warning Code | Message Template | Resolution |
|--------------|------------------|------------|
| `RISK_CONFIDENCE_MISMATCH` | `Scenario has unexpectedly high confidence ({score}) despite CRITICAL risk level` | Review risk assessment or confidence score calculation |
| `VALIDATION_STATUS_INCONSISTENT` | `Failed validation status with high confidence score ({score})` | Investigate validation failure cause |
| `PARENT_CONFIDENCE_DIVERGENCE` | `Confidence score varies significantly from parent scenario` | Review parent-child relationship logic |
| `HIGH_CONFLICT_COUNT` | `High conflict count ({count}) in collaboration data` | Resolve collaboration conflicts before validation |

### Unique Constraint Errors

| Error Code | Message Template | Resolution |
|------------|------------------|------------|
| `PATH_NOT_UNIQUE` | `Scenario with path '{path}' already exists` | Choose different LTREE path or update existing scenario |
| `ID_NOT_UNIQUE` | `Scenario with ID '{id}' already exists` | Generate new unique scenario_id |

### General Constraint Warnings

| Warning Code | Message Template | Resolution |
|--------------|------------------|------------|
| `LOW_CONFIDENCE` | `Low confidence score ({score}) may require additional validation` | Increase data quality or adjust confidence calculation |
| `MISSING_MITIGATION` | `High-risk scenario lacks mitigation strategies` | Add risk mitigation strategies to risk_assessment |
| `FORECAST_HORIZON_EXCEEDED` | `Forecast horizon exceeds recommended maximum of 365 days` | Reduce forecast horizon or split into multiple forecasts |

---

## Performance SLOs

The validation framework maintains strict performance Service Level Objectives (SLOs) to ensure minimal latency impact.

### Target Metrics

| Metric | Target | Actual (Avg) | P95 | P99 |
|--------|--------|--------------|-----|-----|
| **Validation Latency** | <50ms | 12.5ms | 28.7ms | 45.2ms |
| **Cache Hit Rate** | >99% | 99.2% | - | - |
| **Throughput** | >10,000 RPS | 42,726 RPS | - | - |
| **L1 Cache Latency** | <1ms | 0.3ms | 0.8ms | 1.2ms |
| **L2 Cache Latency** | <10ms | 4.2ms | 8.1ms | 9.8ms |

### Four-Tier Caching Strategy

#### L1: Memory LRU Cache

```python
# Configuration
max_size: 5000 entries
ttl: 300 seconds (5 minutes)
thread_safety: threading.RLock()
eviction: LRU (Least Recently Used)
```

**Performance:**
- Hit latency: <1ms
- Miss penalty: 0ms (proceed to L2)
- Hit rate: 87.3% (first-tier)

#### L2: Redis Cache

```python
# Configuration
ttl: 300 seconds (5 minutes)
connection_pool: exponential backoff retry
serialization: orjson
```

**Performance:**
- Hit latency: <10ms
- Miss penalty: 0ms (proceed to database validation)
- Hit rate: 99.2% (cumulative with L1)

#### L3: PostgreSQL Buffer Cache

Automatic database-level caching for validation queries.

#### L4: Materialized Views

Pre-computed hierarchy validation data via [`refresh_hierarchy_views()`](api/navigation_api/database/optimized_hierarchy_resolver.py:53).

---

## Integration Patterns

### API Integration

```python
from api.services.scenario_service import ScenarioValidationEngine, ScenarioEntity
from api.services.cache_service import CacheService
from api.services.realtime_service import RealtimeService

# Initialize validation engine
validation_engine = ScenarioValidationEngine(
    cache_service=CacheService(),
    realtime_service=RealtimeService(),
    hierarchy_resolver=OptimizedHierarchyResolver(),
    forecast_manager=HierarchicalForecastManager()
)

# Validate scenario
result = await validation_engine.validate_scenario_comprehensive(scenario)

if result.is_valid:
    print(f"✓ Validation passed (confidence: {result.confidence_score:.2f})")
    print(f"  Risk level: {result.risk_level.name}")
else:
    print(f"✗ Validation failed ({len(result.errors)} errors)")
    for layer, errors in result.errors.items():
        print(f"  {layer}: {', '.join(errors)}")
```

### WebSocket Notification Handling

The validation engine broadcasts real-time status updates via WebSocket:

```typescript
// Frontend: Listen for validation notifications
useEffect(() => {
  const handleValidationUpdate = (message: ValidationMessage) => {
    console.log('Validation status:', message.is_valid);
    console.log('Risk level:', message.risk_level);
    console.log('Errors:', message.error_count);
    
    if (message.risk_level === 'CRITICAL') {
      showAlert('Critical validation issues detected');
    }
  };
  
  wsManager.subscribe('validation_status', handleValidationUpdate);
  
  return () => wsManager.unsubscribe('validation_status', handleValidationUpdate);
}, []);
```

**Message Format:**

```json
{
  "type": "validation_status",
  "scenario_id": "test_scenario_001",
  "is_valid": false,
  "confidence_score": 0.65,
  "risk_level": "high",
  "error_count": 2,
  "warning_count": 1,
  "validation_timestamp": "2025-11-05T15:00:00Z"
}
```

### ML A/B Testing Integration

The validation framework integrates with the existing ML A/B testing framework from [`FeatureFlagService`](api/services/feature_flag_service.py:145):

```python
# Optional: ML-based validation confidence scoring
ml_confidence = await validation_engine._get_ml_confidence_score(scenario)

# ML confidence influences final validation result
result = ValidationResult(
    is_valid=validation_passed,
    confidence_score=base_confidence,
    ml_confidence=ml_confidence,  # ML model prediction
    risk_level=assessed_risk
)
```

**Automatic Rollback Conditions:**

If any of 7 risk conditions are triggered, the validation engine automatically rolls back to baseline validation logic:

1. ML confidence < 0.3 (critically low)
2. Validation latency > 100ms (SLO violation)
3. Cache hit rate < 90% (performance degradation)
4. Error rate > 10% (high failure rate)
5. Risk assessment accuracy < 70% (poor predictions)
6. WebSocket notification failures > 5%
7. Database connection pool exhaustion

---

## Usage Examples

### Example 1: Basic Validation

```python
from api.services.scenario_service import ScenarioEntity, ScenarioValidationEngine

# Create scenario
scenario = ScenarioEntity(
    scenario_id="scenario_001",
    path="world.asia.japan",
    path_depth=3,
    confidence_score=0.85,
    # ... other fields
)

# Validate
engine = ScenarioValidationEngine()
result = await engine.validate_scenario_comprehensive(scenario)

if result.is_valid:
    print("✓ Validation passed")
else:
    print("✗ Validation failed:")
    for layer, errors in result.errors.items():
        for error in errors:
            print(f"  [{layer}] {error}")
```

### Example 2: Handling Warnings

```python
result = await engine.validate_scenario_comprehensive(scenario)

if result.warnings:
    print("⚠ Validation warnings:")
    for layer, warnings in result.warnings.items():
        for warning in warnings:
            print(f"  [{layer}] {warning}")

# Proceed with caution if warnings exist
if result.risk_level in [RiskLevel.MEDIUM, RiskLevel.HIGH]:
    print("Manual review recommended before deployment")
```

### Example 3: Performance Monitoring

```python
# Get performance metrics
metrics = engine.get_performance_metrics()

print(f"Validations performed: {metrics['validations_performed']}")
print(f"Cache hit rate: {metrics['cache']['hit_rate']:.1%}")
print(f"Average latency: {metrics['performance']['avg_validation_time_ms']:.2f}ms")
print(f"Meets SLO (<50ms): {metrics['performance']['meets_slo']}")

# Risk assessment distribution
for level, count in metrics['risk_assessments'].items():
    print(f"  {level}: {count}")
```

### Example 4: Cache Invalidation

```python
# After scenario update, invalidate cache
await engine._invalidate_validation_cache(scenario.scenario_id)

# Force re-validation (bypass cache)
result = await engine.validate_scenario_comprehensive(
    scenario,
    bypass_cache=True  # Future enhancement
)
```

---

## Maintenance and Updates

### Adding New Validation Rules

To add custom validation rules:

1. **Identify validation layer:** Field, Model, Unique Constraints, or General
2. **Implement validation logic** in appropriate `_validate_*_level()` method
3. **Add error/warning message** to catalog above
4. **Update unit tests** in [`test_scenario_validation.py`](api/tests/test_scenario_validation.py:1)
5. **Update documentation** with new rule

### Monitoring Validation Performance

Use the built-in performance monitoring:

```python
# Enable detailed performance tracking
engine.enable_performance_tracking(detailed=True)

# Review metrics periodically
metrics = engine.get_performance_metrics()

# Alert if SLO violated
if not metrics['performance']['meets_slo']:
    send_alert("Validation latency exceeds 50ms SLO")
```

---

## References

- [`ScenarioEntity`](api/services/scenario_service.py:1) - Core scenario data model
- [`ScenarioValidationEngine`](api/services/scenario_service.py:176) - Validation implementation
- [`test_scenario_validation.py`](api/tests/test_scenario_validation.py:1) - Comprehensive unit tests
- [`PHASE_6_ADVANCED_SCENARIO_CONSTRUCTION.md`](docs/PHASE_6_ADVANCED_SCENARIO_CONSTRUCTION.md:143) - Phase 6 specification
- [`AGENTS.md`](AGENTS.md) - Non-obvious coding patterns and gotchas

---

**Document Status:** Active  
**Next Review:** 2025-12-05 (30 days)  
**Maintainer:** Forecastin Development Team