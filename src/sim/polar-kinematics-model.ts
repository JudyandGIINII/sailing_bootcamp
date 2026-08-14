/**
 * Synthetic polar-and-current kinematics transition model. Every derived
 * number is an explicit educational assumption for browser-local training;
 * nothing here represents real vessel, weather, route, or safety behaviour.
 *
 * The apparent wind angle used to index the polar depends on boat velocity,
 * which itself depends on the polar lookup — a circular dependency. This is
 * broken deliberately by carrying the PREVIOUS tick's apparent wind VECTOR
 * forward and combining it with the CURRENT tick's heading: helm is applied
 * first (so steering changes speed within the same tick), then the apparent
 * wind angle is computed from that new heading against the prior apparent
 * wind, then the polar is looked up, then velocities are composed, and only
 * then is the new apparent wind computed and stored for the following tick.
 */
import { canonicalizeL01Number } from '../contracts/l01-synthetic-environment.js';
import {
  assertPolarKinematicsEnvironmentV1,
  type PolarKinematicsEnvironmentV1,
} from '../contracts/polar-kinematics-environment.js';
import { trainingSloopPolarV1 } from '../contracts/polar-profile.js';
import { validateHelmControls, type HelmCommand, type HelmControl } from './helm-controls.js';
import { l01DirectionFromVector, l01DirectionVector, normalizeL01Heading } from './l01-synthetic-model.js';
import { lookupTargetSpeedMps } from './polar.js';
import { composeGroundRelativeVelocity } from './vector.js';

export interface PolarKinematicState {
  readonly logical_tick: number;
  readonly position_m: Readonly<{ x: number; y: number }>;
  readonly heading_rad: number;
  readonly helm_command: HelmCommand;
  /** Carries the previous tick's apparent wind so the polar input stays acyclic. */
  readonly apparent_wind_from_rad: number;
  readonly apparent_wind_speed_mps: number;
}

export interface PolarKinematicTransition {
  readonly prior_state: PolarKinematicState;
  readonly next_state: PolarKinematicState;
  readonly accepted_helm_command: HelmCommand;
  readonly controls: readonly HelmControl[];
  readonly stw_mps: number;
  readonly water_velocity_mps: Readonly<{ x: number; y: number }>;
  readonly current_velocity_mps: Readonly<{ x: number; y: number }>;
  readonly ground_velocity_mps: Readonly<{ x: number; y: number }>;
  readonly displacement_m: Readonly<{ x: number; y: number }>;
}

function frozenPoint(x: number, y: number): Readonly<{ x: number; y: number }> {
  const snap = (value: number) => Math.abs(value) < 0.000001 ? 0 : value;
  return Object.freeze({ x: canonicalizeL01Number(snap(x)), y: canonicalizeL01Number(snap(y)) });
}

function assertFiniteState(state: PolarKinematicState): void {
  if (!Number.isSafeInteger(state.logical_tick) || state.logical_tick < 0 ||
    !Number.isFinite(state.position_m.x) || !Number.isFinite(state.position_m.y) ||
    !Number.isFinite(state.heading_rad) ||
    !Number.isFinite(state.apparent_wind_from_rad) ||
    !Number.isFinite(state.apparent_wind_speed_mps) ||
    !['neutral', 'port', 'starboard'].includes(state.helm_command)) {
    throw new TypeError('Polar kinematic state must contain finite canonical values.');
  }
}

/** Signed difference between a wind `from` direction and the boat heading, in [-PI, PI]. */
function apparentWindAngle(apparentFromRad: number, headingRad: number): number {
  const difference = normalizeL01Heading(apparentFromRad - headingRad);
  return difference > Math.PI ? difference - Math.PI * 2 : difference;
}

export function createInitialPolarKinematicState(profile: PolarKinematicsEnvironmentV1): PolarKinematicState {
  assertPolarKinematicsEnvironmentV1(profile);
  return Object.freeze({
    logical_tick: 0,
    position_m: frozenPoint(profile.initial_position_m.x, profile.initial_position_m.y),
    heading_rad: normalizeL01Heading(profile.initial_heading_rad),
    helm_command: 'neutral',
    // Declared initial condition: boat speed is zero, so apparent wind equals true wind.
    // Canonicalized like every other stored float, so state fed into the next tick's
    // polar lookup is always 6-decimal canonical (never a raw, full-precision literal).
    apparent_wind_from_rad: normalizeL01Heading(profile.true_wind_from_rad),
    apparent_wind_speed_mps: canonicalizeL01Number(profile.true_wind_speed_mps),
  });
}

/**
 * One renderer-independent fixed logical step. The polar is indexed by the
 * PREVIOUS tick's apparent wind vector combined with the CURRENT heading, which
 * keeps the computation acyclic while preserving immediate steering response.
 */
export function transitionPolarKinematicState(
  profile: PolarKinematicsEnvironmentV1,
  priorState: PolarKinematicState,
  orderedControls: readonly HelmControl[],
): PolarKinematicTransition {
  assertPolarKinematicsEnvironmentV1(profile);
  assertFiniteState(priorState);
  const controls = validateHelmControls(priorState.logical_tick, orderedControls);
  const acceptedHelm = controls.at(-1)?.helm_command ?? priorState.helm_command;
  const turn = acceptedHelm === 'port' ? -profile.full_helm_turn_rad_per_step : acceptedHelm === 'starboard' ? profile.full_helm_turn_rad_per_step : 0;
  const heading = normalizeL01Heading(priorState.heading_rad + turn);

  const awa = apparentWindAngle(priorState.apparent_wind_from_rad, heading);
  const stw = lookupTargetSpeedMps(trainingSloopPolarV1, awa, profile.true_wind_speed_mps);

  const waterVelocity = stw === 0 ? frozenPoint(0, 0) : l01DirectionVector(heading, stw);
  const currentVelocity = profile.current_speed_mps === 0
    ? frozenPoint(0, 0)
    : l01DirectionVector(normalizeL01Heading(profile.current_to_rad), profile.current_speed_mps);
  const groundVelocityRaw = composeGroundRelativeVelocity(waterVelocity, currentVelocity);
  const groundVelocity = frozenPoint(groundVelocityRaw.x, groundVelocityRaw.y);
  const displacement = frozenPoint(
    groundVelocity.x * profile.logical_step_seconds,
    groundVelocity.y * profile.logical_step_seconds,
  );

  // Apparent wind is measured against ground velocity: the air sits in the ground frame.
  const trueFlowTo = l01DirectionVector(normalizeL01Heading(profile.true_wind_from_rad + Math.PI), profile.true_wind_speed_mps);
  const apparentFlowTo = frozenPoint(trueFlowTo.x - groundVelocity.x, trueFlowTo.y - groundVelocity.y);
  const apparentSpeed = canonicalizeL01Number(Math.hypot(apparentFlowTo.x, apparentFlowTo.y));
  const apparentFrom = apparentSpeed === 0
    ? priorState.apparent_wind_from_rad
    : l01DirectionFromVector({ x: -apparentFlowTo.x, y: -apparentFlowTo.y });

  const nextState: PolarKinematicState = Object.freeze({
    logical_tick: priorState.logical_tick + 1,
    position_m: frozenPoint(priorState.position_m.x + displacement.x, priorState.position_m.y + displacement.y),
    heading_rad: heading,
    helm_command: acceptedHelm,
    apparent_wind_from_rad: apparentFrom,
    apparent_wind_speed_mps: apparentSpeed,
  });

  return Object.freeze({
    prior_state: Object.freeze({ ...priorState, position_m: frozenPoint(priorState.position_m.x, priorState.position_m.y) }),
    next_state: nextState,
    accepted_helm_command: acceptedHelm,
    controls,
    stw_mps: canonicalizeL01Number(stw),
    water_velocity_mps: waterVelocity,
    current_velocity_mps: currentVelocity,
    ground_velocity_mps: groundVelocity,
    displacement_m: displacement,
  });
}
