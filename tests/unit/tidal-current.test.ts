import { describe, expect, it } from 'vitest';
import {
  deriveSyntheticCurrent,
  EBB_TO_RAD,
  FLOOD_TO_RAD,
  MAX_CURRENT_MPS,
  PEAK_EBB_EPOCH_MS,
  PEAK_FLOOD_EPOCH_MS,
  SEMIDIURNAL_PERIOD_MS,
  SLACK_WATER_EPOCH_MS,
} from '../../src/sim/tidal-current.js';
import { TIDE_AMPLITUDE_M, deriveSyntheticTideHeightM } from '../../src/sim/depth-clearance.js';

describe('deriveSyntheticCurrent (synthetic semidiurnal tidal shape)', () => {
  it('runs strongest at peak flood, where the tide height is crossing its datum', () => {
    const current = deriveSyntheticCurrent(PEAK_FLOOD_EPOCH_MS);
    expect(current.current_speed_mps).toBeCloseTo(MAX_CURRENT_MPS, 6);
    expect(current.current_to_rad).toBe(FLOOD_TO_RAD);
  });

  it('goes slack at high water, a quarter period in', () => {
    // The stream is the tide's rate of change, so it is zero where the height peaks.
    expect(deriveSyntheticCurrent(SLACK_WATER_EPOCH_MS).current_speed_mps).toBe(0);
    expect(deriveSyntheticTideHeightM(SLACK_WATER_EPOCH_MS)).toBeCloseTo(TIDE_AMPLITUDE_M, 6);
  });

  it('runs strongest on the ebb half a period in, proving direction flips across the cycle', () => {
    const current = deriveSyntheticCurrent(PEAK_EBB_EPOCH_MS);
    expect(current.current_speed_mps).toBeCloseTo(MAX_CURRENT_MPS, 6);
    expect(current.current_to_rad).toBe(EBB_TO_RAD);
  });

  it('is periodic: t and t + PERIOD give the same result', () => {
    const t = 1_234_567;
    const first = deriveSyntheticCurrent(t);
    const second = deriveSyntheticCurrent(t + SEMIDIURNAL_PERIOD_MS);
    expect(second).toEqual(first);
  });

  it('gives different currents for two different real-world timestamps hours apart', () => {
    // 2024-01-01T00:00:00Z and six hours later.
    const first = deriveSyntheticCurrent(1_704_067_200_000);
    const second = deriveSyntheticCurrent(1_704_067_200_000 + 6 * 60 * 60 * 1000);
    expect(second).not.toEqual(first);
  });

  it('throws TypeError for non-finite, negative, and non-integer epoch inputs', () => {
    expect(() => deriveSyntheticCurrent(Number.NaN)).toThrow(TypeError);
    expect(() => deriveSyntheticCurrent(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => deriveSyntheticCurrent(-1)).toThrow(TypeError);
    expect(() => deriveSyntheticCurrent(1.5)).toThrow(TypeError);
  });

  it('freezes the returned object and never mutates across calls', () => {
    const current = deriveSyntheticCurrent(0);
    expect(Object.isFrozen(current)).toBe(true);
    expect(() => { (current as { current_speed_mps: number }).current_speed_mps = 99; }).toThrow();
  });
});
