"""
Pytest configuration for WebSocket and API tests

This file ensures proper test environment setup for all tests,
including mocking unavailable services during test collection.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock
import pytest

# Add the api directory to Python path to enable imports
api_dir = Path(__file__).parent.parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))

# Mock service modules that may not be available during test runs
# This allows tests to import main.py without database/redis dependencies
# Note: asyncpg is now installed, so we don't mock it
# sys.modules['asyncpg'] = MagicMock()
sys.modules['redis'] = MagicMock()
sys.modules['redis.asyncio'] = MagicMock()

# Mock the service imports before main.py is imported
# This prevents import errors during test collection
class MockDatabaseManager:
    def __init__(self, *args, **kwargs):
        pass
    async def initialize(self):
        pass
    async def close(self):
        pass

class MockCacheService:
    def __init__(self, *args, **kwargs):
        pass
    async def initialize(self):
        pass
    async def close(self):
        pass

class MockOptimizedHierarchyResolver:
    def __init__(self, *args, **kwargs):
        pass

# Note: We don't pre-mock the service modules here because that would
# prevent the actual imports from working. Instead, we ensure the base
# dependencies (asyncpg, redis) are available as mocks so the services
# can be imported even if those packages aren't installed.
