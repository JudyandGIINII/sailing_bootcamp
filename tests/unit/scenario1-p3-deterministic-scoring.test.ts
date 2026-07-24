import { describe, expect, it, vi } from 'vitest';
import {
  P3_SCORE_WEIGHTS,
  compositeScore,
  courseQuality,
  createP3Attempt,
  evaluateP3Score,
  propulsionQuality,
  reduceP3Attempt,
  type P3CanonicalRecord,
  type P3ScoreInput,
  type P3TargetProfile,
} from '../../src/scenario1/p3/deterministic-scoring.js';

const profile = (overrides: Partial<P3TargetProfile> = {}): P3TargetProfile => ({
  profile_id: 'synthetic-profile-a',
  profile_version: 1,
  scoring_contract_version: 'scenario1-synthetic-score-calibration-v2',
  synthetic_target_heading_centidegrees: 0,
  propulsion_context: 'sailing_capable',
  ...overrides,
});

const baseInput = (overrides: Partial<P3ScoreInput> = {}): P3ScoreInput => ({
  records: [],
  profiles: [profile()],
  active_profile: {
    profile_id: 'synthetic-profile-a',
    profile_version: 1,
    scoring_contract_version: 'scenario1-synthetic-score-calibration-v2',
  },
  current_heading_centidegrees: 0,
  canonical_engine_output: 0,
  normalized_engine_magnitude: 0,
  main_deployed: true,
  jib_deployed: true,
  sail_wind_fit_q: 10000,
  ...overrides,
});

const record = (logicalTick: number, sequence: number, kind: P3CanonicalRecord['kind'], payload: unknown): P3CanonicalRecord => ({
  logical_tick: logicalTick,
  sequence,
  kind,
  payload,
});

describe('Scenario 1 P3 deterministic scoring', () => {
  it('uses every approved course fixture, including shortest-angle wraparound', () => {
    expect(courseQuality(0, 0)).toBe(10000);
    expect(courseQuality(200, 0)).toBe(10000);
    expect(courseQuality(201, 0)).toBe(9996);
    expect(courseQuality(1600, 0)).toBe(5000);
    expect(courseQuality(2999, 0)).toBe(3);
    expect(courseQuality(3000, 0)).toBe(0);
    expect(courseQuality(35900, 100)).toBe(10000);
    for (const invalid of [-1, -0, 36000, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(courseQuality(invalid, 0)).toBeUndefined();
  });

  it('uses every approved propulsion fixture and equal forward/reverse magnitudes', () => {
    const q = (context: 'marina' | 'low_speed' | 'sailing_capable', output: number, main: boolean, jib: boolean) => propulsionQuality(context, output, main, jib);
    expect(q('marina', 8500, false, false)).toEqual({ penalty: 0, quality: 10000 });
    expect(q('low_speed', 10000, false, false)).toEqual({ penalty: 0, quality: 10000 });
    expect(q('sailing_capable', 0, false, false)).toEqual({ penalty: 0, quality: 10000 });
    expect(q('sailing_capable', 500, false, false)).toEqual({ penalty: 0, quality: 10000 });
    expect(q('sailing_capable', 501, false, false)).toEqual({ penalty: 1, quality: 9998 });
    expect(q('sailing_capable', 6500, false, false)).toEqual({ penalty: 6000, quality: 0 });
    expect(q('sailing_capable', 6500, true, false)).toEqual({ penalty: 0, quality: 10000 });
    expect(q('sailing_capable', 6501, true, false)).toEqual({ penalty: 1, quality: 9999 });
    expect(q('sailing_capable', 10000, false, true)).toEqual({ penalty: 3500, quality: 5625 });
    expect(propulsionQuality('sailing_capable', 501, false, false)).toEqual(propulsionQuality('sailing_capable', Math.abs(-501), false, false));
  });

  it('uses immutable 50/30/20 integer composite arithmetic and clamps its range', () => {
    expect(P3_SCORE_WEIGHTS).toEqual({ sail_wind_fit: 5000, course_control: 3000, propulsion_context: 2000 });
    expect(Object.values(P3_SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(10000);
    expect(compositeScore(0, 0, 0)).toBe(0);
    expect(compositeScore(10000, 10000, 10000)).toBe(100);
    expect(compositeScore(5000, 5000, 5000)).toBe(50);
    expect(compositeScore(0, 0, 1)).toBe(0);
    expect(compositeScore(0, 0, 250)).toBe(1);
    expect(compositeScore(10001, 0, 0)).toBeUndefined();
    expect(Object.isFrozen(P3_SCORE_WEIGHTS)).toBe(true);
  });

  it('creates numeric scores only from explicit, registered contributors', () => {
    const result = evaluateP3Score(baseInput({
      current_heading_centidegrees: 201,
      canonical_engine_output: -6501,
      normalized_engine_magnitude: 6501,
      main_deployed: true,
      jib_deployed: false,
      sail_wind_fit_q: 5000,
    }));
    expect(result).toEqual({
      score_status: 'available',
      score: 75,
      contributors: {
        sail_wind_fit_q: 5000,
        course_q: 9996,
        propulsion_q: 9999,
        propulsion_penalty: 1,
        weights: P3_SCORE_WEIGHTS,
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.score_status === 'available') expect(Object.isFrozen(result.contributors)).toBe(true);
  });

  it('fails closed in documented validation priority order', () => {
    const badRecord = record(1, 0, 'end_voyage', { extra: true });
    expect(evaluateP3Score(baseInput({ records: [badRecord], canonical_engine_output: 10001 }))).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_replay_input' });
    expect(evaluateP3Score(baseInput({
      profiles: [],
      fixture_identity: { fixture_id: 'fixture-a', ...baseInput().active_profile },
      fixture_registry: [],
    }))).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_fixture_identity' });
    expect(evaluateP3Score(baseInput({ active_profile: { ...baseInput().active_profile, profile_version: 2 } }))).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_profile' });
    expect(evaluateP3Score(baseInput({ current_heading_centidegrees: 36000, canonical_engine_output: 10001 }))).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_heading' });
    expect(evaluateP3Score(baseInput({ canonical_engine_output: 10001, normalized_engine_magnitude: 10001, sail_wind_fit_q: 10001 }))).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_context' });
    expect(evaluateP3Score(baseInput({ sail_wind_fit_q: 10001 }))).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_contributor' });
  });

  it('validates fixture identity and target/context/contributor shapes without defaults', () => {
    const fixture = { fixture_id: 'fixture-a', ...baseInput().active_profile };
    expect(evaluateP3Score(baseInput({ fixture_identity: fixture, fixture_registry: [fixture] })).score_status).toBe('available');
    expect(evaluateP3Score(baseInput({ fixture_identity: fixture, fixture_registry: [fixture, fixture] }))).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_fixture_identity' });
    expect(evaluateP3Score(baseInput({ profiles: [profile({ synthetic_target_heading_centidegrees: 36000 })] }))).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_heading' });
    expect(evaluateP3Score(baseInput({ profiles: [profile({ propulsion_context: 'other' as never })] }))).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_context' });
    const { current_heading_centidegrees: _heading, ...withoutHeading } = baseInput();
    const { canonical_engine_output: _engine, ...withoutEngine } = baseInput();
    const { sail_wind_fit_q: _contributor, ...withoutContributor } = baseInput();
    expect(evaluateP3Score(withoutHeading)).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_heading' });
    expect(evaluateP3Score(withoutEngine)).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_context' });
    expect(evaluateP3Score(withoutContributor)).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_contributor' });
    expect(evaluateP3Score({ ...baseInput(), unexpected: true })).toEqual({ score_status: 'unavailable_invalid_input', reason: 'invalid_replay_input' });
  });

  it('accepts ascending record pairs and sequence gaps, and rejects duplicate, descending, and malformed pairs', () => {
    let attempt = createP3Attempt({ seed: 7, profiles: [profile()], active_profile: baseInput().active_profile, sail_wind_fit_q: 9000 });
    const first = reduceP3Attempt(attempt, record(4, 2, 'set_sail_wind_fit_q', { sail_wind_fit_q: 8000 }));
    expect(first.status).toBe('accepted');
    attempt = first.state;
    const second = reduceP3Attempt(attempt, record(4, 9, 'p2_action', { type: 'set_heading_centidegrees', heading_centidegrees: 0 }));
    expect(second.status).toBe('accepted');
    attempt = second.state;
    const duplicate = reduceP3Attempt(attempt, record(4, 9, 'end_voyage', {}));
    expect(duplicate.status).toBe('rejected_invalid_replay_input');
    expect(duplicate.state).toBe(attempt);
    expect(reduceP3Attempt(attempt, record(3, 99, 'end_voyage', {})).status).toBe('rejected_invalid_replay_input');
    expect(reduceP3Attempt(attempt, { logical_tick: 5.5, sequence: 0, kind: 'end_voyage', payload: {} }).status).toBe('rejected_invalid_replay_input');
  });

  it('processes lower same-tick actions before End Voyage and deeply freezes the terminal snapshot without a P2 tick', () => {
    const profiles = [profile(), profile({ profile_id: 'synthetic-profile-b', synthetic_target_heading_centidegrees: 300 })];
    let attempt = createP3Attempt({ seed: 5, profiles, active_profile: baseInput().active_profile, sail_wind_fit_q: 10000 });
    const actions: readonly P3CanonicalRecord[] = [
      record(8, 2, 'p2_action', { type: 'set_heading_centidegrees', heading_centidegrees: 300 }),
      record(8, 3, 'replace_profile', { profile_id: 'synthetic-profile-b', profile_version: 1, scoring_contract_version: 'scenario1-synthetic-score-calibration-v2' }),
      record(8, 7, 'set_sail_wind_fit_q', { sail_wind_fit_q: 5000 }),
      record(8, 9, 'end_voyage', {}),
    ];
    for (const action of actions) {
      const result = reduceP3Attempt(attempt, action);
      expect(result.status).toBe('accepted');
      attempt = result.state;
    }
    expect(attempt.p2_state.logicalTick).toBe(0);
    expect(attempt.terminal).toMatchObject({ terminal_logical_tick: 8, terminal_sequence: 9, profile: { profile_id: 'synthetic-profile-b' } });
    expect(attempt.terminal?.score).toMatchObject({ score_status: 'available', score: 75, contributors: { sail_wind_fit_q: 5000, course_q: 10000, propulsion_q: 10000 } });
    expect(Object.isFrozen(attempt.terminal)).toBe(true);
    expect(Object.isFrozen(attempt.terminal?.score)).toBe(true);
    expect(Object.isFrozen(attempt.terminal?.contributors)).toBe(true);
    expect(Object.isFrozen(attempt.terminal?.profile)).toBe(true);
    expect(Object.isFrozen(attempt.terminal?.debrief)).toBe(true);
    const frozen = attempt;
    expect(reduceP3Attempt(attempt, record(8, 10, 'end_voyage', {}))).toEqual({ status: 'rejected_post_terminal', state: frozen });
    expect(reduceP3Attempt(attempt, record(9, 0, 'set_sail_wind_fit_q', { sail_wind_fit_q: 0 }))).toEqual({ status: 'rejected_post_terminal', state: frozen });
    expect(attempt).toBe(frozen);
  });

  it('is deterministic and never reads Date or Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('random read'); });
    const originalDate = globalThis.Date;
    class TrapDate extends originalDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(...args);
        throw new Error('Date read');
      }
    }
    try {
      globalThis.Date = TrapDate as unknown as DateConstructor;
      const trace = () => {
        let attempt = createP3Attempt({ seed: 9, profiles: [profile()], active_profile: baseInput().active_profile, sail_wind_fit_q: 7000 });
        attempt = reduceP3Attempt(attempt, record(1, 2, 'end_voyage', {})).state;
        return attempt.terminal;
      };
      expect(trace()).toEqual(trace());
      expect(JSON.stringify(trace())).toBe(JSON.stringify(trace()));
    } finally {
      globalThis.Date = originalDate;
      random.mockRestore();
    }
  });
});
