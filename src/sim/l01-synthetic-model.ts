import { assertL01SyntheticEnvironmentV1, canonicalizeL01Number, type L01SyntheticEnvironmentV1 } from '../contracts/l01-synthetic-environment.js';

export type L01HelmCommand = 'neutral' | 'port' | 'starboard';

export interface L01SyntheticState {
  readonly logical_tick: number;
  readonly position_m: Readonly<{ x: number; y: number }>;
  readonly heading_rad: number;
  readonly helm_command: L01HelmCommand;
}

export interface L01HelmControl {
  readonly logical_tick: number;
  readonly sequence: number;
  readonly helm_command: L01HelmCommand;
}

export interface L01SyntheticTransition {
  readonly prior_state: L01SyntheticState;
  readonly next_state: L01SyntheticState;
  readonly accepted_helm_command: L01HelmCommand;
  readonly controls: readonly L01HelmControl[];
  readonly velocity_mps: Readonly<{ x: number; y: number }>;
  readonly displacement_m: Readonly<{ x: number; y: number }>;
}

const TAU = Math.PI * 2;

function frozenPoint(x: number, y: number): Readonly<{ x: number; y: number }> {
  const snap = (value: number) => Math.abs(value) < 0.000001 ? 0 : value;
  return Object.freeze({ x: canonicalizeL01Number(snap(x)), y: canonicalizeL01Number(snap(y)) });
}

function assertFiniteState(state: L01SyntheticState): void {
  if (!Number.isSafeInteger(state.logical_tick) || state.logical_tick < 0 ||
    !Number.isFinite(state.position_m.x) || !Number.isFinite(state.position_m.y) ||
    !Number.isFinite(state.heading_rad) ||
    !['neutral', 'port', 'starboard'].includes(state.helm_command)) {
    throw new TypeError('L01 synthetic state must contain finite canonical values.');
  }
}

/** North-zero / clockwise-positive internal radians, normalized to [0, 2π). */
export function normalizeL01Heading(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError('L01 heading must be finite.');
  const normalized = ((value % TAU) + TAU) % TAU;
  return canonicalizeL01Number(normalized === TAU ? 0 : normalized);
}

export function createInitialL01SyntheticState(profile: L01SyntheticEnvironmentV1): L01SyntheticState {
  assertL01SyntheticEnvironmentV1(profile);
  return Object.freeze({
    logical_tick: 0,
    position_m: frozenPoint(profile.initial_position_m.x, profile.initial_position_m.y),
    heading_rad: normalizeL01Heading(profile.initial_heading_rad),
    helm_command: 'neutral',
  });
}

/** Converts a north-zero / clockwise-positive direction to an east/north vector. */
export function l01DirectionVector(directionRad: number, magnitude: number): Readonly<{ x: number; y: number }> {
  if (!Number.isFinite(directionRad) || !Number.isFinite(magnitude)) throw new TypeError('L01 vector inputs must be finite.');
  return frozenPoint(Math.sin(directionRad) * magnitude, Math.cos(directionRad) * magnitude);
}

export function l01DirectionFromVector(vector: Readonly<{ x: number; y: number }>): number {
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y) || (vector.x === 0 && vector.y === 0)) {
    throw new TypeError('L01 direction vector must be finite and non-zero.');
  }
  return normalizeL01Heading(Math.atan2(vector.x, vector.y));
}

function validatedControls(prior: L01SyntheticState, controls: readonly L01HelmControl[]): readonly L01HelmControl[] {
  const ordered = [...controls].sort((left, right) => left.logical_tick - right.logical_tick || left.sequence - right.sequence);
  for (let index = 0; index < ordered.length; index += 1) {
    const control = ordered[index];
    const previous = ordered[index - 1];
    if (!control || control.logical_tick !== prior.logical_tick || !Number.isSafeInteger(control.sequence) || control.sequence < 0 || !['neutral', 'port', 'starboard'].includes(control.helm_command) ||
      (previous !== undefined && previous.logical_tick === control.logical_tick && previous.sequence === control.sequence)) {
      throw new TypeError('L01 helm controls must have unique ordered logical tick and sequence values.');
    }
  }
  return Object.freeze(ordered.map((control) => Object.freeze({ ...control })));
}

/**
 * One renderer-independent fixed logical step. All outputs are copied and
 * canonicalized only for authoritative state/event serialization.
 */
export function transitionL01SyntheticState(
  profile: L01SyntheticEnvironmentV1,
  priorState: L01SyntheticState,
  orderedControls: readonly L01HelmControl[],
): L01SyntheticTransition {
  assertL01SyntheticEnvironmentV1(profile);
  assertFiniteState(priorState);
  const controls = validatedControls(priorState, orderedControls);
  const acceptedHelm = controls.at(-1)?.helm_command ?? priorState.helm_command;
  const turn = acceptedHelm === 'port' ? -profile.full_helm_turn_rad_per_step : acceptedHelm === 'starboard' ? profile.full_helm_turn_rad_per_step : 0;
  const heading = normalizeL01Heading(priorState.heading_rad + turn);
  const velocity = l01DirectionVector(heading, profile.forward_speed_mps);
  const displacement = frozenPoint(velocity.x * profile.logical_step_seconds, velocity.y * profile.logical_step_seconds);
  const nextState: L01SyntheticState = Object.freeze({
    logical_tick: priorState.logical_tick + 1,
    position_m: frozenPoint(priorState.position_m.x + displacement.x, priorState.position_m.y + displacement.y),
    heading_rad: heading,
    helm_command: acceptedHelm,
  });
  return Object.freeze({
    prior_state: Object.freeze({ ...priorState, position_m: frozenPoint(priorState.position_m.x, priorState.position_m.y) }),
    next_state: nextState,
    accepted_helm_command: acceptedHelm,
    controls,
    velocity_mps: velocity,
    displacement_m: displacement,
  });
}
