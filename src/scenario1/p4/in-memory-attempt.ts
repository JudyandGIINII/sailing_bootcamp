import { createP2State, parseP2Action, reduceP2State, type P2State } from '../p2/deterministic-mechanics.js';
import {
  createP3Attempt,
  evaluateP3Score,
  reduceP3Attempt,
  type P3AttemptState,
  type P3CanonicalRecord,
  type P3ScoreResult,
} from '../p3/deterministic-scoring.js';
import { deriveP4BindingProfile, p3ProfileFromBinding, sailWindFitQuality, type P4BindingProfile } from './binding-contract.js';

export const P4_PUBLIC_SEED = 0x51a1c0de as const;

export type P4UserRecord = Readonly<{
  readonly logical_tick: number;
  readonly sequence: number;
  readonly kind: 'p2_action' | 'end_voyage';
  readonly payload: unknown;
}>;

export interface P4AttemptState {
  readonly seed: number;
  readonly p2_state: P2State;
  readonly binding: P4BindingProfile;
  readonly p3_state: P3AttemptState;
  /** P3-compatible, derived-only records. They are P4 memory, never replay data. */
  readonly records: readonly P3CanonicalRecord[];
}

export type P4AttemptReduction =
  | Readonly<{ readonly status: 'accepted'; readonly state: P4AttemptState }>
  | Readonly<{ readonly status: 'rejected_invalid_input' | 'rejected_post_terminal'; readonly state: P4AttemptState }>;

function isUInt32(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value <= 0xffffffff;
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const object = value as object;
    const ownKeys = Reflect.ownKeys(object);
    if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))) return undefined;
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined;
      copy[key] = descriptor.value;
    }
    return copy;
  } catch {
    return undefined;
  }
}

function parseUserRecord(value: unknown): P4UserRecord | undefined {
  const candidate = exactObject(value, ['logical_tick', 'sequence', 'kind', 'payload']);
  if (!candidate || !isUInt32(candidate.logical_tick) || !isUInt32(candidate.sequence)) return undefined;
  const action = candidate.kind === 'p2_action' ? parseP2Action(candidate.payload) : undefined;
  if (action) return Object.freeze({ logical_tick: candidate.logical_tick, sequence: candidate.sequence, kind: 'p2_action', payload: Object.freeze({ ...action }) });
  if (candidate.kind === 'end_voyage' && exactObject(candidate.payload, [])) return Object.freeze({ logical_tick: candidate.logical_tick, sequence: candidate.sequence, kind: 'end_voyage', payload: Object.freeze({}) });
  return undefined;
}

function recordAfter(previous: P3CanonicalRecord | undefined, next: P4UserRecord): boolean {
  return !previous || next.logical_tick > previous.logical_tick || (next.logical_tick === previous.logical_tick && next.sequence > previous.sequence);
}

function derivedRecord(logicalTick: number, sequence: number, kind: P3CanonicalRecord['kind'], payload: unknown): P3CanonicalRecord {
  return Object.freeze({ logical_tick: logicalTick, sequence, kind, payload });
}

function withProfile(state: P3AttemptState, binding: P4BindingProfile): P3AttemptState {
  const profile = p3ProfileFromBinding(binding);
  const exists = state.profiles.some((entry) => entry.profile_id === profile.profile_id && entry.profile_version === profile.profile_version && entry.scoring_contract_version === profile.scoring_contract_version);
  return exists ? state : Object.freeze({ ...state, profiles: Object.freeze([...state.profiles, profile]) });
}

function profileIdentity(binding: P4BindingProfile) {
  return Object.freeze({
    profile_id: binding.profile_id,
    profile_version: binding.profile_version,
    scoring_contract_version: binding.scoring_contract_version,
  });
}

function score(state: P4AttemptState): P3ScoreResult {
  const controls = state.p2_state.controls;
  return evaluateP3Score({
    records: state.records,
    profiles: state.p3_state.profiles,
    active_profile: state.p3_state.active_profile,
    current_heading_centidegrees: controls.headingCentidegrees,
    canonical_engine_output: controls.engineOutput,
    normalized_engine_magnitude: Math.abs(controls.engineOutput),
    main_deployed: controls.mainDeployed,
    jib_deployed: controls.jibDeployed,
    sail_wind_fit_q: state.p3_state.sail_wind_fit_q,
  });
}

/** Creates a pure P4-only memory attempt from a public UInt32 seed. */
export function createP4Attempt(seed: number = P4_PUBLIC_SEED): P4AttemptState {
  if (!isUInt32(seed)) throw new RangeError('P4_INVALID_PUBLIC_SEED');
  const p2State = createP2State(seed);
  const binding = deriveP4BindingProfile(p2State);
  const p3State = createP3Attempt({
    seed,
    profiles: [p3ProfileFromBinding(binding)],
    active_profile: profileIdentity(binding),
    sail_wind_fit_q: sailWindFitQuality(p2State.controls, binding),
  });
  return Object.freeze({ seed, p2_state: p2State, binding, p3_state: p3State, records: Object.freeze([]) });
}

export function currentP4Score(state: P4AttemptState): P3ScoreResult {
  return state.p3_state.terminal?.score ?? score(state);
}

/**
 * Reduces one UI-authorized P2 action. Each action atomically emits P2,
 * profile, and quality records in canonical order. Direct bridge records are
 * deliberately not an accepted public input shape.
 */
export function reduceP4Attempt(state: P4AttemptState, value: unknown): P4AttemptReduction {
  const userRecord = parseUserRecord(value);
  if (!userRecord || !recordAfter(state.records.at(-1), userRecord)) return Object.freeze({ status: 'rejected_invalid_input', state });
  if (state.p3_state.terminal) return Object.freeze({ status: 'rejected_post_terminal', state });
  if (userRecord.kind === 'end_voyage') {
    const end = derivedRecord(userRecord.logical_tick, userRecord.sequence, 'end_voyage', Object.freeze({}));
    const reduction = reduceP3Attempt(state.p3_state, end);
    if (reduction.status !== 'accepted') return Object.freeze({ status: 'rejected_invalid_input', state });
    return Object.freeze({ status: 'accepted', state: Object.freeze({ ...state, p3_state: reduction.state, records: Object.freeze([...state.records, end]) }) });
  }
  if (userRecord.sequence > 0xfffffffd) return Object.freeze({ status: 'rejected_invalid_input', state });
  const p2Record = derivedRecord(userRecord.logical_tick, userRecord.sequence, 'p2_action', userRecord.payload);
  const nextP2 = reduceP2State(state.p2_state, userRecord.payload);
  const binding = deriveP4BindingProfile(nextP2);
  const profileRecord = derivedRecord(userRecord.logical_tick, userRecord.sequence + 1, 'replace_profile', Object.freeze({
    profile_id: binding.profile_id,
    profile_version: binding.profile_version,
    scoring_contract_version: binding.scoring_contract_version,
  }));
  const qualityRecord = derivedRecord(userRecord.logical_tick, userRecord.sequence + 2, 'set_sail_wind_fit_q', Object.freeze({ sail_wind_fit_q: sailWindFitQuality(nextP2.controls, binding) }));
  let p3State = withProfile(state.p3_state, binding);
  for (const record of [p2Record, profileRecord, qualityRecord]) {
    const reduction = reduceP3Attempt(p3State, record);
    if (reduction.status !== 'accepted') return Object.freeze({ status: 'rejected_invalid_input', state });
    p3State = reduction.state;
  }
  return Object.freeze({ status: 'accepted', state: Object.freeze({
    ...state,
    p2_state: nextP2,
    binding,
    p3_state: p3State,
    records: Object.freeze([...state.records, p2Record, profileRecord, qualityRecord]),
  }) });
}
