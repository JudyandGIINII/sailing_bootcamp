import { describe, expect, it } from 'vitest';
import {
  CLEARANCE_CAUTION_M,
  CLEARANCE_DANGER_M,
  TIDE_AMPLITUDE_M,
  clearanceLevel,
  deriveSyntheticClearanceM,
  deriveSyntheticTideHeightM,
  moreSevereClearance,
  shouldRecordClearanceCrossing,
} from '../../src/sim/depth-clearance.js';
import { MAX_CURRENT_MPS, PEAK_FLOOD_EPOCH_MS, SEMIDIURNAL_PERIOD_MS, SLACK_WATER_EPOCH_MS, deriveSyntheticCurrent } from '../../src/sim/tidal-current.js';
import { polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';
import { advanceLogicalTick, createSession, type DeterministicSession } from '../../src/sim/session.js';
import { l06ReplayBindings } from '../../src/content/l06-polar.js';

const { seabed_depth_m, draft_m } = polarKinematicsEnvironmentV1;

/** Solves for the epoch whose tide puts the clearance just above a threshold. */
function epochJustAboveThreshold(thresholdM: number): number {
  const targetTide = thresholdM - (seabed_depth_m - draft_m);
  // Falling limb of the cycle, so the next ticks push the clearance downward.
  const phase = Math.PI - Math.asin(targetTide / TIDE_AMPLITUDE_M);
  return Math.round((phase / (2 * Math.PI)) * SEMIDIURNAL_PERIOD_MS);
}

function polarSessionAt(epochMs: number): DeterministicSession {
  return createSession({
    ...l06ReplayBindings,
    polar_kinematics_environment: { ...l06ReplayBindings.polar_kinematics_environment, current_epoch_ms: epochMs },
    seed: 'clearance-test',
    ordered_input_log: [],
  } as never);
}

describe('synthetic tide height and under-keel clearance', () => {
  it('swings the tide through the declared amplitude over one semidiurnal cycle', () => {
    expect(deriveSyntheticTideHeightM(0)).toBe(0);
    expect(deriveSyntheticTideHeightM(SEMIDIURNAL_PERIOD_MS / 4)).toBeCloseTo(TIDE_AMPLITUDE_M, 6);
    expect(deriveSyntheticTideHeightM(Math.round((SEMIDIURNAL_PERIOD_MS * 3) / 4)).valueOf()).toBeCloseTo(-TIDE_AMPLITUDE_M, 5);
    expect(deriveSyntheticTideHeightM(SEMIDIURNAL_PERIOD_MS)).toBeCloseTo(0, 6);
  });

  it('computes clearance as seabed depth plus tide minus draft', () => {
    expect(deriveSyntheticClearanceM(seabed_depth_m, 0, draft_m)).toBeCloseTo(seabed_depth_m - draft_m, 6);
    expect(deriveSyntheticClearanceM(seabed_depth_m, SEMIDIURNAL_PERIOD_MS / 4, draft_m))
      .toBeCloseTo(seabed_depth_m - draft_m + TIDE_AMPLITUDE_M, 6);
  });

  it('keeps both declared thresholds reachable with the shipped depth and draft', () => {
    const lowest = seabed_depth_m - draft_m - TIDE_AMPLITUDE_M;
    expect(lowest).toBeLessThan(CLEARANCE_DANGER_M);
    expect(lowest).toBeGreaterThan(0);
    expect(clearanceLevel(CLEARANCE_CAUTION_M - 0.01)).toBe('caution');
    expect(clearanceLevel(CLEARANCE_DANGER_M - 0.01)).toBe('danger');
    expect(clearanceLevel(CLEARANCE_CAUTION_M)).toBe('clear');
  });

  it('records each severity level once and never downgrades the highest recorded', () => {
    expect(shouldRecordClearanceCrossing('clear', 'caution')).toBe(true);
    expect(shouldRecordClearanceCrossing('caution', 'caution')).toBe(false);
    expect(shouldRecordClearanceCrossing('caution', 'clear')).toBe(false);
    expect(shouldRecordClearanceCrossing('caution', 'danger')).toBe(true);
    expect(shouldRecordClearanceCrossing('danger', 'caution')).toBe(false);
    expect(moreSevereClearance('caution', 'clear')).toBe('caution');
    expect(moreSevereClearance('caution', 'danger')).toBe('danger');
  });

  it('rejects malformed inputs', () => {
    expect(() => deriveSyntheticTideHeightM(-1)).toThrow(TypeError);
    expect(() => deriveSyntheticTideHeightM(1.5)).toThrow(TypeError);
    expect(() => deriveSyntheticClearanceM(-1, 0, draft_m)).toThrow(TypeError);
    expect(() => clearanceLevel(Number.NaN)).toThrow(TypeError);
  });

  it('warns a session that starts already below a threshold, on its first tick', () => {
    // Regression: the highest-recorded level was seeded from the tick-0 level,
    // which suppressed every event for a session that began in caution or danger.
    const belowCaution = epochJustAboveThreshold(CLEARANCE_CAUTION_M) + 60_000;
    let session = polarSessionAt(belowCaution);
    expect(clearanceLevel(session.raw.clearance_m as number)).not.toBe('clear');
    session = advanceLogicalTick(session);
    expect(session.ledger.filter((event) => event.type === 'ENVIRONMENT_EPISODE')).toHaveLength(1);
  });

  it('puts slack water at the tide peak and the strongest stream at mid-tide', () => {
    // The stream is the tide's rate of change, so the two share one phase.
    expect(deriveSyntheticCurrent(SLACK_WATER_EPOCH_MS).current_speed_mps).toBe(0);
    expect(deriveSyntheticTideHeightM(SLACK_WATER_EPOCH_MS)).toBeCloseTo(TIDE_AMPLITUDE_M, 6);
    expect(deriveSyntheticCurrent(PEAK_FLOOD_EPOCH_MS).current_speed_mps).toBeCloseTo(MAX_CURRENT_MPS, 6);
    expect(deriveSyntheticTideHeightM(PEAK_FLOOD_EPOCH_MS)).toBe(0);
  });

  it('records a caution crossing exactly once as the session tide falls (FR-05)', () => {
    let session = polarSessionAt(epochJustAboveThreshold(CLEARANCE_CAUTION_M));
    expect(session.raw.clearance_level).toBe('clear');

    for (let tick = 0; tick < 400; tick += 1) session = advanceLogicalTick(session);

    const crossings = session.ledger.filter((event) => event.type === 'ENVIRONMENT_EPISODE' && event.cause?.includes('caution'));
    expect(session.raw.clearance_level).toBe('caution');
    expect(crossings).toHaveLength(1);
    expect(crossings[0]).toEqual(expect.objectContaining({ synthetic: true }));

    // Many more ticks below the same threshold must not append a duplicate.
    for (let tick = 0; tick < 400; tick += 1) session = advanceLogicalTick(session);
    expect(session.ledger.filter((event) => event.type === 'ENVIRONMENT_EPISODE' && event.cause?.includes('caution'))).toHaveLength(1);
    expect(session.raw.highest_clearance_alert).not.toBe('clear');
  });
});
