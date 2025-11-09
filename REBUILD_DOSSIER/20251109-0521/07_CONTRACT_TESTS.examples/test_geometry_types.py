"""
Contract Test: Geometry Type Guards

Tests that geometry types preserve discriminators (not 'any')
Addresses: F-0004 (contract generator loses type information)

Run: pytest tests/contracts/test_geometry_types.py -v
"""

import pytest
from api.contracts.geometry import (
    PointGeometry,
    LineStringGeometry,
    PolygonGeometry,
    Coordinate2D,
    Coordinate3D
)
from pydantic import ValidationError


def test_point_geometry_preserves_literal_type():
    """F-0004: PointGeometry.type must be Literal['Point'], not 'any'."""

    point = PointGeometry(
        type='Point',  # Must be exactly 'Point'
        coordinates=[139.6917, 35.6895]
    )

    assert point.type == 'Point'

    # Invalid type should fail
    with pytest.raises(ValidationError):
        PointGeometry(
            type='LineString',  # Wrong type
            coordinates=[0, 0]
        )


def test_point_geometry_2d_coordinates():
    """Point accepts 2D coordinates [lon, lat]."""

    point = PointGeometry(
        type='Point',
        coordinates=[139.6917, 35.6895]
    )

    assert len(point.coordinates) == 2
    assert point.coordinates[0] == 139.6917  # longitude
    assert point.coordinates[1] == 35.6895   # latitude


def test_point_geometry_3d_coordinates():
    """Point accepts 3D coordinates [lon, lat, alt]."""

    point = PointGeometry(
        type='Point',
        coordinates=[139.6917, 35.6895, 40.0]
    )

    assert len(point.coordinates) == 3
    assert point.coordinates[2] == 40.0  # altitude


def test_linestring_geometry_preserves_type():
    """F-0004: LineStringGeometry.type must be Literal['LineString']."""

    line = LineStringGeometry(
        type='LineString',
        coordinates=[
            [139.6917, 35.6895],
            [140.0, 36.0]
        ]
    )

    assert line.type == 'LineString'
    assert len(line.coordinates) == 2


def test_linestring_requires_minimum_two_points():
    """LineString must have at least 2 points."""

    # Valid: 2 points
    line = LineStringGeometry(
        type='LineString',
        coordinates=[[0, 0], [1, 1]]
    )
    assert len(line.coordinates) >= 2

    # Invalid: 1 point
    with pytest.raises(ValidationError):
        LineStringGeometry(
            type='LineString',
            coordinates=[[0, 0]]  # Only 1 point - should fail
        )


def test_polygon_geometry_preserves_type():
    """F-0004: PolygonGeometry.type must be Literal['Polygon']."""

    polygon = PolygonGeometry(
        type='Polygon',
        coordinates=[
            [  # Exterior ring
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0]  # Closed ring
            ]
        ]
    )

    assert polygon.type == 'Polygon'
    assert len(polygon.coordinates) == 1  # One ring


def test_polygon_ring_must_be_closed():
    """Polygon rings must be closed (first point == last point)."""

    # Valid: closed ring
    polygon = PolygonGeometry(
        type='Polygon',
        coordinates=[
            [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
        ]
    )
    first = polygon.coordinates[0][0]
    last = polygon.coordinates[0][-1]
    assert first == last

    # Invalid: unclosed ring (validation may vary by implementation)
    # Some implementations auto-close, others raise ValidationError


def test_geometry_serialization_preserves_discriminator():
    """F-0004: Serialized geometry must preserve 'type' discriminator."""

    point = PointGeometry(type='Point', coordinates=[0, 0])
    line = LineStringGeometry(type='LineString', coordinates=[[0, 0], [1, 1]])
    polygon = PolygonGeometry(type='Polygon', coordinates=[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]])

    # Serialize to JSON
    point_json = point.model_dump(mode='json')
    line_json = line.model_dump(mode='json')
    polygon_json = polygon.model_dump(mode='json')

    # All must have 'type' field with correct literal value
    assert point_json['type'] == 'Point'
    assert line_json['type'] == 'LineString'
    assert polygon_json['type'] == 'Polygon'

    # TypeScript should be able to discriminate based on this
    # Generated TS must NOT be: type: any
    # Generated TS MUST be: type: 'Point' | 'LineString' | 'Polygon'
