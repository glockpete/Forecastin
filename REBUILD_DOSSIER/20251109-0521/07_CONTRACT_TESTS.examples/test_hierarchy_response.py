"""
Contract Test: HierarchyResponse

Tests that HierarchyResponse includes 'entities' array
Addresses: F-0005 (missing entities property)

Run: pytest tests/contracts/test_hierarchy_response.py -v
"""

import pytest
from uuid import uuid4
from datetime import datetime
from api.contracts.responses import HierarchyResponse, EntityResponse


def test_hierarchy_response_has_entities_array():
    """F-0005: HierarchyResponse MUST include 'entities' array."""

    entity = EntityResponse(
        id=uuid4(),
        name="Tokyo",
        entity_type="city",
        path="world.asia.japan.tokyo",
        path_depth=4,
        confidence_score=0.95,
        children_count=23,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    response = HierarchyResponse(
        entities=[entity],  # F-0005: REQUIRED property
        total=1,
        has_more=False,
        offset=0,
        limit=100,
        parent_path="world.asia.japan",
        max_depth_reached=False
    )

    # Verify entities array exists and is correct type
    assert hasattr(response, 'entities'), "HierarchyResponse missing 'entities' property"
    assert isinstance(response.entities, list)
    assert len(response.entities) == 1
    assert response.entities[0].name == "Tokyo"


def test_hierarchy_response_serialization():
    """Verify HierarchyResponse serializes correctly with entities array."""

    entity = EntityResponse(
        id=uuid4(),
        name="Tokyo",
        entity_type="city",
        path="world.asia.japan.tokyo",
        path_depth=4,
        confidence_score=0.95,
        children_count=23,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    response = HierarchyResponse(
        entities=[entity],
        total=1,
        has_more=False,
        offset=0,
        limit=100,
        parent_path="world.asia.japan",
        max_depth_reached=False
    )

    json_data = response.model_dump(mode='json')

    # Critical: 'entities' must be in JSON output
    assert 'entities' in json_data, "F-0005: Serialized response missing 'entities'"
    assert isinstance(json_data['entities'], list)
    assert len(json_data['entities']) == 1

    # Verify entity properties present
    assert 'children_count' in json_data['entities'][0]


def test_hierarchy_response_empty_entities():
    """HierarchyResponse can have empty entities array."""

    response = HierarchyResponse(
        entities=[],  # Empty but present
        total=0,
        has_more=False,
        offset=0,
        limit=100,
        parent_path=None,
        max_depth_reached=False
    )

    assert response.entities == []
    assert response.total == 0
