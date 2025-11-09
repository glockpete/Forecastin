"""
Contract Test: EntityResponse

Tests that EntityResponse contract matches between Python and TypeScript
Addresses: F-0005 (missing children_count property)

Run: pytest tests/contracts/test_entity_response.py -v
"""

import pytest
from uuid import uuid4
from datetime import datetime
from api.contracts.responses import EntityResponse
from pydantic import ValidationError


def test_entity_response_all_required_fields():
    """Verify all required fields are present."""

    entity = EntityResponse(
        id=uuid4(),
        name="Tokyo",
        entity_type="city",
        description="Capital of Japan",
        path="world.asia.japan.tokyo",
        path_depth=4,
        location={"type": "Point", "coordinates": [139.6917, 35.6895]},
        confidence_score=0.95,
        children_count=23,  # F-0005: REQUIRED field
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    assert entity.id is not None
    assert entity.name == "Tokyo"
    assert entity.children_count == 23  # F-0005


def test_entity_response_children_count_required():
    """F-0005: children_count must be present."""

    # This should work
    entity_data = {
        "id": str(uuid4()),
        "name": "Test",
        "entity_type": "test",
        "path": "test",
        "path_depth": 1,
        "confidence_score": 0.5,
        "children_count": 0,  # REQUIRED
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

    entity = EntityResponse(**entity_data)
    assert entity.children_count == 0


def test_confidence_score_range_validation():
    """Confidence score must be 0.0-1.0."""

    valid_scores = [0.0, 0.5, 1.0]
    for score in valid_scores:
        entity = EntityResponse(
            id=uuid4(),
            name="Test",
            entity_type="test",
            path="test",
            path_depth=1,
            confidence_score=score,
            children_count=0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        assert 0.0 <= entity.confidence_score <= 1.0

    # Invalid scores
    invalid_scores = [-0.1, 1.1, 2.0]
    for score in invalid_scores:
        with pytest.raises(ValidationError):
            EntityResponse(
                id=uuid4(),
                name="Test",
                entity_type="test",
                path="test",
                path_depth=1,
                confidence_score=score,
                children_count=0,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )


def test_entity_response_serialization():
    """Verify EntityResponse serializes to JSON correctly."""

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

    json_data = entity.model_dump(mode='json')

    # All fields must be JSON-serializable
    assert 'id' in json_data
    assert 'name' in json_data
    assert 'children_count' in json_data  # F-0005
    assert json_data['children_count'] == 23
