/**
 * L01's sole model fixture. Every number below is an explicit synthetic test
 * assumption for browser-local education, not a vessel, weather, route, or
 * safety value.
 */
export interface L01SyntheticEnvironmentV1 {
  readonly environment_id: 'l01-synthetic-training-ground';
  readonly environment_version: 1;
  readonly model_id: 'l01-synthetic-kinematics';
  readonly model_version: 1;
  readonly logical_step_seconds: number;
  readonly initial_position_m: Readonly<{ x: number; y: number }>;
  readonly initial_heading_rad: number;
  readonly forward_speed_mps: number;
  readonly true_wind_from_rad: number;
  readonly true_wind_speed_mps: number;
  readonly full_helm_turn_rad_per_step: number;
  readonly canonical_precision_version: 'l01-precision-v1';
}

export const L01_CANONICAL_DECIMAL_PLACES = 6 as const;

export const l01SyntheticEnvironmentV1: Readonly<L01SyntheticEnvironmentV1> = Object.freeze({
  environment_id: 'l01-synthetic-training-ground',
  environment_version: 1,
  model_id: 'l01-synthetic-kinematics',
  model_version: 1,
  logical_step_seconds: 1,
  initial_position_m: Object.freeze({ x: 12, y: -8 }),
  initial_heading_rad: 0,
  forward_speed_mps: 2,
  true_wind_from_rad: Math.PI / 2,
  true_wind_speed_mps: 3,
  full_helm_turn_rad_per_step: Math.PI / 8,
  canonical_precision_version: 'l01-precision-v1',
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Strict, dependency-free guard for persisted L01 synthetic profile data. */
export function isL01SyntheticEnvironmentV1(value: unknown): value is L01SyntheticEnvironmentV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = [
    'environment_id', 'environment_version', 'model_id', 'model_version',
    'logical_step_seconds', 'initial_position_m', 'initial_heading_rad',
    'forward_speed_mps', 'true_wind_from_rad', 'true_wind_speed_mps',
    'full_helm_turn_rad_per_step', 'canonical_precision_version',
  ];
  if (Object.keys(candidate).length !== keys.length || !keys.every((key) => Object.hasOwn(candidate, key))) return false;
  const position = candidate.initial_position_m;
  return candidate.environment_id === 'l01-synthetic-training-ground' &&
    candidate.environment_version === 1 &&
    candidate.model_id === 'l01-synthetic-kinematics' &&
    candidate.model_version === 1 &&
    candidate.canonical_precision_version === 'l01-precision-v1' &&
    isFiniteNumber(candidate.logical_step_seconds) && candidate.logical_step_seconds > 0 &&
    typeof position === 'object' && position !== null && !Array.isArray(position) &&
    Object.keys(position).length === 2 && Object.hasOwn(position, 'x') && Object.hasOwn(position, 'y') &&
    isFiniteNumber((position as Record<string, unknown>).x) && isFiniteNumber((position as Record<string, unknown>).y) &&
    isFiniteNumber(candidate.initial_heading_rad) &&
    isFiniteNumber(candidate.forward_speed_mps) && candidate.forward_speed_mps > 0 &&
    isFiniteNumber(candidate.true_wind_from_rad) &&
    isFiniteNumber(candidate.true_wind_speed_mps) && candidate.true_wind_speed_mps > 0 &&
    isFiniteNumber(candidate.full_helm_turn_rad_per_step) && candidate.full_helm_turn_rad_per_step > 0;
}

export function assertL01SyntheticEnvironmentV1(value: unknown): asserts value is L01SyntheticEnvironmentV1 {
  if (!isL01SyntheticEnvironmentV1(value)) throw new TypeError('Invalid L01 synthetic environment profile.');
}

/** Canonical serialization precision for this explicitly versioned fixture. */
export function canonicalizeL01Number(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError('L01 synthetic values must be finite.');
  const rounded = Math.round(value * (10 ** L01_CANONICAL_DECIMAL_PLACES)) / (10 ** L01_CANONICAL_DECIMAL_PLACES);
  return Object.is(rounded, -0) ? 0 : rounded;
}
