import { describe, expect, it } from 'vitest';
import { prototypeVersionBindings } from '../../src/contracts/versions.js';
import { REPLAY_IDENTITY_FIELDS, isReplayIdentity, isReplayV2Shape, resolveExactReplayIdentity, resolveReplayV2, resolveStoredReplay, type ReplayIdentity } from '../../src/contracts/replay.js';
import { createSyntheticScenario, defaultScenarioConfiguration } from '../../src/content/scenario-catalog.js';
import { l01ReplayBindings } from '../../src/content/l01.js';
import { materializeVariation } from '../../src/sim/scenario-variation.js';
import { sha256Canonical } from '../../src/contracts/scenario.js';

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
  it('requires exactly the canonical identity fields', () => {
    expect(isReplayIdentity(replay)).toBe(true);
    expect(isReplayIdentity({ ...replay, extra: 'not permitted' })).toBe(false);
    const { comparison_policy_version: omitted, ...withoutComparisonPolicy } = replay;
    expect(omitted).toBeTruthy();
    expect(isReplayIdentity(withoutComparisonPolicy)).toBe(false);
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
  it('round-trips a strict V2 replay with lesson authority independent of scenario', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, ...lesson_bindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const lesson_binding = { lesson_id: 'L01' as const, ...lesson_bindingValues };
    const payload = { schema_version: 'replay-v2' as const, lesson_binding, scenario_snapshot: scenario, variation_trace: await materializeVariation(scenario, 'v2-seed'), seed: 'v2-seed', ordered_input_log: [{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }] };
    await expect(resolveReplayV2(payload)).resolves.toMatchObject({ outcome: 'accepted' });
    await expect(resolveReplayV2({ ...payload, scenario_version: 'legacy' })).resolves.toMatchObject({ outcome: 'rejected', reason_code: 'REPLAY_V2_SCHEMA_INVALID' });
    await expect(resolveReplayV2({ ...payload, variation_trace: { ...payload.variation_trace, seed: 'tampered' } })).resolves.toMatchObject({ outcome: 'rejected', reason_code: 'REPLAY_V2_VARIATION_INVALID' });
  });

  it('rejects an empty-log V2 replay with a tampered lesson binding and preserves the payload', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = {
      schema_version: 'replay-v2' as const,
      lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues, model_version: 'tampered-model-version' },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, 'v2-empty-log-tampered-binding-seed'),
      seed: 'v2-empty-log-tampered-binding-seed',
      ordered_input_log: [],
    };

    await expect(resolveReplayV2(storedPayload)).resolves.toEqual({
      outcome: 'rejected',
      reason_code: 'REPLAY_ACTION_DISALLOWED',
      stored_payload: storedPayload,
    });
  });

  it('rejects a V2 ordered-input entry with an unknown key without legacy fallback and preserves it', async () => {
    const scenario = await createSyntheticScenario(defaultScenarioConfiguration);
    const { scenario_version: ignoredScenarioVersion, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = {
      schema_version: 'replay-v2' as const,
      lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues },
      scenario_snapshot: scenario,
      variation_trace: await materializeVariation(scenario, 'v2-extra-entry-key-seed'),
      seed: 'v2-extra-entry-key-seed',
      ordered_input_log: [{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' }, unexpected: 'entry-extension' }],
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
    const { scenario_version: ignoredScenarioVersion, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = {
      schema_version: 'replay-v2' as const,
      lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues },
      scenario_snapshot: rehashedHistoricalScenario,
      variation_trace: await materializeVariation(rehashedHistoricalScenario, 'historical-v2-seed'),
      seed: 'historical-v2-seed',
      ordered_input_log: [{ logical_tick: 0, sequence: 1, input: { action: 'helm_port' } }],
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
    const { scenario_version: ignoredScenarioVersion, ...lessonBindingValues } = l01ReplayBindings;
    void ignoredScenarioVersion;
    const storedPayload = { schema_version: 'replay-v2' as const, lesson_binding: { lesson_id: 'L01' as const, ...lessonBindingValues }, scenario_snapshot: { ...scenario, raw: incompleteRaw }, variation_trace: await materializeVariation(scenario, 'incomplete-v2-seed'), seed: 'incomplete-v2-seed', ordered_input_log: [] };
    await expect(resolveReplayV2(storedPayload)).resolves.toEqual({ outcome: 'rejected', reason_code: 'REPLAY_V2_SCENARIO_INVALID', stored_payload: storedPayload });
  });
});
