import { hasStrictL01ReplayV2TerminalAuthority, hasStrictL02ReplayV2TerminalAuthority, hasStrictL03ReplayV2TerminalAuthority, type ReplayIdentity, type ReplayV2 } from '../contracts/replay.js';
import { isLessonActionAllowedV2, resolveLessonPolicy, type DeclaredLessonAction } from '../content/lesson-manifest.js';
import { isL01SyntheticEnvironmentV1, l01SyntheticEnvironmentV1, type L01SyntheticEnvironmentV1 } from '../contracts/l01-synthetic-environment.js';
import { POLAR_KINEMATICS_MODEL_VERSION, isPolarKinematicsEnvironmentV1, polarKinematicsEnvironmentV1, type PolarKinematicsEnvironmentV1 } from '../contracts/polar-kinematics-environment.js';
import { isL02SyntheticTrimProfileV1, l02SyntheticTrimProfileV1, type L02SyntheticTrimProfileV1 } from '../contracts/l02-synthetic-trim.js';
import { L04_MARK_ARRIVAL_CAUSE, L04_MARK_ARRIVAL_RADIUS_M, L04_TARGET_MARK, isL03SyntheticAcknowledgmentProfileV2, l03SyntheticAcknowledgmentProfileV2, type L03SyntheticAcknowledgmentProfileV2 } from '../content/l02-l05.js';
import { projectL01SyntheticObservations, type L01SyntheticObservations } from './l01-observation.js';
import { createInitialL01SyntheticState, transitionL01SyntheticState, type L01SyntheticState } from './l01-synthetic-model.js';
import { createInitialL02SyntheticTrimObservation, reduceL02SyntheticTrimObservation, type L02SyntheticTrimObservation } from './l02-synthetic-model.js';
import { createInitialPolarKinematicState, transitionPolarKinematicState, type PolarKinematicState } from './polar-kinematics-model.js';
import { projectPolarObservations, type PolarObservations } from './polar-observation.js';

export type HelmCommand = 'neutral' | 'port' | 'starboard';
export type SessionAction = DeclaredLessonAction;
export type LifecycleReason = 'focus_lost' | 'visibility_hidden';

export interface CanonicalInput {
  logical_tick: number;
  sequence: number;
  input: { action: SessionAction };
}

export interface LedgerEvent {
  id: string;
  tick: number;
  sequence: number;
  type: 'SESSION_STARTED' | 'ACTION_ACCEPTED' | 'LESSON_CHECKPOINT' | 'ENVIRONMENT_EPISODE' | 'SAFETY_BLOCKED' | 'L01_SYNTHETIC_TRANSITION' | 'POLAR_KINEMATIC_TRANSITION';
  action?: SessionAction;
  contract_status?: 'UNVALIDATED_DOMAIN_MODEL';
  synthetic?: true;
  cause?: string;
  lesson_id?: 'L01' | 'L02' | 'L03' | 'L04' | 'L05' | 'L06';
  /** Immutable backward link from an L01 checkpoint to its already-recorded action. */
  action_event_id?: string;
  transition_event_id?: string;
  l01_transition?: Readonly<{
    environment_id: string;
    environment_version: number;
    model_id: string;
    model_version: number;
    canonical_precision_version: string;
    accepted_helm_command: HelmCommand;
    /** Ordered immutable input evidence consumed by this exact transition. */
    causal_controls: readonly Readonly<{
      logical_tick: number;
      sequence: number;
      helm_command: HelmCommand;
      action_event_id: string;
      checkpoint_event_id: string;
    }>[];
    prior_state: L01SyntheticState;
    next_state: L01SyntheticState;
    observations: L01SyntheticObservations;
  }>;
  polar_transition?: Readonly<{
    environment_id: string;
    environment_version: number;
    model_id: string;
    model_version: string;
    canonical_precision_version: string;
    accepted_helm_command: HelmCommand;
    /** Ordered immutable input evidence consumed by this exact transition. */
    causal_controls: readonly Readonly<{
      logical_tick: number;
      sequence: number;
      helm_command: HelmCommand;
      action_event_id: string;
      checkpoint_event_id: string;
    }>[];
    prior_state: PolarKinematicState;
    next_state: PolarKinematicState;
    observations: PolarObservations;
  }>;
}

export interface RawSimulationState {
  logical_tick: number;
  rng_state: number;
  helm_command: HelmCommand;
  heading: 'declared-unavailable' | number;
  cog: 'declared-unavailable' | number;
  true_wind: 'declared-unavailable' | Readonly<{ from_rad: number; speed_mps: number }>;
  apparent_wind: 'declared-unavailable' | Readonly<{ from_rad: number; speed_mps: number }>;
  contract_status: 'UNVALIDATED_DOMAIN_MODEL';
  lesson_id?: 'L02' | 'L03' | 'L04' | 'L05' | 'L06';
  l02_trim_acknowledgment?: L02SyntheticTrimObservation;
  reef_state?: 'not_selected' | 'selected';
  synthetic_episode?: 'pending' | 'gust_wave_observed' | 'complete';
  declared_navigation_concepts?: 'heading_cog_stw_sog_drift_mark';
  /** Derived from real position against the declared mark, never from which key was pressed. */
  mark_state?: 'declared-approach' | 'mark_arrival_recorded';
  synthetic_environment?: 'tide_depth_visibility_declared';
  decision_state?: 'undecided' | 'pass_recorded' | 'wait_recorded' | 'return_recorded';
  l01_synthetic_state?: L01SyntheticState;
  l01_last_helm_sequence?: number;
  /**
   * Present only on a session whose identity declares the polar kinematics
   * model. Deliberately optional (not part of `base`): every non-polar raw
   * state — including legacy L01 and L02-L05 — must keep its exact existing
   * shape so golden fixtures compare byte-identical under strict `toEqual`.
   */
  stw?: 'declared-unavailable' | number;
  sog?: 'declared-unavailable' | number;
  drift_angle?: 'declared-unavailable' | number;
  polar_kinematic_state?: PolarKinematicState;
  polar_last_helm_sequence?: number;
}

export interface DeterministicSession {
  identity: ReplayIdentity | ReplayV2;
  initial_seed_state: number;
  raw: RawSimulationState;
  ledger: readonly LedgerEvent[];
  paused: boolean;
  /**
   * Non-ledger authority evidence for accepted canonical actions. Lifecycle
   * controls deliberately do not emit ledger events, but still participate in
   * the same-tick sequence contract.
   */
  canonical_input_evidence: readonly { logical_tick: number; sequence: number }[];
  lifecycle: readonly { reason: LifecycleReason; logical_tick: number; next_sequence: number }[];
}

export class CanonicalInputContractError extends Error {
  readonly reason_code: 'REPLAY_ACTION_DISALLOWED' | 'CANONICAL_INPUT_CONTRACT_VIOLATION';

  constructor(message: string, reasonCode: 'REPLAY_ACTION_DISALLOWED' | 'CANONICAL_INPUT_CONTRACT_VIOLATION' = 'CANONICAL_INPUT_CONTRACT_VIOLATION') {
    super(message);
    this.name = 'CanonicalInputContractError';
    this.reason_code = reasonCode;
  }
}

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function seededState(seed: string): number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}

/** Named xorshift32 is deterministic and only consumed by logical tick progression. */
function nextRng(state: number): number {
  let next = state || 1;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

function eventId(tick: number, sequence: number, offset: number): string {
  return `${tick}:${sequence}:${offset}`;
}

function immutableLedger(events: readonly LedgerEvent[]): readonly LedgerEvent[] {
  return freeze(events.map((event) => freeze({ ...event })));
}

function initialRaw(seedState: number, scenario: string, l01Profile?: L01SyntheticEnvironmentV1, l02Profile?: L02SyntheticTrimProfileV1, l03Profile?: L03SyntheticAcknowledgmentProfileV2, polarProfile?: PolarKinematicsEnvironmentV1): RawSimulationState {
  const base = {
    logical_tick: 0,
    rng_state: seedState,
    helm_command: 'neutral',
    heading: 'declared-unavailable',
    cog: 'declared-unavailable',
    true_wind: 'declared-unavailable',
    apparent_wind: 'declared-unavailable',
    contract_status: 'UNVALIDATED_DOMAIN_MODEL',
  } as const;
  if (scenario.startsWith('l01-')) {
    if (polarProfile) {
      const initialState = createInitialPolarKinematicState(polarProfile);
      const initialTransition = transitionPolarKinematicState(polarProfile, initialState, []);
      const observations = projectPolarObservations(polarProfile, initialTransition);
      return freeze({
        ...base,
        helm_command: initialState.helm_command,
        heading: observations.heading_rad,
        cog: observations.cog_rad,
        true_wind: freeze({ from_rad: observations.true_wind_from_rad, speed_mps: observations.true_wind_speed_mps }),
        apparent_wind: freeze({ from_rad: observations.apparent_wind_from_rad, speed_mps: observations.apparent_wind_speed_mps }),
        stw: observations.stw_mps,
        sog: observations.sog_mps,
        drift_angle: observations.drift_angle_rad,
        polar_kinematic_state: initialState,
        polar_last_helm_sequence: 0,
      });
    }
    if (!l01Profile) throw new CanonicalInputContractError('L01 synthetic profile is missing.');
    const initialState = createInitialL01SyntheticState(l01Profile);
    const initialTransition = transitionL01SyntheticState(l01Profile, initialState, []);
    const observations = projectL01SyntheticObservations(l01Profile, initialTransition);
    return freeze({
      ...base,
      helm_command: initialState.helm_command,
      heading: observations.heading_rad,
      cog: observations.cog_rad,
      true_wind: freeze({ from_rad: observations.true_wind_from_rad, speed_mps: observations.true_wind_speed_mps }),
      apparent_wind: freeze({ from_rad: observations.apparent_wind_from_rad, speed_mps: observations.apparent_wind_speed_mps }),
      l01_synthetic_state: initialState,
      l01_last_helm_sequence: 0,
    });
  }
  if (scenario.startsWith('l02-')) {
    if (l02Profile && !isL02SyntheticTrimProfileV1(l02Profile)) throw new CanonicalInputContractError('L02 synthetic trim profile is invalid.');
    return freeze({ ...base, lesson_id: 'L02', l02_trim_acknowledgment: createInitialL02SyntheticTrimObservation() });
  }
  if (scenario.startsWith('l03-')) {
    if (l03Profile && !isL03SyntheticAcknowledgmentProfileV2(l03Profile)) throw new CanonicalInputContractError('L03 synthetic acknowledgment profile is invalid.');
    return freeze({ ...base, lesson_id: 'L03', reef_state: 'not_selected', synthetic_episode: 'pending' });
  }
  if (scenario.startsWith('l04-')) {
    if (!polarProfile) throw new CanonicalInputContractError('Polar kinematics profile is missing.');
    const initialState = createInitialPolarKinematicState(polarProfile);
    const initialTransition = transitionPolarKinematicState(polarProfile, initialState, []);
    const observations = projectPolarObservations(polarProfile, initialTransition);
    return freeze({
      ...base,
      lesson_id: 'L04',
      declared_navigation_concepts: 'heading_cog_stw_sog_drift_mark',
      mark_state: markStateFor(initialState.position_m, 'declared-approach'),
      helm_command: initialState.helm_command,
      heading: observations.heading_rad,
      cog: observations.cog_rad,
      true_wind: freeze({ from_rad: observations.true_wind_from_rad, speed_mps: observations.true_wind_speed_mps }),
      apparent_wind: freeze({ from_rad: observations.apparent_wind_from_rad, speed_mps: observations.apparent_wind_speed_mps }),
      stw: observations.stw_mps,
      sog: observations.sog_mps,
      drift_angle: observations.drift_angle_rad,
      polar_kinematic_state: initialState,
      polar_last_helm_sequence: 0,
    });
  }
  if (scenario.startsWith('l05-')) return freeze({ ...base, lesson_id: 'L05', synthetic_environment: 'tide_depth_visibility_declared', decision_state: 'undecided' });
  if (scenario.startsWith('l06-')) {
    if (!polarProfile) throw new CanonicalInputContractError('Polar kinematics profile is missing.');
    const initialState = createInitialPolarKinematicState(polarProfile);
    const initialTransition = transitionPolarKinematicState(polarProfile, initialState, []);
    const observations = projectPolarObservations(polarProfile, initialTransition);
    return freeze({
      ...base,
      lesson_id: 'L06',
      helm_command: initialState.helm_command,
      heading: observations.heading_rad,
      cog: observations.cog_rad,
      true_wind: freeze({ from_rad: observations.true_wind_from_rad, speed_mps: observations.true_wind_speed_mps }),
      apparent_wind: freeze({ from_rad: observations.apparent_wind_from_rad, speed_mps: observations.apparent_wind_speed_mps }),
      stw: observations.stw_mps,
      sog: observations.sog_mps,
      drift_angle: observations.drift_angle_rad,
      polar_kinematic_state: initialState,
      polar_last_helm_sequence: 0,
    });
  }
  return freeze(base);
}

/** Creates state only; action authority is resolved from the registered identity at use time. */
function isV2(identity: ReplayIdentity | ReplayV2): identity is ReplayV2 { return 'schema_version' in identity && identity.schema_version === 'replay-v2'; }
function sessionLesson(identity: ReplayIdentity | ReplayV2): string { return isV2(identity) ? `${identity.lesson_binding.lesson_id.toLowerCase()}-` : identity.scenario_version; }
function allowed(identity: ReplayIdentity | ReplayV2, action: unknown): action is DeclaredLessonAction { return isV2(identity) ? isLessonActionAllowedV2(identity.lesson_binding, action) : Boolean(resolveLessonPolicy(identity)?.permitted_actions.includes(action as DeclaredLessonAction)); }
/** The declared model_version selects exactly one L01 environment carrier; never both. */
function declaredModelVersion(identity: ReplayIdentity | ReplayV2): string { return isV2(identity) ? identity.lesson_binding.model_version : identity.model_version; }
function l01Profile(identity: ReplayIdentity | ReplayV2): L01SyntheticEnvironmentV1 | undefined {
  if (!sessionLesson(identity).startsWith('l01-')) return undefined;
  if (declaredModelVersion(identity) === POLAR_KINEMATICS_MODEL_VERSION) return undefined;
  const profile = identity.l01_synthetic_environment;
  if (!isL01SyntheticEnvironmentV1(profile) ||
    profile.environment_id !== l01SyntheticEnvironmentV1.environment_id ||
    profile.environment_version !== l01SyntheticEnvironmentV1.environment_version ||
    profile.model_id !== l01SyntheticEnvironmentV1.model_id ||
    profile.model_version !== l01SyntheticEnvironmentV1.model_version ||
    profile.logical_step_seconds !== l01SyntheticEnvironmentV1.logical_step_seconds ||
    profile.initial_position_m.x !== l01SyntheticEnvironmentV1.initial_position_m.x ||
    profile.initial_position_m.y !== l01SyntheticEnvironmentV1.initial_position_m.y ||
    profile.initial_heading_rad !== l01SyntheticEnvironmentV1.initial_heading_rad ||
    profile.forward_speed_mps !== l01SyntheticEnvironmentV1.forward_speed_mps ||
    profile.true_wind_from_rad !== l01SyntheticEnvironmentV1.true_wind_from_rad ||
    profile.true_wind_speed_mps !== l01SyntheticEnvironmentV1.true_wind_speed_mps ||
    profile.full_helm_turn_rad_per_step !== l01SyntheticEnvironmentV1.full_helm_turn_rad_per_step ||
    profile.canonical_precision_version !== l01SyntheticEnvironmentV1.canonical_precision_version) {
    throw new CanonicalInputContractError('L01 synthetic replay profile is invalid.');
  }
  return l01SyntheticEnvironmentV1;
}
/**
 * `current_epoch_ms` is the one field deliberately NOT pinned to the
 * canonical singleton: it legitimately varies per session (the real time the
 * player started it), so it is checked structurally instead — a non-negative
 * safe integer — while every other field stays pinned by exact equality.
 * The returned profile therefore preserves the caller's declared
 * `current_epoch_ms` rather than always returning the canonical `0`.
 */
function polarProfile(identity: ReplayIdentity | ReplayV2): PolarKinematicsEnvironmentV1 | undefined {
  const lesson = sessionLesson(identity);
  if (!lesson.startsWith('l01-') && !lesson.startsWith('l04-') && !lesson.startsWith('l06-')) return undefined;
  if (declaredModelVersion(identity) !== POLAR_KINEMATICS_MODEL_VERSION) return undefined;
  const profile = identity.polar_kinematics_environment;
  if (!isPolarKinematicsEnvironmentV1(profile) ||
    profile.environment_id !== polarKinematicsEnvironmentV1.environment_id ||
    profile.environment_version !== polarKinematicsEnvironmentV1.environment_version ||
    profile.model_id !== polarKinematicsEnvironmentV1.model_id ||
    profile.model_version !== polarKinematicsEnvironmentV1.model_version ||
    profile.logical_step_seconds !== polarKinematicsEnvironmentV1.logical_step_seconds ||
    profile.initial_position_m.x !== polarKinematicsEnvironmentV1.initial_position_m.x ||
    profile.initial_position_m.y !== polarKinematicsEnvironmentV1.initial_position_m.y ||
    profile.initial_heading_rad !== polarKinematicsEnvironmentV1.initial_heading_rad ||
    profile.polar_profile_id !== polarKinematicsEnvironmentV1.polar_profile_id ||
    profile.true_wind_from_rad !== polarKinematicsEnvironmentV1.true_wind_from_rad ||
    profile.true_wind_speed_mps !== polarKinematicsEnvironmentV1.true_wind_speed_mps ||
    !Number.isSafeInteger(profile.current_epoch_ms) || profile.current_epoch_ms < 0 ||
    profile.full_helm_turn_rad_per_step !== polarKinematicsEnvironmentV1.full_helm_turn_rad_per_step ||
    profile.canonical_precision_version !== polarKinematicsEnvironmentV1.canonical_precision_version) {
    throw new CanonicalInputContractError('Polar kinematics replay profile is invalid.');
  }
  // Return a frozen copy, not the caller's object: `freeze()` elsewhere in this
  // module is shallow, and this profile is re-read every tick. Returning the
  // candidate reference as-is would leave the derived current mutable
  // in-process even though every shipped call site already treats it as frozen.
  return Object.freeze({ ...profile, initial_position_m: Object.freeze({ ...profile.initial_position_m }) });
}
function l02Profile(identity: ReplayIdentity | ReplayV2): L02SyntheticTrimProfileV1 | undefined {
  if (!isV2(identity) || identity.lesson_binding.lesson_id !== 'L02') return undefined;
  if (!hasStrictL02ReplayV2TerminalAuthority(identity) || !isL02SyntheticTrimProfileV1(identity.l02_synthetic_trim_profile)) {
    throw new CanonicalInputContractError('L02 synthetic trim replay profile is invalid.');
  }
  return l02SyntheticTrimProfileV1;
}
function l03Profile(identity: ReplayIdentity | ReplayV2): L03SyntheticAcknowledgmentProfileV2 | undefined {
  if (!isV2(identity) || identity.lesson_binding.lesson_id !== 'L03') return undefined;
  if (!isL03SyntheticAcknowledgmentProfileV2(identity.l03_synthetic_acknowledgment_profile)) {
    throw new CanonicalInputContractError('L03 synthetic acknowledgment replay profile is invalid.');
  }
  return l03SyntheticAcknowledgmentProfileV2;
}
function l01TransitionEventId(tick: number): string { return `l01-transition:${tick}`; }
function polarTransitionEventId(tick: number): string { return `polar-transition:${tick}`; }
function isL01Raw(raw: RawSimulationState): raw is RawSimulationState & { l01_synthetic_state: L01SyntheticState; l01_last_helm_sequence: number } {
  return raw.l01_synthetic_state !== undefined && raw.l01_last_helm_sequence !== undefined;
}
/** Mirrors `isL01Raw` for the polar carrier; `isL01Raw` itself stays untouched. */
function isPolarRaw(raw: RawSimulationState): raw is RawSimulationState & { polar_kinematic_state: PolarKinematicState; polar_last_helm_sequence: number } {
  return raw.polar_kinematic_state !== undefined && raw.polar_last_helm_sequence !== undefined;
}
/** The polar carrier is shared by L01 (dead-but-built) and L06; every other lesson tags itself directly. */
function withinMarkArrivalRadius(position: Readonly<{ x: number; y: number }>): boolean {
  return Math.hypot(position.x - L04_TARGET_MARK.x_m, position.y - L04_TARGET_MARK.y_m) <= L04_MARK_ARRIVAL_RADIUS_M;
}

/**
 * Arrival is derived from real position against the declared course-template
 * mark. Once recorded it is terminal for the mark, so a later pass through the
 * radius never re-records it.
 */
function markStateFor(
  position: Readonly<{ x: number; y: number }>,
  previous: RawSimulationState['mark_state'],
): 'declared-approach' | 'mark_arrival_recorded' {
  if (previous === 'mark_arrival_recorded') return previous;
  return withinMarkArrivalRadius(position) ? 'mark_arrival_recorded' : 'declared-approach';
}

function polarLessonTag(identity: ReplayIdentity | ReplayV2): 'L01' | 'L04' | 'L06' {
  const lesson = sessionLesson(identity);
  if (lesson.startsWith('l06-')) return 'L06';
  if (lesson.startsWith('l04-')) return 'L04';
  return 'L01';
}

/**
 * The cause that marks a checkpoint as helm-correction causal evidence. Lessons
 * may append other checkpoint kinds (L04's mark arrival), which carry no action
 * link and must not be scanned as causal controls.
 */
const HELM_CORRECTION_CAUSE = 'declared helm correction recorded';

function l01CausalControlsForTick(ledger: readonly LedgerEvent[], logicalTick: number, lessonId: 'L01' | 'L04' | 'L06'): readonly Readonly<{
  logical_tick: number;
  sequence: number;
  helm_command: HelmCommand;
  action_event_id: string;
  checkpoint_event_id: string;
}>[] {
  const checkpointsByActionId = new Map<string, LedgerEvent>();
  for (const event of ledger) {
    if (event.type !== 'LESSON_CHECKPOINT' || event.lesson_id !== lessonId || event.tick !== logicalTick) continue;
    if (event.cause !== HELM_CORRECTION_CAUSE) continue;
    if (!event.action_event_id || checkpointsByActionId.has(event.action_event_id)) {
      throw new CanonicalInputContractError('L01 checkpoint causal evidence is invalid.');
    }
    checkpointsByActionId.set(event.action_event_id, event);
  }
  const controls = ledger
    .filter((event) => event.type === 'ACTION_ACCEPTED' && event.tick === logicalTick && (event.action === 'helm_port' || event.action === 'helm_starboard'))
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => {
      const checkpoint = checkpointsByActionId.get(event.id);
      if (!checkpoint || checkpoint.sequence !== event.sequence || checkpoint.tick !== event.tick) {
        throw new CanonicalInputContractError('L01 accepted helm action has no matching immutable checkpoint.');
      }
      return freeze({
        logical_tick: event.tick,
        sequence: event.sequence,
        helm_command: event.action === 'helm_port' ? 'port' as const : 'starboard' as const,
        action_event_id: event.id,
        checkpoint_event_id: checkpoint.id,
      });
    });
  if (controls.length !== checkpointsByActionId.size) {
    throw new CanonicalInputContractError('L01 checkpoint has no matching accepted helm action.');
  }
  return freeze(controls);
}

export function createSession(identity: ReplayIdentity | ReplayV2): DeterministicSession {
  const seedState = seededState(identity.seed);
  const profile = l01Profile(identity);
  const polarKinematicsProfile = polarProfile(identity);
  const trimProfile = l02Profile(identity);
  const acknowledgmentProfile = l03Profile(identity);
  const storedIdentity = freeze({
    ...identity,
    ordered_input_log: freeze([...identity.ordered_input_log]),
    ...(profile ? { l01_synthetic_environment: profile } : {}),
    ...(polarKinematicsProfile ? { polar_kinematics_environment: polarKinematicsProfile } : {}),
    ...(trimProfile ? { l02_synthetic_trim_profile: trimProfile } : {}),
    ...(acknowledgmentProfile ? { l03_synthetic_acknowledgment_profile: acknowledgmentProfile } : {}),
  }) as ReplayIdentity | ReplayV2;
  return freeze({
    identity: storedIdentity,
    initial_seed_state: seedState,
    raw: initialRaw(seedState, sessionLesson(identity), profile, trimProfile, acknowledgmentProfile, polarKinematicsProfile),
    ledger: immutableLedger([
      { id: eventId(0, 0, 0), tick: 0, sequence: 0, type: 'SESSION_STARTED', contract_status: 'UNVALIDATED_DOMAIN_MODEL' },
    ]),
    paused: false,
    canonical_input_evidence: freeze([]),
    lifecycle: freeze([]),
  });
}

function withSession(
  previous: DeterministicSession,
  changes: Partial<Omit<DeterministicSession, 'identity' | 'initial_seed_state'>>,
): DeterministicSession {
  return freeze({ ...previous, ...changes });
}

function assertCanonicalSequence(session: DeterministicSession, input: CanonicalInput): void {
  const conflicting = session.canonical_input_evidence.find((evidence) =>
    evidence.logical_tick === input.logical_tick && evidence.sequence >= input.sequence,
  );
  if (!conflicting) return;
  if (conflicting.sequence === input.sequence) {
    throw new CanonicalInputContractError('Input sequence collision at one logical tick.');
  }
  throw new CanonicalInputContractError('Input sequence must strictly increase at one logical tick.');
}

function withAcceptedCanonicalInput(session: DeterministicSession, input: CanonicalInput): DeterministicSession {
  return withSession(session, {
    canonical_input_evidence: freeze([
      ...session.canonical_input_evidence,
      freeze({ logical_tick: input.logical_tick, sequence: input.sequence }),
    ]),
  });
}

/** A logical tick has no renderer or wall-clock dependency. */
export function advanceLogicalTick(session: DeterministicSession): DeterministicSession {
  if (session.paused) return session;
  if (session.raw.lesson_id === 'L03' && session.raw.synthetic_episode === 'complete' && session.raw.reef_state === 'selected') return session;
  if (isL01Raw(session.raw)) {
    const profile = l01Profile(session.identity);
    if (!profile) throw new CanonicalInputContractError('L01 synthetic replay profile is missing.');
    const causalControls = l01CausalControlsForTick(session.ledger, session.raw.logical_tick, 'L01');
    const transition = transitionL01SyntheticState(profile, session.raw.l01_synthetic_state, causalControls);
    const observations = projectL01SyntheticObservations(profile, transition);
    const transitionId = l01TransitionEventId(session.raw.logical_tick);
    const event: LedgerEvent = {
      id: transitionId,
      tick: session.raw.logical_tick,
      sequence: causalControls.at(-1)?.sequence ?? session.raw.l01_last_helm_sequence,
      type: 'L01_SYNTHETIC_TRANSITION',
      lesson_id: 'L01',
      synthetic: true,
      l01_transition: freeze({
        environment_id: profile.environment_id,
        environment_version: profile.environment_version,
        model_id: profile.model_id,
        model_version: profile.model_version,
        canonical_precision_version: profile.canonical_precision_version,
        accepted_helm_command: transition.accepted_helm_command,
        causal_controls: causalControls,
        prior_state: transition.prior_state,
        next_state: transition.next_state,
        observations,
      }),
    };
    return withSession(session, {
      raw: freeze({
        ...session.raw,
        logical_tick: transition.next_state.logical_tick,
        rng_state: nextRng(session.raw.rng_state),
        helm_command: transition.accepted_helm_command,
        heading: observations.heading_rad,
        cog: observations.cog_rad,
        true_wind: freeze({ from_rad: observations.true_wind_from_rad, speed_mps: observations.true_wind_speed_mps }),
        apparent_wind: freeze({ from_rad: observations.apparent_wind_from_rad, speed_mps: observations.apparent_wind_speed_mps }),
        l01_synthetic_state: transition.next_state,
        l01_last_helm_sequence: causalControls.at(-1)?.sequence ?? session.raw.l01_last_helm_sequence,
      }),
      ledger: immutableLedger([...session.ledger, event]),
    });
  }
  if (isPolarRaw(session.raw)) {
    const profile = polarProfile(session.identity);
    if (!profile) throw new CanonicalInputContractError('Polar kinematics replay profile is missing.');
    const lessonTag = polarLessonTag(session.identity);
    const causalControls = l01CausalControlsForTick(session.ledger, session.raw.logical_tick, lessonTag);
    const transition = transitionPolarKinematicState(profile, session.raw.polar_kinematic_state, causalControls);
    const observations = projectPolarObservations(profile, transition);
    const transitionId = polarTransitionEventId(session.raw.logical_tick);
    const event: LedgerEvent = {
      id: transitionId,
      tick: session.raw.logical_tick,
      sequence: causalControls.at(-1)?.sequence ?? session.raw.polar_last_helm_sequence,
      type: 'POLAR_KINEMATIC_TRANSITION',
      lesson_id: lessonTag,
      synthetic: true,
      polar_transition: freeze({
        environment_id: profile.environment_id,
        environment_version: profile.environment_version,
        model_id: profile.model_id,
        model_version: profile.model_version,
        canonical_precision_version: profile.canonical_precision_version,
        accepted_helm_command: transition.accepted_helm_command,
        causal_controls: causalControls,
        prior_state: transition.prior_state,
        next_state: transition.next_state,
        observations,
      }),
    };
    const priorMarkState = session.raw.mark_state;
    const nextMarkState = lessonTag === 'L04' ? markStateFor(transition.next_state.position_m, priorMarkState) : priorMarkState;
    const arrivalEvent: LedgerEvent | undefined =
      lessonTag === 'L04' && priorMarkState !== 'mark_arrival_recorded' && nextMarkState === 'mark_arrival_recorded'
        ? {
            id: eventId(transition.next_state.logical_tick, causalControls.at(-1)?.sequence ?? session.raw.polar_last_helm_sequence ?? 0, session.ledger.length + 2),
            tick: transition.next_state.logical_tick,
            sequence: causalControls.at(-1)?.sequence ?? session.raw.polar_last_helm_sequence ?? 0,
            type: 'LESSON_CHECKPOINT',
            lesson_id: 'L04',
            synthetic: true,
            cause: L04_MARK_ARRIVAL_CAUSE,
            transition_event_id: transitionId,
          }
        : undefined;
    return withSession(session, {
      raw: freeze({
        ...session.raw,
        logical_tick: transition.next_state.logical_tick,
        rng_state: nextRng(session.raw.rng_state),
        helm_command: transition.accepted_helm_command,
        heading: observations.heading_rad,
        cog: observations.cog_rad,
        true_wind: freeze({ from_rad: observations.true_wind_from_rad, speed_mps: observations.true_wind_speed_mps }),
        apparent_wind: freeze({ from_rad: observations.apparent_wind_from_rad, speed_mps: observations.apparent_wind_speed_mps }),
        stw: observations.stw_mps,
        sog: observations.sog_mps,
        drift_angle: observations.drift_angle_rad,
        ...(lessonTag === 'L04' ? { mark_state: nextMarkState } : {}),
        polar_kinematic_state: transition.next_state,
        polar_last_helm_sequence: causalControls.at(-1)?.sequence ?? session.raw.polar_last_helm_sequence,
      }),
      ledger: immutableLedger(arrivalEvent ? [...session.ledger, event, arrivalEvent] : [...session.ledger, event]),
    });
  }
  if (session.raw.lesson_id === 'L03' && session.raw.logical_tick === 0) {
    const episode: LedgerEvent = { id: eventId(0, 0, session.ledger.length), tick: 0, sequence: 0, type: 'ENVIRONMENT_EPISODE', lesson_id: 'L03', cause: 'deterministic synthetic gust/wave cue' };
    return withSession(session, { raw: freeze({ ...session.raw, logical_tick: 1, rng_state: nextRng(session.raw.rng_state), synthetic_episode: 'gust_wave_observed' }), ledger: immutableLedger([...session.ledger, episode]) });
  }
  return withSession(session, {
    raw: freeze({ ...session.raw, logical_tick: session.raw.logical_tick + 1, rng_state: nextRng(session.raw.rng_state) }),
  });
}

export function applyCanonicalInput(session: DeterministicSession, input: CanonicalInput): DeterministicSession {
  if (session.raw.lesson_id === 'L03' && session.raw.synthetic_episode === 'complete' && session.raw.reef_state === 'selected') return session;
  if (!allowed(session.identity, input.input.action)) return session;
  const isL03V2Acknowledgment = isV2(session.identity) && session.identity.lesson_binding.lesson_id === 'L03';
  if (isL03V2Acknowledgment && !['pause', 'resume'].includes(input.input.action) && (input.input.action !== 'reef' || session.raw.synthetic_episode !== 'gust_wave_observed' || session.raw.reef_state !== 'not_selected')) return session;
  const policy = isV2(session.identity) ? undefined : resolveLessonPolicy(session.identity);
  if (input.logical_tick !== session.raw.logical_tick) return session;
  assertCanonicalSequence(session, input);
  if (input.input.action === 'reset') return createSession({ ...session.identity, ordered_input_log: session.identity.ordered_input_log } as ReplayIdentity | ReplayV2);
  if (session.paused && input.input.action !== 'resume') return session;
  if (!session.paused && input.input.action === 'resume') return session;
  if (input.input.action === 'pause') return withAcceptedCanonicalInput(withSession(session, { paused: true }), input);
  if (input.input.action === 'resume') return withAcceptedCanonicalInput(withSession(session, { paused: false }), input);

  const action = input.input.action;
  const event: LedgerEvent = {
    id: eventId(input.logical_tick, input.sequence, session.ledger.length),
    tick: input.logical_tick,
    sequence: input.sequence,
    type: 'ACTION_ACCEPTED',
    action,
    contract_status: 'UNVALIDATED_DOMAIN_MODEL',
  };
  let raw: RawSimulationState = (isL01Raw(session.raw) || isPolarRaw(session.raw))
    ? session.raw
    : action === 'helm_port'
      ? freeze({ ...session.raw, helm_command: 'port' as const })
      : action === 'helm_starboard'
        ? freeze({ ...session.raw, helm_command: 'starboard' as const })
        : session.raw;
  let extra: LedgerEvent | undefined;
  if ((isL01Raw(session.raw) || isPolarRaw(session.raw)) && (action === 'helm_port' || action === 'helm_starboard')) {
    extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: polarLessonTag(session.identity), cause: HELM_CORRECTION_CAUSE, action_event_id: event.id };
  }
  if (raw.lesson_id === 'L02' && (action === 'main_trim' || action === 'jib_trim')) {
    const previousAcknowledgment = raw.l02_trim_acknowledgment;
    if (!previousAcknowledgment) throw new CanonicalInputContractError('L02 synthetic trim acknowledgment is missing.');
    const acknowledgment = reduceL02SyntheticTrimObservation(previousAcknowledgment, { action, logical_tick: input.logical_tick, sequence: input.sequence });
    raw = freeze({ ...raw, l02_trim_acknowledgment: acknowledgment });
    if (previousAcknowledgment.causal_state !== 'both' && acknowledgment.causal_state === 'both') {
      extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L02', cause: 'main/jib synthetic trim causality recorded' };
    }
  }
  if (action === 'reef' && raw.lesson_id === 'L03') {
    raw = freeze({ ...raw, reef_state: 'selected', synthetic_episode: 'complete' });
    extra = {
      id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1),
      tick: input.logical_tick,
      sequence: input.sequence,
      type: 'LESSON_CHECKPOINT',
      lesson_id: 'L03',
      cause: isL03V2Acknowledgment ? 'synthetic acknowledgment checkpoint recorded' : 'conservative synthetic reef mitigation recorded',
    };
  }
  if (raw.lesson_id === 'L05' && (action === 'decision_pass' || action === 'decision_wait' || action === 'decision_return')) { raw = freeze({ ...raw, decision_state: action === 'decision_pass' ? 'pass_recorded' : action === 'decision_wait' ? 'wait_recorded' : 'return_recorded' }); extra = { id: eventId(input.logical_tick, input.sequence, session.ledger.length + 1), tick: input.logical_tick, sequence: input.sequence, type: 'LESSON_CHECKPOINT', lesson_id: 'L05', cause: `synthetic ${action.replace('decision_', '')} decision recorded` }; }
  const safetyEvent = policy?.synthetic_safety_event?.action === action
    ? { id: eventId(input.logical_tick, input.sequence, session.ledger.length + (extra ? 2 : 1)), tick: input.logical_tick, sequence: input.sequence, type: 'SAFETY_BLOCKED' as const, contract_status: 'UNVALIDATED_DOMAIN_MODEL' as const, synthetic: true as const, cause: 'manifest-declared synthetic event' }
    : undefined;
  return withAcceptedCanonicalInput(withSession(session, {
    raw,
    ledger: immutableLedger([...session.ledger, event, ...(extra ? [extra] : []), ...(safetyEvent ? [safetyEvent] : [])]),
  }), input);
}

/** Browser lifecycle is recorded without progressing raw tick/RNG/ledger. */
export function pauseForLifecycle(session: DeterministicSession, reason: LifecycleReason, nextSequence: number): DeterministicSession {
  if (session.paused) return session;
  return withSession(session, {
    paused: true,
    lifecycle: freeze([...session.lifecycle, freeze({ reason, logical_tick: session.raw.logical_tick, next_sequence: nextSequence })]),
  });
}

function isExactCanonicalInput(value: unknown): value is CanonicalInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (!Number.isSafeInteger(input.logical_tick) || (input.logical_tick as number) < 0 ||
    !Number.isSafeInteger(input.sequence) || (input.sequence as number) < 0 ||
    typeof input.input !== 'object' || input.input === null || Array.isArray(input.input)) return false;
  const action = input.input as Record<string, unknown>;
  return Object.keys(input).length === 3 && Object.keys(action).length === 1 && Object.hasOwn(action, 'action');
}

function sameCanonicalInputLog(
  persisted: readonly unknown[],
  supplied: readonly CanonicalInput[],
): boolean {
  return persisted.length === supplied.length && persisted.every((entry, index) => {
    const input = supplied[index];
    return input !== undefined && isExactCanonicalInput(entry) && isExactCanonicalInput(input) &&
      entry.logical_tick === input.logical_tick &&
      entry.sequence === input.sequence &&
      entry.input.action === input.input.action;
  });
}

export function replayInputs(
  identity: ReplayIdentity | ReplayV2,
  inputs: readonly CanonicalInput[],
  terminalTicks: number,
): DeterministicSession {
  if (!Number.isSafeInteger(terminalTicks) || terminalTicks < 0) {
    throw new CanonicalInputContractError('terminalTicks must be a non-negative safe integer.');
  }
  if (!isV2(identity) && !resolveLessonPolicy(identity)) {
    throw new CanonicalInputContractError('REPLAY_ACTION_DISALLOWED', 'REPLAY_ACTION_DISALLOWED');
  }
  const isL01V2TerminalReplay = isV2(identity) && identity.lesson_binding.lesson_id === 'L01';
  const isL02V2TerminalReplay = isV2(identity) && identity.lesson_binding.lesson_id === 'L02';
  const isL03V2TerminalReplay = isV2(identity) && identity.lesson_binding.lesson_id === 'L03';
  if (isL01V2TerminalReplay) {
    if (!hasStrictL01ReplayV2TerminalAuthority(identity)) {
      throw new CanonicalInputContractError('L01 Replay V2 terminal authority is invalid.');
    }
    if (terminalTicks !== identity.l01_terminal_logical_tick) {
      throw new CanonicalInputContractError('L01 Replay V2 terminal logical tick contradicts its identity.');
    }
    if (!sameCanonicalInputLog(identity.ordered_input_log, inputs)) {
      throw new CanonicalInputContractError('L01 Replay V2 inputs contradict its canonical identity log.');
    }
  }
  if (isL02V2TerminalReplay) {
    if (!hasStrictL02ReplayV2TerminalAuthority(identity)) {
      throw new CanonicalInputContractError('L02 Replay V2 terminal authority is invalid.');
    }
    if (terminalTicks !== identity.l02_terminal_logical_tick) {
      throw new CanonicalInputContractError('L02 Replay V2 terminal logical tick contradicts its identity.');
    }
    if (!sameCanonicalInputLog(identity.ordered_input_log, inputs)) {
      throw new CanonicalInputContractError('L02 Replay V2 inputs contradict its canonical identity log.');
    }
  }
  if (isL03V2TerminalReplay) {
    if (!hasStrictL03ReplayV2TerminalAuthority(identity)) {
      throw new CanonicalInputContractError('L03 Replay V2 terminal acknowledgment authority is invalid.');
    }
    if (terminalTicks !== identity.l03_terminal_logical_tick) {
      throw new CanonicalInputContractError('L03 Replay V2 terminal logical tick contradicts its identity.');
    }
    if (!sameCanonicalInputLog(identity.ordered_input_log, inputs)) {
      throw new CanonicalInputContractError('L03 Replay V2 inputs contradict its canonical identity log.');
    }
  }
  const authoritativeTerminalTicks: number = isL01V2TerminalReplay ? identity.l01_terminal_logical_tick! : isL02V2TerminalReplay ? identity.l02_terminal_logical_tick! : isL03V2TerminalReplay ? identity.l03_terminal_logical_tick! : terminalTicks;
  const ordered = isL01V2TerminalReplay || isL02V2TerminalReplay || isL03V2TerminalReplay
    ? [...identity.ordered_input_log] as CanonicalInput[]
    : [...inputs].sort((left, right) => left.logical_tick - right.logical_tick || left.sequence - right.sequence);
  for (const input of ordered) {
    if (!allowed(identity, input.input.action)) {
      throw new CanonicalInputContractError('REPLAY_ACTION_DISALLOWED', 'REPLAY_ACTION_DISALLOWED');
    }
    if ((sessionLesson(identity).startsWith('l01-') || isL02V2TerminalReplay || isL03V2TerminalReplay) && input.input.action === 'reset') {
      throw new CanonicalInputContractError('REPLAY_ACTION_DISALLOWED', 'REPLAY_ACTION_DISALLOWED');
    }
  }
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const input = ordered[index];
    if (!previous || !input) continue;
    if (previous.logical_tick === input.logical_tick && previous.sequence === input.sequence) {
      throw new CanonicalInputContractError('Input sequence collision at one logical tick.');
    }
  }
  let session = createSession(identity);
  let index = 0;
  while (session.raw.logical_tick < authoritativeTerminalTicks || isL01V2TerminalReplay || isL02V2TerminalReplay || isL03V2TerminalReplay) {
    while (ordered[index]?.logical_tick === session.raw.logical_tick) {
      const input = ordered[index];
      if (!input) break;
      session = applyCanonicalInput(session, input);
      index += 1;
    }
    if ((isL01V2TerminalReplay || isL02V2TerminalReplay || isL03V2TerminalReplay) && session.raw.logical_tick === authoritativeTerminalTicks) break;
    const before = session.raw.logical_tick;
    session = advanceLogicalTick(session);
    if (session.raw.logical_tick === before) break;
  }
  if ((isL01V2TerminalReplay || isL02V2TerminalReplay || isL03V2TerminalReplay) && session.raw.logical_tick !== authoritativeTerminalTicks) {
    throw new CanonicalInputContractError(`${isL01V2TerminalReplay ? 'L01' : isL02V2TerminalReplay ? 'L02' : 'L03'} Replay V2 terminal logical tick is unreachable.`);
  }
  if (isL03V2TerminalReplay) {
    const isCompletedAcknowledgment = session.raw.synthetic_episode === 'complete' && session.raw.reef_state === 'selected';
    const isPreTerminalState = session.raw.reef_state === 'not_selected' &&
      (authoritativeTerminalTicks === 0
        ? session.raw.synthetic_episode === 'pending'
        : session.raw.synthetic_episode === 'gust_wave_observed');
    if (!isCompletedAcknowledgment && !isPreTerminalState) {
      throw new CanonicalInputContractError('L03 Replay V2 terminal acknowledgment state is unreachable.');
    }
  }
  const terminalPaused = isL01V2TerminalReplay ? identity.l01_terminal_paused : isL02V2TerminalReplay ? identity.l02_terminal_paused : isL03V2TerminalReplay ? identity.l03_terminal_paused : undefined;
  return terminalPaused !== undefined && terminalPaused !== session.paused
    ? withSession(session, { paused: terminalPaused })
    : session;
}
