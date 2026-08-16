import { describe, expect, it } from 'vitest';
import { advanceLogicalTick, applyCanonicalInput, createSession, type DeterministicSession } from '../../src/sim/session.js';
import {
  L04_MARK_ARRIVAL_CAUSE,
  L04_MARK_ARRIVAL_RADIUS_M,
  L04_TARGET_MARK,
  l02Manifest,
  l03Manifest,
  l04Manifest,
  l04ReplayBindings,
  l05Manifest,
} from '../../src/content/l02-l05.js';
import { POLAR_KINEMATICS_MODEL_VERSION } from '../../src/contracts/polar-kinematics-environment.js';
import { PEAK_FLOOD_EPOCH_MS, SEMIDIURNAL_PERIOD_MS, SLACK_WATER_EPOCH_MS } from '../../src/sim/tidal-current.js';
import { CLEARANCE_CAUTION_M, TIDE_AMPLITUDE_M } from '../../src/sim/depth-clearance.js';
import { polarKinematicsEnvironmentV1 } from '../../src/contracts/polar-kinematics-environment.js';

/** Peak flood: the stream is at its strongest, so drift is maximal. A few hundred
 * ticks span well under 1% of the cycle, so it stays near peak for the whole run. */
const CROSS_CURRENT_EPOCH_MS = PEAK_FLOOD_EPOCH_MS;
/** Slack water: the derived stream is ~0, so the boat holds its heading. */
const SLACK_CURRENT_EPOCH_MS = SLACK_WATER_EPOCH_MS;

function l04Session(currentEpochMs: number, seed = 'l04-current-correction'): DeterministicSession {
  return createSession({
    ...l04ReplayBindings,
    polar_kinematics_environment: { ...l04ReplayBindings.polar_kinematics_environment, current_epoch_ms: currentEpochMs },
    seed,
    ordered_input_log: [],
  } as never);
}

function advance(session: DeterministicSession, ticks: number): DeterministicSession {
  let next = session;
  for (let index = 0; index < ticks; index += 1) next = advanceLogicalTick(next);
  return next;
}

function distanceToMark(session: DeterministicSession): number {
  const position = session.raw.polar_kinematic_state!.position_m;
  return Math.hypot(position.x - L04_TARGET_MARK.x_m, position.y - L04_TARGET_MARK.y_m);
}

describe('L04 current-correction lesson', () => {
  it('declares the polar-and-current model with genuinely computed observations', () => {
    expect(l04Manifest.model_version).toBe(POLAR_KINEMATICS_MODEL_VERSION);
    for (const key of ['heading', 'cog', 'stw', 'sog', 'drift']) {
      expect(l04Manifest.required_observations.find((observation) => observation.key === key)?.status).toBe('declared_synthetic');
    }
  });

  it('separates SOG from STW and COG from heading under a declared cross-current', () => {
    const session = advance(l04Session(CROSS_CURRENT_EPOCH_MS), 1);
    expect(session.raw.sog).not.toBe(session.raw.stw);
    expect(session.raw.cog).not.toBe(session.raw.heading);
    expect(session.raw.drift_angle).not.toBe(0);
  });

  it('does not reach the mark when the cross-current drift is never corrected', () => {
    const session = advance(l04Session(CROSS_CURRENT_EPOCH_MS), 260);
    expect(session.raw.mark_state).toBe('declared-approach');
    expect(distanceToMark(session)).toBeGreaterThan(L04_MARK_ARRIVAL_RADIUS_M);
    expect(session.ledger.filter((event) => event.cause === L04_MARK_ARRIVAL_CAUSE)).toHaveLength(0);
  });

  it('records the declared mark arrival exactly once, even after sailing past it', () => {
    const arrived = advance(l04Session(SLACK_CURRENT_EPOCH_MS), 260);
    expect(arrived.raw.mark_state).toBe('mark_arrival_recorded');
    const arrivals = arrived.ledger.filter((event) => event.cause === L04_MARK_ARRIVAL_CAUSE);
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]).toEqual(expect.objectContaining({ type: 'LESSON_CHECKPOINT', lesson_id: 'L04', synthetic: true }));

    // Far past the mark: still exactly one arrival, and the state never reverts.
    const overshot = advance(arrived, 120);
    expect(overshot.raw.mark_state).toBe('mark_arrival_recorded');
    expect(overshot.ledger.filter((event) => event.cause === L04_MARK_ARRIVAL_CAUSE)).toHaveLength(1);
    expect(distanceToMark(overshot)).toBeGreaterThan(L04_MARK_ARRIVAL_RADIUS_M);
  });

  it('is deterministic across identical sessions', () => {
    const one = advance(l04Session(CROSS_CURRENT_EPOCH_MS), 40);
    const two = advance(l04Session(CROSS_CURRENT_EPOCH_MS), 40);
    expect(two.raw).toEqual(one.raw);
    expect(two.ledger).toEqual(one.ledger);
  });

  it('never mints a duplicate ledger event id across ticks that mix inputs and advance-time events', () => {
    // Regression: arrival and clearance events derived their ids from ledger
    // length, which collided with ids applyCanonicalInput mints on later ticks.
    // Start just above the caution threshold so a clearance crossing fires part
    // way through, on a tick that also carries a helm input.
    const targetTide = CLEARANCE_CAUTION_M - (polarKinematicsEnvironmentV1.seabed_depth_m - polarKinematicsEnvironmentV1.draft_m);
    const epoch = Math.round(((Math.PI - Math.asin(targetTide / TIDE_AMPLITUDE_M)) / (2 * Math.PI)) * SEMIDIURNAL_PERIOD_MS);
    let session = l04Session(epoch);
    for (let tick = 0; tick < 500; tick += 1) {
      session = applyCanonicalInput(session, { logical_tick: session.raw.logical_tick, sequence: 0, input: { action: 'helm_port' } });
      session = advanceLogicalTick(session);
    }
    const ids = session.ledger.map((event) => event.id);
    expect(session.ledger.some((event) => event.type === 'ENVIRONMENT_EPISODE')).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves L02, L03 and L05 on the legacy draft model', () => {
    for (const manifest of [l02Manifest, l03Manifest, l05Manifest]) {
      expect(manifest.model_version).toBe('training-sloop-model-v0-draft');
    }
  });
});
