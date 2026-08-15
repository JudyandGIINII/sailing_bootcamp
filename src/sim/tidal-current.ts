/**
 * Deliberately simple synthetic semidiurnal tidal-current shape for the L06
 * polar-kinematics lesson. This is an educational assumption for browser-local
 * training, NOT real tide data, harmonic constants, or a navigational current
 * prediction. It is a single-sinusoid approximation of a semidiurnal tide
 * (roughly two cycles a day), chosen for pedagogical variety, not accuracy.
 *
 * The function is pure: it derives the current deterministically from a
 * caller-supplied epoch timestamp. It never reads the wall clock itself —
 * `src/sim` must stay pure so replays reproduce exactly. Only the UI layer
 * (`src/main.ts`) is permitted to read the current real-world time; it does
 * so once per session start and stores the result in the replay identity.
 */
import { canonicalizeL01Number } from '../contracts/l01-synthetic-environment.js';

/** The standard simplified semidiurnal tidal period (~12 hours 25 minutes). */
export const SEMIDIURNAL_PERIOD_MS = 12.42 * 60 * 60 * 1000;

/** A synthetic assumption, not a measured value. */
export const MAX_CURRENT_MPS = 1.5;

/** Flood direction: toward east. */
export const FLOOD_TO_RAD = Math.PI / 2;

/** Ebb direction: toward west. */
export const EBB_TO_RAD = (3 * Math.PI) / 2;

/**
 * Derives a synthetic tidal current from an epoch timestamp using a single
 * sinusoid over the simplified semidiurnal period. Not a real tidal
 * prediction: it is a declared educational assumption for training purposes.
 */
export function deriveSyntheticCurrent(epochMs: number): Readonly<{
  current_to_rad: number;
  current_speed_mps: number;
}> {
  if (!Number.isSafeInteger(epochMs) || epochMs < 0) {
    throw new TypeError('Tidal current epoch must be a non-negative safe integer.');
  }
  const phase = 2 * Math.PI * ((epochMs % SEMIDIURNAL_PERIOD_MS) / SEMIDIURNAL_PERIOD_MS);
  const signed = Math.sin(phase);
  return Object.freeze({
    current_to_rad: signed >= 0 ? FLOOD_TO_RAD : EBB_TO_RAD,
    current_speed_mps: canonicalizeL01Number(Math.abs(signed) * MAX_CURRENT_MPS),
  });
}
