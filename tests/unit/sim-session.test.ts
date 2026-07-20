import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { l01ReplayBindings } from '../../src/content/l01.js';
import { l02ReplayBindings } from '../../src/content/l02-l05.js';
import { CanonicalInputContractError, applyCanonicalInput, advanceLogicalTick, createSession, pauseForLifecycle, replayInputs, type CanonicalInput } from '../../src/sim/session.js';
import { projectDebrief, projectScore } from '../../src/scoring/projection.js';
import { composeGroundRelativeVelocity } from '../../src/sim/vector.js';

const syntheticSafetyFixture = vi.hoisted(() => ({
  scenarioVersion: 'synthetic-safety-test-only-v0',
  policy: Object.freeze({
    permitted_actions: Object.freeze(['helm_port'] as const),
    synthetic_safety_event: Object.freeze({ action: 'helm_port' as const, status: 'declared_synthetic' as const, validation_status: 'unvalidated' as const }),
  }),
}));

// Test-only module replacement proves session/replay consult the resolver themselves;
// production APIs cannot receive this policy as an argument.
vi.mock('../../src/content/lesson-manifest.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/content/lesson-manifest.js')>();
  return {
    ...actual,
    resolveLessonPolicy(identity: Parameters<typeof actual.resolveLessonPolicy>[0]) {
      return identity.scenario_version === syntheticSafetyFixture.scenarioVersion
        ? syntheticSafetyFixture.policy
        : actual.resolveLessonPolicy(identity);
    },
  };
});

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
    expect(session.ledger.filter((event) => event.type === 'ACTION_ACCEPTED').map((event) => event.action)).toEqual(['helm_port', 'helm_starboard']);
    expect(session.raw.helm_command).toBe('starboard');
  });

  it('keeps an accepted helm checkpoint causal while a same-tick pause prevents the transition', () => {
    const identity = { ...l01ReplayBindings, seed: 'helm-then-pause', ordered_input_log: [] };
    const afterHelm = applyCanonicalInput(createSession(identity), { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } });
    const paused = applyCanonicalInput(afterHelm, { logical_tick: 0, sequence: 2, input: { action: 'pause' } });
    const checkpoint = paused.ledger.find((event) => event.type === 'LESSON_CHECKPOINT');
    const action = paused.ledger.find((event) => event.type === 'ACTION_ACCEPTED');

    expect(advanceLogicalTick(paused)).toBe(paused);
    expect(checkpoint).toEqual(expect.objectContaining({
      cause: 'declared helm correction recorded',
      action_event_id: action!.id,
    }));
    expect(checkpoint).not.toHaveProperty('transition_event_id');
    expect(paused.ledger).not.toContainEqual(expect.objectContaining({ type: 'L01_SYNTHETIC_TRANSITION' }));
    expect(paused.raw).toEqual(createSession(identity).raw);
  });

  it('derives ordered same-tick L01 controls from immutable action/checkpoint evidence', () => {
    const identity = { ...l01ReplayBindings, seed: 'ordered-l01-controls', ordered_input_log: [] };
    const inputs: CanonicalInput[] = [
      { logical_tick: 0, sequence: 2, input: { action: 'helm_starboard' } },
      { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
    ];
    const replayed = replayInputs(identity, inputs, 1);
    const actionIds = replayed.ledger.filter((event) => event.type === 'ACTION_ACCEPTED').map((event) => event.id);
    const checkpointIds = replayed.ledger.filter((event) => event.type === 'LESSON_CHECKPOINT').map((event) => event.id);
    const transition = replayed.ledger.find((event) => event.type === 'L01_SYNTHETIC_TRANSITION');

    expect(transition).toEqual(expect.objectContaining({
      l01_transition: expect.objectContaining({
        accepted_helm_command: 'starboard',
        causal_controls: [
          { logical_tick: 0, sequence: 1, helm_command: 'port', action_event_id: actionIds[0], checkpoint_event_id: checkpointIds[0] },
          { logical_tick: 0, sequence: 2, helm_command: 'starboard', action_event_id: actionIds[1], checkpoint_event_id: checkpointIds[1] },
        ],
      }),
    }));
    expect(replayed.ledger.filter((event) => event.type === 'LESSON_CHECKPOINT').every((event) => event.action_event_id && !event.transition_event_id)).toBe(true);
    expect(replayed).toEqual(replayInputs(identity, [...inputs].reverse(), 1));
  });

  it('records the declared L01 helm-correction checkpoint immutably without inventing a course or safety result', () => {
    const identity = { ...l01ReplayBindings, seed: 'l01-declared-checkpoint', ordered_input_log: [] };
    const session = applyCanonicalInput(createSession(identity), { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } });

    const advanced = advanceLogicalTick(session);
    const transition = advanced.ledger.find((event) => event.type === 'L01_SYNTHETIC_TRANSITION');
    expect(session.ledger).toEqual([
      expect.objectContaining({ type: 'SESSION_STARTED' }),
      expect.objectContaining({ type: 'ACTION_ACCEPTED', action: 'helm_port' }),
      expect.objectContaining({ type: 'LESSON_CHECKPOINT', lesson_id: 'L01', cause: 'declared helm correction recorded', action_event_id: session.ledger[1]!.id }),
    ]);
    expect(Object.isFrozen(session.ledger)).toBe(true);
    expect(Object.isFrozen(session.ledger[2]!)).toBe(true);
    expect(advanced.raw).toMatchObject({ helm_command: 'port', heading: expect.any(Number), cog: expect.any(Number), true_wind: expect.any(Object), apparent_wind: expect.any(Object) });
    expect(transition).toEqual(expect.objectContaining({
      id: 'l01-transition:0', tick: 0, sequence: 1, type: 'L01_SYNTHETIC_TRANSITION',
      l01_transition: expect.objectContaining({ accepted_helm_command: 'port', causal_controls: [{ logical_tick: 0, sequence: 1, helm_command: 'port', action_event_id: session.ledger[1]!.id, checkpoint_event_id: session.ledger[2]!.id }], prior_state: expect.any(Object), next_state: expect.any(Object), observations: expect.any(Object) }),
    }));
    expect(transition).toBeDefined();
    expect(session.ledger).not.toContainEqual(expect.objectContaining({ type: 'SAFETY_BLOCKED' }));
    expect(projectScore(session.raw, session.ledger)).toEqual({ status: 'draft_causal_checkpoint_recorded', safety: 'clear', total_points: 0, causal_event_ids: [session.ledger[2]!.id] });
  });

  it('rejects a sequence collision and composes declared current-to velocity without renderer state', () => {
    const identity = { ...l01ReplayBindings, seed: 'collision', ordered_input_log: [] };
    const accepted = applyCanonicalInput(createSession(identity), { logical_tick: 0, sequence: 2, input: { action: 'helm_port' } });
    const before = { raw: accepted.raw, ledger: accepted.ledger, paused: accepted.paused, evidence: accepted.canonical_input_evidence };
    for (const sequence of [2, 1]) {
      expect(() => applyCanonicalInput(accepted, { logical_tick: 0, sequence, input: { action: 'helm_starboard' } })).toThrow(CanonicalInputContractError);
      expect({ raw: accepted.raw, ledger: accepted.ledger, paused: accepted.paused, evidence: accepted.canonical_input_evidence }).toEqual(before);
    }
    expect(() => replayInputs(identity, [
      { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
      { logical_tick: 0, sequence: 1, input: { action: 'helm_starboard' } },
    ], 1)).toThrow(CanonicalInputContractError);
    expect(composeGroundRelativeVelocity({ x: 2, y: -1 }, { x: 0, y: 0 })).toEqual({ x: 2, y: -1 });
    expect(composeGroundRelativeVelocity({ x: 2, y: -1 }, { x: -3, y: 4 })).toEqual({ x: -1, y: 3 });
  });

  it.each([
    ['pause', { action: 'pause' as const }],
    ['reset', { action: 'reset' as const }],
  ])('rejects duplicate and descending direct %s sequences without mutating accepted evidence', (_label, input) => {
    const identity = { ...l01ReplayBindings, seed: `special-sequence-${_label}`, ordered_input_log: [] };
    const accepted = applyCanonicalInput(createSession(identity), { logical_tick: 0, sequence: 2, input: { action: 'helm_port' } });
    const before = { raw: accepted.raw, ledger: accepted.ledger, paused: accepted.paused, evidence: accepted.canonical_input_evidence };

    for (const sequence of [2, 1]) {
      expect(() => applyCanonicalInput(accepted, { logical_tick: 0, sequence, input })).toThrow(CanonicalInputContractError);
      expect({ raw: accepted.raw, ledger: accepted.ledger, paused: accepted.paused, evidence: accepted.canonical_input_evidence }).toEqual(before);
    }
  });

  it('rejects duplicate and descending direct resume sequences without mutating the paused session', () => {
    const identity = { ...l01ReplayBindings, seed: 'special-sequence-resume', ordered_input_log: [] };
    const helm = applyCanonicalInput(createSession(identity), { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } });
    const paused = applyCanonicalInput(helm, { logical_tick: 0, sequence: 2, input: { action: 'pause' } });
    const before = { raw: paused.raw, ledger: paused.ledger, paused: paused.paused, evidence: paused.canonical_input_evidence };

    for (const sequence of [2, 1]) {
      expect(() => applyCanonicalInput(paused, { logical_tick: 0, sequence, input: { action: 'resume' } })).toThrow(CanonicalInputContractError);
      expect({ raw: paused.raw, ledger: paused.ledger, paused: paused.paused, evidence: paused.canonical_input_evidence }).toEqual(before);
    }
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

  it('has no public policy injection path and treats unknown registry bindings as immutable direct/replay denials', () => {
    const identity = { ...l01ReplayBindings, seed: 'forged-policy', ordered_input_log: [] };
    const forgedPolicy = Object.freeze({ permitted_actions: Object.freeze(['reef'] as const) });
    // @ts-expect-error createSession accepts only a replay identity, never a caller policy.
    createSession(identity, forgedPolicy);
    const sessionWithExtraJsArgument = (createSession as unknown as (replayIdentity: typeof identity, policy: typeof forgedPolicy) => ReturnType<typeof createSession>)(identity, forgedPolicy);
    expect(sessionWithExtraJsArgument).not.toHaveProperty('policy');
    expect(applyCanonicalInput(sessionWithExtraJsArgument, { logical_tick: 0, sequence: 1, input: { action: 'reef' } })).toBe(sessionWithExtraJsArgument);

    const forgedIdentity = { ...identity, model_version: 'forged-model-version' };
    const unknown = createSession(forgedIdentity);
    const denied = applyCanonicalInput(unknown, { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } });
    expect(denied).toBe(unknown);
    expect({ raw: denied.raw, ledger: denied.ledger, paused: denied.paused }).toEqual({ raw: unknown.raw, ledger: unknown.ledger, paused: unknown.paused });
    expect(() => replayInputs(forgedIdentity, [], 1)).toThrow(/REPLAY_ACTION_DISALLOWED/);
    expect(() => replayInputs(forgedIdentity, [{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }], 1)).toThrow(/REPLAY_ACTION_DISALLOWED/);
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

  it('preflights an L01 reset attempt boundary before producing partial replay output', () => {
    const identity = { ...l01ReplayBindings, seed: 'l01-reset-replay', ordered_input_log: [] };
    const inputs: CanonicalInput[] = [
      { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
      { logical_tick: 0, sequence: 2, input: { action: 'reset' } },
      { logical_tick: 0, sequence: 3, input: { action: 'helm_starboard' } },
    ];

    expect(() => replayInputs(identity, inputs, 1)).toThrow(CanonicalInputContractError);
    try {
      replayInputs(identity, inputs, 1);
    } catch (error) {
      expect((error as CanonicalInputContractError).reason_code).toBe('REPLAY_ACTION_DISALLOWED');
    }
  });

  it('projects synthetic unvalidated safety causality for direct and replay resolver fixtures', () => {
    const identity = { ...l01ReplayBindings, scenario_version: syntheticSafetyFixture.scenarioVersion, seed: 'synthetic-safety', ordered_input_log: [] };
    const direct = applyCanonicalInput(createSession(identity), { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } });
    const replay = replayInputs(identity, [{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }], 1);
    for (const session of [direct, replay]) {
      const safety = session.ledger.find((event) => event.type === 'SAFETY_BLOCKED');
      expect(safety).toEqual(expect.objectContaining({ synthetic: true, contract_status: 'UNVALIDATED_DOMAIN_MODEL', cause: 'manifest-declared synthetic event' }));
      expect(projectScore(session.raw, session.ledger)).toEqual({ status: 'blocked_by_safety_contract', safety: 'blocked', total_points: 0, causal_event_ids: [safety!.id] });
      expect(projectDebrief(session.raw, session.ledger)).toContainEqual({ id: `safety:${safety!.id}`, kind: 'safety_blocked', cause_event_id: safety!.id });
    }
    expect(createSession({ ...l01ReplayBindings, seed: 'no-safety', ordered_input_log: [] }).ledger).not.toContainEqual(expect.objectContaining({ type: 'SAFETY_BLOCKED' }));
  });
});

describe('L02 synthetic trim-input acknowledgment session', () => {
  it('records only accepted trim inputs, retains repeats, and emits the paired checkpoint once', () => {
    const identity = { ...l02ReplayBindings, seed: 'l02-repeats', ordered_input_log: [] };
    const inputs: CanonicalInput[] = [
      { logical_tick: 0, sequence: 1, input: { action: 'main_trim' } },
      { logical_tick: 0, sequence: 2, input: { action: 'main_trim' } },
      { logical_tick: 0, sequence: 3, input: { action: 'jib_trim' } },
      { logical_tick: 0, sequence: 4, input: { action: 'jib_trim' } },
    ];
    const session = replayInputs(identity, inputs, 1);
    expect(session.raw.l02_trim_acknowledgment).toEqual({ main_trim_adjusted: true, jib_trim_adjusted: true, last_accepted_trim: 'jib_trim', last_accepted_tick: 0, causal_state: 'both' });
    expect(session.ledger.filter((event) => event.type === 'ACTION_ACCEPTED').map((event) => event.action)).toEqual(['main_trim', 'main_trim', 'jib_trim', 'jib_trim']);
    expect(session.ledger.filter((event) => event.type === 'LESSON_CHECKPOINT' && event.lesson_id === 'L02')).toHaveLength(1);
    expect(session.ledger.some((event) => event.type === 'SAFETY_BLOCKED')).toBe(false);
  });

  it('keeps helm independently accepted without a trim acknowledgment effect', () => {
    const initial = createSession({ ...l02ReplayBindings, seed: 'l02-rejected', ordered_input_log: [] });
    const before = { raw: initial.raw, ledger: initial.ledger, evidence: initial.canonical_input_evidence };
    expect(applyCanonicalInput(initial, { logical_tick: 1, sequence: 1, input: { action: 'main_trim' } })).toBe(initial);
    expect({ raw: initial.raw, ledger: initial.ledger, evidence: initial.canonical_input_evidence }).toEqual(before);
    const helm = applyCanonicalInput(initial, { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } });
    expect(helm.raw).toMatchObject({ helm_command: 'port', l02_trim_acknowledgment: createSession({ ...l02ReplayBindings, seed: 'l02-rejected', ordered_input_log: [] }).raw.l02_trim_acknowledgment });
    expect(helm.ledger).toContainEqual(expect.objectContaining({ type: 'ACTION_ACCEPTED', action: 'helm_port' }));
    expect(helm.ledger).not.toContainEqual(expect.objectContaining({ type: 'LESSON_CHECKPOINT', lesson_id: 'L02' }));
  });

  it('preserves L02 control acknowledgment across pause/resume without pause progression', () => {
    const identity = { ...l02ReplayBindings, seed: 'l02-pause', ordered_input_log: [] };
    const main = applyCanonicalInput(createSession(identity), { logical_tick: 0, sequence: 1, input: { action: 'main_trim' } });
    const paused = applyCanonicalInput(main, { logical_tick: 0, sequence: 2, input: { action: 'pause' } });
    expect(advanceLogicalTick(paused)).toBe(paused);
    const resumed = applyCanonicalInput(paused, { logical_tick: 0, sequence: 3, input: { action: 'resume' } });
    expect(advanceLogicalTick(resumed).raw.logical_tick).toBe(1);
    expect(resumed.raw.l02_trim_acknowledgment).toEqual(main.raw.l02_trim_acknowledgment);
  });
});
