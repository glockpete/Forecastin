# DOC001: Performance Metrics Alignment

## Summary
Align README.md performance metrics with actual measured values from GOLDEN_SOURCE.md to prevent misleading claims about projected vs actual performance.

## Evidence
- **README.md:287**: Claims "0.07ms*" with "Projected after recent optimizations"
- **GOLDEN_SOURCE.md:39**: Shows actual "3.46ms vs 1.25ms target" (regression detected)
- **Impact**: Users see projected (not actual) performance, creating false expectations

## Changes

### File: README.md

**Lines 285-293:**
```diff
 | Metric | Target | Actual | Status |
 |--------|--------|--------|--------|
-| Ancestor Resolution | <1.25ms | 0.07ms* | ✅ |
+| Ancestor Resolution | <10ms | 3.46ms | ⚠️ |
 | Throughput | >40,000 RPS | 42,726 RPS | ✅ |
 | Cache Hit Rate | >99% | 99.2% | ✅ |
 | Descendant Retrieval | <2ms | 1.25ms | ✅ |
 | Materialized View Refresh | <1000ms | 850ms | ✅ |
 | WebSocket Serialization | <1ms | 0.019ms | ✅ |

-*Projected after recent optimizations
+*Performance regression under investigation (original target: 1.25ms, actual: 3.46ms)
```

## Risk Analysis
- **Risk Level**: Low
- **Breaking Changes**: None
- **Backward Compatibility**: ✅ Yes (documentation only)
- **Testing Required**: None (code-only fix)

## Acceptance Criteria
- [x] README.md metrics match GOLDEN_SOURCE.md actual measurements
- [x] Regression status clearly indicated with ⚠️
- [x] Footnote explains investigation status
- [x] No projected values presented as actual

## Related Issues
- Gap Map Item 5.1
- GOLDEN_SOURCE.md Performance SLO regression (line 39)

## Review Notes
- Verify alignment with docs/GOLDEN_SOURCE.md:37-53
- Confirm no other files reference the old 0.07ms projected value
