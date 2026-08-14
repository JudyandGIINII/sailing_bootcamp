import { describe, expect, it } from 'vitest';
import { canonicalizeL01Number } from '../../src/contracts/l01-synthetic-environment.js';
import { polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';
import { createInitialPolarKinematicState, transitionPolarKinematicState } from '../../src/sim/polar-kinematics-model.js';

const noCurrent = polarKinematicsEnvironmentV1;
const withCurrent = Object.freeze({ ...polarKinematicsEnvironmentV1, current_to_rad: Math.PI / 2, current_speed_mps: 1.5 });

describe('polar kinematics model', () => {
  it('seeds the initial apparent wind from true wind at zero boat speed', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    // State is always canonicalized (6 decimals), including the tick-0 seed, so this
    // pins the precision contract rather than comparing to the raw, full-precision literal.
    expect(initial.apparent_wind_from_rad).toBe(canonicalizeL01Number(noCurrent.true_wind_from_rad));
    expect(initial.apparent_wind_speed_mps).toBe(canonicalizeL01Number(noCurrent.true_wind_speed_mps));
    expect(initial.logical_tick).toBe(0);
  });

  it('derives speed through water from the polar instead of a fixed constant', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const transition = transitionPolarKinematicState(noCurrent, initial, []);
    // Heading 0 (north) with wind from PI/2 (east) gives a 90deg apparent wind angle.
    expect(transition.stw_mps).toBeGreaterThan(0);
    expect(transition.stw_mps).not.toBe(2);
  });

  it('makes ground velocity equal water velocity when there is no current', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const transition = transitionPolarKinematicState(noCurrent, initial, []);
    expect(transition.ground_velocity_mps).toEqual(transition.water_velocity_mps);
    expect(transition.current_velocity_mps).toEqual({ x: 0, y: 0 });
  });

  it('composes ground velocity as water velocity plus the current vector', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const transition = transitionPolarKinematicState(withCurrent, initial, []);
    expect(transition.ground_velocity_mps.x).toBeCloseTo(transition.water_velocity_mps.x + transition.current_velocity_mps.x, 6);
    expect(transition.ground_velocity_mps.y).toBeCloseTo(transition.water_velocity_mps.y + transition.current_velocity_mps.y, 6);
    expect(transition.current_velocity_mps.x).toBeCloseTo(1.5, 6);
    expect(transition.current_velocity_mps.y).toBeCloseTo(0, 6);
  });

  it('stops without throwing when the boat points head to wind and there is no current', () => {
    const headToWind = Object.freeze({ ...noCurrent, true_wind_from_rad: 0 });
    const initial = createInitialPolarKinematicState(headToWind);
    const transition = transitionPolarKinematicState(headToWind, initial, []);
    expect(transition.stw_mps).toBe(0);
    expect(transition.displacement_m).toEqual({ x: 0, y: 0 });
    expect(transition.next_state.position_m).toEqual(initial.position_m);
  });

  it('applies helm within the same tick so steering changes speed immediately', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const straight = transitionPolarKinematicState(noCurrent, initial, []);
    const turned = transitionPolarKinematicState(noCurrent, initial, [
      { logical_tick: 0, sequence: 0, helm_command: 'starboard' as const },
    ]);
    expect(turned.next_state.heading_rad).not.toBe(straight.next_state.heading_rad);
    expect(turned.stw_mps).not.toBe(straight.stw_mps);
  });

  it('is deterministic and does not mutate its inputs', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const controls = [{ logical_tick: 0, sequence: 0, helm_command: 'port' as const }];
    const before = structuredClone(initial);
    const first = transitionPolarKinematicState(withCurrent, initial, controls);
    const second = transitionPolarKinematicState(withCurrent, initial, controls);
    expect(first).toEqual(second);
    expect(initial).toEqual(before);
  });

  it('rejects invalid states and controls', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    expect(() => transitionPolarKinematicState(noCurrent, { ...initial, heading_rad: Number.NaN }, [])).toThrow(TypeError);
    expect(() => transitionPolarKinematicState(noCurrent, initial, [
      { logical_tick: 5, sequence: 0, helm_command: 'port' as const },
    ])).toThrow(TypeError);
  });
});
