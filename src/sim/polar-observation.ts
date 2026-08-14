/**
 * Synthetic polar-and-current observation projector. Turns a per-tick
 * PolarKinematicTransition into user-facing STW/SOG/COG/drift observations
 * for browser-local training only; nothing here represents real vessel,
 * weather, route, or navigational data.
 */
import { canonicalizeL01Number } from '../contracts/l01-synthetic-environment.js';
import {
  assertPolarKinematicsEnvironmentV1,
  type PolarKinematicsEnvironmentV1,
} from '../contracts/polar-kinematics-environment.js';
import { l01DirectionFromVector, normalizeL01Heading } from './l01-synthetic-model.js';
import type { PolarKinematicTransition } from './polar-kinematics-model.js';

/** Reuses the existing sentinel so a stopped boat reports no course instead of throwing. */
export type UnavailableObservation = 'declared-unavailable';

export interface PolarObservations {
  readonly heading_rad: number;
  readonly stw_mps: number;
  readonly sog_mps: number;
  readonly cog_rad: number | UnavailableObservation;
  readonly drift_angle_rad: number | UnavailableObservation;
  readonly true_wind_from_rad: number;
  readonly true_wind_speed_mps: number;
  readonly apparent_wind_from_rad: number;
  readonly apparent_wind_speed_mps: number;
}

/** Projects immutable, synthetic-only observations. No navigational claim is made. */
export function projectPolarObservations(
  profile: PolarKinematicsEnvironmentV1,
  transition: PolarKinematicTransition,
): PolarObservations {
  assertPolarKinematicsEnvironmentV1(profile);
  const ground = transition.ground_velocity_mps;
  if (!Number.isFinite(ground.x) || !Number.isFinite(ground.y)) {
    throw new TypeError('Polar observation ground velocity must be finite.');
  }
  const heading = transition.next_state.heading_rad;
  const sog = canonicalizeL01Number(Math.hypot(ground.x, ground.y));
  const stopped = sog === 0;
  let cog: number | UnavailableObservation;
  let drift: number | UnavailableObservation;
  if (stopped) {
    cog = 'declared-unavailable';
    drift = 'declared-unavailable';
  } else {
    const cogValue = l01DirectionFromVector(ground);
    cog = cogValue;
    drift = canonicalizeL01Number(normalizeL01Heading(cogValue - heading));
  }
  return Object.freeze({
    heading_rad: heading,
    stw_mps: transition.stw_mps,
    sog_mps: sog,
    cog_rad: cog,
    drift_angle_rad: drift,
    true_wind_from_rad: canonicalizeL01Number(normalizeL01Heading(profile.true_wind_from_rad)),
    true_wind_speed_mps: canonicalizeL01Number(profile.true_wind_speed_mps),
    apparent_wind_from_rad: transition.next_state.apparent_wind_from_rad,
    apparent_wind_speed_mps: transition.next_state.apparent_wind_speed_mps,
  });
}
