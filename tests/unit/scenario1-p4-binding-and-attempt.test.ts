import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createP2State, reduceP2State } from '../../src/scenario1/p2/deterministic-mechanics.js';
import { P4_BINDING_DISCRIMINATOR, deriveP4BindingProfile, sailWindFitQuality, type P4BindingProfile } from '../../src/scenario1/p4/binding-contract.js';
import { P4_PUBLIC_SEED, createP4Attempt, currentP4Score, reduceP4Attempt } from '../../src/scenario1/p4/in-memory-attempt.js';
import { verifyP4Attempt } from '../../src/scenario1/p4/in-memory-verifier.js';
import { retryP4Attempt } from '../../src/scenario1/p4/retry.js';

const qualityBinding: P4BindingProfile = Object.freeze({
  binding_discriminator: 'scenario1-p2-p3-binding-v1', profile_id: 'scenario1-p2-target-v1-00000000-00000000', profile_version: 1,
  scoring_contract_version: 'scenario1-synthetic-score-calibration-v2', scenario_seed: 0, ordinal: 0, synthetic_target_heading_centidegrees: 0,
  propulsion_context: 'sailing_capable', sail_targets: Object.freeze({ main_deployed: true, jib_deployed: true, main_trim: 10000, jib_trim: 10000, main_reef_level: 2, jib_reef_level: 2 }),
});

const matchingControls = Object.freeze({ headingCentidegrees: 0, engineOutput: 0, mainDeployed: true, jibDeployed: true, mainTrim: 10000, jibTrim: 10000, mainReefLevel: 2, jibReefLevel: 2, autopilotEnabled: true });

function p2Record(sequence: number, payload: unknown) {
  return { logical_tick: 1, sequence, kind: 'p2_action' as const, payload };
}

describe('Scenario 1 P4 binding and in-memory bridge', () => {
  it('derives the exact immutable P2 target binding and rejects target tampering', () => {
    const state = createP2State(0x51a1c0de);
    const binding = deriveP4BindingProfile(state);
    expect(binding).toMatchObject({ profile_id: 'scenario1-p2-target-v1-51a1c0de-00000000', profile_version: 1, propulsion_context: 'sailing_capable' });
    expect(Object.isFrozen(binding)).toBe(true);
    const tampered = Object.freeze({ ...state, target: Object.freeze({ ...state.target, mainTrim: state.target.mainTrim + 1 }) });
    expect(() => deriveP4BindingProfile(tampered)).toThrow('P4_BINDING_TARGET_MISMATCH');
  });

  it('uses exactly the approved six-field sail fit quality fixtures', () => {
    expect(sailWindFitQuality(matchingControls, qualityBinding)).toBe(10000);
    expect(sailWindFitQuality({ ...matchingControls, mainDeployed: false }, qualityBinding)).toBe(8333);
    expect(sailWindFitQuality({ ...matchingControls, mainTrim: 9999 }, qualityBinding)).toBe(9999);
    expect(sailWindFitQuality({ ...matchingControls, mainTrim: 0 }, qualityBinding)).toBe(8333);
    expect(sailWindFitQuality({ ...matchingControls, mainReefLevel: 1 }, qualityBinding)).toBe(9166);
    expect(sailWindFitQuality({ ...matchingControls, mainDeployed: false, jibDeployed: false, mainTrim: 0, jibTrim: 0, mainReefLevel: 0, jibReefLevel: 0 }, qualityBinding)).toBe(0);
  });

  it('processes P2 first, derives bridge records atomically, and freezes End Voyage without an advance', () => {
    let attempt = createP4Attempt(P4_PUBLIC_SEED);
    const target = attempt.p2_state.target;
    const result = reduceP4Attempt(attempt, p2Record(1, { type: 'set_heading_centidegrees', heading_centidegrees: target.headingCentidegrees }));
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    attempt = result.state;
    expect(attempt.records.map((record) => record.kind)).toEqual(['p2_action', 'replace_profile', 'set_sail_wind_fit_q']);
    expect(attempt.records.map((record) => record.sequence)).toEqual([1, 2, 3]);
    const tickBeforeEnd = attempt.p2_state.logicalTick;
    const end = reduceP4Attempt(attempt, { logical_tick: 2, sequence: 4, kind: 'end_voyage', payload: {} });
    expect(end.status).toBe('accepted');
    if (end.status !== 'accepted') return;
    expect(end.state.p2_state.logicalTick).toBe(tickBeforeEnd);
    expect(end.state.p3_state.terminal?.terminal_sequence).toBe(4);
    expect(reduceP4Attempt(end.state, { logical_tick: 3, sequence: 5, kind: 'p2_action', payload: { type: 'set_engine_output', engine_output: 1 } }).status).toBe('rejected_post_terminal');
  });

  it('copies and freezes accepted caller payloads before retaining canonical records', () => {
    const action = { type: 'set_engine_output' as const, engine_output: 100 };
    const reduced = reduceP4Attempt(createP4Attempt(), p2Record(1, action));
    expect(reduced.status).toBe('accepted');
    if (reduced.status !== 'accepted') return;
    action.engine_output = 900;
    expect(reduced.state.records[0]?.payload).toEqual({ type: 'set_engine_output', engine_output: 100 });
    expect(Object.isFrozen(reduced.state.records[0]?.payload)).toBe(true);
  });

  it('fails closed for duplicate/reversed records, direct bridge records, malformed identity, and forged quality', () => {
    const initial = createP4Attempt();
    expect(reduceP4Attempt(initial, { logical_tick: 1, sequence: 1, kind: 'replace_profile', payload: {} }).status).toBe('rejected_invalid_input');
    const accepted = reduceP4Attempt(initial, p2Record(1, { type: 'set_engine_output', engine_output: 100 }));
    expect(accepted.status).toBe('accepted');
    if (accepted.status !== 'accepted') return;
    expect(reduceP4Attempt(accepted.state, p2Record(2, { type: 'set_engine_output', engine_output: 200 })).status).toBe('rejected_invalid_input');
    const forged = structuredClone(accepted.state) as typeof accepted.state;
    (forged.records[2] as { payload: { sail_wind_fit_q: number } }).payload.sail_wind_fit_q = 9999;
    expect(verifyP4Attempt(forged)).toEqual({ status: 'invalid', reason: 'P4_DERIVED_RECORD_MISMATCH' });
    const identityMismatch = structuredClone(accepted.state) as typeof accepted.state;
    (identityMismatch.records[1] as { payload: { profile_version: number } }).payload.profile_version = 99;
    expect(verifyP4Attempt(identityMismatch)).toEqual({ status: 'invalid', reason: 'P4_DERIVED_RECORD_MISMATCH' });
  });

  it('retries with the same fixed seed, preserves the old attempt, and reproduces the score timeline', () => {
    const original = createP4Attempt();
    const action = p2Record(1, { type: 'set_engine_output', engine_output: 250 });
    const first = reduceP4Attempt(original, action);
    expect(first.status).toBe('accepted');
    if (first.status !== 'accepted') return;
    const retry = retryP4Attempt(first.state);
    expect(retry).toEqual(createP4Attempt(P4_PUBLIC_SEED));
    expect(first.state.records).toHaveLength(3);
    const replayed = reduceP4Attempt(retry, action);
    expect(replayed.status).toBe('accepted');
    if (replayed.status !== 'accepted') return;
    expect(currentP4Score(replayed.state)).toEqual(currentP4Score(first.state));
  });

  it('does not change P2 autopilot semantics or bind it into the profile', () => {
    const state = reduceP2State(createP2State(12), { type: 'set_autopilot_enabled', autopilot_enabled: true });
    const binding = deriveP4BindingProfile(state);
    expect(JSON.stringify(binding)).not.toContain('autopilot');
  });

  it('fails closed when P2 target or binding identity data is tampered after reduction', () => {
    const attempt = createP4Attempt();
    const targetTamper = structuredClone(attempt) as typeof attempt;
    (targetTamper.p2_state.target as { mainTrim: number }).mainTrim += 1;
    expect(verifyP4Attempt(targetTamper)).toEqual({ status: 'invalid', reason: 'P4_DERIVED_RECORD_MISMATCH' });
    const versionTamper = structuredClone(attempt) as typeof attempt;
    (versionTamper.binding as { profile_version: number }).profile_version = 2;
    expect(verifyP4Attempt(versionTamper)).toEqual({ status: 'invalid', reason: 'P4_DERIVED_RECORD_MISMATCH' });
  });

  it('never throws for malformed, circular, BigInt, or adversarial verifier input', () => {
    const circular = { seed: P4_PUBLIC_SEED, records: [] as unknown[] } as { seed: number; records: unknown[]; p2_state?: unknown };
    circular.p2_state = circular;
    const bigint = { seed: P4_PUBLIC_SEED, records: [] as unknown[], p2_state: 1n };
    const adversarial = new Proxy({}, { get() { throw new Error('caller trap'); } });
    for (const value of [{ seed: P4_PUBLIC_SEED, records: {} }, circular, bigint, adversarial]) {
      expect(() => verifyP4Attempt(value)).not.toThrow();
      expect(verifyP4Attempt(value)).toEqual({ status: 'invalid', reason: 'P4_INVALID_ATTEMPT' });
    }
  });

  it('does not serialize the P4 binding discriminator into records or P3 state', () => {
    const reduced = reduceP4Attempt(createP4Attempt(), p2Record(1, { type: 'set_engine_output', engine_output: 100 }));
    expect(reduced.status).toBe('accepted');
    if (reduced.status !== 'accepted') return;
    expect(JSON.stringify(reduced.state.records)).not.toContain(P4_BINDING_DISCRIMINATOR);
    expect(JSON.stringify(reduced.state.p3_state)).not.toContain(P4_BINDING_DISCRIMINATOR);
  });

  it('keeps P4 source isolated from legacy replay/storage and browser persistence APIs', () => {
    const p4Root = resolve('src/scenario1/p4');
    const source = readdirSync(p4Root, { recursive: true })
      .filter((file): file is string => typeof file === 'string' && file.endsWith('.ts'))
      .map((file) => readFileSync(resolve(p4Root, file), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/from\s+['"].*(?:contracts\/replay|storage\/replays)/);
    expect(source).not.toMatch(/\b(?:indexedDB|IndexedDB|localStorage|sessionStorage|caches|CacheStorage|fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|Date\.now|new\s+Date|performance\.now|Math\.random|crypto\.getRandomValues)\b/);
  });
});
