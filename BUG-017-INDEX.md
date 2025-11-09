# BUG-017: Async Mocking Framework Issues - Complete Index

## 📑 Document Navigation

This index provides quick access to all BUG-017 solution materials.

---

## 🚀 Start Here

### For Quick Overview
**👉 [BUG-017 Quick Start](BUG-017-QUICK-START.md)**
- 5-minute overview
- Quick usage examples
- Common patterns
- Top 3 mistakes to avoid

### For Implementation
**👉 [Implementation Summary](BUG-017-IMPLEMENTATION-SUMMARY.md)**
- Complete deliverables list
- Current state analysis
- Phase-by-phase plan
- Success criteria

### For Detailed Solutions
**👉 [Complete Solutions Document](SOLUTIONS_BUG-017.md)**
- 5 comprehensive solutions
- Migration patterns
- Best practices
- Risk mitigation

---

## 📚 Documentation Suite

### Developer Guides

#### 1. Quick Reference Guide
**📖 [docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md)**

**Contents:**
- Common issues & fixes
- Factory function reference
- Testing patterns
- Migration checklist
- Common mistakes
- Troubleshooting

**Use When:**
- You need a quick pattern lookup
- Writing new tests
- Unsure about sync vs async mocking

---

#### 2. Migration Examples
**📖 [docs/testing/MIGRATION_EXAMPLE.md](docs/testing/MIGRATION_EXAMPLE.md)**

**Contents:**
- Before/after comparisons
- Full file migrations
- Step-by-step workflow
- Common migration issues
- Metrics (76% code reduction)

**Use When:**
- Migrating existing test files
- Need concrete examples
- Want to see the impact

---

## 🛠️ Implementation Files

### Core Implementation
**💻 [api/tests/mock_helpers.py](api/tests/mock_helpers.py)**

**Provides:**
- `create_cache_service_mock()`
- `create_realtime_service_mock()`
- `create_database_manager_mock()`
- `create_websocket_mock()`
- `create_async_pool_mock()`
- `AsyncContextManagerMock`
- `patch_async_method()`
- And more...

**Status:** ✅ Complete and ready to use

---

### Detection Tool
**🔍 [scripts/detect_async_mock_issues.py](scripts/detect_async_mock_issues.py)**

**Features:**
- Finds 5 types of anti-patterns
- Severity-based reporting
- Actionable suggestions
- Summary statistics

**Usage:**
```bash
# Scan all tests
python scripts/detect_async_mock_issues.py api/tests/

# Scan specific file
python scripts/detect_async_mock_issues.py api/tests/test_scenario_service.py
```

**Status:** ✅ Executable and tested

---

## 🎯 Quick Reference by Task

### Task: "I need to mock a CacheService"
→ Use: `create_cache_service_mock()` from `mock_helpers.py`
→ See: [Quick Reference - CacheService Mock](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md#cacheservice-mock)

### Task: "I need to mock a WebSocket connection"
→ Use: `create_websocket_mock()` from `mock_helpers.py`
→ See: [Quick Reference - WebSocket Mock](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md#websocket-mock)

### Task: "I need to mock a database pool"
→ Use: `create_async_pool_mock()` from `mock_helpers.py`
→ See: [Quick Reference - Database Pool Mock](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md#database-pool-mock)

### Task: "I need to replace an async method for testing"
→ Use: `patch_async_method()` from `mock_helpers.py`
→ See: [Quick Reference - Async Method Patching](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md#async-method-patching-utilities)

### Task: "I found an anti-pattern in my tests"
→ Run: `python scripts/detect_async_mock_issues.py api/tests/your_file.py`
→ See: [Migration Examples](docs/testing/MIGRATION_EXAMPLE.md)

### Task: "I'm migrating a test file"
→ Follow: [Migration Examples - Migration Workflow](docs/testing/MIGRATION_EXAMPLE.md#migration-workflow)
→ Use: [Quick Reference - Migration Checklist](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md#migration-checklist)

---

## 📊 Current Status Dashboard

### Implementation Status
| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Setup | ✅ Complete | Core files & docs created |
| Phase 2: Critical Fixes | 🔄 Ready | Fix Mock(spec=AsyncService) |
| Phase 3: Warning Fixes | ⏳ Pending | Fix redundant patterns |
| Phase 4: Validation | ⏳ Pending | Test suite verification |
| Phase 5: Training | ⏳ Pending | Team onboarding |

### Issues Overview
| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 1 | Identified |
| ⚠️ Warning | 20+ | Identified |
| ℹ️ Info | 7+ | Identified |

### Files Affected
1. `test_scenario_validation.py` - 1 critical
2. `test_database_manager.py` - 13 warnings
3. `test_feature_flag_service.py` - 3 warnings
4. `test_hierarchical_forecast_service.py` - 1 warning
5. `test_scenario_service.py` - Multiple warnings
6. `test_websocket_manager.py` - Multiple warnings
7. `test_rss_deduplicator.py` - Manual replacements

---

## 🎓 Learning Path

### For New Team Members

**Step 1:** Quick Overview (15 min)
- Read [BUG-017 Quick Start](BUG-017-QUICK-START.md)

**Step 2:** Understand Patterns (30 min)
- Review [Quick Reference Guide](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md)
- Focus on "Common Issues & Fixes" section

**Step 3:** See Examples (30 min)
- Study [Migration Examples](docs/testing/MIGRATION_EXAMPLE.md)
- Compare before/after code

**Step 4:** Practice (1 hour)
- Run detection script on a test file
- Try migrating one fixture
- Run tests to verify

**Step 5:** Deep Dive (optional)
- Read [Complete Solutions](SOLUTIONS_BUG-017.md)
- Study `mock_helpers.py` implementation

### For Experienced Developers

**Quick Start:** (5 min)
- Skim [BUG-017 Quick Start](BUG-017-QUICK-START.md)
- Run detection script on your test files

**Implementation:** (30 min)
- Review [Migration Examples](docs/testing/MIGRATION_EXAMPLE.md)
- Use [Quick Reference](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md) as needed
- Migrate your test files

---

## 🔗 External Resources

### Python Documentation
- [unittest.mock](https://docs.python.org/3/library/unittest.mock.html)
- [AsyncMock](https://docs.python.org/3/library/unittest.mock.html#unittest.mock.AsyncMock)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)

### Project Context
- Original Issue: BUG-017
- Related: Testing Infrastructure Improvements
- Sprint: TBD

---

## 📁 File Structure

```
Forecastin/
├── BUG-017-INDEX.md                        # This file
├── BUG-017-QUICK-START.md                  # Quick start guide
├── BUG-017-IMPLEMENTATION-SUMMARY.md       # Implementation details
├── SOLUTIONS_BUG-017.md                    # Complete solutions
│
├── api/tests/
│   └── mock_helpers.py                     # Core mock factories
│
├── docs/testing/
│   ├── ASYNC_MOCKING_QUICK_REFERENCE.md   # Developer reference
│   └── MIGRATION_EXAMPLE.md                # Migration guide
│
└── scripts/
    └── detect_async_mock_issues.py         # Detection tool
```

---

## ✅ Cheat Sheet

### Common Commands

```bash
# Find issues in all tests
python scripts/detect_async_mock_issues.py api/tests/

# Find issues in one file
python scripts/detect_async_mock_issues.py api/tests/test_your_file.py

# Run tests
pytest api/tests/test_your_file.py -v

# Run all tests
pytest api/tests/ -v

# Run with coverage
pytest api/tests/ --cov=api --cov-report=html
```

### Common Imports

```python
# Standard imports for most tests
from api.tests.mock_helpers import (
    create_cache_service_mock,
    create_realtime_service_mock,
    create_database_manager_mock,
    create_websocket_mock,
    create_async_pool_mock,
    patch_async_method
)
```

### Common Patterns

```python
# Cache mock
mock_cache = create_cache_service_mock(get_value={"key": "value"})

# Realtime mock
mock_realtime = create_realtime_service_mock()

# Database mock
mock_db = create_database_manager_mock(fetchrow_result={"id": 1})

# WebSocket mock
ws = create_websocket_mock()

# Pool mock
mock_pool = create_async_pool_mock(connection_mock)

# Method patch
patch_async_method(obj, 'method_name', return_value="result")
```

---

## 🎯 Decision Tree

### "Should I use a mock helper?"

```
Are you mocking an async service?
├─ Yes → Use appropriate create_*_mock() helper
│   ├─ CacheService → create_cache_service_mock()
│   ├─ RealtimeService → create_realtime_service_mock()
│   ├─ DatabaseManager → create_database_manager_mock()
│   ├─ WebSocket → create_websocket_mock()
│   └─ Database Pool → create_async_pool_mock()
│
└─ No → Is it a custom async service?
    ├─ Yes → Use create_async_service_mock() with custom config
    └─ No → Regular Mock/AsyncMock is fine
```

### "How do I migrate a test file?"

```
1. Run detection script on file
2. Review issues reported
3. Check Migration Examples for similar case
4. Import mock_helpers
5. Replace fixtures with factory calls
6. Run tests
7. Re-run detection script
8. Commit if all clear
```

---

## 🆘 Troubleshooting

### Issue: "Tests fail after migration"
**Check:**
1. Are you awaiting async methods?
2. Are sync methods NOT being awaited?
3. Do return values match expectations?

**See:** [Migration Examples - Common Issues](docs/testing/MIGRATION_EXAMPLE.md#common-issues-during-migration)

### Issue: "Mock doesn't have expected method"
**Solution:**
Add method explicitly or extend factory function

**Example:**
```python
mock_cache = create_cache_service_mock()
mock_cache.custom_method = AsyncMock(return_value=True)
```

### Issue: "Detection script shows false positive"
**Action:**
Review the specific line - script uses regex patterns which may occasionally flag correct code

---

## 📞 Support

### Getting Help

1. **Documentation First:**
   - Check [Quick Reference](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md)
   - Review [Migration Examples](docs/testing/MIGRATION_EXAMPLE.md)

2. **Code Examples:**
   - Study `api/tests/mock_helpers.py`
   - Look at migrated test files

3. **Detection:**
   - Run script for specific guidance
   - Script provides actionable suggestions

4. **Team Support:**
   - Ask in #testing channel
   - Create issue with `testing` label
   - Pair programming session

---

## 🎉 Quick Wins

Start with these for immediate impact:

1. **Fix Critical Issue** (15 min)
   - File: `test_scenario_validation.py:34`
   - Change: `Mock(spec=CacheService)` → `create_cache_service_mock()`
   - Impact: Prevents runtime errors

2. **Migrate One Simple File** (30 min)
   - Pick: `test_websocket_manager.py`
   - Change: Remove redundant AsyncMock assignments
   - Impact: Cleaner, more maintainable code

3. **Run Detection Script** (5 min)
   - Command: `python scripts/detect_async_mock_issues.py api/tests/`
   - Output: Full list of issues with suggestions
   - Impact: Complete visibility

---

## 📈 Metrics & Goals

### Success Metrics
- **Code Quality:** 76% reduction in mock setup code
- **Consistency:** 100% standardized patterns
- **Issues:** 0 critical, <5 warnings
- **Performance:** <1% regression

### Timeline
- **Phase 1 (Setup):** ✅ Complete
- **Phase 2 (Critical):** Days 2-3
- **Phase 3 (Warnings):** Days 4-7
- **Phase 4 (Validation):** Day 8
- **Phase 5 (Training):** Days 9-10

---

## 🏁 Next Steps

### Today
1. ✅ Review this index
2. ✅ Read Quick Start guide
3. [ ] Run detection script
4. [ ] Fix critical issue

### This Week
1. [ ] Migrate 2-3 test files
2. [ ] Team discussion
3. [ ] Update guidelines

### This Sprint
1. [ ] Complete all migrations
2. [ ] Team training
3. [ ] Performance validation

---

**Document Version:** 1.0
**Last Updated:** 2025-11-09
**Maintained By:** Testing Infrastructure Team

**Quick Links:**
- [Quick Start](BUG-017-QUICK-START.md)
- [Implementation Summary](BUG-017-IMPLEMENTATION-SUMMARY.md)
- [Complete Solutions](SOLUTIONS_BUG-017.md)
- [Quick Reference](docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md)
- [Migration Examples](docs/testing/MIGRATION_EXAMPLE.md)
- [Mock Helpers Source](api/tests/mock_helpers.py)
- [Detection Script](scripts/detect_async_mock_issues.py)
