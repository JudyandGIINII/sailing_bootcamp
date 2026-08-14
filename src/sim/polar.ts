/**
 * Bilinear lookup over the synthetic training-sloop polar table. Every
 * numeric result is derived solely from explicit educational assumption
 * data; nothing here represents real vessel, weather, route, or safety
 * performance.
 */
import { canonicalizeL01Number } from '../contracts/l01-synthetic-environment.js';
import { assertPolarProfileV1, type PolarProfileV1 } from '../contracts/polar-profile.js';

const TAU = Math.PI * 2;

/** Folds any angle to the [0, PI] magnitude used by the symmetric polar grid. */
function foldApparentWindAngle(awaRad: number): number {
  const normalized = ((awaRad % TAU) + TAU) % TAU;
  return normalized > Math.PI ? TAU - normalized : normalized;
}

/** Returns the lower grid index and the [0,1] fraction toward the next index. */
function bracket(axis: readonly number[], value: number): { index: number; fraction: number } {
  const last = axis.length - 1;
  if (value <= (axis[0] as number)) return { index: 0, fraction: 0 };
  if (value >= (axis[last] as number)) return { index: last - 1, fraction: 1 };
  let index = 0;
  while (index < last - 1 && value >= (axis[index + 1] as number)) index += 1;
  const lower = axis[index] as number;
  const upper = axis[index + 1] as number;
  return { index, fraction: (value - lower) / (upper - lower) };
}

/**
 * Bilinear lookup of the declared synthetic target speed through water.
 * This asserts no real sailing performance; values are unvalidated assumptions.
 */
export function lookupTargetSpeedMps(profile: PolarProfileV1, awaRad: number, twsMps: number): number {
  assertPolarProfileV1(profile);
  if (!Number.isFinite(awaRad) || !Number.isFinite(twsMps)) {
    throw new TypeError('Polar lookup inputs must be finite.');
  }
  const awa = bracket(profile.awa_axis_rad, foldApparentWindAngle(awaRad));
  const tws = bracket(profile.tws_axis_mps, Math.max(0, twsMps));
  const rowLow = profile.target_stw_mps[awa.index] as readonly number[];
  const rowHigh = profile.target_stw_mps[awa.index + 1] as readonly number[];
  const lowLow = rowLow[tws.index] as number;
  const lowHigh = rowLow[tws.index + 1] as number;
  const highLow = rowHigh[tws.index] as number;
  const highHigh = rowHigh[tws.index + 1] as number;
  const low = lowLow + (lowHigh - lowLow) * tws.fraction;
  const high = highLow + (highHigh - highLow) * tws.fraction;
  return canonicalizeL01Number(low + (high - low) * awa.fraction);
}
