import { describe, expect, it } from 'vitest';
import { l01SyntheticEnvironmentV1 } from '../../src/contracts/l01-synthetic-environment.js';
import { projectL01SyntheticObservations } from '../../src/sim/l01-observation.js';
import { createInitialL01SyntheticState, transitionL01SyntheticState } from '../../src/sim/l01-synthetic-model.js';

describe('L01 synthetic observations', () => {
  it('derives COG from Cartesian displacement rather than copying heading', () => {
    const transition = transitionL01SyntheticState(l01SyntheticEnvironmentV1, createInitialL01SyntheticState(l01SyntheticEnvironmentV1), []);
    const observations = projectL01SyntheticObservations(l01SyntheticEnvironmentV1, { ...transition, displacement_m: { x: 1, y: 0 } });
    expect(observations.cog_rad).toBe(Number((Math.PI / 2).toFixed(6)));
    expect(observations.cog_rad).not.toBe(transition.next_state.heading_rad);
  });

  it('retains true wind as wind-from and derives apparent wind from relative flow vectors', () => {
    const profile = { ...l01SyntheticEnvironmentV1, true_wind_from_rad: 0, true_wind_speed_mps: 3, forward_speed_mps: 2 };
    const transition = transitionL01SyntheticState(profile, createInitialL01SyntheticState(profile), []);
    const observations = projectL01SyntheticObservations(profile, transition);
    expect(observations.true_wind_from_rad).toBe(0);
    expect(observations.apparent_wind_from_rad).toBe(0);
    expect(observations.apparent_wind_speed_mps).toBe(5);
    expect(Object.isFrozen(observations)).toBe(true);
    expect(projectL01SyntheticObservations({ ...profile, true_wind_from_rad: Math.PI * 2 }, transition).true_wind_from_rad).toBe(0);
  });

  it('rejects non-finite transition data and canonicalizes every authoritative value', () => {
    const transition = transitionL01SyntheticState(l01SyntheticEnvironmentV1, createInitialL01SyntheticState(l01SyntheticEnvironmentV1), []);
    expect(() => projectL01SyntheticObservations(l01SyntheticEnvironmentV1, { ...transition, displacement_m: { x: Number.POSITIVE_INFINITY, y: 0 } })).toThrow(/finite/i);
    const observations = projectL01SyntheticObservations(l01SyntheticEnvironmentV1, transition);
    for (const value of Object.values(observations)) expect(value).toBe(Number(value.toFixed(6)));
  });
});
