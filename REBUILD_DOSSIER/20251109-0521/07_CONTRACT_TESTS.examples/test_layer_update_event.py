"""
Contract Test: LayerUpdateEvent

Tests WebSocket event contract validation
Addresses: F-0003 (test fixture missing layer_id)

Run: pytest tests/contracts/test_layer_update_event.py -v
"""

import pytest
from uuid import uuid4
from datetime import datetime
from api.contracts.events import LayerUpdateEvent
from pydantic import ValidationError


def test_layer_update_event_requires_layer_id():
    """F-0003: LayerUpdateEvent MUST include layer_id."""

    event = LayerUpdateEvent(
        version='1.0',
        event_id=str(uuid4()),
        timestamp=datetime.now(),
        type='layer_update',
        layer_id='points_layer',  # F-0003: REQUIRED
        action='add',
        features=[{"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}}],
        affected_count=1
    )

    assert event.layer_id == 'points_layer'


def test_layer_update_event_missing_layer_id_fails():
    """F-0003: Missing layer_id should cause validation error."""

    with pytest.raises(ValidationError) as exc_info:
        LayerUpdateEvent(
            version='1.0',
            event_id=str(uuid4()),
            timestamp=datetime.now(),
            type='layer_update',
            # layer_id MISSING - should fail
            action='add',
            features=[],
            affected_count=0
        )

    # Verify error mentions layer_id
    assert 'layer_id' in str(exc_info.value)


def test_layer_update_event_action_validation():
    """Action must be 'add', 'update', or 'remove'."""

    valid_actions = ['add', 'update', 'remove']

    for action in valid_actions:
        event = LayerUpdateEvent(
            version='1.0',
            event_id=str(uuid4()),
            timestamp=datetime.now(),
            type='layer_update',
            layer_id='test_layer',
            action=action,
            features=[],
            affected_count=0
        )
        assert event.action == action

    # Invalid action
    with pytest.raises(ValidationError):
        LayerUpdateEvent(
            version='1.0',
            event_id=str(uuid4()),
            timestamp=datetime.now(),
            type='layer_update',
            layer_id='test_layer',
            action='invalid_action',
            features=[],
            affected_count=0
        )


def test_layer_update_event_serialization():
    """Verify event serializes with all required fields."""

    event = LayerUpdateEvent(
        version='1.0',
        event_id='evt_123',
        timestamp=datetime.now(),
        type='layer_update',
        layer_id='points_layer',
        action='add',
        features=[{"type": "Feature"}],
        affected_count=1
    )

    json_data = event.model_dump(mode='json')

    # Verify all required fields present
    assert 'version' in json_data
    assert 'event_id' in json_data
    assert 'timestamp' in json_data
    assert 'type' in json_data
    assert 'layer_id' in json_data  # F-0003: CRITICAL
    assert 'action' in json_data
    assert 'features' in json_data
    assert 'affected_count' in json_data

    assert json_data['layer_id'] == 'points_layer'
