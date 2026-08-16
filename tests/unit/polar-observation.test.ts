import { describe, expect, it } from 'vitest';
import { canonicalizeL01Number } from '../../src/contracts/l01-synthetic-environment.js';
import { polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';
import { createInitialPolarKinematicState, transitionPolarKinematicState } from '../../src/sim/polar-kinematics-model.js';
import { l01DirectionFromVector, normalizeL01Heading } from '../../src/sim/l01-synthetic-model.js';
import { projectPolarObservations } from '../../src/sim/polar-observation.js';
import { PEAK_FLOOD_EPOCH_MS, SEMIDIURNAL_PERIOD_MS, SLACK_WATER_EPOCH_MS } from '../../src/sim/tidal-current.js';

/** The stream advances with logical time, so epochs are picked so the first
 * transition (logical tick 1) lands exactly on the wanted phase point. */
const startForTick = (targetEpochMs: number, tick: number) =>
  (((targetEpochMs - tick * 1000) % SEMIDIURNAL_PERIOD_MS) + SEMIDIURNAL_PERIOD_MS) % SEMIDIURNAL_PERIOD_MS;
const noCurrent = Object.freeze({ ...polarKinematicsEnvironmentV1, current_epoch_ms: startForTick(SLACK_WATER_EPOCH_MS, 1) });
const withCurrent = Object.freeze({ ...polarKinematicsEnvironmentV1, current_epoch_ms: startForTick(PEAK_FLOOD_EPOCH_MS, 1) });

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

  it('separates SOG from STW and COG from heading when a current is present, matching an independently derived ground vector', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const transition = transitionPolarKinematicState(withCurrent, initial, []);
    const observations = projectPolarObservations(withCurrent, transition);

    expect(observations.sog_mps).not.toBe(observations.stw_mps);
    expect(observations.cog_rad).not.toBe(observations.heading_rad);
    expect(observations.drift_angle_rad).not.toBe(0);

    // Pin real numbers derived independently from the transition's own exposed
    // water_velocity_mps (known: (0, stw) on tick 0 since initial heading is
    // north) and current_velocity_mps (known: 1.5 m/s due east, since
    // current_to_rad is PI/2), rather than only asserting inequality.
    const expectedGround = {
      x: transition.water_velocity_mps.x + transition.current_velocity_mps.x,
      y: transition.water_velocity_mps.y + transition.current_velocity_mps.y,
    };
    const expectedSog = canonicalizeL01Number(Math.hypot(expectedGround.x, expectedGround.y));
    const expectedCog = l01DirectionFromVector(expectedGround);
    const expectedDrift = canonicalizeL01Number(normalizeL01Heading(expectedCog - transition.next_state.heading_rad));

    expect(transition.current_velocity_mps).toEqual({ x: 1.5, y: 0 });
    expect(observations.sog_mps).toBe(expectedSog);
    expect(observations.cog_rad).toBe(expectedCog);
    expect(observations.drift_angle_rad).toBe(expectedDrift);
  });

  it('matches the declared vector composition for SOG', () => {
    const initial = createInitialPolarKinematicState(withCurrent);
    const transition = transitionPolarKinematicState(withCurrent, initial, []);
    const observations = projectPolarObservations(withCurrent, transition);
    const expected = canonicalizeL01Number(Math.hypot(transition.ground_velocity_mps.x, transition.ground_velocity_mps.y));
    expect(observations.sog_mps).toBe(expected);
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
    // contract (see l01-observation.ts's identical pattern). Pin the exact
    // canonicalized value rather than a tolerance comparison, since the
    // contract is "canonicalized to 6 decimals", not "close to" the raw value.
    expect(observations.true_wind_from_rad).toBe(canonicalizeL01Number(normalizeL01Heading(noCurrent.true_wind_from_rad)));
    expect(observations.true_wind_speed_mps).toBe(noCurrent.true_wind_speed_mps);
    expect(observations.apparent_wind_speed_mps).toBe(transition.next_state.apparent_wind_speed_mps);
    expect(transition).toEqual(before);
  });

  it('throws TypeError when the transition carries a non-finite heading_rad', () => {
    const initial = createInitialPolarKinematicState(noCurrent);
    const transition = transitionPolarKinematicState(noCurrent, initial, []);
    const malformed = {
      ...transition,
      next_state: { ...transition.next_state, heading_rad: NaN },
    };
    expect(() => projectPolarObservations(noCurrent, malformed)).toThrow(TypeError);
  });
});
