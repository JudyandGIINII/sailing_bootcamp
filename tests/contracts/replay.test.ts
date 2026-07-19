import { describe, expect, it } from 'vitest';
import { prototypeVersionBindings } from '../../src/contracts/versions.js';
import { REPLAY_IDENTITY_FIELDS, isReplayIdentity, resolveExactReplayIdentity, resolveStoredReplay, type ReplayIdentity } from '../../src/contracts/replay.js';

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
});
