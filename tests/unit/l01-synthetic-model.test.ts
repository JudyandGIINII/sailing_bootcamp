import { describe, expect, it } from 'vitest';
import { l01SyntheticEnvironmentV1 } from '../../src/contracts/l01-synthetic-environment.js';
import { createInitialL01SyntheticState, normalizeL01Heading, transitionL01SyntheticState } from '../../src/sim/l01-synthetic-model.js';

describe('L01 synthetic kinematics', () => {
  it('uses the declared north-zero, clockwise-positive Cartesian convention at cardinal headings', () => {
    const profile = l01SyntheticEnvironmentV1;
    const initial = createInitialL01SyntheticState(profile);
    const atNorth = transitionL01SyntheticState(profile, initial, []);
    const atEast = transitionL01SyntheticState(profile, { ...initial, heading_rad: Math.PI / 2 }, []);
    const atSouth = transitionL01SyntheticState(profile, { ...initial, heading_rad: Math.PI }, []);
    const atWest = transitionL01SyntheticState(profile, { ...initial, heading_rad: Math.PI * 1.5 }, []);

    expect(atNorth.displacement_m).toEqual({ x: 0, y: profile.forward_speed_mps * profile.logical_step_seconds });
    expect(atEast.displacement_m).toEqual({ x: profile.forward_speed_mps * profile.logical_step_seconds, y: 0 });
    expect(atSouth.displacement_m).toEqual({ x: 0, y: -profile.forward_speed_mps * profile.logical_step_seconds });
    expect(atWest.displacement_m).toEqual({ x: -profile.forward_speed_mps * profile.logical_step_seconds, y: 0 });
  });

  it('normalizes headings and applies same-tick helm controls by sequence without mutating inputs', () => {
    expect(normalizeL01Heading(-Math.PI / 2)).toBeCloseTo(Math.PI * 1.5);
    expect(normalizeL01Heading(Math.PI * 2)).toBe(0);
    const state = createInitialL01SyntheticState(l01SyntheticEnvironmentV1);
    const controls = [
      { logical_tick: 0, sequence: 2, helm_command: 'starboard' as const },
      { logical_tick: 0, sequence: 1, helm_command: 'port' as const },
    ];
    const stateBefore = structuredClone(state);
    const controlsBefore = structuredClone(controls);
    const transition = transitionL01SyntheticState(l01SyntheticEnvironmentV1, state, controls);

    expect(transition.accepted_helm_command).toBe('starboard');
    expect(transition.next_state.heading_rad).toBe(Number(l01SyntheticEnvironmentV1.full_helm_turn_rad_per_step.toFixed(6)));
    expect(state).toEqual(stateBefore);
    expect(controls).toEqual(controlsBefore);
    expect(Object.isFrozen(transition.next_state)).toBe(true);
  });

  it('rejects invalid finite values and invalid positive-speed profiles', () => {
    const state = createInitialL01SyntheticState(l01SyntheticEnvironmentV1);
    expect(() => transitionL01SyntheticState({ ...l01SyntheticEnvironmentV1, forward_speed_mps: 0 }, state, [])).toThrow(/profile/i);
    expect(() => transitionL01SyntheticState(l01SyntheticEnvironmentV1, { ...state, heading_rad: Number.NaN }, [])).toThrow(/finite/i);
    expect(() => transitionL01SyntheticState(l01SyntheticEnvironmentV1, state, [{ logical_tick: 0, sequence: 1, helm_command: 'neutral' }, { logical_tick: 0, sequence: 1, helm_command: 'port' }])).toThrow(/sequence/i);
  });

  it('exposes one frozen, explicit synthetic fixture profile and canonical numeric outputs', () => {
    const profile = l01SyntheticEnvironmentV1;
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.initial_position_m)).toBe(true);
    const transition = transitionL01SyntheticState(profile, createInitialL01SyntheticState(profile), []);
    expect(transition.next_state.position_m.x).toBe(Number(transition.next_state.position_m.x.toFixed(6)));
    expect(transitionL01SyntheticState(profile, createInitialL01SyntheticState(profile), [])).toEqual(transition);
  });
});
