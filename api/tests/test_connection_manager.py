
import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.main import ConnectionManager


@pytest.mark.asyncio
async def test_disconnect_race_condition():
    """
    Tests that a race condition in disconnect, where a client is removed
    after the existence check but before the deletion, is handled gracefully.
    """
    manager = ConnectionManager()
    client_id = "test_client"

    # Mock the active_connections to simulate a race condition
    class RaceConditionDict(dict):
        def __contains__(self, key):
            # First check (from "if client_id in self.active_connections") returns True
            return True
        def __delitem__(self, key):
            # Immediately after, the key is gone, raising a KeyError
            raise KeyError(key)

    manager.active_connections = RaceConditionDict()

    # This should not raise an exception
    manager.disconnect(client_id)
