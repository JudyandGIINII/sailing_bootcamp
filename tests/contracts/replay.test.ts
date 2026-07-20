import { describe, expect, it } from 'vitest';
import { prototypeVersionBindings } from '../../src/contracts/versions.js';
import { L01_REPLAY_IDENTITY_FIELDS, REPLAY_IDENTITY_FIELDS, isReplayIdentity, isReplayV2Shape, replayIdentitySchemaV1Draft, resolveExactReplayIdentity, resolveReplayV2, resolveStoredReplay, serializeReplayV2Attempt, type ReplayIdentity, type ReplayV2 } from '../../src/contracts/replay.js';
import { createSyntheticScenario, defaultScenarioConfiguration } from '../../src/content/scenario-catalog.js';
import { l01ReplayBindings } from '../../src/content/l01.js';
import { l02ReplayBindings } from '../../src/content/l02-l05.js';
import { l01SyntheticEnvironmentV1 } from '../../src/contracts/l01-synthetic-environment.js';
import { l02SyntheticTrimProfileV1 } from '../../src/contracts/l02-synthetic-trim.js';
import { materializeVariation } from '../../src/sim/scenario-variation.js';
import { sha256Canonical } from '../../src/contracts/scenario.js';
import { advanceLogicalTick, applyCanonicalInput, createSession, pauseForLifecycle, replayInputs, type CanonicalInput } from '../../src/sim/session.js';
import { projectDebrief, projectScore } from '../../src/scoring/projection.js';

const replay: ReplayIdentity = {
  scenario_version: prototypeVersionBindings.scenario_version,
  seed: 'seed-001',
  ordered_input_log: [{ logical_tick: 0, sequence: 0, input: { kind: 'begin' } }],
  model_version: prototypeVersionBindings.model_version,
  boat_profile_version: prototypeVersionBindings.boat_profile_version,
  contract_version: prototypeVersionBindings.contract_version,
  coordinate_contract_version: prototypeVersionBindings.coordinate_contract_version,
  determinism_contract_version: prototypeVersionBindings.determinism_contract_version,
  comparison_policy_version: prototypeVersionBindings.comparison_policy_version,
};

const disallowedActionReplayCases: readonly (readonly [ReplayIdentity['ordered_input_log']])[] = [
  [[{ logical_tick: 0, sequence: 1, input: { action: 'reef' } }]],
  [[{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }, { logical_tick: 1, sequence: 2, input: { action: 'reef' } }]],
  [[{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }, { logical_tick: 2, sequence: 2, input: { action: 'reef' } }]],
];

describe('replay identity contract', () => {
  it('requires the complete frozen L01 synthetic profile, including its initial state, without legacy defaulting', () => {
    const identity = { ...l01ReplayBindings, seed: 'l01-profile', ordered_input_log: [] };
    expect(isReplayIdentity(identity)).toBe(true);
    expect(resolveExactReplayIdentity(identity, identity)).toEqual({ outcome: 'accepted', replay: identity });
    const { l01_synthetic_environment: omitted, ...legacy } = identity;
    expect(omitted).toEqual(l01SyntheticEnvironmentV1);
    expect(resolveExactReplayIdentity(legacy, identity)).toEqual({ outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_MISSING', stored_payload: legacy });
    const altered = { ...identity, l01_synthetic_environment: { ...l01SyntheticEnvironmentV1, initial_position_m: { x: 999, y: -8 } } };
    expect(resolveExactReplayIdentity(altered, identity)).toEqual({ outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_INCOMPATIBLE', stored_payload: altered });
  });
  it('preserves the legacy L02 binding and V1 helm action resolution', () => {
    const legacyL02 = {
      ...l02ReplayBindings,
      seed: 'legacy-l02-helm',
      ordered_input_log: [
        { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
        { logical_tick: 0, sequence: 2, input: { action: 'helm_starboard' } },
      ],
    };
    expect(legacyL02.model_version).toBe('training-sloop-model-v0-draft');
    expect(resolveStoredReplay(legacyL02, l02ReplayBindings)).toEqual({ outcome: 'accepted', replay: legacyL02 });
    expect(replayInputs(legacyL02, legacyL02.ordered_input_log as readonly CanonicalInput[], 1).raw).toMatchObject({
      helm_command: 'starboard',
      l02_trim_acknowledgment: { causal_state: 'none', last_accepted_trim: null },
    });
  });
  it('requires exactly the canonical identity fields', () => {
    expect(isReplayIdentity(replay)).toBe(true);
    expect(isReplayIdentity({ ...replay, extra: 'not permitted' })).toBe(false);
    const { comparison_policy_version: omitted, ...withoutComparisonPolicy } = replay;
    expect(omitted).toBeTruthy();
    expect(isReplayIdentity(withoutComparisonPolicy)).toBe(false);
  });

  it('keeps the exported discriminated schema aligned with the strict identity guard', () => {
    const l01Identity = { ...l01ReplayBindings, seed: 'schema-l01', ordered_input_log: [] };
    expect(replayIdentitySchemaV1Draft.variants.l01.required_fields).toEqual(L01_REPLAY_IDENTITY_FIELDS);
    expect(replayIdentitySchemaV1Draft.variants.l01.additional_fields).toBe('forbidden');
    expect(replayIdentitySchemaV1Draft.variants.non_l01.required_fields).toEqual(REPLAY_IDENTITY_FIELDS);
    expect(replayIdentitySchemaV1Draft.variants.non_l01.additional_fields).toBe('forbidden');
    expect(isReplayIdentity(l01Identity)).toBe(true);
    expect(resolveStoredReplay(l01Identity, l01ReplayBindings)).toEqual({ outcome: 'accepted', replay: l01Identity });
    expect(resolveExactReplayIdentity(l01Identity, l01Identity)).toEqual({ outcome: 'accepted', replay: l01Identity });
    const { l01_synthetic_environment: omitted, ...missingL01Extension } = l01Identity;
    expect(omitted).toBeDefined();
    expect(isReplayIdentity(missingL01Extension)).toBe(false);
    expect(isReplayIdentity({ ...l01Identity, unexpected_extension: true })).toBe(false);
    expect(isReplayIdentity({ ...replay, l01_synthetic_environment: l01SyntheticEnvironmentV1 })).toBe(false);
  });

  it('requires the input log to be ordered by logical tick and sequence', () => {
    expect(
      isReplayIdentity({
        ...replay,
        ordered_input_log: [
          { logical_tick: 1, sequence: 0, input: { kind: 'later' } },
          { logical_tick: 0, sequence: 1, input: { kind: 'earlier' } },
        ],
      }),
    ).toBe(false);
  });

  it.each(REPLAY_IDENTITY_FIELDS)('rejects a missing %s identity field fail-closed without changing the payload', (field) => {
    const { [field]: omitted, ...missing } = replay;
    expect(omitted).toBeDefined();
    expect(resolveStoredReplay(missing, prototypeVersionBindings)).toEqual({ outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_MISSING', stored_payload: missing });
  });

  it.each(REPLAY_IDENTITY_FIELDS)('rejects an incompatible %s identity field', (field) => {
    const incompatible = field === 'ordered_input_log'
      ? { ...replay, ordered_input_log: [{ logical_tick: 0, sequence: 1, input: { kind: 'different' } }] }
      : { ...replay, [field]: 'other-version' };
    expect(resolveExactReplayIdentity(incompatible, replay)).toEqual({ outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_INCOMPATIBLE', stored_payload: incompatible });
  });

  it('rejects an unknown replay with the same stable, non-sensitive reason code', () => {
    const unknown = { legacy: true };
    const result = resolveStoredReplay(unknown, prototypeVersionBindings);
    expect(result).toEqual({ outcome: 'rejected', reason_code: 'REPLAY_IDENTITY_MISSING', stored_payload: unknown });
  });

  it('rejects corrupt but complete raw payloads with a stable code', () => {
    const corrupt = { ...replay, ordered_input_log: 'not-an-array' };
    expect(resolveStoredReplay(corrupt, prototypeVersionBindings)).toEqual({ outcome: 'rejected', reason_code: 'REPLAY_PAYLOAD_CORRUPT', stored_payload: corrupt });
  });

  it.each(disallowedActionReplayCases)('rejects an entire replay with a disallowed action without changing its stored payload', (ordered_input_log) => {
    const storedPayload = { ...replay, ordered_input_log };
    expect(resolveStoredReplay(storedPayload, prototypeVersionBindings)).toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_ACTION_DISALLOWED',
      stored_payload: storedPayload,
    });
  });

  it('rejects a full-identity replay containing a policy-disallowed or non-canonical action input without changing its stored payload', () => {
    const storedPayload = { ...replay, ordered_input_log: [{ logical_tick: 0, sequence: 1, input: { action: 'reef', extra: true } }] };
    expect(resolveExactReplayIdentity(storedPayload, storedPayload)).toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_ACTION_DISALLOWED',
      stored_payload: storedPayload,
    });
  });

  it('rejects an L01 reset attempt boundary while preserving the legacy stored payload', () => {
    const storedPayload = {
      ...l01ReplayBindings,
      seed: 'legacy-l01-reset',
      ordered_input_log: [
        { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
        { logical_tick: 0, sequence: 2, input: { action: 'reset' } },
        { logical_tick: 0, sequence: 3, input: { action: 'helm_starboard' } },
      ],
    };
    expect(resolveStoredReplay(storedPayload, l01ReplayBindings)).toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_ACTION_DISALLOWED',
      stored_payload: storedPayload,
    });
    expect(resolveExactReplayIdentity(storedPayload, storedPayload)).toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_ACTION_DISALLOWED',
      stored_payload: storedPayload,
    });
  });

  it('preserves exact-identity mismatch precedence over a disallowed action', () => {
    const storedPayload = { ...replay, model_version: 'different-model', ordered_input_log: [{ logical_tick: 0, sequence: 1, input: { action: 'reef' } }] };
    expect(resolveExactReplayIdentity(storedPayload, replay)).toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_IDENTITY_INCOMPATIBLE',
      stored_payload: storedPayload,
    });
  });
});

describe('Replay V2', () => {
  async function createL01V2Payload(
    seed: string,
    ordered_input_log: readonly CanonicalInput[],
    l01_terminal_logical_tick: number,
    l01_terminal_paused = false,
  ): Promise<ReplayV2> {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    return {
      schema_version: 'replay-v2',
      lesson_binding: { lesson_id: 'L01', ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, seed),
      seed,
      ordered_input_log,
      l01_synthetic_environment,
      l01_terminal_logical_tick,
      l01_terminal_paused,
    };
  }

  async function createL02V2Payload(
    seed: string,
    ordered_input_log: readonly CanonicalInput[],
    l02_terminal_logical_tick: number,
    l02_terminal_paused = false,
  ): Promise<ReplayV2> {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, ...lessonBindingValues } = l02ReplayBindings;
    void ignoredScenarioVersion;
    return {
      schema_version: 'replay-v2',
      lesson_binding: { lesson_id: 'L02', ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, seed),
      seed,
      ordered_input_log,
      l02_synthetic_trim_profile: l02SyntheticTrimProfileV1,
      l02_terminal_logical_tick,
      l02_terminal_paused,
    };
  }

  it('strictly persists and directly replays full L02 profile/log/terminal authority', async () => {
    const payload = await createL02V2Payload('v2-l02-exact', [
      { logical_tick: 0, sequence: 1, input: { action: 'main_trim' } },
      { logical_tick: 1, sequence: 2, input: { action: 'jib_trim' } },
    ], 2);
    expect(payload.lesson_binding.model_version).toBe(l02ReplayBindings.model_version);
    expect(payload.lesson_binding.model_version).not.toBe(l02SyntheticTrimProfileV1.profile_id);
    const serialized = serializeReplayV2Attempt(payload, payload.ordered_input_log, 2, false);
    const resolution = await resolveReplayV2(serialized);
    expect(resolution.outcome).toBe('accepted');
    if (resolution.outcome !== 'accepted') return;
    const restored = replayInputs(resolution.replay, resolution.replay.ordered_input_log as readonly CanonicalInput[], 2);
    const direct = replayInputs(serialized, serialized.ordered_input_log as readonly CanonicalInput[], 2);
    expect({ raw: restored.raw, ledger: restored.ledger, paused: restored.paused, debrief: projectDebrief(restored.raw, restored.ledger) }).toEqual({ raw: direct.raw, ledger: direct.ledger, paused: direct.paused, debrief: projectDebrief(direct.raw, direct.ledger) });
    expect(restored.raw.l02_trim_acknowledgment?.causal_state).toBe('both');
    expect(() => replayInputs(serialized, [], 2)).toThrow(/canonical identity log/);
    expect(() => replayInputs(serialized, serialized.ordered_input_log as readonly CanonicalInput[], 1)).toThrow(/contradicts its identity/);
  });

  it('fails closed for missing, mismatched, terminal-after-input, and unreachable strict L02 authority', async () => {
    const payload = await createL02V2Payload('v2-l02-invalid', [{ logical_tick: 0, sequence: 1, input: { action: 'pause' } }], 1);
    const { l02_synthetic_trim_profile: omitted, ...missingProfile } = payload;
    void omitted;
    for (const invalid of [
      missingProfile,
      { ...payload, l02_synthetic_trim_profile: { ...l02SyntheticTrimProfileV1, profile_id: 'unknown' } },
      { ...payload, l02_terminal_logical_tick: 0 },
      { ...payload, l02_terminal_paused: false },
    ]) {
      await expect(resolveReplayV2(invalid)).resolves.toEqual({ outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: invalid });
    }
    const mutatedBinding = { ...payload, lesson_binding: { ...payload.lesson_binding, model_version: l02SyntheticTrimProfileV1.profile_id } };
    await expect(resolveReplayV2(mutatedBinding)).resolves.toEqual({ outcome: 'rejected', reason_code: 'REPLAY_ACTION_DISALLOWED', stored_payload: mutatedBinding });
    expect(() => replayInputs(payload, payload.ordered_input_log as readonly CanonicalInput[], 1)).toThrow(/terminal authority is invalid/);
  });

  it('round-trips input-free, terminal-control, and terminal-paused strict L02 attempts', async () => {
    const inputFree = await createL02V2Payload('v2-l02-input-free', [], 3);
    const terminalControl = await createL02V2Payload('v2-l02-terminal-control', [{ logical_tick: 0, sequence: 1, input: { action: 'main_trim' } }], 0);
    const pausedTerminal = await createL02V2Payload('v2-l02-paused-terminal', [{ logical_tick: 0, sequence: 1, input: { action: 'pause' } }], 0, true);
    for (const payload of [inputFree, terminalControl, pausedTerminal]) {
      const resolution = await resolveReplayV2(payload);
      expect(resolution.outcome).toBe('accepted');
      if (resolution.outcome === 'accepted') {
        const restored = replayInputs(resolution.replay, resolution.replay.ordered_input_log as readonly CanonicalInput[], resolution.replay.l02_terminal_logical_tick!);
        expect(restored.raw.logical_tick).toBe(payload.l02_terminal_logical_tick);
        expect(restored.paused).toBe(payload.l02_terminal_paused);
      }
    }
  });

  it('keeps L01 terminal state fields forbidden for non-L01 V2 shapes', async () => {
    const l01 = await createL01V2Payload('v2-non-l01-shape', [], 0);
    const {
      l01_synthetic_environment: _environment,
      l01_terminal_logical_tick: _terminalTick,
      l01_terminal_paused: _terminalPaused,
      ...nonL01
    } = l01;
    void _environment;
    void _terminalTick;
    void _terminalPaused;
    const nonL01Shape = { ...nonL01, lesson_binding: { ...nonL01.lesson_binding, lesson_id: 'L02' as const, model_version: l02ReplayBindings.model_version }, l02_synthetic_trim_profile: l02SyntheticTrimProfileV1, l02_terminal_logical_tick: 0, l02_terminal_paused: false };
    expect(isReplayV2Shape(nonL01Shape)).toBe(true);
    expect(isReplayV2Shape({ ...nonL01Shape, l01_terminal_paused: false })).toBe(false);
  });

  it('rejects and preserves an L01 V2 terminal boundary made unreachable by pause at tick zero', async () => {
    const storedPayload = await createL01V2Payload('v2-unreachable-pause', [
      { logical_tick: 0, sequence: 1, input: { action: 'pause' } },
    ], 1);

    expect(isReplayV2Shape(storedPayload)).toBe(true);
    const resolution = await resolveReplayV2(storedPayload);
    expect(resolution).toEqual({ outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: storedPayload });
    if (resolution.outcome === 'rejected') expect(resolution.stored_payload).toBe(storedPayload);
  });

  it('accepts a same-tick, later-sequence L01 V2 resume and reaches its terminal boundary', async () => {
    const storedPayload = await createL01V2Payload('v2-same-tick-resume', [
      { logical_tick: 0, sequence: 1, input: { action: 'pause' } },
      { logical_tick: 0, sequence: 2, input: { action: 'resume' } },
    ], 1);

    const resolution = await resolveReplayV2(storedPayload);
    expect(resolution.outcome).toBe('accepted');
    if (resolution.outcome !== 'accepted') return;
    const restored = replayInputs(resolution.replay, resolution.replay.ordered_input_log as readonly CanonicalInput[], resolution.replay.l01_terminal_logical_tick!);
    expect(restored.raw.logical_tick).toBe(1);
    expect(restored.paused).toBe(false);
  });

  it('accepts an L01 V2 pause at its terminal tick and restores the paused terminal state', async () => {
    const storedPayload = await createL01V2Payload('v2-paused-terminal', [
      { logical_tick: 0, sequence: 1, input: { action: 'pause' } },
    ], 0, true);

    const resolution = await resolveReplayV2(storedPayload);
    expect(resolution.outcome).toBe('accepted');
    if (resolution.outcome !== 'accepted') return;
    const restored = replayInputs(resolution.replay, resolution.replay.ordered_input_log as readonly CanonicalInput[], resolution.replay.l01_terminal_logical_tick!);
    expect(restored.raw.logical_tick).toBe(0);
    expect(restored.paused).toBe(true);
    expect(advanceLogicalTick(restored)).toBe(restored);
  });

  it('fails closed when direct L01 V2 replay cannot reach its declared terminal boundary', async () => {
    const payload = await createL01V2Payload('v2-direct-unreachable-pause', [
      { logical_tick: 0, sequence: 1, input: { action: 'pause' } },
    ], 1);

    expect(() => replayInputs(payload, payload.ordered_input_log as readonly CanonicalInput[], payload.l01_terminal_logical_tick!)).toThrow(/terminal authority is invalid/);
  });

  it('treats the persisted L01 V2 terminal boundary as authoritative for direct replay', async () => {
    const payload = await createL01V2Payload('v2-direct-terminal-authority', [
      { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
    ], 1);

    expect(() => replayInputs(payload, payload.ordered_input_log as readonly CanonicalInput[], 0)).toThrow(/contradicts its identity/);
  });

  it('fails direct L01 V2 replay before execution for malformed terminal pause authority or a substitute input log', async () => {
    const payload = await createL01V2Payload('v2-direct-log-authority', [
      { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
    ], 1);
    const { l01_terminal_paused: _paused, ...missingPaused } = payload;
    void _paused;

    expect(() => replayInputs(missingPaused as ReplayV2, payload.ordered_input_log as readonly CanonicalInput[], 1)).toThrow(/terminal authority is invalid/);
    expect(() => replayInputs({ ...payload, l01_terminal_paused: 'false' } as unknown as ReplayV2, payload.ordered_input_log as readonly CanonicalInput[], 1)).toThrow(/terminal authority is invalid/);
    expect(() => replayInputs(payload, [], 1)).toThrow(/canonical identity log/);
  });

  it('does not let direct L01 V2 replay clear a canonical terminal pause', async () => {
    const payload = await createL01V2Payload('v2-direct-paused-authority', [
      { logical_tick: 0, sequence: 1, input: { action: 'pause' } },
    ], 0, true);

    const restored = replayInputs(payload, payload.ordered_input_log as readonly CanonicalInput[], 0);
    expect(restored.paused).toBe(true);
    expect(advanceLogicalTick(restored)).toBe(restored);
    expect(() => replayInputs({ ...payload, l01_terminal_paused: false }, payload.ordered_input_log as readonly CanonicalInput[], 0)).toThrow(/terminal authority is invalid/);
  });

  it('round-trips a strict V2 replay with lesson authority independent of scenario', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lesson_bindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const lesson_binding = { lesson_id: 'L01' as const, ...lesson_bindingValues };
    const payload = { schema_version: 'replay-v2' as const, lesson_binding, scenario_snapshot: scenario, variation_trace: await materializeVariation(scenario, 'v2-seed'), seed: 'v2-seed', ordered_input_log: [{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }], l01_synthetic_environment, l01_terminal_logical_tick: 1, l01_terminal_paused: false };
    await expect(resolveReplayV2(payload)).resolves.toMatchObject({ outcome: 'accepted' });
    await expect(resolveReplayV2({ ...payload, scenario_version: 'legacy' })).resolves.toMatchObject({ outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID' });
    await expect(resolveReplayV2({ ...payload, variation_trace: { ...payload.variation_trace, seed: 'tampered' } })).resolves.toMatchObject({ outcome: 'rejected', reason_code: 'REPLAY_V2_VARIATION_INVALID' });
  });

  it('rejects an L01 V2 reset attempt boundary while preserving the stored payload', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = {
      schema_version: 'replay-v2' as const,
      lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, 'v2-l01-reset'),
      seed: 'v2-l01-reset',
      ordered_input_log: [
        { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } },
        { logical_tick: 0, sequence: 2, input: { action: 'reset' } },
        { logical_tick: 0, sequence: 3, input: { action: 'helm_starboard' } },
      ],
      l01_synthetic_environment,
      l01_terminal_logical_tick: 1,
      l01_terminal_paused: false,
    };
    await expect(resolveReplayV2(storedPayload)).resolves.toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_ACTION_DISALLOWED',
      stored_payload: storedPayload,
    });
    expect(() => replayInputs(
      storedPayload,
      storedPayload.ordered_input_log as Parameters<typeof replayInputs>[1],
      storedPayload.l01_terminal_logical_tick,
    )).toThrow(/REPLAY_ACTION_DISALLOWED/);
  });

  it('rejects an empty-log V2 replay with a tampered lesson binding and preserves the payload', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = {
      schema_version: 'replay-v2' as const,
      lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues, model_version: 'tampered-model-version' },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, 'v2-empty-log-tampered-binding-seed'),
      seed: 'v2-empty-log-tampered-binding-seed',
      ordered_input_log: [],
      l01_synthetic_environment,
      l01_terminal_logical_tick: 0,
      l01_terminal_paused: false,
    };

    await expect(resolveReplayV2(storedPayload)).resolves.toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_ACTION_DISALLOWED',
      stored_payload: storedPayload,
    });
  });

  it('rejects a V2 ordered-input entry with an unknown key without legacy fallback and preserves it', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = {
      schema_version: 'replay-v2' as const,
      lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, 'v2-extra-entry-key-seed'),
      seed: 'v2-extra-entry-key-seed',
      ordered_input_log: [{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' }, unexpected: 'entry-extension' }],
      l01_synthetic_environment,
      l01_terminal_logical_tick: 1,
      l01_terminal_paused: false,
    };

    expect(isReplayV2Shape(storedPayload)).toBe(false);
    await expect(resolveReplayV2(storedPayload)).resolves.toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_V2_SCHEMA_INVALID',
      stored_payload: storedPayload,
    });
  });

  it('rejects a correctly hashed historical scenario without falling back to V1 and preserves the payload', async () => {
    const syntheticScenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { content_sha256: ignoredHash, ...historicalWithoutHash } = syntheticScenario;
    void ignoredHash;
    const historicalScenario = {
      ...historicalWithoutHash,
      source_kind: 'historical' as const,
      provenance: { kind: 'historical' as const, provider: 'synthetic-test-provider', record_id: 'synthetic-test-record', observed_at: '2026-07-20T00:00:00Z' },
    };
    const rehashedHistoricalScenario = { ...historicalScenario, content_sha256: await sha256Canonical(historicalScenario) };
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = {
      schema_version: 'replay-v2' as const,
      lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues },
      scenario_snapshot: rehashedHistoricalScenario,
      variation_trace: await materializeVariation(rehashedHistoricalScenario, 'historical-v2-seed'),
      seed: 'historical-v2-seed',
      ordered_input_log: [{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }],
      l01_synthetic_environment,
      l01_terminal_logical_tick: 1,
      l01_terminal_paused: false,
    };

    await expect(resolveReplayV2(storedPayload)).resolves.toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_V2_SCENARIO_INVALID',
      stored_payload: storedPayload,
    });
  });

  it('rejects a pre-P1B incomplete V2 snapshot without V1 fallback and preserves it', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { water_level_tide_phase: omittedP1b, ...incompleteRaw } = scenario.raw;
    void omittedP1b;
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = { schema_version: 'replay-v2' as const, lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues }, scenario_snapshot: { ...scenario, raw: incompleteRaw }, variation_trace: await materializeVariation(scenario, 'incomplete-v2-seed'), seed: 'incomplete-v2-seed', ordered_input_log: [], l01_synthetic_environment, l01_terminal_logical_tick: 0, l01_terminal_paused: false };
    await expect(resolveReplayV2(storedPayload)).resolves.toEqual({ outcome: 'rejected', reason_code: 'REPLAY_V2_SCENARIO_INVALID', stored_payload: storedPayload });
  });

  it('serializes an input-free multi-tick L01 attempt at its canonical terminal boundary and replays every canonical result exactly', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const seed = 'v2-l01-input-free-terminal';
    const original = replayInputs({ ...l01ReplayBindings, seed, ordered_input_log: [] }, [], 5);
    const inProgress: ReplayV2 = {
      schema_version: 'replay-v2',
      lesson_binding: { lesson_id: 'L01', ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, seed),
      seed,
      ordered_input_log: [],
      l01_synthetic_environment,
    };
    const payload = serializeReplayV2Attempt(inProgress, [], original.raw.logical_tick, false);
    expect(payload.l01_terminal_logical_tick).toBe(5);
    expect(payload.l01_terminal_paused).toBe(false);
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.ordered_input_log)).toBe(true);
    const resolution = await resolveReplayV2(payload);
    expect(resolution.outcome).toBe('accepted');
    if (resolution.outcome !== 'accepted') return;
    expect(resolution.replay.ordered_input_log).toEqual([]);
    const restored = replayInputs(resolution.replay, [], resolution.replay.l01_terminal_logical_tick!);
    expect(restored.raw).toEqual(original.raw);
    expect(restored.raw.logical_tick).toBe(5);
    expect(restored.ledger).toEqual(original.ledger);
    expect(projectScore(restored.raw, restored.ledger)).toEqual(projectScore(original.raw, original.ledger));
    expect(projectDebrief(restored.raw, restored.ledger)).toEqual(projectDebrief(original.raw, original.ledger));
  });

  it('persists an input-free lifecycle-equivalent terminal pause without advancing after recovery', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const seed = 'v2-l01-lifecycle-terminal-pause';
    const canonical = replayInputs({ ...l01ReplayBindings, seed, ordered_input_log: [] }, [], 3);
    const lifecyclePaused = pauseForLifecycle(canonical, 'focus_lost', 1);
    const payload = serializeReplayV2Attempt({
      schema_version: 'replay-v2',
      lesson_binding: { lesson_id: 'L01', ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, seed),
      seed,
      ordered_input_log: [],
      l01_synthetic_environment,
    }, [], canonical.raw.logical_tick, lifecyclePaused.paused);
    const resolution = await resolveReplayV2(payload);
    expect(resolution.outcome).toBe('accepted');
    if (resolution.outcome !== 'accepted') return;
    const restored = replayInputs(resolution.replay, [], resolution.replay.l01_terminal_logical_tick!);
    expect(restored.raw.logical_tick).toBe(canonical.raw.logical_tick);
    expect(restored.paused).toBe(true);
    expect(advanceLogicalTick(restored)).toBe(restored);
  });

  it('round-trips an L01 helm accepted at terminal tick zero without a synthetic transition', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const seed = 'v2-l01-terminal-tick-zero';
    const input: CanonicalInput = { logical_tick: 0, sequence: 1, input: { action: 'helm_port' } };
    const live = applyCanonicalInput(createSession({ ...l01ReplayBindings, seed, ordered_input_log: [] }), input);
    const payload = serializeReplayV2Attempt({
      schema_version: 'replay-v2',
      lesson_binding: { lesson_id: 'L01', ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, seed),
      seed,
      ordered_input_log: [],
      l01_synthetic_environment,
    }, [input], live.raw.logical_tick, false);

    expect(payload.l01_terminal_logical_tick).toBe(0);
    const resolution = await resolveReplayV2(payload);
    expect(resolution.outcome).toBe('accepted');
    if (resolution.outcome !== 'accepted') return;
    const restored = replayInputs(resolution.replay, resolution.replay.ordered_input_log as readonly CanonicalInput[], resolution.replay.l01_terminal_logical_tick!);

    expect(restored.raw).toEqual(live.raw);
    expect(restored.ledger).toEqual(live.ledger);
    expect(projectScore(restored.raw, restored.ledger)).toEqual(projectScore(live.raw, live.ledger));
    expect(projectDebrief(restored.raw, restored.ledger)).toEqual(projectDebrief(live.raw, live.ledger));
    expect(restored.raw.logical_tick).toBe(payload.l01_terminal_logical_tick);
    expect(restored.ledger).not.toContainEqual(expect.objectContaining({ type: 'L01_SYNTHETIC_TRANSITION' }));
  });

  it('rejects and preserves an L01 V2 input after its terminal boundary', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = {
      schema_version: 'replay-v2' as const,
      lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, 'v2-input-after-terminal'),
      seed: 'v2-input-after-terminal',
      ordered_input_log: [{ logical_tick: 1, sequence: 1, input: { action: 'helm_port' as const } }],
      l01_synthetic_environment,
      l01_terminal_logical_tick: 0,
      l01_terminal_paused: false,
    };

    expect(isReplayV2Shape(storedPayload)).toBe(false);
    const resolution = await resolveReplayV2(storedPayload);
    expect(resolution).toEqual({ outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: storedPayload });
    if (resolution.outcome === 'rejected') expect(resolution.stored_payload).toBe(storedPayload);
    expect(() => replayInputs(storedPayload, storedPayload.ordered_input_log as readonly CanonicalInput[], storedPayload.l01_terminal_logical_tick)).toThrow(/terminal authority is invalid/);
  });

  it.each([
    ['missing', (payload: ReplayV2) => { const { l01_terminal_paused: _omitted, ...invalid } = payload; void _omitted; return invalid; }],
    ['non-boolean', (payload: ReplayV2) => ({ ...payload, l01_terminal_paused: 'true' })],
    ['canonical-pause mismatch', (payload: ReplayV2) => ({ ...payload, l01_terminal_paused: false })],
  ])('fails closed and preserves %s L01 V2 terminal paused state', async (_label, mutate) => {
    const payload = await createL01V2Payload('v2-terminal-paused-invalid', [
      { logical_tick: 0, sequence: 1, input: { action: 'pause' } },
    ], 0, true);
    const storedPayload = mutate(payload);
    await expect(resolveReplayV2(storedPayload)).resolves.toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_V2_SCHEMA_INVALID',
      stored_payload: storedPayload,
    });
  });

  it.each([
    ['missing', undefined],
    ['non-integer', 1.5],
    ['unknown legacy extension', { terminal_logical_tick: 1 }],
  ])('rejects and preserves a %s L01 V2 terminal boundary', async (_label, terminalBoundary) => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, l01_synthetic_environment, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const base = {
      schema_version: 'replay-v2' as const,
      lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, 'v2-terminal-invalid'),
      seed: 'v2-terminal-invalid',
      ordered_input_log: [],
      l01_synthetic_environment,
      l01_terminal_paused: false,
    };
    const storedPayload = terminalBoundary === undefined
      ? base
      : typeof terminalBoundary === 'object'
        ? { ...base, ...terminalBoundary }
        : { ...base, l01_terminal_logical_tick: terminalBoundary };
    expect(isReplayV2Shape(storedPayload)).toBe(false);
    await expect(resolveReplayV2(storedPayload)).resolves.toEqual({ outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID', stored_payload: storedPayload });
  });
});
