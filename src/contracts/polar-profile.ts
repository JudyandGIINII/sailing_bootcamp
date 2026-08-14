/**
 * Synthetic polar table for the training sloop. Every number is an explicit
 * educational assumption for browser-local training, not a vessel, weather,
 * route, or safety value. No real hull performance is asserted.
 */
export interface PolarProfileV1 {
  readonly polar_id: 'training-sloop-synthetic-polar';
  readonly polar_version: 1;
  readonly validation_record_id: 'VR-POLAR-v0';
  readonly validation_disposition: 'assumption';
  /** Apparent wind angle grid, folded to [0, PI], strictly ascending. */
  readonly awa_axis_rad: readonly number[];
  /** True wind speed grid in m/s, strictly ascending, starting at 0. */
  readonly tws_axis_mps: readonly number[];
  /** target_stw_mps[awaIndex][twsIndex] in m/s. */
  readonly target_stw_mps: readonly (readonly number[])[];
}

const DEG = Math.PI / 180;

export const trainingSloopPolarV1: Readonly<PolarProfileV1> = Object.freeze({
  polar_id: 'training-sloop-synthetic-polar',
  polar_version: 1,
  validation_record_id: 'VR-POLAR-v0',
  validation_disposition: 'assumption',
  awa_axis_rad: Object.freeze([0, 30 * DEG, 45 * DEG, 60 * DEG, 90 * DEG, 120 * DEG, 150 * DEG, 180 * DEG]),
  tws_axis_mps: Object.freeze([0, 2, 4, 6, 8, 10]),
  target_stw_mps: Object.freeze([
    Object.freeze([0, 0.0, 0.0, 0.0, 0.0, 0.0]),
    Object.freeze([0, 0.6, 1.3, 1.9, 2.3, 2.5]),
    Object.freeze([0, 0.9, 1.9, 2.7, 3.2, 3.5]),
    Object.freeze([0, 1.1, 2.3, 3.2, 3.8, 4.1]),
    Object.freeze([0, 1.2, 2.5, 3.5, 4.2, 4.6]),
    Object.freeze([0, 1.1, 2.4, 3.3, 4.0, 4.4]),
    Object.freeze([0, 0.9, 1.9, 2.7, 3.3, 3.6]),
    Object.freeze([0, 0.7, 1.5, 2.2, 2.7, 3.0]),
  ]),
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isAscending(axis: readonly unknown[]): boolean {
  return axis.every((value, index) => isFiniteNumber(value) && (index === 0 || value > (axis[index - 1] as number)));
}

/** Strict, dependency-free guard for persisted polar profile data. */
export function isPolarProfileV1(value: unknown): value is PolarProfileV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = ['polar_id', 'polar_version', 'validation_record_id', 'validation_disposition', 'awa_axis_rad', 'tws_axis_mps', 'target_stw_mps'];
  if (Object.keys(candidate).length !== keys.length || !keys.every((key) => Object.hasOwn(candidate, key))) return false;
  const awa = candidate.awa_axis_rad;
  const tws = candidate.tws_axis_mps;
  const table = candidate.target_stw_mps;
  if (!Array.isArray(awa) || !Array.isArray(tws) || !Array.isArray(table)) return false;
  if (awa.length < 2 || tws.length < 2 || !isAscending(awa) || !isAscending(tws)) return false;
  if (awa[0] !== 0 || (awa.at(-1) as number) > Math.PI || tws[0] !== 0) return false;
  if (table.length !== awa.length) return false;
  return candidate.polar_id === 'training-sloop-synthetic-polar' &&
    candidate.polar_version === 1 &&
    candidate.validation_record_id === 'VR-POLAR-v0' &&
    candidate.validation_disposition === 'assumption' &&
    table.every((row) => Array.isArray(row) && row.length === tws.length && row.every((cell) => isFiniteNumber(cell) && cell >= 0));
}

export function assertPolarProfileV1(value: unknown): asserts value is PolarProfileV1 {
  if (!isPolarProfileV1(value)) throw new TypeError('Invalid synthetic polar profile.');
}
