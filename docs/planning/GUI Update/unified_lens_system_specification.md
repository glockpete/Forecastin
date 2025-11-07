# Unified Scientific Lens System Specification

## Executive Summary
This document combines the best elements from four specifications into a single, comprehensive framework for a scientifically-based, self-iterating intelligence system with composable lens architecture.

## Core Architecture: Composable Lens Stack

### Lens Stack Model
Final scores use a cascade where later layers override or reweight earlier ones:

```
BaseRole → Sector → MarketLevel → Function → RiskTolerance → HorizonGate
```

### Blending Mathematics
All weights live on the same feature space:
- **Opportunity Vector**: `{impact, momentum, policy_window, stability, growth_potential, evidence_quality}`
- **Risk Vector**: `{volatility, regulatory_risk, exposure_concentration, false_positive_risk}`

```typescript
// Normalized to sum=1 after each step
W = norm( α*W_role + β*W_sector + γ*W_market + δ*W_function )
R = norm( αr*R_role + βr*R_sector + γr*R_market + δr*R_function )

// Risk tolerance multiplier
R_eff = clamp( τ * R , 0, 1 )

// Final scoring
opportunity = dot(W, opportunity_vector)
risk = dot(R_eff, risk_vector)
roi = opportunity * (1 - risk)
```

**Recommended coefficients**: `α=.40, β=.25, γ=.20, δ=.15` for both W and R
**Risk tolerance**: `τ = 1.25 | 1.0 | 0.75` for `conservative | moderate | aggressive`

## Scientific Enhancement: Evidence-Based Learning

### Bayesian Truth Validation System
```typescript
type TruthValidation = {
  predictionId: string;
  lensStack: LensParams;
  predictedOutcome: string;
  predictedDate: Date;
  confidence: number;

  // Later validation
  actualOutcome?: string;
  outcomeDate?: Date;
  newsValidation: {
    sources: string[];
    sentiment: number;
    corroboration: number;
  };

  // Learning metrics
  accuracy: boolean;
  confidenceCalibration: number;
  lensPerformance: Record<string, number>;
}
```

### Dynamic Weight Optimization
Instead of static weights, use adaptive learning:

```javascript
currentWeight = baseWeight * learningFactor * recencyBoost

learningFactor = (successfulPredictions / totalPredictions) * outcomeImpact
recencyBoost = 1 / (1 + daysSinceLastUpdate)
```

### Enhanced Blending with Learning
```typescript
learning_α = base_α * (role_accuracy / average_accuracy)
learning_β = base_β * (sector_accuracy / average_accuracy)
learning_γ = base_γ * (market_accuracy / average_accuracy)
learning_δ = base_δ * (function_accuracy / average_accuracy)

W_learned = norm( learning_α*W_role + learning_β*W_sector + learning_γ*W_market + learning_δ*W_function )
```

## Comprehensive Lens Dimensions

### Sector Lenses (Industry-Specific)
- **Energy & Resources**: Oil, gas, renewables, mining
- **Technology & Digital**: Software, hardware, AI, cybersecurity
- **Healthcare & Biotech**: Pharma, medical devices, healthcare services
- **Finance & Banking**: Banking, insurance, fintech, investment
- **Manufacturing & Industrial**: Automotive, aerospace, heavy industry
- **Consumer & Retail**: E-commerce, consumer goods, retail
- **Infrastructure & Construction**: Construction, engineering, utilities
- **Agriculture & Food**: Farming, food processing, agritech

### Market Level Lenses
- **Macro (Global)**: World economy, global trends
- **Regional**: Continents, trade blocs (EU, ASEAN, Mercosur)
- **National**: Country-specific analysis
- **Sub-national**: States, provinces, regions
- **Urban**: City-level analysis

### Functional Lenses
- **Strategy & Planning**: Long-term positioning
- **Risk Management**: Threat assessment
- **Investment & M&A**: Capital allocation
- **Supply Chain**: Logistics, procurement
- **Policy & Regulation**: Compliance
- **Innovation & R&D**: Technology trends

### Specialized Cross-Cutting Lenses
- **Climate & Sustainability**: Environmental risks, green opportunities
- **Geopolitical Risk**: Conflict zones, alliance shifts
- **Digital Transformation**: Technology adoption, cyber threats
- **Sanctions & Export Controls**: Trade restrictions monitoring
- **Supply-Chain Resilience**: Port congestion, critical inputs
- **Election & Policy Window**: Political cycles tracking

## Configuration Schema

### Sector Configuration
```yaml
sectors:
  technology:
    base_weights: { impact: 0.30, momentum: 0.25, policy_window: 0.10, stability: 0.05, growth_potential: 0.20, evidence_quality: 0.10 }
    risk: { volatility: 0.40, regulatory_risk: 0.30, exposure_concentration: 0.20, false_positive_risk: 0.10 }
    key_variables: [technology_adoption, cybersecurity_index, infrastructure_development, capital_flows]
    learning_enabled: true
```

### Market Level Configuration
```yaml
market_levels:
  national:
    horizon_weights: { immediate: 0.20, short: 0.30, medium: 0.30, long: 0.20 }
    key_variables: [political_stability, inflation, unemployment, education, healthcare]
```

### Risk Tolerance
```yaml
risk_tolerance:
  conservative: 1.25
  moderate: 1.00
  aggressive: 0.75
```

## Variables Registry

```typescript
type Variable = {
  id: string;
  domain: 'macro'|'sector'|'policy'|'risk'|'sustainability';
  normalize: 'zscore'|'minmax'|'percentile';
  cadence: 'daily'|'weekly'|'monthly'|'event';
  sectors: string[];
  sources: string[];
}
```

**Examples**:
- `energy_consumption` → sectors: `['energy','manufacturing']`
- `cybersecurity_index` → sectors: `['technology','finance']`
- `sanctions_intensity` → sectors: `['energy','finance','manufacturing']`

## Data Contracts

### Lens Parameters
```typescript
type LensParams = {
  role: 'government'|'corporate'|'financial'|'ngo'|'custom';
  sector?: 'energy'|'technology'|'healthcare'|'finance'|'manufacturing'|'consumer'|'infrastructure'|'agriculture';
  marketLevel?: 'global'|'regional'|'national'|'subnational'|'urban';
  region?: string;
  function?: 'strategy'|'risk'|'investment'|'supply_chain'|'policy'|'innovation';
  riskTolerance?: 'conservative'|'moderate'|'aggressive';
  horizon?: 'immediate'|'short'|'medium'|'long';
};
```

### Scientific Lens Blend Report
```typescript
type ScientificLensBlendReport = {
  weights: Record<string, number>;
  risks: Record<string, number>;
  horizonWeights: Record<'immediate'|'short'|'medium'|'long', number>;
  keyVariables: string[];
  lineage: string[];

  scientificValidation: {
    statisticalSignificance: number;
    confidenceInterval: [number, number];
    replicationRate: number;
    temporalStability: number;
  };

  learningMetrics: {
    predictionsMade: number;
    accuracyRate: number;
    confidenceCalibration: number;
    lastOptimized: Date;
    newsValidationScore: number;
  };
};
```

## UI/UX Recommendations

### Advanced Visualization Stack
- **Visx + D3 v8**: Complex scenario visualization and hierarchical charts
- **MUI X Charts v7**: Professional analytics with WCAG 2.1 AA compliance
- **ECharts 6 + WebAssembly**: High-performance analytics for 100,000+ RPS

### Dashboard Layout
- **Top bar**: Role selector, Sector selector, Market Level, Function, Risk tolerance, Horizon tabs
- **Body**: Four horizon lanes (Immediate, Short, Medium, Long)
- **Right pane**: Stakeholder Map + Evidence/Provenance
- **Overlap view**: Opportunities appearing in multiple lenses

## Implementation Roadmap

### Phase 1: Foundation (Months 1-3)
1. Implement lens registry and YAML loaders
2. Build basic blending mathematics
3. Create prediction tracking database
4. Develop horizon gating rules

### Phase 2: Scientific Rigor (Months 4-6)
1. Add statistical significance testing
2. Implement news-based validation
3. Build automated outcome tracking
4. Add confidence calibration

### Phase 3: Self-Learning (Months 7-9)
1. Implement weight optimization algorithms
2. Add hypothesis generation and testing
3. Build continuous model improvement
4. Integrate advanced visualization

### Phase 4: Advanced Features (Months 10-12)
1. Multi-agent collaboration interfaces
2. Real-time scenario construction
3. Knowledge graph visualization
4. Cross-lens opportunity sharing

## API Endpoints

```
GET /lenses/blend?role=...&sector=...&market_level=...&function=...&risk_tolerance=...
→ { blendReport }

GET /outcomes/opportunities?…lens params…&limit=…
→ normalized opportunities with roi

GET /outcomes/actions?…lens params…
→ action recommendations

GET /outcomes/overlap?sectors=energy,technology&market_level=regional
→ cross-lens opportunities
```

## Scientific Validation Framework

### Hypothesis Testing
```typescript
type ScientificHypothesis = {
  hypothesis: string;
  testPeriod: DateRange;
  requiredConfidence: number;
  minimumSampleSize: number;
  results: {
    pValue: number;
    effectSize: number;
    confidenceInterval: [number, number];
    statisticalPower: number;
  };
};
```

### Validation Process
```yaml
validation_process:
  - internal_replication: "Test on out-of-sample data"
  - external_corroboration: "Compare with independent news sources"
  - sensitivity_analysis: "Vary lens parameters and check stability"
  - temporal_validation: "Track performance over multiple periods"
```

## Key Benefits

1. **Scientifically Rigorous**: Evidence-based weights with statistical validation
2. **Self-Iterating**: Learns from outcomes and improves over time
3. **Composable**: Flexible lens combinations for different use cases
4. **Transparent**: Clear lineage and validation processes
5. **Adaptive**: Adjusts to changing conditions and new evidence

## Success Metrics

- **Prediction Accuracy**: How often identified opportunities materialize
- **Confidence Calibration**: How well confidence matches actual outcomes
- **Time-to-Decision**: Speed from opportunity identification to action
- **Cross-Lens Collaboration**: Opportunities shared between different roles
- **Learning Efficiency**: Rate of model improvement over time

This unified specification provides a comprehensive framework for building a scientifically-based, self-iterating intelligence system that delivers actionable insights across multiple domains and use cases.
