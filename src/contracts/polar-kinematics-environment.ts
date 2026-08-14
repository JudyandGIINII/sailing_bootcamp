import { trainingSloopPolarV1 } from './polar-profile.js';

/**
 * Synthetic environment fixture for the polar kinematics model. Every number is
 * an explicit educational assumption, not a vessel, weather, route, or safety
 * value. The current vector is declared synthetic and non-navigational.
 */
export const POLAR_KINEMATICS_MODEL_VERSION = 'polar-kinematics-v1' as const;

export interface PolarKinematicsEnvironmentV1 {
  readonly environment_id: 'polar-kinematics-training-ground';
  readonly environment_version: 1;
  readonly model_id: 'polar-kinematics';
  readonly model_version: typeof POLAR_KINEMATICS_MODEL_VERSION;
  readonly logical_step_seconds: number;
  readonly initial_position_m: Readonly<{ x: number; y: number }>;
  readonly initial_heading_rad: number;
  readonly polar_profile_id: typeof trainingSloopPolarV1.polar_id;
  readonly true_wind_from_rad: number;
  readonly true_wind_speed_mps: number;
  /** Declared synthetic current, stored as a `to` direction per the coordinate contract. */
  readonly current_to_rad: number;
  readonly current_speed_mps: number;
  readonly full_helm_turn_rad_per_step: number;
  readonly canonical_precision_version: 'l01-precision-v1';
}

export const polarKinematicsEnvironmentV1: Readonly<PolarKinematicsEnvironmentV1> = Object.freeze({
  environment_id: 'polar-kinematics-training-ground',
  environment_version: 1,
  model_id: 'polar-kinematics',
  model_version: POLAR_KINEMATICS_MODEL_VERSION,
  logical_step_seconds: 1,
  initial_position_m: Object.freeze({ x: 12, y: -8 }),
  initial_heading_rad: 0,
  polar_profile_id: trainingSloopPolarV1.polar_id,
  true_wind_from_rad: Math.PI / 2,
  true_wind_speed_mps: 6,
  current_to_rad: 0,
  current_speed_mps: 0,
  full_helm_turn_rad_per_step: Math.PI / 8,
  canonical_precision_version: 'l01-precision-v1',
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPolarKinematicsEnvironmentV1(value: unknown): value is PolarKinematicsEnvironmentV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = [
    'environment_id', 'environment_version', 'model_id', 'model_version',
    'logical_step_seconds', 'initial_position_m', 'initial_heading_rad',
    'polar_profile_id', 'true_wind_from_rad', 'true_wind_speed_mps',
    'current_to_rad', 'current_speed_mps', 'full_helm_turn_rad_per_step',
    'canonical_precision_version',
  ];
  if (Object.keys(candidate).length !== keys.length || !keys.every((key) => Object.hasOwn(candidate, key))) return false;
  const position = candidate.initial_position_m;
  return candidate.environment_id === 'polar-kinematics-training-ground' &&
    candidate.environment_version === 1 &&
    candidate.model_id === 'polar-kinematics' &&
    candidate.model_version === POLAR_KINEMATICS_MODEL_VERSION &&
    candidate.polar_profile_id === trainingSloopPolarV1.polar_id &&
    candidate.canonical_precision_version === 'l01-precision-v1' &&
    isFiniteNumber(candidate.logical_step_seconds) && candidate.logical_step_seconds > 0 &&
    typeof position === 'object' && position !== null && !Array.isArray(position) &&
    Object.keys(position).length === 2 && Object.hasOwn(position, 'x') && Object.hasOwn(position, 'y') &&
    isFiniteNumber((position as Record<string, unknown>).x) && isFiniteNumber((position as Record<string, unknown>).y) &&
    isFiniteNumber(candidate.initial_heading_rad) &&
    isFiniteNumber(candidate.true_wind_from_rad) &&
    isFiniteNumber(candidate.true_wind_speed_mps) && candidate.true_wind_speed_mps >= 0 &&
    isFiniteNumber(candidate.current_to_rad) &&
    isFiniteNumber(candidate.current_speed_mps) && candidate.current_speed_mps >= 0 &&
    isFiniteNumber(candidate.full_helm_turn_rad_per_step) && candidate.full_helm_turn_rad_per_step > 0;
}

export function assertPolarKinematicsEnvironmentV1(value: unknown): asserts value is PolarKinematicsEnvironmentV1 {
  if (!isPolarKinematicsEnvironmentV1(value)) throw new TypeError('Invalid polar kinematics environment profile.');
}
