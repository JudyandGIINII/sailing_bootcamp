import { describe, expect, it, vi } from 'vitest';
import {
  SYNTHETIC_STABILITY_TICKS,
  SYNTHETIC_TARGET_PROFILE_VERSION,
  SYNTHETIC_TICKS_PER_LOGICAL_SECOND,
  createP2State,
  matchesActiveTarget,
  profileFor,
  reduceP2State,
  type P2Action,
  type P2State,
} from '../../src/scenario1/p2/deterministic-mechanics.js';

const UINT32_MAX = 0xffffffff;

function reduce(state: P2State, action: P2Action): P2State {
  return reduceP2State(state, action);
}

function targetControls(state: P2State): P2State {
  const target = state.target;
  return [
    { type: 'set_heading_centidegrees', heading_centidegrees: target.headingCentidegrees },
    { type: 'set_engine_output', engine_output: 0 },
    { type: 'set_main_deployed', main_deployed: true },
    { type: 'set_jib_deployed', jib_deployed: true },
    { type: 'set_main_trim', main_trim: target.mainTrim },
    { type: 'set_jib_trim', jib_trim: target.jibTrim },
    { type: 'set_main_reef_level', main_reef_level: target.mainReefLevel },
    { type: 'set_jib_reef_level', jib_reef_level: target.jibReefLevel },
  ].reduce((current, action) => reduce(current, action as P2Action), state);
}

describe('Scenario 1 P2 deterministic mechanics', () => {
  it('uses the canonical names, cadence, and authoritative mix32 fixtures', () => {
    expect(SYNTHETIC_TICKS_PER_LOGICAL_SECOND).toBe(10);
    expect(SYNTHETIC_STABILITY_TICKS).toBe(100);
    expect(SYNTHETIC_TARGET_PROFILE_VERSION).toBe(1);
    expect(profileFor(0, 0)).toEqual({ profileVersion: 1, scenarioSeed: 0, ordinal: 0, headingCentidegrees: 13116, mainTrim: 4845, jibTrim: 7442, mainReefLevel: 0, jibReefLevel: 0 });
    expect(profileFor(0, 1)).toEqual({ profileVersion: 1, scenarioSeed: 0, ordinal: 1, headingCentidegrees: 10394, mainTrim: 2113, jibTrim: 7339, mainReefLevel: 2, jibReefLevel: 2 });
    expect(profileFor(42, 7)).toEqual({ profileVersion: 1, scenarioSeed: 42, ordinal: 7, headingCentidegrees: 26958, mainTrim: 8725, jibTrim: 2366, mainReefLevel: 1, jibReefLevel: 2 });
    expect(profileFor(UINT32_MAX, UINT32_MAX)).toEqual({ profileVersion: 1, scenarioSeed: UINT32_MAX, ordinal: UINT32_MAX, headingCentidegrees: 28814, mainTrim: 6104, jibTrim: 8957, mainReefLevel: 1, jibReefLevel: 2 });
  });

  it('rejects invalid public seeds and ordinals rather than silently coercing them', () => {
    for (const value of [-1, -0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, UINT32_MAX + 1]) {
      expect(() => createP2State(value)).toThrow(RangeError);
      expect(() => profileFor(value, 0)).toThrow(RangeError);
      expect(() => profileFor(0, value)).toThrow(RangeError);
    }
  });

  it('rejects malformed actions, invalid ranges, fractions, NaN, and extra keys by identity without partial mutation', () => {
    const state = createP2State(7);
    const invalid: unknown[] = [
      undefined, null, [], { type: 'unknown' }, { type: 'advance', extra: true }, { type: 'set_heading_centidegrees', heading_centidegrees: -1 },
      { type: 'set_heading_centidegrees', heading_centidegrees: 36000 }, { type: 'set_heading_centidegrees', heading_centidegrees: 1.5 },
      { type: 'set_engine_output', engine_output: Number.NaN }, { type: 'set_engine_output', engine_output: -10001 }, { type: 'set_engine_output', engine_output: 10001 },
      { type: 'set_main_deployed', main_deployed: 'true' }, { type: 'set_jib_trim', jib_trim: 10000.1 },
      { type: 'set_main_reef_level', main_reef_level: 3 }, { type: 'set_jib_reef_level', jib_reef_level: -1 },
      { type: 'set_autopilot_enabled', autopilot_enabled: false, extra: true }, { type: 'reset', [Symbol('extra')]: true },
    ];
    const before = structuredClone(state);
    for (const action of invalid) {
      expect(() => reduceP2State(state, action)).not.toThrow();
      expect(reduceP2State(state, action)).toBe(state);
      expect(state).toEqual(before);
    }
  });

  it('resets to the canonical, history-free seed state and preserves identity for no-op controls', () => {
    let state = reduce(createP2State(42), { type: 'set_engine_output', engine_output: 900 });
    state = reduce(state, { type: 'advance' });
    const reset = reduce(state, { type: 'reset' });
    expect(reset).toEqual(createP2State(42));
    expect(reset).not.toBe(state);
    expect(reduce(reset, { type: 'set_engine_output', engine_output: 0 })).toBe(reset);
    expect(reduce(reset, { type: 'pause' }).status).toBe('paused');
    const paused = reduce(reset, { type: 'pause' });
    expect(reduce(paused, { type: 'pause' })).toBe(paused);
    expect(reduce(reset, { type: 'resume' })).toBe(reset);
  });

  it('changes the target exactly on the 100th matching running advance', () => {
    let state = targetControls(createP2State(1));
    expect(matchesActiveTarget(state)).toBe(true);
    for (let tick = 1; tick < SYNTHETIC_STABILITY_TICKS; tick += 1) state = reduce(state, { type: 'advance' });
    expect(state.logicalTick).toBe(99);
    expect(state.targetOrdinal).toBe(0);
    expect(state.consecutiveMatchingTicks).toBe(99);
    state = reduce(state, { type: 'advance' });
    expect(state.logicalTick).toBe(100);
    expect(state.targetOrdinal).toBe(1);
    expect(state.target).toEqual(profileFor(1, 1));
    expect(state.consecutiveMatchingTicks).toBe(0);
  });

  it('wraps logical ticks and target ordinals with UInt32 semantics', () => {
    const seed = UINT32_MAX;
    let state: P2State = Object.freeze({
      ...createP2State(seed),
      logicalTick: UINT32_MAX,
      targetOrdinal: UINT32_MAX,
      target: profileFor(seed, UINT32_MAX),
    });
    state = targetControls(state);
    state = Object.freeze({ ...state, consecutiveMatchingTicks: SYNTHETIC_STABILITY_TICKS - 1 });
    state = reduce(state, { type: 'advance' });
    expect(state.logicalTick).toBe(0);
    expect(state.targetOrdinal).toBe(0);
    expect(state.target).toEqual(profileFor(seed, 0));
    expect(state.consecutiveMatchingTicks).toBe(0);
  });

  it('resets a matching streak on a mismatch and does not advance it while paused', () => {
    let state = targetControls(createP2State(3));
    for (let tick = 0; tick < 12; tick += 1) state = reduce(state, { type: 'advance' });
    state = reduce(state, { type: 'set_main_trim', main_trim: (state.target.mainTrim + 1) % 10001 });
    expect(state.consecutiveMatchingTicks).toBe(0);
    state = reduce(state, { type: 'advance' });
    expect(state.consecutiveMatchingTicks).toBe(0);
    state = reduce(state, { type: 'set_main_trim', main_trim: state.target.mainTrim });
    state = reduce(state, { type: 'advance' });
    expect(state.consecutiveMatchingTicks).toBe(1);
    const paused = reduce(state, { type: 'pause' });
    expect(reduce(paused, { type: 'advance' })).toBe(paused);
    expect(reduce(paused, { type: 'resume' }).status).toBe('running');
  });

  it('stores autopilot without making it part of target matching or the matching streak', () => {
    let state = targetControls(createP2State(8));
    state = reduce(state, { type: 'advance' });
    const withAutopilot = reduce(state, { type: 'set_autopilot_enabled', autopilot_enabled: true });
    expect(withAutopilot.controls.autopilotEnabled).toBe(true);
    expect(matchesActiveTarget(withAutopilot)).toBe(true);
    expect(withAutopilot.consecutiveMatchingTicks).toBe(1);
  });

  it('reproduces equivalent deterministic action traces', () => {
    const trace: readonly P2Action[] = [
      { type: 'set_heading_centidegrees', heading_centidegrees: profileFor(99, 0).headingCentidegrees },
      { type: 'set_main_trim', main_trim: profileFor(99, 0).mainTrim },
      { type: 'set_jib_trim', jib_trim: profileFor(99, 0).jibTrim },
      { type: 'set_main_reef_level', main_reef_level: profileFor(99, 0).mainReefLevel },
      { type: 'set_jib_reef_level', jib_reef_level: profileFor(99, 0).jibReefLevel },
      { type: 'set_autopilot_enabled', autopilot_enabled: true },
      { type: 'advance' }, { type: 'pause' }, { type: 'advance' }, { type: 'resume' }, { type: 'advance' },
    ];
    const replay = () => trace.reduce((state, action) => reduce(state, action), createP2State(99));
    expect(replay()).toEqual(replay());
    expect(JSON.stringify(replay())).toBe(JSON.stringify(replay()));
  });

  it('does not read Date or Math.random during state creation, profiles, or reduction', () => {
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
      let state = createP2State(123);
      state = targetControls(state);
      state = reduce(state, { type: 'advance' });
      expect(state.logicalTick).toBe(1);
      expect(profileFor(123, 1).profileVersion).toBe(SYNTHETIC_TARGET_PROFILE_VERSION);
    } finally {
      globalThis.Date = originalDate;
      random.mockRestore();
    }
  });
});
