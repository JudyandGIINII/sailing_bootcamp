import { describe, expect, it } from 'vitest';
import {
  INITIAL_SAIL_TRIM,
  MIN_TRIM_EFFICIENCY,
  REEF_SPEED_FACTOR,
  TRIM_MAX,
  TRIM_MIN,
  TRIM_STEP,
  declaredOptimalTrim,
  sailCorrectionFactor,
  stepTrim,
  trimEfficiency,
} from '../../src/sim/sail-trim.js';
import { applyCanonicalInput, createSession, advanceLogicalTick, type DeterministicSession } from '../../src/sim/session.js';
import { l04ReplayBindings } from '../../src/content/l02-l05.js';

function l04Session(): DeterministicSession {
  return createSession({ ...l04ReplayBindings, seed: 'trim-test', ordered_input_log: [] } as never);
}

describe('synthetic sail trim and reef corrections', () => {
  it('cycles a sheet through the declared range and wraps back to eased', () => {
    let value = TRIM_MIN;
    const seen = new Set<number>([value]);
    for (let step = 0; step < TRIM_MAX / TRIM_STEP; step += 1) {
      value = stepTrim(value);
      seen.add(value);
    }
    expect(seen.has(TRIM_MAX)).toBe(true);
    expect(seen.size).toBeGreaterThan(4);
    expect(stepTrim(TRIM_MAX)).toBe(TRIM_MIN);
  });

  it('declares hauled-in trim close to the wind and eased trim off the wind', () => {
    expect(declaredOptimalTrim(0)).toBe(1);
    expect(declaredOptimalTrim(Math.PI)).toBe(0);
    expect(declaredOptimalTrim(Math.PI / 2)).toBe(0.5);
    // Symmetric: the sign of the apparent wind angle does not change the optimum.
    expect(declaredOptimalTrim(-Math.PI / 2)).toBe(declaredOptimalTrim(Math.PI / 2));
  });

  it('is most efficient at the declared optimum and degrades away from it, never below the floor', () => {
    const beamReach = Math.PI / 2;
    const optimal = { main_trim: 0.5, jib_trim: 0.5, reefed: false };
    const worst = { main_trim: TRIM_MAX, jib_trim: TRIM_MAX, reefed: false };
    expect(trimEfficiency(optimal, beamReach)).toBe(1);
    expect(trimEfficiency(worst, beamReach)).toBeLessThan(1);
    expect(trimEfficiency(worst, beamReach)).toBeGreaterThanOrEqual(MIN_TRIM_EFFICIENCY);
  });

  it('applies the declared reef factor on top of trim efficiency', () => {
    const beamReach = Math.PI / 2;
    const trim = { main_trim: 0.5, jib_trim: 0.5, reefed: false };
    const reefed = { ...trim, reefed: true };
    expect(sailCorrectionFactor(trim, beamReach)).toBe(1);
    expect(sailCorrectionFactor(reefed, beamReach)).toBe(REEF_SPEED_FACTOR);
  });

  it('rejects out-of-range and non-finite trim values', () => {
    expect(() => stepTrim(Number.NaN)).toThrow(TypeError);
    expect(() => stepTrim(-0.1)).toThrow(TypeError);
    expect(() => stepTrim(1.5)).toThrow(TypeError);
    expect(() => trimEfficiency({ main_trim: 2, jib_trim: 0.5, reefed: false }, 0)).toThrow(TypeError);
    expect(() => declaredOptimalTrim(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('changes L04 speed through water when a sheet is trimmed', () => {
    const straight = advanceLogicalTick(l04Session());
    const trimmed = advanceLogicalTick(
      applyCanonicalInput(l04Session(), { logical_tick: 0, sequence: 1, input: { action: 'main_trim' } }),
    );
    expect(trimmed.raw.polar_kinematic_state!.sail_trim.main_trim).not.toBe(INITIAL_SAIL_TRIM.main_trim);
    expect(trimmed.raw.stw).not.toBe(straight.raw.stw);
  });
});
