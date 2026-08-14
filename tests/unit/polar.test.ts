import { describe, expect, it } from 'vitest';
import { assertPolarProfileV1, trainingSloopPolarV1 } from '../../src/contracts/polar-profile.js';
import { lookupTargetSpeedMps } from '../../src/sim/polar.js';

const DEG = Math.PI / 180;

describe('synthetic polar lookup', () => {
  it('returns declared grid values exactly at grid intersections', () => {
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 10)).toBe(4.6);
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 45 * DEG, 4)).toBe(1.9);
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 180 * DEG, 6)).toBe(2.2);
  });

  it('returns zero at head-to-wind and at zero wind speed', () => {
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 0, 10)).toBe(0);
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 0)).toBe(0);
  });

  it('interpolates bilinearly between grid points', () => {
    // AWA 75deg is midway between 60deg (3.2) and 90deg (3.5) at TWS 6.
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 75 * DEG, 6)).toBeCloseTo(3.35, 6);
    // TWS 5 is midway between 4 (2.5) and 6 (3.5) at AWA 90deg.
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 5)).toBeCloseTo(3.0, 6);
  });

  it('folds negative and reflex apparent wind angles symmetrically', () => {
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, -90 * DEG, 6)).toBe(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 6));
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 270 * DEG, 6)).toBe(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 6));
  });

  it('clamps wind speed outside the declared grid', () => {
    expect(lookupTargetSpeedMps(trainingSloopPolarV1, 90 * DEG, 99)).toBe(4.6);
  });

  it('never decreases as wind speed increases at a fixed angle', () => {
    for (const awaDeg of [30, 45, 60, 90, 120, 150, 180]) {
      let previous = -1;
      for (const tws of [0, 2, 4, 6, 8, 10]) {
        const speed = lookupTargetSpeedMps(trainingSloopPolarV1, awaDeg * DEG, tws);
        expect(speed).toBeGreaterThanOrEqual(previous);
        previous = speed;
      }
    }
  });

  it('rejects non-finite inputs and invalid profiles', () => {
    expect(() => lookupTargetSpeedMps(trainingSloopPolarV1, Number.NaN, 6)).toThrow(TypeError);
    expect(() => lookupTargetSpeedMps(trainingSloopPolarV1, 0, Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => assertPolarProfileV1({ polar_id: 'training-sloop-synthetic-polar' })).toThrow(TypeError);
  });
});
