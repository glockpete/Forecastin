/**
 * Entity Helper Functions Tests
 * Validates getConfidence and getChildrenCount helper utilities
 */

import { describe, it, expect } from 'vitest';
import { getConfidence, getChildrenCount } from '../../src/types/contracts.generated';

describe('getConfidence', () => {
  it('returns confidence if present', () => {
    expect(getConfidence({ confidence: 0.75 })).toBe(0.75);
  });

  it('clamps to [0, 1] range', () => {
    expect(getConfidence({ confidence: 1.5 })).toBe(1);
    expect(getConfidence({ confidence: -0.5 })).toBe(0);
  });

  it('returns 0 for missing confidence', () => {
    expect(getConfidence({})).toBe(0);
    expect(getConfidence({ confidence: null })).toBe(0);
    expect(getConfidence({ confidence: undefined })).toBe(0);
  });

  it('handles edge cases', () => {
    expect(getConfidence({ confidence: 0 })).toBe(0);
    expect(getConfidence({ confidence: 1 })).toBe(1);
    expect(getConfidence({ confidence: 0.999999 })).toBe(0.999999);
  });
});

describe('getChildrenCount', () => {
  it('returns childrenCount if present', () => {
    expect(getChildrenCount({ childrenCount: 5 })).toBe(5);
    expect(getChildrenCount({ childrenCount: 0 })).toBe(0);
    expect(getChildrenCount({ childrenCount: 100 })).toBe(100);
  });

  it('returns 0 for negative values', () => {
    expect(getChildrenCount({ childrenCount: -3 })).toBe(0);
    expect(getChildrenCount({ childrenCount: -1 })).toBe(0);
  });

  it('infers 1 from hasChildren flag when childrenCount missing', () => {
    expect(getChildrenCount({ hasChildren: true })).toBe(1);
    expect(getChildrenCount({ hasChildren: false })).toBe(0);
  });

  it('returns 0 for missing data', () => {
    expect(getChildrenCount({})).toBe(0);
    expect(getChildrenCount({ childrenCount: null })).toBe(0);
    expect(getChildrenCount({ childrenCount: undefined })).toBe(0);
  });

  it('prioritizes explicit childrenCount over hasChildren', () => {
    expect(getChildrenCount({ childrenCount: 5, hasChildren: false })).toBe(5);
    expect(getChildrenCount({ childrenCount: 0, hasChildren: true })).toBe(0);
  });
});
