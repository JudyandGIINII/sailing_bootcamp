/**
 * Synthetic sail-trim and reef correction factors. PRD 8.2 requires that trim,
 * reef, wave and safety state adjust the polar's base target speed through
 * explicit correction coefficients rather than being ignored. This module
 * supplies the trim and reef half of that.
 *
 * Every number here is an invented educational assumption chosen so that
 * adjusting a sheet has a visible, explainable effect. None of it is measured
 * sail aerodynamics, a real trim guide, a reefing threshold, or navigational
 * or safety guidance. Wave and safety corrections are deliberately not modelled.
 */
import { canonicalizeL01Number } from '../contracts/l01-synthetic-environment.js';

/** Trim runs 0 (fully eased) to 1 (fully hauled in) as a declared synthetic scale. */
export const TRIM_MIN = 0;
export const TRIM_MAX = 1;
/** One key press moves a sheet by an eighth, so the full range is reachable in 8 steps. */
export const TRIM_STEP = 0.125;

/** Worst-case trim keeps this fraction of the polar's base speed; it never reaches zero. */
export const MIN_TRIM_EFFICIENCY = 0.55;
/** A reefed sail is deliberately slower — the lesson rewards choosing it before it pays off. */
export const REEF_SPEED_FACTOR = 0.75;

export interface SailTrimState {
  readonly main_trim: number;
  readonly jib_trim: number;
  readonly reefed: boolean;
}

export const INITIAL_SAIL_TRIM: Readonly<SailTrimState> = Object.freeze({
  main_trim: 0.5,
  jib_trim: 0.5,
  reefed: false,
});

function assertFiniteTrim(value: number): void {
  if (!Number.isFinite(value) || value < TRIM_MIN || value > TRIM_MAX) {
    throw new TypeError('Sail trim values must be finite and within the declared range.');
  }
}

/**
 * Cycles a sheet by one declared step, wrapping back to fully eased so every
 * position stays reachable from a keyboard without a second key.
 */
export function stepTrim(value: number): number {
  assertFiniteTrim(value);
  const next = value + TRIM_STEP;
  return canonicalizeL01Number(next > TRIM_MAX + 1e-9 ? TRIM_MIN : next);
}

/**
 * The declared synthetic best trim for an apparent wind angle: hauled in close
 * to the wind, eased off the wind. A straight line is used deliberately — this
 * is an educational shape, not a measured trim curve.
 */
export function declaredOptimalTrim(apparentWindAngleRad: number): number {
  if (!Number.isFinite(apparentWindAngleRad)) throw new TypeError('Apparent wind angle must be finite.');
  const folded = Math.min(Math.abs(apparentWindAngleRad), Math.PI);
  return canonicalizeL01Number(1 - folded / Math.PI);
}

/**
 * Efficiency falls linearly with distance from the declared optimal trim and is
 * clamped so a badly trimmed boat is slow, never stopped. Main and jib
 * contribute equally.
 */
export function trimEfficiency(trim: SailTrimState, apparentWindAngleRad: number): number {
  assertFiniteTrim(trim.main_trim);
  assertFiniteTrim(trim.jib_trim);
  if (typeof trim.reefed !== 'boolean') throw new TypeError('Reef state must be boolean.');
  const optimal = declaredOptimalTrim(apparentWindAngleRad);
  const span = TRIM_MAX - MIN_TRIM_EFFICIENCY;
  const efficiencyFor = (value: number) => 1 - (1 - MIN_TRIM_EFFICIENCY) * Math.abs(value - optimal);
  const combined = (efficiencyFor(trim.main_trim) + efficiencyFor(trim.jib_trim)) / 2;
  const bounded = Math.min(TRIM_MAX, Math.max(MIN_TRIM_EFFICIENCY, combined));
  return canonicalizeL01Number(span > 0 ? bounded : TRIM_MAX);
}

/** The full declared correction applied to the polar's base target speed. */
export function sailCorrectionFactor(trim: SailTrimState, apparentWindAngleRad: number): number {
  const efficiency = trimEfficiency(trim, apparentWindAngleRad);
  return canonicalizeL01Number(trim.reefed ? efficiency * REEF_SPEED_FACTOR : efficiency);
}
