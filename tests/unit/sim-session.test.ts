import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { l01ReplayBindings } from '../../src/content/l01.js';
import { CanonicalInputContractError, applyCanonicalInput, advanceLogicalTick, createSession, pauseForLifecycle, replayInputs, type CanonicalInput } from '../../src/sim/session.js';
import { composeGroundRelativeVelocity } from '../../src/sim/vector.js';

const fixture = JSON.parse(readFileSync('tests/fixtures/l01-raw-golden.json', 'utf8')) as {
  identity: Parameters<typeof createSession>[0];
  inputs: CanonicalInput[];
  terminal_ticks: number;
  expected: { raw: unknown; ledger: unknown };
};

const disallowedReplayInputCases: readonly (readonly [CanonicalInput[]])[] = [
  [[{ logical_tick: 0, sequence: 1, input: { action: 'reef' } }]],
  [[{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }, { logical_tick: 1, sequence: 2, input: { action: 'reef' } }]],
  [[{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }, { logical_tick: 2, sequence: 2, input: { action: 'reef' } }]],
];

describe('deterministic raw L01 session', () => {
  it('matches the raw state/event golden fixture repeatedly', () => {
    const one = replayInputs(fixture.identity, fixture.inputs, fixture.terminal_ticks);
    const two = replayInputs(fixture.identity, fixture.inputs, fixture.terminal_ticks);
    expect({ raw: one.raw, ledger: one.ledger }).toEqual(fixture.expected);
    expect({ raw: two.raw, ledger: two.ledger }).toEqual(fixture.expected);
  });

  it('uses tick then sequence ordering, not input array ordering', () => {
    const identity = { ...l01ReplayBindings, seed: 'order', ordered_input_log: [] };
    const session = replayInputs(identity, [
      { logical_tick: 0, sequence: 2, input: { action: 'helm_starboard' } },
      { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
    ], 1);
    expect(session.ledger.map((event) => event.action)).toEqual([undefined, 'helm_port', 'helm_starboard']);
    expect(session.raw.helm_command).toBe('starboard');
  });

  it('rejects a sequence collision and composes declared current-to velocity without renderer state', () => {
    const identity = { ...l01ReplayBindings, seed: 'collision', ordered_input_log: [] };
    expect(() => replayInputs(identity, [
      { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
      { logical_tick: 0, sequence: 1, input: { action: 'helm_starboard' } },
    ], 1)).toThrow(CanonicalInputContractError);
    expect(composeGroundRelativeVelocity({ x: 2, y: -1 }, { x: 0, y: 0 })).toEqual({ x: 2, y: -1 });
    expect(composeGroundRelativeVelocity({ x: 2, y: -1 }, { x: -3, y: 4 })).toEqual({ x: -1, y: 3 });
  });

  it('does not progress raw state or ledger while paused, restores declared initial state on reset, and varies by seed/input', () => {
    const identity = { ...l01ReplayBindings, seed: 'one', ordered_input_log: [] };
    const initial = createSession(identity);
    const paused = applyCanonicalInput(initial, { logical_tick: 0, sequence: 1, input: { action: 'pause' } });
    expect(advanceLogicalTick(paused)).toBe(paused);
    expect({ raw: paused.raw, ledger: paused.ledger }).toEqual({ raw: initial.raw, ledger: initial.ledger });
    const reset = applyCanonicalInput(initial, { logical_tick: 0, sequence: 2, input: { action: 'reset' } });
    expect(reset.raw).toEqual(initial.raw);
    expect(replayInputs({ ...identity, seed: 'two' }, [], 1).raw.rng_state).not.toBe(replayInputs(identity, [], 1).raw.rng_state);
    expect(replayInputs(identity, [{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }], 1).raw.helm_command).toBe('port');
  });

  it('stops immediately on focus/visibility lifecycle input and needs an explicit resume without catch-up', () => {
    const identity = { ...l01ReplayBindings, seed: 'lifecycle', ordered_input_log: [] };
    const running = advanceLogicalTick(createSession(identity));
    const paused = pauseForLifecycle(running, 'focus_lost', 4);
    expect(advanceLogicalTick(paused)).toBe(paused);
    expect(paused.raw.logical_tick).toBe(1);
    const resumed = applyCanonicalInput(paused, { logical_tick: 1, sequence: 4, input: { action: 'resume' } });
    expect(resumed.raw.logical_tick).toBe(1);
    expect(advanceLogicalTick(resumed).raw.logical_tick).toBe(2);
  });

  it('has no duplicate boundary event and no renderer cadence input to alter canonical output', () => {
    const session = replayInputs({ ...l01ReplayBindings, seed: 'cadence', ordered_input_log: [] }, [], 3);
    expect(session.ledger.filter((event) => event.type === 'SESSION_STARTED')).toHaveLength(1);
    expect(replayInputs({ ...l01ReplayBindings, seed: 'cadence', ordered_input_log: [] }, [], 3)).toEqual(session);
  });

  it('rejects a direct canonical action outside the lesson policy without changing state, pause, RNG, ledger, or checkpoints', () => {
    const initial = createSession({ ...l01ReplayBindings, seed: 'denied', ordered_input_log: [] });
    const denied = applyCanonicalInput(initial, { logical_tick: 0, sequence: 1, input: { action: 'reef' } });
    expect(denied).toBe(initial);
    expect(denied.raw).toBe(initial.raw);
    expect(denied.ledger).toBe(initial.ledger);
    expect(denied.paused).toBe(false);
  });

  it.each(disallowedReplayInputCases)('preflights disallowed replay actions at start, middle, or end', (inputs) => {
    const identity = { ...l01ReplayBindings, seed: 'replay-policy', ordered_input_log: inputs };
    try {
      replayInputs(identity, inputs, 3);
      throw new Error('Expected replay to reject.');
    } catch (error) {
      expect(error).toBeInstanceOf(CanonicalInputContractError);
      expect((error as CanonicalInputContractError).reason_code).toBe('REPLAY_ACTION_DISALLOWED');
    }
  });
});
