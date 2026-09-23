import { describe, it, expect } from 'vitest';
import { countDecided, computePassRate, computePassRateTrend } from './pass-rate';

describe('countDecided', () => {
  it('sums pass, fail and blocked', () => {
    expect(countDecided({ pass: 3, fail: 1, blocked: 2 })).toBe(6);
  });

  it('ignores pending, running and skip, which are not part of the shape', () => {
    expect(countDecided({ pass: 0, fail: 0, blocked: 0 })).toBe(0);
  });
});

describe('computePassRate', () => {
  it('divides pass by the decided count (pass + fail + blocked)', () => {
    expect(computePassRate({ pass: 3, fail: 1, blocked: 0 })).toBeCloseTo(0.75);
  });

  it('counts blocked in the denominator, pulling the rate down', () => {
    expect(computePassRate({ pass: 3, fail: 0, blocked: 1 })).toBeCloseTo(0.75);
  });

  it('returns null, never zero, when nothing has been decided yet', () => {
    expect(computePassRate({ pass: 0, fail: 0, blocked: 0 })).toBeNull();
  });

  it('returns an honest zero when everything decided failed', () => {
    expect(computePassRate({ pass: 0, fail: 4, blocked: 0 })).toBe(0);
  });
});

describe('computePassRateTrend', () => {
  it('reports the delta between two measured rates', () => {
    expect(computePassRateTrend(0.9, 0.7)).toBeCloseTo(0.2);
  });

  it('returns null when the current rate is not measured', () => {
    expect(computePassRateTrend(null, 0.7)).toBeNull();
  });

  it('returns null when the previous rate is not measured', () => {
    expect(computePassRateTrend(0.7, null)).toBeNull();
  });

  it('returns null when neither rate is measured', () => {
    expect(computePassRateTrend(null, null)).toBeNull();
  });
});
