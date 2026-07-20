import { assertL01SyntheticEnvironmentV1, canonicalizeL01Number, type L01SyntheticEnvironmentV1 } from '../contracts/l01-synthetic-environment.js';
import { l01DirectionFromVector, l01DirectionVector, normalizeL01Heading, type L01SyntheticTransition } from './l01-synthetic-model.js';

export interface L01SyntheticObservations {
  readonly heading_rad: number;
  readonly cog_rad: number;
  readonly true_wind_from_rad: number;
  readonly true_wind_speed_mps: number;
  readonly apparent_wind_from_rad: number;
  readonly apparent_wind_speed_mps: number;
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError('L01 synthetic observation inputs and results must be finite.');
  return canonicalizeL01Number(value);
}

/** Projects immutable, synthetic-only observations from a canonical transition. */
export function projectL01SyntheticObservations(
  profile: L01SyntheticEnvironmentV1,
  transition: L01SyntheticTransition,
): L01SyntheticObservations {
  assertL01SyntheticEnvironmentV1(profile);
  const displacement = transition.displacement_m;
  if (!Number.isFinite(displacement.x) || !Number.isFinite(displacement.y) || (displacement.x === 0 && displacement.y === 0)) {
    throw new TypeError('L01 synthetic displacement must be finite and non-zero for COG.');
  }
  const trueFlowTo = l01DirectionVector(profile.true_wind_from_rad + Math.PI, profile.true_wind_speed_mps);
  const boatVelocity = transition.velocity_mps;
  if (!Number.isFinite(boatVelocity.x) || !Number.isFinite(boatVelocity.y)) throw new TypeError('L01 synthetic boat velocity must be finite.');
  const apparentFlowTo = { x: trueFlowTo.x - boatVelocity.x, y: trueFlowTo.y - boatVelocity.y };
  const apparentSpeed = Math.hypot(apparentFlowTo.x, apparentFlowTo.y);
  if (apparentSpeed === 0) throw new TypeError('L01 synthetic apparent wind flow must be non-zero.');
  return Object.freeze({
    heading_rad: finite(transition.next_state.heading_rad),
    cog_rad: finite(l01DirectionFromVector(displacement)),
    true_wind_from_rad: finite(normalizeL01Heading(profile.true_wind_from_rad)),
    true_wind_speed_mps: finite(profile.true_wind_speed_mps),
    apparent_wind_from_rad: finite(l01DirectionFromVector({ x: -apparentFlowTo.x, y: -apparentFlowTo.y })),
    apparent_wind_speed_mps: finite(apparentSpeed),
  });
}
