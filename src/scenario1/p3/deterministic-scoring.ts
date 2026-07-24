import {
  createP2State,
  parseP2Action,
  reduceP2State,
  type P2Action,
  type P2State,
} from '../p2/deterministic-mechanics.js';

export const P3_SAIL_WIND_FIT_WEIGHT = 5000 as const;
export const P3_COURSE_CONTROL_WEIGHT = 3000 as const;
export const P3_PROPULSION_CONTEXT_WEIGHT = 2000 as const;
export const P3_TOTAL_WEIGHT = 10000 as const;
export const P3_SCORING_CONTRACT_VERSION = 'scenario1-synthetic-score-calibration-v2' as const;

export const P3_SCORE_WEIGHTS = Object.freeze({
  sail_wind_fit: P3_SAIL_WIND_FIT_WEIGHT,
  course_control: P3_COURSE_CONTROL_WEIGHT,
  propulsion_context: P3_PROPULSION_CONTEXT_WEIGHT,
});

export type P3InvalidReason =
  | 'invalid_replay_input'
  | 'invalid_fixture_identity'
  | 'invalid_profile'
  | 'invalid_heading'
  | 'invalid_context'
  | 'invalid_contributor';

export type P3ScoreResult = P3AvailableScore | P3UnavailableScore;

export interface P3AvailableScore {
  readonly score_status: 'available';
  readonly score: number;
  readonly contributors: P3Contributors;
}

export interface P3UnavailableScore {
  readonly score_status: 'unavailable_invalid_input';
  readonly reason: P3InvalidReason;
}

export interface P3Contributors {
  readonly sail_wind_fit_q: number;
  readonly course_q: number;
  readonly propulsion_q: number;
  readonly propulsion_penalty: number;
  readonly weights: typeof P3_SCORE_WEIGHTS;
}

export interface P3ProfileIdentity {
  readonly profile_id: string;
  readonly profile_version: number;
  readonly scoring_contract_version: string;
}

export type P3PropulsionContext = 'marina' | 'low_speed' | 'sailing_capable';

export interface P3TargetProfile extends P3ProfileIdentity {
  readonly synthetic_target_heading_centidegrees: number;
  readonly propulsion_context: P3PropulsionContext;
}

export interface P3FixtureIdentity extends P3ProfileIdentity {
  readonly fixture_id: string;
}

export interface P3CanonicalRecord {
  readonly logical_tick: number;
  readonly sequence: number;
  readonly kind: 'p2_action' | 'replace_profile' | 'set_sail_wind_fit_q' | 'end_voyage';
  readonly payload: unknown;
}

export interface P3ScoreInput {
  readonly records: readonly P3CanonicalRecord[];
  readonly profiles: readonly P3TargetProfile[];
  readonly active_profile: P3ProfileIdentity;
  readonly current_heading_centidegrees: number;
  readonly canonical_engine_output: number;
  readonly normalized_engine_magnitude: number;
  readonly main_deployed: boolean;
  readonly jib_deployed: boolean;
  readonly sail_wind_fit_q: number;
  readonly fixture_identity?: P3FixtureIdentity;
  readonly fixture_registry?: readonly P3FixtureIdentity[];
}

export interface P3AttemptConfig {
  readonly seed: number;
  readonly profiles: readonly P3TargetProfile[];
  readonly active_profile: P3ProfileIdentity;
  readonly sail_wind_fit_q: number;
}

export interface P3TerminalDebrief {
  readonly terminal_logical_tick: number;
  readonly terminal_sequence: number;
  readonly score: P3ScoreResult;
  readonly contributors?: P3Contributors;
  readonly profile: P3ProfileIdentity;
  readonly debrief: Readonly<{
    readonly score_status: P3ScoreResult['score_status'];
    readonly reason?: P3InvalidReason;
  }>;
}

export interface P3AttemptState {
  readonly p2_state: P2State;
  readonly profiles: readonly P3TargetProfile[];
  readonly active_profile: P3ProfileIdentity;
  readonly sail_wind_fit_q: unknown;
  readonly records: readonly P3CanonicalRecord[];
  readonly terminal?: P3TerminalDebrief;
}

export type P3AttemptReduction =
  | Readonly<{ readonly status: 'accepted'; readonly state: P3AttemptState }>
  | Readonly<{ readonly status: 'rejected_invalid_replay_input' | 'rejected_post_terminal'; readonly state: P3AttemptState }>;

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0;
}

function isQuality(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 10000;
}

function isHeading(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 35999;
}

function isEngineOutput(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= -10000 && value <= 10000;
}

function readExactObject(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> | undefined {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const object = value as object;
    const ownKeys = Reflect.ownKeys(object);
    const allowed = [...required, ...optional];
    if (ownKeys.length < required.length || ownKeys.some((key) => typeof key !== 'string' || !allowed.includes(key))) return undefined;
    if (required.some((key) => !Object.hasOwn(object, key))) return undefined;
    const copied: Record<string, unknown> = {};
    for (const key of ownKeys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined;
      copied[key] = descriptor.value;
    }
    return copied;
  } catch {
    return undefined;
  }
}

function freezeIdentity(value: P3ProfileIdentity): P3ProfileIdentity {
  return Object.freeze({
    profile_id: value.profile_id,
    profile_version: value.profile_version,
    scoring_contract_version: value.scoring_contract_version,
  });
}

function parseIdentity(value: unknown): P3ProfileIdentity | undefined {
  const candidate = readExactObject(value, ['profile_id', 'profile_version', 'scoring_contract_version']);
  return candidate ? parseIdentityFields(candidate) : undefined;
}

function parseIdentityFields(candidate: Record<string, unknown>): P3ProfileIdentity | undefined {
  if (!candidate || typeof candidate.profile_id !== 'string' || candidate.profile_id.length === 0 || !isNonNegativeInteger(candidate.profile_version) || typeof candidate.scoring_contract_version !== 'string' || candidate.scoring_contract_version.length === 0) return undefined;
  return freezeIdentity({
    profile_id: candidate.profile_id,
    profile_version: candidate.profile_version,
    scoring_contract_version: candidate.scoring_contract_version,
  });
}

function sameIdentity(left: P3ProfileIdentity, right: P3ProfileIdentity): boolean {
  return left.profile_id === right.profile_id &&
    left.profile_version === right.profile_version &&
    left.scoring_contract_version === right.scoring_contract_version;
}

function parseProfile(value: unknown): P3TargetProfile | undefined {
  const candidate = readExactObject(value, [
    'profile_id', 'profile_version', 'scoring_contract_version', 'synthetic_target_heading_centidegrees', 'propulsion_context',
  ]);
  if (!candidate) return undefined;
  const identity = parseIdentityFields(candidate);
  if (!identity) return undefined;
  return Object.freeze({ ...identity, synthetic_target_heading_centidegrees: candidate.synthetic_target_heading_centidegrees, propulsion_context: candidate.propulsion_context }) as P3TargetProfile;
}

function parseFixtureIdentity(value: unknown): P3FixtureIdentity | undefined {
  const candidate = readExactObject(value, ['fixture_id', 'profile_id', 'profile_version', 'scoring_contract_version']);
  const identity = candidate && parseIdentityFields(candidate);
  if (!identity || typeof candidate.fixture_id !== 'string' || candidate.fixture_id.length === 0) return undefined;
  return Object.freeze({ fixture_id: candidate.fixture_id, ...identity });
}

function parseRecord(value: unknown): P3CanonicalRecord | undefined {
  const candidate = readExactObject(value, ['logical_tick', 'sequence', 'kind', 'payload']);
  if (!candidate || !isNonNegativeInteger(candidate.logical_tick) || !isNonNegativeInteger(candidate.sequence) ||
    (candidate.kind !== 'p2_action' && candidate.kind !== 'replace_profile' && candidate.kind !== 'set_sail_wind_fit_q' && candidate.kind !== 'end_voyage')) return undefined;
  if (candidate.kind === 'p2_action' && !parseP2Action(candidate.payload)) return undefined;
  if (candidate.kind === 'end_voyage' && !readExactObject(candidate.payload, [])) return undefined;
  if (candidate.kind === 'replace_profile' && !parseIdentity(candidate.payload)) return undefined;
  if (candidate.kind === 'set_sail_wind_fit_q' && !readExactObject(candidate.payload, ['sail_wind_fit_q'])) return undefined;
  return Object.freeze({ logical_tick: candidate.logical_tick, sequence: candidate.sequence, kind: candidate.kind, payload: candidate.payload }) as P3CanonicalRecord;
}

function strictlyOrderedRecords(value: unknown): readonly P3CanonicalRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed: P3CanonicalRecord[] = [];
  let previous: P3CanonicalRecord | undefined;
  for (const entry of value) {
    const record = parseRecord(entry);
    if (!record || (previous && (record.logical_tick < previous.logical_tick ||
      (record.logical_tick === previous.logical_tick && record.sequence <= previous.sequence)))) return undefined;
    parsed.push(record);
    previous = record;
  }
  return Object.freeze(parsed);
}

function unavailable(reason: P3InvalidReason): P3UnavailableScore {
  return Object.freeze({ score_status: 'unavailable_invalid_input', reason });
}

/** Calculates the approved shortest-angle centidegree contributor. */
export function courseQuality(currentHeading: number, targetHeading: number): number | undefined {
  if (!isHeading(currentHeading) || !isHeading(targetHeading)) return undefined;
  const difference = Math.abs(currentHeading - targetHeading);
  const error = Math.min(difference, 36000 - difference);
  if (error <= 200) return 10000;
  if (error >= 3000) return 0;
  return Math.floor(((3000 - error) * 10000) / 2800);
}

export interface P3PropulsionQuality {
  readonly penalty: number;
  readonly quality: number;
}

/** Calculates the approved propulsion contributor using only integer arithmetic. */
export function propulsionQuality(
  context: P3PropulsionContext,
  normalizedEngineMagnitude: number,
  mainDeployed: boolean,
  jibDeployed: boolean,
): P3PropulsionQuality | undefined {
  if ((context !== 'marina' && context !== 'low_speed' && context !== 'sailing_capable') || !isQuality(normalizedEngineMagnitude) || typeof mainDeployed !== 'boolean' || typeof jibDeployed !== 'boolean') return undefined;
  if (context === 'marina' || context === 'low_speed' || normalizedEngineMagnitude === 0) return Object.freeze({ penalty: 0, quality: 10000 });
  const cap = !mainDeployed && !jibDeployed ? 6000 : 8000;
  const start = cap === 6000 ? 500 : 6500;
  const penalty = Math.min(cap, Math.max(0, normalizedEngineMagnitude - start));
  return Object.freeze({ penalty, quality: 10000 - Math.floor((penalty * 10000 + Math.floor(cap / 2)) / cap) });
}

/** Combines the three registered contributors with the immutable 50/30/20 weights. */
export function compositeScore(sailWindFitQ: number, courseQ: number, propulsionQ: number): number | undefined {
  if (!isQuality(sailWindFitQ) || !isQuality(courseQ) || !isQuality(propulsionQ)) return undefined;
  const numerator = P3_SAIL_WIND_FIT_WEIGHT * sailWindFitQ + P3_COURSE_CONTROL_WEIGHT * courseQ + P3_PROPULSION_CONTEXT_WEIGHT * propulsionQ + 500000;
  return Math.max(0, Math.min(100, Math.floor(numerator / 1000000)));
}

function parseProfiles(value: unknown): readonly P3TargetProfile[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const profiles: P3TargetProfile[] = [];
  for (const candidate of value) {
    const profile = parseProfile(candidate);
    if (!profile) return undefined;
    profiles.push(profile);
  }
  return Object.freeze(profiles);
}

function profileForIdentity(profiles: readonly P3TargetProfile[], identity: P3ProfileIdentity): P3TargetProfile | undefined {
  const matches = profiles.filter((profile) => sameIdentity(profile, identity));
  return matches.length === 1 ? matches[0] : undefined;
}

function validFixture(value: Record<string, unknown>, active: P3ProfileIdentity): boolean {
  const hasFixtureFields = Object.hasOwn(value, 'fixture_identity') || Object.hasOwn(value, 'fixture_registry');
  if (!hasFixtureFields) return true;
  const fixture = parseFixtureIdentity(value.fixture_identity);
  if (!fixture || !Array.isArray(value.fixture_registry)) return false;
  const registry = value.fixture_registry.map(parseFixtureIdentity);
  if (registry.some((entry) => !entry)) return false;
  const matches = (registry as P3FixtureIdentity[]).filter((entry) =>
    entry.fixture_id === fixture.fixture_id && sameIdentity(entry, fixture) && sameIdentity(entry, active));
  return matches.length === 1;
}

/**
 * Evaluates a canonical scoring tick.  Validation intentionally follows the
 * published replay, fixture, profile, heading, context, contributor order.
 */
export function evaluateP3Score(value: unknown): P3ScoreResult {
  const input = readExactObject(value, [], [
    'records', 'profiles', 'active_profile', 'current_heading_centidegrees', 'canonical_engine_output', 'normalized_engine_magnitude',
    'main_deployed', 'jib_deployed', 'sail_wind_fit_q',
    'fixture_identity', 'fixture_registry',
  ]);
  if (!input || !strictlyOrderedRecords(input.records)) return unavailable('invalid_replay_input');

  const activeProfile = parseIdentity(input.active_profile);
  if ((Object.hasOwn(input, 'fixture_identity') || Object.hasOwn(input, 'fixture_registry')) && (!activeProfile || !validFixture(input, activeProfile))) return unavailable('invalid_fixture_identity');
  if (!activeProfile) return unavailable('invalid_profile');

  const profiles = parseProfiles(input.profiles);
  const profile = profiles && profileForIdentity(profiles, activeProfile);
  if (!profile) return unavailable('invalid_profile');

  const courseQ = courseQuality(input.current_heading_centidegrees as number, profile.synthetic_target_heading_centidegrees);
  if (courseQ === undefined) return unavailable('invalid_heading');

  if (!isEngineOutput(input.canonical_engine_output) || !isQuality(input.normalized_engine_magnitude) ||
    input.normalized_engine_magnitude !== Math.abs(input.canonical_engine_output) || typeof input.main_deployed !== 'boolean' || typeof input.jib_deployed !== 'boolean') return unavailable('invalid_context');
  const propulsion = propulsionQuality(profile.propulsion_context, input.normalized_engine_magnitude, input.main_deployed, input.jib_deployed);
  if (!propulsion) return unavailable('invalid_context');

  if (!isQuality(input.sail_wind_fit_q)) return unavailable('invalid_contributor');
  const score = compositeScore(input.sail_wind_fit_q, courseQ, propulsion.quality);
  if (score === undefined) return unavailable('invalid_contributor');
  const contributors: P3Contributors = Object.freeze({
    sail_wind_fit_q: input.sail_wind_fit_q,
    course_q: courseQ,
    propulsion_q: propulsion.quality,
    propulsion_penalty: propulsion.penalty,
    weights: P3_SCORE_WEIGHTS,
  });
  return Object.freeze({ score_status: 'available', score, contributors });
}

function freezeProfilesForAttempt(value: readonly P3TargetProfile[]): readonly P3TargetProfile[] {
  const profiles = parseProfiles(value);
  if (!profiles) throw new RangeError('P3_INVALID_PROFILE_REGISTRY');
  return profiles;
}

/** Creates a pure in-memory P3 attempt. No replay, persistence, or UI is wired here. */
export function createP3Attempt(config: P3AttemptConfig): P3AttemptState {
  const candidate = readExactObject(config, ['seed', 'profiles', 'active_profile', 'sail_wind_fit_q']);
  const active = candidate && parseIdentity(candidate.active_profile);
  const profiles = candidate && Array.isArray(candidate.profiles) ? freezeProfilesForAttempt(candidate.profiles as readonly P3TargetProfile[]) : undefined;
  if (!candidate || !isNonNegativeInteger(candidate.seed) || candidate.seed > 0xffffffff || !active || !profiles || !profileForIdentity(profiles, active) || !isQuality(candidate.sail_wind_fit_q)) throw new RangeError('P3_INVALID_ATTEMPT_CONFIG');
  return Object.freeze({
    p2_state: createP2State(candidate.seed),
    profiles,
    active_profile: active,
    sail_wind_fit_q: candidate.sail_wind_fit_q,
    records: Object.freeze([]),
  });
}

function attemptScore(state: P3AttemptState, records: readonly P3CanonicalRecord[]): P3ScoreResult {
  const controls = state.p2_state.controls;
  return evaluateP3Score({
    records,
    profiles: state.profiles,
    active_profile: state.active_profile,
    current_heading_centidegrees: controls.headingCentidegrees,
    canonical_engine_output: controls.engineOutput,
    normalized_engine_magnitude: Math.abs(controls.engineOutput),
    main_deployed: controls.mainDeployed,
    jib_deployed: controls.jibDeployed,
    sail_wind_fit_q: state.sail_wind_fit_q,
  });
}

function terminalDebrief(state: P3AttemptState, record: P3CanonicalRecord, records: readonly P3CanonicalRecord[]): P3TerminalDebrief {
  const score = attemptScore(state, records);
  const debrief = score.score_status === 'available'
    ? Object.freeze({ score_status: score.score_status })
    : Object.freeze({ score_status: score.score_status, reason: score.reason });
  return Object.freeze({
    terminal_logical_tick: record.logical_tick,
    terminal_sequence: record.sequence,
    score,
    ...(score.score_status === 'available' ? { contributors: score.contributors } : {}),
    profile: freezeIdentity(state.active_profile),
    debrief,
  });
}

function recordAfter(previous: P3CanonicalRecord | undefined, next: P3CanonicalRecord): boolean {
  return !previous || next.logical_tick > previous.logical_tick ||
    (next.logical_tick === previous.logical_tick && next.sequence > previous.sequence);
}

/**
 * Applies exactly one canonical record. End Voyage freezes the score at that
 * record without calling P2 advance; terminal and invalid records return the
 * original state by identity.
 */
export function reduceP3Attempt(state: P3AttemptState, value: unknown): P3AttemptReduction {
  const record = parseRecord(value);
  if (!record || !recordAfter(state.records.at(-1), record)) return Object.freeze({ status: 'rejected_invalid_replay_input', state });
  if (state.terminal) return Object.freeze({ status: 'rejected_post_terminal', state });
  const records = Object.freeze([...state.records, record]);
  if (record.kind === 'p2_action') {
    const action = parseP2Action(record.payload) as P2Action;
    return Object.freeze({ status: 'accepted', state: Object.freeze({ ...state, p2_state: reduceP2State(state.p2_state, action), records }) });
  }
  if (record.kind === 'replace_profile') {
    const identity = parseIdentity(record.payload);
    return Object.freeze({ status: 'accepted', state: Object.freeze({ ...state, active_profile: identity ?? state.active_profile, records }) });
  }
  if (record.kind === 'set_sail_wind_fit_q') {
    const payload = readExactObject(record.payload, ['sail_wind_fit_q']);
    return Object.freeze({ status: 'accepted', state: Object.freeze({ ...state, sail_wind_fit_q: payload?.sail_wind_fit_q, records }) });
  }
  const terminal = terminalDebrief(state, record, records);
  return Object.freeze({ status: 'accepted', state: Object.freeze({ ...state, records, terminal }) });
}
