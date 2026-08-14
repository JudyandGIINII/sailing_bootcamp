import { describe, expect, it } from 'vitest';
import { polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';
import { createInitialPolarKinematicState, transitionPolarKinematicState } from '../../src/sim/polar-kinematics-model.js';
import { projectPolarObservations } from '../../src/sim/polar-observation.js';

const noCurrent = polarKinematicsEnvironmentV1;
const withCurrent = Object.freeze({ ...polarKinematicsEnvironmentV1, current_to_rad: Math.PI / 2, current_speed_mps: 1.5 });

function observe(profile: typeof polarKinematicsEnvironmentV1) {
  const initial = createInitialPolarKinematicState(profile);
  return projectPolarObservations(profile, transitionPolarKinematicState(profile, initial, []));
}

describe('polar observations (FR-04)', () => {
  it('collapses SOG onto STW and COG onto heading when there is no current', () => {
    const observations = observe(noCurrent);
    expect(observations.sog_mps).toBe(observations.stw_mps);
    expect(observations.cog_rad).toBe(observations.heading_rad);
    expect(observations.drift_angle_rad).toBe(0);
  });

  it('separates SOG from STW and COG from heading when a current is present', () => {
    const observations = observe(withCurrent);
    expect(observations.sog_mps).not.toBe(observations.stw_mps);
    expect(observations.cog_rad).not.toBe(observations.heading_rad);
    expect(observations.drift_angle_rad).not.toBe(0);
  });

  it('matches the declared vector composition for SOG', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const transition = transitionPolarKinematicState(withCurrent, initial, []);
    const observations = projectPolarObservations(withCurrent, transition);
    const expected = Math.hypot(transition.ground_velocity_mps.x, transition.ground_velocity_mps.y);
    expect(observations.sog_mps).toBeCloseTo(expected, 6);
  });

  it('declares COG and drift unavailable when the boat is stopped over ground', () => {
    const headToWind = Object.freeze({ ...noCurrent, true_wind_from_rad: 0 });
    const initial = createInitialPolarKinematicState(headToWind);
    const transition = transitionPolarKinematicState(headToWind, initial, []);
    const observations = projectPolarObservations(headToWind, transition);
    expect(observations.sog_mps).toBe(0);
    expect(observations.cog_rad).toBe('declared-unavailable');
    expect(observations.drift_angle_rad).toBe('declared-unavailable');
  });

  it('exposes true and apparent wind without mutating the transition', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const transition = transitionPolarKinematicState(noCurrent, initial, []);
    const before = structuredClone(transition);
    const observations = projectPolarObservations(noCurrent, transition);
    // true_wind_from_rad is canonicalized to 6 decimals per the repo-wide float
    // contract (see l01-observation.ts's identical pattern), so it is compared
    // with tolerance rather than bit-exact `toBe`, consistent with the SOG
    // assertion below.
    expect(observations.true_wind_from_rad).toBeCloseTo(noCurrent.true_wind_from_rad, 6);
    expect(observations.true_wind_speed_mps).toBe(noCurrent.true_wind_speed_mps);
    expect(observations.apparent_wind_speed_mps).toBe(transition.next_state.apparent_wind_speed_mps);
    expect(transition).toEqual(before);
  });
});
