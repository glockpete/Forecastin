/**
 * Contract Schema Validation Tests
 * Tests that Zod schemas correctly validate against fixture data
 */

import { describe, it, expect } from 'vitest';
import {
  BoundingBoxSchema,
  FeatureCollectionSchema,
  LayerDataUpdatePayloadSchema,
  PositionSchema,
  PointGeometrySchema,
  parseContract,
  validateContract
} from '../../src/types/contracts.generated';

describe('Contract Schema Validation', () => {
  describe('BoundingBox', () => {
    it('should validate a valid bounding box', () => {
      const validBBox = {
        minLat: 37.0,
        maxLat: 38.0,
        minLng: -123.0,
        maxLng: -122.0
      };

      const result = validateContract(BoundingBoxSchema, validBBox);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual(validBBox);
      }
    });

    it('should reject invalid latitude values', () => {
      const invalidBBox = {
        minLat: -100, // Invalid: less than -90
        maxLat: 38.0,
        minLng: -123.0,
        maxLng: -122.0
      };

      const result = validateContract(BoundingBoxSchema, invalidBBox);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid longitude values', () => {
      const invalidBBox = {
        minLat: 37.0,
        maxLat: 38.0,
        minLng: -200, // Invalid: less than -180
        maxLng: -122.0
      };

      const result = validateContract(BoundingBoxSchema, invalidBBox);
      expect(result.valid).toBe(false);
    });
  });

  describe('Position', () => {
    it('should validate a 2D position', () => {
      const valid2D = [-122.4194, 37.7749];
      const result = validateContract(PositionSchema, valid2D);
      expect(result.valid).toBe(true);
    });

    it('should validate a 3D position with altitude', () => {
      const valid3D = [-122.4194, 37.7749, 100];
      const result = validateContract(PositionSchema, valid3D);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid positions', () => {
      const invalid = [-122.4194]; // Only one coordinate
      const result = validateContract(PositionSchema, invalid);
      expect(result.valid).toBe(false);
    });
  });

  describe('PointGeometry', () => {
    it('should validate a valid Point geometry', () => {
      const validPoint = {
        type: 'Point',
        coordinates: [-122.4194, 37.7749]
      };

      const result = validateContract(PointGeometrySchema, validPoint);
      expect(result.valid).toBe(true);
    });

    it('should reject geometry with wrong type', () => {
      const invalidPoint = {
        type: 'LineString', // Wrong type
        coordinates: [-122.4194, 37.7749]
      };

      const result = validateContract(PointGeometrySchema, invalidPoint);
      expect(result.valid).toBe(false);
    });
  });

  describe('FeatureCollection', () => {
    it('should validate a valid FeatureCollection', () => {
      const validFC = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749]
            },
            properties: {
              name: 'San Francisco'
            }
          }
        ]
      };

      const result = validateContract(FeatureCollectionSchema, validFC);
      expect(result.valid).toBe(true);
    });

    it('should validate an empty FeatureCollection', () => {
      const emptyFC = {
        type: 'FeatureCollection',
        features: []
      };

      const result = validateContract(FeatureCollectionSchema, emptyFC);
      expect(result.valid).toBe(true);
    });
  });

  describe('LayerDataUpdatePayload', () => {
    it('should validate a complete layer data update payload', () => {
      const validPayload = {
        layer_id: 'test-layer-001',
        layer_type: 'point',
        layer_data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-122.4194, 37.7749]
              },
              properties: {
                name: 'San Francisco'
              }
            }
          ]
        },
        bbox: {
          minLat: 37.0,
          maxLat: 38.0,
          minLng: -123.0,
          maxLng: -122.0
        },
        changed_at: 1699564800000
      };

      const result = validateContract(LayerDataUpdatePayloadSchema, validPayload);
      expect(result.valid).toBe(true);
    });

    it('should validate payload without optional bbox', () => {
      const payloadWithoutBBox = {
        layer_id: 'test-layer-001',
        layer_type: 'point',
        layer_data: {
          type: 'FeatureCollection',
          features: []
        },
        changed_at: 1699564800000
      };

      const result = validateContract(LayerDataUpdatePayloadSchema, payloadWithoutBBox);
      expect(result.valid).toBe(true);
    });

    it('should reject payload with invalid layer_type', () => {
      const invalidPayload = {
        layer_id: 'test-layer-001',
        layer_type: 'invalid_type', // Not in enum
        layer_data: {
          type: 'FeatureCollection',
          features: []
        },
        changed_at: 1699564800000
      };

      const result = validateContract(LayerDataUpdatePayloadSchema, invalidPayload);
      expect(result.valid).toBe(false);
    });
  });

  describe('parseContract helper', () => {
    it('should successfully parse valid data', () => {
      const validBBox = {
        minLat: 37.0,
        maxLat: 38.0,
        minLng: -123.0,
        maxLng: -122.0
      };

      expect(() => {
        const parsed = parseContract(BoundingBoxSchema, validBBox);
        expect(parsed).toEqual(validBBox);
      }).not.toThrow();
    });

    it('should throw on invalid data', () => {
      const invalidBBox = {
        minLat: -100, // Invalid
        maxLat: 38.0,
        minLng: -123.0,
        maxLng: -122.0
      };

      expect(() => {
        parseContract(BoundingBoxSchema, invalidBBox);
      }).toThrow(/Contract validation failed/);
    });

    it('should include context in error message', () => {
      const invalidBBox = { minLat: -100, maxLat: 38.0, minLng: -123.0, maxLng: -122.0 };

      expect(() => {
        parseContract(BoundingBoxSchema, invalidBBox, 'test context');
      }).toThrow(/test context/);
    });
  });
});
