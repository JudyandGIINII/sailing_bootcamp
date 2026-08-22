import { describe, expect, it } from 'vitest';
import { advanceLogicalTick, createSession, type DeterministicSession } from '../../src/sim/session.js';
import { l04ReplayBindings, l05ReplayBindings } from '../../src/content/l02-l05.js';
import { l01ReplayBindings } from '../../src/content/l01.js';
import { l06ReplayBindings } from '../../src/content/l06-polar.js';
import { projectScore } from '../../src/scoring/projection.js';

function l04Session(seed: string): DeterministicSession {
  return createSession({ ...l04ReplayBindings, seed, ordered_input_log: [] } as never);
}

describe('L04 total points', () => {
  it('reports a non-zero total with a 100 point denominator', () => {
    const session = l04Session('total-basic');
    const score = projectScore(session.raw, session.ledger);
    expect(score.status).toBe('declared_synthetic_unvalidated');
    expect(score.points_possible).toBe(100);
    expect(score.total_points).toBeGreaterThan(0);
    expect(Number.isInteger(score.total_points)).toBe(true);
  });

  it('excludes the unavailable observation component from the denominator', () => {
    const session = l04Session('total-denom');
    const score = projectScore(session.raw, session.ledger);
    const observation = score.components!.find((component) => component.key === 'observation')!;
    expect(observation.status).toBe('declared-unavailable');
    expect(score.points_possible).toBe(
      score.components!.reduce((sum, component) => sum + component.points_possible, 0),
    );
  });

  it('never exceeds the points it declares possible', () => {
    let session = l04Session('total-cap');
    for (let tick = 0; tick < 12; tick += 1) session = advanceLogicalTick(session);
    const score = projectScore(session.raw, session.ledger);
    expect(score.total_points).toBeLessThanOrEqual(score.points_possible!);
  });

  it('caps the total when a danger clearance was recorded, so other components cannot offset it', () => {
    const session = l04Session('total-danger');
    const dangerRaw = { ...session.raw, highest_clearance_alert: 'danger' as const };
    const score = projectScore(dangerRaw, session.ledger);
    expect(score.safety_cap?.level).toBe('danger');
    // 0.4 * 100 = 40, floored.
    expect(score.total_points).toBeLessThanOrEqual(40);
  });

  it('declares the contract version it scored under', () => {
    const session = l04Session('total-version');
    const score = projectScore(session.raw, session.ledger);
    expect(score.score_contract_version).toBe('score-contract-v0-draft');
  });

  it('leaves a non-L04 lesson at zero with no component fields at all', () => {
    const session = createSession({ ...l01ReplayBindings, seed: 'total-l01', ordered_input_log: [] } as never);
    const score = projectScore(session.raw, session.ledger);
    expect(score.total_points).toBe(0);
    expect(score.components).toBeUndefined();
    expect(score.points_possible).toBeUndefined();
  });
});

describe('L05 total points', () => {
  it('scores a recorded decision out of a 75 point denominator', () => {
    const session = createSession({ ...l05ReplayBindings, seed: 'l05-score', ordered_input_log: [] } as never);
    const score = projectScore(session.raw, session.ledger);
    expect(score.status).toBe('declared_synthetic_unvalidated');
    expect(score.points_possible).toBe(75);
    expect(Number.isInteger(score.total_points)).toBe(true);
  });

  it('declares observation and goal unavailable for L05', () => {
    const session = createSession({ ...l05ReplayBindings, seed: 'l05-unavail', ordered_input_log: [] } as never);
    const components = projectScore(session.raw, session.ledger).components!;
    expect(components.find((component) => component.key === 'goal')!.status).toBe('declared-unavailable');
    expect(components.find((component) => component.key === 'observation')!.status).toBe('declared-unavailable');
  });
});

describe('L06 total points', () => {
  it('scores helm activity out of a 75 point denominator', () => {
    const session = createSession({ ...l06ReplayBindings, seed: 'l06-score', ordered_input_log: [] } as never);
    const score = projectScore(session.raw, session.ledger);
    expect(score.status).toBe('declared_synthetic_unvalidated');
    expect(score.points_possible).toBe(75);
    expect(Number.isInteger(score.total_points)).toBe(true);
  });

  it('declares observation and goal unavailable for L06, which has no mark', () => {
    const session = createSession({ ...l06ReplayBindings, seed: 'l06-unavail', ordered_input_log: [] } as never);
    const components = projectScore(session.raw, session.ledger).components!;
    expect(components.find((component) => component.key === 'goal')!.status).toBe('declared-unavailable');
    expect(components.find((component) => component.key === 'observation')!.status).toBe('declared-unavailable');
  });
});
