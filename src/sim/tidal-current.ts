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

/**
 * A simplified ~12h25m semidiurnal period chosen as an educational assumption
 * for pedagogical variety, not a measured or approved tidal harmonic constant.
 */
export const SEMIDIURNAL_PERIOD_MS = 12.42 * 60 * 60 * 1000;

/** A synthetic assumption, not a measured value. */
export const MAX_CURRENT_MPS = 1.5;

/** Flood direction: toward east. */
export const FLOOD_TO_RAD = Math.PI / 2;

/** Ebb direction: toward west. */
export const EBB_TO_RAD = (3 * Math.PI) / 2;

/**
 * Named points on the shared tide/stream phase. The stream is the tide's rate
 * of change, so slack water falls at high and low water, and the strongest
 * flood and ebb fall at mid-tide.
 */
export const PEAK_FLOOD_EPOCH_MS = 0;
export const SLACK_WATER_EPOCH_MS = SEMIDIURNAL_PERIOD_MS / 4;
export const PEAK_EBB_EPOCH_MS = SEMIDIURNAL_PERIOD_MS / 2;

/**
 * Derives a synthetic tidal current from an epoch timestamp using a single
 * sinusoid over the simplified semidiurnal period. Not a real tidal
 * prediction: it is a declared educational assumption for training purposes.
 */
/**
 * The epoch a given logical tick observes. Both the stream and the tide advance
 * with logical time from the one stored session-start timestamp, so a session
 * that waits sees both change together on a single shared phase.
 */
export function effectiveEpochMs(startEpochMs: number, logicalTick: number, stepSeconds: number): number {
  if (!Number.isSafeInteger(startEpochMs) || startEpochMs < 0) {
    throw new TypeError('Session start epoch must be a non-negative safe integer.');
  }
  if (!Number.isSafeInteger(logicalTick) || logicalTick < 0 || !Number.isFinite(stepSeconds) || stepSeconds <= 0) {
    throw new TypeError('Logical tick must be a non-negative safe integer and the step must be positive.');
  }
  return startEpochMs + Math.round(logicalTick * stepSeconds * 1000);
}

export function deriveSyntheticCurrent(epochMs: number): Readonly<{
  current_to_rad: number;
  current_speed_mps: number;
}> {
  if (!Number.isSafeInteger(epochMs) || epochMs < 0) {
    throw new TypeError('Tidal current epoch must be a non-negative safe integer.');
  }
  const phase = 2 * Math.PI * ((epochMs % SEMIDIURNAL_PERIOD_MS) / SEMIDIURNAL_PERIOD_MS);
  // The tide height uses sin(phase); the stream is its rate of change, so it
  // uses cos(phase). That puts the strongest flood/ebb at mid-tide and slack
  // water at the turn, which is the shape real tidal streams have. Still a
  // declared educational assumption, not a real stream prediction.
  const signed = Math.cos(phase);
  return Object.freeze({
    current_to_rad: signed >= 0 ? FLOOD_TO_RAD : EBB_TO_RAD,
    current_speed_mps: canonicalizeL01Number(Math.abs(signed) * MAX_CURRENT_MPS),
  });
}
