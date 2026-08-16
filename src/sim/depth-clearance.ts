/**
 * Synthetic tide height and under-keel clearance. PRD 8.1 requires the tide to
 * drive a `depth + tide - draft` clearance and PRD FR-05 requires crossing a
 * clearance threshold to record exactly one event.
 *
 * The tide reuses the same simplified semidiurnal shape as the current, so a
 * session that waits long enough sees the clearance rise and fall. Every number
 * here is an invented educational assumption. None of it is a real tide
 * prediction, a charted depth, a datum, a sounding, or an under-keel safety
 * margin, and it must never be used for navigation.
 */
import { canonicalizeL01Number } from '../contracts/l01-synthetic-environment.js';
import { SEMIDIURNAL_PERIOD_MS } from './tidal-current.js';

/** Declared synthetic tidal range: the height swings between -/+ this value. */
export const TIDE_AMPLITUDE_M = 1.8;

/** Below this the lesson declares caution; below the danger level it declares danger. */
export const CLEARANCE_CAUTION_M = 1.5;
export const CLEARANCE_DANGER_M = 0.5;

export type ClearanceLevel = 'clear' | 'caution' | 'danger';

function assertEpoch(epochMs: number): void {
  if (!Number.isSafeInteger(epochMs) || epochMs < 0) {
    throw new TypeError('Synthetic tide epoch must be a non-negative safe integer of milliseconds.');
  }
}

/**
 * Height above the declared synthetic datum. Deliberately the same period as
 * the current so both derive from one stored timestamp.
 */
export function deriveSyntheticTideHeightM(epochMs: number): number {
  assertEpoch(epochMs);
  const phase = 2 * Math.PI * ((epochMs % SEMIDIURNAL_PERIOD_MS) / SEMIDIURNAL_PERIOD_MS);
  return canonicalizeL01Number(Math.sin(phase) * TIDE_AMPLITUDE_M);
}

/** `seabed depth + tide height - draft`, the declared synthetic under-keel clearance. */
export function deriveSyntheticClearanceM(seabedDepthM: number, epochMs: number, draftM: number): number {
  if (!Number.isFinite(seabedDepthM) || seabedDepthM < 0 || !Number.isFinite(draftM) || draftM < 0) {
    throw new TypeError('Synthetic seabed depth and draft must be finite and non-negative.');
  }
  return canonicalizeL01Number(seabedDepthM + deriveSyntheticTideHeightM(epochMs) - draftM);
}

export function clearanceLevel(clearanceM: number): ClearanceLevel {
  if (!Number.isFinite(clearanceM)) throw new TypeError('Clearance must be finite.');
  if (clearanceM < CLEARANCE_DANGER_M) return 'danger';
  if (clearanceM < CLEARANCE_CAUTION_M) return 'caution';
  return 'clear';
}

const SEVERITY: Readonly<Record<ClearanceLevel, number>> = Object.freeze({ clear: 0, caution: 1, danger: 2 });

/**
 * FR-05 records a threshold crossing exactly once. A level is only recorded
 * when it is more severe than every level already recorded this session, so
 * oscillating around a threshold cannot append duplicates.
 */
export function shouldRecordClearanceCrossing(highestRecorded: ClearanceLevel, current: ClearanceLevel): boolean {
  return SEVERITY[current] > SEVERITY[highestRecorded];
}

export function moreSevereClearance(left: ClearanceLevel, right: ClearanceLevel): ClearanceLevel {
  return SEVERITY[left] >= SEVERITY[right] ? left : right;
}
