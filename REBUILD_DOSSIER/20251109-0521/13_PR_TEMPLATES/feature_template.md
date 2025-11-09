# New Feature

## Feature Description

**Summary:** <!-- Brief description of the new feature -->

**User Story:**
```
As a [user type]
I want [feature]
So that [benefit]
```

**Related:**
- Task: T-#### (from 05_REBUILD_PLAN.csv)
- ADR: ADR-#### (if architecture decision made)
- Issue: #<!-- issue number -->

## Design

### Architecture

<!-- Explain high-level design -->

**Components:**
- Backend: ...
- Frontend: ...
- Database: ...

**Diagram:**
```
┌─────────┐
│ Client  │
└────┬────┘
     │
     ▼
┌─────────┐
│   API   │
└────┬────┘
     │
     ▼
┌─────────┐
│Database │
└─────────┘
```

### Contracts

**Request:**
```python
# Pydantic contract
class FeatureRequest(BaseModel):
    field1: str
    field2: int
```

**Response:**
```python
class FeatureResponse(BaseModel):
    result: str
    metadata: dict
```

**TypeScript (auto-generated):**
```typescript
// Verified: zero 'any' types
export interface FeatureRequest {
  field1: string;
  field2: number;
}
```

## Implementation

### Backend

**Service:**
```python
class FeatureService(BaseService):
    async def start(self) -> None:
        # Initialize
        pass

    async def stop(self) -> None:
        # Cleanup
        pass

    async def execute_feature(self, request: FeatureRequest) -> FeatureResponse:
        # Implementation
        pass
```

**Router:**
```python
@router.post("/feature", response_model=FeatureResponse)
async def feature_endpoint(request: FeatureRequest):
    return await feature_service.execute_feature(request)
```

### Frontend

**Component:**
```typescript
export function FeatureComponent() {
  const { mutate, isLoading } = useMutation({
    mutationFn: (request: FeatureRequest) =>
      api.post<FeatureResponse>('/api/v1/feature', request)
  });

  return (
    <FeatureGate flag="ff.new_feature" fallback={<LegacyFeature />}>
      {/* New feature UI */}
    </FeatureGate>
  );
}
```

### Database

**Migration:**
```sql
-- migrations/versions/xxx_add_feature.py
def upgrade():
    op.create_table('feature_data',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('data', sa.JSON(), nullable=False)
    )

def downgrade():
    op.drop_table('feature_data')
```

## Testing

### Unit Tests

**Backend:**
```python
@pytest.mark.asyncio
async def test_feature_service():
    """Test feature service logic."""
    service = FeatureService()
    result = await service.execute_feature(request)
    assert result.result == expected
```

**Frontend:**
```typescript
test('FeatureComponent renders correctly', () => {
  render(<FeatureComponent />);
  expect(screen.getByText('Feature')).toBeInTheDocument();
});
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_feature_endpoint():
    """Test feature endpoint end-to-end."""
    response = await client.post('/api/v1/feature', json={
        'field1': 'value',
        'field2': 123
    })
    assert response.status_code == 200
    assert response.json()['result'] == expected
```

### Contract Tests

```python
def test_feature_response_matches_contract():
    """Verify response matches FeatureResponse contract."""
    response = client.post('/api/v1/feature', json=request_data)

    # Validate against contract
    FeatureResponse(**response.json())  # Should not raise
```

## Feature Flag

**Flag:** `ff.new_feature`

**Rollout Strategy:**
```
Week 1: 10%  (internal testing)
Week 2: 25%  (early adopters)
Week 3: 50%  (half of users)
Week 4: 100% (all users)
```

**Monitoring:**
- Error rate increase?
- Performance impact?
- User engagement?

**Rollback:**
```sql
UPDATE feature_flags
SET enabled = false
WHERE key = 'ff.new_feature';
```

## Performance

**Benchmarks:**
```
Endpoint latency: 45ms (budget: 100ms) ✅
Database query: 8ms (budget: 50ms) ✅
Cache hit rate: 99.5% (budget: 99%) ✅
```

**Load testing:**
```bash
# Throughput test
python scripts/testing/throughput_test.py --endpoint=/feature
# Result: 5,000 RPS (acceptable)
```

## Documentation

### API Documentation

```python
@router.post("/feature", response_model=FeatureResponse)
async def feature_endpoint(request: FeatureRequest):
    """
    Execute new feature.

    **Parameters:**
    - field1: Description of field1
    - field2: Description of field2

    **Returns:**
    - result: Feature execution result
    - metadata: Additional metadata

    **Example:**
    ```
    POST /api/v1/feature
    {
        "field1": "value",
        "field2": 123
    }
    ```
    """
    pass
```

### User Documentation

<!-- Link to user guide or include brief instructions -->

**Usage:**
1. Navigate to Feature page
2. Enter required data
3. Click Submit
4. View results

## Deployment

**Pre-deployment:**
- [ ] Run migrations
- [ ] Enable feature flag at 0% (disabled)
- [ ] Verify monitoring/alerts configured

**Deployment:**
1. Deploy backend
2. Deploy frontend
3. Verify health checks
4. Enable flag at 10%

**Post-deployment:**
- [ ] Smoke tests pass
- [ ] Monitor error rates
- [ ] Gradually increase rollout

**Rollback:**
1. Disable feature flag
2. If needed: revert deployment
3. Run down migration

## Checklist

### Implementation
- [ ] Backend service implemented
- [ ] Frontend component implemented
- [ ] Contracts defined (Pydantic + TypeScript)
- [ ] Database migrations created
- [ ] Feature flag created

### Testing
- [ ] Unit tests (≥80% coverage)
- [ ] Integration tests
- [ ] Contract tests
- [ ] Manual testing completed
- [ ] Performance benchmarks met

### Documentation
- [ ] API documentation added
- [ ] User documentation added
- [ ] README updated (if needed)
- [ ] Inline code comments

### Feature Flag
- [ ] Flag added to database
- [ ] FeatureGate HOC used
- [ ] Rollout strategy defined
- [ ] Monitoring configured

### Deployment
- [ ] Migration tested (up and down)
- [ ] Rollback procedure documented
- [ ] Monitoring/alerts configured

---

## Success Metrics

<!-- How will we measure success? -->

**Metrics to track:**
-
-

**Success criteria:**
-
-
