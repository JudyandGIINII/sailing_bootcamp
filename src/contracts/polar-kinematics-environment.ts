import { trainingSloopPolarV1 } from './polar-profile.js';

/**
 * Synthetic environment fixture for the polar kinematics model. Every number is
 * an explicit educational assumption, not a vessel, weather, route, or safety
 * value. The current vector is declared synthetic and non-navigational.
 */
export const POLAR_KINEMATICS_MODEL_VERSION = 'polar-kinematics-v5' as const;

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
  /**
   * The real-world timestamp (epoch ms) the session was started, read exactly
   * once by the UI layer (`src/main.ts`) and stored here. The current itself
   * is no longer stored — `deriveSyntheticCurrent` derives it purely from this
   * timestamp, which removes any chance of a stored vector disagreeing with
   * the declared time.
   */
  readonly current_epoch_ms: number;
  /** Declared synthetic seabed depth below the synthetic datum, in metres. */
  readonly seabed_depth_m: number;
  /** Declared synthetic draft of the training sloop, in metres. */
  readonly draft_m: number;
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
  // sin(0) === 0, so the canonical default profile derives zero current — this
  // deliberately keeps the existing L06 zero-current unit tests meaningful.
  // Slack water: the canonical profile derives exactly zero stream, which keeps
  // the zero-current baseline meaningful.
  current_epoch_ms: 11178000,
  seabed_depth_m: 3.5,
  draft_m: 1.6,
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
    'current_epoch_ms', 'seabed_depth_m', 'draft_m', 'full_helm_turn_rad_per_step',
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
    Number.isSafeInteger(candidate.current_epoch_ms) && (candidate.current_epoch_ms as number) >= 0 &&
    isFiniteNumber(candidate.seabed_depth_m) && candidate.seabed_depth_m >= 0 &&
    isFiniteNumber(candidate.draft_m) && candidate.draft_m >= 0 &&
    isFiniteNumber(candidate.full_helm_turn_rad_per_step) && candidate.full_helm_turn_rad_per_step > 0;
}

export function assertPolarKinematicsEnvironmentV1(value: unknown): asserts value is PolarKinematicsEnvironmentV1 {
  if (!isPolarKinematicsEnvironmentV1(value)) throw new TypeError('Invalid polar kinematics environment profile.');
}
